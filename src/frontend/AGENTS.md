# AGENTS.md — Matcha Frontend

> Bank reconciliation dashboard built with Next.js (App Router), React 19, TypeScript, Tailwind CSS v4, and shadcn/ui.

---

## Project Overview

**Matcha** is a bank reconciliation system. This frontend provides:

- A **public landing page** (`/landing-page`) — minimalistic, Modal.com-inspired marketing page using the Matcha green accent color.
- **Authentication pages** (`/auth/login`, `/auth/signup`) — login form and a WIP registration notice. The app is currently in active development and does not accept new users.
- A **dashboard** (`/dashboard`) — the core app experience for managing account books, viewing yearly/monthly transaction summaries, and tracking transaction matching (reconciliation) status. The dashboard uses a drill-down navigation pattern: Account → Year → Month → Transactions.

The root route (`/`) redirects to `/landing-page`.

The project lives at `src/frontend/` within a monorepo that also contains `src/backend/`.

---

## Tech Stack

| Layer            | Technology                                                      |
| ---------------- | --------------------------------------------------------------- |
| Framework        | **Next.js 16.1.6** (App Router, React Server Components)        |
| Language         | **TypeScript 5** (strict mode)                                  |
| UI Library       | **React 19.2.3**                                                |
| Styling          | **Tailwind CSS v4** via `@tailwindcss/postcss`                  |
| Component System | **shadcn/ui** (radix-lyra style) with **Radix UI** primitives   |
| Icons            | **Hugeicons** (`@hugeicons/react` + `@hugeicons/core-free-icons`) |
| Class Utilities  | `clsx` + `tailwind-merge` (via the `cn()` helper)               |
| Font             | **JetBrains Mono** (loaded via `next/font/google`)              |
| Linting          | **ESLint 9** with `eslint-config-next` (core-web-vitals + typescript) |
| Data Fetching    | **TanStack React Query** (`@tanstack/react-query`) — caching, deduplication, background refetch for all API calls |
| Data / tables    | **TanStack React Table** (`@tanstack/react-table`) — used by the shared `DataTable` component |
| Charts           | **Recharts** — used for dashboard visualizations (e.g. in dashboard-year, dashboard-month) |

---

## Quick Start

```sh
# From src/frontend/
npm install
npm run dev          # Start dev server on http://localhost:3000
npm run build        # Production build
npm run start        # Serve production build
npm run lint         # Run ESLint
```

---

## Directory Structure

