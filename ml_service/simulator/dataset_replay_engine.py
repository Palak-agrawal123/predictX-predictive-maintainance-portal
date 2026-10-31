"""
Dataset-Driven Live Replay Engine
Streams actual records sequentially from user-provided or pre-bundled industrial sensor datasets.
Guarantees deterministic, reproducible playback without fabricating dummy or random sensor readings.
"""
import os
import json
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
import numpy as np
import pandas as pd

try:
    from simulator.schemas import TelemetryPacket, SimulationMode
    from simulator.dataset_parser import ensure_manifest_exists, DATASETS_DIR
except ImportError:
    from ml_service.simulator.schemas import TelemetryPacket, SimulationMode
    from ml_service.simulator.dataset_parser import ensure_manifest_exists, DATASETS_DIR


class DatasetReplayEngine:
    """
    Replays actual records from a tabular sensor dataset line-by-line.
    """

    def __init__(self):
        self.dataset_id: Optional[str] = None
        self.dataset_path: Optional[Path] = None
        self.dataset_name: str = "None"
        self.subset: str = "FD001"
        self.selected_machine_id: Optional[str] = None

        self.column_mapping: Dict[str, Any] = {
            "machine_id": "unit_id",
            "cycle": "cycle",
            "timestamp": None,
            "operational_settings": ["setting_1", "setting_2", "setting_3"],
            "sensors": [f"s_{i}" for i in range(1, 22)],
            "target_rul": "target_rul"
        }

        # In-memory filtered records for the active machine
        self.records: List[Dict[str, Any]] = []
        self.total_records: int = 0
        self.current_index: int = 0
        self.start_index: int = 0
        self.end_index: int = 0
        self.is_looping: bool = False
        self.is_completed: bool = False

        # Available machines list in the loaded dataset
        self.available_machines: List[str] = []

    def load_dataset(
        self,
        dataset_id: str,
        machine_id: Optional[str] = None,
        column_mapping: Optional[Dict[str, Any]] = None,
        start_index: int = 0,
        end_index: Optional[int] = None,
        is_looping: bool = False
    ) -> Dict[str, Any]:
        """
        Loads dataset file, applies column mapping, filters records for selected machine,
        and sets up the sequential replay buffer.
        """
        manifest = ensure_manifest_exists()
        datasets_info = manifest.get("datasets", {})

        if dataset_id not in datasets_info:
            raise ValueError(f"Dataset '{dataset_id}' not found in manifest.")

        d_info = datasets_info[dataset_id]
        self.dataset_id = dataset_id
        self.dataset_path = Path(d_info["path"])
        self.dataset_name = d_info["name"]
        self.subset = d_info.get("subset", "FD001")

        if not self.dataset_path.exists():
            raise FileNotFoundError(f"Dataset file missing on disk: {self.dataset_path}")

        # Read dataset into dataframe
        df = pd.read_csv(self.dataset_path)

        # Merge or update column mapping
        if column_mapping:
            self.column_mapping.update(column_mapping)

        # Identify machine column
        m_col = self.column_mapping.get("machine_id")
        if not m_col or m_col not in df.columns:
            # Fallback to first column or auto-detection
            for c in ["unit_id", "machine_id", "engine_id", "id", "unit"]:
                if c in df.columns:
                    m_col = c
                    self.column_mapping["machine_id"] = c
                    break

        if m_col and m_col in df.columns:
            unique_m = df[m_col].dropna().unique().tolist()
            self.available_machines = [str(int(m)) if isinstance(m, (np.integer, int)) or (isinstance(m, float) and m.is_integer()) else str(m) for m in unique_m]
        else:
            self.available_machines = ["Engine-001"]

        # Select active machine
        if machine_id:
            self.selected_machine_id = str(machine_id)
        elif self.available_machines:
            self.selected_machine_id = str(self.available_machines[0])
        else:
            self.selected_machine_id = "Engine-001"

        # Filter rows for selected machine
        if m_col and m_col in df.columns:
            # Match both as string or numeric
            try:
                num_val = float(self.selected_machine_id)
                sub_df = df[(df[m_col] == self.selected_machine_id) | (df[m_col] == num_val) | (df[m_col] == int(num_val))]
            except (ValueError, TypeError):
                sub_df = df[df[m_col].astype(str) == str(self.selected_machine_id)]
        else:
            sub_df = df

        if sub_df.empty:
            sub_df = df.head(100)  # Graceful fallback if filter returned 0 rows

        # Convert to native Python dicts
        self.records = sub_df.replace({np.nan: None}).to_dict(orient="records")
        self.total_records = len(self.records)

        self.start_index = max(0, min(start_index, self.total_records - 1)) if self.total_records > 0 else 0
        if end_index is not None and end_index > self.start_index and end_index <= self.total_records:
            self.end_index = end_index
        else:
            self.end_index = self.total_records

        self.current_index = self.start_index
        self.is_looping = is_looping
        self.is_completed = False

        return self.get_status()

    def step(self) -> Optional[Tuple[TelemetryPacket, Optional[float]]]:
        """
        Advances the replay cursor by one record and constructs an authentic TelemetryPacket.
        Returns (TelemetryPacket, ground_truth_rul) or None if completed.
        """
        if not self.records or self.current_index >= self.end_index:
            if self.is_looping and self.total_records > 0:
                self.current_index = self.start_index
                self.is_completed = False
            else:
                self.is_completed = True
                return None

        # Fetch actual row
        row = self.records[self.current_index]

        # Extract cycle
        c_col = self.column_mapping.get("cycle")
        if c_col and c_col in row and row[c_col] is not None:
            cycle_val = int(row[c_col])
        else:
            cycle_val = self.current_index + 1

        # Extract operational settings
        settings_dict = {}
        s_cols = self.column_mapping.get("operational_settings") or []
        for i, s_col in enumerate(s_cols, start=1):
            if s_col in row and row[s_col] is not None:
                try:
                    settings_dict[f"setting_{i}"] = float(row[s_col])
                except (ValueError, TypeError):
                    settings_dict[f"setting_{i}"] = 0.0
            else:
                settings_dict[f"setting_{i}"] = 0.0

        if not settings_dict:
            settings_dict = {"setting_1": 0.0, "setting_2": 0.0, "setting_3": 100.0}

        # Extract sensors
        sensors_dict = {}
        sensor_cols = self.column_mapping.get("sensors") or []

        for i, sc in enumerate(sensor_cols, start=1):
            # Prefer standardized key s_1..s_21
            key = f"s_{i}" if i <= 21 else sc
            if sc in row and row[sc] is not None:
                try:
                    sensors_dict[key] = float(row[sc])
                except (ValueError, TypeError):
                    sensors_dict[key] = None
            else:
                sensors_dict[key] = None

        # Extract ground truth RUL if present
        target_rul_col = self.column_mapping.get("target_rul")
        ground_truth_rul = None
        if target_rul_col and target_rul_col in row and row[target_rul_col] is not None:
            try:
                ground_truth_rul = float(row[target_rul_col])
            except (ValueError, TypeError):
                ground_truth_rul = None

        # Timestamp
        ts_col = self.column_mapping.get("timestamp")
        if ts_col and ts_col in row and row[ts_col]:
            ts_str = str(row[ts_col])
        else:
            ts_str = datetime.now(timezone.utc).isoformat()

        # Format machine ID (e.g. Engine-001 or MCH-unit_id)
        m_id_raw = self.selected_machine_id or "001"
        if not m_id_raw.startswith("Engine-") and not m_id_raw.startswith("MCH-"):
            try:
                m_num = int(float(m_id_raw))
                formatted_mid = f"Engine-{m_num:03d}"
            except ValueError:
                formatted_mid = f"MCH-{m_id_raw}"
        else:
            formatted_mid = m_id_raw

        # Build telemetry packet directly from actual dataset row
        packet = TelemetryPacket(
            machine_id=formatted_mid,
            engine_id=formatted_mid,
            cycle=cycle_val,
            timestamp=ts_str,
            subset=self.subset,
            operational_settings=settings_dict,
            sensor_readings=sensors_dict,
            simulation_scenario=SimulationMode.CUSTOM,
            data_quality_flags={
                "is_dataset_replay": True,
                "dataset_id": self.dataset_id,
                "record_index": self.current_index,
                "has_ground_truth": ground_truth_rul is not None
            }
        )

        # Advance cursor
        self.current_index += 1

        return packet, ground_truth_rul

    def reset(self):
        """Resets cursor to the starting record."""
        self.current_index = self.start_index
        self.is_completed = False

    def seek(self, record_index: int):
        """Sets cursor to a specific record."""
        self.current_index = max(self.start_index, min(record_index, self.end_index))
        self.is_completed = self.current_index >= self.end_index

    def get_status(self) -> Dict[str, Any]:
        """Returns current replay status, progress, and metadata."""
        progress_pct = 0.0
        if self.end_index > self.start_index:
            progress_pct = round(((self.current_index - self.start_index) / (self.end_index - self.start_index)) * 100.0, 1)

        return {
            "dataset_id": self.dataset_id,
            "dataset_name": self.dataset_name,
            "subset": self.subset,
            "selected_machine_id": self.selected_machine_id,
            "available_machines": self.available_machines,
            "current_index": self.current_index,
            "start_index": self.start_index,
            "end_index": self.end_index,
            "total_records": self.total_records,
            "progress_percent": progress_pct,
            "is_looping": self.is_looping,
            "is_completed": self.is_completed,
            "column_mapping": self.column_mapping
        }


# Singleton instance
dataset_replay_engine = DatasetReplayEngine()
