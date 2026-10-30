"""
Query Processor Module for PredictX Retrieval Pipeline.
Extracts machine identifiers, sensor channels, component tags, and normalizes queries.
"""
import re
from typing import Dict, Any, List, Optional

MACHINE_ID_PATTERN = re.compile(r"\b(MCH-\d+|UNIT-\d+|\bM-\d+)\b", re.IGNORECASE)
SENSOR_PATTERNS = {
    "s_1": ["s_1", "t2", "fan inlet temp"],
    "s_2": ["s_2", "t24", "lpc outlet temp"],
    "s_3": ["s_3", "t30", "hpc outlet temp"],
    "s_4": ["s_4", "t50", "egt", "exhaust gas temp"],
    "s_7": ["s_7", "p30", "hpc pressure"],
    "s_8": ["s_8", "nf", "fan speed"],
    "s_9": ["s_9", "nc", "core speed"],
    "s_11": ["s_11", "ps30", "static pressure"],
    "s_12": ["s_12", "phi", "fuel flow"],
    "s_15": ["s_15", "bpr", "bypass ratio"],
    "vibration": ["vibration", "vibrationmms", "accelerometer", "imbalance", "misalignment"],
    "temperature": ["temperature", "temp", "overheating", "overheat", "thermal", "cooling"],
    "torque": ["torque", "torquenm", "power transmission"],
    "tool_wear": ["tool wear", "cutting insert", "flank wear", "twf", "overstrain"],
    "rul": ["rul", "remaining useful life", "life expectancy", "cycles to fail", "days to fail"]
}

COMPONENT_KEYWORDS = {
    "COMPRESSOR": ["compressor", "hpc", "lpc", "blade tip", "borescope", "fouling"],
    "TURBINE": ["turbine", "hpt", "lpt", "hot section", "egt margin", "nozzle guide vane"],
    "BEARING": ["bearing", "raceway", "bpfo", "bpfi", "bsf", "flaking", "micro-spalling"],
    "CUTTING_TOOL": ["tool", "insert", "toolholder", "feed rate", "machining"],
    "COOLING_SYSTEM": ["cooling", "coolant", "radiator", "heat dissipation", "hdf", "heat exchanger"]
}

class ProcessedQuery:
    def __init__(
        self,
        original_query: str,
        normalized_query: str,
        detected_machine_id: Optional[str] = None,
        detected_sensors: List[str] = None,
        detected_components: List[str] = None,
        is_machine_specific: bool = False
    ):
        self.original_query = original_query
        self.normalized_query = normalized_query
        self.detected_machine_id = detected_machine_id
        self.detected_sensors = detected_sensors or []
        self.detected_components = detected_components or []
        self.is_machine_specific = is_machine_specific

    def to_dict(self) -> Dict[str, Any]:
        return {
            "original_query": self.original_query,
            "normalized_query": self.normalized_query,
            "detected_machine_id": self.detected_machine_id,
            "detected_sensors": self.detected_sensors,
            "detected_components": self.detected_components,
            "is_machine_specific": self.is_machine_specific
        }

class QueryProcessor:
    def process_query(self, query: str, machine_id_context: Optional[str] = None) -> ProcessedQuery:
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

        # 4. Normalized query for search
        normalized = re.sub(r"[^\w\s\-\.\/]", " ", clean_text)
        normalized = re.sub(r"\s+", " ", normalized).strip()

        return ProcessedQuery(
            original_query=clean_text,
            normalized_query=normalized,
            detected_machine_id=detected_id,
            detected_sensors=detected_sensors,
            detected_components=detected_components,
            is_machine_specific=bool(detected_id)
        )

# Global singleton
query_processor = QueryProcessor()
