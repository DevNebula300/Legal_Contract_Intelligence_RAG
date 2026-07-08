import httpx
import os
import re
from dotenv import load_dotenv
load_dotenv()
COURTLISTENER_BASE = "https://www.courtlistener.com/api/rest/v4"
COURTLISTENER_TOKEN = os.getenv("COURTLISTENER_TOKEN", "")
def search_case_law(query: str, limit: int = 3) -> list[dict]:
    headers = {}
    if COURTLISTENER_TOKEN:
        headers["Authorization"] = f"Token {COURTLISTENER_TOKEN}"
    params = {"q": query, "order_by": "score desc"}
    try:
        response = httpx.get(
            f"{COURTLISTENER_BASE}/search/",
            params=params,
            headers=headers,
            timeout=15.0,
        )
        response.raise_for_status()
        data = response.json()
    except httpx.HTTPError as e:
        print(f"CourtListener request failed: {e}")
        return []
    results = []
    for item in data.get("results", [])[:limit]:
        opinions = item.get("opinions", [])
        snippet = opinions[0].get("snippet", "") if opinions else ""
        snippet = " ".join(snippet.split())[:400]
        results.append({
            "case_name": item.get("caseName", "Unknown"),
            "court": item.get("court", ""),
            "date_filed": item.get("dateFiled", ""),
            "citation": item.get("citation", []),
            "url": f"https://www.courtlistener.com{item.get('absolute_url', '')}",
            "snippet": snippet,
        })
    return results
STOPWORDS = {
    "the", "a", "an", "of", "to", "for", "and", "or", "is", "are", "shall",
    "party", "parties", "may", "will", "this", "that", "with", "as", "in",
    "on", "be", "not", "if", "any", "such", "clause", "contract",
}
def build_precedent_query(clause_type: str, rationale: str) -> str:
    """Use clause type plus a few key terms from the rationale, not the full sentence —
    long natural-language queries return noisier, less relevant case law."""
    words = re.findall(r"[a-zA-Z]+", rationale.lower())
    key_terms = [w for w in words if w not in STOPWORDS][:5]
    return f"{clause_type} {' '.join(key_terms)} contract dispute"[:150]