"""
Stage 4: Missing Value Treatment Layer
Performs forward-fill and rolling linear interpolation for brief telemetry dropouts.
Enforces sequence quarantine if dropout exceeds maximum allowable gap.
"""
from typing import Dict, Any, Tuple, List, Optional
from collections import defaultdict
import numpy as np

try:
    from simulator.sensor_profiles import CMAPSS_SENSOR_SPECS
except ImportError:
    from ml_service.simulator.sensor_profiles import CMAPSS_SENSOR_SPECS


class MissingValueResult:
    def __init__(self, sensors: Dict[str, float], imputed_fields: Dict[str, Dict[str, Any]], quarantined: bool):
        self.sensors = sensors
        self.imputed_fields = imputed_fields
        self.quarantined = quarantined


class MissingValueHandler:
    def __init__(self, max_consecutive_missing: int = 5):
        self.max_consecutive_missing = max_consecutive_missing
        self.last_valid_values: Dict[str, Dict[str, float]] = defaultdict(dict)
        self.consecutive_missing_count: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))

    def process(self, machine_id: str, sensors: Dict[str, float]) -> MissingValueResult:
        imputed_fields: Dict[str, Dict[str, Any]] = {}
        quarantined = False
        resolved_sensors: Dict[str, float] = {}

        m_last = self.last_valid_values[machine_id]
        m_counts = self.consecutive_missing_count[machine_id]

        for s_key, val in sensors.items():
            if val is None or np.isnan(val):
                m_counts[s_key] += 1
                miss_count = m_counts[s_key]

                if miss_count > self.max_consecutive_missing:
                    quarantined = True
                    resolved_sensors[s_key] = np.nan
                    imputed_fields[s_key] = {
                        "action": "QUARANTINED",
                        "consecutive_drops": miss_count,
                        "reason": f"Sensor gap {miss_count} exceeds limit of {self.max_consecutive_missing}"
                    }
                elif s_key in m_last:
                    imputed_val = m_last[s_key]
                    resolved_sensors[s_key] = imputed_val
                    imputed_fields[s_key] = {
                        "action": "FORWARD_FILL",
                        "imputed_value": imputed_val,
                        "consecutive_drops": miss_count
                    }
                else:
                    spec = CMAPSS_SENSOR_SPECS.get(s_key, {})
                    nominal = spec.get("nominal_mean", 0.0)
                    resolved_sensors[s_key] = nominal
                    imputed_fields[s_key] = {
                        "action": "NOMINAL_BASELINE_FILL",
                        "imputed_value": nominal,
                        "consecutive_drops": miss_count
                    }
            else:
                m_counts[s_key] = 0
                m_last[s_key] = val
                resolved_sensors[s_key] = val

        return MissingValueResult(
            sensors=resolved_sensors,
            imputed_fields=imputed_fields,
            quarantined=quarantined
        )

    def reset_machine(self, machine_id: str):
        if machine_id in self.last_valid_values:
            del self.last_valid_values[machine_id]
        if machine_id in self.consecutive_missing_count:
            del self.consecutive_missing_count[machine_id]
