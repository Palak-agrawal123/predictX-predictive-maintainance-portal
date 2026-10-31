"""
Stage 5: Feature Engineering Layer
Extracts rolling temporal statistics (rm5, rm15, rstd10), healthy baseline drift,
and multi-regime standardized representations.
"""
from typing import Dict, Any, List, Optional
from collections import defaultdict, deque
import numpy as np
import pandas as pd


class FeatureEngineer:
    def __init__(self, baseline_cycles: int = 5):
        self.baseline_cycles = baseline_cycles
        # machine_id -> sensor_name -> deque of recent values (up to 30)
        self.temporal_history: Dict[str, Dict[str, deque]] = defaultdict(lambda: defaultdict(lambda: deque(maxlen=30)))
        # machine_id -> sensor_name -> baseline value
        self.baselines: Dict[str, Dict[str, float]] = defaultdict(dict)
        # machine_id -> count of processed cycles
        self.cycle_counts: Dict[str, int] = defaultdict(int)

    def process(self, machine_id: str, cycle: int, settings: Dict[str, float], sensors: Dict[str, float]) -> Dict[str, float]:
        """
        Calculates rolling features and drift for the single condition model (FD001/FD003).
        """
        features: Dict[str, float] = {}
        m_history = self.temporal_history[machine_id]
        m_baseline = self.baselines[machine_id]
        self.cycle_counts[machine_id] += 1
        count = self.cycle_counts[machine_id]

        features["cycle"] = float(cycle)
        features["setting_1"] = float(settings.get("setting_1", 0.0))
        features["setting_2"] = float(settings.get("setting_2", 0.0))

        # Informative sensors to extract statistics for
        informative_sensors = [
            "s_2", "s_3", "s_4", "s_6", "s_7", "s_8", "s_9",
            "s_11", "s_12", "s_13", "s_14", "s_15", "s_17", "s_20", "s_21"
        ]

        for s_key in informative_sensors:
            val = float(sensors.get(s_key, 0.0))
            features[s_key] = val
            buf = m_history[s_key]
            buf.append(val)

            # Establish initial healthy baseline during first few cycles
            if count <= self.baseline_cycles or s_key not in m_baseline:
                if s_key not in m_baseline:
                    m_baseline[s_key] = val
                else:
                    # Rolling average for baseline
                    m_baseline[s_key] = (m_baseline[s_key] * (count - 1) + val) / count

            # Baseline Drift
            features[f"{s_key}_drift"] = round(val - m_baseline[s_key], 4)

            # Rolling Mean 5
            arr_5 = list(buf)[-5:]
            features[f"{s_key}_rm5"] = round(float(np.mean(arr_5)), 4)

            # Rolling Mean 15
            arr_15 = list(buf)[-15:]
            features[f"{s_key}_rm15"] = round(float(np.mean(arr_15)), 4)

            # Rolling Std 10
            arr_10 = list(buf)[-10:]
            std_val = float(np.std(arr_10)) if len(arr_10) > 1 else 0.0
            features[f"{s_key}_rstd10"] = round(std_val, 4)

        return features

    def reset_machine(self, machine_id: str):
        if machine_id in self.temporal_history:
            del self.temporal_history[machine_id]
        if machine_id in self.baselines:
            del self.baselines[machine_id]
        if machine_id in self.cycle_counts:
            del self.cycle_counts[machine_id]
