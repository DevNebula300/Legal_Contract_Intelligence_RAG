import hashlib
import json
from app.core.db import SessionLocal
from app.models.schemas import PrecedentCache
from app.core.precedent import search_case_law
def get_cached_or_search(query: str) -> list[dict]:
    db = SessionLocal()
    try:
        query_hash = hashlib.sha256(query.encode()).hexdigest()
        cached = db.query(PrecedentCache).filter(PrecedentCache.id == query_hash).first()
        if cached:
            print(f"Cache HIT for query: {query[:50]}...")
            return json.loads(cached.results_json)
        print(f"Cache MISS — calling CourtListener for: {query[:50]}...")
        results = search_case_law(query)
        cache_entry = PrecedentCache(
            id=query_hash,
            query=query,
            results_json=json.dumps(results),
        )
        db.add(cache_entry)
        db.commit()
        return results
    finally:
        db.close()