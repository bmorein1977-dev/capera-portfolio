# Overview
Capera is an enterprise skills management platform that centralizes workforce skills data, assessments, and compliance tracking. It offers tools for building skills frameworks, managing assessments, talent discovery, and compliance reporting. The platform emphasizes enterprise-grade features such as role-based access control, detailed analytics, evidence management, skills gap analysis, and bulk operations for efficient workforce management, aiming to provide a comprehensive solution for modern workforce management.

# User Preferences
Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend
The frontend is built with React and TypeScript, utilizing Vite for development. It uses shadcn/ui components (based on Radix UI) and Tailwind CSS for a responsive, enterprise-friendly design with light/dark mode support. TanStack Query manages server state, and Wouter handles client-side routing.

## Backend
The backend uses Express.js with TypeScript, implementing a RESTful API with a layered architecture. Middleware handles request logging, JSON parsing, and error handling.

## Data Storage
The application uses PostgreSQL with Drizzle ORM for type-safe operations, including connection pooling via Neon Database and schema migrations with Drizzle Kit.

## Authentication and Authorization
A hierarchical, role-based access control (RBAC) system supports seven user roles. Authentication integrates with Replit Auth via OIDC, preserving existing user roles unless overridden by OIDC claims.

## AI-Powered Translation
An AI-driven translation service (using OpenAI) provides contextual translation of competency data into over 15 languages, supporting user-specific language preferences.

## Excel Import System
A robust Excel/CSV import system for competency standards features flexible type recognition, fill-down support, error handling, header flexibility, and comprehensive validation.

## V2 Competence Builder
This system implements a Column A-J mapping for competency standards, with a specific database schema for various competence attributes. It includes an auto-numbering system for codes and a role-based print/preview system.

## Assessment Management System
A comprehensive system manages assessment and verification workflows with 7 new database tables. It features robust security with role-based authorization, ownership validation, server-side ID enforcement, and Zod validation, offering over 40 API endpoints and an Assessor Dashboard.

## Job Roles & Skills Matrix
The platform includes job role management with extended fields and multi-client support. Role Elements link job roles to competency elements, and an API endpoint retrieves all elements for a role. A normalization function handles role string variations for consistent authorization.

## Manual User Management with Candidate-Specific Fields
The system supports manual user creation via an admin interface, capturing comprehensive candidate data including optional location, job role, date of birth, and company number. Security features prevent privilege escalation.

## Automatic Job Role Assignment
When a user is assigned a job role, the system automatically assigns all linked competence elements by creating "not_yet_competent" assessment records, avoiding duplicates. The assessor is set to the admin who created the user.

## Skills Gap Analysis Dashboard
A skills gap analysis system identifies competence gaps and tracks compliance by analyzing a user's current competence against their assigned job role. Key features include status classification (missing, expired, expiring, current), coverage percentage, a backend API endpoint, and a responsive visual dashboard.

## Bulk Assignment System
An efficient bulk operations system allows administrators to assign job roles or competence elements to multiple users simultaneously. It supports partial success, providing detailed per-user error reporting for bulk job role and element assignments via dedicated API endpoints and an Admin UI.

## Historical Data Import System
A comprehensive bulk import system allows administrators to migrate legacy assessment data using Excel/CSV file uploads with a standardized 12-column template. It features smart user management, assessor lookup, element matching, job role assignment, date conversion, and row-level error reporting.

## Email Notification System
A flexible email notification system sends automated alerts for competence expiry and compliance tracking. It supports multiple email providers (SMTP, Resend, SendGrid) and features configurable notification settings, automated detection of expiring/expired assessments, professional HTML email generation, and a complete audit trail of sent notifications.

## Design System
A comprehensive design system based on Material Design principles uses the Inter font family, a professional blue color system, a standardized component library, and a responsive, mobile-first layout.

# External Dependencies

## UI and Styling
- @radix-ui/* packages
- Tailwind CSS
- Lucide React
- class-variance-authority

## Data and State Management
- TanStack React Query
- Drizzle ORM
- Drizzle Zod
- Zod

## Database and Infrastructure
- @neondatabase/serverless
- PostgreSQL
- connect-pg-simple

## Development Tools
- Vite
- TypeScript
- ESBuild
- React Hook Form

## Charts and Visualization
- Recharts
- Date-fns

## Authentication
- Replit Auth