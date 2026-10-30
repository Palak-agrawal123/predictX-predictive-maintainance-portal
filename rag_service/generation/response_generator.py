"""
Response Generation Coordinator for PredictX RAG Service.
Integrates hybrid retrieval, prompt formatting, LLM inference, and citation verification.
"""
from typing import Dict, Any, Optional, List

from retrieval.retrieval_pipeline import retrieval_pipeline
from generation.prompt_template import SYSTEM_PROMPT, format_context_prompt
from generation.llm_client import llm_client
from generation.citation_manager import citation_manager

class ResponseGenerator:
    def __init__(self):
        self.retrieval_pipeline = retrieval_pipeline
        self.llm_client = llm_client
        self.citation_manager = citation_manager

    def generate_answer(
        self,
        question: str,
        machine_context: Optional[Dict[str, Any]] = None,
        prediction_context: Optional[Dict[str, Any]] = None,
        top_k: int = 4
    ) -> Dict[str, Any]:
        """
        Executes complete RAG answer generation workflow.
        """
        machine_id = machine_context.get("machineId") if machine_context else None

        # 1. Retrieve supporting documentation
        retrieval_result = self.retrieval_pipeline.retrieve(
            query=question,
            machine_id=machine_id,
            top_k=top_k
        )
        retrieved_chunks = retrieval_result["chunks"]

        # 2. Check context sufficiency
        if not retrieval_result["has_sufficient_context"] and not machine_context:
            fallback_answer = (
                "### Insufficient Technical Documentation\n"
                f"The PredictX technical knowledge base does not currently contain documentation matching your query "
                f"with sufficient statistical confidence (highest relevance score: {retrieval_result['max_relevance_score']:.2f}).\n\n"
                "Please refine your query with specific component names (e.g. *High Pressure Compressor*, *Bearing Raceway*, *Spindle Tool Wear*), "
                "or specify an active machine identifier (e.g. *MCH-102*, *UNIT-03*)."
            )
            return {
                "answer": fallback_answer,
                "citations": [],
                "has_sufficient_context": False,
                "max_relevance_score": retrieval_result["max_relevance_score"],
                "retrieved_chunks_count": 0,
                "retrieval_latency_ms": retrieval_result["retrieval_latency_ms"],
                "machine_context_used": bool(machine_context),
                "prediction_context_used": bool(prediction_context)
            }

        # 3. Assemble Grounded Context Prompt
        user_prompt = format_context_prompt(
            question=question,
            retrieved_chunks=retrieved_chunks,
            machine_context=machine_context,
            prediction_context=prediction_context
        )

        # 4. Generate answer via configured LLM provider
        raw_answer = self.llm_client.generate(
            system_prompt=SYSTEM_PROMPT,
            user_prompt=user_prompt,
            question=question,
            retrieved_chunks=retrieved_chunks,
            machine_context=machine_context,
            prediction_context=prediction_context
        )

        # 5. Extract and verify genuine citations
        citations = self.citation_manager.extract_and_verify_citations(raw_answer, retrieved_chunks)

        return {
            "answer": raw_answer,
            "citations": citations,
            "has_sufficient_context": retrieval_result["has_sufficient_context"],
            "max_relevance_score": retrieval_result["max_relevance_score"],
            "retrieved_chunks_count": len(retrieved_chunks),
            "retrieval_latency_ms": retrieval_result["retrieval_latency_ms"],
            "machine_context_used": bool(machine_context),
            "prediction_context_used": bool(prediction_context)
        }

# Global singleton
response_generator = ResponseGenerator()
