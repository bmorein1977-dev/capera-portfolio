# Overview
Capera is an enterprise skills management platform for centralizing workforce skills data, assessments, and compliance. It offers tools for skills framework building, assessment management, talent discovery, compliance reporting, and external training management. The platform features role-based access control, analytics, evidence management, skills gap analysis, bulk operations, external training booking, and level-based competency assignments, aiming to be a comprehensive solution for modern workforce management with a focus on enterprise-grade capabilities.

# User Preferences
Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend
The frontend is built with React and TypeScript, using Vite, shadcn/ui components (Radix UI), and Tailwind CSS for a responsive design with light/dark mode. TanStack Query manages server state, and Wouter handles client-side routing.

## Backend
The backend uses Express.js with TypeScript, implementing a RESTful API with a layered, dependency-injected architecture. It includes middleware for logging, JSON parsing, and error handling.

## Data Storage
PostgreSQL is used with Drizzle ORM for type-safe operations, including connection pooling via Neon Database and Drizzle Kit for schema migrations.

## Authentication and Authorization
A hierarchical, role-based access control (RBAC) system supports seven user roles. Authentication integrates with Replit Auth via OIDC, preserving existing user roles unless overridden by OIDC claims.

## AI-Powered Translation
An AI-driven translation service (using OpenAI) provides contextual translation of competency data into over 15 languages.

## Excel Import System
A robust Excel/CSV import system supports competency standards with flexible type recognition, fill-down, error handling, header flexibility, and comprehensive validation.

## V2 Competence Builder
This system implements a Column A-J mapping for competency standards with a specific database schema for competence attributes, including auto-numbering for codes and a role-based print/preview system.

## Assessment Management System
A comprehensive system manages assessment and verification workflows with robust security (role-based authorization, ownership validation, server-side ID enforcement, Zod validation), offering over 40 API endpoints and an Assessor Dashboard.

## Job Roles & Skills Matrix
The platform includes comprehensive job role management with extended fields and multi-client support. Role Elements link job roles to competency elements, and an API endpoint retrieves all elements for a role. A normalization function handles role string variations for consistent authorization. An admin interface supports CRUD operations for job roles and element assignment via a dual-column picklist with enhanced level visibility features:
- **Level Description Tooltips**: Hovering over level badges displays tooltips showing level name, description, and code, helping users understand what each proficiency level means
- **Multi-Level Filtering**: A "Show only multi-level elements" checkbox filters the element list to show only competency elements with defined proficiency levels, making it easier to manage level-based assignments
- **Visual Level Indicators**: Badge components display "{X} Levels" next to element names in both Available and Assigned columns, providing clear visual feedback about which elements have proficiency levels defined
- **Dual-Column Picklist**: Intuitive interface for managing element assignments with category filtering and level-based filtering options

When a user is assigned a job role, the system automatically assigns all linked competence elements as "not_yet_competent" assessment records, avoiding duplicates.

