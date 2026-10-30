"""
ChromaDB Persistent Vector Store for PredictX RAG Pipeline.
Manages collection lifecycle, chunk upserts, metadata filtering, and similarity search.
"""
from pathlib import Path
from typing import List, Dict, Any, Optional
import chromadb
from chromadb.config import Settings as ChromaSettings

from config import settings
from chunking.chunking import TextChunk

class VectorStore:
    def __init__(
        self,
        persist_dir: Path = None,
        collection_name: str = None
    ):
        self.persist_dir = Path(persist_dir or settings.CHROMA_PERSIST_DIRECTORY)
        self.persist_dir.mkdir(parents=True, exist_ok=True)
        self.collection_name = collection_name or settings.CHROMA_COLLECTION_NAME
        
        # Initialize persistent client
        self.client = chromadb.PersistentClient(
            path=str(self.persist_dir),
            settings=ChromaSettings(anonymized_telemetry=False)
        )
        self._get_or_create_collection()

    def _get_or_create_collection(self):
        # We use cosine similarity space
        self.collection = self.client.get_or_create_collection(
            name=self.collection_name,
            metadata={"hnsw:space": "cosine", "description": "PredictX Technical Knowledge Base"}
        )
        print(f"[VectorStore] Connected to ChromaDB collection '{self.collection_name}' ({self.collection.count()} chunks indexed)")

    def add_chunks(self, chunks: List[TextChunk], embeddings: List[List[float]]) -> int:
        """
        Upserts chunks with embeddings and metadata into ChromaDB.
        """
        if not chunks:
            return 0

        ids = [c.chunk_id for c in chunks]
        documents = [c.chunk_text for c in chunks]
        metadatas = []
        for c in chunks:
            # Flatten metadata ensuring values are primitive types (str, int, float, bool)
            meta = {
                "chunk_id": str(c.chunk_id),
                "document_id": str(c.document_id),
                "document_name": str(c.document_name),
                "page_number": int(c.page_number),
                "section_name": str(c.section_name or ""),
                "machine_type": str(c.machine_type or "GENERAL_INDUSTRIAL"),
                "component": str(c.component or "GENERAL"),
                "category": str(c.category or "general"),
                "chunk_index": int(c.chunk_index)
            }
            metadatas.append(meta)

        self.collection.upsert(
            ids=ids,
            embeddings=embeddings,
            documents=documents,
            metadatas=metadatas
        )
        return len(ids)

    def similarity_search(
        self,
        query_embedding: List[float],
        top_k: int = 5,
        filter_metadata: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Executes similarity search in ChromaDB.
        Returns list of matched chunks with cosine distance converted to similarity score.
        """
        query_params = {
            "query_embeddings": [query_embedding],
            "n_results": top_k,
            "include": ["documents", "metadatas", "distances"]
        }

        if filter_metadata:
            # Format ChromaDB where filter
            conditions = []
            for k, v in filter_metadata.items():
                if v:
                    conditions.append({k: {"$eq": v}})
            
            if len(conditions) == 1:
                query_params["where"] = conditions[0]
            elif len(conditions) > 1:
                query_params["where"] = {"$and": conditions}

        results = self.collection.query(**query_params)
        
        formatted = []
        if results and results["ids"] and len(results["ids"][0]) > 0:
            ids = results["ids"][0]
            docs = results["documents"][0]
            metas = results["metadatas"][0]
            dists = results["distances"][0]

            for cid, doc, meta, dist in zip(ids, docs, metas, dists):
                # Cosine distance to similarity: similarity = 1.0 - (dist / 2.0) or (1.0 - dist)
                similarity = round(max(0.0, min(1.0, 1.0 - dist)), 4)
                formatted.append({
                    "chunk_id": cid,
                    "text": doc,
                    "metadata": meta,
                    "similarity": similarity,
                    "distance": round(dist, 4)
                })

        return formatted

    def get_document_chunks(self, document_id: str) -> List[Dict[str, Any]]:
        results = self.collection.get(
            where={"document_id": {"$eq": document_id}},
            include=["documents", "metadatas"]
        )
        items = []
        if results and results["ids"]:
            for cid, doc, meta in zip(results["ids"], results["documents"], results["metadatas"]):
                items.append({"chunk_id": cid, "text": doc, "metadata": meta})
        return items

    def delete_document(self, document_id: str) -> int:
        existing = self.collection.get(where={"document_id": {"$eq": document_id}})
        if existing and existing["ids"]:
            self.collection.delete(ids=existing["ids"])
            return len(existing["ids"])
        return 0

    def list_indexed_documents(self) -> List[Dict[str, Any]]:
        all_records = self.collection.get(include=["metadatas"])
        docs_summary = {}
        
        if all_records and all_records["metadatas"]:
            for meta in all_records["metadatas"]:
                doc_id = meta.get("document_id")
                if doc_id not in docs_summary:
                    docs_summary[doc_id] = {
                        "document_id": doc_id,
                        "document_name": meta.get("document_name"),
                        "category": meta.get("category"),
                        "machine_type": meta.get("machine_type"),
                        "chunks_count": 0,
                        "pages": set()
                    }
                docs_summary[doc_id]["chunks_count"] += 1
                docs_summary[doc_id]["pages"].add(meta.get("page_number"))

        result = []
        for d in docs_summary.values():
            result.append({
                "document_id": d["document_id"],
                "document_name": d["document_name"],
                "category": d["category"],
                "machine_type": d["machine_type"],
                "chunks_count": d["chunks_count"],
                "total_pages": len(d["pages"])
            })
        return result

    def get_collection_count(self) -> int:
        return self.collection.count()

    def reset_collection(self):
        """
        Clears the collection for complete re-indexing.
        """
        self.client.delete_collection(self.collection_name)
        self._get_or_create_collection()
        print(f"[VectorStore] Collection '{self.collection_name}' reset successfully.")

# Global singleton
vector_store = VectorStore()
