from app.core.db import SessionLocal
from app.models.schemas import Chunk
from app.core.risk_graph import risk_review_graph

def run_risk_review(contract_id: str) -> list[dict]:
    db = SessionLocal()
    try:
        chunks = db.query(Chunk).filter(Chunk.contract_id == contract_id).all()
        initial_state = {
            "contract_id": contract_id,
            "chunks": chunks,
            "assessments": [],
            "ambiguous_queue": [],
            "final_report": [],
        }
        result = risk_review_graph.invoke(initial_state)
        return result["final_report"]
    finally:
        db.close()