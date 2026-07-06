from sentence_transformers import SentenceTransformer

model = SentenceTransformer("BAAI/bge-small-en-v1.5")


QUERY_PREFIX = "Represent this sentence for searching relevant passages: "

def embed_documents(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    embeddings = model.encode(texts, normalize_embeddings=True, convert_to_numpy=True)
    return embeddings.tolist()

def embed_query(text: str) -> list[float]:
    prefixed = QUERY_PREFIX + text
    embedding = model.encode(prefixed, normalize_embeddings=True, convert_to_numpy=True)
    return embedding.tolist()