```bash
src/frontend/
├── app/                    # Next.js App Router pages and layouts
│   ├── layout.tsx          # Root layout (font, metadata, global CSS)
│   ├── page.tsx            # Root redirect → /landing-page
│   ├── globals.css         # Tailwind imports, CSS custom properties, theme
│   ├── landing-page/
│   │   └── page.tsx        # Public-facing landing page (server component)
│   ├── auth/
│   │   ├── login/
│   │   │   └── page.tsx    # Login page (client component)
│   │   ├── signup/
│   │   │   └── page.tsx    # WIP notice — registration closed (server component)
│   │   └── _signup/
│   │       └── page.tsx    # Original signup form, preserved but unrouted (client component)
│   └── dashboard/
│       ├── layout.tsx      # Dashboard layout (sidebar, breadcrumb; client)
│       ├── page.tsx        # Redirects to first account
│       ├── [accountId]/
│       │   ├── page.tsx    # Account-level view
│       │   ├── [year]/
│       │   │   ├── page.tsx    # Year-level view
│       │   │   └── [month]/
│       │   │       └── page.tsx    # Month-level view
│       │   └── ...
│       └── ...
├── components/
│   ├── ui/                 # shadcn/ui primitives (DO NOT edit manually)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── chart.tsx
│   │   ├── dialog.tsx
│   │   ├── sidebar.tsx
│   │   ├── skeleton.tsx
│   │   ├── table.tsx
│   │   ├── tabs.tsx
│   │   └── ... (25 components)
│   ├── app-sidebar.tsx        # Main sidebar navigation with account/year/month tree
│   ├── dashboard-account.tsx  # Account-level dashboard view
│   ├── dashboard-year.tsx     # Year-level dashboard view
│   ├── dashboard-month.tsx    # Month-level dashboard with transaction table
│   ├── data-table.tsx         # Generic data table (sorting, filtering, pagination; TanStack Table)
│   ├── upload-dialog.tsx      # File upload dialog (drag-and-drop); statement/ledger uploads
│   ├── component-example.tsx  # shadcn component showcase
│   └── example.tsx            # Example wrapper utilities
├── hooks/
│   ├── use-mobile.ts          # Responsive breakpoint hook (768px)
│   ├── use-accounts.ts        # React Query hooks for account books (useAccounts, useAccountBook, useAccountBooks)
│   ├── use-statements.ts      # React Query hooks for bank statements and lines
│   ├── use-receipts.ts        # React Query hooks for parsed receipts
│   ├── use-documents.ts       # React Query hooks for document CRUD
│   ├── use-document-upload.ts # S3 presigned-URL upload flow with progress tracking
│   ├── use-admin-users.ts     # React Query hooks for admin user management
│   └── use-account-members.ts # React Query hooks for account book members
├── lib/
│   ├── utils.ts            # `cn()` class merging utility
│   ├── api.ts              # API client — all backend endpoint functions (auth, documents, receipts, statements, accounts, admin)
│   ├── auth.tsx            # AuthProvider context and useAuth() hook (JWT + localStorage)
│   ├── types.ts            # API response types mirroring backend Pydantic schemas (snake_case)
│   ├── transforms.ts       # Pure functions converting API types → frontend view types (AccountBook, YearData, etc.)
│   ├── query-client.tsx    # React Query QueryClientProvider wrapper
│   ├── dashboard-routes.ts # Dashboard URL helpers (selectionToPath, parseDashboardPath)
│   ├── constants.ts        # Shared constants (MONTH_LABELS, chart config, match rate badge variant)
│   └── domain-types.ts     # Frontend domain types (AccountBook, YearData, MonthData, Transaction) and formatting utilities
├── public/                 # Static assets (SVGs)
├── components.json         # shadcn/ui configuration
├── next.config.ts          # Next.js configuration
├── tsconfig.json           # TypeScript configuration
├── eslint.config.mjs       # ESLint flat config
├── postcss.config.mjs      # PostCSS config (Tailwind)
└── package.json
```

---

## Architecture & Conventions

### App Router & Routing

- Uses the **Next.js App Router** (`app/` directory).
- React Server Components are enabled (`rsc: true` in `components.json`), but interactive pages (dashboard, auth forms) use `"use client"`.
- Page components use **default exports**. All other components use **named exports**.

#### Route Map

| Route           | File                                          | Type     | Description                                      |
| --------------- | --------------------------------------------- | -------- | ------------------------------------------------ |
| `/`             | `app/page.tsx`                                | Server   | Redirects to `/landing-page`                     |
| `/landing-page` | `app/landing-page/page.tsx`                   | Server   | Public marketing page (minimalistic, Modal.com-inspired) |
| `/auth/login`   | `app/auth/login/page.tsx`                     | Client   | Login form (email + password)                    |
| `/auth/signup`  | `app/auth/signup/page.tsx`                    | Server   | WIP notice — registration currently closed       |
| *(unrouted)*    | `app/auth/_signup/page.tsx`                   | Client   | Original signup form, preserved for future use   |
| `/dashboard`    | `app/dashboard/page.tsx`                       | Client   | Redirects to first account (`/dashboard/[accountId]`) via `useAccountBooks()` |
| `/dashboard/[accountId]` | `app/dashboard/[accountId]/page.tsx`   | Client   | Account-level dashboard view (drill-down entry)  |
| `/dashboard/[accountId]/[year]` | `app/dashboard/[accountId]/[year]/page.tsx` | Client | Year-level dashboard view                        |
| `/dashboard/[accountId]/[year]/[month]` | `app/dashboard/[accountId]/[year]/[month]/page.tsx` | Client | Month-level dashboard view (transactions) |

Dashboard drill-down state is URL-driven: the path reflects the current account/year/month, so refreshing the page keeps the same view. The shared layout (`app/dashboard/layout.tsx`) derives selection from the pathname and renders the sidebar and breadcrumb; navigation uses `router.push` to update the URL.

### Path Aliases

The `@/*` alias maps to the project root (`./`). Always use it for imports:

```ts
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AppSidebar } from "@/components/app-sidebar";
```

### Component Organization

| Directory          | Purpose                                          | Editable? |
| ------------------ | ------------------------------------------------ | --------- |
| `components/ui/`   | shadcn/ui primitives managed by the shadcn CLI   | **No** — use `npx shadcn add <component>` to add/update |
| `components/`      | Custom application components                    | **Yes**   |
| `hooks/`           | Custom React hooks                               | **Yes**   |
| `lib/`             | Utilities, helpers, data layer                   | **Yes**   |

