import os
import json
import re
import statistics
from app.core.db import SessionLocal
from app.models.schemas import Contract,Chunk
HEADING_PATTERNS = [
    re.compile(r'^\d+\.\s+[A-Z]'),
    re.compile(r'^\d+\.\d+\s+'),
    re.compile(r'^ARTICLE\s+[IVXLC]+', re.I),
    re.compile(r'^SECTION\s+\d+', re.I),
    re.compile(r'^[A-Z][A-Z\s]{3,50}$'),
]
def is_heading(block: dict, avg_font_size: float) -> bool:
    text = block.get("text", "").strip()
    if not text:
        return False
    if block.get("is_heading"):
        return True
    for pattern in HEADING_PATTERNS:
        if pattern.match(text):
            return True
    if len(text.split()) <= 2:
        return False
    if (
        block.get("font_size", 0) >= avg_font_size * 1.30
        and len(text.split()) <= 8
        and len(text) <= 60
    ):
        return True
    if (
        block.get("bold")
        and len(text.split()) <= 8
        and text == text.upper()
    ):
        return True
    return False
def compute_avg_font_size(blocks):
    font_sizes = [
        b["font_size"]
        for b in blocks
        if "font_size" in b
    ]
    if not font_sizes:
        return 12
    return statistics.median(font_sizes)
def group_into_clauses(blocks, contract_id, avg_font_size):
    clauses = []
    current = {
        "heading": "Preamble",
        "text": "",
        "page_start": None,
        "page_end": None,
    }
    for block in blocks:
        if is_heading(block, avg_font_size):
            if current["text"].strip():
                clauses.append(current)

            current = {
                "heading": block["text"].strip(),
                "text": "",
                "page_start": block.get("page"),
                "page_end": block.get("page"),
            }
        else:
            current["text"] += block["text"] + " "
            if current["page_start"] is None:
                current["page_start"] = block.get("page")
            current["page_end"] = block.get("page", current["page_end"])
    if current["text"].strip():
        clauses.append(current)
    return clauses
def fallback_split(blocks, chunk_size=700, overlap=100):
    text = ""
    page_map = []
    for block in blocks:
        start = len(text)
        text += block["text"] + " "
        end = len(text)
        page_map.append(
            (
                start,
                end,
                block.get("page", 1)
            )
        )
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunk_text = text[start:end]
        page = 1
        for s, e, p in page_map:
            if s <= start <= e:
                page = p
                break
        chunks.append(
            {
                "heading": "Document",
                "text": chunk_text.strip(),
                "page_start": page,
                "page_end": page,
            }
        )
        if end == len(text):
            break
        start = end - overlap
    return chunks
def save_chunks(contract_id, clauses):
    db = SessionLocal()
    try:
        for i, clause in enumerate(clauses):
            print("=" * 80)
            print("HEADING:", clause["heading"])
            print("TEXT:")
            print(clause["text"])
            print("=" * 80)
            chunk = Chunk(
                id=f"{contract_id}_chunk_{i}",
                contract_id=contract_id,
                heading=clause["heading"],
                text=clause["text"].strip(),
                page_start=clause["page_start"],
                page_end=clause["page_end"],
            )
            db.add(chunk)
        db.commit()
    finally:

        db.close()
def chunk_contract(contract_id):

    json_path = f"data/processed/{contract_id}.json"
    if not os.path.exists(json_path):
        raise FileNotFoundError(json_path)
    with open(json_path, encoding="utf-8") as f:
        blocks = json.load(f)
    avg_font_size = compute_avg_font_size(blocks)
    clauses = group_into_clauses(
        blocks,
        contract_id,
        avg_font_size,
    )
    if len(clauses) <= 1:

        print("No headings detected. Using fallback splitter.")
        clauses = fallback_split(blocks)
    save_chunks(contract_id, clauses)
    print(f"Created {len(clauses)} chunks.")
    return clauses