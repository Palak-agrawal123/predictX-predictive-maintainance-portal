"""
Prompt Templates and Context Formatter for PredictX RAG Generation.
Enforces strict industrial grounding, telemetry separation, and citation standards.
"""
from typing import List, Dict, Any, Optional

SYSTEM_PROMPT = """You are PredictX AI Maintenance Assistant, an intelligent industrial predictive maintenance assistant.

Your responsibility is to explain machine health, failure risks, sensor abnormalities, remaining useful life, and maintenance procedures.

Use the provided maintenance documents, historical records, sensor readings, and ML predictions as evidence.

Rules:
1. Answer using the available contextual information.
2. Do not invent machine readings.
3. Do not invent ML predictions.
4. Do not fabricate technical specifications.
5. Distinguish actual readings from retrieved documentation.
6. Explain possible failure causes carefully.
7. Provide practical inspection recommendations supported by the evidence.
8. Mention uncertainty whenever the available information is insufficient.
9. Never claim that a machine has definitely failed based only on a model prediction.
10. Cite the supporting documents and page numbers for technical claims.
11. If the retrieved information does not support an answer, explicitly state that.
12. Do not present a generic maintenance procedure as a manufacturer-approved instruction unless the source establishes that.

Format your response in clear, structured sections:
- **Summary**: Concise overview of the diagnosis or answer.
- **Technical & Failure Mechanism Analysis**: Explanation of degradation, physics, or maintenance context.
- **Live Telemetry & Prediction Assessment**: Analysis of live sensor values and ML models (if machine context provided).
- **Recommended Maintenance Actions**: Clear step-by-step inspection protocols and safety precautions.
- **Uncertainty & Operational Limitations**: Any caveats, missing sensor channels, or assumptions.
"""

def format_context_prompt(
    question: str,
    retrieved_chunks: List[Dict[str, Any]],
    machine_context: Optional[Dict[str, Any]] = None,
    prediction_context: Optional[Dict[str, Any]] = None
) -> str:
    """
    Builds the user prompt containing question, retrieved documentation,
    and structured telemetry / ML prediction.
    """
    parts = []

    # 1. User Question
    parts.append(f"USER QUESTION:\n{question}\n")

    # 2. Structured Machine Telemetry & Specifications (if provided)
    if machine_context:
        parts.append("==========================================")
        parts.append("STRUCTURED MACHINE TELEMETRY & SPECIFICATIONS (VERIFIED LIVE DATA):")
        parts.append(f"- Machine ID: {machine_context.get('machineId', 'N/A')}")
        parts.append(f"- Name: {machine_context.get('name', 'N/A')}")
        parts.append(f"- Machine Type: {machine_context.get('machineType', 'N/A')}")
        parts.append(f"- Current Status: {machine_context.get('status', 'N/A')}")
        parts.append(f"- Criticality Tier: {machine_context.get('criticality', 'N/A')}")
        parts.append(f"- Operating Hours / Cycle: {machine_context.get('operatingHours', machine_context.get('cycle', 'N/A'))}")
        
        telemetry = machine_context.get("telemetry") or machine_context.get("sensors") or {}
        if telemetry:
            parts.append("- Observed Sensor Telemetry:")
            for k, v in telemetry.items():
                parts.append(f"  * {k}: {v}")
        parts.append("==========================================\n")

    # 3. Live ML Model Predictions (if provided)
    if prediction_context:
        parts.append("==========================================")
        parts.append("ACTIVE MACHINE LEARNING PREDICTION (C-MAPSS ML PIPELINE):")
        pred_res = prediction_context.get("predictionResult") or prediction_context.get("prediction") or {}
        parts.append(f"- Failure Probability: {pred_res.get('riskProbability', pred_res.get('failure_probability', 'N/A'))}")
        parts.append(f"- Risk Classification: {pred_res.get('riskLevel', pred_res.get('risk_tier', 'N/A')).upper()}")
        parts.append(f"- Machine Health Score: {pred_res.get('healthScore', 'N/A')}%")
        parts.append(f"- Estimated Remaining Useful Life (RUL): {pred_res.get('estimatedRULDays', pred_res.get('predicted_rul', 'N/A'))} cycles/days")
        parts.append(f"- Suspected Failure Mode: {pred_res.get('suspectedFailureMode', pred_res.get('primary_component', 'N/A'))}")
        parts.append(f"- ML Model Recommended Action: {pred_res.get('recommendedAction', 'N/A')}")
        parts.append(f"- Model Version: {prediction_context.get('modelVersion', 'C-MAPSS-XGB-BiLSTM')}")
        parts.append("==========================================\n")

    # 4. Retrieved Technical Knowledge Chunks
    parts.append("==========================================")
    parts.append("RETRIEVED TECHNICAL KNOWLEDGE (MAINTENANCE MANUALS & NASA SPECIFICATIONS):")
    if retrieved_chunks:
        for idx, chunk in enumerate(retrieved_chunks, start=1):
            doc_name = chunk.get("document_name", "Unknown Document")
            page_num = chunk.get("page_number", 1)
            section = chunk.get("section_name", "")
            chunk_id = chunk.get("chunk_id", f"CHUNK-{idx}")
            relevance = chunk.get("relevance_score", 0.0)
            
            parts.append(f"--- [SOURCE {idx}: {doc_name} | Page {page_num} | Section: '{section}'] (Ref ID: {chunk_id}, Relevance: {relevance}) ---")
            parts.append(chunk.get("text", "").strip())
            parts.append("")
    else:
        parts.append("[NOTICE: No relevant technical documentation found in knowledge base exceeding threshold]")
    parts.append("==========================================\n")

    parts.append(
        "Please provide a grounded, actionable response adhering strictly to the system rules and citing "
        "the exact source documents and page numbers where applicable."
    )

    return "\n".join(parts)
