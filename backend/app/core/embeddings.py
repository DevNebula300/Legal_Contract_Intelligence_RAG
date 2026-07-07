import os
from qdrant_client import QdrantClient
from dotenv import load_dotenv

load_dotenv()

from sentence_transformers import SentenceTransformer

MODEL_NAME = "BAAI/bge-small-en-v1.5"
model = SentenceTransformer(MODEL_NAME)
VECTOR_SIZE = 384

def embed_documents(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    embeddings = model.encode(texts)
    return embeddings.tolist()

def embed_query(text: str) -> list[float]:
    embedding = model.encode(text)
    return embedding.tolist()