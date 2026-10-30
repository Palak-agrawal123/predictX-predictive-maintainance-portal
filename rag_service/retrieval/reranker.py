"""
Domain-Specific Reranker for PredictX Industrial RAG Pipeline.
Combines dense semantic similarity with exact domain keyword boost,
sensor code matches, and component relevance weighting.
"""
import re
from typing import List, Dict, Any
from retrieval.query_processor import ProcessedQuery

class IndustrialReranker:
    def __init__(self, keyword_boost_weight: float = 0.25):
        self.keyword_boost_weight = keyword_boost_weight

    def rerank(
        self,
        query: ProcessedQuery,
        retrieved_chunks: List[Dict[str, Any]],
        top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Calculates a blended relevance score combining dense similarity and exact domain token matches.
        """
        if not retrieved_chunks:
            return []

        q_terms = set(re.findall(r"\w+", query.normalized_query.lower()))
        
        # Priority terms: sensor channels, machine ID, detected components
        priority_terms = set()
        if query.detected_machine_id:
            priority_terms.add(query.detected_machine_id.lower())
        for s in query.detected_sensors:
            priority_terms.add(s.lower())
        for c in query.detected_components:
            priority_terms.add(c.lower())

        scored_chunks = []
        for item in retrieved_chunks:
            base_score = float(item.get("similarity", 0.0))
            text_lower = item.get("text", "").lower()
            meta = item.get("metadata", {})
            chunk_words = set(re.findall(r"\w+", text_lower))

            # 1. Exact priority term matches (sensors, machine IDs, components)
            priority_matches = sum(1 for term in priority_terms if term in text_lower)
            priority_boost = min(0.20, priority_matches * 0.08)

            # 2. General token overlap (Jaccard similarity on content terms)
            overlap = len(q_terms.intersection(chunk_words))
            overlap_ratio = overlap / max(1, len(q_terms))
            overlap_boost = min(0.15, overlap_ratio * 0.15)

            # 3. Component & Machine Type alignment boost
            context_boost = 0.0
            if query.detected_components and meta.get("component") in query.detected_components:
                context_boost += 0.05

            final_score = round(
                (1.0 - self.keyword_boost_weight) * base_score + 
                self.keyword_boost_weight * (base_score + priority_boost + overlap_boost + context_boost),
                4
            )
            final_score = min(1.0, max(0.0, final_score))

            scored_item = {
                **item,
                "dense_score": base_score,
                "rerank_score": final_score,
                "priority_matches": priority_matches
            }
            scored_chunks.append(scored_item)

        # Sort descending by rerank_score
        scored_chunks.sort(key=lambda x: x["rerank_score"], reverse=True)
        return scored_chunks[:top_k]

# Global singleton
reranker = IndustrialReranker()
