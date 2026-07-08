from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.db import Base, engine
from app.api import upload, query, risk, report, compare, precedent

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Legal Contract Intelligence")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(upload.router)
app.include_router(query.router)
app.include_router(risk.router)
app.include_router(report.router)
app.include_router(compare.router)
app.include_router(precedent.router)
@app.get("/health")
def health():
    return {"status": "ok"}
@app.get("/")
def read_root():
    return {"message": "Welcome to API"}
