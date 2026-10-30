"""
Advanced Domain-Specific Reranker & Diversity Filter for PredictX Industrial RAG Pipeline.
Combines dense semantic similarity, exact industrial token alignment, intent weighting,
and Maximal Marginal Relevance (MMR) to prevent redundant chunks from dominating context.
"""
import re
from typing import List, Dict, Any, Set
from retrieval.query_processor import ProcessedQuery, QueryIntent

class IndustrialReranker:
    def __init__(
        self,
        keyword_boost_weight: float = 0.30,
        mmr_lambda: float = 0.70
    ):
        self.keyword_boost_weight = keyword_boost_weight
        self.mmr_lambda = mmr_lambda

    def _compute_chunk_similarity(self, words_a: Set[str], words_b: Set[str]) -> float:
        """
        Calculates Jaccard similarity between two chunk token sets for redundancy pruning.
        """
        if not words_a or not words_b:
            return 0.0
        intersection = len(words_a.intersection(words_b))
        union = len(words_a.union(words_b))
        return float(intersection / max(1, union))

    def rerank(
        self,
        query: ProcessedQuery,
        retrieved_chunks: List[Dict[str, Any]],
        top_k: int = 5,
        use_mmr: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Applies intent-aware scoring, domain token matching, and MMR diversity filtering.
        """
        if not retrieved_chunks:
            return []

        q_terms = set(re.findall(r"\w+", query.normalized_query.lower()))
        
        # Priority terms: specific sensor channels, machine ID, detected components
        priority_terms = set()
        if query.detected_machine_id:
            priority_terms.add(query.detected_machine_id.lower())
        for s in query.detected_sensors:
            priority_terms.add(s.lower())
        for c in query.detected_components:
            priority_terms.add(c.lower())

        # 1. First Pass: Intent and Token-Weighted Scoring
        scored_candidates = []
        for item in retrieved_chunks:
            base_score = float(item.get("similarity", 0.0))
            text_lower = item.get("text", "").lower()
            meta = item.get("metadata", {})
            chunk_words = set(re.findall(r"\w+", text_lower))

            # Exact priority term matches (sensors, machine IDs, components)
            priority_matches = sum(1 for term in priority_terms if term in text_lower)
            priority_boost = min(0.25, priority_matches * 0.10)

            # Query token overlap
            overlap = len(q_terms.intersection(chunk_words))
            overlap_ratio = overlap / max(1, len(q_terms))
            overlap_boost = min(0.20, overlap_ratio * 0.20)

            # Intent alignment boost
            intent_boost = 0.0
            if query.intent == QueryIntent.RUL_ESTIMATION and ("rul" in text_lower or "c-mapss" in text_lower or "cycles" in text_lower):
                intent_boost += 0.10
            elif query.intent == QueryIntent.GENERAL_KNOWLEDGE and ("iso 10816" in text_lower or "predictive maintenance" in text_lower or "zone" in text_lower):
                intent_boost += 0.12
            elif query.intent == QueryIntent.TROUBLESHOOTING and ("overheating" in text_lower or "heat dissipation" in text_lower or "cooling" in text_lower):
                intent_boost += 0.12
            elif query.intent == QueryIntent.MAINTENANCE_PROCEDURE and ("sop" in text_lower or "inspection" in text_lower or "procedure" in text_lower or "borescope" in text_lower):
                intent_boost += 0.10
            elif query.intent == QueryIntent.HISTORICAL_ANALYSIS and ("incident" in text_lower or "failure mode" in text_lower or "rec-" in text_lower):
                intent_boost += 0.15

            # Component match
            if query.detected_components and meta.get("component") in query.detected_components:
                intent_boost += 0.08

            final_score = round(
                (1.0 - self.keyword_boost_weight) * base_score + 
                self.keyword_boost_weight * (base_score + priority_boost + overlap_boost + intent_boost),
                4
            )
            final_score = min(1.0, max(0.0, final_score))

            scored_candidates.append({
                **item,
                "dense_score": base_score,
                "rerank_score": final_score,
                "word_set": chunk_words,
                "priority_matches": priority_matches
            })

        # Sort candidate pool descending
        scored_candidates.sort(key=lambda x: x["rerank_score"], reverse=True)

        if not use_mmr or len(scored_candidates) <= top_k:
            return scored_candidates[:top_k]

        # 2. Second Pass: Maximal Marginal Relevance (MMR) for evidence diversity
        selected: List[Dict[str, Any]] = []
        candidates = list(scored_candidates)

        # Always take the single highest-scoring chunk
        selected.append(candidates.pop(0))

        while candidates and len(selected) < top_k:
            best_idx = -1
            best_mmr_score = -float("inf")

            for idx, cand in enumerate(candidates):
                rel_score = cand["rerank_score"]
                # Maximum redundancy against already selected chunks
                max_redundancy = max(
                    self._compute_chunk_similarity(cand["word_set"], sel["word_set"])
                    for sel in selected
                )
                # Penalize chunks from the exact same document page if already represented
                page_penalty = 0.15 if any(
                    cand.get("metadata", {}).get("document_id") == sel.get("metadata", {}).get("document_id") and
                    cand.get("metadata", {}).get("page_number") == sel.get("metadata", {}).get("page_number")
                    for sel in selected
                ) else 0.0

                mmr_score = self.mmr_lambda * rel_score - (1.0 - self.mmr_lambda) * (max_redundancy + page_penalty)
                if mmr_score > best_mmr_score:
                    best_mmr_score = mmr_score
                    best_idx = idx

            if best_idx >= 0:
                selected.append(candidates.pop(best_idx))
            else:
                break

        return selected

# Global singleton
reranker = IndustrialReranker()
