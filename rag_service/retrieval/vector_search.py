"""
Vector Search Module for PredictX Retrieval Pipeline.
Performs semantic dense vector search against ChromaDB using SentenceTransformers.
"""
from typing import List, Dict, Any, Optional
from embeddings.embedding import embedding_engine
from vector_store.vector_store import vector_store

class VectorSearch:
    def __init__(self):
        self.embedding_engine = embedding_engine
        self.vector_store = vector_store

    def search(
        self,
        query: str,
        top_k: int = 5,
        filter_metadata: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Generates query embedding and performs similarity search in ChromaDB.
        """
        query_embedding = self.embedding_engine.embed_query(query)
        matches = self.vector_store.similarity_search(
            query_embedding=query_embedding,
            top_k=top_k,
            filter_metadata=filter_metadata
        )
        return matches

# Global singleton
vector_search = VectorSearch()
