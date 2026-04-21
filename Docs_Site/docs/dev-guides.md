# Matcha Developer Guide

> AI-Assisted Bank Statement Reconciliation System

---

## 1. Project Overview

Matcha is an AI-powered bank statement reconciliation system that:
- Parses bank statements (PDFs) and receipts (images) using AWS Bedrock LLMs/VLMs
- Matches transactions to receipts via configurable reconciliation algorithms
- Provides a dashboard for viewing, editing, and managing reconciliation results
- Supports multi-tenant account management with role-based access control

### Architecture

```
┌─────────────────┐     ┌──────────────────┐
│   Frontend      │     │   Backend        │
│   Next.js 16    │◄───►│   FastAPI        │
│   (Port 3000)   │     │   (Port 8000)    │
└─────────────────┘     └────────┬─────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              ▼                  ▼                  ▼
        ┌──────────┐      ┌──────────┐      ┌──────────┐
        │PostgreSQL│      │   S3     │      │   SQS    │
        │  (Docker)│      │(Storage) │      │ (Queue)  │
        └──────────┘      └──────────┘      └────┬─────┘
                                                  │
                                                  ▼
                                           ┌──────────┐
                                           │  Worker  │
                                           │(Process) │
                                           └──────────┘
```

---

## 2. Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | Latest LTS | Frontend development |
| Python | 3.13+ | Backend development |
| uv | Latest | Python package management |
| Docker | Latest | Local PostgreSQL |
| Docker Compose | Latest | Local PostgreSQL orchestration |

---

## 2.5 Windows Setup

Windows users have a few extra considerations. For a more streamlined Unix-based setup, please use the Windows Subsystem for Linux (**WSL 2**), all commands should work as-is on a unix-based system.

### WSL 2 (Recommended)

