import os
import uuid
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct
from dotenv import load_dotenv
from app.core.db import SessionLocal
from app.models.schemas import Chunk
from app.core.embeddings import embed_documents

load_dotenv()

qdrant_client = QdrantClient(url=os.getenv("QDRANT_URL", "http://localhost:6333"))

def embed_and_store_chunks(contract_id: str):
    db = SessionLocal()
    try:
        chunks = db.query(Chunk).filter(Chunk.contract_id == contract_id).all()
        if not chunks:
            print(f"No chunks found for contract {contract_id}")
            return

        texts = [c.text for c in chunks]
        vectors = embed_documents(texts)

        points = [
            PointStruct(
                id=str(uuid.uuid5(uuid.NAMESPACE_DNS, c.id)),
                vector=vec,
                payload={
                    "chunk_id": c.id,
                    "contract_id": c.contract_id,
                    "heading": c.heading,
                    "text": c.text,
                    "page_start": c.page_start,
                    "page_end": c.page_end,
                }
            )
            for c, vec in zip(chunks, vectors)
        ]

        qdrant_client.upsert(collection_name="contract_chunks", points=points)
        print(f"Embedded and stored {len(points)} chunks for contract {contract_id}")
    finally:
        db.close()