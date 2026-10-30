"""
Advanced Query Understanding and Intent Classification Engine for PredictX RAG Pipeline.
Classifies user queries into 9 distinct predictive maintenance intents,
extracts technical entities, and normalizes queries for optimal hybrid retrieval.
"""
import re
from typing import Dict, Any, List, Optional
from enum import Enum

class QueryIntent(str, Enum):
    MACHINE_HEALTH = "MACHINE_HEALTH"
    FAILURE_DIAGNOSIS = "FAILURE_DIAGNOSIS"
    RUL_ESTIMATION = "RUL_ESTIMATION"
    SENSOR_INTERPRETATION = "SENSOR_INTERPRETATION"
    MAINTENANCE_PROCEDURE = "MAINTENANCE_PROCEDURE"
    TROUBLESHOOTING = "TROUBLESHOOTING"
    HISTORICAL_ANALYSIS = "HISTORICAL_ANALYSIS"
    GENERAL_KNOWLEDGE = "GENERAL_KNOWLEDGE"
    FOLLOW_UP = "FOLLOW_UP"

MACHINE_ID_PATTERN = re.compile(r"\b(MCH-\d+|UNIT-\d+|\bM-\d+)\b", re.IGNORECASE)

SENSOR_PATTERNS = {
    "s_1": ["s_1", "t2", "fan inlet temperature", "fan inlet temp"],
    "s_2": ["s_2", "t24", "lpc outlet temp", "lpc temperature"],
    "s_3": ["s_3", "t30", "hpc outlet temp", "compressor discharge temp"],
    "s_4": ["s_4", "t50", "egt", "exhaust gas temp", "turbine outlet temp"],
    "s_6": ["s_6", "p15", "bypass duct pressure"],
    "s_7": ["s_7", "p30", "hpc pressure", "burner inlet pressure"],
    "s_8": ["s_8", "nf", "fan speed", "low pressure rotor speed"],
    "s_9": ["s_9", "nc", "core speed", "high pressure rotor speed"],
    "s_11": ["s_11", "ps30", "static pressure", "hpc static pressure"],
    "s_12": ["s_12", "phi", "fuel flow", "fuel ratio"],
    "s_13": ["s_13", "nrf", "corrected fan speed"],
    "s_14": ["s_14", "nrc", "corrected core speed"],
    "s_15": ["s_15", "bpr", "bypass ratio"],
    "vibration": ["vibration", "vibrationmms", "accelerometer", "broadband vibration", "rms velocity", "unbalance", "misalignment"],
    "temperature": ["temperature", "temp", "overheating", "overheat", "thermal differential", "delta-t", "cooling", "coolant"],
    "torque": ["torque", "torquenm", "power transmission", "overstrain"],
    "tool_wear": ["tool wear", "cutting insert", "flank wear", "engaged minutes", "spindle runout"],
    "rul": ["rul", "remaining useful life", "life expectancy", "cycles left", "days remaining", "degradation curve"]
}

COMPONENT_KEYWORDS = {
    "COMPRESSOR": ["compressor", "hpc", "lpc", "blade tip", "borescope", "fouling", "blade tip erosion", "chord loss"],
    "TURBINE": ["turbine", "hpt", "lpt", "hot section", "egt margin", "nozzle guide vane", "thermal distress"],
    "BEARING": ["bearing", "raceway", "bpfo", "bpfi", "bsf", "inner race", "outer race", "flaking", "micro-spalling", "cage"],
    "CUTTING_TOOL": ["tool", "insert", "toolholder", "feed rate", "machining", "roughing pass", "cutting edge"],
    "SPINDLE": ["spindle", "dial indicator", "runout", "collet", "chatter"],
    "COOLING_SYSTEM": ["cooling", "coolant", "radiator", "heat dissipation", "hdf", "heat exchanger", "circulation"]
}

# Explicit keyword sets for intent classification
INTENT_RULES = [
    # 1. RUL Estimation
    (QueryIntent.RUL_ESTIMATION, [
        "rul", "remaining useful life", "life remaining", "cycles remaining", "how many cycles",
        "how long until failure", "life expectancy", "piecewise linear", "inflection point", "cycles left"
    ]),
    # 2. Sensor Interpretation
    (QueryIntent.SENSOR_INTERPRETATION, [
        "sensor s_", "sensor reading", "what does sensor", "baseline reading", "sensor value",
        "t50 reading", "ps30 reading", "t24 reading", "t30 reading", "what does the temperature indicate",
        "sensor drift", "sensor anomalous", "abnormal reading", "telemetry value", "nominal reading"
    ]),
    # 3. Vibration & Bearing Standards
    (QueryIntent.GENERAL_KNOWLEDGE, [
        "iso 10816", "iso 10816-3", "what is iso", "vibration zones", "zone a", "zone b", "zone c", "zone d",
        "what is predictive maintenance", "what is condition monitoring", "difference between preventive and predictive",
        "what is vibration analysis", "paris law", "crack propagation law", "operating regime"
    ]),
    # 4. Troubleshooting & Overheating
    (QueryIntent.TROUBLESHOOTING, [
        "overheating", "overheat", "temperature increasing", "heat dissipation failure", "hdf",
        "why is it hot", "coolant failure", "cooling issue", "thermal warning", "pop-up indicator", "delta-p"
    ]),
    # 5. Maintenance Procedures & SOPs
    (QueryIntent.MAINTENANCE_PROCEDURE, [
        "sop", "procedure", "how to inspect", "borescope inspection", "work order", "protocol",
        "replacement procedure", "how do i replace", "maintenance procedure", "tier 1 audit",
        "tier 2 inspection", "corrective action", "intervention protocol", "action should i take"
    ]),
    # 6. Historical Analysis
    (QueryIntent.HISTORICAL_ANALYSIS, [
        "incident", "inc-", "rec-", "historical", "previous failure", "prior breakdown",
        "past incident", "downtime cost", "history report"
    ]),
    # 7. Machine-Specific Failure Risk
    (QueryIntent.FAILURE_DIAGNOSIS, [
        "why is this machine showing", "why high failure", "high risk", "root cause", "failure mechanism",
        "what causes bearing failure", "what causes compressor degradation", "what causes tool breakage",
        "why is machine", "why does a bearing fail", "failure modes"
    ]),
    # 8. Machine Health Analysis
    (QueryIntent.MACHINE_HEALTH, [
        "machine health", "health score", "current health", "overall condition", "health status",
        "is this machine healthy", "explain my machine's health", "explain my machine"
    ])
]

