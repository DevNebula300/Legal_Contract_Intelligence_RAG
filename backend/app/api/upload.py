import uuid
import os
from fastapi import APIRouter, UploadFile, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse
from app.core.db import SessionLocal
from app.models.schemas import Contract
from app.api.parsing import parse_contract
from app.api.chunking import chunk_contract
from app.core.store_vector import embed_and_store_chunks
from app.core.clause_classifier import classify_chunks

router = APIRouter()

def process_contract_background(contract_id: str, file_path: str, ext: str):
    def update_status(status: str):
        db = SessionLocal()
        try:
            contract = db.query(Contract).filter(Contract.id == contract_id).first()
            if contract:
                contract.status = status
                db.commit()
        finally:
            db.close()
            
    try:
        update_status("parsing")
        parse_contract(contract_id, file_path, ext)
        
        update_status("chunking")
        chunk_contract(contract_id)
        
        update_status("classifying")
        classify_chunks(contract_id)
        
        update_status("embedding")
        embed_and_store_chunks(contract_id)
        
        update_status("completed")
    except Exception as e:
        print(f"Error processing contract {contract_id}: {e}")
        update_status(f"error: {str(e)}")


@router.post("/upload")
async def upload_contract(file: UploadFile, background_tasks: BackgroundTasks):
    contract_id = str(uuid.uuid4())
    filename = file.filename
    ext = filename.split(".")[-1].lower()

    os.makedirs("data/raw", exist_ok=True)
    file_path = f"data/raw/{contract_id}.{ext}"

    with open(file_path, "wb") as f:
        f.write(await file.read())

    db = SessionLocal()
    try:
        new_contract = Contract(
            id=contract_id,
            filename=filename,
            file_type=ext,
            status="uploaded"
        )
        db.add(new_contract)
        db.commit()
    finally:
        db.close()

    background_tasks.add_task(process_contract_background, contract_id, file_path, ext)

    return {
        "contract_id": contract_id,
        "status": "processing_started"
    }

@router.get("/contracts/{contract_id}/status")
def get_contract_status(contract_id: str):
    db = SessionLocal()
    try:
        contract = db.query(Contract).filter(Contract.id == contract_id).first()
        if not contract:
            raise HTTPException(status_code=404, detail="Contract not found")
        return {"contract_id": contract_id, "status": contract.status}
    finally:
        db.close()

@router.get("/contracts/{contract_id}/file")
def get_contract_file(contract_id: str):
    db = SessionLocal()
    try:
        contract = db.query(Contract).filter(Contract.id == contract_id).first()
        if not contract:
            raise HTTPException(status_code=404, detail="Contract not found")
        
        file_path = f"data/raw/{contract.id}.{contract.file_type}"
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found on disk")
            
        return FileResponse(
            file_path, 
            media_type="application/pdf",
            headers={"Content-Disposition": f'inline; filename="{contract.filename}"'}
        )
    finally:
        db.close()
