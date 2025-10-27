# Overview
Capera is an enterprise skills management platform designed to centralize workforce skills data, assessments, and compliance tracking. It provides tools for skills framework building, assessment management, talent discovery, and compliance reporting for various user roles. The platform emphasizes enterprise-grade functionality, including role-based access control, detailed analytics, and evidence management capabilities.

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