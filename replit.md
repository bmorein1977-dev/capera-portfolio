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

**Recent Fix (Oct 28, 2025)**: Fixed criteria type filtering in CompetencyManager - Knowledge criteria (K1.1, K1.2, etc.) now correctly appear only under knowledge subcategories, and Performance criteria (P1.1, P1.2, etc.) only under performance subcategories. The bug was caused by filtering criteria by `subcategoryId` alone without checking the `type` field. The fix adds a dual filter: `subcategoryId === subcategory.id && type === subcategory.type`.

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
An efficient bulk operations system allows administrators to assign job roles, competence elements, or training courses to multiple users simultaneously. It supports partial success, providing detailed per-user error reporting for bulk assignments via dedicated API endpoints and an Admin UI.

## Training Management System
A comprehensive training assignment and tracking system enables administrators to manage workforce training requirements and enrollments. **Key features** include:
- **Training Database Structure**: Four database tables manage training data
  - `training_categories`: Organize trainings into categories (Safety, Technical, etc.)
  - `trainings`: Store training course details including name, description, validity period, assessment methods
  - `role_trainings`: Link training courses to job roles for automatic assignment
  - `training_enrollments`: Track user training assignments with status and dates
- **Automatic Training Assignment**: When a user is assigned a job role, the system automatically enrolls them in all training courses linked to that role, avoiding duplicate enrollments
- **Manual Training Assignment**: Administrators can manually assign specific training courses to individual users or use bulk assignment for multiple users
- **Duplicate Detection**: Smart enrollment system distinguishes between newly created enrollments and pre-existing ones
  - Returns detailed statistics: newly enrolled, already enrolled (skipped), and failed
  - Prevents duplicate enrollment errors by checking existing records before creation
- **Bulk Training Assignment**: 
  - Administrators can assign training courses to multiple users simultaneously
  - Detailed results show successful enrollments, skipped duplicates, and failures
  - API endpoint: `POST /api/admin/bulk-assign-training`
- **Training Enrollment Status Tracking**: Enrollments support multiple statuses (allocated, in_progress, completed)
- **User Interface Components**:
  - Bulk Assignment page includes "Assign Training" tab with category and course selection
  - User Details dialog displays all training enrollments with status badges and dates
  - Results dashboard shows enrollment statistics including skipped duplicates
- **Backend API Endpoints**:
  - `GET /api/trainings` - List all training courses
  - `GET /api/training-categories` - List training categories
  - `GET /api/training-enrollments?userId=&trainingId=` - Query enrollments with filters
  - `POST /api/admin/bulk-assign-training` - Bulk assign training to multiple users
  - Training CRUD operations for admin management

## Historical Data Import System
A comprehensive bulk import system allows administrators to migrate legacy assessment data using Excel/CSV file uploads with a standardized 12-column template. It features smart user management, assessor lookup, element matching, job role assignment, date conversion, and row-level error reporting.

## Email Notification System
A flexible **email notification system** sends automated alerts for competence expiry and compliance tracking. The system supports multiple email providers (SMTP, Resend, SendGrid) through environment variable configuration. **Key features** include:
- **Configurable Providers**: Supports SMTP, Resend API, and SendGrid API via environment variables
  - SMTP: Set `EMAIL_SERVICE=smtp`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE=true/false`, `SMTP_USER`, `SMTP_PASS`
  - Resend: Set `EMAIL_SERVICE=resend`, `RESEND_API_KEY`
  - SendGrid: Set `EMAIL_SERVICE=sendgrid`, `SENDGRID_API_KEY`
  - All providers require `EMAIL_FROM` for sender address
  - Development mode: Email service is optional (warns if not configured)
  - Production mode: System throws error at startup if configured provider credentials are missing
- **Notification Settings**: Configurable notification rules stored in database (`notification_settings` table)
  - Type-based notifications: `expiring_soon` (with configurable days before expiry) or `expired`
  - Role-based recipients: Target specific user roles for notifications
  - Enable/disable toggle per notification rule
  - Custom email templates (HTML body stored in settings)
- **Automated Detection**: Query system finds assessments requiring attention
  - Expiring assessments: Finds competent assessments expiring on specific future date (based on `daysBeforeExpiry` setting)
  - Expired assessments: Finds competent assessments with expiry date in the past
  - Groups notifications by user for consolidated emails
- **Email Generation**: Professional HTML emails with Capera branding
  - Responsive email templates with company branding
  - Tabular display of affected competence elements
  - Status indicators (days until expiry or "Expired")
  - Fallback text-only version auto-generated from HTML
- **Notification Logs**: Complete audit trail in `notification_logs` table
  - Tracks recipient, subject, body, send status (sent/failed), and metadata
  - Error logging for failed deliveries with error messages
  - Queryable by recipient ID, status, or setting ID
- **Backend API**:
  - `GET /api/admin/notification-settings` - List all notification settings
  - `POST /api/admin/notification-settings` - Create new notification setting
  - `PUT /api/admin/notification-settings/:id` - Update notification setting
  - `DELETE /api/admin/notification-settings/:id` - Delete notification setting
  - `GET /api/admin/notification-logs?recipientId=&status=&settingId=` - Query notification logs with filters
  - `POST /api/admin/notifications/send-now` - Manual trigger to run all enabled notifications immediately
- **Services Architecture**:
  - `emailService` (server/services/emailService.ts): Provider-agnostic email sending using nodemailer for SMTP, native fetch for Resend/SendGrid APIs
  - `notificationService` (server/services/notificationService.ts): Business logic for finding assessments, generating emails, and recording logs
  - Database schema: `notification_settings` and `notification_logs` tables with full type safety via Drizzle ORM
- **Security**: All notification endpoints require admin role authorization
- **Package Dependencies**: Uses `nodemailer` for SMTP support (already installed)
**Usage**: Admins can configure notification settings via API, then either trigger manually via `/send-now` endpoint or set up scheduled tasks (cron jobs) to call `notificationService.runScheduledNotifications()` periodically for automated notification delivery.

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