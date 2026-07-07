from app.core.playbook import PLAYBOOK

def keyword_prefilter(clause_type: str, text: str) -> dict | None:
    if clause_type not in PLAYBOOK:
        return None

    rules = PLAYBOOK[clause_type]["rules"]
    text_lower = text.lower()

    for rule in rules:
        if any(kw in text_lower for kw in rule["keywords"]):
            return {
                "risk_level": rule["risk_level"],
                "rationale": rule["rationale"],
                "matched_rule": rule["condition"],
                "needs_context": False,
            }
    return None