# Overview
Capera is an enterprise skills management platform designed to centralize workforce skills data, assessments, and compliance tracking. It provides tools for building skills frameworks, managing assessments, talent discovery, compliance reporting, and external training management. The platform offers enterprise-grade features such as role-based access control, analytics, evidence management, skills gap analysis, bulk operations, and external training booking, aiming to be a comprehensive solution for modern workforce management.

# User Preferences
Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend
The frontend is built with React and TypeScript, using Vite for development. It leverages shadcn/ui components (based on Radix UI) and Tailwind CSS for a responsive, enterprise-friendly design with light/dark mode. TanStack Query manages server state, and Wouter handles client-side routing.

## Backend
The backend utilizes Express.js with TypeScript, implementing a RESTful API with a layered architecture using dependency injection. Storage instances are created in index.ts and passed to routes and authentication modules. It includes middleware for request logging, JSON parsing, and error handling.

## Data Storage
PostgreSQL is used for data storage, with Drizzle ORM for type-safe operations, including connection pooling via Neon Database and schema migrations with Drizzle Kit. The DbStorage class (4400+ lines) implements all database operations with 139+ methods.

## Critical Bug Fixes (Oct 29, 2025)

### External Training Management Fix
Resolved a critical circular dependency and class structure issue that prevented External Training Management methods from being loaded:
- **Root Cause**: Premature closing brace at line 1836 ended DbStorage class early, excluding 2600+ lines of training-related methods
- **Impact**: All External Training endpoints (providers, venues, courses, sessions, bookings) returned "undefined" method errors
- **Solution**: Removed singleton export pattern, implemented dependency injection for storage, and fixed class structure
- **Pattern**: `const storage = new DbStorage()` in index.ts, passed via `registerRoutes(app, { storage })` and `setupAuth(app, storage)`

### Candidate Allocation & Training Enrollment Fix
Resolved a second critical class structure issue where MemStorage code was incorrectly inserted into DbStorage:
- **Root Cause**: Premature closing brace at line 2072 ended DbStorage class early, then ~1575 lines of obsolete MemStorage class code were inserted before Training Enrollment and Candidate Allocation methods
- **Impact**: Candidate allocation endpoints and training enrollment endpoints returned "undefined" method errors, breaking assessor assignment workflow
- **Solution**: Removed premature closing brace at line 2072 and deleted all MemStorage code (lines 2074-3649), allowing DbStorage to continue properly with Training Enrollment and Candidate Allocation methods
- **Result**: Reduced storage.ts from 4393 lines to 2816 lines, restored all candidate allocation and training enrollment functionality

## Authentication and Authorization
A hierarchical, role-based access control (RBAC) system supports seven user roles. Authentication integrates with Replit Auth via OIDC, preserving existing user roles unless overridden by OIDC claims.

## AI-Powered Translation
An AI-driven translation service (using OpenAI) provides contextual translation of competency data into over 15 languages, supporting user-specific language preferences.

## Excel Import System
A robust Excel/CSV import system for competency standards features flexible type recognition, fill-down support, error handling, header flexibility, and comprehensive validation.

## V2 Competence Builder
This system implements a Column A-J mapping for competency standards with a specific database schema for competence attributes, including an auto-numbering system for codes and a role-based print/preview system.

## Assessment Management System
A comprehensive system manages assessment and verification workflows, featuring robust security with role-based authorization, ownership validation, server-side ID enforcement, and Zod validation, offering over 40 API endpoints and an Assessor Dashboard.

## Job Roles & Skills Matrix
The platform includes job role management with extended fields and multi-client support. Role Elements link job roles to competency elements, and an API endpoint retrieves all elements for a role. A normalization function handles role string variations for consistent authorization.

## Manual User Management
The system supports manual user creation via an admin interface, capturing comprehensive candidate data including optional location, team/shift, job role, assessor assignment, date of birth, and company number. Security features prevent privilege escalation.

