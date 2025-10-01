# Overview

Capera is an enterprise skills management platform designed to centralize workforce skills data, assessments, and compliance tracking. The system serves multiple user roles including developers, administrators, assessors, and candidates, providing comprehensive tools for skills framework building, assessment management, talent discovery, and compliance reporting. The platform focuses on enterprise-grade functionality with role-based access control, detailed analytics, and evidence management capabilities.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The application uses **React with TypeScript** as the primary frontend framework, built with Vite for fast development and optimized builds. The UI is constructed using **shadcn/ui components** built on top of **Radix UI primitives**, providing accessible and customizable interface elements. **Tailwind CSS** handles styling with a custom design system featuring enterprise-friendly color schemes supporting both light and dark modes.

**State management** is handled through TanStack Query for server state and React's built-in state management for local component state. The application uses **Wouter** for client-side routing, providing a lightweight alternative to React Router.

The **component architecture** follows a modular approach with:
- Page-level components for major features (Dashboard, Team Matrix, Analytics)
- Reusable UI components from shadcn/ui
- Custom business logic components (SkillCard, AssessmentCard)
- Context providers for theme and authentication

## Backend Architecture
The backend uses **Express.js** with TypeScript running on Node.js. The server implements a **RESTful API design** with routes prefixed under `/api`. The application follows a **layered architecture** pattern:

- **Router layer** handles HTTP requests and routing
- **Storage interface** abstracts data operations with pluggable implementations
- **In-memory storage** for development/prototyping with plans for database integration

The server includes **middleware** for request logging, JSON parsing, and error handling. Development features include Vite integration for hot module replacement and runtime error overlays.

## Data Storage Solutions
The application is configured for **PostgreSQL** using Drizzle ORM for type-safe database operations. The database configuration supports:

- **Connection pooling** via Neon Database serverless connections
- **Schema migrations** managed through Drizzle Kit
- **Type-safe queries** with full TypeScript integration

Currently implements a **temporary in-memory storage** system for prototyping, designed to be easily replaced with the PostgreSQL implementation.

## Authentication and Authorization
The system implements a **role-based access control (RBAC)** system with seven distinct user roles:
1. **Developer** - System architect and maintainer
2. **Super Admin** - Organizational system owner
3. **Admin** - Day-to-day system operator
4. **Internal Verifier** - Quality assurer for assessments
5. **Assessor** - Conducts and manages assessments
6. **Candidate** - Individual being assessed
7. **Trainee** - Learning pathway participant

**Role hierarchy** determines access levels, with higher-level roles inheriting permissions from lower levels. The authentication system uses **OIDC integration** with Replit Auth, storing authenticated user data in `req.user.claims.sub` structure.

## AI-Powered Translation System
The platform includes a comprehensive **AI-driven translation service** using OpenAI for professional, contextual translation of competency data to support global clients:

- **Translation Service** (`server/services/translationService.ts`) - Handles text translation, structured competency data translation, and context-aware professional terminology
- **Language Preferences** - User-specific language settings with persistent storage, including primary language, fallback language, and auto-translation preferences  
- **Multi-language Support** - 15+ languages including English, Spanish, French, German, Chinese, Japanese, and more
- **Global UI Components** - LanguageSelector component in header for system-wide language switching
- **Contextual Translation** - Preserves technical terminology and enterprise tone across all competency manager data

**Recent Critical Fix (Dec 2024)**: Resolved language preferences persistence issue where endpoints returned 401 Unauthorized due to incorrect user ID access pattern. Fixed by changing from `req.user.id` to `req.user.claims.sub` to match OIDC authentication structure.

## Excel Import System (v1.1 - Sept 2024)
The platform includes a robust **Excel/CSV import system** for competency standards with enterprise-grade flexibility:

- **Flexible Type Recognition** - Supports 20+ type aliases including "Underpinning Knowledge", "Performance Criteria", "UK", "PC", "P/C", "K", "P", "Perf" with automatic normalization
- **Fill-Down Support** - Empty cells automatically inherit values from previous rows (Category, Element, Type, Subcategory, Proficiency Levels, Criticality, Validity Period)
- **Graceful Error Handling** - Unknown type values trigger warnings and default to "knowledge" instead of failing import
- **Header Flexibility** - Maps various header names like "Competence Category", "Assessment Criteria", "Reassessment Validity", "Criteria Type"
- **Smart Defaults** - Subcategory defaults to "General" when blank, Criticality defaults to "Medium", Validity defaults to 3 years
- **Type-Scoped Numbering** - Independent K1, K2, K3 and P1, P2, P3 sequences within each subcategory
- **Comprehensive Validation** - Detailed error and warning messages guide users to fix import issues

