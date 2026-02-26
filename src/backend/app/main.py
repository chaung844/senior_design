from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import auth, documents, receipts, statements, users

app = FastAPI(title="Matcha Backend")
settings = get_settings()

cors_origins = settings.cors_origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in cors_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)
app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(receipts.router)
app.include_router(statements.router)


@app.get("/")
def read_root():
    return {"message": "System Operational"}
