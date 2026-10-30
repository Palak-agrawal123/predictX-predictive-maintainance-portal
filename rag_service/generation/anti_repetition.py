"""
Anti-Repetition & Generation Quality Guardrail for PredictX RAG Pipeline.
Monitors consecutive turn similarities, detects boilerplate loops,
and enforces answer diversity across distinct user queries.
"""
import re
from typing import List, Set, Tuple

class AntiRepetitionGuard:
    def __init__(self, similarity_threshold: float = 0.82):
        self.similarity_threshold = similarity_threshold

    def _get_ngrams(self, text: str, n: int = 3) -> Set[Tuple[str, ...]]:
        words = re.findall(r"\w+", text.lower())
        if len(words) < n:
            return set()
        return {tuple(words[i:i+n]) for i in range(len(words) - n + 1)}

    def compute_response_similarity(self, resp_a: str, resp_b: str) -> float:
        """
        Computes blended 3-gram and token Jaccard similarity between two answers.
        """
        if not resp_a or not resp_b:
            return 0.0

        words_a = set(re.findall(r"\w+", resp_a.lower()))
        words_b = set(re.findall(r"\w+", resp_b.lower()))

        if not words_a or not words_b:
            return 0.0

        token_jaccard = len(words_a.intersection(words_b)) / len(words_a.union(words_b))
        
        ngrams_a = self._get_ngrams(resp_a, n=3)
        ngrams_b = self._get_ngrams(resp_b, n=3)

        ngram_jaccard = (
            len(ngrams_a.intersection(ngrams_b)) / max(1, len(ngrams_a.union(ngrams_b)))
            if ngrams_a and ngrams_b else token_jaccard
        )

        return round(0.5 * token_jaccard + 0.5 * ngram_jaccard, 4)

    def check_repetition(
        self,
        current_answer: str,
        recent_answers: List[str]
    ) -> Tuple[bool, float]:
        """
        Returns (is_repetitive, max_similarity).
        """
        if not recent_answers:
            return False, 0.0

        max_sim = 0.0
        for prev in recent_answers:
            sim = self.compute_response_similarity(current_answer, prev)
            if sim > max_sim:
                max_sim = sim

        is_rep = max_sim >= self.similarity_threshold
        return is_rep, max_sim

# Global singleton
anti_repetition_guard = AntiRepetitionGuard()