For the closest experience to the Unix-based setup, use WSL 2. Full installation guide: [Microsoft — Install WSL](https://learn.microsoft.com/en-us/windows/wsl/install)

1. Open **PowerShell as Administrator** and run:
   ```powershell
   wsl --install
   ```
   This enables the WSL feature, downloads the WSL 2 Linux kernel, and installs Ubuntu by default. **Restart your machine** when prompted.

2. If Ubuntu was not installed automatically:
   ```powershell
   wsl --install -d Ubuntu
   ```

3. Launch **Ubuntu** from the Start Menu and create a UNIX username/password when prompted.

4. Inside WSL 2, install the required tools:
> sources: [Microsoft - nodejs on wsl](https://learn.microsoft.com/en-us/windows/dev-environment/javascript/nodejs-on-wsl)

   ```bash
   # --- uv ---
   curl -LsSf https://astral.sh/uv/install.sh | sh
   source ~/.bashrc

   #  --- Node.js (via nvm) --- 
   ## Install nvm
   sudo apt update && sudo apt upgrade -y
   sudo apt install curl -y
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh | bash
   ### Confirm
   command -v nvm
   
   ## Install Nodejs
   nvm install --lts
   ### Confirm 
   node --version
   npm --version
   ```

5. Docker Desktop: open **Settings** → **Resources** → **WSL Integration** → enable integration for your Ubuntu distro.

Inside WSL 2, all commands in this guide work as written, including `--loop uvloop --http httptools`.

### Install Docker Desktop

Docker Desktop is required on Windows (not just the CLI). Enable the **WSL 2 backend** in Docker Desktop settings:

1. Install [Docker Desktop for Windows](https://docs.docker.com/desktop/install/windows-install/)
2. Open Docker Desktop → **Settings** → **General** → ensure **Use the WSL 2 based engine** is checked
3. Restart Docker Desktop

---

## 3. Backend Setup

### 3.1 Install Dependencies

```bash
cd src/backend
uv sync
```

### 3.2 Start Local PostgreSQL

```bash
docker compose up -d
```

### 3.3 Configure Environment

Copy `env.example` to `.env`:

```bash
cp env.example .env
```

Required environment variables:

| Variable | Description |
|----------|-------------|
| `AWS_BEDROCK_API_KEY` | Bedrock API key for LLM/VLM inference |
| `AWS_ACCESS_KEY_ID` | AWS access key for S3/SQS |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key for S3/SQS |
| `S3_BUCKET_NAME` | S3 bucket for document storage |
| `AWS_SQS_URL` | SQS queue URL for async jobs |
| `DATABASE_URL` | Async PostgreSQL URL (e.g., `postgresql+asyncpg://...`) |
| `JWT_SECRET_KEY` | Secret for signing JWT tokens |

**Important for local development:**

```env
COOKIE_SECURE=false
```

Without this, browsers will drop auth cookies on plain HTTP (`http://localhost:8000`), causing 401 errors.

### 3.4 Run Migrations & Seed Data

```bash
uv run alembic upgrade head
uv run seed.py
```

### 3.5 Start API Server

```bash
uv run uvicorn app.main:app --reload --loop uvloop --http httptools
```

Access Swagger UI at **http://127.0.0.1:8000/docs**

### 3.6 Start SQS Worker

Required for document parsing and reconciliation:

```bash
uv run python -m app.worker.main
```

### 3.7 Verify Backend

```bash
curl http://127.0.0.1:8000/health
```

Expected response: `{"status": "ok"}`

---

## 4. Frontend Setup

### 4.1 Install Dependencies

```bash
cd src/frontend
npm install
```

### 4.2 Configure Environment

Create `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 4.3 Start Development Server

```bash
npm run dev
```

Access the app at **http://localhost:3000**

### 4.4 Useful Commands

```bash
npm run build    # Production build
npm run start    # Serve production build
npm run lint     # Run ESLint
```

---

## 5. Running the Full Application

### Development Workflow

1. **Terminal 1** — PostgreSQL:
   ```bash
   cd src/backend && docker compose up -d
   ```

2. **Terminal 2** — Backend API:
   ```bash
   cd src/backend && uv run uvicorn app.main:app --reload --loop uvloop --http httptools
   ```

3. **Terminal 3** — SQS Worker:
   ```bash
   cd src/backend && uv run python -m app.worker.main
   ```

4. **Terminal 4** — Frontend:
   ```bash
   cd src/frontend && npm run dev
   ```

---

## 6. Application Current State

### 6.1 Implemented Features

| Feature | Status | Notes |
|---------|--------|-------|
| **Authentication** | ✅ Complete | Cookie-based (HttpOnly JWT + CSRF), role-based access |
| **Landing Page** | ✅ Complete | Public marketing page |
| **Login** | ✅ Complete | Email + password form |
| **Registration** | ⚠️ Closed | WIP notice shown; original form preserved at `app/auth/_signup/` |
| **Document Upload** | ✅ Complete | Presigned S3 URLs, drag-and-drop UI |
| **Statement Parsing** | ✅ Complete | PDF parsing via pdfplumber + Bedrock |
| **Receipt Parsing** | ✅ Complete | Image parsing via VLM + categorization |
| **Reconciliation** | ✅ Complete | Matching algorithm + AI summaries |
| **Dashboard (Account)** | ✅ Complete | Year overview |
| **Dashboard (Year)** | ✅ Complete | Monthly breakdown |
| **Dashboard (Month)** | ✅ Complete | Transaction table + AI summary tab |
| **Job Status Tracking** | ✅ Complete | Floating widget with polling (3s interval) |
| **Account Management** | ✅ Complete | CRUD + member management |
| **Viewer Role** | ✅ Complete | Read-only mode with banner |
| **Developer Console** | ✅ Complete | Tenant management |
| **Statement Archival** | ✅ Complete | Auto-archive after configurable retention (default 18 months) |

### 6.2 Planned Features (Not Implemented)

| Feature | Status | Notes |
|---------|--------|-------|
| **Dashboard Summary** | ❌ Planned | `GET /dashboard/summary`, `GET /dashboard/jobs` |
| **Export** | ❌ Planned | `GET /export/jobs/{job_id}/csv`, `GET /export/jobs/{job_id}/report` |
| **Bedrock Health Check** | ❌ Planned | `GET /health/bedrock` |
| **User Registration** | ❌ Closed | Registration currently disabled during active development |

### 6.3 Known Limitations

- **Cross-domain cookies**: `SameSite=Lax` is hardcoded. For fully different domains (e.g., Vercel + App Runner), `SameSite=None` would require a code change.
- **Reconciliation job documents**: Job status endpoint returns empty `documents[]` for reconciliation jobs (poll results separately).
- **No test framework**: Neither backend nor frontend has test coverage configured.
- **Statement archival is irreversible**: No UI for restoring archived statements.

---

## 7. Key Workflows

### 7.1 Document Upload & Parsing

```
User uploads file → Get presigned URL → Upload to S3 → Confirm upload
    → Create parsing job → Enqueue SQS → Worker parses → Document status: parsed
```

### 7.2 Reconciliation

```
User starts reconciliation → Create reconciliation job → Enqueue SQS
    → Worker runs matching → AI generates summaries → UI polls for results
```

### 7.3 Statement Archival

```
Daily cron/EventBridge → Run archive task → Statements past retention period
    → Set status: archived → Delete S3 objects → Preserve structured data
```

---

## 8. Development Conventions

### Backend

- Async SQLAlchemy with `asyncpg`
- Pydantic schemas for request/response validation
- Rich logging with configurable levels
- Rate limiting on login (10 req/min/IP via slowapi)
- CSRF protection via double-submit cookie pattern

### Frontend

- Next.js App Router with React Server Components
- Cookie-based auth (no localStorage tokens)
- TanStack React Query for server state
- URL-driven dashboard navigation
- Tailwind CSS with semantic color tokens
- shadcn/ui components (do not edit `components/ui/` manually)

### Adding a New API Endpoint

1. Add types to `lib/types.ts` (snake_case, match backend)
2. Add function to `lib/api.ts` (no token parameter)
3. Create React Query hook in `hooks/use-<domain>.ts`
4. Add transform to `lib/transforms.ts` if needed
5. Update `AGENTS.md` endpoint table

---

## 9. Troubleshooting

| Issue | Solution |
|-------|----------|
| **401 on localhost** | Set `COOKIE_SECURE=false` in backend `.env` |
| **CSRF 403 errors** | Ensure `X-CSRF-Token` header is sent with mutating requests |
| **CORS errors** | Check `CORS_ORIGINS` includes frontend URL |
| **S3 upload fails** | Verify S3 CORS config includes frontend origin |
| **Parsing not working** | Ensure SQS worker is running |
| **Reconciliation stuck** | Check SQS worker logs; verify `AWS_SQS_URL` is correct |

---

## 10. Production Deployment

### Backend

- **App Runner** or similar for FastAPI
- **ECS Fargate** for SQS worker
- **RDS** for PostgreSQL
- **S3** for document storage
- **SQS** for async job queue

### Frontend

- Deployable to **Vercel** or any Next.js-compatible platform
- Set `NEXT_PUBLIC_API_URL` to production backend URL
- Ensure `COOKIE_SECURE=true` for HTTPS deployments
- Configure `CORS_ORIGINS` with exact frontend URL(s)

### Production Checklist

- [ ] `COOKIE_SECURE=true` on HTTPS deployments
- [ ] `CORS_ORIGINS` includes exact production frontend URL(s)
- [ ] API served over HTTPS
- [ ] S3 CORS includes production origin(s)
- [ ] `JWT_SECRET_KEY` is a long random secret
- [ ] Archive task scheduled (cron or EventBridge)
