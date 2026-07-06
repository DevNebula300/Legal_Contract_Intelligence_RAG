import os
from fastapi import APIRouter
from pydantic import BaseModel
from qdrant_client import QdrantClient
from qdrant_client.models import Filter, FieldCondition, MatchValue
from dotenv import load_dotenv
from app.core.embeddings import embed_query

load_dotenv()

router = APIRouter()
qdrant_client = QdrantClient(url=os.getenv("QDRANT_URL", "http://localhost:6333"))

class QueryRequest(BaseModel):
    contract_id: str
    question: str
    top_k: int = 5

@router.post("/query")
def query_contract(req: QueryRequest):
    q_vector = embed_query(req.question)

    results = qdrant_client.search(
        collection_name="contract_chunks",
        query_vector=q_vector,
        query_filter=Filter(
            must=[FieldCondition(key="contract_id", match=MatchValue(value=req.contract_id))]
        ),
        limit=req.top_k,
    )

    return {
        "question": req.question,
        "results": [
            {
                "chunk_id": r.payload["chunk_id"],
                "heading": r.payload["heading"],
                "text": r.payload["text"],
                "page_start": r.payload["page_start"],
                "score": r.score,
            }
            for r in results
        ]
    }