# Warranty Management System (WMS)

A comprehensive web application for managing device warranties, repairs, and replacements for an electronics importer. The system orchestrates workflows between the main administration, retail stores, and repair labs.

## 🚀 Tech Stack

- **Framework:** [Next.js 15](https://nextjs.org/) (App Router)
- **Language:** TypeScript
- **Database & Auth:** [Supabase](https://supabase.com/) (PostgreSQL)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **UI Components:** [Radix UI](https://www.radix-ui.com/) (Headless) + [Lucide React](https://lucide.dev/) (Icons)
- **State Management:** React Context / Hooks (Local) + TanStack Query (Server)
- **Data Fetching:** [TanStack Query](https://tanstack.com/query/latest)
- **Forms:** [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/) validation

## 📂 Project Structure

```
├── src/
│   ├── app/                 # Next.js App Router pages & layouts
│   │   ├── admin/           # Admin portal routes
│   │   ├── store/           # Store portal routes
│   │   ├── lab/             # Lab portal routes
│   │   └── api/             # Backend API routes
│   ├── components/
│   │   ├── ui/              # Reusable generic UI components (buttons, inputs)
│   │   ├── shared/          # Components used across multiple roles
│   │   ├── admin/           # Admin-specific components
│   │   ├── store/           # Store-specific components
│   │   └── lab/             # Lab-specific components
│   ├── hooks/               # Custom React hooks (mostly React Query wrappers)
│   ├── lib/
│   │   ├── supabase/        # Supabase client/server setup & types
│   │   └── utils.ts         # General utility functions
│   ├── middleware.ts        # Auth & Role-based routing middleware
│   └── types/               # Global TypeScript definitions
```

## 🔐 Authentication & Roles

The system uses Supabase Authentication and handles three distinct user roles. Access control is enforced via `src/middleware.ts` and Row Level Security (RLS) policies in the database.

### Roles
1.  **Admin (`admin`)**:
    *   Full system access.
    *   Manage users (Stores, Labs), device models, and inventory.
    *   View financial reports and approve/reject replacement requests.
    *   Dashboard: `/admin/dashboard`

2.  **Store (`store`)**:
    *   Activate warranties for sold devices.
    *   View device history and check warranty status.
    *   Dashboard: `/store/dashboard`

3.  **Lab (`lab`)**:
    *   Receive repair tickets and update repair status.
    *   Manage repair pricing (per model/repair type).
    *   Track earnings and payments.
    *   Dashboard: `/lab/dashboard`

## 🗄️ Database Schema

The core tables in Supabase (PostgreSQL) are:

*   **`users`**: Extended user profile linked to Supabase Auth `auth.users`. Stores role, name, and active status.
*   **`devices`**: The central inventory table. Key fields: `imei`, `model_id`, `warranty_months`.
*   **`warranties`**: Records warranty activation. Links a `device` to a `store` and sets `expiry_date`.
*   **`repairs`**: Tracks individual repair jobs. Links `device`, `lab`, and `repair_type`. Status flow: `received` -> `in_progress` -> `completed`.
*   **`replacement_requests`**: When a device cannot be repaired. Requires Admin approval.
*   **`device_models`**: Catalog of supported devices (Manufacturer, Model Name).
*   **`repair_types`**: Standardized list of repairs (Screen, Battery, Board, etc.).
*   **`payments`**: Financial records of payments made to Labs.

*Note: See `src/lib/supabase/database.types.ts` for strict type definitions.*

## 🛠️ Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- npm or yarn
- A local or remote Supabase instance

### Environment Variables
Create a `.env.local` file in the root directory:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

The app will be available at `http://localhost:3000`.

## 📦 Development Workflow

1.  **Database Changes**: If you modify the database schema, run the Supabase type generator to keep TypeScript definitions in sync:
    ```bash
    npx supabase gen types typescript --project-id "your-project-id" > src/lib/supabase/database.types.ts
    ```

2.  **Components**: Use the `src/components/ui` folder for atomic components. Complex features should be broken down into smaller components within `src/components/[role]`.

3.  **Data Fetching**: Do not fetch data directly in components. Create a custom hook in `src/hooks/queries` using TanStack Query. This ensures caching, deduplication, and consistent loading states.

## 🧪 Testing & Quality

- **Linting**: `npm run lint`
- **Type Checking**: `npm run type-check` (runs `tsc --noEmit`)
- **Formatting**: `npm run format` (Prettier)

## 📄 License

Private Project.
