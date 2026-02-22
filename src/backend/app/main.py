from fastapi import FastAPI
from app.routers import users, auth, documents

app = FastAPI(title="Matcha Backend")

app.include_router(users.router)
app.include_router(auth.router)
app.include_router(documents.router)


@app.get("/")
def read_root():
    return {"message": "System Operational"}
