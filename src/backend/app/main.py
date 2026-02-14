from fastapi import FastAPI
from app.routers import users

app = FastAPI(title="Matcha Backend")

app.include_router(users.router)

@app.get("/")
def read_root():
    return {"message": "System Operational"}