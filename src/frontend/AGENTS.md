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
│       ├── global-admin/
│       │   └── page.tsx    # Developer-only tenant management (client component)
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
│   ├── dashboard-month.tsx    # Month-level dashboard with transaction table + AI reconciliation summary tab
│   ├── data-table.tsx         # Generic data table (sorting, filtering, pagination; TanStack Table)
│   ├── upload-dialog.tsx      # File upload dialog (drag-and-drop); statement/ledger uploads
│   ├── job-status-float.tsx   # Floating bottom-right widget showing active parsing/reconciliation job progress
│   ├── viewer-mode-banner.tsx # Amber strip when user.role is viewer (read-only mode reminder)
│   ├── developer-console-shell.tsx # Minimal header for `/dashboard/global-admin` (developer tenant console)
│   ├── developer-global-admin-panel.tsx # Tenants + account books tables, user/member dialogs
│   ├── component-example.tsx  # shadcn component showcase
│   └── example.tsx            # Example wrapper utilities
├── hooks/
│   ├── use-mobile.ts          # Responsive breakpoint hook (768px)
│   ├── use-accounts.ts        # React Query hooks for account books (useAccounts, useAccountBook, useAccountBooks)
│   ├── use-statements.ts      # React Query hooks for bank statements and lines
│   ├── use-receipts.ts        # React Query hooks for parsed receipts
│   ├── use-documents.ts       # React Query hooks for document CRUD
│   ├── use-document-upload.ts # S3 presigned-URL upload flow with progress tracking
│   ├── use-tracked-document-upload.ts # Wrapper around use-document-upload that auto-registers parsing jobs with the job status tracker
│   ├── use-job-status.ts      # Job status polling hook and context (TrackedJob state, trackJob/dismissJob API)
│   ├── use-admin-users.ts     # React Query hooks for admin user management
│   ├── use-account-members.ts # React Query hooks for account book members
│   └── use-reconciliation-summary.ts # React Query hook for AI reconciliation summary
├── lib/
│   ├── utils.ts            # `cn()` class merging utility
│   ├── api.ts              # API client — all backend endpoint functions (auth, documents, receipts, statements, accounts, admin)
│   ├── auth.tsx            # AuthProvider context and useAuth() hook (cookie-based session)
│   ├── types.ts            # API response types mirroring backend Pydantic schemas (snake_case)
│   ├── transforms.ts       # Pure functions converting API types → frontend view types (AccountBook, YearData, etc.)
│   ├── query-client.tsx    # React Query QueryClientProvider wrapper
│   ├── dashboard-routes.ts # Dashboard URL helpers (selectionToPath, parseDashboardPath)
│   ├── constants.ts        # Shared constants (MONTH_LABELS, chart config, match rate badge variant)
│   ├── permissions.ts      # Role helpers: isViewerRole, canMutateData, canCreateAccountBook
│   ├── domain-types.ts     # Frontend domain types (AccountBook, YearData, MonthData, Transaction) and formatting utilities
│   └── job-status-provider.tsx # JobStatusProvider context wrapper (wraps dashboard layout)
├── public/                 # Static assets (SVGs)
├── middleware.ts           # Next.js Edge middleware — dashboard route guard (csrf_token cookie check)
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
| `/dashboard`    | `app/dashboard/page.tsx`                       | Client   | Redirects: developers → `/dashboard/global-admin`; others → first account via `useAccountBooks()` |
| `/dashboard/global-admin` | `app/dashboard/global-admin/page.tsx`     | Client   | Developer-only tenant management (users + account books + members); no reconciliation drill-down |
| `/dashboard/[accountId]` | `app/dashboard/[accountId]/page.tsx`   | Client   | Account-level dashboard view (drill-down entry)  |
| `/dashboard/[accountId]/[year]` | `app/dashboard/[accountId]/[year]/page.tsx` | Client | Year-level dashboard view                        |
| `/dashboard/[accountId]/[year]/[month]` | `app/dashboard/[accountId]/[year]/[month]/page.tsx` | Client | Month-level dashboard view (transactions) |