**Recent v1.1 Update**: Complete rewrite matching Python reference implementation with robust type normalization, space/hyphen handling, prefix matching (underpin*, knowledg*, perform*), and warning system for maximum import flexibility.

## V2 Competence Builder Architecture (Oct 2024)
The platform has been redesigned with a comprehensive **Column A-J mapping system** for competency standards, aligning with industry-standard Excel templates and SIMOPS-style assessment documents:

### Database Schema (Column Mapping)
- **Column A**: Competence Category (competency_categories.name)
- **Column B**: Competence Element (competency_elements.name)
- **Column C**: Proficiency Scheme (competency_elements.proficiency_scheme) - 1-5 scale
- **Column D**: Type (competence_criteria.type) - "knowledge" or "performance"
- **Column E**: Subcategory (competence_subcategories.name)
- **Column F**: Assessment Criteria (competence_criteria.criteria_text) - Primary field, NOT NULL
- **Column G**: Assessor Guidance (competence_criteria.assessor_guidance) - Assessor-only field
- **Column H**: Assessment Methods (competence_criteria.assessment_methods) - Array of methods
- **Column I**: Reassessment Validity (competency_elements.reassessment_years) - Years until reassessment
- **Column J**: Required (competence_criteria.required) - Boolean (M/Mandatory or O/Optional)

### Auto-numbering System
- **K/P Codes**: Auto-generated with space format: "K 1.1", "P 2.3" (changed from "K1.1", "P2.3")
  - K = Knowledge criteria, P = Performance criteria
  - Sequential numbering per subcategory within each element
  - Format: `{Type} {subcategory_number}.{criteria_number}`
- **KG/PG Guidance Codes**: Auto-generated when assessor guidance exists
  - KG = Knowledge Guidance, PG = Performance Guidance
  - Same numbering as main criteria: "KG 1.1", "PG 2.3"
  - Automatically set when guidance text is added, removed when guidance is deleted

### Print/Preview System
- **Endpoint**: `/api/competence-elements/:id/print`
- **Query Parameters**:
  - `role`: "assessor" or "candidate" (required)
  - `format`: "json" or "html" (default: json)
- **Role-based Filtering**:
  - Assessor role: Includes guidance_number and assessor_guidance fields
  - Candidate role: Guidance fields are excluded for clean assessment documents
- **Output Includes**: Element metadata (reassess_years, proficiency_scheme), hierarchical sections (knowledge/performance), formatted criteria with M/O indicators

### Backward Compatibility
- **Legacy Description Field**: Maintained for compatibility, automatically synced with criteriaText
- **Frontend Fallback**: UI displays criteriaText with fallback to legacy description field
- **API Compatibility**: Both description and criteriaText accepted, description auto-populated from criteriaText

### Key Implementation Files
- `shared/schema.ts` - V2 schema with Column A-J mapping
- `server/storage.ts` - Auto-numbering logic for K/P and KG/PG codes
- `server/routes.ts` - Print/preview endpoint with role-based filtering
- `client/src/components/CompetencyManager.tsx` - V2 UI with criteria modal and required badges

**Migration Status (Oct 2024)**: Successfully migrated to V2 architecture with criteria_text as primary field (NOT NULL), description field made nullable for backward compatibility, and all auto-numbering and guidance systems operational.

## Design System
The application implements a **comprehensive design system** based on Material Design principles, customized for enterprise use:

- **Typography**: Inter font family with consistent weight hierarchy
- **Color system**: Professional blue primary colors with semantic accent colors
- **Component library**: Standardized cards, forms, navigation, and data display components
- **Responsive layout**: Mobile-first approach with enterprise desktop optimization

# External Dependencies

## UI and Styling
- **@radix-ui/* packages** - Accessible UI primitives for complex components
- **Tailwind CSS** - Utility-first CSS framework with custom configuration
- **Lucide React** - Icon library providing consistent iconography
- **class-variance-authority** - Type-safe variant styling system

## Data and State Management
- **TanStack React Query** - Server state management and caching
- **Drizzle ORM** - Type-safe database ORM with PostgreSQL support
- **Drizzle Zod** - Schema validation integration
- **Zod** - Runtime type validation

## Database and Infrastructure
- **@neondatabase/serverless** - Serverless PostgreSQL database provider
- **PostgreSQL** - Primary database system for production data storage
- **connect-pg-simple** - PostgreSQL session store for authentication

## Development Tools
- **Vite** - Build tool and development server
- **TypeScript** - Type safety and enhanced developer experience
- **ESBuild** - Fast JavaScript bundler for production builds
- **React Hook Form** - Form state management and validation

## Charts and Visualization
- **Recharts** - Data visualization library for analytics dashboards
- **Date-fns** - Date manipulation and formatting utilities

## Authentication (Planned)
The architecture supports integration with enterprise authentication providers, session management through PostgreSQL, and role-based middleware for route protection.