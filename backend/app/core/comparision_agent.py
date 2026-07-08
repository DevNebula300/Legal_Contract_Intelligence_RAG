from collections import defaultdict
from app.core.db import SessionLocal
from app.models.schemas import Chunk
from app.core.llm_client import call_llm, parse_json_response
NORMALIZED_TYPES = {
    "governing law": "Governing Law",
    "applicable law": "Governing Law",
    "choice of law": "Governing Law",
    "jurisdiction": "Governing Law",
    "legal venue": "Governing Law",
    "confidentiality": "Confidentiality",
    "confidential": "Confidentiality",
    "non-disclosure": "Confidentiality",
    "nda": "Confidentiality",
    "confidential information": "Confidentiality",
    "termination": "Termination",
    "termination clause": "Termination",
    "ending the agreement": "Termination",
    "cancellation": "Termination",
    "expiration": "Termination",
    "limitation of liability": "Limitation of Liability",
    "liability": "Limitation of Liability",
    "limitation of damages": "Limitation of Liability",
    "exclusion of liability": "Limitation of Liability",
    "payment": "Payment",
    "payment terms": "Payment",
    "fees": "Payment",
    "pricing": "Payment",
    "compensation": "Payment",
    "invoice": "Payment",
    "intellectual property": "Intellectual Property",
    "ip": "Intellectual Property",
    "ownership": "Intellectual Property",
    "work product": "Intellectual Property",
    "copyright": "Intellectual Property",
    "dispute resolution": "Dispute Resolution",
    "arbitration": "Dispute Resolution",
    "litigation": "Dispute Resolution",
    "disputes": "Dispute Resolution",
    "force majeure": "Force Majeure",
    "indemnification": "Indemnification",
    "indemnity": "Indemnification",
    "warranty": "Warranties",
    "warranties": "Warranties",
    "assignment": "Assignment",
    "notice": "Notices",
    "notices": "Notices",
    "non-compete": "Non-Compete",
    "non compete": "Non-Compete",
    "non-solicitation": "Non-Solicitation",
    "data protection": "Data Protection",
    "privacy": "Data Protection",
    "gdpr": "Data Protection",
    "compliance": "Compliance",
    "entire agreement": "Entire Agreement",
    "amendment": "Amendment",
    "modification": "Amendment",
    "severability": "Severability",
    "miscellaneous": "Miscellaneous",
}
def normalize_clause_type(clause_type: str) -> str:
    if not clause_type:
        return ""
    key = clause_type.strip().lower()
    return NORMALIZED_TYPES.get(key, clause_type.strip())
def compare_contracts(contract_id_a: str, contract_id_b: str) -> list[dict]:
    db = SessionLocal()
    try:
        chunks_a = (
            db.query(Chunk)
            .filter(Chunk.contract_id == contract_id_a)
            .all()
        )
        chunks_b = (
            db.query(Chunk)
            .filter(Chunk.contract_id == contract_id_b)
            .all()
        )
        by_type_a = defaultdict(list)
        by_type_b = defaultdict(list)
        for chunk in chunks_a:
            if chunk.clause_type:
                by_type_a[
                    normalize_clause_type(chunk.clause_type)
                ].append(chunk)
        for chunk in chunks_b:
            if chunk.clause_type:
                by_type_b[
                    normalize_clause_type(chunk.clause_type)
                ].append(chunk)
        all_clause_types = sorted(
            set(by_type_a.keys()) | set(by_type_b.keys())
        )
        comparisons = []
        for clause_type in all_clause_types:
            chunks_for_a = by_type_a.get(clause_type, [])
            chunks_for_b = by_type_b.get(clause_type, [])
            text_a = "\n\n".join(chunk.text for chunk in chunks_for_a) if chunks_for_a else None
            text_b = "\n\n".join(chunk.text for chunk in chunks_for_b) if chunks_for_b else None
            if text_a and text_b:
                prompt = f"""
Compare the following "{clause_type}" clauses from two contracts.
Focus on:
- obligations
- rights
- responsibilities
- deadlines
- financial impact
- legal risk
Ignore minor wording changes.
If the clauses are effectively identical, clearly say so.
Contract A:
{text_a}
Contract B:
{text_b}
Return ONLY valid JSON:
{{
  "difference_summary": "One or two sentence summary."
}}
"""
                try:
                    raw = call_llm(prompt)
                    parsed = parse_json_response(raw)
                    summary = parsed.get(
                        "difference_summary",
                        "Could not compare clauses."
                    )
                except Exception as e:
                    summary = f"Comparison failed: {str(e)}"
                comparisons.append(
                    {
                        "clause_type": clause_type,
                        "status": "present_in_both",
                        "difference_summary": summary,
                        "text_a": text_a,
                        "text_b": text_b,
                    }
                )
            elif text_a:
                comparisons.append(
                    {
                        "clause_type": clause_type,
                        "status": "only_in_a",
                        "difference_summary": f"{clause_type} is present only in Contract A.",
                        "text_a": text_a,
                        "text_b": None,
                    }
                )
            elif text_b:
                comparisons.append(
                    {
                        "clause_type": clause_type,
                        "status": "only_in_b",
                        "difference_summary": f"{clause_type} is present only in Contract B.",
                        "text_a": None,
                        "text_b": text_b,
                    }
                )
        return comparisons
    finally:
        db.close()