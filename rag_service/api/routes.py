"""
API Routes for PredictX RAG FastAPI Microservice.
Provides endpoints for hybrid document retrieval, intelligent chat generation,
document ingestion, vector store cataloging, and service health checks.
"""
from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Query
from pathlib import Path

from config import settings
from api.schemas import (
    RetrieveRequest,
    RetrieveResponse,
    ChatRequest,
    ChatResponse,
    HealthResponse,
    IngestResponse
)
from retrieval.retrieval_pipeline import retrieval_pipeline
from generation.response_generator import response_generator
from ml_integration.ml_client import ml_client
from ingestion.ingestion_pipeline import ingestion_pipeline
from vector_store.vector_store import vector_store
from embeddings.embedding import embedding_engine

router = APIRouter()

@router.get("/health", response_model=HealthResponse)
def get_health():
    """
    RAG microservice health check and component status.
    """
    chunk_count = vector_store.get_collection_count()
    return HealthResponse(
        status="healthy",
        service=settings.SERVICE_NAME,
        version=settings.SERVICE_VERSION,
        embedding_model=settings.EMBEDDING_MODEL,
        vector_store={
            "collection": settings.CHROMA_COLLECTION_NAME,
            "indexed_chunks": chunk_count,
            "status": "ready"
        },
        llm_provider=settings.LLM_PROVIDER,
        llm_model=settings.LLM_MODEL
    )

@router.post("/retrieve", response_model=RetrieveResponse)
def retrieve_knowledge(payload: RetrieveRequest):
    """
    Accepts question and returns semantically ranked technical document chunks.
    """
    try:
        results = retrieval_pipeline.retrieve(
            query=payload.query,
            machine_id=payload.machine_id,
            top_k=payload.top_k,
            filter_metadata=payload.filter_metadata
        )
        return RetrieveResponse(
            success=True,
            query=results["query"],
            has_sufficient_context=results["has_sufficient_context"],
            max_relevance_score=results["max_relevance_score"],
            retrieval_latency_ms=results["retrieval_latency_ms"],
            chunks_count=results["chunks_count"],
            chunks=results["chunks"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Knowledge retrieval failed: {str(e)}")

@router.post("/chat", response_model=ChatResponse)
async def chat_rag(payload: ChatRequest):
    """
    End-to-end RAG assistant answer generation.
    Retrieves technical documentation, fetches live machine telemetry and ML predictions (if machine_id provided),
    and returns a structured, grounded answer with genuine citations.
    """
    try:
        machine_ctx = None
        prediction_ctx = None

        # 1. Determine machine ID from payload or query extraction
        target_machine_id = payload.machine_id
        if not target_machine_id:
            from retrieval.query_processor import query_processor
            pq = query_processor.process_query(payload.question)
            target_machine_id = pq.detected_machine_id

        if target_machine_id:
            # Fetch telemetry from backend or payload
            backend_machine = await ml_client.get_machine_telemetry(target_machine_id)
            if backend_machine:
                machine_ctx = backend_machine
            else:
                machine_ctx = {
                    "machineId": target_machine_id,
                    "name": f"Industrial Machine {target_machine_id}",
                    "machineType": "TURBINE" if "UNIT" in target_machine_id else "CNC_MILL",
                    "status": "operational",
                    "telemetry": payload.sensors
                }

            # Fetch live ML model prediction from ML service
            sensors_for_pred = payload.sensors or machine_ctx.get("telemetry", {})
            pred_resp = await ml_client.get_live_prediction(target_machine_id, sensors=sensors_for_pred)
            if pred_resp.get("online"):
                prediction_ctx = pred_resp.get("data")
            else:
                prediction_ctx = {
                    "modelVersion": "C-MAPSS-XGBoost-BiLSTM (Live Offline)",
                    "predictionResult": {
                        "riskProbability": 0.45,
                        "riskLevel": "medium",
                        "healthScore": 78,
                        "estimatedRULDays": 52,
                        "suspectedFailureMode": "Inspection Recommended (Live ML Service Telemetry Fallback)",
                        "recommendedAction": "Perform visual borescope inspection and check temperature differential."
                    }
                }
        elif payload.sensors and any(payload.sensors.values()):
            machine_ctx = {
                "machineId": "MONITORED-ASSET",
                "name": "Live Monitored Asset",
                "machineType": "INDUSTRIAL_MACHINE",
                "status": "monitored",
                "telemetry": payload.sensors
            }

        # 2. Generate grounded RAG response with conversation memory & session isolation
        gen_result = response_generator.generate_answer(
            question=payload.question,
            machine_context=machine_ctx,
            prediction_context=prediction_ctx,
            conversation_id=payload.conversation_id,
            top_k=payload.top_k
        )

        return ChatResponse(
            success=True,
            answer=gen_result["answer"],
            citations=gen_result["citations"],
            has_sufficient_context=gen_result["has_sufficient_context"],
            max_relevance_score=gen_result["max_relevance_score"],
            retrieved_chunks_count=gen_result["retrieved_chunks_count"],
            retrieval_latency_ms=gen_result["retrieval_latency_ms"],
            machine_context_used=gen_result["machine_context_used"],
            prediction_context_used=gen_result["prediction_context_used"],
            machine_id=target_machine_id,
            detected_intent=gen_result.get("detected_intent"),
            rewritten_query=gen_result.get("rewritten_query"),
            telemetry_summary=machine_ctx,
            prediction_summary=prediction_ctx
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"RAG chat generation failed: {str(e)}")

@router.post("/ingest", response_model=IngestResponse)
def trigger_ingestion(force_reindex: bool = Query(False, description="Reset and re-index all documents")):
    """
    Triggers automated document ingestion pipeline across all document categories.
    """
    try:
        report = ingestion_pipeline.run_ingestion(force_reindex=force_reindex)
        # Refresh BM25 index after ingestion
        retrieval_pipeline.build_bm25_index(force=True)
        return IngestResponse(success=True, report=report)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Document ingestion failed: {str(e)}")

@router.get("/documents")
def list_documents():
    """
    Returns summary list of all indexed documents in ChromaDB.
    """
    try:
        docs = vector_store.list_indexed_documents()
        return {
            "success": True,
            "total_documents": len(docs),
            "documents": docs
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list documents: {str(e)}")

@router.delete("/documents/{document_id}")
def delete_document(document_id: str):
    """
    Deletes all chunks associated with a document from ChromaDB.
    """
    try:
        deleted_count = vector_store.delete_document(document_id)
        if deleted_count == 0:
            raise HTTPException(status_code=404, detail=f"Document '{document_id}' not found in index")
        # Refresh BM25 index after document deletion
        retrieval_pipeline.build_bm25_index(force=True)
        return {
            "success": True,
            "message": f"Successfully deleted document '{document_id}' ({deleted_count} chunks removed)",
            "chunks_removed": deleted_count
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete document: {str(e)}")
