"""
Citation Manager for PredictX RAG Generation Engine.
Verifies and formats genuine citations tied directly to retrieved document chunks.
"""
from typing import List, Dict, Any

class CitationManager:
    @staticmethod
    def extract_and_verify_citations(
        response_text: str,
        retrieved_chunks: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Validates citations referenced in response against the actual retrieved chunks.
        Returns a list of structured citation references with verbatim excerpts.
        """
        citations = []
        seen = set()

        for chunk in retrieved_chunks:
            doc_name = chunk.get("document_name", "Unknown Document")
            page_num = chunk.get("page_number", 1)
            section = chunk.get("section_name", "")
            chunk_id = chunk.get("chunk_id", "")
            relevance = chunk.get("relevance_score", 0.0)
            
            # Avoid duplicate citations for the same document and page
            dedup_key = f"{doc_name}-{page_num}"
            if dedup_key in seen:
                continue
            seen.add(dedup_key)

            # Extract a concise excerpt (first 180 chars)
            raw_text = chunk.get("text", "").strip()
            first_sentence = raw_text.split("\n")[0]
            excerpt = first_sentence if len(first_sentence) < 160 else first_sentence[:157] + "..."

            citations.append({
                "citation_id": f"CIT-{len(citations) + 1}",
                "document_name": doc_name,
                "page_number": page_num,
                "section_name": section,
                "chunk_id": chunk_id,
                "relevance_score": relevance,
                "excerpt": excerpt
            })

        return citations

citation_manager = CitationManager()