## Level-Based Competency Assignment System
A sophisticated level-based assignment system allows administrators to assign specific proficiency levels (Basic, Intermediate, Advanced) of competency elements to different job roles. **CRITICAL: Levels are INDEPENDENT, not cumulative** - assigning "Intermediate" means only the Intermediate level, not Basic+Intermediate. However, the system provides flexibility for unique cases where multiple levels of the same element can be assigned to a single role. The system includes:
- **Database Schema**: Two new tables (`competency_levels` and `role_element_levels`) support independent level management with flexibility for multiple level assignments. The `competence_criteria` table includes a nullable `levelId` field to link individual criteria to specific proficiency levels.
- **Storage Layer**: Complete CRUD operations for managing levels and role-level assignments
- **API Endpoints**: RESTful routes for competency levels (`/api/competency-levels`) and role-element-level assignments (`/api/role-element-levels`) with proper authentication (read access for authenticated users, write access for admins only)
- **Auto-Import Workflow**: Excel import now automatically creates competency_levels records when encountering level terms in Column E (Basic, Intermediate, Advanced, etc.). No manual pre-setup required - the system is fully "plug and play". Levels are created with auto-generated codes, display orders, and proper element linkage.
- **Inline Level Management**: Proficiency levels can be managed directly within the Competency Manager (`/admin/competency-manager`). When an element is selected, an inline panel appears showing all defined levels with add/edit/delete capabilities for manual element creation or post-import adjustments.
- **Bulk Criteria Creation**: The Add Criteria dialog supports bulk creation with shared fields (subcategory, level, required/optional, assessment methods) and repeatable rows for individual criteria, allowing efficient creation of multiple criteria at once with consistent properties.
- **Assessor Guidance Field**: Elements have a "Requires Assessor Guidance" checkbox that controls whether assessor guidance fields appear in criteria forms, enabling context-specific guidance collection.
- **Dynamic Level Dropdowns**: Level selection dropdowns automatically appear in Add Element and Bulk Assignment interfaces when an element has defined proficiency levels
- **Job Role Management UI**: Clickable level badges allow toggling individual levels on/off for each assigned element, with loading states to prevent duplicate submissions
- **Independent Level Logic**: When a job role is assigned to a candidate, only the specifically selected levels are created as assessment records (e.g., selecting only "Advanced" creates only an Advanced-level assessment)
- **Flexible Architecture**: Supports custom level naming and ordering, accommodating 1, 3, or 4-level proficiency systems, with the ability to assign any combination of levels per element
- **Assessment Integration**: Complete integration - assessments display level information with badges, and level-specific assessments can be created through AdminUsers and Bulk Assignment interfaces
- **Criteria-to-Level Linking**: During Excel import, Column E (Level Terms) specifies which proficiency level each criterion applies to. If a level term doesn't exist, the system automatically creates it with proper code generation and display ordering. The `levelId` field in `competence_criteria` links each criterion to its specific proficiency level. When viewing assessments at a specific level, only criteria assigned to that level are displayed, maintaining strict independent level separation.
- **Level-Based Criteria Numbering**: Criteria codes automatically reflect proficiency levels using the format `K {level}.{number}` or `P {level}.{number}` (e.g., K 1.1 for Basic knowledge, K 2.1 for Intermediate knowledge, K 3.1 for Advanced knowledge). The first number corresponds to the level's display order (1=Basic, 2=Intermediate, 3=Advanced), and the second number is the sequential criterion number within that level. Both single criteria creation and bulk creation operations generate level-aware codes automatically, ensuring proper numbering within each independent proficiency level.

## Manual User Management
The system supports manual user creation via an admin interface, capturing comprehensive candidate data. Administrators can assign assessors to candidates/trainees. User deletion supports both individual and bulk soft deletion (marking as inactive). A developer-only impersonation system allows testing as different user roles.

## Candidate Assessment View
A candidate-facing assessment interface allows candidates to view and interact with their assessments, including a summary dashboard, filterable assessment lists, detailed assessment views, and evidence submission capabilities (currently accepts files, needs object storage integration).

## Skills Gap Analysis Dashboard
A skills gap analysis system identifies competence gaps and tracks compliance against assigned job roles, featuring status classification (missing, expired, expiring, current), coverage percentage, a backend API, and a responsive visual dashboard.

## Bulk Assignment System
An efficient bulk operations system allows administrators to assign job roles, competence elements, or training courses to multiple users simultaneously, supporting partial success and detailed per-user error reporting.

## Training Management System
A comprehensive training assignment and tracking system manages workforce training requirements and enrollments, including a structured training database, automatic/manual assignment, duplicate detection, and enrollment status tracking.

## Historical Data Import System
A comprehensive bulk import system allows migration of legacy assessment data via Excel/CSV file uploads with smart user management, assessor lookup, element matching, job role assignment, and row-level error reporting.

## Email Notification System
A flexible email notification system sends automated alerts for competence expiry and compliance tracking, supporting multiple email providers and featuring configurable rules, automated detection, professional HTML emails, and audit trails.

## External Training Management & Booking System
A complete external training marketplace for discovering and booking courses, including a comprehensive database schema for providers, venues, courses, sessions, and bookings, a robust security architecture, extensive backend API endpoints, and an intuitive frontend for catalog browsing and booking.

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