Dashboard drill-down state is URL-driven: the path reflects the current account/year/month, so refreshing the page keeps the same view. The shared layout (`app/dashboard/layout.tsx`) derives selection from the pathname and renders the sidebar and breadcrumb; navigation uses `router.push` to update the URL. The static segment `/dashboard/global-admin` uses a minimal shell (`DeveloperConsoleShell`) instead of the reconciliation sidebar.

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
- **UploadDialog** — Trigger + dialog for file upload (e.g. bank statements, receipts) with drag-and-drop and configurable accept types. Connected to the backend via `useTrackedDocumentUpload` hook (presigned S3 URLs + automatic job tracking). Automatically associates uploaded documents with the current `account_id`.
- **AppSidebar** — Main sidebar navigation. Receives `accountBooks` (fetched via API) as a prop from the dashboard layout; renders an account selector and collapsible year/month tree. The logout button calls `await logout()` (async) before redirecting.
- **JobStatusFloat** — Floating widget fixed to the bottom-right corner of the dashboard. Shows active parsing and reconciliation jobs with real-time progress polling (every 3 s via `GET /jobs/{id}/status`). Displays parsed-document count for parsing jobs and matching status for reconciliation jobs. Collapsible header with expand/collapse toggle; completed jobs auto-dismiss after 15 s. Rendered in `app/dashboard/layout.tsx` inside `JobStatusProvider`.
- **ViewerModeBanner** — When `user.role === "viewer"`, an amber **View-only** strip appears at the top of the main dashboard column (above the breadcrumb bar) on every `/dashboard/*` route, reminding the user that uploads, edits, reconciliation, and manual matching are disabled; export and browsing remain available. Gated by `isViewerRole()` in `lib/permissions.ts`.
- **DeveloperConsoleShell** — Minimal top-bar layout shell used by the `/dashboard/global-admin` route in place of the sidebar. Renders the Matcha logo, "Developer Console" title, a back-link to reconciliation, user name, and logout button. Wraps children in a scrollable container.
- **DeveloperGlobalAdminPanel** — Main content component for `/dashboard/global-admin`. Fetches provisioned users via `useAdminUsers({ provisioned_by_me: true })` and tenant account books via `useProvisionedTenantAccounts()`. Renders four summary stat cards (total tenants, role distribution, account books, active rate), a tabbed data view with **Tenants** and **Account Books** `DataTable` tabs (search, role filter), and three dialogs: Add User, Edit User (with deactivate), and Edit Account Book (with member management and delete).

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
- **API response types** (snake_case, matching backend Pydantic schemas) are in `lib/types.ts`: `AccountBookRead`, `BankStatementRead`, `BankStatementLineRead`, `ReceiptRead`, `DocumentRead`, `JobStatusResponse`, `JobStatusDocument`, `ReconciliationAISummaryResponse`, `ReconciliationLineSummaryRead`, `CandidateReceiptDetail`, plus enums like `MatchStatus`, `DocumentStatus`, `JobStatus`, `JobType`. The `Token` type has been removed — login no longer returns a token body.
- **Frontend view types** (camelCase, used by dashboard components) are in `lib/domain-types.ts`: `Transaction`, `MonthData`, `YearData`, `AccountBook`, `Selection`, `SelectionLevel`.
- **Transforms** in `lib/transforms.ts` convert API types → view types. Dashboard components consume view types only.

### State Management

