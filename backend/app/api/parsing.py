import os
import json
import fitz
import docx
from app.core.db import SessionLocal
from app.models.schemas import Contract
def parse_pdf(path: str) -> list[dict]:
    doc = fitz.open(path)
    blocks = []
    for page_num, page in enumerate(doc):
        for block in page.get_text("dict")["blocks"]:
            if "lines" not in block:
                continue
            for line in block["lines"]:
                for span in line["spans"]:
                    blocks.append({
                        "text": span["text"],
                        "font_size": span["size"],
                        "bold": bool(span["flags"] & 2**4),
                        "page": page_num + 1,
                        "bbox": span["bbox"],
                    })
    return blocks
def parse_docx(path: str) -> list[dict]:
    doc = docx.Document(path)
    blocks = []
    for para in doc.paragraphs:
        if not para.text.strip():
            continue
        blocks.append({
            "text": para.text,
            "style": para.style.name,
            "is_heading": para.style.name.startswith("Heading"),
        })
    return blocks
def parse_txt_md(path: str) -> list[dict]:
    lines = open(path, encoding="utf-8").read().split("\n")
    return [{"text": l, "is_heading": l.strip().startswith("#")} for l in lines if l.strip()]
def save_raw_blocks(contract_id: str, blocks: list[dict]):
    os.makedirs("data/processed", exist_ok=True)
    with open(f"data/processed/{contract_id}.json", "w", encoding="utf-8") as f:
        json.dump(blocks, f, indent=2)
def update_contract_status(contract_id: str, status: str):
    db = SessionLocal()
    try:
        contract = db.query(Contract).filter(Contract.id == contract_id).first()
        if contract:
            contract.status = status
            db.commit()
    finally:
        db.close()
def parse_contract(contract_id, path, ext):
    if ext == "pdf":
        blocks = parse_pdf(path)
    elif ext == "docx":
        blocks = parse_docx(path)
    else:
        blocks = parse_txt_md(path)
    save_raw_blocks(contract_id, blocks)
    update_contract_status(contract_id, "parsed")