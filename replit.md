# Overview
Capera is an enterprise skills management platform designed to centralize workforce skills data, assessments, and compliance. It enables organizations to build skills frameworks, manage assessments, discover talent, generate compliance reports, and manage external training. The platform provides robust features like role-based access control, analytics, evidence management, skills gap analysis, bulk operations, and level-based competency assignments, aiming to be a comprehensive solution for modern workforce management.

# User Preferences
Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend
The frontend is built with React and TypeScript, leveraging Vite, shadcn/ui components (Radix UI), and Tailwind CSS for a responsive design with light/dark mode. TanStack Query manages server state, and Wouter handles client-side routing.

## Backend
The backend utilizes Express.js with TypeScript, implementing a RESTful API with a layered, dependency-injected architecture, including middleware for logging, JSON parsing, and error handling.

## Data Storage
PostgreSQL is used with Drizzle ORM for type-safe operations, including connection pooling via Neon Database and Drizzle Kit for schema migrations.

## Authentication and Authorization
A hierarchical, role-based access control (RBAC) system with seven user roles is implemented. Authentication integrates with Replit Auth via OIDC, preserving existing user roles unless overridden.

## AI-Powered Translation
An AI-driven translation service, utilizing OpenAI, provides contextual translation of competency data into over 15 languages.

## Excel Import System
A robust Excel/CSV import system supports competency standards with flexible type recognition, fill-down capabilities, error handling, header flexibility, and comprehensive validation.

## V2 Competence Builder
This system implements a Column A-J mapping for competency standards with a specific database schema for competence attributes, including auto-numbering for codes and a role-based print/preview system.

## Assessment Management System
A comprehensive system manages assessment and verification workflows with robust security (role-based authorization, ownership validation, server-side ID enforcement, Zod validation), offering over 40 API endpoints and an Assessor Dashboard. It includes a sophisticated assignment tracking system that separates element assignments from actual assessments, ensuring candidates see the correct elements based on their job role.

## Assessor Workspace
The Assessor Workspace provides assessors with a real-time view of their allocated candidates, fetching data directly from the candidate_allocations table and filtering out archived users. The workspace displays only active, allocated candidates with their associated assessments, replacing previous mock data implementations. The system ensures data consistency by querying real database records and properly handling loading states.

## Job Roles & Skills Matrix
The platform features comprehensive job role management with extended fields and multi-client support. It includes an admin interface for CRUD operations and element assignment via a dual-column picklist with enhanced level visibility, filtering, and visual indicators. When a user is assigned a job role, the system automatically creates assignment records for all linked competence elements, intelligently avoiding duplicates.

## Level-Based Competency Assignment System
A sophisticated level-based assignment system allows administrators to assign specific, independent proficiency levels (Basic, Intermediate, Advanced) of competency elements to different job roles. It supports flexible level naming and ordering, auto-creation of levels from Excel imports, inline level management, bulk criteria creation with shared fields, dynamic level dropdowns, and robust integration with the assessment system, including level-specific criteria numbering.

## Manual User Management
The system supports manual user creation via an admin interface for comprehensive candidate data management and assessor assignment. It includes soft deletion capabilities and a developer-only impersonation system for testing.

## User Archive System
A user archiving system allows administrators to archive inactive users without permanently deleting them, maintaining data integrity while removing them from active workflows. Features include archive/reactivate buttons in user management, visual "Archived" badges, automatic filtering of archived users from assessor candidate lists and allocations, and protection against self-archival. Archived users are excluded from all operational queries (candidate allocations, assessments, workspace views) via database-level filtering.

## Candidate Assessment View
A candidate-facing assessment interface provides a summary dashboard, filterable assessment lists, detailed assessment views with structured criteria display (grouped by subcategory), level-specific filtering, and integrated inline evidence submission with drag-and-drop functionality.

## Skills Gap Analysis Dashboard
A skills gap analysis system identifies competence gaps and tracks compliance against assigned job roles, featuring status classification (missing, expired, expiring, current), coverage percentage, and a responsive visual dashboard.

## Bulk Assignment System
An efficient bulk operations system allows administrators to assign job roles, competence elements, or training courses to multiple users simultaneously, supporting partial success and detailed error reporting.

## Training Management System
A comprehensive training assignment and tracking system manages workforce training requirements and enrollments, including a structured training database, automatic/manual assignment, duplicate detection, and enrollment status tracking.

## Historical Data Import System
A comprehensive bulk import system facilitates migration of legacy assessment data via Excel/CSV file uploads, featuring smart user management, assessor lookup, element matching, job role assignment, and row-level error reporting.

## Email Notification System
A flexible email notification system sends automated alerts for competence expiry and compliance tracking, supporting multiple email providers with configurable rules, automated detection, and professional HTML emails.

## External Training Management & Booking System
A complete external training marketplace for discovering and booking courses, featuring a comprehensive database schema, robust security architecture, extensive backend API endpoints, and an intuitive frontend for catalog browsing and booking.

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
- Nodemailer
- Resend API
- SendGrid API

## AI Services
- OpenAI