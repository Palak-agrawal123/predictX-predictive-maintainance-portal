"""
Stage 2: Noise Reduction Layer
Applies Exponential Moving Average (EMA), Rolling Mean, and Median filtering
to attenuate transient measurement jitter while preserving physical degradation trends.
"""
from typing import Dict, Any, Optional
from collections import defaultdict, deque
import numpy as np


class NoiseFilter:
    def __init__(self, ema_alpha: float = 0.35, window_size: int = 5):
        """
        ema_alpha: smoothing factor between 0.0 and 1.0 (higher = more reactive, lower = smoother).
        window_size: rolling window depth.
        """
        self.alpha = ema_alpha
        self.window_size = window_size
        # machine_id -> sensor_name -> float (latest smoothed EMA)
        self.ema_state: Dict[str, Dict[str, float]] = defaultdict(dict)
        # machine_id -> sensor_name -> deque of recent values
        self.rolling_buffers: Dict[str, Dict[str, deque]] = defaultdict(lambda: defaultdict(lambda: deque(maxlen=window_size)))

    def apply_filter(self, machine_id: str, sensors: Dict[str, float]) -> Dict[str, float]:
        """
        Applies EMA smoothing to each sensor measurement for the given machine.
        """
        filtered: Dict[str, float] = {}
        m_ema = self.ema_state[machine_id]
        m_buffers = self.rolling_buffers[machine_id]

        for s_key, val in sensors.items():
            if val is None or np.isnan(val):
                # Cannot smooth NaN, return as-is for missing value handler
                filtered[s_key] = val
                continue

            # Update rolling buffer
            m_buffers[s_key].append(val)

            # Compute EMA
            if s_key not in m_ema:
                m_ema[s_key] = val
            else:
                m_ema[s_key] = (self.alpha * val) + ((1.0 - self.alpha) * m_ema[s_key])

            filtered[s_key] = round(float(m_ema[s_key]), 4)

        return filtered

    def get_rolling_median(self, machine_id: str, sensor_key: str) -> Optional[float]:
        buf = self.rolling_buffers[machine_id].get(sensor_key)
        if buf and len(buf) > 0:
            valid_vals = [v for v in buf if v is not None and not np.isnan(v)]
            if valid_vals:
                return float(np.median(valid_vals))
        return None

    def reset_machine(self, machine_id: str):
        if machine_id in self.ema_state:
            del self.ema_state[machine_id]
        if machine_id in self.rolling_buffers:
            del self.rolling_buffers[machine_id]
