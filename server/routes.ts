import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import {
  insertCompetencyCategorySchema,
  insertCompetencyElementSchema,
  insertCompetencySchema,
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
} from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication middleware setup
  await setupAuth(app);

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

  app.patch('/api/users/:id', isAuthenticated, async (req, res) => {
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

  return httpServer;
}
