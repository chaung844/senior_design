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
│       └── page.tsx        # Main dashboard view (client component)
├── components/
│   ├── ui/                 # shadcn/ui primitives (DO NOT edit manually)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── sidebar.tsx
│   │   ├── table.tsx
│   │   ├── tabs.tsx
│   │   └── ... (23 components)
│   ├── app-sidebar.tsx        # Main sidebar navigation with account/year/month tree
│   ├── dashboard-account.tsx  # Account-level dashboard view
│   ├── dashboard-year.tsx     # Year-level dashboard view
│   ├── dashboard-month.tsx    # Month-level dashboard with transaction table
│   ├── component-example.tsx  # shadcn component showcase
│   └── example.tsx            # Example wrapper utilities
├── hooks/
│   └── use-mobile.ts       # Responsive breakpoint hook (768px)
├── lib/
│   ├── utils.ts            # `cn()` class merging utility
│   └── mock-data.ts        # Mock data generators and domain types
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

| Route           | File                          | Type     | Description                                      |
| --------------- | ----------------------------- | -------- | ------------------------------------------------ |
| `/`             | `app/page.tsx`                | Server   | Redirects to `/landing-page`                     |
| `/landing-page` | `app/landing-page/page.tsx`   | Server   | Public marketing page (minimalistic, Modal.com-inspired) |
| `/auth/login`   | `app/auth/login/page.tsx`     | Client   | Login form (email + password)                    |
| `/auth/signup`  | `app/auth/signup/page.tsx`    | Server   | WIP notice — registration currently closed       |
| *(unrouted)*    | `app/auth/_signup/page.tsx`   | Client   | Original signup form, preserved for future use   |
| `/dashboard`    | `app/dashboard/page.tsx`      | Client   | Main reconciliation dashboard with sidebar       |

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
- Domain types are defined in `lib/mock-data.ts`: `Transaction`, `MonthData`, `YearData`, `AccountBook`, `Selection`, `SelectionLevel`.

### State Management

- Currently uses **React `useState`** for local component state.
- The main `Selection` state is lifted to the root `Page` component and passed down via props.
- No external state management library is in use.

### Data Layer

- Currently uses **mock data** generated in `lib/mock-data.ts`. No real API calls yet.
- Helper functions: `getAccountBook()`, `getYearData()`, `getMonthData()`, `formatCurrency()`, `formatNumber()`.
- When integrating a real backend, replace mock data calls with API fetches while keeping the same type interfaces.

---

## Key Domain Concepts

| Concept              | Description                                                             |
| -------------------- | ----------------------------------------------------------------------- |
| **Account Book**     | A bank account with metadata (name, bank, account number, currency)     |
| **Year Data**        | Aggregate financial data for a calendar year within an account          |
| **Month Data**       | Monthly breakdown with transactions, balances, and reconciliation stats |
| **Transaction**      | Individual debit/credit entry with matching status and confidence       |
| **Match Rate**       | Percentage of transactions successfully matched to ledger entries       |
| **Reconciliation**   | Process of matching bank statement transactions to internal records     |
| **Selection**        | Navigation state tracking current account, year, month, and drill level |

---

## Navigation & Page Flow

### User Flow

1. **Landing page** (`/landing-page`) — Public entry point with hero, feature grid, and CTAs linking to auth.
2. **Auth** — `/auth/login` presents a login form. `/auth/signup` currently shows a **Work in Progress** notice indicating registration is closed during active development. The original signup form is preserved at `app/auth/_signup/page.tsx` (private, unrouted via the `_` prefix) and can be re-enabled by moving it back to `app/auth/signup/page.tsx` when the app is ready to accept new users.
3. **Dashboard** (`/dashboard`) — Authenticated experience (auth guard not yet implemented).

### Dashboard Drill-Down

The dashboard uses a **drill-down** pattern:

1. **Account level** (`DashboardAccount`) — Overview of all years for the selected account.
2. **Year level** (`DashboardYear`) — Monthly breakdown for a selected year.
3. **Month level** (`DashboardMonth`) — Transaction table for a selected month.

Navigation state is tracked via the `Selection` type and a breadcrumb in the header. The `AppSidebar` provides a tree-based navigation alternative.

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

## Things to Avoid

- **Do not** edit files in `components/ui/` manually — they are managed by shadcn CLI.
- **Do not** use inline styles or CSS modules — use Tailwind utility classes.
- **Do not** install alternative icon libraries — use Hugeicons consistently.
- **Do not** use `any` types — leverage TypeScript strict mode fully.
- **Do not** add `"use client"` to components that don't need it — prefer server components where possible.
- **Do not** hardcode color values — use the semantic CSS custom property tokens (e.g., `text-foreground`, `bg-primary`).

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
- The project is deployable to **Vercel** or any platform supporting Next.js.