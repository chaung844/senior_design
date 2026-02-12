# Backend for Matcha AI-Assisted Bank Statement Reconciliation System

## Stacks
- `FastAPI` for server + API endpoints
- `Pydantic` for data validation
- `AWS RDS ` for relational database manaement
- `AWS S3` fpr storing objects (e.g, PDFs, Images)

## Directory
```shell
src/backend/
├── app/                        # Main application source code
│   ├── __init__.py
│   ├── main.py                 # App entry point (FastAPI instance)
│   ├── call_model.py           # Calling model via AWS Bedrock API
│   ├── config.py               # Server configuration file by Pydantic
│   └── utils/                  # Utility functions
│       ├── __init__.py
│       ├── lm_utils.py         
│   ├── routers/                
│       ├── __init__.py
├── safe/                       # Sensitive data zone. Files in this directory should never be commited
│   ├── prompts/                # System instruction (refer below on how to get prompts data)
│   ├── samples/                # Sample bank statements + receipts  (refer below on how to get prompts data)
├── .env.example                # Example Environment variables
├── .gitignore                  # Files to ignore (venv, db, pyc)
├── pyproject.toml              # Project metadata & dependencies (Managed by uv)
├── uv.lock                     # Exact dependency versions (Managed by uv)
└── README.md
```

> *How to get `safe/` data?*
>
> System prompt should be shared with teammates via google docs sheet (for now in search of better secrets management option).
>
> Sample data should be shared with teammates via project advisor from Midea.

## Running backend
- Make sure [uv](https://docs.astral.sh/uv/) is installed
- Install python dependencies
```bash
uv sync
```
- Refer to `.env.example` file for how to setup `.env`
> Note that you only need to put in AWS Bedrock API key, other variables value can be derived from `config.py` default value.
- Run the server
```bash
uv run uvicorn app.main:app --reload
```
- From the localhost link, append `/docs` to get swagger UI