### Assessor Assignment Workflow
Administrators can assign assessors to candidates/trainees through the User Management interface:
- **Create User Flow**: Select candidate/trainee role → assign assessor → assign job role → competence elements auto-added
- **Edit User Flow**: Change assessor assignment or remove assessor for candidates/trainees
- **Role Change Cleanup**: When a candidate/trainee is promoted to another role, their candidate allocation is automatically removed
- **Data Integrity**: Candidate allocations are created, updated, or deleted automatically based on assessor assignments

### User Deletion
The system supports both individual and bulk user deletion with soft delete functionality:
- **Soft Delete**: Users are marked as inactive (isActive=false) rather than permanently removed from the database
- **Single Delete**: DELETE /api/users/:id endpoint for deleting individual users
- **Bulk Delete**: POST /api/users/bulk-delete endpoint accepts array of user IDs
  - Returns detailed results: { deleted: number, failed: number, errors: Array<{userId, error}> }
  - Partial success supported - continues deleting even if some fail
- **UI Features**: Checkbox-based selection, "Select All" functionality, "Delete Selected" button with count display
- **Security**: Admin/super_admin role required, users cannot delete themselves
- **Data Integrity**: getAllUsers() filters out inactive users automatically

### User Impersonation for Testing (Oct 29, 2025)
A developer-only impersonation system allows admins and developers to view the application as different user roles for testing purposes:
- **Impersonation API**: POST /api/auth/impersonate and /api/auth/stop-impersonating endpoints manage session-based user switching
- **Test Scenario Setup**: POST /api/auth/setup-test-scenario creates test candidate and assessor accounts with:
  - Test Candidate (ID: test-candidate-001): John Trainee assigned to Electrical Technician job role with competence elements
  - Test Assessor (ID: test-assessor-001): Sarah Assessor assigned to supervise the test candidate
  - Sample assessments at various statuses (competent, in_progress, not_yet_competent) for realistic testing
  - Candidate allocation linking the test candidate to their assessor
- **UserSwitcher Component**: Dropdown UI in header allowing quick switching between test users
  - Visible only to developers/admins or when actively impersonating
  - Shows current impersonation status and provides "Stop Viewing" option
  - Lists all test users (those with IDs starting with 'test-')
- **Security**: Impersonation restricted to developer/admin/super_admin roles; session-based with proper cleanup on logout
- **Implementation**: Session stores impersonatedUserId; /api/auth/user returns impersonated user data with isImpersonating flag and realUserId

## Automatic Job Role Assignment
When a user is assigned a job role, the system automatically assigns all linked competence elements as "not_yet_competent" assessment records, avoiding duplicates. The assessor is set to the admin who created the user.

## Skills Gap Analysis Dashboard
A skills gap analysis system identifies competence gaps and tracks compliance by analyzing a user's current competence against their assigned job role. Key features include status classification (missing, expired, expiring, current), coverage percentage, a backend API, and a responsive visual dashboard.

## Bulk Assignment System
An efficient bulk operations system allows administrators to assign job roles, competence elements, or training courses to multiple users simultaneously. It supports partial success, providing detailed per-user error reporting via dedicated API endpoints and an Admin UI.

## Training Management System
A comprehensive training assignment and tracking system enables administrators to manage workforce training requirements and enrollments. It includes a structured training database, automatic and manual assignment capabilities, duplicate detection, enrollment status tracking, and a dedicated UI.

## Historical Data Import System
A comprehensive bulk import system allows administrators to migrate legacy assessment data using Excel/CSV file uploads with a standardized 12-column template. It features smart user management, assessor lookup, element matching, job role assignment, date conversion, and row-level error reporting.

## Email Notification System
A flexible email notification system sends automated alerts for competence expiry and compliance tracking. It supports multiple email providers (SMTP, Resend, SendGrid) through environment variable configuration and features configurable notification rules, automated detection, professional HTML email generation, and complete audit trails.

## External Training Management & Booking System
A complete external training marketplace enables users to discover and book training courses from external providers. It includes a comprehensive database schema for providers, venues, courses, sessions, and bookings, alongside a robust security architecture, extensive backend API endpoints, and an intuitive frontend user experience for catalog browsing and booking management.

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

## Email Services
- Nodemailer (for SMTP)
- Resend API
- SendGrid API

## AI Services
- OpenAI