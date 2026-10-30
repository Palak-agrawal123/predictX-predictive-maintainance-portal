"""
Configuration management for PredictX RAG Service.
All settings can be overridden using environment variables or a .env file.
"""
import os
from pathlib import Path
from pydantic_settings import BaseSettings

RAG_DIR = Path(__file__).resolve().parent
ROOT_DIR = RAG_DIR.parent

class RAGSettings(BaseSettings):
    # Service Information
    SERVICE_NAME: str = "predictx-rag-service"
    SERVICE_VERSION: str = "1.0.0"
    RAG_SERVICE_PORT: int = int(os.getenv("RAG_SERVICE_PORT", "8001"))
    RAG_SERVICE_HOST: str = os.getenv("RAG_SERVICE_HOST", "127.0.0.1")
    
    # Path configuration
    BASE_DIR: Path = RAG_DIR
    DOCUMENTS_DIR: Path = RAG_DIR / "data" / "documents"
    PROCESSED_DIR: Path = RAG_DIR / "data" / "processed"
    FAILED_DIR: Path = RAG_DIR / "data" / "failed_documents"
    REPORTS_DIR: Path = RAG_DIR / "data" / "ingestion_reports"
    CHROMA_PERSIST_DIRECTORY: Path = RAG_DIR / "vector_store" / "chroma_db"
    
    # Chunking Configuration
    CHUNK_SIZE: int = int(os.getenv("RAG_CHUNK_SIZE", "600"))  # tokens / approx words
    CHUNK_OVERLAP: int = int(os.getenv("RAG_CHUNK_OVERLAP", "80"))
    
    # Embedding Configuration
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
    EMBEDDING_DIMENSION: int = 384
    CHROMA_COLLECTION_NAME: str = os.getenv("CHROMA_COLLECTION_NAME", "predictx_knowledge_base")
    
    # Retrieval Configuration
    TOP_K: int = int(os.getenv("RAG_TOP_K", "5"))
    SIMILARITY_THRESHOLD: float = float(os.getenv("RAG_SIMILARITY_THRESHOLD", "0.38"))
    HYBRID_SEARCH_ENABLED: bool = os.getenv("HYBRID_SEARCH_ENABLED", "true").lower() == "true"
    BM25_WEIGHT: float = float(os.getenv("BM25_WEIGHT", "0.35"))
    VECTOR_WEIGHT: float = float(os.getenv("VECTOR_WEIGHT", "0.65"))
    RERANKER_ENABLED: bool = os.getenv("RERANKER_ENABLED", "true").lower() == "true"
    
    # External Services
    ML_SERVICE_URL: str = os.getenv("ML_SERVICE_URL", "http://127.0.0.1:8000")
    BACKEND_URL: str = os.getenv("BACKEND_URL", "http://127.0.0.1:5000")
    
    # LLM Configuration
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "gemini")  # "gemini", "openai", "local", "fallback"
    LLM_MODEL: str = os.getenv("LLM_MODEL", "gemini-2.5-flash")
    LLM_TEMPERATURE: float = float(os.getenv("LLM_TEMPERATURE", "0.2"))
    LLM_MAX_TOKENS: int = int(os.getenv("LLM_MAX_TOKENS", "1024"))
    
    # API Keys (loaded securely from environment)
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")

    class Config:
        env_file = ".env"
        extra = "allow"

settings = RAGSettings()