**Do NOT manually edit files in `components/ui/`.** These are generated by shadcn and may be overwritten. If you need to customize a shadcn component, extend or wrap it in `components/`.

### Key Application Components

- **DataTable** — Generic, type-parameterized table built on TanStack React Table; supports sorting, column filters, pagination, optional toolbar and row click. Used for transaction lists in the month view and for year-level summary tables.
- **UploadDialog** — Trigger + dialog for file upload (e.g. bank statements, receipts) with drag-and-drop and configurable accept types. Connected to the backend via `useDocumentUpload` hook (presigned S3 URLs). Automatically associates uploaded documents with the current `account_id`.
- **AppSidebar** — Main sidebar navigation. Receives `accountBooks` (fetched via API) as a prop from the dashboard layout; renders an account selector and collapsible year/month tree.

### Adding New shadcn/ui Components

```sh
npx shadcn add <component-name>
```

The shadcn config (`components.json`) is set to:
- **Style**: `radix-lyra`
- **Icon library**: `hugeicons`
- **Base color**: `neutral`
- **CSS variables**: enabled
- **RSC**: enabled

### Styling

- Use **Tailwind CSS utility classes** for all styling. No CSS modules or styled-components.
- Use the `cn()` helper from `@/lib/utils` to conditionally merge class names:
  ```ts
  className={cn("base-classes", conditional && "conditional-classes")}
  ```
- The design system uses **CSS custom properties** defined in `app/globals.css` with `oklch` color values.
- Dark mode is handled via `@media (prefers-color-scheme: dark)` and the `.dark` class.
- Semantic color tokens: `--background`, `--foreground`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--card`, `--popover`, `--sidebar-*`, `--chart-1` through `--chart-5`.

### Icons

Use Hugeicons. Import icon definitions from `@hugeicons/core-free-icons` and render with `<HugeiconsIcon>`:

```tsx
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";

<HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
```

### TypeScript

- **Strict mode** is enabled in `tsconfig.json`.
- Target: `ES2017`.
- All files must be `.ts` or `.tsx`.
- Prefer explicit types for component props (use `interface` for props).
- **API response types** (snake_case, matching backend Pydantic schemas) are in `lib/types.ts`: `AccountBookRead`, `BankStatementRead`, `BankStatementLineRead`, `ReceiptRead`, `DocumentRead`, plus enums like `MatchStatus`, `DocumentStatus`.
- **Frontend view types** (camelCase, used by dashboard components) are in `lib/domain-types.ts`: `Transaction`, `MonthData`, `YearData`, `AccountBook`, `Selection`, `SelectionLevel`.
- **Transforms** in `lib/transforms.ts` convert API types → view types. Dashboard components consume view types only.

### State Management

- Uses **React `useState`** for local component state where needed.
- **Server state** (accounts, statements, receipts, documents) is managed by **TanStack React Query**. The `QueryProvider` wraps the app in `app/layout.tsx`. Query keys are organized per domain (e.g. `accountKeys`, `statementKeys`). Mutations automatically invalidate related queries.
- **Dashboard selection** (account, year, month) is **URL-driven**: the pathname (e.g. `/dashboard/1/2024/3`) is the source of truth. The dashboard layout parses the path via `lib/dashboard-routes.ts` (`parseDashboardPath`, `pathToSelection`) and passes the derived `Selection` to the sidebar and breadcrumb; changing selection is done via `router.push(selectionToPath(...))`, not local state. This allows deep links and preserves the current view on refresh.

### Data Layer

The frontend fetches all data from the FastAPI backend (`NEXT_PUBLIC_API_URL`). The data flows through three layers:

1. **API client** (`lib/api.ts`) — Thin async functions wrapping `fetch` for every backend endpoint. Handles auth headers, error parsing, and query-string construction. Organized by tier: auth, documents, receipts, statements, accounts, admin users.
2. **React Query hooks** (`hooks/use-*.ts`) — One file per domain: `use-accounts.ts`, `use-statements.ts`, `use-receipts.ts`, `use-documents.ts`, `use-admin-users.ts`, `use-account-members.ts`, plus `use-document-upload.ts` for the S3 upload flow. Each exports query hooks (read) and mutation hooks (write) with automatic cache invalidation.
3. **Transforms** (`lib/transforms.ts`) — Pure functions that convert API response types (flat, snake_case) into the hierarchical view types used by dashboard components. Key transforms: `apiAccountToAccountBook()`, `statementsToYearData()`, `statementToMonthData()`, `lineToTransaction()`.

Helper functions: `formatCurrency()`, `formatNumber()` (in `lib/domain-types.ts`).

#### Connected Backend Endpoints

| Tier | Endpoints | Frontend hooks |
|------|-----------|----------------|
| **Tier 1** — Auth & Upload | `POST /auth/login`, `GET /auth/me`, `POST /documents/upload-url`, `POST /documents/{id}/confirm-upload` | `useAuth()`, `useDocumentUpload()` |
| **Tier 2** — Documents | `GET /documents`, `GET /documents/{id}`, `DELETE /documents/{id}` | `useDocuments()`, `useDocument()`, `useDeleteDocument()` |
| **Tier 3** — Receipts | `GET /receipts`, `GET /receipts/{id}`, `PATCH /receipts/{id}`, `GET /receipts/{id}/file-url` | `useReceipts()`, `useReceipt()`, `useUpdateReceipt()`, `useReceiptFileUrl()` |
| **Tier 3** — Statements | `GET /statements`, `GET /statements/{id}`, `GET /statements/{id}/lines`, `PATCH /statements/{id}/lines/{lineId}`, `GET /statements/{id}/file-url` | `useStatements()`, `useStatement()`, `useStatementLines()`, `useUpdateStatementLine()`, `useStatementFileUrl()` |
| **Tier 5** — Accounts | `POST /accounts`, `GET /accounts`, `GET /accounts/{id}`, `PATCH /accounts/{id}`, `DELETE /accounts/{id}` | `useAccounts()`, `useAccount()`, `useAccountBook()`, `useAccountBooks()`, `useCreateAccount()`, `useUpdateAccount()`, `useDeleteAccount()` |
| **Tier 5** — Members | `GET /accounts/{id}/members`, `POST /accounts/{id}/members`, `DELETE /accounts/{id}/members/{userId}` | `useAccountMembers()`, `useAddAccountMember()`, `useRemoveAccountMember()` |
| **Tier 5** — Admin Users | `GET /admin/users`, `POST /admin/users`, `GET /admin/users/{id}`, `PATCH /admin/users/{id}`, `DELETE /admin/users/{id}` | `useAdminUsers()`, `useCreateAdminUser()`, `useUpdateAdminUser()`, `useDeactivateAdminUser()` |

---

## Key Domain Concepts

| Concept              | Description                                                             |
| -------------------- | ----------------------------------------------------------------------- |
| **Account Book**     | A bank account with metadata (name, bank, account number, currency). Backend: `AccountBookRead`. Frontend view: `AccountBook`. |
| **Bank Statement**   | A parsed bank statement for a specific account/month/year. Backend: `BankStatementRead` / `BankStatementDetailRead`. |
| **Statement Line**   | A single transaction line within a bank statement. Backend: `BankStatementLineRead`. Frontend view: `Transaction`. |
| **Receipt**          | An AI-parsed receipt linked to a document. Backend: `ReceiptRead`. |
| **Document**         | An uploaded file (receipt or bank statement) tracked through processing stages. Backend: `DocumentRead`. |
| **Year Data**        | Aggregate financial data for a calendar year within an account (computed client-side from statements). Frontend view: `YearData`. |
| **Month Data**       | Monthly breakdown with transactions, balances, and reconciliation stats (computed from statement lines). Frontend view: `MonthData`. |
| **Match Rate**       | Percentage of transactions successfully matched to receipts. Derived from `match_status` on statement lines. |
| **Match Status**     | Enum: `unmatched`, `perfect_matched`, `bundle_matched`, `manual`. Present on both statement lines and receipts. |
| **Reconciliation**   | Process of matching bank statement transactions to receipts/internal records |
| **Selection**        | Navigation state tracking current account, year, month, and drill level |

---

## Navigation & Page Flow

### User Flow

1. **Landing page** (`/landing-page`) — Public entry point with hero, feature grid, and CTAs linking to auth.
2. **Auth** — `/auth/login` presents a login form. `/auth/signup` currently shows a **Work in Progress** notice indicating registration is closed during active development. The original signup form is preserved at `app/auth/_signup/page.tsx` (private, unrouted via the `_` prefix) and can be re-enabled by moving it back to `app/auth/signup/page.tsx` when the app is ready to accept new users.
3. **Dashboard** (`/dashboard`) — Authenticated experience. Auth guard in `app/dashboard/layout.tsx` redirects unauthenticated users to `/auth/login`. Data is fetched from the backend API via React Query hooks.

### Dashboard Drill-Down

The dashboard uses a **drill-down** pattern:

1. **Account level** (`DashboardAccount`) — Overview of all years for the selected account.
2. **Year level** (`DashboardYear`) — Monthly breakdown for a selected year.
3. **Month level** (`DashboardMonth`) — Transaction table for a selected month.

Navigation state is tracked in the URL (e.g. `/dashboard/[accountId]/[year]/[month]`). The dashboard layout derives `Selection` from the path and passes it to the breadcrumb and `AppSidebar`; sidebar and breadcrumb navigate via `router.push`. The `AppSidebar` provides a tree-based navigation alternative.

---

## Coding Style

- Use `"use client"` directive only when the component requires client-side interactivity (state, effects, event handlers).
- Prefer **named function declarations** for components (`export function MyComponent() {}`).
- Use **Prettier-style formatting**: 4-space indentation in TSX, trailing commas.
- Keep components focused — extract sub-components and hooks when complexity grows.
- Place reusable hooks in `hooks/`, utilities in `lib/`.

---

## Common Tasks

### Add a new page

Create a new directory under `app/` with a `page.tsx` file:
```
app/new-route/page.tsx
```

Public pages (no auth required) should be server components when possible. Pages needing interactivity (forms, state) use `"use client"`.

### Add a new component

Create a new `.tsx` file in `components/`:
```
components/my-component.tsx
```
Use named exports and define a props interface.

### Add a new hook

Create a new `.ts` file in `hooks/`:
```
hooks/use-my-hook.ts
```

### Modify theming / colors

Edit CSS custom properties in `app/globals.css` under `:root` (light) and the dark mode blocks.

---

### Add a new API endpoint

1. Add the TypeScript response/request types to `lib/types.ts` (match backend Pydantic schema, snake_case).
2. Add the endpoint function to `lib/api.ts` following the existing `request<T>()` pattern. Add it to the `apiClient` barrel export.
3. Create a React Query hook in `hooks/use-<domain>.ts` using `useQuery` (reads) or `useMutation` (writes). Define a query key factory at the top of the file.
4. If the response needs transformation for dashboard components, add a transform function to `lib/transforms.ts`.
5. Update this `AGENTS.md` if the new endpoint connects a new tier or adds a major feature.

---

## Things to Avoid

- **Do not** edit files in `components/ui/` manually — they are managed by shadcn CLI.
- **Do not** use inline styles or CSS modules — use Tailwind utility classes.
- **Do not** install alternative icon libraries — use Hugeicons consistently.
- **Do not** use `any` types — leverage TypeScript strict mode fully.
- **Do not** add `"use client"` to components that don't need it — prefer server components where possible.
- **Do not** hardcode color values — use the semantic CSS custom property tokens (e.g., `text-foreground`, `bg-primary`).
- **Do not** import mock data or static constants for API-backed data — use React Query hooks instead.
- **Do not** call `fetch()` directly in components — use the API client functions in `lib/api.ts` wrapped by hooks.

---

## Testing

No test framework is currently configured. When adding tests:
- Prefer **Vitest** or **Jest** with **React Testing Library** for component tests.
- Place test files adjacent to source files as `*.test.tsx` or in a `__tests__/` directory.

---

## Environment & Deployment

- **Node.js** is required (see `engines` in `package.json` or use the latest LTS).
- Environment variables should be placed in `.env.local` (gitignored).
- Prefix client-side env vars with `NEXT_PUBLIC_`.
- **Required env var**: `NEXT_PUBLIC_API_URL` — base URL of the FastAPI backend (e.g. `http://localhost:8000`). All API calls use this.
- The project is deployable to **Vercel** or any platform supporting Next.js.

---

## Maintaining AGENTS.md

Keep this file in sync with the codebase when making structural or stack changes:

- **Directory structure** — Update when adding or removing top-level directories or notable files (e.g. new app routes, new components in `components/`, new hooks or lib modules).
- **Tech stack** — Update when adding major UI or data dependencies; keep in sync with `package.json`.
- **Route map** — Update when adding or changing routes.
- **Key application components** — Update when introducing or removing shared components (e.g. new tables, dialogs, or layout components).