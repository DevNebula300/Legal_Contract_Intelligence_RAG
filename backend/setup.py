from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams
import os
from dotenv import load_dotenv

load_dotenv()

client = QdrantClient(url=os.getenv("QDRANT_URL", "http://localhost:6333"))

client.recreate_collection(
    collection_name="contract_chunks",
    vectors_config=VectorParams(size=768, distance=Distance.COSINE),
)

print("collection created")