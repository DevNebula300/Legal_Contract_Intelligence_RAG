from app.core.playbook import PLAYBOOK
from app.core.llm_client import call_llm, parse_json_response
from app.core.db import SessionLocal
from app.models.schemas import Chunk

PLAYBOOK_CATEGORIES = list(PLAYBOOK.keys())


def classify_single_chunk(heading: str, text: str) -> str | None:
    categories_list = "\n".join(f"- {c}" for c in PLAYBOOK_CATEGORIES)

    prompt = f"""You are classifying a contract clause into one of a fixed set of legal categories.

Categories:
{categories_list}
- None (if this clause does not clearly match any category above)

Clause heading: {heading}
Clause text: {text[:800]}

Which single category best matches this clause? Consider the heading and the actual content, not just the heading wording.

Respond ONLY with JSON: {{"category": "exact category name from the list above, or None"}}"""

    try:
        raw = call_llm(prompt)
        parsed = parse_json_response(raw)
        category = parsed.get("category")
        if category in PLAYBOOK_CATEGORIES:
            return category
        return None
    except Exception as e:
        print(f"Classification failed for heading '{heading}': {e}")
        return None


def classify_chunks(contract_id: str) -> dict:
    db = SessionLocal()
    try:
        chunks = db.query(Chunk).filter(Chunk.contract_id == contract_id).all()
        results = {}

        for chunk in chunks:
            category = classify_single_chunk(chunk.heading or "", chunk.text)
            chunk.clause_type = category
            results[chunk.heading] = category
            print(f"Classified '{chunk.heading}' -> {category}")

        db.commit()
        return results
    finally:
        db.close()