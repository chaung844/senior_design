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
- [ ] `POST /auth/login` — Validates credentials (email + password) and returns a JWT access token.
- [ ] `GET /auth/me` — Returns the current user's profile and role from the JWT.

> For now, we will **not** allow new-user registration. The following accounts should be seeded in the DB via `seed.py`:
> - `dev1`, `dev2`, `admin1`, `admin2`
>
> Reference: [FastAPI Security — OAuth2 + JWT](https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/) — use `pwdlib` with Argon2 for hashing.

#### Document Upload (`/documents`)
- [ ] `POST /documents/upload-url` — *(Authenticated)*
    - Accepts: `{ file_name, file_type, document_type }` where `document_type` is `"receipt"` or `"bank_statement"`.
    - Logic:
        1. Generates a unique S3 object key (e.g., `user_{id}/{uuid}.pdf`).
        2. Calls `boto3` to generate a **presigned PUT URL** for direct client → S3 upload.
        3. Creates a `documents` row in PostgreSQL with `status = "pending_upload"`.
    - Returns: `{ upload_url, document_id, s3_key }`.
- [ ] `POST /documents/{document_id}/confirm-upload` — *(Authenticated)*
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
- [ ] `GET /documents` — *(Authenticated)* List all documents for the current user. Supports query params:
    - `?status=pending_upload|pending_processing|processing|parsed|failed`
    - `?document_type=receipt|bank_statement`
- [ ] `GET /documents/{document_id}` — *(Authenticated)* Get a single document's details and current processing status.
- [ ] `DELETE /documents/{document_id}` — *(Authenticated)* Soft-delete a document (marks as deleted; removes S3 object in background).

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
- [ ] `GET /receipts` — *(Authenticated)* List parsed receipts for the current user.
    - `?match_status=unmatched|perfect_matched|bundle_matched|manual`
    - `?job_id=123`
- [ ] `GET /receipts/{receipt_id}` — *(Authenticated)* Get full receipt details (parsed vendor, amount, date, expense type, S3 file URL).
- [ ] `PATCH /receipts/{receipt_id}` — *(Authenticated)* Manually correct parsed receipt fields (vendor, amount, date, etc.) before reconciliation.
- [ ] `GET /receipts/{receipt_id}/file-url` — *(Authenticated)* Generate a presigned GET URL for viewing/downloading the original receipt file from S3.

#### Bank Statements (`/statements`)
- [ ] `GET /statements` — *(Authenticated)* List parsed bank statements.
- [ ] `GET /statements/{statement_id}` — *(Authenticated)* Get statement metadata + all parsed line items.
- [ ] `GET /statements/{statement_id}/lines` — *(Authenticated)* List all parsed line items for a statement.
    - `?match_status=unmatched|perfect_matched|bundle_matched|manual`
- [ ] `PATCH /statements/{statement_id}/lines/{line_id}` — *(Authenticated)* Manually correct a parsed statement line (description, vendor, amount, date).
- [ ] `GET /statements/{statement_id}/file-url` — *(Authenticated)* Presigned GET URL for the original bank statement PDF.

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
> *Goal: Multi-account support and administrative controls.*

#### Account Books (`/accounts`)
- [ ] `POST /accounts` — *(Authenticated)* Create a new account book (bank name, account type, last 4 digits).
- [ ] `GET /accounts` — *(Authenticated)* List all account books for the current user.
- [ ] `GET /accounts/{account_id}` — *(Authenticated)* Get account book details.
- [ ] `PATCH /accounts/{account_id}` — *(Authenticated)* Update account book details.
- [ ] `DELETE /accounts/{account_id}` — *(Authenticated)* Delete an account book.

#### Admin — User Management (`/admin`)
- [ ] `GET /admin/users` — *(Admin only)* List all users.
- [ ] `POST /admin/users` — *(Admin only)* Create a new user (name, email, password, role).
- [ ] `PATCH /admin/users/{user_id}` — *(Admin only)* Update a user's role or reset password.
- [ ] `DELETE /admin/users/{user_id}` — *(Admin only)* Deactivate a user account.

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

### New Models / Enums Needed

The endpoint plan above assumes the following additions to the data layer:

#### `Document` model (new)
| Column | Type | Notes |
|--------|------|-------|
| `document_id` | `int` PK | |
| `file_name` | `str` | Original file name |
| `document_type` | `enum` | `receipt`, `bank_statement` |
| `s3_key` | `str` | S3 object key |
| `status` | `enum` | `pending_upload`, `pending_processing`, `processing`, `parsed`, `failed` |
| `uploaded_by` | `int` FK → users | |
| `job_id` | `int` FK → jobs | nullable, assigned when grouped |
| `receipt_id` | `int` FK → receipts | nullable, set after parsing |
| `statement_id` | `int` FK → bank_statements | nullable, set after parsing |
| `error_message` | `str` | nullable, set on failure |

#### `Job` model (new)
| Column | Type | Notes |
|--------|------|-------|
| `job_id` | `int` PK | |
| `name` | `str` | User-defined label |
| `status` | `enum` | `pending`, `processing`, `reconciling`, `completed`, `failed` |
| `created_by` | `int` FK → users | |

#### New Enums
- `DocumentStatus`: `pending_upload`, `pending_processing`, `processing`, `parsed`, `failed`
- `JobStatus`: `pending`, `processing`, `reconciling`, `completed`, `failed`

---

### SQS Message Types (Worker Handlers)

| Message Type | Trigger | Worker Action |
|---|---|---|
| `parse_receipt` | `POST /documents/{id}/confirm-upload` | Download from S3 → Bedrock VLM → write `Receipt` row → update `Document.status = parsed` |
| `parse_statement` | `POST /documents/{id}/confirm-upload` | Download from S3 → pdfplumber + Bedrock → write `BankStatement` + `BankStatementLine` rows → update `Document.status = parsed` |
| `run_reconciliation` | `POST /reconciliation/jobs/{id}/run` | Load all parsed receipts + lines for job → run matching algorithm → write `Match` rows → update `Job.status = completed` |
