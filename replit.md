# Overview
Capera is an enterprise skills management platform designed to centralize workforce skills data, assessments, and compliance tracking. It provides tools for skills framework building, assessment management, talent discovery, and compliance reporting for various user roles. The platform emphasizes enterprise-grade functionality, including role-based access control, detailed analytics, evidence management capabilities, skills gap analysis, and bulk operations for efficient workforce management.

# User Preferences
Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend
The frontend is built with **React and TypeScript**, using **Vite** for development. **shadcn/ui components** (based on Radix UI) and **Tailwind CSS** define the UI, supporting light and dark modes with an enterprise-friendly design system. **TanStack Query** manages server state, while **Wouter** handles client-side routing. The component architecture is modular, with page-level, reusable UI, custom business logic, and context providers.

## Backend
The backend uses **Express.js with TypeScript** and Node.js, implementing a **RESTful API**. It follows a **layered architecture** (Router, Storage interface, and an in-memory storage for prototyping, with plans for PostgreSQL integration). Middleware handles request logging, JSON parsing, and error handling.

## Data Storage
The application is configured for **PostgreSQL** using **Drizzle ORM** for type-safe operations, supporting connection pooling via Neon Database and schema migrations with Drizzle Kit. A temporary in-memory storage system is used for prototyping.

## Authentication and Authorization
A **role-based access control (RBAC)** system defines seven user roles (Developer, Super Admin, Admin, Internal Verifier, Assessor, Candidate, Trainee) with a hierarchical permission structure. Authentication uses **OIDC integration with Replit Auth**. The OIDC authentication system preserves existing user roles on login - when a user logs in via OIDC, their current role is maintained unless explicitly overridden by OIDC claims, preventing unintended role downgrades.

## AI-Powered Translation
An **AI-driven translation service** (using OpenAI) provides contextual translation of competency data into 15+ languages, supporting user-specific language preferences and professional terminology.

## Excel Import System
A robust **Excel/CSV import system** for competency standards features flexible type recognition (20+ aliases), fill-down support for empty cells, graceful error handling, header flexibility, smart defaults, type-scoped numbering, and comprehensive validation.

## V2 Competence Builder
This system implements a **Column A-J mapping** for competency standards, aligning with industry-standard templates. It includes a specific database schema for Competence Category, Element, Proficiency Scheme, Type, Subcategory, Assessment Criteria, Assessor Guidance, Assessment Methods, Reassessment Validity, and Required status. An **auto-numbering system** generates K/P and KG/PG codes. A **print/preview system** allows role-based filtering for assessors and candidates. Backward compatibility is maintained with a legacy description field.

## Assessment Management System
A comprehensive system for assessment and verification workflows, including **7 new database tables** for training enrollments, candidate allocations, assessments, evidence, verifier allocations, sampling plans, and verifications. It features **robust security architecture** with role-based authorization, ownership validation, server-side ID enforcement, and Zod validation. Over 40 API endpoints provide CRUD operations. An **Assessor Dashboard** offers real-time data, expiry tracking, multi-dimensional filtering, statistics, and Excel export functionality.

## Job Roles & Skills Matrix
The platform includes **job role management** with extended fields (name, code, client ID, location, business unit) and multi-client support. **Role Elements** link job roles to competency elements, specifying if they are mandatory or optional. A `/api/job-roles/:id/matrix` endpoint retrieves all elements for a role. A `normalizeRole()` function handles variations in role strings for consistent authorization.

## Manual User Management with Candidate-Specific Fields
The platform supports **manual user creation** through an admin interface with comprehensive candidate data capture. The user schema includes optional **candidate-specific fields**: location (text), job role (foreign key to job_roles table), date of birth (timestamp), and company number (text). The backend API properly handles date conversion from ISO strings to Date objects and converts empty optional fields to null. The admin interface provides a job role selector that fetches from the job roles table and a date picker for date of birth. **Security features** include privilege escalation prevention - only super_admin users can create super_admin or developer accounts. The implementation supports creating users with all optional fields populated or with only required fields (first name, last name, email, role).

## Automatic Job Role Assignment (Phase 1) ✓ TESTED
When a user is assigned a job role during creation, the system **automatically assigns all competence elements** linked to that job role. The `role_elements` table defines which competency elements belong to each job role (with required/optional flags). The `assignJobRoleToUser` storage function fetches all role elements and creates "not_yet_competent" assessment records for the user, avoiding duplicates if assessments already exist. The assessor is set to the admin who created the user (for audit trail). The `role_trainings` table is also in place to support future automatic training enrollment (Phase 2). The API response includes an `autoAssigned` object showing how many assessments and training enrollments were created. **Testing confirmed**: Creating a user with a job role that has 4 linked elements successfully auto-creates all 4 assessment records with correct outcome and candidate linkage. The `DbStorage` class includes assessment CRUD methods (getAssessments, createAssessment, updateAssessment, deleteAssessment) required for this functionality.

