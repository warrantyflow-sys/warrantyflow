# Warranty Management System

## Project Overview

This project is a comprehensive Warranty Management System designed for an importer. It manages the full lifecycle of device warranties, repairs, and replacements. The system facilitates coordination between three main user roles:

*   **Admin**: Oversees the entire system, manages users, device models, repairs, and financial reports.
*   **Store**: Activates warranties for customers and manages device sales.
*   **Lab**: Handles device repairs, updates repair status, and manages repair pricing.

## Technology Stack

*   **Frontend**: [Next.js 15](https://nextjs.org/) (React Framework)
*   **Language**: [TypeScript](https://www.typescriptlang.org/)
*   **Database & Auth**: [Supabase](https://supabase.com/) (PostgreSQL)
*   **Styling**: [Tailwind CSS](https://tailwindcss.com/)
*   **UI Components**: [Radix UI](https://www.radix-ui.com/) (Headless UI), customized with Tailwind.
*   **State Management**: [Zustand](https://github.com/pmndrs/zustand)
*   **Data Fetching**: [TanStack Query](https://tanstack.com/query/latest)
*   **Form Handling**: [React Hook Form](https://react-hook-form.com/) with [Zod](https://zod.dev/) validation.
*   **Icons**: [Lucide React](https://lucide.dev/)

## Architecture & Directory Structure

*   `src/app`: App Router structure. Contains pages, layouts, and route groups for different roles (`admin`, `store`, `lab`).
*   `src/components`: Reusable UI components.
    *   `ui`: Basic building blocks (buttons, inputs, etc.).
    *   `shared`: Components used across different roles.
    *   `admin`, `store`, `lab`: Role-specific components.
*   `src/lib`: Utility functions and configurations.
    *   `supabase`: Supabase client and server configurations, including database types.
    *   `api`: Typed API wrapper functions for interacting with Supabase.
*   `src/hooks`: Custom React hooks, primarily for data fetching (React Query wrappers).
*   `src/types`: TypeScript type definitions shared across the application.
*   `public`: Static assets.

## Database Schema (Supabase)

Key tables include:
*   `users`: Stores user profiles and roles (`admin`, `store`, `lab`).
*   `devices`: Inventory of devices (IMEI, model, etc.).
*   `warranties`: Tracks warranty activation and expiry.
*   `repairs`: Manages repair tickets, status, and costs.
*   `replacement_requests`: Handles requests for device replacements.
*   `payments`: Tracks payments to labs.
*   `notifications`: System notifications for users.

## Building and Running

### Prerequisites

*   Node.js (LTS recommended)
*   npm or yarn

### Development

To start the development server:

```bash
npm run dev
# or
yarn dev
```

The application will be available at `http://localhost:3000`.

### Build

To build the application for production:

```bash
npm run build
# or
yarn build
```

### Start Production Server

```bash
npm start
# or
yarn start
```

### Linting

```bash
npm run lint
```

## Development Conventions

*   **Type Safety**: Strict TypeScript usage is enforced. Database types are generated from Supabase and should be used for all data interactions.
*   **Component Structure**: Components should be small, focused, and placed in the appropriate directory based on their scope (shared vs. role-specific).
*   **Data Fetching**: Use custom hooks in `src/hooks/queries` which utilize TanStack Query for caching and state management. Avoid direct `useEffect` calls for data fetching where possible.
*   **Styling**: Use Tailwind CSS utility classes. For complex conditional styling, use `cn` (classnames) utility.
*   **Forms**: Use `react-hook-form` controlled by `zod` schemas for validation.
