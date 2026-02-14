# Backend for Matcha AI-Assisted Bank Statement Reconciliation System

## Stacks
- `FastAPI` for server + API endpoints
- `Pydantic` for data validation
- `AWS RDS ` for relational database manaement
- `AWS S3` fpr storing objects (e.g, PDFs, Images)
- `PostgreSQL 16` (local via `Docker` / prod via `AWS RDS`)
- `SQLAlchemy` (ORM) & `Alembic` (Migration)

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
- Apply database migrations and (optional) seed test data:
```bash
uv run alembic upgrade head
uv run seed.py
```
- Run the server
```bash
uv run uvicorn app.main:app --reload
```
- From the localhost link, append `/docs` to get swagger UI

## Notes
- Currently, AWS Bedrock foundation model is invoked via OpenAI-Compatible API call. Future features involve deeper integration with AWS (.e.g, S3, RDS, ...) may need to use [boto3](https://boto3.amazonaws.com/v1/documentation/api/latest/index.html)([installation](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)) - AWS Python SDK.
