import os
from dotenv import load_dotenv

load_dotenv()

MODEL_NAME = "BAAI/bge-small-en-v1.5"
VECTOR_SIZE = 384

# Fully lazy-loaded — both the library and model are initialized on first use.
# sentence_transformers imports scipy/sklearn/torch at module level (~500MB).
# Deferring this prevents MemoryError on memory-constrained systems.
_model = None


def _get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer(MODEL_NAME)
    return _model


def embed_documents(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    embeddings = _get_model().encode(texts)
    return embeddings.tolist()


def embed_query(text: str) -> list[float]:
    embedding = _get_model().encode(text)
    return embedding.tolist()