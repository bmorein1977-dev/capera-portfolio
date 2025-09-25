import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import csv from "csv-parser";
import * as XLSX from "xlsx";
import { Readable } from "stream";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import {
  insertUserSchema,
  insertCompetencyCategorySchema,
  insertCompetencyElementSchema,
  insertCompetencySchema,
  insertCompetenceSubcategorySchema,
  insertCompetenceCriteriaSchema,
  insertJobRoleSchema,
  insertCompetencyMatrixSchema,
  insertCompetencyCertificationSchema,
  insertExpiryAlertSchema,
  type CompetencyCategory,
  type CompetencyElement,
  type Competency,
  type JobRole,
  type CompetencyMatrix,
  type CompetencyCertification,
  type ExpiryAlert,
  type TrainingCategory,
  type Training,
  type TrainingLevel,
  type TrainingCertificate,
  type InsertUser,
  insertTrainingCategorySchema,
  insertTrainingSchema,
  insertTrainingLevelSchema,
  insertTrainingCertificateSchema,
  excelImportRowSchema,
  type ExcelImportRow,
  type ExcelImportResult,
  businessSectors,
} from "@shared/schema";
import { aiThemingService } from "./services/aiTheming";
import { translationService } from "./services/translationService";
import { z } from "zod";

// Helper function to parse assessment methods string into array
function parseAssessmentMethods(methodsString: string): ('K' | 'KE' | 'KP' | 'T')[] {
  if (!methodsString || typeof methodsString !== 'string') return [];
  
  return methodsString
    .split(/[,;|\s]+/)
    .map(method => method.trim().toUpperCase())
    .filter(method => ['K', 'KE', 'KP', 'T'].includes(method)) as ('K' | 'KE' | 'KP' | 'T')[];
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication middleware setup
  await setupAuth(app);

  // File upload middleware setup
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  });

  // Role-based middleware with super_admin hierarchy
  function requireRole(...roles: string[]) {
    return async (req: any, res: any, next: any) => {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(403).json({ message: "User not found" });
      }
      
      // Super admin always has access
      if (user.role === 'super_admin' || roles.includes(user.role)) {
        req.currentUser = user;
        return next();
      }
      
      return res.status(403).json({ message: "Insufficient permissions" });
    };
  }
  
  // Resource-aware owner check middleware
  function checkCertificateOwnerOrRoles(roles: string[]) {
    return async (req: any, res: any, next: any) => {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(403).json({ message: "User not found" });
      }
      
      // Super admin or specified roles always have access
      if (user.role === 'super_admin' || roles.includes(user.role)) {
        req.currentUser = user;
        return next();
      }
      
      // For ID-based routes, check certificate ownership
      if (req.params.id) {
        const certificate = await storage.getTrainingCertificate(req.params.id);
        if (certificate && certificate.userId === userId) {
          req.currentUser = user;
          return next();
        }
      }
      
      // For body-based routes (POST), check userId in body
      if (req.body.userId === userId) {
        req.currentUser = user;
        return next();
      }
      
      return res.status(403).json({ message: "Insufficient permissions" });
    };
  }

  // Authentication routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // HR Import endpoint - Admin only
  app.post('/api/hr/import-users', isAuthenticated, requireRole('admin', 'super_admin'), upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const { defaultRole = 'candidate' } = req.body;
      const fileName = req.file.originalname.toLowerCase();
      let rows: any[] = [];

      // Parse CSV file
      if (fileName.endsWith('.csv')) {
        const csvString = req.file.buffer.toString('utf-8');
        
        // Promise-based CSV parsing
        rows = await new Promise((resolve, reject) => {
          const results: any[] = [];
          const stream = Readable.from([csvString]);
          
          stream
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', reject);
        });
      }
      // Parse Excel file
      else if (fileName.endsWith('.xlsx')) {
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        rows = XLSX.utils.sheet_to_json(worksheet);
      } else {
        return res.status(400).json({ message: "Unsupported file format. Please upload CSV or XLSX files." });
      }

      // Transform rows to InsertUser format with role validation
      const validRoles = ['candidate', 'trainee', 'assessor', 'internal_verifier'];
      const adminRoles = ['admin', 'manager'];
      const superAdminRoles = ['super_admin', 'developer'];
      
      const processedUsers: { user: InsertUser, errors: string[] }[] = rows.map((row: any) => {
        const errors: string[] = [];
        
        // Normalize header names (handle different case variations)
        const normalizedRow: any = {};
        Object.keys(row).forEach(key => {
          const normalizedKey = key.toLowerCase().trim();
          normalizedRow[normalizedKey] = typeof row[key] === 'string' ? row[key].trim() : row[key];
        });

        // Map various possible header names to our schema
        const email = normalizedRow.email || normalizedRow['email address'] || normalizedRow.emailaddress;
        const firstName = normalizedRow.firstname || normalizedRow['first name'] || normalizedRow.first_name || normalizedRow.fname;
        const lastName = normalizedRow.lastname || normalizedRow['last name'] || normalizedRow.last_name || normalizedRow.lname || normalizedRow.surname;
        const rawRole = normalizedRow.role || normalizedRow.position || normalizedRow.jobtitle || normalizedRow['job title'] || defaultRole;
        const department = normalizedRow.department || normalizedRow.dept || normalizedRow.division;
        const location = normalizedRow.location || normalizedRow.office || normalizedRow.site;

        // Validate role and apply privilege constraints
        let role = rawRole.toLowerCase();
        
        // Prevent privilege escalation - only super_admin can create admin+ roles
        if (superAdminRoles.includes(role)) {
          if (req.currentUser.role !== 'super_admin') {
            errors.push(`Cannot assign role '${role}' - requires super_admin privileges`);
            role = defaultRole;
          }
        } else if (adminRoles.includes(role)) {
          if (!['super_admin', 'admin'].includes(req.currentUser.role)) {
            errors.push(`Cannot assign role '${role}' - requires admin privileges`);
            role = defaultRole;
          }
        } else if (!validRoles.includes(role)) {
          errors.push(`Invalid role '${role}' - using default role '${defaultRole}'`);
          role = defaultRole;
        }

        const user: InsertUser = {
          email,
          firstName,
          lastName,
          role,
          department,
          location,
        };

        // Validate with schema
        try {
          insertUserSchema.parse(user);
        } catch (schemaError) {
          if (schemaError instanceof z.ZodError) {
            errors.push(...schemaError.errors.map(e => `${e.path.join('.')}: ${e.message}`));
          }
        }

        return { user, errors };
      });

      // Separate valid users from those with errors
      const users: InsertUser[] = [];
      const rowErrors: { row: number, user: any, errors: string[] }[] = [];
      
      processedUsers.forEach((processed, index) => {
        if (processed.errors.length === 0 && processed.user.email && processed.user.firstName && processed.user.lastName) {
          users.push(processed.user);
        } else {
          rowErrors.push({ row: index + 1, user: processed.user, errors: processed.errors });
        }
      });

      if (users.length === 0) {
        return res.status(400).json({ message: "No valid user records found in the uploaded file" });
      }

      // Bulk create users
      const result = await storage.createBulkUsers(users);

      res.json({
        message: "User import completed",
        total: processedUsers.length,
        successful: result.success.length,
        failed: result.failed.length + rowErrors.length,
        validation_errors: rowErrors,
        creation_errors: result.failed,
        users: result.success
      });

    } catch (error) {
      console.error("HR import error:", error);
      res.status(500).json({ message: "Failed to import users", error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // Training Records API - Get records with expiry status tracking
  app.get('/api/training/records', isAuthenticated, async (req: any, res) => {
    try {
      const { user_id } = req.query;
      const currentUserId = req.user.claims.sub;
      const currentUser = await storage.getUser(currentUserId);
      
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Determine target user ID for the request
      let targetUserId = user_id || currentUserId;
      
      // Check permissions - admin/super_admin/manager can view other users' records
      if (targetUserId !== currentUserId && !['admin', 'super_admin', 'manager'].includes(currentUser.role)) {
        return res.status(403).json({ message: "Insufficient permissions to view other users' records" });
      }

      const records = await storage.getTrainingRecordsWithStatus(targetUserId);
      
      res.json({ 
        records: records.map(record => ({
          id: record.id,
          training_id: record.trainingId,
          training_name: record.trainingName,
          achievement_date: record.achievementDate ? record.achievementDate.toISOString().split('T')[0] : null,
          expiry_date: record.expiryDate ? record.expiryDate.toISOString().split('T')[0] : null,
          certificate_path: record.certificateUrl,
          certificate_file_name: record.certificateFileName,
          status: record.status
        }))
      });
    } catch (error) {
      console.error("Error fetching training records:", error);
      res.status(500).json({ message: "Failed to fetch training records" });
    }
  });

  // Update training record dates
  app.post('/api/training/records/:id/dates', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { achievement_date, expiry_date } = req.body;
      
      const currentUserId = req.user.claims.sub;
      const currentUser = await storage.getUser(currentUserId);
      
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if record exists and get ownership
      const record = await storage.getTrainingCertificate(id);
      if (!record) {
        return res.status(404).json({ message: "Training record not found" });
      }

      // Check permissions - users can only update their own records, admins/managers can update any
      if (record.userId !== currentUserId && !['admin', 'super_admin', 'manager'].includes(currentUser.role)) {
        return res.status(403).json({ message: "Insufficient permissions to update this record" });
      }

      const achievementDate = achievement_date ? new Date(achievement_date) : undefined;
      const expiryDate = expiry_date ? new Date(expiry_date) : undefined;

      const updatedRecord = await storage.updateTrainingCertificateDates(id, achievementDate, expiryDate);
      
      if (!updatedRecord) {
        return res.status(404).json({ message: "Failed to update training record" });
      }

      res.json({ 
        message: "Training record dates updated successfully",
        record: {
          id: updatedRecord.id,
          achievement_date: updatedRecord.achievementDate ? updatedRecord.achievementDate.toISOString().split('T')[0] : null,
          expiry_date: updatedRecord.expiryDate ? updatedRecord.expiryDate.toISOString().split('T')[0] : null
        }
      });
    } catch (error) {
      console.error("Error updating training record dates:", error);
      res.status(500).json({ message: "Failed to update training record dates" });
    }
  });

  // Training Management Routes - /api/trainings namespace

  // Training Categories CRUD
  app.get("/api/training-categories", async (req, res) => {
    try {
      const categories = await storage.getTrainingCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching training categories:", error);
      res.status(500).json({ error: "Failed to fetch training categories" });
    }
  });

  app.get("/api/training-categories/:id", async (req, res) => {
    try {
      const category = await storage.getTrainingCategory(req.params.id);
      if (!category) {
        return res.status(404).json({ error: "Training category not found" });
      }
      res.json(category);
    } catch (error) {
      console.error("Error fetching training category:", error);
      res.status(500).json({ error: "Failed to fetch training category" });
    }
  });

  app.post("/api/training-categories", isAuthenticated, requireRole('admin', 'manager'), async (req, res) => {
    try {
      const validatedData = insertTrainingCategorySchema.parse(req.body);
      const category = await storage.createTrainingCategory(validatedData);
      res.status(201).json(category);
    } catch (error) {
      console.error("Error creating training category:", error);
      res.status(500).json({ error: "Failed to create training category" });
    }
  });

  app.put("/api/training-categories/:id", isAuthenticated, requireRole('admin', 'manager'), async (req, res) => {
    try {
      const validatedData = insertTrainingCategorySchema.partial().parse(req.body);
      const category = await storage.updateTrainingCategory(req.params.id, validatedData);
      if (!category) {
        return res.status(404).json({ error: "Training category not found" });
      }
      res.json(category);
    } catch (error) {
      console.error("Error updating training category:", error);
      res.status(500).json({ error: "Failed to update training category" });
    }
  });

  app.delete("/api/training-categories/:id", isAuthenticated, requireRole('admin', 'manager'), async (req, res) => {
    try {
      const success = await storage.deleteTrainingCategory(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Training category not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting training category:", error);
      res.status(500).json({ error: "Failed to delete training category" });
    }
  });

  // Trainings CRUD
  app.get("/api/trainings", async (req, res) => {
    try {
      const { categoryId } = req.query;
      const trainings = await storage.getTrainings(categoryId as string);
      res.json(trainings);
    } catch (error) {
      console.error("Error fetching trainings:", error);
      res.status(500).json({ error: "Failed to fetch trainings" });
    }
  });

  app.get("/api/trainings/:id", async (req, res) => {
    try {
      const training = await storage.getTraining(req.params.id);
      if (!training) {
        return res.status(404).json({ error: "Training not found" });
      }
      res.json(training);
    } catch (error) {
      console.error("Error fetching training:", error);
      res.status(500).json({ error: "Failed to fetch training" });
    }
  });

  app.post("/api/trainings", isAuthenticated, requireRole('admin', 'manager'), async (req, res) => {
    try {
      const validatedData = insertTrainingSchema.parse(req.body);
      const training = await storage.createTraining(validatedData);
      res.status(201).json(training);
    } catch (error) {
      console.error("Error creating training:", error);
      res.status(500).json({ error: "Failed to create training" });
    }
  });

  // Training Levels CRUD
  app.get("/api/training-levels", async (req, res) => {
    try {
      const { trainingId } = req.query;
      const levels = await storage.getTrainingLevels(trainingId as string);
      res.json(levels);
    } catch (error) {
      console.error("Error fetching training levels:", error);
      res.status(500).json({ error: "Failed to fetch training levels" });
    }
  });

  app.post("/api/training-levels", isAuthenticated, requireRole('admin', 'manager'), async (req, res) => {
    try {
      const validatedData = insertTrainingLevelSchema.parse(req.body);
      const level = await storage.createTrainingLevel(validatedData);
      res.status(201).json(level);
    } catch (error) {
      console.error("Error creating training level:", error);
      res.status(500).json({ error: "Failed to create training level" });
    }
  });

  app.put("/api/trainings/:id", isAuthenticated, requireRole('admin', 'manager'), async (req, res) => {
    try {
      const validatedData = insertTrainingSchema.partial().parse(req.body);
      const training = await storage.updateTraining(req.params.id, validatedData);
      if (!training) {
        return res.status(404).json({ error: "Training not found" });
      }
      res.json(training);
    } catch (error) {
      console.error("Error updating training:", error);
      res.status(500).json({ error: "Failed to update training" });
    }
  });

  app.delete("/api/trainings/:id", isAuthenticated, requireRole('admin', 'manager'), async (req, res) => {
    try {
      const success = await storage.deleteTraining(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Training not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting training:", error);
      res.status(500).json({ error: "Failed to delete training" });
    }
  });

  // Training Certificates CRUD
  app.get("/api/training-certificates", async (req, res) => {
    try {
      const { userId, trainingId } = req.query;
      const certificates = await storage.getTrainingCertificates(
        userId as string, 
        trainingId as string
      );
      res.json(certificates);
    } catch (error) {
      console.error("Error fetching training certificates:", error);
      res.status(500).json({ error: "Failed to fetch training certificates" });
    }
  });

  app.get("/api/training-certificates/expiring", async (req, res) => {
    try {
      const { days } = req.query;
      const certificates = await storage.getExpiringTrainingCertificates(
        days ? parseInt(days as string) : 90
      );
      res.json(certificates);
    } catch (error) {
      console.error("Error fetching expiring certificates:", error);
      res.status(500).json({ error: "Failed to fetch expiring certificates" });
    }
  });

  app.put("/api/training-levels/:id", isAuthenticated, requireRole('admin', 'manager'), async (req, res) => {
    try {
      const validatedData = insertTrainingLevelSchema.partial().parse(req.body);
      const level = await storage.updateTrainingLevel(req.params.id, validatedData);
      if (!level) {
        return res.status(404).json({ error: "Training level not found" });
      }
      res.json(level);
    } catch (error) {
      console.error("Error updating training level:", error);
      res.status(500).json({ error: "Failed to update training level" });
    }
  });

  app.delete("/api/training-levels/:id", isAuthenticated, requireRole('admin', 'manager'), async (req, res) => {
    try {
      const success = await storage.deleteTrainingLevel(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Training level not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting training level:", error);
      res.status(500).json({ error: "Failed to delete training level" });
    }
  });

  app.post("/api/training-certificates", isAuthenticated, checkCertificateOwnerOrRoles(['admin', 'manager']), async (req, res) => {
    try {
      const validatedData = insertTrainingCertificateSchema.parse(req.body);
      const certificate = await storage.createTrainingCertificate(validatedData);
      res.status(201).json(certificate);
    } catch (error) {
      console.error("Error creating training certificate:", error);
      res.status(500).json({ error: "Failed to create training certificate" });
    }
  });

  app.put("/api/training-certificates/:id", isAuthenticated, checkCertificateOwnerOrRoles(['admin', 'manager']), async (req, res) => {
    try {
      const validatedData = insertTrainingCertificateSchema.partial().parse(req.body);
      const certificate = await storage.updateTrainingCertificate(req.params.id, validatedData);
      if (!certificate) {
        return res.status(404).json({ error: "Training certificate not found" });
      }
      res.json(certificate);
    } catch (error) {
      console.error("Error updating training certificate:", error);
      res.status(500).json({ error: "Failed to update training certificate" });
    }
  });

  app.delete("/api/training-certificates/:id", isAuthenticated, checkCertificateOwnerOrRoles(['admin', 'manager']), async (req, res) => {
    try {
      const success = await storage.deleteTrainingCertificate(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Training certificate not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting training certificate:", error);
      res.status(500).json({ error: "Failed to delete training certificate" });
    }
  });

  // Certificate file upload endpoint
  // General file upload endpoint for certificates  
  app.post("/api/upload", isAuthenticated, async (req, res) => {
    try {
      // Placeholder for object storage integration
      // Object storage is configured and ready (bucket exists)
      // In production: use multer, validate file types (pdf,jpg,jpeg,png), upload to object storage
      const mockUrl = `/uploads/certificate_${Date.now()}_${Math.random().toString(36).substring(7)}.pdf`;
      res.json({ url: mockUrl });
    } catch (error) {
      console.error("Error uploading file:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  app.post("/api/training-certificates/:id/upload", isAuthenticated, checkCertificateOwnerOrRoles(['admin', 'manager']), async (req, res) => {
    try {
      // TODO: Implement file upload with object storage integration
      console.log("Certificate upload requested for ID:", req.params.id);
      res.json({ 
        message: "Certificate upload feature ready for object storage integration",
        certificateId: req.params.id 
      });
    } catch (error) {
      console.error("Error uploading certificate:", error);
      res.status(500).json({ error: "Failed to upload certificate" });
    }
  });

  // Import endpoints for training matrices
  app.post("/api/training-import/matrix", isAuthenticated, requireRole('admin', 'super_admin'), async (req, res) => {
    try {
      // TODO: Implement file upload and parsing for training matrices
      console.log("Training matrix import requested");
      res.json({ message: "Training matrix import feature coming soon" });
    } catch (error) {
      console.error("Error importing training matrix:", error);
      res.status(500).json({ error: "Failed to import training matrix" });
    }
  });

  app.post("/api/training-import/knowledge-elements", isAuthenticated, requireRole('admin', 'super_admin'), async (req, res) => {
    try {
      // TODO: Implement Word/Excel import for knowledge and performance elements
      console.log("Knowledge elements import requested");
      res.json({ message: "Knowledge elements import feature coming soon" });
    } catch (error) {
      console.error("Error importing knowledge elements:", error);
      res.status(500).json({ error: "Failed to import knowledge elements" });
    }
  });

  // User profile management routes
  app.get('/api/users/:id', isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  app.patch('/api/users/:id', isAuthenticated, requireRole('admin'), async (req, res) => {
    try {
      const userData = req.body;
      const user = await storage.updateUser(req.params.id, userData);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  // Quick admin endpoint to promote current user to developer
  app.post('/api/auth/promote-to-developer', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.updateUser(userId, { role: 'developer' });
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ message: "Successfully promoted to developer", user });
    } catch (error) {
      console.error("Error promoting user:", error);
      res.status(500).json({ error: "Failed to promote user" });
    }
  });

  // Competency Management Routes - /api/competencies namespace

  // Special routes (provide structured data)
  app.get("/api/competency-tree", async (req, res) => {
    try {
      const tree = await storage.getCompetencyTree();
      res.json(tree);
    } catch (error) {
      console.error("Error fetching competency tree:", error);
      res.status(500).json({ error: "Failed to fetch competency tree" });
    }
  });

  app.get("/api/competencies-with-details", async (req, res) => {
    try {
      const { categoryId, elementId, jobRoleId } = req.query;
      const filters = {
        categoryId: categoryId as string || undefined,
        elementId: elementId as string || undefined,
        jobRoleId: jobRoleId as string || undefined,
      };
      const competencies = await storage.getCompetenciesWithDetails(filters);
      res.json(competencies);
    } catch (error) {
      console.error("Error fetching competencies with details:", error);
      res.status(500).json({ error: "Failed to fetch competencies with details" });
    }
  });

  // Competency Categories CRUD
  app.get("/api/competency-categories", async (req, res) => {
    try {
      const categories = await storage.getCompetencyCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching competency categories:", error);
      res.status(500).json({ error: "Failed to fetch competency categories" });
    }
  });

  app.get("/api/competency-categories/:id", async (req, res) => {
    try {
      const category = await storage.getCompetencyCategory(req.params.id);
      if (!category) {
        return res.status(404).json({ error: "Competency category not found" });
      }
      res.json(category);
    } catch (error) {
      console.error("Error fetching competency category:", error);
      res.status(500).json({ error: "Failed to fetch competency category" });
    }
  });

  app.post("/api/competency-categories", async (req, res) => {
    try {
      const validatedData = insertCompetencyCategorySchema.parse(req.body);
      const category = await storage.createCompetencyCategory(validatedData);
      res.status(201).json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error creating competency category:", error);
      res.status(500).json({ error: "Failed to create competency category" });
    }
  });

  app.patch("/api/competency-categories/:id", async (req, res) => {
    try {
      const partialData = insertCompetencyCategorySchema.partial().parse(req.body);
      const category = await storage.updateCompetencyCategory(req.params.id, partialData);
      if (!category) {
        return res.status(404).json({ error: "Competency category not found" });
      }
      res.json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error updating competency category:", error);
      res.status(500).json({ error: "Failed to update competency category" });
    }
  });

  app.delete("/api/competency-categories/:id", async (req, res) => {
    try {
      const success = await storage.deleteCompetencyCategory(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Competency category not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting competency category:", error);
      res.status(500).json({ error: "Failed to delete competency category" });
    }
  });

  // Competency Elements CRUD
  app.get("/api/competency-elements", async (req, res) => {
    try {
      const { categoryId } = req.query;
      const elements = await storage.getCompetencyElements(categoryId as string);
      res.json(elements);
    } catch (error) {
      console.error("Error fetching competency elements:", error);
      res.status(500).json({ error: "Failed to fetch competency elements" });
    }
  });

  app.get("/api/competency-elements/:id", async (req, res) => {
    try {
      const element = await storage.getCompetencyElement(req.params.id);
      if (!element) {
        return res.status(404).json({ error: "Competency element not found" });
      }
      res.json(element);
    } catch (error) {
      console.error("Error fetching competency element:", error);
      res.status(500).json({ error: "Failed to fetch competency element" });
    }
  });

  app.post("/api/competency-elements", async (req, res) => {
    try {
      const validatedData = insertCompetencyElementSchema.parse(req.body);
      const element = await storage.createCompetencyElement(validatedData);
      res.status(201).json(element);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error creating competency element:", error);
      res.status(500).json({ error: "Failed to create competency element" });
    }
  });

  app.patch("/api/competency-elements/:id", async (req, res) => {
    try {
      const partialData = insertCompetencyElementSchema.partial().parse(req.body);
      const element = await storage.updateCompetencyElement(req.params.id, partialData);
      if (!element) {
        return res.status(404).json({ error: "Competency element not found" });
      }
      res.json(element);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error updating competency element:", error);
      res.status(500).json({ error: "Failed to update competency element" });
    }
  });

  app.delete("/api/competency-elements/:id", async (req, res) => {
    try {
      const success = await storage.deleteCompetencyElement(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Competency element not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting competency element:", error);
      res.status(500).json({ error: "Failed to delete competency element" });
    }
  });

  // Competencies CRUD
  app.get("/api/competencies", async (req, res) => {
    try {
      const { elementId, type, critical, safetyCritical } = req.query;
      const filters = {
        elementId: elementId as string || undefined,
        type: type as string || undefined,
        critical: critical === 'true' ? true : critical === 'false' ? false : undefined,
        safetyCritical: safetyCritical === 'true' ? true : safetyCritical === 'false' ? false : undefined,
      };
      const competencies = await storage.getCompetencies(filters);
      res.json(competencies);
    } catch (error) {
      console.error("Error fetching competencies:", error);
      res.status(500).json({ error: "Failed to fetch competencies" });
    }
  });

  app.get("/api/competencies/:id", async (req, res) => {
    try {
      const competency = await storage.getCompetency(req.params.id);
      if (!competency) {
        return res.status(404).json({ error: "Competency not found" });
      }
      res.json(competency);
    } catch (error) {
      console.error("Error fetching competency:", error);
      res.status(500).json({ error: "Failed to fetch competency" });
    }
  });

  app.post("/api/competencies", async (req, res) => {
    try {
      const validatedData = insertCompetencySchema.parse(req.body);
      const competency = await storage.createCompetency(validatedData);
      res.status(201).json(competency);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error creating competency:", error);
      res.status(500).json({ error: "Failed to create competency" });
    }
  });

  app.patch("/api/competencies/:id", async (req, res) => {
    try {
      const partialData = insertCompetencySchema.partial().parse(req.body);
      const competency = await storage.updateCompetency(req.params.id, partialData);
      if (!competency) {
        return res.status(404).json({ error: "Competency not found" });
      }
      res.json(competency);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error updating competency:", error);
      res.status(500).json({ error: "Failed to update competency" });
    }
  });

  app.delete("/api/competencies/:id", async (req, res) => {
    try {
      const success = await storage.deleteCompetency(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Competency not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting competency:", error);
      res.status(500).json({ error: "Failed to delete competency" });
    }
  });

  // Competence Subcategories CRUD
  app.get("/api/competence-subcategories", async (req, res) => {
    try {
      const { elementId } = req.query;
      const subcategories = await storage.getCompetenceSubcategories(elementId as string || undefined);
      res.json(subcategories);
    } catch (error) {
      console.error("Error fetching competence subcategories:", error);
      res.status(500).json({ error: "Failed to fetch competence subcategories" });
    }
  });

  app.get("/api/competence-subcategories/:id", async (req, res) => {
    try {
      const subcategory = await storage.getCompetenceSubcategory(req.params.id);
      if (!subcategory) {
        return res.status(404).json({ error: "Competence subcategory not found" });
      }
      res.json(subcategory);
    } catch (error) {
      console.error("Error fetching competence subcategory:", error);
      res.status(500).json({ error: "Failed to fetch competence subcategory" });
    }
  });

  app.post("/api/competence-subcategories", async (req, res) => {
    try {
      const validatedData = insertCompetenceSubcategorySchema.parse(req.body);
      const subcategory = await storage.createCompetenceSubcategory(validatedData);
      res.status(201).json(subcategory);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error creating competence subcategory:", error);
      res.status(500).json({ error: "Failed to create competence subcategory" });
    }
  });

  app.patch("/api/competence-subcategories/:id", async (req, res) => {
    try {
      const partialData = insertCompetenceSubcategorySchema.partial().parse(req.body);
      const subcategory = await storage.updateCompetenceSubcategory(req.params.id, partialData);
      if (!subcategory) {
        return res.status(404).json({ error: "Competence subcategory not found" });
      }
      res.json(subcategory);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error updating competence subcategory:", error);
      res.status(500).json({ error: "Failed to update competence subcategory" });
    }
  });

  app.delete("/api/competence-subcategories/:id", async (req, res) => {
    try {
      const success = await storage.deleteCompetenceSubcategory(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Competence subcategory not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting competence subcategory:", error);
      res.status(500).json({ error: "Failed to delete competence subcategory" });
    }
  });

  // Competence Criteria CRUD (K1.1, P1.1, etc.)
  app.get("/api/competence-criteria", async (req, res) => {
    try {
      const { subcategoryId, elementId, type } = req.query;
      const filters = {
        subcategoryId: subcategoryId as string || undefined,
        elementId: elementId as string || undefined,
        type: type as 'knowledge' | 'performance' || undefined,
      };
      const criteria = await storage.getCompetenceCriteria(filters);
      res.json(criteria);
    } catch (error) {
      console.error("Error fetching competence criteria:", error);
      res.status(500).json({ error: "Failed to fetch competence criteria" });
    }
  });

  app.get("/api/competence-criteria/:id", async (req, res) => {
    try {
      const criteria = await storage.getCompetenceCriterion(req.params.id);
      if (!criteria) {
        return res.status(404).json({ error: "Competence criteria not found" });
      }
      res.json(criteria);
    } catch (error) {
      console.error("Error fetching competence criteria:", error);
      res.status(500).json({ error: "Failed to fetch competence criteria" });
    }
  });

  app.post("/api/competence-criteria", async (req, res) => {
    try {
      const validatedData = insertCompetenceCriteriaSchema.parse(req.body);
      const criteria = await storage.createCompetenceCriteria(validatedData);
      res.status(201).json(criteria);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error creating competence criteria:", error);
      res.status(500).json({ error: "Failed to create competence criteria" });
    }
  });

  app.patch("/api/competence-criteria/:id", async (req, res) => {
    try {
      const partialData = insertCompetenceCriteriaSchema.partial().parse(req.body);
      const criteria = await storage.updateCompetenceCriteria(req.params.id, partialData);
      if (!criteria) {
        return res.status(404).json({ error: "Competence criteria not found" });
      }
      res.json(criteria);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error updating competence criteria:", error);
      res.status(500).json({ error: "Failed to update competence criteria" });
    }
  });

  app.delete("/api/competence-criteria/:id", async (req, res) => {
    try {
      const success = await storage.deleteCompetenceCriteria(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Competence criteria not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting competence criteria:", error);
      res.status(500).json({ error: "Failed to delete competence criteria" });
    }
  });

  // Competence criteria code generation
  app.post("/api/competence-criteria/generate-code", async (req, res) => {
    try {
      const { subcategoryId, type } = req.body;
      if (!subcategoryId || !type) {
        return res.status(400).json({ error: "subcategoryId and type are required" });
      }
      const code = await storage.generateCompetenceCriteriaCode(subcategoryId, type);
      res.json({ code });
    } catch (error) {
      console.error("Error generating competence criteria code:", error);
      res.status(500).json({ error: "Failed to generate competence criteria code" });
    }
  });

  // Word/Excel import for client standards
  app.post("/api/competence/import", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }

      const { elementId } = req.body;
      if (!elementId) {
        return res.status(400).json({ error: "elementId is required" });
      }

      const result = await storage.importClientStandards(req.file.buffer, elementId);
      res.json(result);
    } catch (error) {
      console.error("Error importing client standards:", error);
      res.status(500).json({ error: "Failed to import client standards" });
    }
  });

  // Comprehensive Excel Import for Competence Standards (A-J column mapping)
  app.post("/api/competence-standards/import", isAuthenticated, requireRole('admin', 'super_admin'), upload.single("file"), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const fileName = req.file.originalname.toLowerCase();
      let rows: any[] = [];

      // Parse CSV file  
      if (fileName.endsWith('.csv')) {
        const csvString = req.file.buffer.toString('utf-8');
        
        rows = await new Promise((resolve, reject) => {
          const results: any[] = [];
          const stream = Readable.from([csvString]);
          
          stream
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', reject);
        });
      }
      // Parse Excel file
      else if (fileName.endsWith('.xlsx')) {
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        rows = XLSX.utils.sheet_to_json(worksheet);
      } else {
        return res.status(400).json({ message: "Unsupported file format. Please upload CSV or XLSX files." });
      }

      if (rows.length === 0) {
        return res.status(400).json({ message: "No data found in the uploaded file" });
      }

      // Transform and validate rows to ExcelImportRow format
      const validatedRows: ExcelImportRow[] = [];
      const validationErrors: { row: number; field?: string; message: string; }[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNumber = i + 2; // Excel rows start at 2 (after header)

        try {
          // Normalize header names for flexible column mapping
          const normalizedRow: any = {};
          Object.keys(row).forEach(key => {
            const normalizedKey = key.toLowerCase().trim();
            normalizedRow[normalizedKey] = typeof row[key] === 'string' ? row[key].trim() : row[key];
          });

          // Map columns A-J to expected fields (flexible header matching)
          const rawCriticality = (normalizedRow.criticality || normalizedRow['column i'] || normalizedRow.i || 'Medium').toString().toLowerCase();
          const normalizedCriticality = rawCriticality === 'low' ? 'Low' : 
                                      rawCriticality === 'medium' ? 'Medium' : 
                                      rawCriticality === 'high' ? 'High' : 'Medium';

          const rawType = (normalizedRow.type || normalizedRow['column d'] || normalizedRow.d || '').toString().toLowerCase();
          const normalizedType = rawType === 'knowledge' || rawType === 'k' ? 'knowledge' :
                                rawType === 'performance' || rawType === 'p' ? 'performance' : 
                                rawType as 'knowledge' | 'performance';

          const mappedRow = {
            category: normalizedRow.category || normalizedRow['column a'] || normalizedRow.a,
            element: normalizedRow.element || normalizedRow['column b'] || normalizedRow.b,
            subcategory: normalizedRow.subcategory || normalizedRow['column c'] || normalizedRow.c,
            type: normalizedType,
            description: normalizedRow.description || normalizedRow['column e'] || normalizedRow.e,
            proficiencyLevels: normalizedRow.proficiencylevels || normalizedRow['proficiency levels'] || normalizedRow['column f'] || normalizedRow.f,
            proficiencyTerminology: normalizedRow.proficiencyterminology || normalizedRow['proficiency terms'] || normalizedRow['column g'] || normalizedRow.g,
            assessmentMethods: parseAssessmentMethods(normalizedRow.assessmentmethods || normalizedRow['assessment methods'] || normalizedRow['column h'] || normalizedRow.h || ''),
            criticality: normalizedCriticality,
            validityPeriod: normalizedRow.validityperiod || normalizedRow['validity period'] || normalizedRow['validity (years)'] || normalizedRow['column j'] || normalizedRow.j || '3',
            required: (normalizedRow.required || 'M') as 'O' | 'M',
            assessorGuidance: normalizedRow.assessorguidance || normalizedRow['assessor guidance'],
            rowNumber: rowNumber,
          };

          // Validate the mapped row using Zod schema
          const validatedRow = excelImportRowSchema.parse(mappedRow);
          validatedRows.push(validatedRow);

        } catch (error) {
          if (error instanceof z.ZodError) {
            error.errors.forEach(err => {
              validationErrors.push({
                row: rowNumber,
                field: err.path.join('.'),
                message: err.message,
              });
            });
          } else {
            validationErrors.push({
              row: rowNumber, 
              message: error instanceof Error ? error.message : 'Unknown validation error',
            });
          }
        }
      }

      // If too many validation errors, return early
      if (validationErrors.length > validatedRows.length) {
        const errorResult: ExcelImportResult = {
          successCount: 0,
          errorCount: validationErrors.length,
          errors: validationErrors.slice(0, 10), // Show first 10 errors
          warnings: [],
        };
        return res.status(400).json(errorResult);
      }

      // Process the validated rows using storage
      const result = await storage.importCompetenceStandards(validatedRows);
      
      // Add validation errors to the result
      result.errors = [...result.errors, ...validationErrors];
      result.errorCount += validationErrors.length;

      res.status(201).json(result);

    } catch (error) {
      console.error("Error importing competence standards:", error);
      res.status(500).json({ message: "Failed to process Excel file" });
    }
  });

  // Job Roles CRUD
  app.get("/api/job-roles", async (req, res) => {
    try {
      const jobRoles = await storage.getJobRoles();
      res.json(jobRoles);
    } catch (error) {
      console.error("Error fetching job roles:", error);
      res.status(500).json({ error: "Failed to fetch job roles" });
    }
  });

  app.get("/api/job-roles/:id", async (req, res) => {
    try {
      const jobRole = await storage.getJobRole(req.params.id);
      if (!jobRole) {
        return res.status(404).json({ error: "Job role not found" });
      }
      res.json(jobRole);
    } catch (error) {
      console.error("Error fetching job role:", error);
      res.status(500).json({ error: "Failed to fetch job role" });
    }
  });

  app.post("/api/job-roles", async (req, res) => {
    try {
      const validatedData = insertJobRoleSchema.parse(req.body);
      const jobRole = await storage.createJobRole(validatedData);
      res.status(201).json(jobRole);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error creating job role:", error);
      res.status(500).json({ error: "Failed to create job role" });
    }
  });

  app.patch("/api/job-roles/:id", async (req, res) => {
    try {
      const partialData = insertJobRoleSchema.partial().parse(req.body);
      const jobRole = await storage.updateJobRole(req.params.id, partialData);
      if (!jobRole) {
        return res.status(404).json({ error: "Job role not found" });
      }
      res.json(jobRole);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error updating job role:", error);
      res.status(500).json({ error: "Failed to update job role" });
    }
  });

  app.delete("/api/job-roles/:id", async (req, res) => {
    try {
      const success = await storage.deleteJobRole(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Job role not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting job role:", error);
      res.status(500).json({ error: "Failed to delete job role" });
    }
  });

  // Competency Matrix CRUD
  app.get("/api/competency-matrix", async (req, res) => {
    try {
      const { jobRoleId, competencyId } = req.query;
      const matrix = await storage.getCompetencyMatrix(
        jobRoleId as string,
        competencyId as string
      );
      res.json(matrix);
    } catch (error) {
      console.error("Error fetching competency matrix:", error);
      res.status(500).json({ error: "Failed to fetch competency matrix" });
    }
  });

  app.post("/api/competency-matrix", async (req, res) => {
    try {
      const validatedData = insertCompetencyMatrixSchema.parse(req.body);
      const matrix = await storage.createCompetencyMatrix(validatedData);
      res.status(201).json(matrix);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error creating competency matrix:", error);
      res.status(500).json({ error: "Failed to create competency matrix" });
    }
  });

  app.patch("/api/competency-matrix/:id", async (req, res) => {
    try {
      const partialData = insertCompetencyMatrixSchema.partial().parse(req.body);
      const matrix = await storage.updateCompetencyMatrix(req.params.id, partialData);
      if (!matrix) {
        return res.status(404).json({ error: "Competency matrix entry not found" });
      }
      res.json(matrix);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error updating competency matrix:", error);
      res.status(500).json({ error: "Failed to update competency matrix" });
    }
  });

  app.delete("/api/competency-matrix/:id", async (req, res) => {
    try {
      const success = await storage.deleteCompetencyMatrix(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Competency matrix entry not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting competency matrix:", error);
      res.status(500).json({ error: "Failed to delete competency matrix" });
    }
  });

  // Competency Certification CRUD
  app.get("/api/competency-certifications", async (req, res) => {
    try {
      const { userId, competencyId } = req.query;
      const certifications = await storage.getCompetencyCertifications(
        userId as string,
        competencyId as string
      );
      res.json(certifications);
    } catch (error) {
      console.error("Error fetching competency certifications:", error);
      res.status(500).json({ error: "Failed to fetch competency certifications" });
    }
  });

  app.get("/api/competency-certifications/:id", async (req, res) => {
    try {
      const certification = await storage.getCompetencyCertification(req.params.id);
      if (!certification) {
        return res.status(404).json({ error: "Competency certification not found" });
      }
      res.json(certification);
    } catch (error) {
      console.error("Error fetching competency certification:", error);
      res.status(500).json({ error: "Failed to fetch competency certification" });
    }
  });

  app.post("/api/competency-certifications", async (req, res) => {
    try {
      const validatedData = insertCompetencyCertificationSchema.parse(req.body);
      const certification = await storage.createCompetencyCertification(validatedData);
      res.status(201).json(certification);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error creating competency certification:", error);
      res.status(500).json({ error: "Failed to create competency certification" });
    }
  });

  app.patch("/api/competency-certifications/:id", async (req, res) => {
    try {
      const partialData = insertCompetencyCertificationSchema.partial().parse(req.body);
      const certification = await storage.updateCompetencyCertification(req.params.id, partialData);
      if (!certification) {
        return res.status(404).json({ error: "Competency certification not found" });
      }
      res.json(certification);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error updating competency certification:", error);
      res.status(500).json({ error: "Failed to update competency certification" });
    }
  });

  app.delete("/api/competency-certifications/:id", async (req, res) => {
    try {
      const success = await storage.deleteCompetencyCertification(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Competency certification not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting competency certification:", error);
      res.status(500).json({ error: "Failed to delete competency certification" });
    }
  });

  app.get("/api/competency-certifications/expiring/:days", async (req, res) => {
    try {
      const days = parseInt(req.params.days) || 30;
      const certifications = await storage.getExpiringCertifications(days);
      res.json(certifications);
    } catch (error) {
      console.error("Error fetching expiring certifications:", error);
      res.status(500).json({ error: "Failed to fetch expiring certifications" });
    }
  });

  // Expiry Alert CRUD
  app.get("/api/expiry-alerts", async (req, res) => {
    try {
      const { userId } = req.query;
      const alerts = await storage.getExpiryAlerts(userId as string);
      res.json(alerts);
    } catch (error) {
      console.error("Error fetching expiry alerts:", error);
      res.status(500).json({ error: "Failed to fetch expiry alerts" });
    }
  });

  app.post("/api/expiry-alerts", async (req, res) => {
    try {
      const validatedData = insertExpiryAlertSchema.parse(req.body);
      const alert = await storage.createExpiryAlert(validatedData);
      res.status(201).json(alert);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error creating expiry alert:", error);
      res.status(500).json({ error: "Failed to create expiry alert" });
    }
  });

  app.patch("/api/expiry-alerts/:id/read", async (req, res) => {
    try {
      const success = await storage.markAlertAsRead(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Expiry alert not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error marking alert as read:", error);
      res.status(500).json({ error: "Failed to mark alert as read" });
    }
  });

  app.delete("/api/expiry-alerts/:id", async (req, res) => {
    try {
      const success = await storage.deleteExpiryAlert(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Expiry alert not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting expiry alert:", error);
      res.status(500).json({ error: "Failed to delete expiry alert" });
    }
  });

  app.post("/api/expiry-alerts/generate", async (req, res) => {
    try {
      const alerts = await storage.generateExpiryAlerts();
      res.json(alerts);
    } catch (error) {
      console.error("Error generating expiry alerts:", error);
      res.status(500).json({ error: "Failed to generate expiry alerts" });
    }
  });

  const httpServer = createServer(app);

  // AI Theming Routes
  app.get("/api/business-sectors", async (req, res) => {
    try {
      res.json(businessSectors);
    } catch (error) {
      console.error("Error fetching business sectors:", error);
      res.status(500).json({ error: "Failed to fetch business sectors" });
    }
  });

  app.post("/api/ai-theme/generate", isAuthenticated, async (req, res) => {
    try {
      const { industry, companyName } = req.body;
      
      if (!industry) {
        return res.status(400).json({ error: "Industry is required" });
      }

      const theme = await aiThemingService.generateSectorTheme(industry, companyName);
      res.json(theme);
    } catch (error) {
      console.error("Error generating theme:", error);
      res.status(500).json({ error: "Failed to generate theme" });
    }
  });

  app.post("/api/ai-theme/generate-hero-image", isAuthenticated, async (req, res) => {
    try {
      // Only allow super_admin and admin roles to generate images
      if (!req.user || !['super_admin', 'admin'].includes((req.user as any).role)) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      const { prompt } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ error: "Image prompt is required" });
      }

      const imageUrl = await aiThemingService.generateHeroImage(prompt);
      res.json({ imageUrl });
    } catch (error) {
      console.error("Error generating hero image:", error);
      res.status(500).json({ error: "Failed to generate hero image" });
    }
  });

  app.post("/api/ai-theme/generate-skills", isAuthenticated, async (req, res) => {
    try {
      const { industry } = req.body;
      
      if (!industry) {
        return res.status(400).json({ error: "Industry is required" });
      }

      const sectorSkills = await aiThemingService.generateSectorSkills(industry);
      
      // Flatten the SectorSkills object into a skills array for the client
      const flattenedSkills = [
        ...sectorSkills.technicalSkills.map((name, index) => ({
          name,
          category: 'Technical',
          level: 3,
          verified: false,
          lastAssessed: '2024-01-01'
        })),
        ...sectorSkills.safetySkills.map((name, index) => ({
          name,
          category: 'Safety',
          level: 4,
          verified: true,
          lastAssessed: '2024-01-01'
        })),
        ...sectorSkills.leadershipSkills.map((name, index) => ({
          name,
          category: 'Leadership',
          level: 2,
          verified: false,
          lastAssessed: '2024-01-01'
        })),
        ...sectorSkills.specializedSkills.map((name, index) => ({
          name,
          category: 'Specialized',
          level: 3,
          verified: false,
          lastAssessed: '2024-01-01'
        }))
      ];

      res.json({ skills: flattenedSkills });
    } catch (error) {
      console.error("Error generating skills:", error);
      res.status(500).json({ error: "Failed to generate skills" });
    }
  });

  // Translation API endpoints
  app.get("/api/translation/languages", async (req, res) => {
    try {
      const languages = translationService.getSupportedLanguages();
      res.json({ languages });
    } catch (error) {
      console.error("Error fetching supported languages:", error);
      res.status(500).json({ error: "Failed to fetch supported languages" });
    }
  });

  app.post("/api/translation/translate-text", isAuthenticated, async (req, res) => {
    try {
      const { text, sourceLanguage, targetLanguage, context, preserveFormatting } = req.body;
      
      if (!text || !targetLanguage) {
        return res.status(400).json({ error: "Text and target language are required" });
      }

      const translationRequest = {
        text,
        sourceLanguage,
        targetLanguage,
        context: context || 'general',
        preserveFormatting: preserveFormatting !== false
      };

      const result = await translationService.translateText(translationRequest);
      res.json(result);
    } catch (error) {
      console.error("Error translating text:", error);
      res.status(500).json({ error: "Failed to translate text" });
    }
  });

  app.post("/api/translation/translate-competency-data", isAuthenticated, async (req, res) => {
    try {
      const { data, targetLanguage, sourceLanguage } = req.body;
      
      if (!data || !targetLanguage) {
        return res.status(400).json({ error: "Data and target language are required" });
      }

      const result = await translationService.translateCompetencyData(data, targetLanguage, sourceLanguage);
      res.json(result);
    } catch (error) {
      console.error("Error translating competency data:", error);
      res.status(500).json({ error: "Failed to translate competency data" });
    }
  });

  // Language preferences management
  app.get("/api/translation/user-preferences", isAuthenticated, async (req, res) => {
    try {
      // For now, return default preferences
      // In production, this would fetch from user storage
      const defaultPreferences = {
        userId: (req.user as any)?.id || 'anonymous',
        primaryLanguage: 'en',
        fallbackLanguage: 'en',
        autoTranslate: true,
        lastUpdated: new Date().toISOString()
      };
      
      res.json(defaultPreferences);
    } catch (error) {
      console.error("Error fetching user language preferences:", error);
      res.status(500).json({ error: "Failed to fetch language preferences" });
    }
  });

  app.post("/api/translation/user-preferences", isAuthenticated, async (req, res) => {
    try {
      const { primaryLanguage, fallbackLanguage, autoTranslate } = req.body;
      
      if (!primaryLanguage) {
        return res.status(400).json({ error: "Primary language is required" });
      }

      // For now, just return the updated preferences
      // In production, this would save to user storage
      const updatedPreferences = {
        userId: (req.user as any)?.id || 'anonymous',
        primaryLanguage,
        fallbackLanguage: fallbackLanguage || 'en',
        autoTranslate: autoTranslate !== false,
        lastUpdated: new Date().toISOString()
      };
      
      res.json(updatedPreferences);
    } catch (error) {
      console.error("Error updating user language preferences:", error);
      res.status(500).json({ error: "Failed to update language preferences" });
    }
  });

  // Batch translation endpoint for multiple items
  app.post("/api/translation/translate-batch", isAuthenticated, async (req, res) => {
    try {
      const { items, targetLanguage, sourceLanguage, context } = req.body;
      
      if (!items || !Array.isArray(items) || !targetLanguage) {
        return res.status(400).json({ error: "Items array and target language are required" });
      }

      // Extract all text values from the items array
      const textsToTranslate = items.map(item => {
        if (typeof item === 'string') return item;
        if (typeof item === 'object' && item.text) return item.text;
        return JSON.stringify(item); // Fallback for complex objects
      });

      const result = await translationService.translateText({
        text: textsToTranslate,
        sourceLanguage,
        targetLanguage,
        context: context || 'general',
        preserveFormatting: true
      });

      // Map results back to original structure
      const translatedItems = items.map((originalItem, index) => {
        const translatedText = Array.isArray(result.translatedText) 
          ? result.translatedText[index] 
          : result.translatedText;
          
        if (typeof originalItem === 'string') {
          return translatedText;
        } else if (typeof originalItem === 'object' && originalItem.text) {
          return { ...originalItem, text: translatedText };
        } else {
          return { original: originalItem, translated: translatedText };
        }
      });

      res.json({
        items: translatedItems,
        sourceLanguage: result.sourceLanguage,
        targetLanguage: result.targetLanguage,
        context: result.context
      });
    } catch (error) {
      console.error("Error in batch translation:", error);
      res.status(500).json({ error: "Failed to translate batch items" });
    }
  });

  return httpServer;
}
