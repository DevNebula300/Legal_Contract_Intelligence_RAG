from fastapi import FastAPI
from app.core.db import Base, engine
from app.api import upload
import app

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Legal Contract Intelligence")

app.include_router(upload.router)

@app.get("/health")
def health():
    return {"status": "ok"}
@app.get("/")
def read_root():
    return {"message": "Welcome to API"}
