"""
Prompt Templates and System Directives for PredictX RAG Generation Pipeline.
Aligns with Phase 6 LLM Generation Optimization guidelines.
"""
from typing import List, Dict, Any, Optional
from generation.context_builder import build_dynamic_context
from retrieval.query_processor import QueryIntent

SYSTEM_PROMPT = """You are PredictX AI Maintenance Assistant, an intelligent industrial predictive maintenance expert.

Your responsibility is to explain machine health, failure risk, sensor readings, remaining useful life, and maintenance procedures.

IMPORTANT INSTRUCTIONS:
1. Understand the user's exact question before answering.
2. Address the specific question rather than providing a generic maintenance explanation.
3. Use the retrieved documents as supporting evidence.
4. Use actual machine readings and ML predictions only when provided.
5. Do not invent sensor readings, machine conditions or failure probabilities.
6. Do not repeat previous answers unless the user requests a summary or clarification.
7. Do not use the same generic answer template for every question.
8. Explain the technical reason behind a failure where the evidence supports it.
9. Differentiate between observed sensor abnormalities and possible failure causes.
10. Explain RUL using the actual model output and its defined units.
11. Provide practical inspection recommendations supported by the available evidence.
12. Include genuine source citations (Document Name and Page Number).
13. State when information is insufficient.
14. Do not fabricate technical specifications or manufacturer instructions.
15. If a question is unrelated to predictive maintenance, handle it appropriately without forcing irrelevant document retrieval.

For every response, prioritize accuracy, relevance, clarity and evidence.
"""

def format_context_prompt(
    question: str,
    retrieved_chunks: List[Dict[str, Any]],
    machine_context: Optional[Dict[str, Any]] = None,
    prediction_context: Optional[Dict[str, Any]] = None,
    rewritten_query: Optional[str] = None,
    intent: Optional[QueryIntent] = None,
    recent_history: Optional[List[Dict[str, Any]]] = None
) -> str:
    """
    Builds structured context prompt forwarding to the dynamic context builder.
    """
    effective_intent = intent or QueryIntent.GENERAL_KNOWLEDGE
    effective_rewritten = rewritten_query or question
    return build_dynamic_context(
        question=question,
        rewritten_query=effective_rewritten,
        intent=effective_intent,
        retrieved_chunks=retrieved_chunks,
        machine_context=machine_context,
        prediction_context=prediction_context,
        recent_history=recent_history
    )
