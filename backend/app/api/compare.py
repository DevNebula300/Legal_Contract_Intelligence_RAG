from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.core.comparision_agent import compare_contracts
from app.models.schemas import Contract
from app.core.db import SessionLocal

router = APIRouter()

class CompareRequest(BaseModel):
    contract_id_a: str
    contract_id_b: str

@router.post("/compare")
def run_comparison(req: CompareRequest):
    db = SessionLocal()
    try:
        contract_a = db.query(Contract).filter(Contract.id == req.contract_id_a).first()
        contract_b = db.query(Contract).filter(Contract.id == req.contract_id_b).first()
        
        if not contract_a or not contract_b:
            raise HTTPException(status_code=404, detail="One or both contracts not found")
            
        comparisons = compare_contracts(req.contract_id_a, req.contract_id_b)
        
        return {
            "contract_a": {"id": contract_a.id, "name": contract_a.filename},
            "contract_b": {"id": contract_b.id, "name": contract_b.filename},
            "comparisons": comparisons
        }
    finally:
        db.close()
