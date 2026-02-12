from fastapi import FastAPI

app = FastAPI(title="Matcha Backend")


@app.get("/")
def read_root():
    return {"message": "System Operational"}
