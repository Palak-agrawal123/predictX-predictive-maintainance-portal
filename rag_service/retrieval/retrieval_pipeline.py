"""
Master Hybrid Retrieval Pipeline for PredictX RAG Service.
Combines dense semantic vector search, BM25 keyword retrieval,
Reciprocal Rank Fusion (RRF), Maximal Marginal Relevance (MMR),
intent-aware reranking, and confidence gating.
"""
import time
from typing import List, Dict, Any, Optional
from rank_bm25 import BM25Okapi

from config import settings
from retrieval.query_processor import query_processor, ProcessedQuery, QueryIntent
from retrieval.vector_search import vector_search
from retrieval.metadata_filter import metadata_filter_builder
from retrieval.reranker import reranker
from vector_store.vector_store import vector_store

class RetrievalPipeline:
    def __init__(self):
        self.bm25_index = None
        self.bm25_chunk_map = []
        self._last_indexed_count = 0
        self.build_bm25_index()

    def build_bm25_index(self, force: bool = False):
        """
        Builds or refreshes in-memory BM25 index from current ChromaDB collection chunks.
        """
        try:
            curr_count = vector_store.get_collection_count()
            if not force and self.bm25_index is not None and curr_count == self._last_indexed_count:
                return

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
                self._last_indexed_count = len(self.bm25_chunk_map)
                print(f"[RetrievalPipeline] Refreshed BM25 index across {self._last_indexed_count} chunks.")
            else:
                self.bm25_index = None
                self.bm25_chunk_map = []
                self._last_indexed_count = 0
        except Exception as e:
            print(f"[RetrievalPipeline Warning] BM25 indexing error: {e}")

    def retrieve(
        self,
        query: str,
        machine_id: Optional[str] = None,
        top_k: int = None,
        filter_metadata: Optional[Dict[str, Any]] = None,
        is_followup: bool = False
    ) -> Dict[str, Any]:
        start_time = time.time()
        k = top_k or settings.TOP_K

        # 1. Process and normalize query
        processed_query: ProcessedQuery = query_processor.process_query(
            query=query,
            machine_id_context=machine_id,
            is_followup=is_followup
        )
        
        # 2. Ensure BM25 index is synchronized with vector collection
        if vector_store.get_collection_count() != self._last_indexed_count:
            self.build_bm25_index()

        # 3. Dense Vector Search
        candidate_k = max(k * 4, 14)
        vector_results = vector_search.search(
            query=processed_query.normalized_query,
            top_k=candidate_k,
            filter_metadata=filter_metadata
        )

        # 4. Sparse BM25 Keyword Search
        bm25_results = []
        if settings.HYBRID_SEARCH_ENABLED and self.bm25_index:
            q_tokens = processed_query.normalized_query.lower().split()
            bm25_scores = self.bm25_index.get_scores(q_tokens)
            
            # Extract non-zero matches
            scored_bm25 = []
            for idx, score in enumerate(bm25_scores):
                if score > 0.05:
                    scored_bm25.append((idx, score))
            
            scored_bm25.sort(key=lambda x: x[1], reverse=True)
            max_bm25 = scored_bm25[0][1] if scored_bm25 else 1.0

            for rank, (idx, raw_score) in enumerate(scored_bm25[:candidate_k], start=1):
                item = dict(self.bm25_chunk_map[idx])
                item["bm25_score"] = round(float(raw_score / max_bm25), 4)
                item["bm25_rank"] = rank
                bm25_results.append(item)

        # 5. Reciprocal Rank Fusion (RRF)
        # RRF Score = 1 / (60 + rank_dense) + 1 / (60 + rank_bm25)
        rrf_k = 60.0
        candidate_map: Dict[str, Dict[str, Any]] = {}

        # Rank dense results
        for rank, r in enumerate(vector_results, start=1):
            cid = r["chunk_id"]
            dense_rrf = 1.0 / (rrf_k + rank)
            candidate_map[cid] = {
                "chunk_id": cid,
                "text": r["text"],
                "metadata": r["metadata"],
                "vector_score": r["similarity"],
                "bm25_score": 0.0,
                "dense_rank": rank,
                "bm25_rank": candidate_k + 1,
                "rrf_score": settings.VECTOR_WEIGHT * dense_rrf,
                "similarity": r["similarity"]
            }

        # Rank sparse BM25 results
        for r in bm25_results:
            cid = r["chunk_id"]
            sparse_rrf = 1.0 / (rrf_k + r["bm25_rank"])
            if cid in candidate_map:
                candidate_map[cid]["bm25_score"] = r["bm25_score"]
                candidate_map[cid]["bm25_rank"] = r["bm25_rank"]
                candidate_map[cid]["rrf_score"] += settings.BM25_WEIGHT * sparse_rrf
                # Combined normalized similarity
                candidate_map[cid]["similarity"] = round(
                    settings.VECTOR_WEIGHT * candidate_map[cid]["vector_score"] +
                    settings.BM25_WEIGHT * r["bm25_score"],
                    4
                )
            else:
                candidate_map[cid] = {
                    "chunk_id": cid,
                    "text": r["text"],
                    "metadata": r["metadata"],
                    "vector_score": 0.0,
                    "bm25_score": r["bm25_score"],
                    "dense_rank": candidate_k + 1,
                    "bm25_rank": r["bm25_rank"],
                    "rrf_score": settings.BM25_WEIGHT * sparse_rrf,
                    "similarity": round(settings.BM25_WEIGHT * r["bm25_score"], 4)
                }

        candidate_list = list(candidate_map.values())

        # 6. Intent-Aware Cross Reranking & MMR Diversity Filtering
        if settings.RERANKER_ENABLED:
            ranked_chunks = reranker.rerank(
                query=processed_query,
                retrieved_chunks=candidate_list,
                top_k=k,
                use_mmr=True
            )
        else:
            candidate_list.sort(key=lambda x: x["similarity"], reverse=True)
            ranked_chunks = candidate_list[:k]

        # 7. Relevance Threshold & Confidence Check
        max_score = ranked_chunks[0]["rerank_score"] if ranked_chunks and "rerank_score" in ranked_chunks[0] else (
            ranked_chunks[0]["similarity"] if ranked_chunks else 0.0
        )
        has_sufficient_context = max_score >= settings.SIMILARITY_THRESHOLD

        duration_ms = round((time.time() - start_time) * 1000, 2)

        # 8. Clean Structured Output
        formatted_chunks = []
        for ch in ranked_chunks:
            meta = ch.get("metadata", {})
            formatted_chunks.append({
                "chunk_id": ch["chunk_id"],
                "text": ch["text"],
                "document_name": meta.get("document_name", "Unknown Document"),
                "document_id": meta.get("document_id", "DOC-UNKNOWN"),
                "page_number": meta.get("page_number", 1),
                "section_name": meta.get("section_name", ""),
                "category": meta.get("category", "general"),
                "machine_type": meta.get("machine_type", "GENERAL_INDUSTRIAL"),
                "component": meta.get("component", "GENERAL"),
                "relevance_score": ch.get("rerank_score", ch.get("similarity", 0.0)),
                "metadata": meta
            })

        print(f"[RetrievalPipeline] Query: '{query}' [Intent: {processed_query.intent.value}] -> Retrieved {len(formatted_chunks)} chunks in {duration_ms}ms (Max: {max_score})")

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
