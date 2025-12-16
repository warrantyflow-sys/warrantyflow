# Code Structure & Architecture Deep Dive

This document provides a technical deep dive into the **Warranty Management System** codebase. It is intended for developers who need to understand *how* the application works under the hood, beyond just the folder structure.

## 🏗️ Architectural Pattern

The application follows a **Serverless / Client-Side Rendering (CSR)** hybrid approach using Next.js 15 and Supabase.

### Data Flow Pipeline
1.  **Database (Supabase/PostgreSQL)**: The single source of truth.
2.  **RPC/Edge Layer (Postgres Functions)**: Complex business logic (filtering, searching across relations) is encapsulated in SQL functions (RPCs) to minimize client-side processing and network round-trips.
3.  **API Layer (`src/lib/api`)**: TypeScript wrapper functions that call Supabase client methods. These functions handle data normalization and error standardization.
4.  **State Layer (`src/hooks/queries`)**: [TanStack Query](https://tanstack.com/query) hooks that wrap the API layer. This provides caching, deduplication, and automatic background refetching.
5.  **UI Layer (`src/app` & `src/components`)**: React components that consume data *only* via the custom hooks.

## 🔄 Key Architectural Concepts

### 1. Realtime Data Sync
The system relies heavily on **Supabase Realtime** to keep different users in sync (e.g., when a Store creates a warranty, the Admin sees it immediately).

**Pattern:**
*   React Query hooks subscribe to Postgres changes via `supabase.channel()`.
*   When a change event (`INSERT`, `UPDATE`, `DELETE`) occurs, the hook triggers `queryClient.invalidateQueries()`.
*   This forces a re-fetch of the data, ensuring the UI reflects the latest server state without manual page reloads.

**Example (`src/hooks/queries/useRepairs.ts`):**
```typescript
useEffect(() => {
  const channel = supabase
    .channel('repairs-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'repairs' }, () => {
      queryClient.invalidateQueries({ queryKey: ['repairs'] });
    })
    .subscribe();
    
  return () => { supabase.removeChannel(channel); };
}, []);
```

### 2. Role-Based Access Control (RBAC)
Security is enforced at multiple levels:
*   **Database (Row Level Security - RLS)**: Postgres policies ensure users can only query/mutate data allowed for their role (e.g., Labs can only see their own repairs).
*   **Middleware (`src/middleware.ts`)**: Next.js middleware checks the user's role on every route change (`/admin/*`, `/store/*`, `/lab/*`) and redirects unauthorized access.
*   **UI Hiding**: Components conditionally render elements based on the user's role helper functions (`useCurrentUser`).

### 3. Server-Side Pagination
Due to potentially large datasets (thousands of devices/repairs), pagination is handled on the server (Postgres) via RPC functions.

**Why RPCs?**
Supabase's standard JS client has limitations when filtering/sorting deeply nested relationships. We use custom SQL functions (e.g., `get_repairs_paginated`) to perform efficient joins and filtering on the database server.

## 📁 Critical Directories & Files

### `src/lib/supabase`
*   `database.types.ts`: **Auto-generated** TypeScript definitions from the SQL schema. **Do not edit manually.**
*   `client.ts`: Singleton instance of the Supabase client for client-side components.
*   `server.ts`: Helper to create a Supabase client in Server Components/Actions (handles cookie forwarding).

### `src/lib/api`
Contains "Service" files. Each file corresponds to a domain (e.g., `repairs.ts`, `devices.ts`).
*   **Responsibility**: Execute the actual network request.
*   **Return Type**: Typed Promises (e.g., `Promise<Repair[]>`).
*   **No React logic**: These are pure JS/TS functions.

### `src/hooks/queries`
Contains the "Controller" logic connecting React to the API.
*   **Naming Convention**: `use[Entity]`, `use[Entity]Mutation`.
*   **Responsibility**: Manage `isLoading`, `error` states, and cache keys (`queryKey`).

### `src/components/ui`
Atomic, reusable components (Buttons, Inputs, Dialogs).
*   **Philosophy**: Stateless and "dumb". They receive props and emit events.
*   **Styling**: Built with Radix UI primitives and styled via Tailwind CSS.
*   **Utils**: heavily utilize `cn()` from `src/lib/utils.ts` for conditional class merging.

## 🛠️ Common Development Tasks

### Adding a New Feature
1.  **Database**: Create table/columns and RLS policies (in SQL).
2.  **Types**: Run `npx supabase gen types typescript` to update `database.types.ts`.
3.  **API**: Create a function in `src/lib/api/[feature].ts` to fetch/mutate the data.
4.  **Hook**: Create a React Query hook in `src/hooks/queries/use[Feature].ts`.
5.  **UI**: Build the component in `src/components/[role]/` and consume the hook.

### Handling Forms
We use **React Hook Form** + **Zod**.
1.  Define a Zod schema (validation rules).
2.  Infer the TypeScript type from the schema.
3.  Pass the `register` and `handleSubmit` handlers to the UI components.

## ⚠️ Important Notes
*   **Strict Mode**: The app runs in React Strict Mode. Effects may fire twice in dev; ensure cleanup functions in `useEffect` are correct.
*   **Environment**: Always access environment variables via `process.env` or the helpers in `src/lib/env-validation.ts` to ensure type safety.