class ProcessedQuery:
    def __init__(
        self,
        original_query: str,
        normalized_query: str,
        intent: QueryIntent,
        detected_machine_id: Optional[str] = None,
        detected_sensors: List[str] = None,
        detected_components: List[str] = None,
        is_machine_specific: bool = False,
        is_followup: bool = False,
        search_terms: List[str] = None
    ):
        self.original_query = original_query
        self.normalized_query = normalized_query
        self.intent = intent
        self.detected_machine_id = detected_machine_id
        self.detected_sensors = detected_sensors or []
        self.detected_components = detected_components or []
        self.is_machine_specific = is_machine_specific
        self.is_followup = is_followup
        self.search_terms = search_terms or []

    def to_dict(self) -> Dict[str, Any]:
        return {
            "original_query": self.original_query,
            "normalized_query": self.normalized_query,
            "intent": self.intent.value,
            "detected_machine_id": self.detected_machine_id,
            "detected_sensors": self.detected_sensors,
            "detected_components": self.detected_components,
            "is_machine_specific": self.is_machine_specific,
            "is_followup": self.is_followup,
            "search_terms": self.search_terms
        }

class QueryProcessor:
    def process_query(
        self,
        query: str,
        machine_id_context: Optional[str] = None,
        is_followup: bool = False
    ) -> ProcessedQuery:
        clean_text = query.strip()
        q_lower = clean_text.lower()

        # 1. Detect Machine ID
        machine_match = MACHINE_ID_PATTERN.search(clean_text)
        detected_id = machine_id_context.upper() if machine_id_context else None
        if machine_match and not detected_id:
            detected_id = machine_match.group(1).upper()

        # 2. Detect Sensor Channels
        detected_sensors = []
        for sensor_key, variants in SENSOR_PATTERNS.items():
            for v in variants:
                if re.search(r"\b" + re.escape(v) + r"\b", q_lower):
                    detected_sensors.append(sensor_key)
                    break

        # 3. Detect Components
        detected_components = []
        for comp_name, kws in COMPONENT_KEYWORDS.items():
            for kw in kws:
                if kw in q_lower:
                    detected_components.append(comp_name)
                    break

        # 4. Classify Intent
        classified_intent = QueryIntent.GENERAL_KNOWLEDGE
        if is_followup:
            classified_intent = QueryIntent.FOLLOW_UP
        else:
            matched = False
            for intent_candidate, pattern_list in INTENT_RULES:
                for pat in pattern_list:
                    if pat in q_lower:
                        classified_intent = intent_candidate
                        matched = True
                        break
                if matched:
                    break
            
            # Secondary heuristic
            if not matched:
                if detected_id and any(k in q_lower for k in ["risk", "status", "condition", "problem"]):
                    classified_intent = QueryIntent.FAILURE_DIAGNOSIS
                elif any(k in q_lower for k in ["how to", "steps", "guide", "inspect"]):
                    classified_intent = QueryIntent.MAINTENANCE_PROCEDURE
                elif any(k in q_lower for k in ["why", "cause", "reason"]):
                    classified_intent = QueryIntent.FAILURE_DIAGNOSIS

        # 5. Search normalization and query expansion
        clean_search = re.sub(r"[^\w\s\-\.\/]", " ", clean_text)
        clean_search = re.sub(r"\s+", " ", clean_search).strip()

        # Build targeted search expansion
        search_terms = clean_search.split()
        if classified_intent == QueryIntent.RUL_ESTIMATION and "rul" not in clean_search.lower():
            clean_search += " remaining useful life degradation target"
        elif classified_intent == QueryIntent.TROUBLESHOOTING and "heat" not in clean_search.lower() and "overheating" in clean_search.lower():
            clean_search += " heat dissipation failure thermal differential"
        elif "sensor" in clean_search.lower() and ("reading" in clean_search.lower() or "critical" in clean_search.lower()):
            clean_search += " sensor threshold specifications limits vibration"

        return ProcessedQuery(
            original_query=clean_text,
            normalized_query=clean_search,
            intent=classified_intent,
            detected_machine_id=detected_id,
            detected_sensors=detected_sensors,
            detected_components=detected_components,
            is_machine_specific=bool(detected_id),
            is_followup=is_followup,
            search_terms=search_terms
        )

# Global singleton
query_processor = QueryProcessor()
