import os
from fastapi import APIRouter
from pydantic import BaseModel
from qdrant_client import QdrantClient
from qdrant_client.models import Filter, FieldCondition, MatchValue
from dotenv import load_dotenv
from app.core.embeddings import embed_query
from app.core.llm import generate_answer

load_dotenv()

router = APIRouter()
qdrant_client = QdrantClient(url=os.getenv("QDRANT_URL", "http://localhost:6333"))

class RiskRequest(BaseModel):
    contract_id: str

@router.post("/risk")
def generate_risk_review(req: RiskRequest):
    q_vector = embed_query("indemnification liability termination risk breach damages")

    response = qdrant_client.query_points(
        collection_name="contract_chunks",
        query=q_vector,
        query_filter=Filter(
            must=[FieldCondition(key="contract_id", match=MatchValue(value=req.contract_id))]
        ),
        limit=10,
    )
    results = response.points

    if not results:
        return {
            "contract_id": req.contract_id,
            "risk_review": "<p>No analyzable text was found in the database for this contract. It may be too short or still processing. Please try again in a moment.</p>"
        }

    context = "\n\n".join([f"Clause: {r.payload['heading']}\nText: {r.payload['text']}" for r in results])
    
    prompt = "Please perform a risk review of this contract based on the provided clauses. Identify high, medium, and low risks. Format your response clearly using HTML tags like <h3>, <strong>, <ul>, and <li>."

    answer = generate_answer(prompt, context)

    return {
        "contract_id": req.contract_id,
        "risk_review": answer
    }
