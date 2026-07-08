from app.core.precedent import build_precedent_query
from app.core.precedent_cache import get_cached_or_search
def attach_precedents_node(state: dict) -> dict:
    for flag in state["final_report"]:
        if flag["risk_level"] in ("medium", "high"):
            query = build_precedent_query(flag["clause_type"], flag["rationale"] or "")
            flag["precedents"] = get_cached_or_search(query)
        else:
            flag["precedents"] = []
    return state