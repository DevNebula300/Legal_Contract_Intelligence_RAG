import uuid
import os
from fastapi import APIRouter, UploadFile
from app.core.db import SessionLocal
from app.models.schemas import Contract
from app.api.parsing import parse_contract
from app.api.chunking import chunk_contract
from app.core.store_vector import embed_and_store_chunks

router = APIRouter()

@router.post("/upload")
async def upload_contract(file: UploadFile):
    contract_id = str(uuid.uuid4())
    filename = file.filename
    ext = filename.split(".")[-1].lower()

    os.makedirs("data/raw", exist_ok=True)
    file_path = f"data/raw/{contract_id}.{ext}"

    with open(file_path, "wb") as f:
        f.write(await file.read())

    db = SessionLocal()
    new_contract = Contract(
        id=contract_id,
        filename=filename,
        file_type=ext,
        status="uploaded"
    )
    db.add(new_contract)
    db.commit()
    db.close()

    parse_contract(contract_id, file_path, ext)
    chunk_contract(contract_id)
    embed_and_store_chunks(contract_id)

    return {
        "contract_id": contract_id,
        "status": "embedded"
    }