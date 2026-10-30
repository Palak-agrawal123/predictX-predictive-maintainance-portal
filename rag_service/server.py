"""
PredictX RAG FastAPI Microservice Server
Serves document ingestion, hybrid semantic retrieval, LLM grounded answer generation,
and live predictive maintenance model integration.
"""
import sys
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Ensure rag_service directory is in sys.path
CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

from config import settings
from api.routes import router as api_router

app = FastAPI(
    title="PredictX RAG Maintenance Microservice",
    description="Production Retrieval-Augmented Generation (RAG) Service for Industrial Predictive Maintenance",
    version=settings.SERVICE_VERSION,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routes
app.include_router(api_router, prefix="/api/rag", tags=["RAG Endpoints"])
app.include_router(api_router, tags=["Root Endpoints"])  # also mount at root for direct /health, /chat, etc.

@app.get("/")
def get_service_root():
    return {
        "service": settings.SERVICE_NAME,
        "version": settings.SERVICE_VERSION,
        "status": "online",
        "description": "PredictX Industrial RAG Microservice",
        "endpoints": {
            "health": "/health",
            "chat": "/chat",
            "retrieve": "/retrieve",
            "ingest": "/ingest",
            "documents": "/documents",
            "docs": "/docs"
        }
    }

if __name__ == "__main__":
    print(f"\n========================================================")
    print(f"[PredictX RAG Service] Starting on http://{settings.RAG_SERVICE_HOST}:{settings.RAG_SERVICE_PORT}...")
    print(f"[PredictX RAG Service] OpenAPI Docs at: http://{settings.RAG_SERVICE_HOST}:{settings.RAG_SERVICE_PORT}/docs")
    print(f"========================================================\n")
    uvicorn.run(
        "server:app",
        host=settings.RAG_SERVICE_HOST,
        port=settings.RAG_SERVICE_PORT,
        reload=False,
        log_level="info"
    )
