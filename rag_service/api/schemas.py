"""
Pydantic API Schemas for PredictX RAG Service Endpoints.
"""
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class RetrieveRequest(BaseModel):
    query: str = Field(..., description="Maintenance or technical question")
    machine_id: Optional[str] = Field(None, description="Optional target machine ID (e.g. MCH-102, UNIT-03)")
    top_k: Optional[int] = Field(5, ge=1, le=20, description="Number of chunks to retrieve")
    filter_metadata: Optional[Dict[str, Any]] = Field(None, description="Optional metadata filter dictionary")

class RetrievedChunkResponse(BaseModel):
    chunk_id: str
    text: str
    document_name: str
    document_id: str
    page_number: int
    section_name: str
    category: str
    machine_type: str
    component: str
    relevance_score: float

class RetrieveResponse(BaseModel):
    success: bool = True
    query: str
    has_sufficient_context: bool
    max_relevance_score: float
    retrieval_latency_ms: float
    chunks_count: int
    chunks: List[RetrievedChunkResponse]

class ChatRequest(BaseModel):
    question: str = Field(..., description="User question or maintenance query")
    machine_id: Optional[str] = Field(None, description="Optional machine ID for live telemetry binding")
    sensors: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Live or simulated sensor telemetry")
    conversation_id: Optional[str] = Field(None, description="Optional conversation tracking ID")
    top_k: Optional[int] = Field(4, ge=1, le=10)

class CitationItem(BaseModel):
    citation_id: str
    document_name: str
    page_number: int
    section_name: str
    chunk_id: str
    relevance_score: float
    excerpt: str

class ChatResponse(BaseModel):
    success: bool = True
    answer: str
    citations: List[CitationItem]
    has_sufficient_context: bool
    max_relevance_score: float
    retrieved_chunks_count: int
    retrieval_latency_ms: float
    machine_context_used: bool
    prediction_context_used: bool
    machine_id: Optional[str] = None
    telemetry_summary: Optional[Dict[str, Any]] = None
    prediction_summary: Optional[Dict[str, Any]] = None

class IngestResponse(BaseModel):
    success: bool = True
    report: Dict[str, Any]

class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    embedding_model: str
    vector_store: Dict[str, Any]
    llm_provider: str
    llm_model: str