## Skills Gap Analysis Dashboard ✓
A powerful **skills gap analysis system** helps users and administrators identify competence gaps and track compliance with job role requirements. The system analyzes a user's current competence status against their assigned job role and provides detailed insights. **Key features** include:
- **Status Classification**: Elements categorized as missing, expired, expiring (30/60/90 days), or current
- **Coverage Percentage**: Overall compliance metric showing percentage of required elements with current assessments
- **Backend API**: `/api/skills-gap/:userId` endpoint with role-based access control
  - Users can view their own gap analysis
  - Privileged roles (admin, super_admin, assessor) can view any user's analysis
- **Visual Dashboard**: Responsive UI at `/skills-gap` route showing:
  - User and job role information
  - Coverage percentage with visual progress indicator
  - Detailed element list grouped by status with color-coded badges
  - Days until expiry for expiring assessments
  - Required vs optional element indicators
- **Security**: Server-side authorization checks prevent unauthorized access
- **Statistics Focus**: Calculations prioritize required elements; optional elements included in payload

## Bulk Assignment System ✓
An efficient **bulk operations system** enables administrators to assign job roles or competence elements to multiple users simultaneously, significantly reducing manual workload. The system supports partial success for robust error handling. **Key features** include:
- **Bulk Job Role Assignment**: Assign a job role to multiple users at once
  - Automatically triggers auto-assignment of all linked competence elements
  - Creates assessment records for each element per user
  - Updates user's job role field
- **Bulk Element Assignment**: Assign a specific competence element to multiple users
  - Creates "not_yet_competent" assessment records for each user
  - Sets the admin/assessor performing the bulk operation as the assessor
- **Partial Success Handling**: Sequential processing with detailed per-user error reporting
  - Returns success count, failure count, and total assessments created
  - Provides error messages for each failed user assignment
- **Backend API**:
  - `POST /api/admin/bulk-assign-job-role` (admin/super_admin only)
  - `POST /api/admin/bulk-assign-element` (admin/super_admin/assessor)
- **Admin UI**: Multi-select interface at `/admin/bulk-assignment` with:
  - User selection with checkboxes and "Select All" functionality
  - Tabbed interface for job role vs element assignment
  - Category and element selectors for targeted assignment
  - Real-time results display showing successful/failed operations
  - Detailed error reporting for failed assignments
- **Safety**: Optional chaining throughout to prevent crashes on missing API fields
- **Integration**: Seamlessly integrates with existing auto-assignment and assessment systems

## Historical Data Import System ✓
A comprehensive **bulk import system** allows administrators to migrate legacy competence assessment data from existing systems. The system supports **Excel/CSV file uploads** with a standardized 12-column template format. **Key features** include:
- **Template download**: Pre-formatted Excel template via `/api/admin/historical-import/template` endpoint
- **Excel/CSV support**: Flexible file format handling with robust parsing (xlsx/csv packages)
- **Column mapping**: User, Role, Location, Job Role, Date of Birth, Company Number, Competence Category, Competence Element, Assessor First/Last Name, Assessment Date, Expiry Date, Outcome
- **Smart user management**: Automatically creates missing users from import data with role normalization
- **Assessor lookup**: Matches assessors by name or creates new assessor accounts as needed
- **Element matching**: Matches competency categories and elements by name with validation
- **Job role assignment**: Parses "Job Role Name (CODE)" format for accurate job role linking
- **Date conversion**: Handles Excel serial date format conversion to JavaScript Date objects
- **Bulk processing**: `processHistoricalImport` storage function handles transactional batch creation
- **Error tracking**: Row-level error reporting with detailed validation messages
- **Import statistics**: Returns counts of users created, assessments created, and success/error rates
- **Admin-only access**: Protected by super_admin/admin authorization checks
The frontend provides an intuitive **upload interface** at `/admin/historical-import` with drag-and-drop file support, real-time progress feedback, detailed result display showing success/error counts, and per-row error messages for troubleshooting. The system integrates seamlessly with existing competency framework and assessment management systems.

## Design System
A **comprehensive design system** based on Material Design principles uses the Inter font family, a professional blue color system, a standardized component library, and a responsive, mobile-first layout.

# External Dependencies

## UI and Styling
- **@radix-ui/* packages**: Accessible UI primitives
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library
- **class-variance-authority**: Type-safe variant styling

## Data and State Management
- **TanStack React Query**: Server state management
- **Drizzle ORM**: Type-safe database ORM
- **Drizzle Zod**: Schema validation integration
- **Zod**: Runtime type validation

## Database and Infrastructure
- **@neondatabase/serverless**: Serverless PostgreSQL
- **PostgreSQL**: Primary database
- **connect-pg-simple**: PostgreSQL session store

## Development Tools
- **Vite**: Build tool and dev server
- **TypeScript**: Type safety
- **ESBuild**: Fast JavaScript bundler
- **React Hook Form**: Form management

## Charts and Visualization
- **Recharts**: Data visualization
- **Date-fns**: Date manipulation

## Authentication
- **Replit Auth**: OIDC integration