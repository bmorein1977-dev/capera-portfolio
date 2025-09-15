# Skill Management Software Design Guidelines

## Design Approach: Enterprise System with Visual Hierarchy
**Selected Approach**: Design System (Material Design) with enterprise customization
**Justification**: This is a data-heavy, multi-role enterprise application requiring consistency, accessibility, and clear information architecture across complex workflows.

## Core Design Elements

### A. Color Palette
**Primary Colors (Dark Mode)**:
- Primary: 220 85% 65% (Professional blue for navigation, CTAs)
- Secondary: 220 15% 25% (Dark backgrounds, cards)
- Surface: 220 10% 15% (Main background)

**Primary Colors (Light Mode)**:
- Primary: 220 85% 50% (Professional blue)
- Secondary: 220 5% 95% (Light backgrounds, cards)
- Surface: 0 0% 98% (Main background)

**Accent Colors**:
- Success: 142 76% 40% (Competency achieved, assessments passed)
- Warning: 38 92% 55% (Pending assessments, expiring certifications)
- Danger: 0 84% 55% (Failed assessments, expired certifications)
- Info: 199 89% 48% (Learning resources, system notifications)

### B. Typography
**Font Family**: Inter (via Google Fonts CDN)
- **Headers**: Inter 600 (Semi-bold) for section titles and dashboard headers
- **Subheaders**: Inter 500 (Medium) for card titles and form labels
- **Body**: Inter 400 (Regular) for content and data tables
- **Small**: Inter 400 (Regular) at smaller sizes for metadata and timestamps

### C. Layout System
**Spacing Units**: Tailwind units of 2, 4, 6, and 8 (0.5rem, 1rem, 1.5rem, 2rem)
- Component padding: p-4 or p-6
- Section margins: mb-6 or mb-8
- Card spacing: gap-4 between elements
- Grid gaps: gap-6 for dashboard layouts

### D. Component Library

**Navigation**:
- Top navigation bar with role-based menu items
- Sidebar navigation for main sections (Skills, Assessments, Teams, Analytics)
- Breadcrumb navigation for deep workflows
- Role indicator badge in header

**Data Display**:
- **Team Matrix**: Grid-based competency heatmap with color-coded proficiency levels
- **Skills Cards**: Compact cards showing skill name, level, and status
- **Assessment Tables**: Sortable tables with status indicators and action buttons
- **Progress Indicators**: Linear progress bars for competency completion
- **Status Badges**: Color-coded badges for assessment status (Pending, Passed, Failed, Expired)

**Forms & Input**:
- **Assessment Builder**: Multi-step form with drag-drop skill assignment
- **Evidence Upload**: Drag-drop zones with preview for documents/media
- **Search & Filter**: Advanced search with multi-select filters for roles, skills, locations
- **Date Pickers**: For assessment validity periods and expiry dates

**Dashboard Components**:
- **KPI Cards**: Metric cards showing workforce readiness percentages
- **Competency Overview**: Donut charts showing skills distribution
- **Gap Analysis**: Bar charts highlighting skill shortages
- **Upcoming Assessments**: Timeline view of pending evaluations

**Role-Specific Interfaces**:
- **Candidate Dashboard**: Personal skills portfolio with required actions
- **Assessor Interface**: Assessment workflow with evidence review
- **Admin Panel**: System configuration and user management
- **Manager View**: Team oversight with assignment capabilities

**Offline Capability**:
- **Sync Indicators**: Clear status showing online/offline mode
- **Local Storage UI**: Visual feedback for cached vs. synced data
- **iPad Optimized**: Touch-friendly controls with larger tap targets

### E. Visual Hierarchy Principles
- **Information Density**: Balanced density appropriate for enterprise users
- **Progressive Disclosure**: Complex workflows broken into digestible steps
- **Status Communication**: Clear visual indicators for assessment states and deadlines
- **Role Adaptation**: Interface elements adjust based on user permissions

**Animations**: Minimal and functional only - subtle transitions for state changes and loading indicators. No decorative animations that could impact enterprise performance requirements.

## Images
**No large hero images** - This is an enterprise application focused on data and workflows rather than marketing appeal. Use icons from Heroicons for navigation and status indicators throughout the interface.