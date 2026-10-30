"""
Master Response Generation Coordinator for PredictX RAG Service.
Integrates session tracking, hybrid retrieval, intent-aware dynamic context formatting,
LLM generation, anti-repetition guardrails, and genuine citation extraction.
"""
from typing import Dict, Any, Optional, List

from retrieval.retrieval_pipeline import retrieval_pipeline
from retrieval.query_processor import query_processor, QueryIntent
from generation.prompt_template import SYSTEM_PROMPT, format_context_prompt
from generation.llm_client import llm_client
from generation.citation_manager import citation_manager
from generation.session_manager import session_manager
from generation.anti_repetition import anti_repetition_guard

class ResponseGenerator:
    def __init__(self):
        self.retrieval_pipeline = retrieval_pipeline
        self.llm_client = llm_client
        self.citation_manager = citation_manager
        self.session_manager = session_manager
        self.anti_repetition = anti_repetition_guard

    def generate_answer(
        self,
        question: str,
        machine_context: Optional[Dict[str, Any]] = None,
        prediction_context: Optional[Dict[str, Any]] = None,
        conversation_id: Optional[str] = None,
        top_k: int = 4
    ) -> Dict[str, Any]:
        """
        Executes end-to-end RAG answer generation workflow with conversational memory.
        """
        # 1. Resolve multi-turn context and follow-ups
        explicit_m_id = machine_context.get("machineId") if machine_context else None
        session_info = self.session_manager.resolve_followup(
            session_id=conversation_id,
            current_query=question,
            explicit_machine_id=explicit_m_id
        )
        rewritten_query = session_info["rewritten_query"]
        effective_m_id = session_info["effective_machine_id"]
        is_followup = session_info["is_followup"]
        session = session_info["session"]

        # 2. Retrieve supporting technical documentation
        retrieval_result = self.retrieval_pipeline.retrieve(
            query=rewritten_query,
            machine_id=effective_m_id,
            top_k=top_k,
            is_followup=is_followup
        )
        retrieved_chunks = retrieval_result["chunks"]
        processed_q = retrieval_result["processed_query"]
        intent_val = processed_q.get("intent", QueryIntent.GENERAL_KNOWLEDGE)
        try:
            intent_enum = QueryIntent(intent_val)
        except ValueError:
            intent_enum = QueryIntent.GENERAL_KNOWLEDGE

        # 3. Context Sufficiency & Out-of-Scope Rejection
        q_lower = question.lower()
        engineering_terms = [
            "maintenance", "machine", "vibration", "temperature", "bearing", "compressor", "turbine",
            "sensor", "rul", "failure", "health", "spindle", "torque", "tool", "c-mapss", "inspection",
            "overheating", "degradation", "iso", "engine", "pdm", "predictive", "audit", "crack", "paris",
            "lubrication", "cavitation", "pressure", "fft", "spectrum", "acoustic", "rms", "kurtosis",
            "wear", "interventions", "telemetry", "asset", "alarm", "fault", "diagnostic"
        ]
        has_engineering_term = any(t in q_lower for t in engineering_terms)
        is_out_of_domain = (not machine_context and not has_engineering_term and retrieval_result["max_relevance_score"] < 0.55) or (
            not retrieval_result["has_sufficient_context"] and not machine_context and intent_enum == QueryIntent.GENERAL_KNOWLEDGE
        )

        if is_out_of_domain:
            fallback_answer = (
                "### Out-of-Domain Technical Query\n"
                "The PredictX engineering assistant is dedicated to industrial predictive maintenance, machinery health diagnostics, "
                "sensor interpretation, remaining useful life (RUL) estimation, and maintenance SOPs.\n\n"
                f"Your question *\"{question}\"* does not match verified predictive maintenance documentation in the knowledge base. "
                "Please ask a question related to industrial assets, NASA C-MAPSS benchmarks, sensor anomalies, or maintenance procedures."
            )
            return {
                "answer": fallback_answer,
                "citations": [],
                "has_sufficient_context": False,
                "max_relevance_score": retrieval_result["max_relevance_score"],
                "retrieved_chunks_count": 0,
                "retrieval_latency_ms": retrieval_result["retrieval_latency_ms"],
                "machine_context_used": False,
                "prediction_context_used": False,
                "detected_intent": intent_enum.value,
                "rewritten_query": rewritten_query
            }

        # 4. Assemble Grounded Dynamic Context
        recent_history_dicts = [t.to_dict() for t in session.get_recent_turns(2)]
        user_prompt = format_context_prompt(
            question=question,
            retrieved_chunks=retrieved_chunks,
            machine_context=machine_context,
            prediction_context=prediction_context,
            rewritten_query=rewritten_query,
            intent=intent_enum,
            recent_history=recent_history_dicts
        )

        # 5. Generate Answer via LLM Client
        raw_answer = self.llm_client.generate(
            system_prompt=SYSTEM_PROMPT,
            user_prompt=user_prompt,
            question=question,
            retrieved_chunks=retrieved_chunks,
            machine_context=machine_context,
            prediction_context=prediction_context,
            intent=intent_enum,
            rewritten_query=rewritten_query,
            recent_history=recent_history_dicts
        )

        # 6. Anti-Repetition Guardrail Check
        recent_answers = session.get_recent_answers(3)
        is_repetitive, sim_score = self.anti_repetition.check_repetition(raw_answer, recent_answers)
        if is_repetitive and len(session.turns) > 0 and question.strip().lower() != session.turns[-1].question.strip().lower():
            # Add explicit conversational disambiguation header
            raw_answer = (
                f"*Addressing your specific inquiry regarding \"{question}\" (distinct from previous discussion):*\n\n" + raw_answer
            )

        # 7. Extract & Verify Genuine Citations
        citations = self.citation_manager.extract_and_verify_citations(raw_answer, retrieved_chunks)

        # 8. Record Turn in Session History
        retrieved_ids = [c.get("chunk_id", "") for c in retrieved_chunks]
        session.add_turn(
            question=question,
            answer=raw_answer,
            intent=intent_enum.value,
            rewritten_query=rewritten_query,
            machine_id=effective_m_id,
            retrieved_chunk_ids=retrieved_ids
        )

        return {
            "answer": raw_answer,
            "citations": citations,
            "has_sufficient_context": retrieval_result["has_sufficient_context"],
            "max_relevance_score": retrieval_result["max_relevance_score"],
            "retrieved_chunks_count": len(retrieved_chunks),
            "retrieval_latency_ms": retrieval_result["retrieval_latency_ms"],
            "machine_context_used": bool(machine_context),
            "prediction_context_used": bool(prediction_context),
            "detected_intent": intent_enum.value,
            "rewritten_query": rewritten_query
        }

# Global singleton
response_generator = ResponseGenerator()
