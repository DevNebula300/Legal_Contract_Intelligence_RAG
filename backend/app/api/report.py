import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from app.core.report_agent import create_report
from app.models.schemas import Contract
from app.core.db import SessionLocal

router = APIRouter()

@router.get("/report/download/{contract_id}")
def download_report(contract_id: str):
    db = SessionLocal()
    try:
        contract = db.query(Contract).filter(Contract.id == contract_id).first()
        if not contract:
            raise HTTPException(status_code=404, detail="Contract not found")
        
        # This function generates the report on disk and returns its filename
        report_data = create_report(contract_id)
        pdf_filename = report_data.get("pdf_file")
        
        if not pdf_filename or not os.path.exists(pdf_filename):
            raise HTTPException(status_code=500, detail="Failed to generate report PDF")
            
        return FileResponse(
            pdf_filename, 
            filename=f"{contract.filename}_Risk_Report.pdf",
            media_type="application/pdf"
        )
    finally:
        db.close()
