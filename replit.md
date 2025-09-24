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

**Role hierarchy** determines access levels, with higher-level roles inheriting permissions from lower levels. The authentication system currently uses mock data for prototyping with plans for integration with enterprise authentication providers.

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