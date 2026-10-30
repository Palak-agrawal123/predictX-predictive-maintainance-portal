"""
Master Hybrid Retrieval Pipeline for PredictX RAG Service.
Combines dense semantic vector search, BM25 keyword retrieval,
industrial reranking, relevance gating, and detailed diagnostic logging.
"""
import time
from typing import List, Dict, Any, Optional
from rank_bm25 import BM25Okapi

from config import settings
from retrieval.query_processor import query_processor, ProcessedQuery
from retrieval.vector_search import vector_search
from retrieval.metadata_filter import metadata_filter_builder
from retrieval.reranker import reranker
from vector_store.vector_store import vector_store

class RetrievalPipeline:
    def __init__(self):
        self.bm25_index = None
        self.bm25_chunk_map = []
        self._build_bm25_index()

    def _build_bm25_index(self):
        """
        Builds in-memory BM25 index from current ChromaDB collection chunks.
        """
        all_records = vector_store.collection.get(include=["documents", "metadatas"])
        if all_records and all_records["documents"]:
            tokenized_corpus = [doc.lower().split() for doc in all_records["documents"]]
            self.bm25_index = BM25Okapi(tokenized_corpus)
            self.bm25_chunk_map = []
            for cid, doc, meta in zip(all_records["ids"], all_records["documents"], all_records["metadatas"]):
                self.bm25_chunk_map.append({
                    "chunk_id": cid,
                    "text": doc,
                    "metadata": meta
                })
            print(f"[RetrievalPipeline] Built BM25 index across {len(self.bm25_chunk_map)} documents.")
        else:
            self.bm25_index = None
            self.bm25_chunk_map = []

    def retrieve(
        self,
        query: str,
        machine_id: Optional[str] = None,
        top_k: int = None,
        filter_metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        start_time = time.time()
        k = top_k or settings.TOP_K

        # 1. Process and normalize query
        processed_query: ProcessedQuery = query_processor.process_query(query, machine_id)
        
        # 2. Perform dense vector search
        candidate_k = max(k * 3, 10)
        vector_results = vector_search.search(
            query=processed_query.normalized_query,
            top_k=candidate_k,
            filter_metadata=filter_metadata
        )

        # 3. Perform BM25 search if enabled
        bm25_results = []
        if settings.HYBRID_SEARCH_ENABLED and self.bm25_index:
            q_tokens = processed_query.normalized_query.lower().split()
            bm25_scores = self.bm25_index.get_scores(q_tokens)
            
            # Normalize BM25 scores to [0, 1]
            max_bm25 = max(bm25_scores) if len(bm25_scores) > 0 and max(bm25_scores) > 0 else 1.0
            for idx, score in enumerate(bm25_scores):
                if score > 0:
                    norm_score = round(float(score / max_bm25), 4)
                    item = dict(self.bm25_chunk_map[idx])
                    item["bm25_score"] = norm_score
                    bm25_results.append(item)
            
            bm25_results.sort(key=lambda x: x["bm25_score"], reverse=True)
            bm25_results = bm25_results[:candidate_k]

        # 4. Fuse Dense + Sparse (Hybrid Merge)
        merged_candidates = {}
        for r in vector_results:
            cid = r["chunk_id"]
            merged_candidates[cid] = {
                "chunk_id": cid,
                "text": r["text"],
                "metadata": r["metadata"],
                "vector_score": r["similarity"],
                "bm25_score": 0.0,
                "similarity": r["similarity"]
            }

        for r in bm25_results:
            cid = r["chunk_id"]
            if cid in merged_candidates:
                merged_candidates[cid]["bm25_score"] = r["bm25_score"]
                # Weighted score fusion
                merged_candidates[cid]["similarity"] = round(
                    settings.VECTOR_WEIGHT * merged_candidates[cid]["vector_score"] +
                    settings.BM25_WEIGHT * r["bm25_score"],
                    4
                )
            else:
                merged_candidates[cid] = {
                    "chunk_id": cid,
                    "text": r["text"],
                    "metadata": r["metadata"],
                    "vector_score": 0.0,
                    "bm25_score": r["bm25_score"],
                    "similarity": round(settings.BM25_WEIGHT * r["bm25_score"], 4)
                }

        candidate_list = list(merged_candidates.values())

        # 5. Reranking
        if settings.RERANKER_ENABLED:
            ranked_chunks = reranker.rerank(processed_query, candidate_list, top_k=k)
        else:
            candidate_list.sort(key=lambda x: x["similarity"], reverse=True)
            ranked_chunks = candidate_list[:k]

        # 6. Relevance Threshold Gating
        max_score = ranked_chunks[0]["rerank_score"] if ranked_chunks and "rerank_score" in ranked_chunks[0] else (
            ranked_chunks[0]["similarity"] if ranked_chunks else 0.0
        )
        has_sufficient_context = max_score >= settings.SIMILARITY_THRESHOLD

        duration_ms = round((time.time() - start_time) * 1000, 2)

        # 7. Format clean output
        formatted_chunks = []
        for ch in ranked_chunks:
            formatted_chunks.append({
                "chunk_id": ch["chunk_id"],
                "text": ch["text"],
                "document_name": ch["metadata"].get("document_name", "Unknown Document"),
                "document_id": ch["metadata"].get("document_id", "DOC-UNKNOWN"),
                "page_number": ch["metadata"].get("page_number", 1),
                "section_name": ch["metadata"].get("section_name", ""),
                "category": ch["metadata"].get("category", "general"),
                "machine_type": ch["metadata"].get("machine_type", "GENERAL_INDUSTRIAL"),
                "component": ch["metadata"].get("component", "GENERAL"),
                "relevance_score": ch.get("rerank_score", ch.get("similarity", 0.0)),
                "metadata": ch["metadata"]
            })

        print(f"[RetrievalPipeline] Query: '{query}' -> Retrieved {len(formatted_chunks)} chunks in {duration_ms}ms (Max score: {max_score})")

        return {
            "query": query,
            "processed_query": processed_query.to_dict(),
            "has_sufficient_context": has_sufficient_context,
            "max_relevance_score": max_score,
            "retrieval_latency_ms": duration_ms,
            "chunks_count": len(formatted_chunks),
            "chunks": formatted_chunks
        }

# Global singleton
retrieval_pipeline = RetrievalPipeline()
