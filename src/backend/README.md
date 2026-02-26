# Backend for Matcha AI-Assisted Bank Statement Reconciliation System

---

## Stacks
- `FastAPI` for server + API endpoints
- `Pydantic` for data validation
- `AWS RDS ` for relational database manaement
- `AWS S3` for storing objects (e.g, PDFs, Images)
- `AWS SQS` for messages queuing service
- `AWS Bedrock` for AI Model inference service
- `PostgreSQL 16` (local via `Docker` / prod via `AWS RDS`)
- `SQLAlchemy` (ORM) & `Alembic` (Migration)

---

## Directory
- Based on [Structuring a FastAPI Project: Best Practices](https://dev.to/mohammad222pr/structuring-a-fastapi-project-best-practices-53l6) 
```shell
src/backend/
├── alembic/                    # Database migration history 
├── app/                        # Main application source code
│   ├── __init__.py
│   ├── main.py                 # App entry point (FastAPI instance)
│   ├── config.py               # Server configuration file by Pydantic
│   ├── models/                 # Database models
│   │   └── __init__.py
│   ├── routers/                # API endpoints
│   │   └── __init__.py
│   ├── schemas/                # Schemas for Pydantic data validation
│   │   └── __init__.py
│   ├── services/               # Business logic
│   │   ├── __init__.py
│   │   └── aws_services.py     # AWS services
│   └── utils/                  # Utility functions
│       ├── __init__.py
│       └── lm_utils.py         
├── safe/                       # Sensitive data zone. Files in this directory should never be commited
│   ├── prompts/                # System instruction (refer below on how to get prompts data)
│   └── samples/                # Sample bank statements + receipts  (refer below on how to get sample data)
├── .env.example                # Example Environment variables
├── .gitignore                  # Files to ignore (venv, db, pyc)
├── alembic.ini                 # Alembic configuration
├── docker-compose.yml          # Local infrastructure (PostgreSQL)
├── seed.py                     # Database seeding script
├── pyproject.toml              # Project metadata & dependencies (Managed by uv)
├── uv.lock                     # Exact dependency versions (Managed by uv)
└── README.md
```

> *How to get `safe/` data?*
>
> System prompt should be shared with teammates via Matcha-Config google docs (for now, in search of better secrets management option).
>
> Sample data should be shared with teammates via project advisor from Midea.

---

## Running backend
- Make sure [uv](https://docs.astral.sh/uv/) is installed
- Install python dependencies
```bash
uv sync
```
- Start the local database:
```bash
docker compose up -d
```
- Refer to `.env.example` file for how to setup `.env`
> Note that you only need to put in AWS Bedrock API key, other variables value can be derived from `config.py` default value.

- Generate alembic versioning
```bash
uv run alembic revision --autogenerate
```
- Apply database migrations and (optional) seed test data:
```bash
uv run alembic upgrade head
uv run seed.py
```
- Run the server
```bash
uv run uvicorn app.main:app --reload --loop uvloop --http httptools
```
- From the localhost link, append `/docs` to get swagger UI

---

## Notes
- Currently, AWS Bedrock foundation model is invoked via OpenAI-Compatible API call. Future features involve deeper integration with AWS (.e.g, S3, RDS, ...) may need to use [boto3](https://boto3.amazonaws.com/v1/documentation/api/latest/index.html)([installation](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)) - AWS Python SDK.

### Docker compose routine for local dev
```bash
# ---- start ----
docker compose up -d

# ---- stop temporarily ----
docker compose stop

# ---- resume from stop ----
docker compose start

# ---- remove (excluding the mounted volume) ----
docker compose down

# ---- remove (including the mounted volume) ----
# down - Stops and removes containers/networks from this Compose project
# -v / --volumes - Removes named volumes declared in your Compose file + anonymous volumes attached to those containers
# --rmi all - Removes all images used by services in this specific Compose file (both local/untagged and tagged images)​
# --remove-orphans - Removes containers from other Compose projects that use the same project name
docker compose down -v --rmi all --remove-orphans
```

### S3 CORS (required for document upload)

The frontend uploads files **directly to S3** using presigned PUT URLs. The browser enforces CORS, so the S3 bucket must allow your frontend origin. Otherwise you will see: *"Fetch API cannot load presigned url s3 due to access control checks"*.

1. **Edit `s3-cors.json`** in this directory: add your production frontend origin to `AllowedOrigins` (e.g. `https://your-app.vercel.app`). The file already includes `http://localhost:3000` and `http://127.0.0.1:3000` for local dev.

2. **Apply the CORS configuration** to your bucket (replace `YOUR_BUCKET_NAME` with the value of `S3_BUCKET_NAME` from your `.env`):

   ```bash
   aws s3api put-bucket-cors --bucket YOUR_BUCKET_NAME --cors-configuration file://s3-cors.json
   ```

3. **Verify** in the AWS Console: S3 → your bucket → Permissions → Cross-origin resource sharing (CORS).

**If you get "Preflight response is not successful. Status code: 500"**  
- Re-apply the CORS config above (e.g. `aws s3api put-bucket-cors ...`). The sample uses `AllowedHeaders: ["*"]` so the browser’s preflight headers are accepted.  
- If the bucket is behind **CloudFront**, enable CORS for the distribution (e.g. use the “CORS-S3Origin” origin request policy) and allow the `OPTIONS` method and `Origin`, `Access-Control-Request-Headers`, `Access-Control-Request-Method` headers so the preflight reaches S3 correctly.

## App workflows

- user upload docs
- save to s3
- server send out sqs messages
- server worker get sqs messages:
    - receipt parsing with aws bedrock
    - bank statmment parsing using server logic
- when all parsing messages is completed
- server do internal matching/reconciliation algorithm
- done

> Note that during the process of parsing docs, the user should be notified which doc is pending, being sent to aws bedrock, finished pening reconciliation

---

## Architecture (Production)

- **App Runner** serves the FastAPI HTTP API.
- **ECS Fargate** runs a separate SQS worker process from the same codebase (different entrypoint).
- Both share **RDS**, **S3**, and **SQS**. See prior architecture discussion for Dockerfile multi-target setup.

---

## Todo

Priority list of endpoints, organized into implementation tiers. Each tier builds on the previous one.

---

### Tier 1 — Foundation (Auth + Upload)
> *Goal: Users can log in and upload documents. This is the minimum for any demo.*

#### Authentication (`/auth`)
- [x] `POST /auth/login` — Validates credentials (email + password) and returns a JWT access token.
- [x] `GET /auth/me` — Returns the current user's profile and role from the JWT.

> For now, we will **not** allow new-user registration. The following accounts should be seeded in the DB via `seed.py`:
> - `dev1`, `dev2`, `admin1`, `admin2`
>
> Reference: [FastAPI Security — OAuth2 + JWT](https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/) — use `pwdlib` with Argon2 for hashing.

#### Document Upload (`/documents`)
- [x] `POST /documents/upload-url` — *(Authenticated)*
    - Accepts: `{ file_name, file_type, document_type }` where `document_type` is `"receipt"` or `"bank_statement"`.
    - Logic:
        1. Generates a unique S3 object key (e.g., `user_{id}/{uuid}.pdf`).
        2. Calls `boto3` to generate a **presigned PUT URL** for direct client → S3 upload.
        3. Creates a `documents` row in PostgreSQL with `status = "pending_upload"`.
    - Returns: `{ upload_url, document_id, s3_key }`.
- [x] `POST /documents/{document_id}/confirm-upload` — *(Authenticated)*
    - Client calls this after successfully uploading to S3.
    - Logic:
        1. Verifies the object exists in S3 (HEAD request).
        2. Updates document status to `"pending_processing"`.
        3. Sends an SQS message: `{ type: "parse_receipt" | "parse_statement", payload: { document_id, s3_key, user_id } }`.
    - Returns: `{ document_id, status: "pending_processing" }`.

---

### Tier 2 — Processing Status & Document Management
> *Goal: Users can track processing progress and view their uploaded documents.*

#### Document Status (`/documents`)
- [x] `GET /documents` — *(Authenticated)* List all documents for the current user (reference user_id from JWT). Supports query params:
    - `?status=pending_upload|pending_processing|processing|parsed|failed`
    - `?document_type=receipt|bank_statement`
- [x] `GET /documents/{document_id}` — *(Authenticated)* Get a single document's details and current processing status.
- [x] `DELETE /documents/{document_id}` — *(Authenticated)* Soft-delete a document (marks as deleted; removes S3 object in background).

#### Batch / Job Status (`/jobs`)
- [ ] `POST /jobs` — *(Authenticated)* Create a reconciliation job/batch grouping a set of uploaded document IDs together.
    - Accepts: `{ document_ids: [1, 2, 3, ...], name?: "June 2025 Recon" }`
    - Returns: `{ job_id, status: "pending", document_count }`.
- [ ] `GET /jobs/{job_id}/status` — *(Authenticated)* Returns per-document processing progress within a job:
    - Returns: `{ job_id, status, documents: [{ document_id, file_name, document_type, status }] }`.
    - Frontend can poll this endpoint to show real-time progress (pending → processing → parsed → reconciled).

---

### Tier 3 — Parsed Data (Receipts & Bank Statements)
> *Goal: Users can view and correct AI-parsed results before reconciliation.*

#### Receipts (`/receipts`)
- [x] `GET /receipts` — *(Authenticated)* List parsed receipts for the current user.
    - `?match_status=unmatched|perfect_matched|bundle_matched|manual`
    - `?job_id=123`
- [x] `GET /receipts/{receipt_id}` — *(Authenticated)* Get full receipt details (parsed vendor, amount, date, expense type, S3 file URL).
- [x] `PATCH /receipts/{receipt_id}` — *(Authenticated)* Manually correct parsed receipt fields (vendor, amount, date, etc.) before reconciliation.
- [x] `GET /receipts/{receipt_id}/file-url` — *(Authenticated)* Generate a presigned GET URL for viewing/downloading the original receipt file from S3.

#### Bank Statements (`/statements`)
- [x] `GET /statements` — *(Authenticated)* List parsed bank statements.
- [x] `GET /statements/{statement_id}` — *(Authenticated)* Get statement metadata + all parsed line items.
- [x] `GET /statements/{statement_id}/lines` — *(Authenticated)* List all parsed line items for a statement.
    - `?match_status=unmatched|perfect_matched|bundle_matched|manual`
- [x] `PATCH /statements/{statement_id}/lines/{line_id}` — *(Authenticated)* Manually correct a parsed statement line (description, vendor, amount, date).
- [x] `GET /statements/{statement_id}/file-url` — *(Authenticated)* Presigned GET URL for the original bank statement PDF.

---

### Tier 4 — Reconciliation
> *Goal: The core business logic — matching receipts to bank statement lines.*

#### Reconciliation (`/reconciliation`)
- [ ] `POST /reconciliation/jobs/{job_id}/run` — *(Authenticated)* Trigger the reconciliation algorithm for a job.
    - Pre-condition: All documents in the job must have `status = "parsed"`.
    - Logic: Runs the matching algorithm (exact match on amount + date, fuzzy match on vendor, bundle detection).
    - Returns: `{ job_id, status: "reconciling" }`.
- [ ] `GET /reconciliation/jobs/{job_id}/results` — *(Authenticated)* Get reconciliation results for a job.
    - Returns: `{ job_id, status, summary: { total_lines, matched, unmatched, bundle_matched }, matches: [...] }`.
- [ ] `GET /reconciliation/jobs/{job_id}/matches` — *(Authenticated)* List all matches found.
    - Each match: `{ match_id, statement_line: {...}, receipts: [{...}], match_type, confidence_score }`.
    - `?match_type=perfect_matched|bundle_matched`
- [ ] `GET /reconciliation/jobs/{job_id}/unmatched` — *(Authenticated)* List all unmatched statement lines and unmatched receipts separately.

#### Manual Matching (`/reconciliation`)
- [ ] `POST /reconciliation/matches` — *(Authenticated)* Manually create a match between a statement line and one or more receipts.
    - Accepts: `{ line_id, receipt_ids: [1, 2], match_type: "manual" }`.
- [ ] `DELETE /reconciliation/matches/{match_id}` — *(Authenticated)* Remove/undo a match (resets line + receipt status to `unmatched`).
- [ ] `PATCH /reconciliation/matches/{match_id}` — *(Authenticated)* Switch matching receipt?

---

### Tier 5 — Account Books & Admin
> *Goal: Multi-account support, role-based access control, and administrative controls.*

#### Role Permission Matrix

| Capability | Developer | Admin | Viewer |
|---|---|---|---|
| Manage global users (CRUD) | Yes | — | — |
| Create / edit / delete account books | Yes | Own only | — |
| Add viewers to account book | Yes (any) | Viewers only | — |
| Upload / modify / delete documents | Yes | Own account books | — |
| View documents, receipts, statements | All | Own account books | Shared account books (read-only) |
| Export | Yes | Yes | Yes |

#### Developer — User Management (`/admin/users`)

All endpoints require `developer` role.

- [x] `GET /admin/users` — List all users. Supports `?role=admin|developer|viewer` and `?is_active=true|false` filters.
- [x] `POST /admin/users` — Create a new user `{ name, email, password, role }`. Only developers can assign any role including `admin`.
- [x] `GET /admin/users/{user_id}` — Get a single user's details.
- [x] `PATCH /admin/users/{user_id}` — Update user fields (name, email, role, is_active). Supports password reset via `{ new_password }`.
- [x] `DELETE /admin/users/{user_id}` — Soft-deactivate a user (`is_active = false`). Does not delete data.

#### Account Books (`/accounts`)

- [x] `POST /accounts` — *(Admin, Developer)* Create account book `{ bank_name, account_name, account_type, currency, account_number_last4 }`. Auto-creates an `owner` membership for the creator.
- [x] `GET /accounts` — *(Any authenticated)* List accessible account books. Developer sees all; admin sees owned; viewer sees shared.
- [x] `GET /accounts/{account_id}` — *(Any authenticated)* Get account book details (if user has access).
- [x] `PATCH /accounts/{account_id}` — *(Owner admin or Developer)* Update account book details.
- [x] `DELETE /accounts/{account_id}` — *(Owner admin or Developer)* Soft-delete account book.

#### Account Book Members (`/accounts/{account_id}/members`)

- [x] `GET /accounts/{account_id}/members` — *(Owner admin, Developer)* List all members of an account book.
- [x] `POST /accounts/{account_id}/members` — *(Owner admin, Developer)* Add a user as viewer `{ user_id }`. Admin can only add viewers (not other admins — must delegate to developer). Developers cannot be added (implicit access).
- [x] `DELETE /accounts/{account_id}/members/{user_id}` — *(Owner admin, Developer)* Remove a viewer from account book. Cannot remove the owner.

---

### Tier 6 — Polish & Analytics
> *Goal: Dashboard data, export, and quality-of-life improvements.*

#### Dashboard (`/dashboard`)
- [ ] `GET /dashboard/summary` — *(Authenticated)* High-level stats for the current user:
    - Total documents uploaded, pending processing, parsed, failed.
    - Total receipts, matched vs unmatched.
    - Total statement lines, matched vs unmatched.
    - Recent activity feed.
- [ ] `GET /dashboard/jobs` — *(Authenticated)* List all reconciliation jobs with summary stats.

#### Export (`/export`)
- [ ] `GET /export/jobs/{job_id}/csv` — *(Authenticated)* Export reconciliation results as CSV.
- [ ] `GET /export/jobs/{job_id}/report` — *(Authenticated)* Generate a reconciliation summary report (PDF or JSON).

#### Health & System
- [ ] `GET /health` — Public health check (DB connectivity, SQS reachable, S3 reachable).
- [ ] `GET /health/bedrock` — *(Authenticated)* Bedrock model availability check.

---

### Models & Enums

Data layer models implemented so far:

#### `Document` model
| Column | Type | Notes |
|--------|------|-------|
| `document_id` | `int` PK | |
| `file_name` | `str` | Original file name |
| `document_type` | `enum` | `receipt`, `bank_statement` |
| `s3_key` | `str` | S3 object key |
| `status` | `enum` | `pending_upload`, `pending_processing`, `processing`, `parsed`, `failed` |
| `uploaded_by` | `int` FK → users | |
| `account_id` | `int` FK → account_books | nullable |
| `receipt_id` | `int` FK → receipts | nullable, set after parsing |
| `statement_id` | `int` FK → bank_statements | nullable, set after parsing |
| `error_message` | `str` | nullable, set on failure |
| `deleted_at` | `datetime` | nullable, soft-delete |

#### `AccountBookMember` model (Tier 5)
| Column | Type | Notes |
|--------|------|-------|
| `id` | `int` PK | |
| `account_id` | `int` FK → account_books | CASCADE on delete |
| `user_id` | `int` FK → users | CASCADE on delete |
| `role` | `enum` | `owner`, `viewer` |
| `created_at` | `datetime` | |
| | | UNIQUE(`account_id`, `user_id`) |

#### `Job` model (Tier 2 — not yet implemented)
| Column | Type | Notes |
|--------|------|-------|
| `job_id` | `int` PK | |
| `name` | `str` | User-defined label |
| `status` | `enum` | `pending`, `processing`, `reconciling`, `completed`, `failed` |
| `created_by` | `int` FK → users | |

#### Enums
- `DocumentStatus`: `pending_upload`, `pending_processing`, `processing`, `parsed`, `failed`
- `DocumentType`: `receipt`, `bank_statement`
- `UserRole`: `admin`, `developer`, `viewer`
- `AccountType`: `checking`, `credit_card`
- `AccountBookRole`: `owner`, `viewer`
- `MatchStatus`: `unmatched`, `perfect_matched`, `bundle_matched`, `manual`
- `JobStatus`: `pending`, `processing`, `reconciling`, `completed`, `failed`

---

### SQS Message Types (Worker Handlers)

| Message Type | Trigger | Worker Action |
|---|---|---|
| `parse_receipt` | `POST /documents/{id}/confirm-upload` | Download from S3 → Bedrock VLM → write `Receipt` row → update `Document.status = parsed` |
| `parse_statement` | `POST /documents/{id}/confirm-upload` | Download from S3 → pdfplumber + Bedrock → write `BankStatement` + `BankStatementLine` rows → update `Document.status = parsed` |
| `run_reconciliation` | `POST /reconciliation/jobs/{id}/run` | Load all parsed receipts + lines for job → run matching algorithm → write `Match` rows → update `Job.status = completed` |
