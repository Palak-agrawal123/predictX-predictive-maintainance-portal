"""
Embedding Generation Engine for PredictX RAG Pipeline.
Provides cached SentenceTransformer embeddings with batch inference,
query vector generation, and dimension verification.
"""
import os
from typing import List, Union
import numpy as np

# Prevent sentence_transformers from blocking on online lookups when cached
os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")

from sentence_transformers import SentenceTransformer

from config import settings

class EmbeddingEngine:
    _instance = None
    _model = None

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super(EmbeddingEngine, cls).__new__(cls)
        return cls._instance

    def __init__(self, model_name: str = None):
        self.model_name = model_name or settings.EMBEDDING_MODEL
        if EmbeddingEngine._model is None:
            self._load_model()

    def _load_model(self):
        print(f"[EmbeddingEngine] Initializing embedding model: '{self.model_name}'...")
        try:
            EmbeddingEngine._model = SentenceTransformer(self.model_name, local_files_only=True)
            # Warm up model with sample inference
            test_emb = EmbeddingEngine._model.encode(["PredictX Predictive Maintenance"])
            self.dimension = len(test_emb[0])
            print(f"[EmbeddingEngine] Model loaded successfully. Dimension: {self.dimension}")
        except Exception as e:
            # Fallback without local_files_only if first load
            try:
                EmbeddingEngine._model = SentenceTransformer(self.model_name)
                test_emb = EmbeddingEngine._model.encode(["PredictX Predictive Maintenance"])
                self.dimension = len(test_emb[0])
                print(f"[EmbeddingEngine] Model loaded successfully. Dimension: {self.dimension}")
            except Exception as e2:
                print(f"[EmbeddingEngine Error] Failed to load '{self.model_name}': {e2}")
                raise e2

    @property
    def model(self) -> SentenceTransformer:
        if EmbeddingEngine._model is None:
            self._load_model()
        return EmbeddingEngine._model

    def embed_texts(self, texts: List[str], batch_size: int = 32) -> List[List[float]]:
        """
        Generates normalized embedding vectors for a list of document chunk texts.
        """
        if not texts:
            return []

        embeddings = self.model.encode(
            texts,
            batch_size=batch_size,
            show_progress_bar=False,
            normalize_embeddings=True
        )
        return embeddings.tolist()

    def embed_query(self, query: str) -> List[float]:
        """
        Generates a normalized embedding vector for a single search query.
        """
        if not query or not query.strip():
            # Return zero vector if empty query
            return [0.0] * settings.EMBEDDING_DIMENSION

        embedding = self.model.encode(
            [query.strip()],
            show_progress_bar=False,
            normalize_embeddings=True
        )[0]
        return embedding.tolist()

# Global singleton
embedding_engine = EmbeddingEngine()
