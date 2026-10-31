"""
Stage 6: Model-Compatible Transformation Layer
Transforms cleaned sensor streams into exact input shapes and column orders
expected by trained XGBoost, Random Forest, and Attention-CNN-BiLSTM models.
"""
from typing import Dict, Any, List, Optional, Tuple
from pathlib import Path
from collections import defaultdict, deque
import numpy as np
import pandas as pd
import joblib
import torch


class ModelTransformer:
    def __init__(self, models_dir: Path):
        self.models_dir = Path(models_dir)
        self.normalizers: Dict[str, Any] = {}
        self.feature_schemas: Dict[str, List[str]] = {}
        # machine_id -> deque of recent (settings + sensors) records
        self.sequence_buffers: Dict[str, deque] = defaultdict(lambda: deque(maxlen=40))
        self._load_schemas_and_normalizers()

    def _load_schemas_and_normalizers(self):
        # 1. Load FD001 schema
        meta_fd001 = self.models_dir / "metadata_FD001.json"
        if meta_fd001.exists():
            import json
            with open(meta_fd001, "r") as f:
                self.feature_schemas["FD001"] = json.load(f).get("feature_cols", [])

        # 2. Load FD003 schema
        meta_fd003 = self.models_dir / "metadata_FD003.json"
        if meta_fd003.exists():
            import json
            with open(meta_fd003, "r") as f:
                self.feature_schemas["FD003"] = json.load(f).get("feature_cols", [])

        # 3. Load RegimeNormalizers for FD002 and FD004
        for sub in ["FD002", "FD004"]:
            norm_path = self.models_dir / f"regime_normalizer_{sub}.joblib"
            if norm_path.exists():
                try:
                    self.normalizers[sub] = joblib.load(norm_path)
                except Exception as ex:
                    print(f"[ModelTransformer] Normalizer load note for {sub}: {ex}")

    def transform_fd001_tabular(self, engineered_features: Dict[str, float]) -> pd.DataFrame:
        """
        Formats single-condition engineered features into a 1-row DataFrame
        strictly adhering to the 78 features expected by xgb_regressor_FD001.
        """
        cols = self.feature_schemas.get("FD001")
        if not cols:
            # Fallback standard columns
            cols = list(engineered_features.keys())

        row = {}
        for c in cols:
            row[c] = float(engineered_features.get(c, 0.0))

        return pd.DataFrame([row], columns=cols)

    def transform_fd003_tabular(self, engineered_features: Dict[str, float]) -> pd.DataFrame:
        cols = self.feature_schemas.get("FD003", list(engineered_features.keys()))
        row = {c: float(engineered_features.get(c, 0.0)) for c in cols}
        return pd.DataFrame([row], columns=cols)

    def append_sequence_observation(self, machine_id: str, cycle: int, settings: Dict[str, float], sensors: Dict[str, float]):
        record = {
            "cycle": cycle,
            "setting_1": float(settings.get("setting_1", 0.0)),
            "setting_2": float(settings.get("setting_2", 0.0)),
            "setting_3": float(settings.get("setting_3", 100.0)),
            **{k: float(v) for k, v in sensors.items()}
        }
        self.sequence_buffers[machine_id].append(record)

    def transform_multiregime_window(
        self,
        machine_id: str,
        subset: str = "FD002",
        window_size: int = 30
    ) -> Tuple[Optional[torch.Tensor], Optional[pd.DataFrame]]:
        """
        Transforms accumulated sequence into a normalized 3D tensor (1, window_size, 17)
        for Attention-CNN-BiLSTM, and tabular last-cycle feature row for XGBoost.
        """
        buf = self.sequence_buffers[machine_id]
        if not buf:
            return None, None

        normalizer = self.normalizers.get(subset)
        if not normalizer:
            return None, None

        # Build raw DataFrame from window
        records = list(buf)
        df_raw = pd.DataFrame(records)

        # Standardize via RegimeNormalizer
        df_norm = normalizer.transform(df_raw)

        # Apply EMA smoothing over active normalized sensors
        active_norm_cols = [f"{s}_norm" for s in normalizer.active_sensors]
        for c in active_norm_cols:
            df_norm[f"{c}_ema"] = df_norm[c].ewm(span=5).mean()

        feature_cols = [f"{c}_ema" for c in active_norm_cols]

        # Extract sequence window
        vals = df_norm[feature_cols].values
        n = len(vals)

        if n >= window_size:
            seq_window = vals[-window_size:]
        else:
            # Pad with repeat of first cycle observation
            pad = np.repeat(vals[0:1], window_size - n, axis=0)
            seq_window = np.vstack([pad, vals])

        # (1, seq_len, input_dim)
        tensor_seq = torch.tensor(seq_window, dtype=torch.float32).unsqueeze(0)
        tabular_last = df_norm[feature_cols].iloc[[-1]]

        return tensor_seq, tabular_last

    def reset_machine(self, machine_id: str):
        if machine_id in self.sequence_buffers:
            del self.sequence_buffers[machine_id]
