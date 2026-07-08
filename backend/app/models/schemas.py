from datetime import datetime
from sqlalchemy import Column, String, DateTime, Integer, Text, ForeignKey
from app.core.db import Base

class Contract(Base):
    __tablename__ = "contracts"
    id = Column(String, primary_key=True)
    filename = Column(String)
    file_type = Column(String)
    upload_date = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="uploaded")
    page_count = Column(Integer, nullable=True)
class Chunk(Base):
    __tablename__ = "chunks"
    id = Column(String, primary_key=True)
    contract_id = Column(String, ForeignKey("contracts.id"))
    heading = Column(String, nullable=True)
    text = Column(Text)
    page_start = Column(Integer)
    page_end = Column(Integer)
    char_offset = Column(Integer)
    clause_type = Column(String, nullable=True)

class PrecedentCache(Base):
    __tablename__ = "precedent_cache"
    id = Column(String, primary_key=True)
    query = Column(String)
    results_json = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
