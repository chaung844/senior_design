from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import (
    accounts,
    admin,
    auth,
    documents,
    jobs,
    receipts,
    reconciliation,
    statements,
)

app = FastAPI(title="Matcha Backend")
settings = get_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=[
        "Content-Type",
        "Accept",
        "Authorization",
        "X-CSRF-Token",
    ],
)

app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(jobs.router)
app.include_router(receipts.router)
app.include_router(reconciliation.router)
app.include_router(statements.router)
app.include_router(accounts.router)
app.include_router(admin.router)


@app.get("/")
def read_root():
    return {"message": "System Operational"}
