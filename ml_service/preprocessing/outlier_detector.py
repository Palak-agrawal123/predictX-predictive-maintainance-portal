"""
Stage 3: Outlier Detection Layer
Detects spurious telemetry spikes using statistical IQR and rolling Z-score.
Differentiates between transient sensor spikes and progressive machine wear.
"""
from typing import Dict, Any, Tuple, List, Optional
from collections import defaultdict, deque
import numpy as np


class OutlierDetectionResult:
    def __init__(self, cleaned_sensors: Dict[str, float], outliers_found: Dict[str, Dict[str, Any]]):
        self.cleaned_sensors = cleaned_sensors
        self.outliers_found = outliers_found # sensor -> {raw_val, corrected_val, reason, z_score}


class OutlierDetector:
    def __init__(self, window_size: int = 15, z_threshold: float = 3.0, iqr_multiplier: float = 1.5):
        self.window_size = window_size
        self.z_threshold = z_threshold
        self.iqr_multiplier = iqr_multiplier
        # machine_id -> sensor_name -> deque of recent values
        self.history_buffers: Dict[str, Dict[str, deque]] = defaultdict(lambda: defaultdict(lambda: deque(maxlen=window_size)))

    def process(self, machine_id: str, sensors: Dict[str, float]) -> OutlierDetectionResult:
        cleaned: Dict[str, float] = {}
        outliers: Dict[str, Dict[str, Any]] = {}
        m_buffers = self.history_buffers[machine_id]

        for s_key, val in sensors.items():
            if val is None or np.isnan(val):
                cleaned[s_key] = val
                continue

            buf = m_buffers[s_key]
            is_outlier = False
            corrected_val = val
            reason = ""
            z_score = 0.0

            # Only evaluate statistical outlier detection once buffer has sufficient history
            if len(buf) >= 6:
                arr = np.array(list(buf))
                mean_val = float(np.mean(arr))
                std_val = float(np.std(arr))

                # 1. Z-Score check
                if std_val > 1e-4:
                    z_score = abs(val - mean_val) / std_val
                    if z_score > self.z_threshold:
                        is_outlier = True
                        reason = f"Z-score {z_score:.2f} > {self.z_threshold}"

                # 2. IQR check
                q75, q25 = np.percentile(arr, [75, 25])
                iqr = q75 - q25
                if iqr > 1e-4:
                    lower_bound = q25 - (self.iqr_multiplier * iqr)
                    upper_bound = q75 + (self.iqr_multiplier * iqr)
                    if val < lower_bound or val > upper_bound:
                        is_outlier = True
                        reason = reason or f"Value outside IQR range [{lower_bound:.2f}, {upper_bound:.2f}]"

                if is_outlier:
                    # Robust correction: clamp to rolling median
                    median_val = float(np.median(arr))
                    corrected_val = round(median_val, 4)
                    outliers[s_key] = {
                        "raw_value": val,
                        "corrected_value": corrected_val,
                        "reason": reason,
                        "z_score": round(z_score, 2)
                    }

            # Update rolling history (use corrected value to avoid corrupting future baseline)
            buf.append(corrected_val if is_outlier else val)
            cleaned[s_key] = corrected_val

        return OutlierDetectionResult(cleaned_sensors=cleaned, outliers_found=outliers)

    def reset_machine(self, machine_id: str):
        if machine_id in self.history_buffers:
            del self.history_buffers[machine_id]
