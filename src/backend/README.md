# Backend for Matcha AI-Assisted Bank Statement Reconciliation System

---

## Stacks

- **FastAPI** — HTTP API
- **Pydantic** / **pydantic-settings** — request/response and configuration
- **Slowapi** — rate limiting (login)
- **AWS RDS** — managed PostgreSQL in production
- **AWS S3** — document storage (PDFs, images)
- **AWS SQS** — async parsing and reconciliation jobs
- **AWS Bedrock** — LLM / VLM inference (OpenAI-compatible HTTP API via `openai` client)
- **PostgreSQL 16** — local via Docker Compose; production via RDS
- **SQLAlchemy 2** (async) + **Alembic** — ORM and migrations
- **Python 3.13+** — see `pyproject.toml`

---

## Directory layout

Based on [Structuring a FastAPI Project: Best Practices](https://dev.to/mohammad222pr/structuring-a-fastapi-project-best-practices-53l6).

```text
src/backend/
├── alembic/                    # Migration scripts
├── app/
│   ├── main.py                 # FastAPI app, CORS, /health, router includes
│   ├── config.py               # Settings (env / .env)
│   ├── database.py             # Async engine and session
│   ├── enums.py                # Shared enums (document, job, match, roles, …)
│   ├── logging_setup.py        # Rich logging (API + worker)
│   ├── models/                 # SQLAlchemy models
│   ├── routers/                # Route modules: auth, admin, accounts, documents,
│   │                           # jobs, receipts, reconciliation, statements
│   ├── schemas/                # Pydantic schemas
│   ├── services/               # AWS, parsing, reconciliation matching/runner, cleanup, archival
│   ├── tasks/                  # CLI management commands (archival, etc.)
│   ├── utils/                  # auth, JWT, CSRF, security, access control, limiter, PDF helpers
│   ├── worker/                 # SQS consumer (parsing + reconciliation handlers)
├── safe/                       # Local prompts & samples (not committed)
│   ├── prompts/
│   └── samples/
├── tests/                      # Pytest tests
├── alembic.ini
├── docker-compose.yml          # Local PostgreSQL
├── env.example                 # Example environment variables (copy to .env)
├── pyproject.toml              # Dependencies (uv)
├── uv.lock
├── seed.py                     # Dev user / seed data
├── s3-cors.json                # Sample S3 CORS config (browser uploads)
└── README.md
```

### How to get `safe/` data?

- **Prompts:** shared with the team via Matcha-Config doc (or your team’s secrets/docs process).
- **Sample statements / receipts:** provided by the project advisor (Midea).

---

## Running the backend

1. Install [uv](https://docs.astral.sh/uv/) and **Python 3.13+**.
2. Install dependencies:

   ```bash
   uv sync
   ```

3. Start local PostgreSQL:

   ```bash
   docker compose up -d
   ```

4. Copy **`env.example`** to **`.env`** in `src/backend/` and fill in required values. At minimum, `app.config.Settings` requires:

   - `AWS_BEDROCK_API_KEY`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
   - `S3_BUCKET_NAME`, `AWS_SQS_URL`
   - `DATABASE_URL` (async URL, e.g. `postgresql+asyncpg://…`)
   - `JWT_SECRET_KEY`

   Optional keys and defaults are documented in `app/config.py` and commented in `env.example`.

5. **Local HTTP dev:** `cookie_secure` defaults to **`true`**, which makes browsers drop auth cookies on plain `http://localhost`. Set explicitly:

   ```env
   COOKIE_SECURE=false
   ```

6. Migrations and optional seed:

   ```bash
   uv run alembic revision --autogenerate -m "Description of changes"
   uv run alembic upgrade head
   uv run seed.py
   ```

7. API server:

   ```bash
   uv run uvicorn app.main:app --reload --loop uvloop --http httptools
   ```

   Open **http://127.0.0.1:8000/docs** for Swagger UI.

8. SQS worker (required for document parsing and for **`POST /reconciliation/start`**):

   ```bash
   uv run python -m app.worker.main
   ```

9. Statement archival task (run daily via cron or EventBridge):

   ```bash
   # Preview what would be archived
   uv run python -m app.tasks.archive_statements --dry-run

   # Execute archival
   uv run python -m app.tasks.archive_statements
   ```

### Rate limiting

`POST /auth/login` is limited to **10 requests per minute per client IP** (`slowapi`). Excess attempts return **429 Too Many Requests**.

---

## Logging

The API and the SQS worker use **[Rich](https://rich.readthedocs.io/)** via `app/logging_setup.py` (`configure_rich_logging`).

- **Level:** `INFO` by default. Set **`DEBUG=true`** in `.env` for debug logs, richer tracebacks, and SQLAlchemy engine logging.
- **Uvicorn:** Plain-text handlers on `uvicorn` loggers are removed so access lines go through the root Rich handler without duplicates.
- **HTTP:** **`X-Response-Time-Ms`** is set on every response; access lines come from **`uvicorn.access`**.
- **TTY:** Rich disables color when there is no TTY. Use **`FORCE_COLOR=1`** in containers; **`NO_COLOR`** forces plain output.

`seed.py` uses standard library logging. Alembic uses `alembic.ini`.

---

## Operational endpoints

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/` | Simple JSON: service up |
| `GET` | `/health` | **200** `{ "status": "ok" }` if the app can run `SELECT 1` on the database; **503** if the DB is unreachable (for probes/load balancers) |

---

## Notes

- Bedrock is called through the **OpenAI-compatible** Bedrock Runtime endpoint (`bedrock_base_url` in `config.py`). **boto3** / **aioboto3** are still used for S3 and SQS.

### Docker Compose (local)

```bash
# Start
docker compose up -d

# Stop (keep volumes)
docker compose stop

# Start again
docker compose start

# Remove containers/networks (keep named volumes)
docker compose down

# Remove volumes and images for this project (destructive)
docker compose down -v --rmi all --remove-orphans
```

### S3 CORS (required for direct browser upload)

The frontend uploads with **presigned PUT** URLs; the bucket must allow the frontend origin.

1. Edit **`s3-cors.json`**: add production origins to `AllowedOrigins` (localhost entries are already there for dev).
2. Apply:

   ```bash
   aws s3api put-bucket-cors --bucket YOUR_BUCKET_NAME --cors-configuration file://s3-cors.json
   ```

3. Confirm in AWS Console → bucket → Permissions → CORS.

If preflight returns **500** and you use **CloudFront**, ensure the distribution forwards **OPTIONS** and CORS headers so preflight reaches S3.

---

## Application workflows (high level)

1. User requests a presigned upload URL and uploads the file to S3.
2. User confirms upload; the API creates a **parsing** `Job`, enqueues SQS (`parse_receipt` or `parse_statement`), and sets the document to `pending_processing`.
3. The **worker** downloads from S3, runs Bedrock / pdfplumber as appropriate, writes `Receipt` or `BankStatement` + lines, sets the document to `parsed`, and completes the parsing job.
4. User starts reconciliation via **`POST /reconciliation/start`**; the API creates a **reconciliation** job, enqueues **`run_reconciliation`**, and returns immediately. The worker runs matching + optional AI line summaries.
5. The UI polls **`GET /jobs/{job_id}/status`** and reads results via reconciliation endpoints.

Frontend should reflect document and job status (pending → processing → parsed / failed; reconciliation job states).

---

## Architecture (production)

- **App Runner** (or similar) serves the FastAPI app.
- **ECS Fargate** (or a second process) runs **`python -m app.worker.main`** from the same image/repo.
- Shared **RDS**, **S3**, and **SQS**.

---

## Production configuration

### Cookie-based authentication

On successful login, two cookies are set:

| Cookie | HttpOnly | Purpose |
|--------|----------|---------|
| `access_token` | yes | JWT — not readable from JavaScript |
| `csrf_token` | no | HMAC-signed token (`nonce.signature` tied to user); JS sends it as **`X-CSRF-Token`** |

Use **`credentials: "include"`** on fetches so cookies are sent.

### `COOKIE_SECURE` — common local/production mistake

**Default in code is `true`.** With `Secure` cookies, browsers **do not store or send** them on plain **HTTP** (e.g. local `http://localhost:8000`), so login appears to work but later requests get **401**.

| Environment | Setting |
|-------------|---------|
| Local HTTP | Set **`COOKIE_SECURE=false`** explicitly in `.env` |
| Production HTTPS | **`COOKIE_SECURE=true`** (or omit if you rely on the default `true`) |

### `SameSite` and cross-site frontends

Cookies are set with **`SameSite=Lax`** in `app/routers/auth.py`. That works when the SPA and API are related sites (e.g. `app.example.com` and `api.example.com`). For **fully different domains** (e.g. Vercel + App Runner), you may need **`SameSite=None`** with **`Secure=true`** — that would require a dedicated setting in code today (currently hardcoded `lax`).

### `CORS_ORIGINS`

With `allow_credentials=True`, you cannot use `*`. List every frontend origin explicitly (see `cors_origins` in `config.py`).

Allowed headers include: `Content-Type`, `Accept`, `Authorization`, `X-CSRF-Token`. Add new custom headers in `app/main.py` if needed.

### CSRF

Mutating routes use **`verify_csrf_token`**: the **`X-CSRF-Token`** header must match the **`csrf_token`** cookie (double-submit), and the token is bound to the JWT user via HMAC.

Typical errors: **403** `"CSRF token missing"` / `"CSRF token mismatch"`.

### Production checklist

- [ ] `COOKIE_SECURE=true` on HTTPS deployments
- [ ] `CORS_ORIGINS` includes the exact production frontend URL(s)
- [ ] API served over HTTPS when using secure cookies
- [ ] S3 CORS includes production origin(s)
- [ ] `JWT_SECRET_KEY` is a long random secret (not the example in `env.example`)

---

## API surface (summary)

The following mirrors the main routers. All routes except `/`, `/health`, and `/docs` expect the cookie session unless noted. State-changing routes require **CSRF** as above.

### Tier 1 — Auth & upload

**`/auth`**

- [x] `POST /auth/login` — OAuth2 password form; sets cookies; **rate limited** 10/min/IP.
- [x] `POST /auth/logout` — Clears cookies (authenticated + CSRF).
- [x] `GET /auth/me` — Current user profile.

**`/documents`**

- [x] `POST /documents/upload-url` — Body: `file_name`, `file_type`, `document_type`, optional `account_id`. Creates DB row (`pending_upload`), returns presigned PUT URL + `document_id` + `s3_key`.
- [x] `POST /documents/{document_id}/confirm-upload` — Optional query `statement_id` (for receipts: link to a statement). Verifies S3 object, creates **parsing** `Job`, enqueues SQS, returns `job_id` + `pending_processing`.
- [x] `GET /documents` — List with filters: `status`, `document_type`, `account_id`, pagination `offset` / `limit`.
- [x] `GET /documents/{document_id}` — Detail.
- [x] `DELETE /documents/{document_id}` — Soft delete + background S3 cleanup.

### Tier 2 — Jobs

**`/jobs`**

- [x] `GET /jobs/{job_id}/status` — `job_id`, `status`, `job_type`, `documents[]`. For **parsing** jobs, `documents` contains the linked document. For **reconciliation** jobs, `documents` is currently **empty** (poll job status + reconciliation results separately).

### Tier 3 — Parsed data

**`/receipts`**, **`/statements`** — list, detail, PATCH corrections, presigned file URLs, filters including `match_status` and `job_id` where implemented (see OpenAPI).

### Tier 4 — Reconciliation

**`/reconciliation`**

- [x] `GET /reconciliation/matches` — List matches; optional `line_id`; pagination `offset` / `limit`.
- [x] `POST /reconciliation/start` — Body: **`account_id`** (required), **`statement_id`** (optional; must belong to account), optional **`config`** (`ReconciliationConfig` — thresholds/window). Creates job, enqueues **`run_reconciliation`** on SQS, returns **201** with `job_id`, `status` (`pending`), `summary: null`. **Worker must be running.** Poll **`GET /jobs/{job_id}/status`** and fetch results when complete.
- [x] `POST /reconciliation/jobs/{job_id}/run` — Legacy / re-run. If **`account_id`** is omitted, only bumps job toward `reconciling` without running the algorithm. If **`account_id`** is provided, runs **`run_reconciliation` in the API process** (synchronous request path).
- [x] `GET /reconciliation/jobs/{job_id}/results` — Summary + paginated `matches` (`offset`, `limit`, `total_matches`).
- [x] `GET /reconciliation/ai-summary` — AI line summaries for unmatched lines (`statement_id` required; optional `job_id`).
- [x] `POST /reconciliation/matches` — Manual match (optional `job_id` query).
- [x] `DELETE /reconciliation/matches/{match_id}` — Remove match.
- [x] `PATCH /reconciliation/matches/{match_id}` — Swap receipt on a match.

### Tier 5 — Accounts & admin

**`/accounts`**, **`/accounts/{id}/members`** — Account books and membership (access rules in `app/utils/access.py`).

**`/admin/users`** — Developer-only user CRUD (see router).

### Tier 6 — Not implemented (planned)

- [ ] `GET /dashboard/summary`, `GET /dashboard/jobs`
- [ ] `GET /export/jobs/{job_id}/csv`, `GET /export/jobs/{job_id}/report`
- [ ] `GET /health/bedrock` — authenticated Bedrock check (optional; `/health` is DB-only today)

---

## Data model notes

### `AccountBook`

Key fields: `account_id`, `bank_name`, `account_name`, `account_type`, `currency`, `account_number_last4`, `archive_after_months` (default 18), `user_id`, soft delete via **`deleted_at`** (`SoftDeleteMixin`).

### `BankStatement`

Key fields: `statement_id`, `account_id`, `month`, `year`, `total_amount`, `currency`, `status` (`active` | `archived`), `archived_at`.

### `Document`

Key fields: `document_id`, `uploaded_by`, `file_name`, `document_type`, `s3_key`, `status`, `account_id`, `receipt_id`, `statement_id`, `error_message`, soft delete via **`deleted_at`** (`SoftDeleteMixin`).

### `Job`

| Column | Notes |
|--------|--------|
| `job_id` | PK |
| `name` | Human-readable label |
| `job_type` | `parsing` \| `reconciliation` |
| `status` | `pending` → `processing` / `reconciling` → `completed` \| `failed` |
| `created_by` | FK → `users` |
| `document_id` | Set for **parsing** jobs; null for reconciliation |

### `ReconciliationLineSummary` (`reconciliation_line_summaries`)

Per unmatched line after a run: `job_id`, `line_id`, `statement_id`, `top_candidates` (JSONB), `ai_analysis`, `created_at`.

### Enums (`app/enums.py`)

- **DocumentStatus:** `pending_upload`, `pending_processing`, `processing`, `parsed`, `failed`
- **DocumentType:** `receipt`, `bank_statement`
- **UserRole:** `admin`, `developer`, `viewer`
- **AccountType:** `checking`, `credit_card`
- **MatchStatus:** `unmatched`, `perfect_matched`, `bundle_matched`, `manual`
- **JobType:** `parsing`, `reconciliation`
- **JobStatus:** `pending`, `processing`, `reconciling`, `completed`, `failed`
- **StatementStatus:** `active`, `archived`

---

## Statement archival (data retention)

Statements are automatically archived after a configurable retention period set per account book (`archive_after_months`, default **18 months**). Archival is **irreversible** and enforced purely server-side (no user-facing button).

**What happens when a statement is archived:**

- `BankStatement.status` is set to `archived`; `archived_at` records the timestamp.
- **S3 objects** for the statement document and linked receipt documents are deleted.
- All structured data (lines, receipts, reconciliation matches) remains in PostgreSQL.
- **PATCH** on the statement or its lines returns **403**.
- **Reconciliation** cannot be started against an archived statement.
- **File-URL** endpoints return **410 Gone** for both the statement and its receipt documents.
- Receipts cannot be linked to an archived statement via `confirm-upload`.

**CLI task:** `uv run python -m app.tasks.archive_statements` (supports `--dry-run`). Schedule daily via cron or AWS EventBridge.

---

## SQS message types (worker)

| Type | Typical trigger | Handler |
|------|-----------------|--------|
| `parse_receipt` | Confirm upload (receipt) | S3 → VLM parse → categorize → `Receipt`; optional `statement_id` in payload |
| `parse_statement` | Confirm upload (bank statement) | Requires `account_id` in payload; metadata + **pdfplumber** lines → `BankStatement` + `BankStatementLine` |
| `run_reconciliation` | **`POST /reconciliation/start`** | `run_reconciliation` in worker: matching, `ReconciliationMatch` rows, job status, line summaries |

Legacy **`POST /reconciliation/jobs/{id}/run`** with body including `account_id` runs reconciliation **inside the API**, not via this queue message.

---

## Reconciliation tuning (environment)

Optional overrides in `.env` (see `app/config.py`):

- `RECONCILIATION_MAX_DATE_WINDOW`
- `RECONCILIATION_CONFIDENCE_THRESHOLD`
- `RECONCILIATION_BUNDLE_VENDOR_THRESHOLD`
- `RECONCILIATION_MAX_BUNDLE_SIZE`
- `RECONCILIATION_MIN_VENDOR_SIMILARITY_PASS1B`

Per-run overrides are accepted in **`POST /reconciliation/start`** via the `config` object in the JSON body.
