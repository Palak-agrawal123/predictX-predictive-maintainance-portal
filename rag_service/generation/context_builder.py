"""
Dynamic Context Builder for PredictX RAG Generation Pipeline.
Assembles tailored, query-specific context based on classified intent,
retrieved technical documents, relevant telemetry, and isolated session history.
"""
from typing import List, Dict, Any, Optional
from retrieval.query_processor import QueryIntent

def build_dynamic_context(
    question: str,
    rewritten_query: str,
    intent: QueryIntent,
    retrieved_chunks: List[Dict[str, Any]],
    machine_context: Optional[Dict[str, Any]] = None,
    prediction_context: Optional[Dict[str, Any]] = None,
    recent_history: Optional[List[Dict[str, Any]]] = None
) -> str:
    """
    Constructs an intent-tailored prompt context.
    Omits irrelevant telemetry for general concepts and focuses strictly on supporting evidence.
    """
    sections = []

    # 1. User Query & Resolution
    sections.append(f"USER QUESTION: {question}")
    if rewritten_query and rewritten_query.strip() != question.strip():
        sections.append(f"RESOLVED CONTEXTUAL QUERY: {rewritten_query}")
    sections.append(f"IDENTIFIED QUERY INTENT: {intent.value if hasattr(intent, 'value') else intent}\n")

    # 2. Conversational History (if follow-up)
    if recent_history:
        sections.append("==========================================")
        sections.append("RELEVANT PREVIOUS CONVERSATION CONTEXT:")
        for idx, h in enumerate(recent_history[-2:], start=1):
            sections.append(f"Q{idx}: {h.get('question')}")
            # Include concise summary of prior answer
            prev_ans = h.get('answer', '').split('\n\n')[0]
            sections.append(f"A{idx}: {prev_ans[:200]}...")
        sections.append("==========================================\n")

    # 3. Machine Telemetry & ML Predictions (ONLY when query is machine-specific or machine context supplied)
    is_machine_relevant = bool(machine_context) and intent not in [
        QueryIntent.GENERAL_KNOWLEDGE
    ]

    if is_machine_relevant:
        sections.append("==========================================")
        sections.append("VERIFIED ASSET TELEMETRY & SPECIFICATIONS:")
        sections.append(f"- Asset Identifier: {machine_context.get('machineId', 'N/A')}")
        sections.append(f"- Asset Name: {machine_context.get('name', 'N/A')}")
        sections.append(f"- Machine Class: {machine_context.get('machineType', 'N/A')}")
        sections.append(f"- Operational Status: {machine_context.get('status', 'N/A')}")
        sections.append(f"- Criticality Tier: {machine_context.get('criticality', 'N/A')}")
        sections.append(f"- Operational Hours / Cycles: {machine_context.get('operatingHours', machine_context.get('cycle', 'N/A'))}")

        telemetry = machine_context.get("telemetry") or machine_context.get("sensors") or {}
        if telemetry:
            sections.append("- Current Sensory Telemetry Readings:")
            for k, v in telemetry.items():
                sections.append(f"  * {k}: {v}")
        sections.append("==========================================\n")

    if prediction_context and is_machine_relevant:
        sections.append("==========================================")
        sections.append("ACTIVE PREDICTIVE ML MODEL INFERENCE (C-MAPSS HYBRID PIPELINE):")
        pred_res = prediction_context.get("predictionResult") or prediction_context.get("prediction") or {}
        sections.append(f"- Failure Probability: {pred_res.get('riskProbability', pred_res.get('failure_probability', 'N/A'))}")
        sections.append(f"- Risk Classification: {str(pred_res.get('riskLevel', pred_res.get('risk_tier', 'N/A'))).upper()}")
        sections.append(f"- Composite Health Index: {pred_res.get('healthScore', 'N/A')}%")
        sections.append(f"- Remaining Useful Life (RUL): {pred_res.get('estimatedRULDays', pred_res.get('predicted_rul', 'N/A'))} cycles/operating days")
        sections.append(f"- Primary Suspected Failure Mode: {pred_res.get('suspectedFailureMode', pred_res.get('primary_component', 'N/A'))}")
        sections.append(f"- Model Diagnostic Action: {pred_res.get('recommendedAction', 'N/A')}")
        sections.append(f"- Serving Model Version: {prediction_context.get('modelVersion', 'C-MAPSS-XGB-BiLSTM')}")
        sections.append("==========================================\n")

    # 4. Retrieved Technical Documentation Chunks
    sections.append("==========================================")
    sections.append("RETRIEVED TECHNICAL KNOWLEDGE BASE CHUNKS:")
    if retrieved_chunks:
        for idx, chunk in enumerate(retrieved_chunks, start=1):
            doc_name = chunk.get("document_name", "Unknown Document")
            page_num = chunk.get("page_number", 1)
            section = chunk.get("section_name", "")
            chunk_id = chunk.get("chunk_id", f"CHUNK-{idx}")
            relevance = chunk.get("relevance_score", 0.0)

            sections.append(f"--- [EVIDENCE {idx}: {doc_name} | Page {page_num} | Section: '{section}'] (Ref: {chunk_id}, Relevance: {relevance:.2f}) ---")
            sections.append(chunk.get("text", "").strip())
            sections.append("")
    else:
        sections.append("[NOTICE: No technical documentation found in knowledge base exceeding relevance threshold]")
    sections.append("==========================================\n")

    sections.append(
        "Generate a tailored, technically rigorous response that directly answers the user's question "
        "using the retrieved documentation. Do not invent readings or use a generic template."
    )

    return "\n".join(sections)
