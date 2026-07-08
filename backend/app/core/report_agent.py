import json
import os
from reportlab.platypus import SimpleDocTemplate, Paragraph
from reportlab.lib.styles import getSampleStyleSheet
from xml.sax.saxutils import escape
from app.core.llm_client import call_llm
from app.core.risk_runner import run_risk_review
from app.core.db import SessionLocal
from app.models.schemas import Chunk

# Stable output directory for generated PDF reports
REPORTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "data", "reports")
os.makedirs(REPORTS_DIR, exist_ok=True)

def create_report(contract_id: str) -> dict:
    raw_risks = run_risk_review(contract_id)
    db = SessionLocal()
    try:
        risk_results = []
        score = 0
        for r in raw_risks:
            risk_level = r.get("risk_level", "low")
            if risk_level.lower() == "high":
                score += 3
            elif risk_level.lower() == "medium":
                score += 2
            else:
                score += 1
            citation_parts = []
            chunk_id = r.get("chunk_id")
            if chunk_id:
                chunk = db.query(Chunk).filter(Chunk.id == chunk_id).first()
                if chunk:
                    if chunk.heading:
                        citation_parts.append(f"Heading: {chunk.heading}")
                    if chunk.page_start is not None:
                        citation_parts.append(f"Page Number: {chunk.page_start}")
            risk_results.append({
                "clause": r.get("clause_type"),
                "risk": risk_level,
                "reason": r.get("rationale"),
                "citation": ", ".join(citation_parts) if citation_parts else "N/A"
            })
    finally:
        db.close()
    
    overall_rating = "LOW"
    if score >= 11:
        overall_rating = "HIGH"
    elif score >= 6:
        overall_rating = "MEDIUM"
        
    max_score = max(len(raw_risks) * 3, 1) if raw_risks else 0

    high = sum(r["risk"].lower() == "high" for r in risk_results)
    medium = sum(r["risk"].lower() == "medium" for r in risk_results)
    low = sum(r["risk"].lower() == "low" for r in risk_results)

    prompt = f"""You are an experienced legal contract review assistant. Your task is to generate a professional **Contract Risk Review Report** based solely on the information provided. Do not invent facts, clauses, citations, or legal cases. If information is unavailable, clearly state "Not Available" rather than making assumptions.

# Objective

Generate a polished, client-facing report that summarizes the contract's legal risks, explains their impact, cites the relevant contract sections, identifies missing clauses, and recommends practical next steps.

## Contract Information

* Contract ID: {contract_id}
* Overall Risk Score: {score}/{max_score}
* Overall Risk Rating: {overall_rating}

Risk Summary

High Risks: {high}
Medium Risks: {medium}
Low Risks: {low}
Total Findings: {len(risk_results)}

## Risk Findings

{json.dumps(risk_results, indent=2)}

## Instructions

Generate the report using the following structure.

# Contract Risk Review Report

## 1. Executive Summary

Provide a concise overview of the contract, including:

* Overall contract quality
* General legal risk level
* Number of risks identified
* Most significant concerns

Keep this section to approximately 150–250 words.

---

## 2. Overall Risk Assessment

Include:

* Overall Risk Score
* Overall Risk Rating (Low, Medium, High)
* Brief explanation of what this rating means

---

## 3. Risk Findings

For every identified risk, include:

* Clause Name
* Risk Level
* Description of the issue
* Why it is legally important
* Citation (Heading and Page Number)
* Business impact
* Recommendation for improvement

Present each finding clearly and professionally.

---

## 4. Missing Clauses

Identify any important clauses that appear to be missing from the contract, such as:

* Confidentiality
* Governing Law
* Dispute Resolution
* Limitation of Liability
* Force Majeure
* Indemnification
* Termination
* Intellectual Property

For each missing clause, explain:

* Why it is important
* Potential risks caused by its absence
* Recommendation

Only identify missing clauses if supported by the provided information.

---

## 5. Recommended Next Steps

Provide practical recommendations for improving the contract.

Examples include:

* Clarify ambiguous language
* Add missing legal protections
* Revise high-risk clauses
* Improve payment terms
* Add notice periods
* Define liability limits

Prioritize recommendations by urgency.

---

## 6. Conclusion

Summarize:

* Overall contract health
* Whether immediate legal review is recommended
* Key priorities before signing

---

## Important Rules

* Use only the supplied contract analysis.
* Do not invent clauses, citations, legal precedents, or page numbers.
* If a citation is unavailable, write "Citation: Not Available."
* Maintain a formal, objective, and professional legal tone.
* Clearly distinguish between High, Medium, and Low risks.
* Base all conclusions on the provided evidence.
* Format the report using Markdown headings and bullet points for readability.
* Only identify a clause as missing if the supplied analysis explicitly indicates its absence.
* Do not assume a clause is missing simply because it is not listed in the Risk Findings.
* If there is insufficient evidence, write: "No missing clauses could be confirmed from the available analysis."
"""
    try:
        report = call_llm(prompt)
    except Exception as e:
        report = f"""
# Contract Risk Review Report

The report could not be generated.

Reason:
{str(e)}
"""

    styles = getSampleStyleSheet()
    pdf_filename = os.path.join(REPORTS_DIR, f"contract_report_{contract_id}.pdf")
    doc = SimpleDocTemplate(pdf_filename)
    story = []

    for line in report.splitlines():
        line = line.strip()

        if not line:
            continue

        if line.startswith("# "):
            story.append(Paragraph(escape(line[2:]), styles["Heading1"]))
        elif line.startswith("## "):
            story.append(Paragraph(escape(line[3:]), styles["Heading2"]))
        elif line.startswith("### "):
            story.append(Paragraph(escape(line[4:]), styles["Heading3"]))
        else:
            story.append(Paragraph(escape(line), styles["BodyText"]))

    doc.build(story)

    return {
        "report": report,
        "pdf_file": pdf_filename,
        "overall_rating": overall_rating,
        "risk_score": score,
        "max_score": max_score,
    }
