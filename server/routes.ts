import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import csv from "csv-parser";
import * as XLSX from "xlsx";
import { Readable } from "stream";
import type { IStorage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import {
  insertUserSchema,
  insertCompetencyCategorySchema,
  insertCompetencyElementSchema,
  insertCompetencySchema,
  insertCompetenceSubcategorySchema,
  insertCompetenceCriteriaSchema,
  bulkCompetenceCriteriaSchema,
  insertJobRoleSchema,
  insertCompetencyLevelSchema,
  insertRoleElementSchema,
  insertRoleElementLevelSchema,
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
import { emailService } from "./services/emailService";
import { z } from "zod";
import { db } from "./db";
import { sql } from "drizzle-orm";

// Helper function to parse assessment methods string into array
function parseAssessmentMethods(methodsString: string): ('K' | 'KE' | 'KP' | 'T')[] {
  if (!methodsString || typeof methodsString !== 'string') return [];
  
  return methodsString
    .split(/[,;|\s]+/)
    .map(method => method.trim().toUpperCase())
    .filter(method => ['K', 'KE', 'KP', 'T'].includes(method)) as ('K' | 'KE' | 'KP' | 'T')[];
}

export async function registerRoutes(app: Express, deps: { storage: IStorage }): Promise<Server> {
  // Extract injected dependencies
  const { storage } = deps;
  
  // Storage instance successfully injected
  
  // Authentication middleware setup
  await setupAuth(app, storage);

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
      
      // Get the real authenticated user ID
      const realUserId = req.user.claims.sub;
      const realUser = await storage.getUser(realUserId);
      
      if (!realUser) {
        return res.status(403).json({ message: "User not found" });
      }
      
      // Determine which role to check based on impersonation
      const impersonatedUserId = req.session?.impersonatedUserId;
      let effectiveUser = realUser;
      
      // If impersonating, get the impersonated user
      if (impersonatedUserId) {
        const impersonatedUser = await storage.getUser(impersonatedUserId);
        if (impersonatedUser) {
          effectiveUser = impersonatedUser;
        }
      }
      
      // Determine if this is an admin-only route or a data-access route
      // Admin-only routes: check real user's role (even when impersonating)
      // Data-access routes: check impersonated user's role (candidate, trainee, assessor routes)
      const allowedRoles = roles.map(normalizeRole);
      const hasNonAdminRoles = allowedRoles.some(r => ['candidate', 'trainee', 'assessor'].includes(r));
      const isAdminOnlyRoute = !hasNonAdminRoles;
      
      let roleToCheck = effectiveUser.role;
      if (isAdminOnlyRoute && impersonatedUserId) {
        // For admin-only routes while impersonating, use real user's role
        roleToCheck = realUser.role;
      }
      
      // Normalize role for comparison
      const userRole = normalizeRole(roleToCheck);
      
      // Super admin always has access (check real user for this)
      if (normalizeRole(realUser.role) === 'super_admin' || allowedRoles.includes(userRole)) {
        req.currentUser = effectiveUser;
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
      
      // Get the real authenticated user ID
      const realUserId = req.user.claims.sub;
      const realUser = await storage.getUser(realUserId);
      
      if (!realUser) {
        return res.status(403).json({ message: "User not found" });
      }
      
      // When impersonating, use the real user's role for authorization
      const roleToCheck = realUser.role; // Always use real user's role for permissions
      
      // Normalize role for comparison
      const userRole = normalizeRole(roleToCheck);
      const allowedRoles = roles.map(normalizeRole);
      
      // Super admin or specified roles always have access
      if (userRole === 'super_admin' || allowedRoles.includes(userRole)) {
        req.currentUser = realUser;
        return next();
      }
      
      // For ID-based routes, check certificate ownership
      // When impersonating, check against the impersonated user's ID
      const effectiveUserId = req.session?.impersonatedUserId || realUserId;
      if (req.params.id) {
        const certificate = await storage.getTrainingCertificate(req.params.id);
        if (certificate && certificate.userId === effectiveUserId) {
          req.currentUser = realUser;
          return next();
        }
      }
      
      // For body-based routes (POST), check userId in body
      if (req.body.userId === effectiveUserId) {
        req.currentUser = realUser;
        return next();
      }
      
      return res.status(403).json({ message: "Insufficient permissions" });
    };
  }

  // Authentication routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      // Check if user is impersonating
      const impersonatedUserId = req.session.impersonatedUserId;
      const userId = impersonatedUserId || req.user.claims.sub;
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Add impersonation flag to response
      const response: any = { ...user };
      if (impersonatedUserId) {
        response.isImpersonating = true;
        response.realUserId = req.user.claims.sub;
        
        // Include real user's role for permission checking
        const realUser = await storage.getUser(req.user.claims.sub);
        if (realUser) {
          response.realUserRole = realUser.role;
        }
      }
      
      res.json(response);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Impersonation endpoints - Developer/Admin only
  app.post('/api/auth/impersonate', isAuthenticated, requireRole('developer', 'admin', 'super_admin'), async (req: any, res) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }

      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }

      req.session.impersonatedUserId = userId;
      res.json({ message: "Now impersonating user", user: targetUser });
    } catch (error) {
      console.error("Error impersonating user:", error);
      res.status(500).json({ error: "Failed to impersonate user" });
    }
  });

  app.post('/api/auth/stop-impersonating', isAuthenticated, async (req: any, res) => {
    try {
      delete req.session.impersonatedUserId;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json({ message: "Stopped impersonating", user });
    } catch (error) {
      console.error("Error stopping impersonation:", error);
      res.status(500).json({ error: "Failed to stop impersonation" });
    }
  });

  app.get('/api/auth/test-users', isAuthenticated, requireRole('developer', 'admin', 'super_admin'), async (req: any, res) => {
    try {
      // Get test users (those with IDs starting with 'test-') and manually created users (starting with 'manual-')
      const allUsers = await storage.getAllUsers();
      const testUsers = allUsers.filter(u => u.id.startsWith('test-') || u.id.startsWith('manual-'));
      res.json(testUsers);
    } catch (error) {
      console.error("Error fetching test users:", error);
      res.status(500).json({ error: "Failed to fetch test users" });
    }
  });

  app.post('/api/auth/setup-test-scenario', isAuthenticated, requireRole('developer', 'admin', 'super_admin'), async (req: any, res) => {
    try {
      // Create test assessor - Sarah
      const assessorId = 'test-assessor-001';
      await storage.upsertUser({
        id: assessorId,
        email: 'test.assessor@example.com',
        firstName: 'Sarah',
        lastName: 'Assessor',
        role: 'assessor',
      });

      // Create test assessor - Mike Johnson
      const mikeJohnsonId = 'test-assessor-mike-johnson';
      await storage.upsertUser({
        id: mikeJohnsonId,
        email: 'mike.johnson@example.com',
        firstName: 'Mike',
        lastName: 'Johnson',
        role: 'assessor',
      });

      // Create test candidate
      const candidateId = 'test-candidate-001';
      await storage.upsertUser({
        id: candidateId,
        email: 'test.candidate@example.com',
        firstName: 'John',
        lastName: 'Trainee',
        role: 'candidate',
        location: 'Workshop Floor',
        dateOfBirth: new Date('1995-06-15'),
        companyNumber: 'EMP-12345',
      });

      // Get a job role to assign
      const jobRoles = await storage.getJobRoles();
      let jobRole = jobRoles.find((jr: any) => jr.code === 'EL01');
      
      if (jobRole) {
        // Assign job role to candidate
        await storage.updateUser(candidateId, { jobRoleId: jobRole.id });

        // Get competence elements for this job role
        const roleElements = await storage.getRoleElements(jobRole.id);
        
        // Create assessments for each element
        for (const roleElement of roleElements) {
          await storage.createAssessment({
            candidateId: candidateId,
            elementId: roleElement.elementId,
            outcome: 'not_yet_competent',
            assessorId: assessorId,
            assessmentDate: new Date(),
          });
        }

        // Update a few assessments to different outcomes for variety
        const assessments = await storage.getAssessments(candidateId);
        if (assessments.length > 0) {
          // Make one competent
          if (assessments[0]) {
            await storage.updateAssessment(assessments[0].id, {
              outcome: 'competent',
              assessorComments: 'Successfully demonstrated all required skills',
              assessmentDate: new Date(),
            });
          }
          // Make one competent with minor needs
          if (assessments[1]) {
            await storage.updateAssessment(assessments[1].id, {
              outcome: 'competent_with_minor_needs',
              assessorComments: 'Competent overall, but could improve documentation skills',
              assessmentDate: new Date(),
            });
          }
        }
      }

      // Create candidate allocation (assign candidate to assessor)
      const existingAllocation = await storage.getCandidateAllocations(assessorId, candidateId);
      if (existingAllocation.length === 0) {
        await storage.createCandidateAllocation({
          candidateId,
          assessorId,
        });
      }

      res.json({
        message: "Test scenario created successfully",
        assessors: [
          { id: assessorId, email: 'test.assessor@example.com', name: 'Sarah Assessor' },
          { id: mikeJohnsonId, email: 'mike.johnson@example.com', name: 'Mike Johnson' }
        ],
        candidate: { id: candidateId, email: 'test.candidate@example.com' },
        jobRole: jobRole?.name || 'No job role assigned',
      });
    } catch (error) {
      console.error("Error setting up test scenario:", error);
      res.status(500).json({ error: "Failed to setup test scenario" });
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
      
      // Get the existing user to check if jobRoleId is changing
      const existingUser = await storage.getUser(targetUserId);
      if (!existingUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const userData = { ...req.body };
      
      // Convert dateOfBirth string to Date object if present
      if (userData.dateOfBirth && typeof userData.dateOfBirth === 'string') {
        userData.dateOfBirth = new Date(userData.dateOfBirth);
      }
      
      // Check if jobRoleId is changing
      const isJobRoleChanging = userData.jobRoleId && userData.jobRoleId !== existingUser.jobRoleId;
      
      const user = await storage.updateUser(req.params.id, userData);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // If job role was assigned/changed, create assessments and training enrollments
      if (isJobRoleChanging && userData.jobRoleId) {
        await storage.assignJobRoleToUser(targetUserId, userData.jobRoleId, currentUserId);
      }
      
      res.json(user);
    } catch (error: any) {
      console.error("Error updating user:", error);
      
      // Check if it's a unique constraint violation for email
      if (error?.code === '23505' && error?.constraint === 'users_email_unique') {
        return res.status(400).json({ error: "This email address is already in use by another account" });
      }
      
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  // Delete user (soft delete)
  app.delete('/api/users/:id', isAuthenticated, requireRole('admin', 'super_admin'), async (req, res) => {
    try {
      const success = await storage.deleteUser(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "User not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // Archive user
  app.post('/api/users/:id/archive', isAuthenticated, requireRole('admin', 'super_admin'), async (req, res) => {
    try {
      const user = await storage.updateUser(req.params.id, { isArchived: true });
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ success: true, message: "User archived successfully", user });
    } catch (error) {
      console.error("Error archiving user:", error);
      res.status(500).json({ error: "Failed to archive user" });
    }
  });

  // Reactivate user
  app.post('/api/users/:id/reactivate', isAuthenticated, requireRole('admin', 'super_admin'), async (req, res) => {
    try {
      const user = await storage.updateUser(req.params.id, { isArchived: false });
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ success: true, message: "User reactivated successfully", user });
    } catch (error) {
      console.error("Error reactivating user:", error);
      res.status(500).json({ error: "Failed to reactivate user" });
    }
  });

  // Bulk delete users
  app.post('/api/users/bulk-delete', isAuthenticated, requireRole('admin', 'super_admin'), async (req, res) => {
    try {
      const { userIds } = req.body;
      
      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ error: "userIds array is required" });
      }

      const results = await storage.bulkDeleteUsers(userIds);

      res.json({ 
        success: true,
        deleted: results.deleted,
        failed: results.failed,
        total: userIds.length,
        errors: results.errors
      });
    } catch (error) {
      console.error("Error bulk deleting users:", error);
      res.status(500).json({ error: "Failed to bulk delete users" });
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
      const { firstName, lastName, email, role, location, teamShift, jobRoleId, dateOfBirth, companyNumber } = req.body;
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
      if (teamShift && teamShift.trim()) {
        userData.teamShift = teamShift.trim();
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
      const { userIds, elementId, levelId } = req.body;
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

      // If levelId provided, verify it exists and belongs to this element
      if (levelId) {
        const level = await storage.getCompetencyLevel(levelId);
        if (!level) {
          return res.status(404).json({ error: "Competency level not found" });
        }
        if (level.elementId !== elementId) {
          return res.status(400).json({ error: "Level does not belong to the selected element" });
        }
      }

      const result = await storage.bulkAssignCompetenceElement(userIds, elementId, currentUserId, levelId);

      res.json({
        message: "Bulk element assignment completed",
        ...result,
      });
    } catch (error) {
      console.error("Error in bulk element assignment:", error);
      res.status(500).json({ error: "Failed to perform bulk element assignment" });
    }
  });

  app.post('/api/admin/bulk-assign-training', isAuthenticated, requireRole('admin', 'super_admin'), async (req: any, res) => {
    try {
      const { userIds, trainingId } = req.body;
      const currentUserId = req.user?.claims?.sub;

      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ error: "userIds must be a non-empty array" });
      }

      if (!trainingId) {
        return res.status(400).json({ error: "trainingId is required" });
      }

      // Verify training exists
      const training = await storage.getTraining(trainingId);
      if (!training) {
        return res.status(404).json({ error: "Training not found" });
      }

      const result = await storage.bulkAssignTraining(userIds, trainingId, currentUserId);

      const messageParts = [];
      if (result.successful > 0) messageParts.push(`${result.successful} newly enrolled`);
      if (result.skipped > 0) messageParts.push(`${result.skipped} already enrolled`);
      if (result.failed.length > 0) messageParts.push(`${result.failed.length} failed`);
      
      res.json({
        message: `Bulk training assignment completed: ${messageParts.join(', ')}`,
        ...result,
      });
    } catch (error) {
      console.error("Error in bulk training assignment:", error);
      res.status(500).json({ error: "Failed to perform bulk training assignment" });
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
        'Team/Shift (Optional)',
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
        'Team/Shift (Optional)': 'Day Shift',
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
          teamShift: row['Team/Shift (Optional)'] || undefined,
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

  // Competency Levels CRUD
  app.get("/api/competency-levels", isAuthenticated, async (req, res) => {
    try {
      const { elementId } = req.query;
      const levels = await storage.getCompetencyLevels(elementId as string);
      res.json(levels);
    } catch (error) {
      console.error("Error fetching competency levels:", error);
      res.status(500).json({ error: "Failed to fetch competency levels" });
    }
  });

  app.get("/api/competency-levels/:id", isAuthenticated, async (req, res) => {
    try {
      const level = await storage.getCompetencyLevel(req.params.id);
      if (!level) {
        return res.status(404).json({ error: "Competency level not found" });
      }
      res.json(level);
    } catch (error) {
      console.error("Error fetching competency level:", error);
      res.status(500).json({ error: "Failed to fetch competency level" });
    }
  });

  app.post("/api/competency-levels", isAuthenticated, requireRole('admin', 'super_admin'), async (req, res) => {
    try {
      const validatedData = insertCompetencyLevelSchema.parse(req.body);
      const level = await storage.createCompetencyLevel(validatedData);
      res.status(201).json(level);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error creating competency level:", error);
      res.status(500).json({ error: "Failed to create competency level" });
    }
  });

  app.patch("/api/competency-levels/:id", isAuthenticated, requireRole('admin', 'super_admin'), async (req, res) => {
    try {
      const partialData = insertCompetencyLevelSchema.partial().parse(req.body);
      const level = await storage.updateCompetencyLevel(req.params.id, partialData);
      if (!level) {
        return res.status(404).json({ error: "Competency level not found" });
      }
      res.json(level);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error updating competency level:", error);
      res.status(500).json({ error: "Failed to update competency level" });
    }
  });

  app.delete("/api/competency-levels/:id", isAuthenticated, requireRole('admin', 'super_admin'), async (req, res) => {
    try {
      const success = await storage.deleteCompetencyLevel(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Competency level not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting competency level:", error);
      res.status(500).json({ error: "Failed to delete competency level" });
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
      const { elementId, type } = req.query;
      const subcategories = await storage.getCompetenceSubcategories(
        elementId as string || undefined,
        type as 'knowledge' | 'performance' || undefined
      );
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

  // Bulk criteria creation endpoint
  app.post("/api/competence-criteria/bulk", async (req, res) => {
    try {
      const validatedData = bulkCompetenceCriteriaSchema.parse(req.body);
      const criteria = await storage.createBulkCompetenceCriteria(validatedData);
      res.status(201).json(criteria);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error creating bulk competence criteria:", error);
      res.status(500).json({ error: "Failed to create bulk competence criteria" });
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
      const levelId = req.query.levelId as string | undefined; // Optional: filter by proficiency level
      
      // Validate role
      if (!['assessor', 'candidate'].includes(role)) {
        return res.status(400).json({ error: "Role must be 'assessor' or 'candidate'" });
      }

      // Fetch element details
      const element = await storage.getCompetencyElement(elementId);
      if (!element) {
        return res.status(404).json({ error: "Element not found" });
      }

      // Fetch criteria for this element, optionally filtered by levelId
      let allCriteria = await storage.getCompetenceCriteria({ elementId });
      
      // If levelId is specified, filter criteria to only show those for that level
      // CRITICAL: Levels are INDEPENDENT - if levelId=intermediate, only show intermediate criteria
      if (levelId) {
        allCriteria = allCriteria.filter(c => c.levelId === levelId);
      }
      
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
      
      // Define the template data with CORRECT A-J column mapping
      // Column G = Assessment Criteria (THE KEY FIELD)
      // Column H = Assessor Guidance
      // Column I = Criticality Rating
      // Column J = Required (M/O)
      const templateData = [
        // Header row - EXACT column mapping as expected by import
        ['Category', 'Element', 'Subcategory', 'Type', 'Level Terms', 'Proficiency Levels', 'Assessment Criteria', 'Assessor Guidance', 'Criticality', 'Required'],
        // Example rows - SIMOPS (HSE category)
        ['HSE', 'SIMOPS', 'General', 'K', 'Novice,Competent,Proficient,Expert', '4', 'What is SIMOPS and why is it critical for safety?', 'Candidate should explain Simultaneous Operations concept and safety importance', 'High', 'M'],
        ['HSE', 'SIMOPS', 'Planning', 'P', 'Basic,Competent,Advanced', '3', 'Plan and coordinate simultaneous operations safely', 'Check candidate can identify hazards and create safe work plans', 'High', 'M'],
        ['HSE', 'SIMOPS', 'Execution', 'P', '', '', 'Execute simultaneous operations following safety protocols', 'Verify candidate follows procedures during shutdown/power-on', 'High', 'M'],
        // Example rows - Maintenance-Instrumentation (Technical category)
        ['Technical', 'Maintenance', 'Preventive', 'K', 'Beginner,Intermediate,Advanced,Expert', '4', 'Schedule and plan preventive maintenance activities', 'Assess knowledge of maintenance scheduling principles', 'Medium', 'M'],
        ['Technical', 'Maintenance', 'Corrective', 'P', '', '', 'Execute corrective maintenance on instrumentation', 'Verify troubleshooting and repair skills', 'Medium', 'M'],
        // Note: Blank cells use fill-down from previous row (category, element, type, proficiency levels)
      ];
      
      // Create worksheet from data
      const worksheet = XLSX.utils.aoa_to_sheet(templateData);
      
      // Set column widths for better visibility
      worksheet['!cols'] = [
        { wch: 15 }, // A: Category
        { wch: 20 }, // B: Element
        { wch: 15 }, // C: Subcategory
        { wch: 8 },  // D: Type (K/P)
        { wch: 25 }, // E: Level Terms
        { wch: 12 }, // F: Proficiency Levels (1/3/4)
        { wch: 50 }, // G: Assessment Criteria (KEY FIELD)
        { wch: 50 }, // H: Assessor Guidance
        { wch: 12 }, // I: Criticality
        { wch: 10 }, // J: Required (M/O)
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
      // Parse Excel file using DIRECT COLUMN-INDEX MAPPING (A-J)
      else if (fileName.endsWith('.xlsx')) {
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Use header:1 to get array format for deterministic column-position mapping
        const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        // Skip header row and map by exact column positions (0=A, 1=B, etc.)
        rows = rawData.slice(1).map(row => ({
          __columnA: row[0],  // Column A: Category
          __columnB: row[1],  // Column B: Element
          __columnC: row[2],  // Column C: Subcategory
          __columnD: row[3],  // Column D: Type
          __columnE: row[4],  // Column E: Level Terms
          __columnF: row[5],  // Column F: Proficiency Levels
          __columnG: row[6],  // Column G: Assessment Criteria
          __columnH: row[7],  // Column H: Assessor Guidance
          __columnI: row[8],  // Column I: Criticality
          __columnJ: row[9],  // Column J: Required
        }));
      } else {
        return res.status(400).json({ message: "Unsupported file format. Please upload CSV or XLSX files." });
      }

      if (rows.length === 0) {
        return res.status(400).json({ message: "No data found in the uploaded file" });
      }

      console.log(`[ROUTES DEBUG] Parsed ${rows.length} raw rows from file`);
      console.log(`[ROUTES DEBUG] First row sample:`, JSON.stringify(rows[0]));

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
      };

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNumber = i + 2; // Excel rows start at 2 (after header)

        try {
          // Helper to safely extract and trim values
          const safeExtract = (value: any): string => {
            return typeof value === 'string' ? value.trim() : String(value || '').trim();
          };

          // DETERMINISTIC COLUMN MAPPING by position - no header matching ambiguity
          const rawCategory = safeExtract(row.__columnA);      // Column A: Category
          const rawElement = safeExtract(row.__columnB);       // Column B: Element
          const rawSubcategory = safeExtract(row.__columnC);   // Column C: Subcategory
          const rawTypeField = safeExtract(row.__columnD);     // Column D: Type (K/P)
          const rawLevelTerms = safeExtract(row.__columnE);    // Column E: Level Terms
          const rawProfLevels = safeExtract(row.__columnF);    // Column F: Proficiency Levels
          const rawDescription = safeExtract(row.__columnG);   // Column G: Assessment Criteria *** CRITICAL ***
          const rawAssessorGuidance = safeExtract(row.__columnH); // Column H: Assessor Guidance
          const rawCriticality = safeExtract(row.__columnI);   // Column I: Criticality
          const rawRequired = safeExtract(row.__columnJ);      // Column J: Required (M/O)

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

          // Skip rows with no Assessment Criteria (Column G) - these are empty criteria rows
          if (!rawDescription) {
            // Update fill-down state for next row but don't process this row
            fillDownState = { category, element, type, subcategory, proficiencyLevels, criticality };
            continue;
          }

          // Update fill-down state
          fillDownState = { category, element, type, subcategory, proficiencyLevels, criticality };

          const mappedRow = {
            category,
            element,
            subcategory,
            type,
            levelTerm: rawLevelTerms || '',  // Column E: Level Terms (Basic, Intermediate, Advanced, etc.)
            proficiencyLevels,
            description: rawDescription,  // Column G: Assessment Criteria
            assessorGuidance: rawAssessorGuidance || '',  // Column H: Assessor Guidance
            criticality,
            required: (rawRequired || 'M') as 'O' | 'M',  // Column J: Required (M/O)
            assessmentMethods: parseAssessmentMethods(''),  // Legacy field, kept for compatibility
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
      console.log(`[ROUTES DEBUG] After validation: ${validatedRows.length} validated rows, ${validationErrors.length} errors, ${warnings.length} warnings`);
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

  // ============================================================================
  // COMPETENCY LEVELS ROUTES
  // ============================================================================

  app.get("/api/competency-levels", async (req, res) => {
    try {
      const { elementId } = req.query;
      const levels = await storage.getCompetencyLevels(elementId as string | undefined);
      res.json(levels);
    } catch (error) {
      console.error("Error fetching competency levels:", error);
      res.status(500).json({ error: "Failed to fetch competency levels" });
    }
  });

  app.get("/api/competency-levels/:id", async (req, res) => {
    try {
      const level = await storage.getCompetencyLevel(req.params.id);
      if (!level) {
        return res.status(404).json({ error: "Competency level not found" });
      }
      res.json(level);
    } catch (error) {
      console.error("Error fetching competency level:", error);
      res.status(500).json({ error: "Failed to fetch competency level" });
    }
  });

  app.post("/api/competency-levels", isAuthenticated, requireRole('admin', 'developer'), async (req, res) => {
    try {
      const validatedData = insertCompetencyLevelSchema.parse(req.body);
      const level = await storage.createCompetencyLevel(validatedData);
      res.status(201).json(level);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error creating competency level:", error);
      res.status(500).json({ error: "Failed to create competency level" });
    }
  });

  app.patch("/api/competency-levels/:id", isAuthenticated, requireRole('admin', 'developer'), async (req, res) => {
    try {
      const partialData = insertCompetencyLevelSchema.partial().parse(req.body);
      const level = await storage.updateCompetencyLevel(req.params.id, partialData);
      if (!level) {
        return res.status(404).json({ error: "Competency level not found" });
      }
      res.json(level);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error updating competency level:", error);
      res.status(500).json({ error: "Failed to update competency level" });
    }
  });

  app.delete("/api/competency-levels/:id", isAuthenticated, requireRole('admin', 'developer'), async (req, res) => {
    try {
      const success = await storage.deleteCompetencyLevel(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Competency level not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting competency level:", error);
      res.status(500).json({ error: "Failed to delete competency level" });
    }
  });

  // ============================================================================
  // ROLE ELEMENT LEVELS ROUTES
  // ============================================================================

  app.get("/api/role-element-levels", async (req, res) => {
    try {
      const { roleId, elementId } = req.query;
      const roleElementLevels = await storage.getRoleElementLevels(
        roleId as string | undefined,
        elementId as string | undefined
      );
      res.json(roleElementLevels);
    } catch (error) {
      console.error("Error fetching role element levels:", error);
      res.status(500).json({ error: "Failed to fetch role element levels" });
    }
  });

  app.get("/api/role-element-levels/:id", async (req, res) => {
    try {
      const roleElementLevel = await storage.getRoleElementLevel(req.params.id);
      if (!roleElementLevel) {
        return res.status(404).json({ error: "Role element level not found" });
      }
      res.json(roleElementLevel);
    } catch (error) {
      console.error("Error fetching role element level:", error);
      res.status(500).json({ error: "Failed to fetch role element level" });
    }
  });

  app.post("/api/role-element-levels", isAuthenticated, requireRole('admin', 'developer'), async (req, res) => {
    try {
      const validatedData = insertRoleElementLevelSchema.parse(req.body);
      const roleElementLevel = await storage.createRoleElementLevel(validatedData);
      res.status(201).json(roleElementLevel);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error creating role element level:", error);
      res.status(500).json({ error: "Failed to create role element level" });
    }
  });

  app.post("/api/role-element-levels/bulk", isAuthenticated, requireRole('admin', 'developer'), async (req, res) => {
    try {
      const { roleElementLevels } = req.body;
      if (!Array.isArray(roleElementLevels)) {
        return res.status(400).json({ error: "roleElementLevels must be an array" });
      }
      const validatedLevels = roleElementLevels.map(rel => insertRoleElementLevelSchema.parse(rel));
      const created = await storage.bulkCreateRoleElementLevels(validatedLevels);
      res.status(201).json(created);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error bulk creating role element levels:", error);
      res.status(500).json({ error: "Failed to bulk create role element levels" });
    }
  });

  app.patch("/api/role-element-levels/:id", isAuthenticated, requireRole('admin', 'developer'), async (req, res) => {
    try {
      const partialData = insertRoleElementLevelSchema.partial().parse(req.body);
      const roleElementLevel = await storage.updateRoleElementLevel(req.params.id, partialData);
      if (!roleElementLevel) {
        return res.status(404).json({ error: "Role element level not found" });
      }
      res.json(roleElementLevel);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error updating role element level:", error);
      res.status(500).json({ error: "Failed to update role element level" });
    }
  });

  app.delete("/api/role-element-levels/:id", isAuthenticated, requireRole('admin', 'developer'), async (req, res) => {
    try {
      const success = await storage.deleteRoleElementLevel(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Role element level not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting role element level:", error);
      res.status(500).json({ error: "Failed to delete role element level" });
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
      
      // Get effective user ID (impersonated or real user)
      const impersonatedUserId = req.session?.impersonatedUserId;
      const realUserId = req.user?.claims?.sub;
      const currentUserId = impersonatedUserId || realUserId;
      
      // Get real user to check admin status
      const realUser = await storage.getUser(realUserId);
      const isRealUserAdmin = realUser && ['admin', 'super_admin'].includes(normalizeRole(realUser.role));
      
      // Get effective user to check their role
      const effectiveUser = await storage.getUser(currentUserId);
      if (!effectiveUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const userRole = normalizeRole(effectiveUser.role);
      const isAdmin = ['admin', 'super_admin'].includes(userRole) || isRealUserAdmin;
      
      // Determine final assessorId based on role and query params
      let finalAssessorId = assessorId as string | undefined;
      
      // Non-admins can only see allocations where they are the assessor
      // UNLESS they are querying for a specific candidate (for admin UI purposes)
      if (!isAdmin && assessorId && assessorId !== currentUserId) {
        return res.status(403).json({ error: "Not authorized to view other assessors' allocations" });
      }
      
      // If non-admin queries without specifying assessorId AND without candidateId,
      // default to showing only their own allocations
      if (!isAdmin && !assessorId && !candidateId) {
        finalAssessorId = currentUserId;
      }
      
      const allocations = await storage.getCandidateAllocations(
        finalAssessorId,
        candidateId as string | undefined
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
      // Get effective user ID (impersonated or real user)
      const impersonatedUserId = req.session?.impersonatedUserId;
      const realUserId = req.user?.claims?.sub;
      const currentUserId = impersonatedUserId || realUserId;
      
      // Get the effective user to check their role
      const effectiveUser = await storage.getUser(currentUserId);
      if (!effectiveUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Check if real user is admin (for impersonation scenarios)
      const realUser = await storage.getUser(realUserId);
      const isRealUserAdmin = realUser && ['admin', 'super_admin'].includes(normalizeRole(realUser.role));
      
      // Check if effective user is admin
      const userRole = normalizeRole(effectiveUser.role);
      const isAdmin = ['admin', 'super_admin'].includes(userRole) || isRealUserAdmin;
      
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
      
      // Check if allocation already exists for this candidate-assessor pair
      const existingAllocations = await storage.getCandidateAllocations(
        validatedData.assessorId,
        validatedData.candidateId
      );
      
      if (existingAllocations.length > 0) {
        const existing = existingAllocations[0];
        
        // If allocation exists and is active, return it (idempotent)
        if (existing.isActive) {
          return res.status(200).json(existing);
        }
        
        // If allocation exists but is inactive, reactivate it
        const reactivated = await storage.updateCandidateAllocation(existing.id, {
          isActive: true,
          ...validatedData
        });
        return res.status(200).json(reactivated);
      }
      
      // No existing allocation, create new one
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
      // Accept both 'userId' and 'candidateId' for backwards compatibility
      const { candidateId: queryCandidateId, userId, assessorId, elementId, withExpiry, assignmentsOnly } = req.query;
      const candidateId = queryCandidateId || userId; // userId is an alias for candidateId
      
      // Get effective user ID (impersonated or real user)
      const impersonatedUserId = req.session?.impersonatedUserId;
      const realUserId = req.user?.claims?.sub;
      const currentUserId = impersonatedUserId || realUserId;
      
      // Get real user to check admin status
      const realUser = await storage.getUser(realUserId);
      const isRealUserAdmin = realUser && ['admin', 'super_admin'].includes(normalizeRole(realUser.role));
      
      // Get effective user to check their role
      const effectiveUser = await storage.getUser(currentUserId);
      if (!effectiveUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const userRole = normalizeRole(effectiveUser.role);
      const isAdmin = ['admin', 'super_admin'].includes(userRole) || isRealUserAdmin;
      
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
      } else if (assignmentsOnly === 'true' && candidateId) {
        // For AdminUsers interface: Return only assignment records (is_assignment = true)
        const result = await db.execute(sql`
          SELECT 
            a.id,
            a.candidate_id,
            a.element_id,
            a.level_id,
            a.assessor_id,
            a.outcome,
            a.assessment_date,
            a.is_assignment,
            a.origin,
            e.name as element_name,
            e.code as element_code,
            cl.name as level_name
          FROM assessments a
          JOIN competency_elements e ON e.id = a.element_id
          LEFT JOIN competency_levels cl ON cl.id = a.level_id
          WHERE a.candidate_id = ${candidateId}
            AND a.is_assignment = true
            AND a.is_active = true
          ORDER BY e.name ASC
        `);
        
        // Transform to match expected frontend structure
        const assignments = result.rows.map((row: any) => ({
          id: row.id,
          candidateId: row.candidate_id,
          elementId: row.element_id,
          levelId: row.level_id,
          assessorId: row.assessor_id,
          outcome: row.outcome,
          assessmentDate: row.assessment_date,
          isAssignment: row.is_assignment,
          origin: row.origin,
          element: {
            name: row.element_name,
            code: row.element_code
          },
          level: row.level_name ? { name: row.level_name } : null,
          status: row.outcome || 'not_yet_competent'
        }));
        
        res.json(assignments);
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

  // Get candidate's assessments summary with status (uses new view for dashboard)
  app.get("/api/my-assessments/summary", requireRole('candidate', 'trainee', 'assessor', 'admin', 'super_admin'), async (req, res) => {
    try {
      const impersonatedUserId = req.session?.impersonatedUserId;
      const realUserId = req.user?.claims?.sub;
      const candidateId = impersonatedUserId || realUserId;
      
      // Query the my_assigned_elements_status view (shows assignments with their latest assessment status)
      const result = await db.execute(
        sql`SELECT * FROM my_assigned_elements_status WHERE candidate_id = ${candidateId} ORDER BY element_title ASC`
      );
      
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching assessments summary:", error);
      res.status(500).json({ error: "Failed to fetch assessments summary" });
    }
  });

  // Get candidate's own assessments (for My Assessments page)
  app.get("/api/my-assessments", requireRole('candidate', 'trainee', 'assessor', 'admin', 'super_admin'), async (req, res) => {
    try {
      // Get the effective user ID (impersonated or real user)
      const impersonatedUserId = req.session?.impersonatedUserId;
      const realUserId = req.user?.claims?.sub;
      const effectiveUserId = impersonatedUserId || realUserId;
      
      // Get ONLY assignment records for this candidate (is_assignment = true)
      // This ensures we show all assigned elements, even if not yet assessed
      const result = await db.execute(sql`
        SELECT 
          a.id,
          a.candidate_id,
          a.element_id,
          a.level_id,
          a.assessor_id,
          a.outcome,
          a.assessment_date,
          a.is_assignment
        FROM assessments a
        WHERE a.candidate_id = ${effectiveUserId}
          AND a.is_assignment = true
          AND a.is_active = true
        ORDER BY a.created_at ASC
      `);
      
      const assignments = result.rows;
      
      // Get competency element details and K&P criteria for each assignment
      const assessmentsWithDetails = await Promise.all(
        assignments.map(async (assessment: any) => {
          const element = await storage.getCompetencyElement(assessment.element_id);
          
          // Get knowledge and performance criteria specific to this assessment's level (if assigned)
          // CRITICAL: If assessment has a levelId, only show criteria for that specific proficiency level
          const knowledgeCriteria = await storage.getCompetenceCriteriaWithSubcategories({
            elementId: assessment.element_id,
            type: 'knowledge',
            levelId: assessment.level_id // Filter by level if assessment is level-specific
          });
          
          const performanceCriteria = await storage.getCompetenceCriteriaWithSubcategories({
            elementId: assessment.element_id,
            type: 'performance',
            levelId: assessment.level_id // Filter by level if assessment is level-specific
          });
          
          return {
            ...assessment,
            element: {
              ...element,
              knowledgeCriteria,
              performanceCriteria
            }
          };
        })
      );
      
      res.json(assessmentsWithDetails);
    } catch (error) {
      console.error("Error fetching candidate assessments:", error);
      res.status(500).json({ error: "Failed to fetch assessments" });
    }
  });

  // Get assessor KPIs (expired, expiring, ok, not started counts)
  app.get("/api/assessors/:id/kpis", requireRole('assessor', 'admin', 'super_admin'), async (req, res) => {
    try {
      const assessorId = req.params.id;
      
      // KPI query adapted for our schema (using assessments table directly)
      const result = await db.execute(sql`
        WITH latest_assessment AS (
          SELECT 
            a.assessor_id,
            a.candidate_id,
            a.element_id,
            a.assessment_date,
            a.outcome,
            e.validity_months,
            CASE 
              WHEN a.assessment_date IS NOT NULL AND e.validity_months IS NOT NULL 
              THEN a.assessment_date + (e.validity_months || ' months')::interval
              ELSE NULL
            END AS valid_until,
            ROW_NUMBER() OVER (
              PARTITION BY a.candidate_id, a.element_id
              ORDER BY COALESCE(a.assessment_date, a.created_at, now()) DESC
            ) AS rn
          FROM assessments a
          JOIN competency_elements e ON e.id = a.element_id
          WHERE a.is_active = true AND e.is_current = true
        )
        SELECT
          ${assessorId}::text AS assessor_id,
          COUNT(*) FILTER (WHERE la.valid_until IS NULL) AS not_started,
          COUNT(*) FILTER (WHERE la.valid_until IS NOT NULL AND la.valid_until < now()) AS expired,
          COUNT(*) FILTER (WHERE la.valid_until IS NOT NULL AND la.valid_until >= now() AND la.valid_until <= now() + interval '90 days') AS expiring_90,
          COUNT(*) FILTER (WHERE la.valid_until IS NOT NULL AND la.valid_until > now() + interval '90 days') AS ok
        FROM candidate_allocations ca
        LEFT JOIN latest_assessment la ON la.assessor_id = ca.assessor_id AND la.rn = 1
        WHERE ca.is_active = true AND ca.assessor_id = ${assessorId}
        GROUP BY ca.assessor_id
      `);
      
      const kpis = result.rows[0] || { 
        assessor_id: assessorId, 
        not_started: 0, 
        expired: 0, 
        expiring_90: 0, 
        ok: 0 
      };
      
      res.json(kpis);
    } catch (error) {
      console.error("Error fetching assessor KPIs:", error);
      res.status(500).json({ error: "Failed to fetch assessor KPIs" });
    }
  });

  // Get single assessment
  app.get("/api/assessments/:id", requireRole('admin', 'super_admin', 'assessor', 'internal_verifier', 'candidate'), async (req, res) => {
    try {
      const assessment = await storage.getAssessment(req.params.id);
      if (!assessment) {
        return res.status(404).json({ error: "Assessment not found" });
      }
      
      // Get effective user ID (impersonated or real user)
      const impersonatedUserId = req.session?.impersonatedUserId;
      const realUserId = req.user?.claims?.sub;
      const currentUserId = impersonatedUserId || realUserId;
      
      // Get real user to check admin status
      const realUser = await storage.getUser(realUserId);
      const isRealUserAdmin = realUser && ['admin', 'super_admin'].includes(normalizeRole(realUser.role));
      
      // Get effective user to check their role
      const effectiveUser = await storage.getUser(currentUserId);
      const userRole = effectiveUser ? normalizeRole(effectiveUser.role) : 'candidate';
      const isAdmin = ['admin', 'super_admin'].includes(userRole) || isRealUserAdmin;
      const isAssessor = userRole === 'assessor' && assessment.assessorId === currentUserId;
      const isCandidate = userRole === 'candidate' && assessment.candidateId === currentUserId;
      const isVerifier = userRole === 'internal_verifier';
      
      if (!isAdmin && !isAssessor && !isCandidate && !isVerifier) {
        return res.status(403).json({ error: "Not authorized to view this assessment" });
      }
      
      // Enrich with element details and K&P criteria
      const element = await storage.getCompetencyElement(assessment.elementId);
      
      const knowledgeCriteria = await storage.getCompetenceCriteriaWithSubcategories({
        elementId: assessment.elementId,
        type: 'knowledge',
        levelId: assessment.levelId // Filter by level if assessment is level-specific
      });
      
      const performanceCriteria = await storage.getCompetenceCriteriaWithSubcategories({
        elementId: assessment.elementId,
        type: 'performance',
        levelId: assessment.levelId // Filter by level if assessment is level-specific
      });
      
      const enrichedAssessment = {
        ...assessment,
        element: {
          ...element,
          knowledgeCriteria,
          performanceCriteria,
        },
      };
      
      res.json(enrichedAssessment);
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
  app.patch("/api/assessments/:id", requireRole('assessor', 'admin', 'super_admin'), async (req: any, res) => {
    try {
      const currentUserId = req.user?.claims?.sub;
      const userRole = normalizeRole(req.currentUser?.role || 'candidate');
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

  // Candidate evidence submission (with file upload and email notification)
  app.post("/api/evidence", requireRole('candidate', 'trainee', 'admin', 'super_admin'), upload.array('files'), async (req: any, res) => {
    try {
      const { assessmentId, evidenceType, evidenceTitle, description } = req.body;
      
      // Get the effective user ID (impersonated or real user)
      const impersonatedUserId = req.session?.impersonatedUserId;
      const realUserId = req.user?.claims?.sub;
      const effectiveUserId = impersonatedUserId || realUserId;
      
      // Get the assessment to verify ownership and get assessor info
      const assessment = await storage.getAssessment(assessmentId);
      if (!assessment) {
        return res.status(404).json({ error: "Assessment not found" });
      }
      
      // Verify the candidate owns this assessment
      if (assessment.candidateId !== effectiveUserId) {
        return res.status(403).json({ error: "Not authorized to submit evidence for this assessment" });
      }
      
      // Get candidate and assessor info for email
      const candidate = await storage.getUser(effectiveUserId);
      const assessor = await storage.getUser(assessment.assessorId);
      const element = await storage.getCompetencyElement(assessment.elementId);
      
      // TODO: Handle file uploads to object storage
      // For now, we'll just create evidence records without files
      const files = req.files as Express.Multer.File[] || [];
      
      // Create evidence record for each file or one record if no files
      if (files.length === 0) {
        // Create a single evidence record without files
        const evidenceData = {
          assessmentId,
          fileName: `${evidenceTitle}.txt`,
          fileUrl: `/evidence/placeholder`,
          fileSize: 0,
          mimeType: 'text/plain',
          uploadedBy: effectiveUserId,
        };
        await storage.createAssessmentEvidence(evidenceData);
      } else {
        // Create evidence record for each file
        for (const file of files) {
          const evidenceData = {
            assessmentId,
            fileName: file.originalname,
            fileUrl: `/evidence/${file.filename || file.originalname}`,
            fileSize: file.size,
            mimeType: file.mimetype,
            uploadedBy: effectiveUserId,
          };
          await storage.createAssessmentEvidence(evidenceData);
        }
      }
      
      // Send email notification to assessor
      if (assessor?.email) {
        try {
          await emailService.sendEmail({
            to: assessor.email,
            subject: 'New Evidence Submitted',
            html: `
              <h2>New Evidence Submitted</h2>
              <p><strong>${candidate?.firstName} ${candidate?.lastName}</strong> has submitted new evidence for assessment.</p>
              <h3>Assessment Details:</h3>
              <ul>
                <li><strong>Competency:</strong> ${element?.code || 'N/A'} - ${element?.name || 'Unknown'}</li>
                <li><strong>Evidence Type:</strong> ${evidenceType}</li>
                <li><strong>Title:</strong> ${evidenceTitle}</li>
                <li><strong>Description:</strong> ${description}</li>
                <li><strong>Files Attached:</strong> ${files.length}</li>
              </ul>
              <p>Please review the evidence in your assessor workspace.</p>
            `,
          });
        } catch (emailError) {
          // Log email error but don't fail the request
          console.error('Failed to send notification email:', emailError);
        }
      }
      
      res.status(201).json({ 
        message: "Evidence submitted successfully",
        filesUploaded: files.length 
      });
    } catch (error) {
      console.error("Error submitting evidence:", error);
      res.status(500).json({ error: "Failed to submit evidence" });
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
            assessmentDate: assessmentDate,
            outcome,
            expiryDate: expiryDate || undefined,
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

  // =================================================================
  // EXTERNAL TRAINING MANAGEMENT & BOOKING SYSTEM
  // =================================================================

  // Training Providers API
  app.get("/api/training-providers", isAuthenticated, async (req, res) => {
    try {
      const providers = await storage.getTrainingProviders();
      res.json(providers);
    } catch (error) {
      console.error("Error fetching training providers:", error);
      res.status(500).json({ error: "Failed to fetch training providers" });
    }
  });

  // Alias GET endpoint for consistency with CRUD operations
  app.get("/api/training/providers", isAuthenticated, async (req, res) => {
    try {
      const providers = await storage.getTrainingProviders();
      res.json(providers);
    } catch (error) {
      console.error("Error fetching training providers:", error);
      res.status(500).json({ error: "Failed to fetch training providers" });
    }
  });

  app.post("/api/training/providers", isAuthenticated, requireRole('admin', 'super_admin'), async (req, res) => {
    try {
      const provider = await storage.createTrainingProvider(req.body);
      res.status(201).json(provider);
    } catch (error) {
      console.error("Error creating training provider:", error);
      res.status(500).json({ error: "Failed to create training provider" });
    }
  });

  app.put("/api/training/providers/:id", isAuthenticated, requireRole('admin', 'super_admin'), async (req, res) => {
    try {
      const provider = await storage.updateTrainingProvider(req.params.id, req.body);
      if (!provider) {
        return res.status(404).json({ error: "Provider not found" });
      }
      res.json(provider);
    } catch (error) {
      console.error("Error updating training provider:", error);
      res.status(500).json({ error: "Failed to update training provider" });
    }
  });

  app.delete("/api/training/providers/:id", isAuthenticated, requireRole('admin', 'super_admin'), async (req, res) => {
    try {
      const success = await storage.deleteTrainingProvider(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Provider not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting training provider:", error);
      res.status(500).json({ error: "Failed to delete training provider" });
    }
  });

  // Training Venues API
  app.get("/api/training-venues", isAuthenticated, async (req, res) => {
    try {
      const venues = await storage.getTrainingVenues();
      res.json(venues);
    } catch (error) {
      console.error("Error fetching training venues:", error);
      res.status(500).json({ error: "Failed to fetch training venues" });
    }
  });

  // Alias GET endpoint for consistency
  app.get("/api/training/venues", isAuthenticated, async (req, res) => {
    try {
      const venues = await storage.getTrainingVenues();
      res.json(venues);
    } catch (error) {
      console.error("Error fetching training venues:", error);
      res.status(500).json({ error: "Failed to fetch training venues" });
    }
  });

  app.post("/api/training/venues", isAuthenticated, requireRole('admin', 'super_admin'), async (req, res) => {
    try {
      const venue = await storage.createTrainingVenue(req.body);
      res.status(201).json(venue);
    } catch (error) {
      console.error("Error creating training venue:", error);
      res.status(500).json({ error: "Failed to create training venue" });
    }
  });

  app.put("/api/training/venues/:id", isAuthenticated, requireRole('admin', 'super_admin'), async (req, res) => {
    try {
      const venue = await storage.updateTrainingVenue(req.params.id, req.body);
      if (!venue) {
        return res.status(404).json({ error: "Venue not found" });
      }
      res.json(venue);
    } catch (error) {
      console.error("Error updating training venue:", error);
      res.status(500).json({ error: "Failed to update training venue" });
    }
  });

  app.delete("/api/training/venues/:id", isAuthenticated, requireRole('admin', 'super_admin'), async (req, res) => {
    try {
      const success = await storage.deleteTrainingVenue(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Venue not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting training venue:", error);
      res.status(500).json({ error: "Failed to delete training venue" });
    }
  });

  // External Training Courses API
  app.get("/api/external-training-courses", isAuthenticated, async (req, res) => {
    try {
      const { query, tag, modality, providerId } = req.query;
      console.log('[API] Storage type:', storage?.constructor?.name);
      console.log('[API] Storage methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(storage)));
      console.log('[API] Has getExternalTrainingCourses:', typeof storage.getExternalTrainingCourses);
      const courses = await storage.getExternalTrainingCourses({
        query: query as string,
        tag: tag as string,
        modality: modality as string,
        providerId: providerId as string,
      });
      res.json(courses);
    } catch (error) {
      console.error("Error fetching external training courses:", error);
      res.status(500).json({ error: "Failed to fetch external training courses" });
    }
  });

  // Alias GET endpoint for consistency
  app.get("/api/training/courses", isAuthenticated, async (req, res) => {
    try {
      const {query, tag, modality, providerId } = req.query;
      const courses = await storage.getExternalTrainingCourses({
        query: query as string,
        tag: tag as string,
        modality: modality as string,
        providerId: providerId as string,
      });
      res.json(courses);
    } catch (error) {
      console.error("Error fetching training courses:", error);
      res.status(500).json({ error: "Failed to fetch training courses" });
    }
  });

  app.post("/api/training/courses", isAuthenticated, requireRole('admin', 'super_admin'), async (req, res) => {
    try {
      const course = await storage.createExternalTrainingCourse(req.body);
      res.status(201).json(course);
    } catch (error) {
      console.error("Error creating training course:", error);
      res.status(500).json({ error: "Failed to create training course" });
    }
  });

  app.put("/api/training/courses/:id", isAuthenticated, requireRole('admin', 'super_admin'), async (req, res) => {
    try {
      const course = await storage.updateExternalTrainingCourse(req.params.id, req.body);
      if (!course) {
        return res.status(404).json({ error: "Course not found" });
      }
      res.json(course);
    } catch (error) {
      console.error("Error updating training course:", error);
      res.status(500).json({ error: "Failed to update training course" });
    }
  });

  app.delete("/api/training/courses/:id", isAuthenticated, requireRole('admin', 'super_admin'), async (req, res) => {
    try {
      const success = await storage.deleteExternalTrainingCourse(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Course not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting training course:", error);
      res.status(500).json({ error: "Failed to delete training course" });
    }
  });

  app.get("/api/external-training-courses/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const course = await storage.getExternalTrainingCourse(id);
      if (!course) {
        return res.status(404).json({ error: "Course not found" });
      }
      res.json(course);
    } catch (error) {
      console.error("Error fetching course:", error);
      res.status(500).json({ error: "Failed to fetch course" });
    }
  });

  // Course Training Sessions API
  app.get("/api/course-training-sessions", isAuthenticated, async (req, res) => {
    try {
      const { courseId, upcoming } = req.query;
      const sessions = await storage.getCourseTrainingSessions({
        courseId: courseId as string,
        upcoming: upcoming === 'true',
      });
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching course sessions:", error);
      res.status(500).json({ error: "Failed to fetch course sessions" });
    }
  });

  app.get("/api/course-training-sessions/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const session = await storage.getCourseTrainingSession(id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      res.json(session);
    } catch (error) {
      console.error("Error fetching session:", error);
      res.status(500).json({ error: "Failed to fetch session" });
    }
  });

  // Alias GET endpoint for consistency
  app.get("/api/training/sessions", isAuthenticated, async (req, res) => {
    try {
      const { courseId, upcoming } = req.query;
      const sessions = await storage.getCourseTrainingSessions({
        courseId: courseId as string,
        upcoming: upcoming === 'true',
      });
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching training sessions:", error);
      res.status(500).json({ error: "Failed to fetch training sessions" });
    }
  });

  app.post("/api/training/sessions", isAuthenticated, requireRole('admin', 'super_admin'), async (req, res) => {
    try {
      const session = await storage.createCourseTrainingSession(req.body);
      res.status(201).json(session);
    } catch (error) {
      console.error("Error creating training session:", error);
      res.status(500).json({ error: "Failed to create training session" });
    }
  });

  app.put("/api/training/sessions/:id", isAuthenticated, requireRole('admin', 'super_admin'), async (req, res) => {
    try {
      const session = await storage.updateCourseTrainingSession(req.params.id, req.body);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      res.json(session);
    } catch (error) {
      console.error("Error updating training session:", error);
      res.status(500).json({ error: "Failed to update training session" });
    }
  });

  app.delete("/api/training/sessions/:id", isAuthenticated, requireRole('admin', 'super_admin'), async (req, res) => {
    try {
      const success = await storage.deleteCourseTrainingSession(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Session not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting training session:", error);
      res.status(500).json({ error: "Failed to delete training session" });
    }
  });

  // Course Bookings API
  app.get("/api/course-bookings", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as { id: string; role: string };
      const { userId, sessionId, status } = req.query;
      
      // Non-admin users can only see their own bookings
      const filters = {
        userId: hasRole(user.role, 'admin', 'super_admin') ? (userId as string) : user.id,
        sessionId: sessionId as string,
        status: status as string,
      };
      
      const bookings = await storage.getCourseBookings(filters);
      res.json(bookings);
    } catch (error) {
      console.error("Error fetching course bookings:", error);
      res.status(500).json({ error: "Failed to fetch course bookings" });
    }
  });

  app.get("/api/course-bookings/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as { id: string; role: string };
      const { id } = req.params;
      const booking = await storage.getCourseBooking(id);
      
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }
      
      // Non-admin users can only see their own bookings
      if (!hasRole(user.role, 'admin', 'super_admin') && booking.userId !== user.id) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      res.json(booking);
    } catch (error) {
      console.error("Error fetching booking:", error);
      res.status(500).json({ error: "Failed to fetch booking" });
    }
  });

  app.post("/api/course-bookings", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as { id: string; role: string };
      const { sessionId } = req.body;
      
      // SECURITY: Always use authenticated user's ID, never trust client-supplied userId
      const userId = user.id;
      
      if (!sessionId) {
        return res.status(400).json({ error: "sessionId is required" });
      }
      
      // Validate session exists and has available seats
      const session = await storage.getCourseTrainingSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      // Check for existing booking
      const existingBookings = await storage.getCourseBookings({
        userId,
        sessionId,
      });
      
      const activeBooking = existingBookings.find(b => b.status !== 'cancelled');
      if (activeBooking) {
        return res.status(400).json({ error: "You already have a booking for this session" });
      }
      
      // Create the booking with server-enforced userId
      const booking = await storage.createCourseBooking({
        sessionId,
        userId, // Server-enforced from authenticated session
        status: 'pending',
        bookingDate: new Date().toISOString(),
      });
      
      res.status(201).json(booking);
    } catch (error) {
      console.error("Error creating booking:", error);
      res.status(500).json({ error: "Failed to create booking" });
    }
  });

  app.put("/api/course-bookings/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as { id: string; role: string };
      const { id } = req.params;
      const updates = req.body;
      
      const booking = await storage.getCourseBooking(id);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }
      
      // Only admin or booking owner can update
      if (!hasRole(user.role, 'admin', 'super_admin') && booking.userId !== user.id) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const updated = await storage.updateCourseBooking(id, updates);
      res.json(updated);
    } catch (error) {
      console.error("Error updating booking:", error);
      res.status(500).json({ error: "Failed to update booking" });
    }
  });

  app.delete("/api/course-bookings/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as { id: string; role: string };
      const { id } = req.params;
      
      const booking = await storage.getCourseBooking(id);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }
      
      // Only admin or booking owner can cancel
      if (!hasRole(user.role, 'admin', 'super_admin') && booking.userId !== user.id) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const success = await storage.cancelCourseBooking(id);
      if (!success) {
        return res.status(404).json({ error: "Failed to cancel booking" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error cancelling booking:", error);
      res.status(500).json({ error: "Failed to cancel booking" });
    }
  });

  // Training Policy Matrix API (for admin management)
  app.get("/api/training-policy-matrix", requireRole('admin', 'super_admin'), async (req, res) => {
    try {
      const { roleId } = req.query;
      if (!roleId) {
        return res.status(400).json({ error: "roleId is required" });
      }
      const policies = await storage.getTrainingPolicyMatrixByRole(roleId as string);
      res.json(policies);
    } catch (error) {
      console.error("Error fetching training policy matrix:", error);
      res.status(500).json({ error: "Failed to fetch training policy matrix" });
    }
  });

  app.post("/api/training/policy-matrix", isAuthenticated, requireRole('admin', 'super_admin'), async (req, res) => {
    try {
      const policy = await storage.createTrainingPolicyMatrix(req.body);
      res.status(201).json(policy);
    } catch (error) {
      console.error("Error creating training policy:", error);
      res.status(500).json({ error: "Failed to create training policy" });
    }
  });

  app.put("/api/training/policy-matrix/:id", isAuthenticated, requireRole('admin', 'super_admin'), async (req, res) => {
    try {
      const policy = await storage.updateTrainingPolicyMatrix(req.params.id, req.body);
      if (!policy) {
        return res.status(404).json({ error: "Policy not found" });
      }
      res.json(policy);
    } catch (error) {
      console.error("Error updating training policy:", error);
      res.status(500).json({ error: "Failed to update training policy" });
    }
  });

  app.delete("/api/training/policy-matrix/:id", isAuthenticated, requireRole('admin', 'super_admin'), async (req, res) => {
    try {
      const success = await storage.deleteTrainingPolicyMatrix(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Policy not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting training policy:", error);
      res.status(500).json({ error: "Failed to delete training policy" });
    }
  });

  // Seed Training Data (for development/testing)
  app.post("/api/admin/seed-training-data", isAuthenticated, requireRole('developer', 'admin', 'super_admin'), async (req, res) => {
    try {
      // Create training provider
      const provider = await storage.createTrainingProvider({
        name: "TechSkills Academy",
        website: "https://techskills.example.com",
        contactEmail: "info@techskills.example.com",
        description: "Leading provider of technical training courses",
        isActive: true,
      });

      // Create training venues
      const venue1 = await storage.createTrainingVenue({
        name: "London Training Centre",
        address: "123 Tech Street",
        city: "London",
        country: "United Kingdom",
        postalCode: "SW1A 1AA",
        isActive: true,
      });

      const venue2 = await storage.createTrainingVenue({
        name: "Manchester Learning Hub",
        address: "456 Innovation Road",
        city: "Manchester",
        country: "United Kingdom",
        postalCode: "M1 1AE",
        isActive: true,
      });

      // Create external training courses
      const course1 = await storage.createExternalTrainingCourse({
        providerId: provider.id,
        title: "Advanced Safety Management",
        description: "Comprehensive training on workplace safety protocols, risk assessment, and emergency response procedures.",
        modality: "in_person",
        durationDays: 3,
        level: "advanced",
        tags: ["Safety", "Management", "Compliance"],
        isActive: true,
      });

      const course2 = await storage.createExternalTrainingCourse({
        providerId: provider.id,
        title: "Leadership Development Program",
        description: "Develop essential leadership skills including team management, strategic thinking, and communication.",
        modality: "hybrid",
        durationDays: 5,
        level: "intermediate",
        tags: ["Leadership", "Management", "Soft Skills"],
        isActive: true,
      });

      const course3 = await storage.createExternalTrainingCourse({
        providerId: provider.id,
        title: "Digital Transformation Essentials",
        description: "Learn how to lead digital transformation initiatives and implement modern technologies in your organization.",
        modality: "online",
        durationDays: 2,
        level: "beginner",
        tags: ["Digital", "Technology", "Innovation"],
        isActive: true,
      });

      // Create course sessions
      const today = new Date();
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);
      const nextMonth = new Date(today);
      nextMonth.setDate(today.getDate() + 30);

      await storage.createCourseTrainingSession({
        courseId: course1.id,
        venueId: venue1.id,
        startAt: nextWeek.toISOString(),
        endAt: new Date(nextWeek.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        maxParticipants: 20,
        isActive: true,
      });

      await storage.createCourseTrainingSession({
        courseId: course2.id,
        venueId: venue2.id,
        startAt: nextMonth.toISOString(),
        endAt: new Date(nextMonth.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        maxParticipants: 15,
        isActive: true,
      });

      await storage.createCourseTrainingSession({
        courseId: course3.id,
        venueId: null,
        startAt: new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        endAt: new Date(today.getTime() + 16 * 24 * 60 * 60 * 1000).toISOString(),
        maxParticipants: 50,
        isActive: true,
      });

      res.json({
        success: true,
        message: "Training data seeded successfully",
        data: {
          providers: 1,
          venues: 2,
          courses: 3,
          sessions: 3,
        }
      });
    } catch (error) {
      console.error("Error seeding training data:", error);
      res.status(500).json({ error: "Failed to seed training data" });
    }
  });

  return httpServer;
}
