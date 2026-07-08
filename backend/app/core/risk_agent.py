from app.core.playbook import PLAYBOOK
from app.core.risk_rules import keyword_prefilter
from app.core.llm_client import call_llm, parse_json_response
from app.core.db import SessionLocal
from app.models.schemas import Chunk
from typing import TypedDict, Optional
class ClauseAssessment(TypedDict):
    chunk_id: str
    clause_type: str
    text: str
    status: str
    risk_level: Optional[str]
    rationale: Optional[str]
    matched_rule: Optional[str]
    needs_context: bool
    source_chunk_ids: list[str]
class RiskReviewState(TypedDict):
    contract_id: str
    chunks: list
    assessments: list[ClauseAssessment]
    ambiguous_queue: list[ClauseAssessment]
    final_report: list[ClauseAssessment]
def check_missing_clauses(present_types: set[str]) -> list[dict]:
    missing = []
    for clause_name, rules in PLAYBOOK.items():
        if rules["required"] and clause_name not in present_types:
            missing.append({
                "clause_type": clause_name,
                "status": "missing",
                "risk_level": rules["risk_if_missing"],
                "rationale": f"{clause_name} clause not found in contract.",
                "matched_rule": None,
                "needs_context": False,
                "source_chunk_ids": [],
            })
    return missing
def assess_clauses_node(state: dict) -> dict:
    assessments = []
    ambiguous_queue = []
    for chunk in state["chunks"]:
        clause_type = chunk.clause_type
        if not clause_type or clause_type not in PLAYBOOK:
            continue
        prefilter_result = keyword_prefilter(clause_type, chunk.text)
        if prefilter_result:
            assessments.append({
                "chunk_id": chunk.id,
                "clause_type": clause_type,
                "text": chunk.text,
                "status": "present",
                **prefilter_result,
                "source_chunk_ids": [chunk.id],
            })
        else:
            ambiguous_queue.append({
                "chunk_id": chunk.id,
                "clause_type": clause_type,
                "text": chunk.text,
                "status": "present",
                "risk_level": None,
                "rationale": None,
                "matched_rule": None,
                "needs_context": True,
                "source_chunk_ids": [chunk.id],
            })
    state["assessments"] = assessments
    state["ambiguous_queue"] = ambiguous_queue
    return state
def gather_context_node(state: dict) -> dict:
    db = SessionLocal()
    try:
        for entry in state["ambiguous_queue"]:
            definitions_chunk = (
                db.query(Chunk)
                .filter(
                    Chunk.contract_id == state["contract_id"],
                    Chunk.clause_type == "Definitions",
                )
                .first()
            )
            entry["context_text"] = definitions_chunk.text if definitions_chunk else ""
        return state
    finally:
        db.close()
def reassess_with_context_node(state: dict) -> dict:
    final_assessments = []
    for entry in state["ambiguous_queue"]:
        clause_type = entry["clause_type"]
        rules = PLAYBOOK[clause_type]["rules"]
        rules_description = "\n".join(
            f"- {r['condition']}: {r['rationale']} (risk: {r['risk_level']})"
            for r in rules
        ) or "No specific keyword rules defined; use general legal judgment."

        context_section = (
            f"\n\nRelevant definitions from the contract:\n{entry['context_text']}"
            if entry.get("context_text") else ""
        )
        prompt = f"""You are a legal risk reviewer. Assess this {clause_type} clause against the review playbook.
Playbook rules for {clause_type}:
{rules_description}
Clause text:
{entry['text']}{context_section}
Think step by step: does this clause match any playbook risk pattern? Is there ambiguous or unusual language that should be flagged?
Respond ONLY with JSON, no other text:
{{"risk_level": "low|medium|high", "rationale": "one or two sentences", "matched_rule": "condition name or null"}}"""
        try:
            raw = call_llm(prompt)
            parsed = parse_json_response(raw)
            matched = parsed.get("matched_rule")
            if matched in (None, "null", "None", ""):
                matched = None
            entry.update({
                "risk_level": parsed.get("risk_level", "medium"),
                "rationale": parsed.get("rationale", "LLM assessment failed to parse."),
                "matched_rule": matched,
            })
        except Exception as e:
            entry.update({
                "risk_level": "medium",
                "rationale": f"LLM assessment failed: {e}. Manual review recommended.",
                "matched_rule": None,
            })

        final_assessments.append(entry)
    state["assessments"].extend(final_assessments)
    return state
def compile_final_report_node(state: dict) -> dict:
    present_types = {c.clause_type for c in state["chunks"] if c.clause_type}
    missing = check_missing_clauses(present_types)
    state["final_report"] = missing + state["assessments"]
    return state