- Uses **React `useState`** for local component state where needed.
- **Server state** (accounts, statements, receipts, documents) is managed by **TanStack React Query**. The `QueryProvider` wraps the app in `app/layout.tsx`. Query keys are organized per domain (e.g. `accountKeys`, `statementKeys`). Mutations automatically invalidate related queries.
- **Dashboard selection** (account, year, month) is **URL-driven**: the pathname (e.g. `/dashboard/1/2024/3`) is the source of truth. The dashboard layout parses the path via `lib/dashboard-routes.ts` (`parseDashboardPath`, `pathToSelection`) and passes the derived `Selection` to the sidebar and breadcrumb; changing selection is done via `router.push(selectionToPath(...))`, not local state. This allows deep links and preserves the current view on refresh.
- **Auth state** is managed by `AuthProvider` in `lib/auth.tsx` (see [Authentication](#authentication) below). It exposes `user`, `loading`, `login()`, and `logout()` via `useAuth()`. There is no token in client-side state.

### Authentication

The app uses a **fully cookie-based authentication flow** backed by the FastAPI backend. There is no JWT in `localStorage` or React state anywhere in the codebase.

#### How it works

| Step | What happens |
|------|-------------|
| **Login** | `POST /auth/login` — browser sends credentials; backend sets an **HttpOnly JWT cookie** (unreadable by JS) and a readable **`csrf_token` cookie** in the response. |
| **Session detection** | `AuthProvider` checks for the presence of the `csrf_token` cookie on mount. If present, it calls `GET /auth/me` (cookies sent automatically) to rehydrate `user` state. If absent, loading ends immediately with `user: null`. |
| **Authenticated requests** | Every `fetch` call in `lib/api.ts` sets `credentials: "include"` so the browser automatically sends the HttpOnly JWT cookie cross-origin. No `Authorization: Bearer` header is used. |
| **CSRF protection** | For state-changing methods (`POST`, `PUT`, `PATCH`, `DELETE`), `lib/api.ts` reads `csrf_token` from `document.cookie` and attaches it as the `X-CSRF-Token` request header (Double Submit Cookie pattern). |
| **Logout** | `POST /auth/logout` — backend clears the HttpOnly cookie server-side. `AuthProvider` sets `user` to `null`. `logout()` is **async** — always `await logout()` before navigating. |
| **401 handling** | A global `_onUnauthorized` callback in `lib/api.ts` is wired to set `user: null` in `AuthProvider`. Any 401 from any API call instantly clears auth state. |
| **Route guard** | `middleware.ts` (Next.js Edge) checks for the `csrf_token` cookie on `/dashboard/*` routes. Missing cookie → redirect to `/auth/login`. |

#### Key rules

- **Never** store the JWT or any session token in `localStorage`, `sessionStorage`, or React state.
- **Never** attach `Authorization: Bearer` headers manually — auth is cookie-driven.
- The `csrf_token` cookie is the only session indicator readable by JavaScript. Treat its presence as a proxy for "a valid session exists."
- `uploadFileToS3()` is the **only** `fetch` call that must **not** set `credentials: "include"` — it targets a third-party S3 presigned URL where sending cookies would break CORS preflight.

#### `useAuth()` API

```ts
const { user, loading, login, logout } = useAuth();
```

| Field | Type | Description |
|-------|------|-------------|
| `user` | `UserRead \| null` | The authenticated user, or `null` when logged out / loading. |
| `loading` | `boolean` | `true` during the initial `/auth/me` session-check on mount. |
| `login(email, password)` | `() => Promise<void>` | Calls the login endpoint and populates `user`. Throws on failure. |
| `logout()` | `() => Promise<void>` | Calls the logout endpoint, clears `user`. Always `await` before navigating. |

**Viewer role (`user.role === "viewer"`):** Application-level read-only users only see account books they are a member of (backend-enforced). The dashboard shows **ViewerModeBanner** and hides mutating actions (see `lib/permissions.ts`: `isViewerRole`, `canMutateData`); only browsing and export are offered in the UI.

> **Note:** `ensureToken()` still exists in `lib/auth.tsx` as a deprecated no-op shim that returns `""`. It exists only to prevent compile errors during any ongoing migration. **Do not use it in new code.** Remove existing calls as you encounter them.

### Data Layer

The frontend fetches all data from the FastAPI backend (`NEXT_PUBLIC_API_URL`). The data flows through three layers:

1. **API client** (`lib/api.ts`) — Thin async functions wrapping `fetch` for every backend endpoint. All functions use `credentials: "include"` and inject `X-CSRF-Token` automatically for mutating requests. No token parameters. Handles error parsing and query-string construction. Organized by tier: auth, documents, receipts, statements, accounts, admin users.
2. **React Query hooks** (`hooks/use-*.ts`) — One file per domain: `use-accounts.ts` (includes `useProvisionedTenantAccounts` for developer tenant scope), `use-statements.ts`, `use-receipts.ts`, `use-documents.ts`, `use-admin-users.ts`, `use-account-members.ts`, plus `use-document-upload.ts` for the S3 upload flow. Each exports query hooks (read) and mutation hooks (write) with automatic cache invalidation. Hooks that gate on authentication use `enabled: !!user` (from `useAuth()`) rather than token presence.
3. **Transforms** (`lib/transforms.ts`) — Pure functions that convert API response types (flat, snake_case) into the hierarchical view types used by dashboard components. Key transforms: `apiAccountToAccountBook()`, `statementsToYearData()`, `statementToMonthData()`, `lineToTransaction()`.

Helper functions: `formatCurrency()`, `formatNumber()` (in `lib/domain-types.ts`).

#### Connected Backend Endpoints

| Tier | Endpoints | Frontend hooks |
|------|-----------|----------------|
| **Tier 1** — Auth | `POST /auth/login`, `GET /auth/me`, `POST /auth/logout` | `useAuth()` — `login()`, `logout()` |
| **Tier 1** — Upload | `POST /documents/upload-url`, `POST /documents/{id}/confirm-upload` | `useDocumentUpload()`, `useTrackedDocumentUpload()` |
| **Tier 2** — Documents | `GET /documents`, `GET /documents/{id}`, `DELETE /documents/{id}` | `useDocuments()`, `useDocument()`, `useDeleteDocument()` |
| **Tier 2** — Jobs | `GET /jobs/{id}/status` | `useJobStatus()` (polling via `getJobStatus()` in `lib/api.ts`) |
| **Tier 4** — Reconciliation | `POST /reconciliation/start`, `GET /reconciliation/ai-summary` | `useStartReconciliation()` (`hooks/use-reconciliation.ts`), `useReconciliationAISummary()` (`hooks/use-reconciliation-summary.ts`) |
| **Tier 3** — Receipts | `GET /receipts`, `GET /receipts/{id}`, `PATCH /receipts/{id}`, `GET /receipts/{id}/file-url` | `useReceipts()`, `useReceipt()`, `useUpdateReceipt()`, `useReceiptFileUrl()` |
| **Tier 3** — Statements | `GET /statements`, `GET /statements/{id}`, `GET /statements/{id}/lines`, `PATCH /statements/{id}/lines/{lineId}`, `GET /statements/{id}/file-url` | `useStatements()`, `useStatement()`, `useStatementLines()`, `useUpdateStatementLine()`, `useStatementFileUrl()` |
| **Tier 5** — Accounts | `POST /accounts`, `GET /accounts` (optional `provisioned_tenant_only` for developers), `GET /accounts/{id}`, `PATCH /accounts/{id}`, `DELETE /accounts/{id}` | `useAccounts()`, `useAccount()`, `useAccountBook()`, `useAccountBooks()`, `useProvisionedTenantAccounts()`, `useCreateAccount()`, `useUpdateAccount()`, `useDeleteAccount()` |
| **Tier 5** — Members | `GET /accounts/{id}/members`, `POST /accounts/{id}/members`, `DELETE /accounts/{id}/members/{userId}` | `useAccountMembers()`, `useAddAccountMember()`, `useRemoveAccountMember()` |
| **Tier 5** — Admin Users | `GET /admin/users` (optional `provisioned_by_me`), `POST /admin/users`, `GET /admin/users/{id}`, `PATCH /admin/users/{id}`, `DELETE /admin/users/{id}` | `useAdminUsers()`, `useCreateAdminUser()`, `useUpdateAdminUser()`, `useDeactivateAdminUser()` |

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
| **Reconciliation**   | Process of matching bank statement transactions to receipts/internal records. |
| **Selection**        | Navigation state tracking current account, year, month, and drill level. |
| **Reconciliation AI Summary** | AI-generated analysis of unmatched statement lines from the latest reconciliation run. Backend: `ReconciliationAISummaryResponse` / `ReconciliationLineSummaryRead`. |

---

## Navigation & Page Flow

### User Flow

1. **Landing page** (`/landing-page`) — Public entry point with hero, feature grid, and CTAs linking to auth.
2. **Auth** — `/auth/login` presents a login form. `/auth/signup` currently shows a **Work in Progress** notice indicating registration is closed during active development. The original signup form is preserved at `app/auth/_signup/page.tsx` (private, unrouted via the `_` prefix) and can be re-enabled by moving it back to `app/auth/signup/page.tsx` when the app is ready to accept new users.
3. **Dashboard** (`/dashboard`) — Authenticated experience. The Edge middleware (`middleware.ts`) redirects requests missing the `csrf_token` cookie to `/auth/login` before the page renders. The dashboard layout also performs a client-side redirect if `user` is null after the auth check resolves.

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

React Query hooks no longer receive or pass a `token` argument. The API client handles credentials automatically. Gate queries on `enabled: !!user` (from `useAuth()`) when the data is user-specific and should not be fetched while unauthenticated:

```ts
export function useMyResource() {
    const { user } = useAuth();
    return useQuery({
        queryKey: myKeys.list(),
        queryFn: () => listMyResource(),
        enabled: !!user,
    });
}
```

### Modify theming / colors

Edit CSS custom properties in `app/globals.css` under `:root` (light) and the dark mode blocks.

### Add a new API endpoint

1. Add the TypeScript response/request types to `lib/types.ts` (match backend Pydantic schema, snake_case).
2. Add the endpoint function to `lib/api.ts` following the existing `request<T>()` / `requestNoContent()` pattern. **Do not add a `token` parameter.** Add the function to the `apiClient` barrel export at the bottom of the file.
   - Read operations → `request<T>(path)` (GET, no CSRF header needed).
   - Write operations → `request<T>(path, { method: "POST" | "PATCH" | "PUT" | "DELETE", ... })` — `X-CSRF-Token` is injected automatically by `baseFetch`.
3. Create a React Query hook in `hooks/use-<domain>.ts` using `useQuery` (reads) or `useMutation` (writes). Define a query key factory at the top of the file.
4. If the response needs transformation for dashboard components, add a transform function to `lib/transforms.ts`.
5. Update the **Connected Backend Endpoints** table and this `AGENTS.md` if the new endpoint connects a new tier or adds a major feature.

---

## Things to Avoid

- **Do not** store the JWT or session tokens in `localStorage`, `sessionStorage`, or React state — the session is managed entirely by the browser's cookie jar via HttpOnly cookies set by the backend.
- **Do not** add `Authorization: Bearer` headers to API calls — auth is cookie-driven; `credentials: "include"` handles it.
- **Do not** add a `token` parameter to API functions in `lib/api.ts` — all functions are credential-free at the call site.
- **Do not** call `ensureToken()` in new code — it is a deprecated no-op shim kept only for backward compatibility. Remove it when encountered.
- **Do not** add `credentials: "include"` to `uploadFileToS3()` — it targets a third-party S3 presigned URL and sending cookies there breaks CORS preflight.
- **Do not** call `logout()` without `await` — it is async (calls the backend to clear the HttpOnly cookie) and navigation should only happen after it resolves.
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
- When mocking `useAuth()`, return `{ user: mockUser, loading: false, login: vi.fn(), logout: vi.fn() }` — there is no `token` field.

---

## Environment & Deployment

- **Node.js** is required (see `engines` in `package.json` or use the latest LTS).
- Environment variables should be placed in `.env.local` (gitignored).
- Prefix client-side env vars with `NEXT_PUBLIC_`.
- **Required env var**: `NEXT_PUBLIC_API_URL` — base URL of the FastAPI backend (e.g. `http://localhost:8000`). All API calls use this.
- The backend must set `Access-Control-Allow-Credentials: true` and a matching `Access-Control-Allow-Origin` for cookie-based cross-origin requests to work in development.
- The project is deployable to **Vercel** or any platform supporting Next.js.

---

## Maintaining AGENTS.md

Keep this file in sync with the codebase when making structural or stack changes:

- **Directory structure** — Update when adding or removing top-level directories or notable files (e.g. new app routes, new components in `components/`, new hooks or lib modules).
- **Tech stack** — Update when adding major UI or data dependencies; keep in sync with `package.json`.
- **Route map** — Update when adding or changing routes.
- **Authentication section** — Update when the session mechanism, cookie names, CSRF strategy, or `useAuth()` API surface changes.
- **Connected Backend Endpoints table** — Update when adding, removing, or renaming backend endpoints consumed by the frontend.
- **Key application components** — Update when introducing or removing shared components (e.g. new tables, dialogs, or layout components).
- **Things to Avoid** — Update when new anti-patterns are identified or old constraints are lifted.