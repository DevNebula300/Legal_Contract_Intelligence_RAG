from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.core.precedent_agent import search_precedent
from app.models.schemas import Contract
from app.core.db import SessionLocal

router = APIRouter()

class PrecedentRequest(BaseModel):
    contract_id: str
    query: Optional[str] = None

@router.post("/precedent")
def get_precedent(req: PrecedentRequest):
    db = SessionLocal()
    try:
        contract = db.query(Contract).filter(Contract.id == req.contract_id).first()
        if not contract:
            raise HTTPException(status_code=404, detail="Contract not found")
            
        results = search_precedent(req.contract_id, req.query)
        
        return {
            "contract_id": contract.id,
            "query_used": req.query or "Auto-extracted",
            "precedents": results
        }
    finally:
        db.close()
