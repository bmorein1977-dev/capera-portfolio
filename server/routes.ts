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
  insertRoleElementSchema,
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
  insertTrainingEnrollmentSchema,
  insertCandidateAllocationSchema,
  insertAssessmentSchema,
  insertAssessmentEvidenceSchema,
  insertVerifierAllocationSchema,
  insertSamplingPlanSchema,
  insertVerificationSchema,
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

  // Normalize role for comparison (handle "Super Admin" -> "super_admin")
  function normalizeRole(role: string): string {
    return role.toLowerCase().trim().replace(/[\s-]+/g, '_');
  }

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
      
      // Normalize role for comparison
      const userRole = normalizeRole(user.role);
      const allowedRoles = roles.map(normalizeRole);
      
      // Super admin always has access
      if (userRole === 'super_admin' || allowedRoles.includes(userRole)) {
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
      
      // Normalize role for comparison
      const userRole = normalizeRole(user.role);
      const allowedRoles = roles.map(normalizeRole);
      
      // Super admin or specified roles always have access
      if (userRole === 'super_admin' || allowedRoles.includes(userRole)) {
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
  // Get all users (for admin)
  app.get('/api/users', isAuthenticated, requireRole('developer', 'admin', 'super_admin'), async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

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

  app.patch('/api/users/:id', isAuthenticated, async (req: any, res) => {
    try {
      const currentUserId = req.user?.claims?.sub;
      const targetUserId = req.params.id;
      
      // Fetch current user to check their role
      const currentUser = await storage.getUser(currentUserId);
      if (!currentUser) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Allow users to update their own profile, or require admin role for updating others
      const isUpdatingSelf = currentUserId === targetUserId;
      const hasAdminRole = ['developer', 'admin', 'super_admin'].includes(currentUser.role);
      
      if (!isUpdatingSelf && !hasAdminRole) {
        return res.status(403).json({ error: "Insufficient permissions to update other users" });
      }
      
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

  // Skills Gap Analysis endpoint
  app.get('/api/users/:id/skills-gap', isAuthenticated, async (req: any, res) => {
    try {
      const currentUserId = req.user?.claims?.sub;
      const targetUserId = req.params.id;
      
      // Fetch current user to check their role
      const currentUser = await storage.getUser(currentUserId);
      if (!currentUser) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Allow users to view their own skills gap, or require admin/assessor role for viewing others
      const isViewingSelf = currentUserId === targetUserId;
      const hasViewPermission = ['developer', 'admin', 'super_admin', 'assessor', 'internal_verifier'].includes(currentUser.role);
      
      if (!isViewingSelf && !hasViewPermission) {
        return res.status(403).json({ error: "Insufficient permissions to view skills gap analysis" });
      }
      
      const skillsGap = await storage.getSkillsGapAnalysis(targetUserId);
      if (!skillsGap) {
        return res.status(404).json({ error: "Skills gap analysis not available. User may not have a job role assigned." });
      }
      
      res.json(skillsGap);
    } catch (error) {
      console.error("Error fetching skills gap analysis:", error);
      res.status(500).json({ error: "Failed to fetch skills gap analysis" });
    }
  });

  // Admin endpoint to create new user
  app.post('/api/admin/users', isAuthenticated, requireRole('admin', 'super_admin'), async (req: any, res) => {
    try {
      const { firstName, lastName, email, role, location, jobRoleId, dateOfBirth, companyNumber } = req.body;
      const currentUserId = req.user?.claims?.sub;
      
      // Validate required fields
      if (!firstName || !lastName || !email || !role) {
        return res.status(400).json({ error: "Missing required fields: firstName, lastName, email, role" });
      }
      
      // Get current user to check their role
      const currentUser = await storage.getUser(currentUserId);
      if (!currentUser) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Validate role is a valid role
      const validRoles = ['developer', 'super_admin', 'admin', 'internal_verifier', 'assessor', 'candidate', 'trainee'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: "Invalid role specified" });
      }
      
      // Prevent privilege escalation: Only super_admin can create super_admin/developer users
      const privilegedRoles = ['developer', 'super_admin'];
      if (privilegedRoles.includes(role) && currentUser.role !== 'super_admin') {
        return res.status(403).json({ 
          error: "Only super administrators can create developer or super admin accounts" 
        });
      }
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ error: "User with this email already exists" });
      }
      
      // Prepare user data with proper type conversion
      const userData: any = {
        id: `manual-${email}-${Date.now()}`,
        email,
        firstName,
        lastName,
        role,
      };
      
      // Only add optional fields if they have values
      if (location && location.trim()) {
        userData.location = location.trim();
      }
      if (jobRoleId && jobRoleId.trim()) {
        userData.jobRoleId = jobRoleId.trim();
      }
      if (dateOfBirth && dateOfBirth.trim()) {
        userData.dateOfBirth = new Date(dateOfBirth);
      }
      if (companyNumber && companyNumber.trim()) {
        userData.companyNumber = companyNumber.trim();
      }
      
      // Create new user
      const newUser = await storage.upsertUser(userData);
      
      // If a job role was assigned, automatically create assessments for all competence elements
      let autoAssignmentResult = { assessmentsCreated: 0, trainingsEnrolled: 0 };
      if (jobRoleId && jobRoleId.trim()) {
        try {
          autoAssignmentResult = await storage.assignJobRoleToUser(
            newUser.id,
            jobRoleId.trim(),
            currentUser.id // The admin who created the user
          );
        } catch (error) {
          console.error("Error auto-assigning job role elements:", error);
          // Don't fail user creation if auto-assignment fails
        }
      }
      
      res.status(201).json({ 
        ...newUser,
        autoAssigned: autoAssignmentResult
      });
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  // Bulk Assignment endpoints
  app.post('/api/admin/bulk-assign-job-role', isAuthenticated, requireRole('admin', 'super_admin'), async (req: any, res) => {
    try {
      const { userIds, jobRoleId } = req.body;
      const currentUserId = req.user?.claims?.sub;

      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ error: "userIds must be a non-empty array" });
      }

      if (!jobRoleId) {
        return res.status(400).json({ error: "jobRoleId is required" });
      }

      // Verify job role exists
      const jobRole = await storage.getJobRole(jobRoleId);
      if (!jobRole) {
        return res.status(404).json({ error: "Job role not found" });
      }

      const result = await storage.bulkAssignJobRole(userIds, jobRoleId, currentUserId);

      res.json({
        message: "Bulk job role assignment completed",
        ...result,
      });
    } catch (error) {
      console.error("Error in bulk job role assignment:", error);
      res.status(500).json({ error: "Failed to perform bulk job role assignment" });
    }
  });

  app.post('/api/admin/bulk-assign-element', isAuthenticated, requireRole('admin', 'super_admin', 'assessor'), async (req: any, res) => {
    try {
      const { userIds, elementId } = req.body;
      const currentUserId = req.user?.claims?.sub;

      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ error: "userIds must be a non-empty array" });
      }

      if (!elementId) {
        return res.status(400).json({ error: "elementId is required" });
      }

      // Verify element exists
      const element = await storage.getCompetencyElement(elementId);
      if (!element) {
        return res.status(404).json({ error: "Competency element not found" });
      }

      const result = await storage.bulkAssignCompetenceElement(userIds, elementId, currentUserId);

      res.json({
        message: "Bulk element assignment completed",
        ...result,
      });
    } catch (error) {
      console.error("Error in bulk element assignment:", error);
      res.status(500).json({ error: "Failed to perform bulk element assignment" });
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

  // Historical Data Import Routes
  
  // Download Excel template for historical data import
  app.get('/api/admin/historical-import/template', isAuthenticated, requireRole('admin', 'super_admin'), async (req: any, res) => {
    try {
      // Create template with headers
      const headers = [
        'User',
        'Role (Super Admin, Admin, Internal Verifier, Assessor, Candidate)',
        'Location (Optional)',
        'Job Role (Optional)',
        'Date of Birth',
        'Company Number (Optional)',
        'Competence Category',
        'Competence Element',
        'Assessor',
        'Assessment Date',
        'Validity Years',
        'Expiry_Date'
      ];
      
      // Create example data (matching the user's template)
      const exampleData = {
        'User': 'Joe Bloggs',
        'Role (Super Admin, Admin, Internal Verifier, Assessor, Candidate)': 'Candidate',
        'Location (Optional)': 'Offshore',
        'Job Role (Optional)': 'Electrical Technician (EL01)',
        'Date of Birth': new Date('1999-02-15'),
        'Company Number (Optional)': '',
        'Competence Category': 'HSE',
        'Competence Element': 'SIMOPS',
        'Assessor': 'Caroline Reaper',
        'Assessment Date': new Date('2023-06-15'),
        'Validity Years': 3,
        'Expiry_Date': new Date('2026-06-15')
      };
      
      // Create worksheet
      const ws = XLSX.utils.json_to_sheet([exampleData], { header: headers });
      
      // Create workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      
      // Generate buffer
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      
      // Send file
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="Capera Historical Data Import.xlsx"');
      res.send(buffer);
    } catch (error) {
      console.error('Error generating template:', error);
      res.status(500).json({ error: 'Failed to generate template' });
    }
  });

  // Process historical data import from Excel file
  app.post('/api/admin/historical-import', isAuthenticated, requireRole('admin', 'super_admin'), async (req: any, res) => {
    try {
      const currentUserId = req.user?.claims?.sub;
      
      // Get current user
      const currentUser = await storage.getUser(currentUserId);
      if (!currentUser) {
        return res.status(401).json({ error: "User not found" });
      }
      
      const { data } = req.body;
      
      if (!data || !Array.isArray(data) || data.length === 0) {
        return res.status(400).json({ error: 'No data provided for import' });
      }
      
      // Convert Excel serial dates to JavaScript dates
      const convertExcelDate = (serial: number): Date => {
        const utc_days = Math.floor(serial - 25569);
        const utc_value = utc_days * 86400;
        const date_info = new Date(utc_value * 1000);
        return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate());
      };
      
      // Parse and normalize import data
      const importData = data.map((row: any) => {
        const assessmentDate = typeof row['Assessment Date'] === 'number' 
          ? convertExcelDate(row['Assessment Date']) 
          : new Date(row['Assessment Date']);
        
        const expiryDate = typeof row['Expiry_Date'] === 'number'
          ? convertExcelDate(row['Expiry_Date'])
          : new Date(row['Expiry_Date']);
        
        const dateOfBirth = row['Date of Birth'] 
          ? (typeof row['Date of Birth'] === 'number' 
              ? convertExcelDate(row['Date of Birth']) 
              : new Date(row['Date of Birth']))
          : undefined;
        
        return {
          userName: row['User'],
          userRole: row['Role (Super Admin, Admin, Internal Verifier, Assessor, Candidate)'],
          location: row['Location (Optional)'] || undefined,
          jobRoleName: row['Job Role (Optional)'] || undefined,
          dateOfBirth,
          companyNumber: row['Company Number (Optional)'] || undefined,
          competenceCategoryName: row['Competence Category'],
          competenceElementName: row['Competence Element'],
          assessorName: row['Assessor'],
          assessmentDate,
          validityYears: Number(row['Validity Years']),
          expiryDate,
        };
      });
      
      // Process the import
      const result = await storage.processHistoricalImport(importData, currentUser.id);
      
      res.json(result);
    } catch (error) {
      console.error('Error processing historical import:', error);
      res.status(500).json({ error: 'Failed to process import' });
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

  // Print/Preview endpoint for SIMOPS-style assessment documents (V2)
  app.get("/api/competence-elements/:id/print", async (req, res) => {
    try {
      const elementId = req.params.id;
      const role = (req.query.role as string) || 'assessor'; // 'assessor' or 'candidate'
      const format = (req.query.format as string) || 'json'; // 'json' or 'html'
      
      // Validate role
      if (!['assessor', 'candidate'].includes(role)) {
        return res.status(400).json({ error: "Role must be 'assessor' or 'candidate'" });
      }

      // Fetch element details
      const element = await storage.getCompetencyElement(elementId);
      if (!element) {
        return res.status(404).json({ error: "Element not found" });
      }

      // Fetch all criteria for this element
      const allCriteria = await storage.getCompetenceCriteria({ elementId });
      
      // Fetch subcategories to organize criteria
      const subcategories = await storage.getCompetenceSubcategories(elementId);

      // Helper function to organize criteria by subcategory
      const organizeCriteria = (type: 'knowledge' | 'performance', prefix: string) => {
        const criteriaOfType = allCriteria.filter(c => c.type === type);
        const grouped: { [key: string]: any[] } = {};

        // Group by subcategory
        criteriaOfType.forEach(criteria => {
          let subcatName = 'General';
          if (criteria.subcategoryId) {
            const subcat = subcategories.find(s => s.id === criteria.subcategoryId);
            if (subcat) subcatName = subcat.name;
          }
          
          if (!grouped[subcatName]) grouped[subcatName] = [];
          
          const item: any = {
            number: criteria.code,
            text: criteria.criteriaText,
            required: criteria.required ?? true,
          };

          // Include guidance only for assessor role
          if (role === 'assessor' && criteria.assessorGuidance) {
            item.guidance_number = criteria.guidanceNumber;
            item.assessor_guidance = criteria.assessorGuidance;
          }

          grouped[subcatName].push(item);
        });

        // Convert to array format
        return Object.entries(grouped).map(([title, items]) => ({
          title,
          items
        }));
      };

      const data = {
        category: element.categoryId || null,
        element: element.name,
        criticality: element.safetyCriticality,
        reassess_years: element.reassessmentYears || 0,
        proficiency_scheme: element.proficiencyScheme || 1,
        sections: {
          knowledge: organizeCriteria('knowledge', 'K'),
          performance: organizeCriteria('performance', 'P')
        }
      };

      if (format === 'json') {
        return res.json(data);
      }

      // For HTML format, return a simple HTML view (can be enhanced with a template later)
      const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Assessment: ${data.element}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; max-width: 1200px; margin: 0 auto; }
    h1 { color: #2563eb; }
    h2 { color: #1e40af; margin-top: 30px; }
    .section { margin-bottom: 20px; }
    .criteria { margin-left: 20px; }
    .item { margin-bottom: 10px; padding: 10px; border-left: 3px solid #3b82f6; }
    .guidance { margin-top: 5px; padding: 8px; background: #eff6ff; border-left: 3px solid #60a5fa; }
    .metadata { color: #6b7280; margin-bottom: 20px; }
    .comments { margin-top: 16px; padding: 10px; border: 1px dashed #aaa; min-height: 60px; background-color: #f9fafb; }
  </style>
</head>
<body>
  <h1>${data.element}</h1>
  <div class="metadata">
    <p><strong>Criticality:</strong> ${data.criticality} | <strong>Reassessment:</strong> ${data.reassess_years} years | <strong>Proficiency:</strong> ${data.proficiency_scheme}-level</p>
  </div>
  
  <h2>Knowledge Criteria</h2>
  ${data.sections.knowledge.map(block => `
    <div class="section">
      <h3>${block.title}</h3>
      <div class="criteria">
        ${block.items.map((item: any) => `
          <div class="item">
            <strong>${item.number}</strong> ${item.text} ${item.required ? '(M)' : '(O)'}
            ${item.assessor_guidance ? `<div class="guidance"><strong>${item.guidance_number}:</strong> ${item.assessor_guidance}</div>` : ''}
          </div>
        `).join('')}
      </div>
      ${role === 'assessor' ? `<div class="comments"><strong>Assessor Comments for ${block.title}:</strong><br><br><br></div>` : ''}
    </div>
  `).join('')}
  
  <h2>Performance Criteria</h2>
  ${data.sections.performance.map(block => `
    <div class="section">
      <h3>${block.title}</h3>
      <div class="criteria">
        ${block.items.map((item: any) => `
          <div class="item">
            <strong>${item.number}</strong> ${item.text} ${item.required ? '(M)' : '(O)'}
            ${item.assessor_guidance ? `<div class="guidance"><strong>${item.guidance_number}:</strong> ${item.assessor_guidance}</div>` : ''}
          </div>
        `).join('')}
      </div>
      ${role === 'assessor' ? `<div class="comments"><strong>Assessor Comments for ${block.title}:</strong><br><br><br></div>` : ''}
    </div>
  `).join('')}
</body>
</html>
      `;

      res.setHeader('Content-Type', 'text/html');
      return res.send(html);
    } catch (error) {
      console.error("Error generating print view:", error);
      res.status(500).json({ error: "Failed to generate print view" });
    }
  });

  // Debug endpoint: Get counts of knowledge vs performance criteria
  app.get("/api/competence-elements/:id/section-counts", isAuthenticated, async (req, res) => {
    try {
      const elementId = req.params.id;
      const allCriteria = await storage.getCompetenceCriteria({ elementId });
      
      const knowledge = allCriteria.filter(c => c.type === 'knowledge').length;
      const performance = allCriteria.filter(c => c.type === 'performance').length;
      
      res.json({ knowledge, performance, total: knowledge + performance });
    } catch (error) {
      console.error("Error getting section counts:", error);
      res.status(500).json({ error: "Failed to get section counts" });
    }
  });

  // Admin: Rename category
  app.patch("/api/admin/categories/:id", isAuthenticated, requireRole('admin', 'developer', 'super_admin'), async (req, res) => {
    try {
      const categoryId = req.params.id;
      const { name } = req.body;
      
      if (!name || !name.trim()) {
        return res.status(400).json({ error: "Category name is required" });
      }
      
      const updated = await storage.updateCompetencyCategory(categoryId, { name: name.trim() });
      if (!updated) {
        return res.status(404).json({ error: "Category not found" });
      }
      
      res.json({ status: "ok", category: updated });
    } catch (error) {
      console.error("Error renaming category:", error);
      res.status(500).json({ error: "Failed to rename category" });
    }
  });

  // Admin: Delete category (soft delete)
  app.delete("/api/admin/categories/:id", isAuthenticated, requireRole('admin', 'developer', 'super_admin'), async (req, res) => {
    try {
      const categoryId = req.params.id;
      const success = await storage.deleteCompetencyCategory(categoryId);
      
      if (!success) {
        return res.status(404).json({ error: "Category not found" });
      }
      
      res.json({ status: "ok" });
    } catch (error) {
      console.error("Error deleting category:", error);
      res.status(500).json({ error: "Failed to delete category" });
    }
  });

  // Admin: Rename/move element
  app.patch("/api/admin/elements/:id", isAuthenticated, requireRole('admin', 'developer', 'super_admin'), async (req, res) => {
    try {
      const elementId = req.params.id;
      const { name, categoryId } = req.body;
      
      const updates: any = {};
      if (name) updates.name = name.trim();
      if (categoryId) updates.categoryId = categoryId;
      
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No updates provided" });
      }
      
      const updated = await storage.updateCompetencyElement(elementId, updates);
      if (!updated) {
        return res.status(404).json({ error: "Element not found" });
      }
      
      res.json({ status: "ok", element: updated });
    } catch (error) {
      console.error("Error updating element:", error);
      res.status(500).json({ error: "Failed to update element" });
    }
  });

  // Admin: Delete element (soft delete)
  app.delete("/api/admin/elements/:id", isAuthenticated, requireRole('admin', 'developer', 'super_admin'), async (req, res) => {
    try {
      const elementId = req.params.id;
      const success = await storage.deleteCompetencyElement(elementId);
      
      if (!success) {
        return res.status(404).json({ error: "Element not found" });
      }
      
      res.json({ status: "ok" });
    } catch (error) {
      console.error("Error deleting element:", error);
      res.status(500).json({ error: "Failed to delete element" });
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

  // Excel template download endpoint
  app.get("/api/competence-standards/template", isAuthenticated, async (req, res) => {
    try {
      // Create a new Excel workbook
      const workbook = XLSX.utils.book_new();
      
      // Define the template data with headers (A-J only) - shows supported type aliases
      const templateData = [
        // Header row
        ['Category', 'Element', 'Subcategory', 'Type', 'Description', 'Proficiency Levels', 'Proficiency Terms', 'Assessment Methods', 'Criticality', 'Validity (Years)'],
        // Example rows showing various type aliases (all map correctly)
        ['HSE', 'SIMOPS', 'General', 'Underpinning Knowledge', 'What is SIMOPS?', '4', 'Novice,Competent,Proficient,Expert', 'K,KE', 'High', '2'],
        ['HSE', 'SIMOPS', 'Planning', 'Performance Criteria', 'Plan simultaneous operations', '3', 'Basic,Competent,Advanced', 'KE,KP', 'High', '3'],
        ['Technical', 'Maintenance', 'Preventive', 'K', 'Schedule preventive maintenance', '4', 'Beginner,Intermediate,Advanced,Expert', 'K,T', 'Medium', '1'],
        ['Technical', 'Maintenance', '', 'P', 'Execute preventive maintenance', '', '', 'KE,KP', '', ''],
      ];
      
      // Create worksheet from data
      const worksheet = XLSX.utils.aoa_to_sheet(templateData);
      
      // Set column widths for better visibility
      worksheet['!cols'] = [
        { wch: 15 }, // Category
        { wch: 20 }, // Element
        { wch: 15 }, // Subcategory
        { wch: 12 }, // Type
        { wch: 40 }, // Description
        { wch: 15 }, // Proficiency Levels
        { wch: 20 }, // Proficiency Terms
        { wch: 18 }, // Assessment Methods
        { wch: 12 }, // Criticality
        { wch: 15 }, // Validity (Years)
      ];
      
      // Add the worksheet to the workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Competence Standards');
      
      // Generate Excel buffer
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      // Set proper headers for Excel download
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=competence-standards-template.xlsx');
      res.setHeader('Content-Length', buffer.length);
      
      res.send(buffer);
    } catch (error) {
      console.error("Error generating Excel template:", error);
      res.status(500).json({ error: "Failed to generate Excel template" });
    }
  });

  // Comprehensive Excel Import for Competence Standards (A-J column mapping)
  app.post("/api/competence-standards/import", isAuthenticated, requireRole('developer', 'admin', 'super_admin'), upload.single("file"), async (req: any, res) => {
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

      // ============ TYPE NORMALIZATION (matches Python v1.1) ============
      // Map many synonyms to 'knowledge' or 'performance' with robust fuzzy matching
      const normalizeCriteriaType = (rawValue: any): string => {
        if (!rawValue) return '';
        
        // Normalize: lowercase, collapse spaces/hyphens/underscores
        let t = String(rawValue).trim().toLowerCase();
        t = t.replace(/[-_]/g, ' ');  // Replace hyphens/underscores with spaces
        t = t.replace(/\s+/g, ' ').trim();  // Collapse multiple spaces
        
        // Knowledge variants (exact matches)
        const knowledgeExact = ['knowledge', 'k', 'uk', 'u/k', 'underpinning', 'under pinning', 'underpin', 
                                'underpinning knowledge', 'under pinning knowledge'];
        if (knowledgeExact.includes(t)) return 'knowledge';
        
        // Knowledge variants (prefix matching)
        if (t.startsWith('underpin') || t.startsWith('knowledg')) return 'knowledge';
        
        // Performance variants (exact matches)
        const performanceExact = ['performance', 'p', 'pc', 'p/c', 'perf', 
                                  'performance criteria', 'performance criterion'];
        if (performanceExact.includes(t)) return 'performance';
        
        // Performance variants (prefix matching)
        if (t.startsWith('perform')) return 'performance';
        
        // Return unrecognized (will trigger warning and default to 'knowledge')
        return t;
      };

      // Transform and validate rows to ExcelImportRow format with FILL-DOWN support
      const validatedRows: ExcelImportRow[] = [];
      const validationErrors: { row: number; field?: string; message: string; }[] = [];
      const warnings: { row: number; message: string; }[] = [];

      // Fill-down state for carrying forward values from previous rows
      let fillDownState = {
        category: '',
        element: '',
        type: '',
        subcategory: '',
        proficiencyLevels: '',
        criticality: 'Medium',
        validityPeriod: '3',
      };

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

          // Enhanced column mapping with multiple header variations
          const findFieldValue = (row: any, ...variants: string[]): string => {
            for (const variant of variants) {
              const normalizedVariant = variant.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
              for (const [key, value] of Object.entries(row)) {
                const normalizedKey = key.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
                if (normalizedKey === normalizedVariant || normalizedKey.includes(normalizedVariant) || normalizedVariant.includes(normalizedKey)) {
                  return String(value || '').trim();
                }
              }
            }
            return '';
          };

          // Extract raw values
          const rawCategory = findFieldValue(normalizedRow, 'category', 'categories', 'competence category', 'competency category', 'cat', 'column a', 'a');
          const rawElement = findFieldValue(normalizedRow, 'element', 'elements', 'competence element', 'competency element', 'el', 'competency', 'column b', 'b');
          const rawSubcategory = findFieldValue(normalizedRow, 'subcategory', 'subcategories', 'subcat', 'sub category', 'subcriteria', 'column c', 'c');
          const rawTypeField = findFieldValue(normalizedRow, 'criteria', 'type', 'knowledgeperformance', 'kp', 'knowledge performance', 'column d', 'd');
          const rawDescription = findFieldValue(normalizedRow, 'description', 'desc', 'criteria', 'assessment criteria', 'criteriatext', 'criteriadescription', 'text', 'column e', 'e');
          const rawProfLevels = findFieldValue(normalizedRow, 'proficiencylevels', 'proficiency levels', 'proficiency level', 'proficiency', 'levels', 'proflevels', 'column f', 'f');
          const rawCriticality = findFieldValue(normalizedRow, 'criticality', 'critical', 'criticality rating', 'criticallevel', 'column i', 'i');
          const rawValidity = findFieldValue(normalizedRow, 'validityperiod', 'validity period', 'validity', 'reassessment validity', 'validityyears', 'years', 'column j', 'j');

          // FILL-DOWN logic: Use current value if present, otherwise use previous row's value
          const category = rawCategory || fillDownState.category;
          const element = rawElement || fillDownState.element;
          const proficiencyLevels = rawProfLevels || fillDownState.proficiencyLevels;
          
          // Type detection with robust normalization (v1.1) - handles many aliases + warnings
          const rawTypeValue = rawTypeField || fillDownState.type;
          let typeValue = normalizeCriteriaType(rawTypeValue);
          
          // If unrecognized type, issue warning and default to 'knowledge'
          if (typeValue && typeValue !== 'knowledge' && typeValue !== 'performance') {
            warnings.push({
              row: rowNumber,
              message: `Unknown type '${rawTypeValue}' in row ${rowNumber} → defaulted to 'knowledge'. Supported: knowledge/k/uk/underpinning or performance/p/pc/perf`
            });
            typeValue = 'knowledge';
          }
          
          // If still empty after normalization and fill-down, will fail validation
          const type = typeValue as 'knowledge' | 'performance';
          
          // Subcategory with fill-down and "General" default (from reference implementation)
          let subcategory = rawSubcategory || fillDownState.subcategory;
          if (!subcategory || subcategory.trim() === '') {
            subcategory = 'General';
          }

          // Criticality normalization with fill-down
          const criticalityRaw = String(rawCriticality || fillDownState.criticality || 'Medium').toLowerCase().trim();
          const criticality = criticalityRaw === 'low' ? 'Low' : 
                            criticalityRaw === 'medium' ? 'Medium' : 
                            criticalityRaw === 'high' ? 'High' : 'Medium';

          // Validity period with fill-down
          const validityPeriod = rawValidity || fillDownState.validityPeriod || '3';

          // Skip rows with no description (empty criteria rows)
          if (!rawDescription) {
            // Update fill-down state for next row but don't process this row
            fillDownState = { category, element, type, subcategory, proficiencyLevels, criticality, validityPeriod };
            continue;
          }

          // Update fill-down state
          fillDownState = { category, element, type, subcategory, proficiencyLevels, criticality, validityPeriod };

          const mappedRow = {
            category,
            element,
            subcategory,
            type,
            description: rawDescription,
            proficiencyLevels,
            proficiencyTerminology: findFieldValue(normalizedRow, 'proficiencyterminology', 'proficiency terms', 'profterms', 'terminology', 'terms', 'column g', 'g'),
            assessmentMethods: parseAssessmentMethods(findFieldValue(normalizedRow, 'assessmentmethods', 'assessment methods', 'methods', 'assmethods', 'column h', 'h')),
            criticality,
            validityPeriod,
            required: (findFieldValue(normalizedRow, 'required', 'mandatory', 'req') || 'M') as 'O' | 'M',
            assessorGuidance: findFieldValue(normalizedRow, 'assessorguidance', 'assessor guidance', 'guidance', 'assessor notes', 'assessornotes'),
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

      // If too many validation errors, return early with helpful guidance
      if (validationErrors.length > validatedRows.length) {
        console.error("Import validation failed:", {
          totalRows: rows.length,
          validationErrors: validationErrors.length,
          validatedRows: validatedRows.length,
          firstFewErrors: validationErrors.slice(0, 5),
          detectedHeaders: Object.keys(rows[0] || {})
        });
        
        // Add helpful guidance for common issues
        const helpfulErrors = validationErrors.slice(0, 10).map(error => {
          let helpfulMessage = error.message;
          
          if (error.message === 'Required' && error.field) {
            if (error.field === 'category') {
              helpfulMessage = 'Category is required. Expected column headers: "Category", "Categories", or "Cat"';
            } else if (error.field === 'element') {
              helpfulMessage = 'Element is required. Expected column headers: "Element", "Elements", "Competency", or "El"';
            } else if (error.field === 'subcategory') {
              helpfulMessage = 'Subcategory is required. Expected column headers: "Subcategory", "Sub Category", or "Subcat"';
            } else if (error.field === 'description') {
              helpfulMessage = 'Description is required. Expected column headers: "Description", "Criteria", or "Text"';
            } else if (error.field === 'type') {
              helpfulMessage = 'Type is required and must be "knowledge", "performance", "underpinning knowledge" (or shorthand "k"/"p"). TIP: The system supports fill-down - if a cell is blank, it uses the previous row\'s value. Make sure the FIRST row of each section has a type specified.';
            }
          } else if (error.message.includes("Type must be 'knowledge' or 'performance'")) {
            helpfulMessage = 'Type must be "knowledge", "performance", or "underpinning knowledge". The system supports FILL-DOWN: blank cells use the previous row\'s value. Ensure the first row of each section specifies the type.';
          }
          
          return { ...error, message: helpfulMessage };
        });

        const errorResult: ExcelImportResult = {
          successCount: 0,
          errorCount: validationErrors.length,
          errors: helpfulErrors,
          warnings: [{
            row: 1,
            message: `File format validation failed. The system supports FILL-DOWN (blank cells use previous row values). Ensure Category, Element, and Type are specified in the first row of each section. Detected headers: ${Object.keys(rows[0] || {}).slice(0, 10).join(', ')}`
          }],
        };
        return res.status(400).json(errorResult);
      }

      // Process the validated rows using storage
      const result = await storage.importCompetenceStandards(validatedRows);
      
      // Add validation errors and warnings to the result
      result.errors = [...result.errors, ...validationErrors];
      result.errorCount += validationErrors.length;
      result.warnings = [...(result.warnings || []), ...warnings];

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
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      // Handle duplicate job role name
      if (error.code === '23505' && error.constraint === 'job_roles_name_unique') {
        return res.status(409).json({ error: "A job role with this name already exists" });
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

  // Role Elements CRUD (element-level job role assignments)
  app.get("/api/role-elements", async (req, res) => {
    try {
      const { roleId, elementId } = req.query;
      const roleElements = await storage.getRoleElements(
        roleId as string | undefined,
        elementId as string | undefined
      );
      res.json(roleElements);
    } catch (error) {
      console.error("Error fetching role elements:", error);
      res.status(500).json({ error: "Failed to fetch role elements" });
    }
  });

  app.post("/api/role-elements", isAuthenticated, requireRole('admin', 'developer'), async (req, res) => {
    try {
      const validatedData = insertRoleElementSchema.parse(req.body);
      const roleElement = await storage.createRoleElement(validatedData);
      res.status(201).json(roleElement);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error creating role element:", error);
      res.status(500).json({ error: "Failed to create role element" });
    }
  });

  app.patch("/api/role-elements/:id", isAuthenticated, requireRole('admin', 'developer'), async (req, res) => {
    try {
      const partialData = insertRoleElementSchema.partial().parse(req.body);
      const roleElement = await storage.updateRoleElement(req.params.id, partialData);
      if (!roleElement) {
        return res.status(404).json({ error: "Role element not found" });
      }
      res.json(roleElement);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error updating role element:", error);
      res.status(500).json({ error: "Failed to update role element" });
    }
  });

  app.delete("/api/role-elements/:id", isAuthenticated, requireRole('admin', 'developer'), async (req, res) => {
    try {
      const success = await storage.deleteRoleElement(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Role element not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting role element:", error);
      res.status(500).json({ error: "Failed to delete role element" });
    }
  });

  // Role Matrix endpoint - Get all elements assigned to a role
  app.get("/api/job-roles/:id/matrix", async (req, res) => {
    try {
      const matrix = await storage.getRoleMatrix(req.params.id);
      res.json(matrix);
    } catch (error) {
      console.error("Error fetching role matrix:", error);
      res.status(500).json({ error: "Failed to fetch role matrix" });
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
      const userId = (req.user as any)?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const preferences = await storage.getUserLanguagePreference(userId);
      
      // Return existing preferences or default values
      const response = preferences || {
        userId,
        primaryLanguage: 'en',
        fallbackLanguage: 'en',
        autoTranslate: true,
        lastUpdated: new Date().toISOString()
      };
      
      res.json(response);
    } catch (error) {
      console.error("Error fetching user language preferences:", error);
      res.status(500).json({ error: "Failed to fetch language preferences" });
    }
  });

  app.post("/api/translation/user-preferences", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const { primaryLanguage, fallbackLanguage, autoTranslate } = req.body;
      
      if (!primaryLanguage) {
        return res.status(400).json({ error: "Primary language is required" });
      }

      // Save preferences to storage
      const updatedPreferences = await storage.createOrUpdateUserLanguagePreference(userId, {
        primaryLanguage,
        fallbackLanguage: fallbackLanguage || 'en',
        autoTranslate: autoTranslate !== false,
      });
      
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

  // ========================================
  // TRAINING ENROLLMENT ENDPOINTS
  // ========================================

  // Get training enrollments
  app.get("/api/training-enrollments", isAuthenticated, async (req, res) => {
    try {
      let { userId, trainingId } = req.query;
      
      // User can only see their own enrollments unless admin
      const currentUserId = req.user?.claims?.sub;
      const userRole = normalizeRole(req.user?.claims?.role || 'candidate');
      const isAdmin = ['admin', 'super_admin'].includes(userRole);
      
      // If userId not provided and not admin, default to current user
      if (!userId && !isAdmin) {
        userId = currentUserId;
      }
      
      // If userId specified and different from current user, and not admin, reject
      if (userId && userId !== currentUserId && !isAdmin) {
        return res.status(403).json({ error: "Not authorized to view other users' enrollments" });
      }
      
      const enrollments = await storage.getTrainingEnrollments(
        userId as string,
        trainingId as string
      );
      res.json(enrollments);
    } catch (error) {
      console.error("Error fetching training enrollments:", error);
      res.status(500).json({ error: "Failed to fetch training enrollments" });
    }
  });

  // Create training enrollment
  app.post("/api/training-enrollments", requireRole('admin', 'super_admin'), async (req, res) => {
    try {
      const validatedData = insertTrainingEnrollmentSchema.parse(req.body);
      const enrollment = await storage.createTrainingEnrollment(validatedData);
      res.status(201).json(enrollment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Error creating training enrollment:", error);
      res.status(500).json({ error: "Failed to create training enrollment" });
    }
  });

  // Update training enrollment
  app.patch("/api/training-enrollments/:id", requireRole('admin', 'super_admin'), async (req, res) => {
    try {
      const validatedData = insertTrainingEnrollmentSchema.partial().parse(req.body);
      const enrollment = await storage.updateTrainingEnrollment(req.params.id, validatedData);
      if (!enrollment) {
        return res.status(404).json({ error: "Training enrollment not found" });
      }
      res.json(enrollment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Error updating training enrollment:", error);
      res.status(500).json({ error: "Failed to update training enrollment" });
    }
  });

  // Delete training enrollment
  app.delete("/api/training-enrollments/:id", requireRole('admin', 'super_admin'), async (req, res) => {
    try {
      const success = await storage.deleteTrainingEnrollment(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Training enrollment not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting training enrollment:", error);
      res.status(500).json({ error: "Failed to delete training enrollment" });
    }
  });

  // ========================================
  // CANDIDATE ALLOCATION ENDPOINTS
  // ========================================

  // Get candidate allocations
  app.get("/api/candidate-allocations", requireRole('admin', 'super_admin', 'assessor'), async (req, res) => {
    try {
      const { assessorId, candidateId } = req.query;
      const currentUserId = req.user?.claims?.sub;
      const userRole = normalizeRole(req.user?.claims?.role || 'candidate');
      const isAdmin = ['admin', 'super_admin'].includes(userRole);
      
      // Assessors can only see their own allocations unless admin
      if (assessorId && assessorId !== currentUserId && !isAdmin) {
        return res.status(403).json({ error: "Not authorized to view other assessors' allocations" });
      }
      
      const allocations = await storage.getCandidateAllocations(
        assessorId as string,
        candidateId as string
      );
      res.json(allocations);
    } catch (error) {
      console.error("Error fetching candidate allocations:", error);
      res.status(500).json({ error: "Failed to fetch candidate allocations" });
    }
  });

  // Get assessor's allocated candidates
  app.get("/api/assessors/:id/candidates", requireRole('admin', 'super_admin', 'assessor'), async (req, res) => {
    try {
      const currentUserId = req.user?.claims?.sub;
      const userRole = normalizeRole(req.user?.claims?.role || 'candidate');
      const isAdmin = ['admin', 'super_admin'].includes(userRole);
      
      // Assessors can only see their own candidates unless admin
      if (req.params.id !== currentUserId && !isAdmin) {
        return res.status(403).json({ error: "Not authorized to view other assessors' candidates" });
      }
      
      const candidates = await storage.getAssessorCandidates(req.params.id);
      res.json(candidates);
    } catch (error) {
      console.error("Error fetching assessor candidates:", error);
      res.status(500).json({ error: "Failed to fetch assessor candidates" });
    }
  });

  // Create candidate allocation
  app.post("/api/candidate-allocations", requireRole('admin', 'super_admin'), async (req, res) => {
    try {
      const validatedData = insertCandidateAllocationSchema.parse(req.body);
      const allocation = await storage.createCandidateAllocation(validatedData);
      res.status(201).json(allocation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Error creating candidate allocation:", error);
      res.status(500).json({ error: "Failed to create candidate allocation" });
    }
  });

  // Update candidate allocation
  app.patch("/api/candidate-allocations/:id", requireRole('admin', 'super_admin'), async (req, res) => {
    try {
      const validatedData = insertCandidateAllocationSchema.partial().parse(req.body);
      const allocation = await storage.updateCandidateAllocation(req.params.id, validatedData);
      if (!allocation) {
        return res.status(404).json({ error: "Candidate allocation not found" });
      }
      res.json(allocation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Error updating candidate allocation:", error);
      res.status(500).json({ error: "Failed to update candidate allocation" });
    }
  });

  // Delete candidate allocation
  app.delete("/api/candidate-allocations/:id", requireRole('admin', 'super_admin'), async (req, res) => {
    try {
      const success = await storage.deleteCandidateAllocation(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Candidate allocation not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting candidate allocation:", error);
      res.status(500).json({ error: "Failed to delete candidate allocation" });
    }
  });

  // ========================================
  // ASSESSMENT ENDPOINTS
  // ========================================

  // Get assessments (with optional expiry tracking)
  app.get("/api/assessments", requireRole('admin', 'super_admin', 'assessor', 'internal_verifier'), async (req, res) => {
    try {
      const { candidateId, assessorId, elementId, withExpiry } = req.query;
      const currentUserId = req.user?.claims?.sub;
      const userRole = normalizeRole(req.user?.claims?.role || 'candidate');
      const isAdmin = ['admin', 'super_admin'].includes(userRole);
      
      // Assessors can only see their own assessments unless admin
      if (assessorId && assessorId !== currentUserId && !isAdmin && userRole === 'assessor') {
        return res.status(403).json({ error: "Not authorized to view other assessors' assessments" });
      }
      
      if (withExpiry === 'true') {
        const assessments = await storage.getAssessmentsWithExpiry(
          assessorId as string,
          candidateId as string
        );
        res.json(assessments);
      } else {
        const assessments = await storage.getAssessments(
          candidateId as string,
          assessorId as string,
          elementId as string
        );
        res.json(assessments);
      }
    } catch (error) {
      console.error("Error fetching assessments:", error);
      res.status(500).json({ error: "Failed to fetch assessments" });
    }
  });

  // Get single assessment
  app.get("/api/assessments/:id", requireRole('admin', 'super_admin', 'assessor', 'internal_verifier', 'candidate'), async (req, res) => {
    try {
      const assessment = await storage.getAssessment(req.params.id);
      if (!assessment) {
        return res.status(404).json({ error: "Assessment not found" });
      }
      
      // Check ownership
      const currentUserId = req.user?.claims?.sub;
      const userRole = normalizeRole(req.user?.claims?.role || 'candidate');
      const isAdmin = ['admin', 'super_admin'].includes(userRole);
      const isAssessor = userRole === 'assessor' && assessment.assessorId === currentUserId;
      const isCandidate = userRole === 'candidate' && assessment.candidateId === currentUserId;
      const isVerifier = userRole === 'internal_verifier';
      
      if (!isAdmin && !isAssessor && !isCandidate && !isVerifier) {
        return res.status(403).json({ error: "Not authorized to view this assessment" });
      }
      
      res.json(assessment);
    } catch (error) {
      console.error("Error fetching assessment:", error);
      res.status(500).json({ error: "Failed to fetch assessment" });
    }
  });

  // Create assessment
  app.post("/api/assessments", requireRole('assessor', 'admin', 'super_admin'), async (req, res) => {
    try {
      const userId = req.user?.claims?.sub;
      
      // Validate the input data
      const validatedData = insertAssessmentSchema.parse({
        ...req.body,
        assessorId: userId, // Always use authenticated user as assessor
        verificationStatus: 'not_verified',
        verificationId: null,
      });
      
      const assessment = await storage.createAssessment(validatedData);
      res.status(201).json(assessment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Error creating assessment:", error);
      res.status(500).json({ error: "Failed to create assessment" });
    }
  });

  // Update assessment
  app.patch("/api/assessments/:id", requireRole('assessor', 'admin', 'super_admin'), async (req, res) => {
    try {
      const currentUserId = req.user?.claims?.sub;
      const userRole = normalizeRole(req.user?.claims?.role || 'candidate');
      const isAdmin = ['admin', 'super_admin'].includes(userRole);
      
      // Check ownership if not admin
      if (!isAdmin) {
        const existing = await storage.getAssessment(req.params.id);
        if (!existing) {
          return res.status(404).json({ error: "Assessment not found" });
        }
        if (existing.assessorId !== currentUserId) {
          return res.status(403).json({ error: "Not authorized to update this assessment" });
        }
      }
      
      const validatedData = insertAssessmentSchema.partial().parse(req.body);
      const assessment = await storage.updateAssessment(req.params.id, validatedData);
      if (!assessment) {
        return res.status(404).json({ error: "Assessment not found" });
      }
      res.json(assessment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Error updating assessment:", error);
      res.status(500).json({ error: "Failed to update assessment" });
    }
  });

  // Delete assessment
  app.delete("/api/assessments/:id", requireRole('admin', 'super_admin'), async (req, res) => {
    try {
      const success = await storage.deleteAssessment(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Assessment not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting assessment:", error);
      res.status(500).json({ error: "Failed to delete assessment" });
    }
  });

  // ========================================
  // ASSESSMENT EVIDENCE ENDPOINTS
  // ========================================

  // Get assessment evidence
  app.get("/api/assessment-evidence", requireRole('admin', 'super_admin', 'assessor', 'internal_verifier'), async (req, res) => {
    try {
      const { assessmentId } = req.query;
      const evidence = await storage.getAssessmentEvidence(assessmentId as string);
      res.json(evidence);
    } catch (error) {
      console.error("Error fetching assessment evidence:", error);
      res.status(500).json({ error: "Failed to fetch assessment evidence" });
    }
  });

  // Create assessment evidence
  app.post("/api/assessment-evidence", requireRole('assessor', 'admin', 'super_admin'), async (req, res) => {
    try {
      const validatedData = insertAssessmentEvidenceSchema.parse(req.body);
      const evidence = await storage.createAssessmentEvidence(validatedData);
      res.status(201).json(evidence);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Error creating assessment evidence:", error);
      res.status(500).json({ error: "Failed to create assessment evidence" });
    }
  });

  // Update assessment evidence
  app.patch("/api/assessment-evidence/:id", requireRole('assessor', 'admin', 'super_admin'), async (req, res) => {
    try {
      const validatedData = insertAssessmentEvidenceSchema.partial().parse(req.body);
      const evidence = await storage.updateAssessmentEvidence(req.params.id, validatedData);
      if (!evidence) {
        return res.status(404).json({ error: "Assessment evidence not found" });
      }
      res.json(evidence);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Error updating assessment evidence:", error);
      res.status(500).json({ error: "Failed to update assessment evidence" });
    }
  });

  // Delete assessment evidence
  app.delete("/api/assessment-evidence/:id", requireRole('admin', 'super_admin'), async (req, res) => {
    try {
      const success = await storage.deleteAssessmentEvidence(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Assessment evidence not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting assessment evidence:", error);
      res.status(500).json({ error: "Failed to delete assessment evidence" });
    }
  });

  // ========================================
  // VERIFIER ALLOCATION ENDPOINTS
  // ========================================

  // Get verifier allocations
  app.get("/api/verifier-allocations", requireRole('admin', 'super_admin', 'internal_verifier'), async (req, res) => {
    try {
      const { verifierId, assessorId } = req.query;
      const currentUserId = req.user?.claims?.sub;
      const userRole = normalizeRole(req.user?.claims?.role || 'candidate');
      const isAdmin = ['admin', 'super_admin'].includes(userRole);
      
      // Verifiers can only see their own allocations unless admin
      if (verifierId && verifierId !== currentUserId && !isAdmin) {
        return res.status(403).json({ error: "Not authorized to view other verifiers' allocations" });
      }
      
      const allocations = await storage.getVerifierAllocations(
        verifierId as string,
        assessorId as string
      );
      res.json(allocations);
    } catch (error) {
      console.error("Error fetching verifier allocations:", error);
      res.status(500).json({ error: "Failed to fetch verifier allocations" });
    }
  });

  // Get verifier's allocated assessors
  app.get("/api/verifiers/:id/assessors", requireRole('admin', 'super_admin', 'internal_verifier'), async (req, res) => {
    try {
      const currentUserId = req.user?.claims?.sub;
      const userRole = normalizeRole(req.user?.claims?.role || 'candidate');
      const isAdmin = ['admin', 'super_admin'].includes(userRole);
      
      // Verifiers can only see their own assessors unless admin
      if (req.params.id !== currentUserId && !isAdmin) {
        return res.status(403).json({ error: "Not authorized to view other verifiers' assessors" });
      }
      
      const assessors = await storage.getVerifierAssessors(req.params.id);
      res.json(assessors);
    } catch (error) {
      console.error("Error fetching verifier assessors:", error);
      res.status(500).json({ error: "Failed to fetch verifier assessors" });
    }
  });

  // Create verifier allocation
  app.post("/api/verifier-allocations", requireRole('admin', 'super_admin'), async (req, res) => {
    try {
      const validatedData = insertVerifierAllocationSchema.parse(req.body);
      const allocation = await storage.createVerifierAllocation(validatedData);
      res.status(201).json(allocation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Error creating verifier allocation:", error);
      res.status(500).json({ error: "Failed to create verifier allocation" });
    }
  });

  // Update verifier allocation
  app.patch("/api/verifier-allocations/:id", requireRole('admin', 'super_admin'), async (req, res) => {
    try {
      const validatedData = insertVerifierAllocationSchema.partial().parse(req.body);
      const allocation = await storage.updateVerifierAllocation(req.params.id, validatedData);
      if (!allocation) {
        return res.status(404).json({ error: "Verifier allocation not found" });
      }
      res.json(allocation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Error updating verifier allocation:", error);
      res.status(500).json({ error: "Failed to update verifier allocation" });
    }
  });

  // Delete verifier allocation
  app.delete("/api/verifier-allocations/:id", requireRole('admin', 'super_admin'), async (req, res) => {
    try {
      const success = await storage.deleteVerifierAllocation(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Verifier allocation not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting verifier allocation:", error);
      res.status(500).json({ error: "Failed to delete verifier allocation" });
    }
  });

  // ========================================
  // SAMPLING PLAN ENDPOINTS
  // ========================================

  // Get sampling plans
  app.get("/api/sampling-plans", requireRole('admin', 'super_admin', 'internal_verifier'), async (req, res) => {
    try {
      const { verifierId, assessorId } = req.query;
      const currentUserId = req.user?.claims?.sub;
      const userRole = normalizeRole(req.user?.claims?.role || 'candidate');
      const isAdmin = ['admin', 'super_admin'].includes(userRole);
      
      // Verifiers can only see their own sampling plans unless admin
      if (verifierId && verifierId !== currentUserId && !isAdmin) {
        return res.status(403).json({ error: "Not authorized to view other verifiers' sampling plans" });
      }
      
      const plans = await storage.getSamplingPlans(
        verifierId as string,
        assessorId as string
      );
      res.json(plans);
    } catch (error) {
      console.error("Error fetching sampling plans:", error);
      res.status(500).json({ error: "Failed to fetch sampling plans" });
    }
  });

  // Create sampling plan
  app.post("/api/sampling-plans", requireRole('internal_verifier', 'admin', 'super_admin'), async (req, res) => {
    try {
      const validatedData = insertSamplingPlanSchema.parse(req.body);
      const plan = await storage.createSamplingPlan(validatedData);
      res.status(201).json(plan);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Error creating sampling plan:", error);
      res.status(500).json({ error: "Failed to create sampling plan" });
    }
  });

  // Update sampling plan
  app.patch("/api/sampling-plans/:id", requireRole('internal_verifier', 'admin', 'super_admin'), async (req, res) => {
    try {
      const validatedData = insertSamplingPlanSchema.partial().parse(req.body);
      const plan = await storage.updateSamplingPlan(req.params.id, validatedData);
      if (!plan) {
        return res.status(404).json({ error: "Sampling plan not found" });
      }
      res.json(plan);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Error updating sampling plan:", error);
      res.status(500).json({ error: "Failed to update sampling plan" });
    }
  });

  // Delete sampling plan
  app.delete("/api/sampling-plans/:id", requireRole('admin', 'super_admin'), async (req, res) => {
    try {
      const success = await storage.deleteSamplingPlan(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Sampling plan not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting sampling plan:", error);
      res.status(500).json({ error: "Failed to delete sampling plan" });
    }
  });

  // ========================================
  // VERIFICATION ENDPOINTS
  // ========================================

  // Get verifications
  app.get("/api/verifications", requireRole('admin', 'super_admin', 'internal_verifier'), async (req, res) => {
    try {
      const { assessmentId, verifierId } = req.query;
      const currentUserId = req.user?.claims?.sub;
      const userRole = normalizeRole(req.user?.claims?.role || 'candidate');
      const isAdmin = ['admin', 'super_admin'].includes(userRole);
      
      // Verifiers can only see their own verifications unless admin
      if (verifierId && verifierId !== currentUserId && !isAdmin) {
        return res.status(403).json({ error: "Not authorized to view other verifiers' verifications" });
      }
      
      const verifications = await storage.getVerifications(
        assessmentId as string,
        verifierId as string
      );
      res.json(verifications);
    } catch (error) {
      console.error("Error fetching verifications:", error);
      res.status(500).json({ error: "Failed to fetch verifications" });
    }
  });

  // Get unverified assessments for a verifier
  app.get("/api/verifiers/:id/unverified-assessments", requireRole('admin', 'super_admin', 'internal_verifier'), async (req, res) => {
    try {
      const currentUserId = req.user?.claims?.sub;
      const userRole = normalizeRole(req.user?.claims?.role || 'candidate');
      const isAdmin = ['admin', 'super_admin'].includes(userRole);
      
      // Verifiers can only see their own unverified assessments unless admin
      if (req.params.id !== currentUserId && !isAdmin) {
        return res.status(403).json({ error: "Not authorized to view other verifiers' unverified assessments" });
      }
      
      const assessments = await storage.getUnverifiedAssessments(req.params.id);
      res.json(assessments);
    } catch (error) {
      console.error("Error fetching unverified assessments:", error);
      res.status(500).json({ error: "Failed to fetch unverified assessments" });
    }
  });

  // Get verification statistics
  app.get("/api/verifiers/:id/statistics", requireRole('admin', 'super_admin', 'internal_verifier'), async (req, res) => {
    try {
      const { assessorId } = req.query;
      const currentUserId = req.user?.claims?.sub;
      const userRole = normalizeRole(req.user?.claims?.role || 'candidate');
      const isAdmin = ['admin', 'super_admin'].includes(userRole);
      
      // Verifiers can only see their own statistics unless admin
      if (req.params.id !== currentUserId && !isAdmin) {
        return res.status(403).json({ error: "Not authorized to view other verifiers' statistics" });
      }
      
      const stats = await storage.getVerificationStatistics(
        req.params.id,
        assessorId as string
      );
      res.json(stats);
    } catch (error) {
      console.error("Error fetching verification statistics:", error);
      res.status(500).json({ error: "Failed to fetch verification statistics" });
    }
  });

  // Create verification
  app.post("/api/verifications", requireRole('internal_verifier', 'admin', 'super_admin'), async (req, res) => {
    try {
      const userId = req.user?.claims?.sub;
      
      // Validate the input data
      const validatedData = insertVerificationSchema.parse({
        ...req.body,
        verifierId: userId, // Always use authenticated user as verifier
        verificationDate: new Date(),
      });
      
      const verification = await storage.createVerification(validatedData);
      res.status(201).json(verification);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Error creating verification:", error);
      res.status(500).json({ error: "Failed to create verification" });
    }
  });

  // Update verification
  app.patch("/api/verifications/:id", requireRole('internal_verifier', 'admin', 'super_admin'), async (req, res) => {
    try {
      const currentUserId = req.user?.claims?.sub;
      const userRole = normalizeRole(req.user?.claims?.role || 'candidate');
      const isAdmin = ['admin', 'super_admin'].includes(userRole);
      
      // Check ownership if not admin
      if (!isAdmin) {
        const existing = await storage.getVerification(req.params.id);
        if (!existing) {
          return res.status(404).json({ error: "Verification not found" });
        }
        if (existing.verifierId !== currentUserId) {
          return res.status(403).json({ error: "Not authorized to update this verification" });
        }
      }
      
      const validatedData = insertVerificationSchema.partial().parse(req.body);
      const verification = await storage.updateVerification(req.params.id, validatedData);
      if (!verification) {
        return res.status(404).json({ error: "Verification not found" });
      }
      res.json(verification);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Error updating verification:", error);
      res.status(500).json({ error: "Failed to update verification" });
    }
  });

  // Delete verification
  app.delete("/api/verifications/:id", requireRole('admin', 'super_admin'), async (req, res) => {
    try {
      const success = await storage.deleteVerification(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Verification not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting verification:", error);
      res.status(500).json({ error: "Failed to delete verification" });
    }
  });

  // Seed test data - Admin only
  app.post("/api/admin/seed-data", isAuthenticated, requireRole('developer', 'admin', 'super_admin'), async (req, res) => {
    try {
      const currentUserId = req.user?.claims?.sub;
      
      // Get existing competency elements to assign
      const elements = await storage.getCompetencyElements();
      if (elements.length === 0) {
        return res.status(400).json({ 
          error: "No competency elements found. Please create some competency elements first." 
        });
      }

      // Create test candidates (users with candidate role)
      const candidateNames = [
        { firstName: "Sarah", lastName: "Johnson", email: "sarah.johnson@example.com" },
        { firstName: "Michael", lastName: "Chen", email: "michael.chen@example.com" },
        { firstName: "Emma", lastName: "Williams", email: "emma.williams@example.com" },
        { firstName: "James", lastName: "Brown", email: "james.brown@example.com" },
        { firstName: "Olivia", lastName: "Davis", email: "olivia.davis@example.com" },
        { firstName: "William", lastName: "Garcia", email: "william.garcia@example.com" },
        { firstName: "Sophia", lastName: "Rodriguez", email: "sophia.rodriguez@example.com" },
        { firstName: "Benjamin", lastName: "Martinez", email: "benjamin.martinez@example.com" },
      ];

      const locations = ["London", "Manchester", "Birmingham", "Edinburgh", "Glasgow"];
      const jobRoles = ["Senior Engineer", "Engineer", "Junior Engineer", "Technician", "Specialist"];

      const createdData = {
        candidates: [] as any[],
        allocations: [] as any[],
        assessments: [] as any[],
      };

      // Create candidate users and allocations
      for (const candidate of candidateNames) {
        // Create or get candidate user
        let candidateUser = await storage.getUserByEmail(candidate.email);
        if (!candidateUser) {
          candidateUser = await storage.upsertUser({
            id: `test-candidate-${candidate.email}`,
            email: candidate.email,
            firstName: candidate.firstName,
            lastName: candidate.lastName,
            role: "candidate",
          });
        }
        createdData.candidates.push(candidateUser);

        // Create allocation to current assessor
        const allocation = await storage.createCandidateAllocation({
          assessorId: currentUserId,
          candidateId: candidateUser.id,
          location: locations[Math.floor(Math.random() * locations.length)],
          jobRole: jobRoles[Math.floor(Math.random() * jobRoles.length)],
          isActive: true,
        });
        createdData.allocations.push(allocation);

        // Create 2-4 assessments for each candidate with varying statuses
        const numAssessments = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < numAssessments && i < elements.length; i++) {
          const element = elements[i];
          
          // Random outcome
          const outcomes = ["competent", "not_yet_competent", "competent_with_minor_needs"];
          const outcome = outcomes[Math.floor(Math.random() * outcomes.length)] as any;
          
          // Random date in the past (0-24 months ago)
          const monthsAgo = Math.floor(Math.random() * 24);
          const assessmentDate = new Date();
          assessmentDate.setMonth(assessmentDate.getMonth() - monthsAgo);
          
          // Expiry date based on element's reassessment period or default 3 years
          let expiryDate: Date | null = null;
          if (outcome === "competent") {
            expiryDate = new Date(assessmentDate);
            expiryDate.setFullYear(
              expiryDate.getFullYear() + (element.reassessYears || 3)
            );
          }

          const assessment = await storage.createAssessment({
            candidateId: candidateUser.id,
            assessorId: currentUserId,
            elementId: element.id,
            assessmentDate: assessmentDate.toISOString(),
            outcome,
            expiryDate: expiryDate?.toISOString() || null,
            notes: `Test assessment for ${element.name}`,
            isActive: true,
          });
          createdData.assessments.push(assessment);
        }
      }

      res.json({
        message: "Test data created successfully",
        summary: {
          candidates: createdData.candidates.length,
          allocations: createdData.allocations.length,
          assessments: createdData.assessments.length,
        },
        data: createdData,
      });
    } catch (error) {
      console.error("Error seeding test data:", error);
      res.status(500).json({ error: "Failed to create test data" });
    }
  });

  // Notification Settings API
  app.get("/api/admin/notification-settings", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as { id: string; role: string };
      if (!hasRole(user.role, 'admin')) {
        return res.status(403).json({ error: "Admin access required" });
      }

      const settings = await storage.getNotificationSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching notification settings:", error);
      res.status(500).json({ error: "Failed to fetch notification settings" });
    }
  });

  app.post("/api/admin/notification-settings", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as { id: string; role: string };
      if (!hasRole(user.role, 'admin')) {
        return res.status(403).json({ error: "Admin access required" });
      }

      const setting = await storage.createNotificationSetting(req.body);
      res.status(201).json(setting);
    } catch (error) {
      console.error("Error creating notification setting:", error);
      res.status(500).json({ error: "Failed to create notification setting" });
    }
  });

  app.put("/api/admin/notification-settings/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as { id: string; role: string };
      if (!hasRole(user.role, 'admin')) {
        return res.status(403).json({ error: "Admin access required" });
      }

      const setting = await storage.updateNotificationSetting(req.params.id, req.body);
      if (!setting) {
        return res.status(404).json({ error: "Notification setting not found" });
      }
      res.json(setting);
    } catch (error) {
      console.error("Error updating notification setting:", error);
      res.status(500).json({ error: "Failed to update notification setting" });
    }
  });

  app.delete("/api/admin/notification-settings/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as { id: string; role: string };
      if (!hasRole(user.role, 'admin')) {
        return res.status(403).json({ error: "Admin access required" });
      }

      const deleted = await storage.deleteNotificationSetting(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Notification setting not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting notification setting:", error);
      res.status(500).json({ error: "Failed to delete notification setting" });
    }
  });

  // Notification Logs API
  app.get("/api/admin/notification-logs", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as { id: string; role: string };
      if (!hasRole(user.role, 'admin')) {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { recipientId, status, settingId } = req.query;
      const logs = await storage.getNotificationLogs({
        recipientId: recipientId as string,
        status: status as string,
        settingId: settingId as string,
      });
      res.json(logs);
    } catch (error) {
      console.error("Error fetching notification logs:", error);
      res.status(500).json({ error: "Failed to fetch notification logs" });
    }
  });

  // Manual notification trigger
  app.post("/api/admin/notifications/send-now", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as { id: string; role: string };
      if (!hasRole(user.role, 'admin')) {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { notificationService } = await import('./services/notificationService');
      const result = await notificationService.runScheduledNotifications();
      res.json(result);
    } catch (error) {
      console.error("Error sending notifications:", error);
      res.status(500).json({ error: "Failed to send notifications" });
    }
  });

  return httpServer;
}
