"""
Dataset Parser, Schema Analyzer & Model Compatibility Validator
Responsible for inspecting user-uploaded and pre-bundled sensor datasets (CSV),
extracting metadata, identifying candidate column roles (Machine ID, Cycle, Sensors, Settings, RUL),
and validating ML model compatibility.
"""
import os
import json
import time
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
import numpy as np
import pandas as pd


DATASETS_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "simulation_datasets"
MANIFEST_FILE = DATASETS_DIR / "manifest.json"


def ensure_manifest_exists() -> Dict[str, Any]:
    """
    Initializes and returns the dataset manifest, automatically discovering
    bundled NASA C-MAPSS validation datasets.
    """
    DATASETS_DIR.mkdir(parents=True, exist_ok=True)

    manifest = {"datasets": {}}
    if MANIFEST_FILE.exists():
        try:
            with open(MANIFEST_FILE, "r", encoding="utf-8") as f:
                manifest = json.load(f)
        except Exception as e:
            print(f"[Manifest Warning] Could not read manifest: {e}")
            manifest = {"datasets": {}}

    # Register pre-bundled datasets if present on disk
    bundled_files = [
        {
            "id": "cmapss_val_full_FD001",
            "name": "NASA C-MAPSS FD001 Validation Fleet",
            "filename": "cmapss_val_full_FD001.csv",
            "subset": "FD001",
            "is_bundled": True,
            "description": "Real NASA turbofan validation data (100 engines, single operating condition, HPC blade fault)."
        },
        {
            "id": "cmapss_val_full_FD002",
            "name": "NASA C-MAPSS FD002 Multi-Regime Fleet",
            "filename": "cmapss_val_full_FD002.csv",
            "subset": "FD002",
            "is_bundled": True,
            "description": "Real NASA turbofan validation data (259 engines, 6 operational flight regimes, HPC blade fault)."
        }
    ]

    for b in bundled_files:
        file_path = DATASETS_DIR / b["filename"]
        if file_path.exists() and b["id"] not in manifest.get("datasets", {}):
            manifest["datasets"][b["id"]] = {
                "id": b["id"],
                "name": b["name"],
                "filename": b["filename"],
                "path": str(file_path),
                "subset": b.get("subset", "FD001"),
                "size_bytes": file_path.stat().st_size,
                "is_bundled": True,
                "created_at": time.time(),
                "description": b["description"]
            }

    try:
        with open(MANIFEST_FILE, "w", encoding="utf-8") as f:
            json.dump(manifest, f, indent=2)
    except Exception as e:
        print(f"[Manifest Write Warning] {e}")

    return manifest


class DatasetAnalyzer:
    """
    Inspects dataset files, analyzes schema, computes stats, and determines ML model compatibility.
    """

    @staticmethod
    def inspect_file(file_path: Path) -> Dict[str, Any]:
        """
        Reads CSV header and records, analyzing columns, data types, missing values,
        candidate roles, and machine IDs.
        """
        if not file_path.exists():
            raise FileNotFoundError(f"Dataset file not found: {file_path}")

        # Read first 5000 rows for fast analysis of large datasets
        df_sample = pd.read_csv(file_path, nrows=5000)
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            total_rows = max(0, sum(1 for _ in f) - 1)

        columns = list(df_sample.columns)
        num_cols = list(df_sample.select_dtypes(include=[np.number]).columns)
        cat_cols = list(df_sample.select_dtypes(exclude=[np.number]).columns)

        missing_counts = {col: int(df_sample[col].isnull().sum()) for col in columns}
        duplicate_count = int(df_sample.duplicated().sum())

        # Auto-detect candidate roles
        role_candidates = DatasetAnalyzer._detect_column_roles(df_sample)

        # Detect available machine IDs
        machine_col = role_candidates.get("machine_id")
        unique_machines = []
        machine_stats = {}

        if machine_col and machine_col in df_sample.columns:
            unique_raw = df_sample[machine_col].dropna().unique().tolist()
            # Convert to strings or ints
            unique_machines = [int(m) if isinstance(m, (np.integer, int)) or (isinstance(m, float) and m.is_integer()) else str(m) for m in unique_raw][:100]

            # Compute cycle range for first few machines
            cycle_col = role_candidates.get("cycle")
            for m in unique_machines[:10]:
                sub = df_sample[df_sample[machine_col] == m]
                rec_count = len(sub)
                c_min = int(sub[cycle_col].min()) if cycle_col and cycle_col in sub.columns else 1
                c_max = int(sub[cycle_col].max()) if cycle_col and cycle_col in sub.columns else rec_count
                machine_stats[str(m)] = {
                    "records_count": rec_count,
                    "cycle_min": c_min,
                    "cycle_max": c_max
                }

        # Check model compatibility
        compatibility = DatasetAnalyzer.check_model_compatibility(df_sample, role_candidates)

        # Sample preview records (first 15 rows)
        sample_rows = df_sample.head(15).replace({np.nan: None}).to_dict(orient="records")

        # Basic numerical column distributions
        col_stats = {}
        for c in num_cols[:15]:
            col_stats[c] = {
                "min": float(df_sample[c].min()),
                "max": float(df_sample[c].max()),
                "mean": round(float(df_sample[c].mean()), 4),
                "std": round(float(df_sample[c].std()), 4) if not np.isnan(df_sample[c].std()) else 0.0
            }

        return {
            "total_rows": total_rows,
            "total_columns": len(columns),
            "columns": columns,
            "numerical_columns": num_cols,
            "categorical_columns": cat_cols,
            "missing_counts": missing_counts,
            "duplicate_count": duplicate_count,
            "role_candidates": role_candidates,
            "unique_machines": unique_machines,
            "machine_stats": machine_stats,
            "compatibility": compatibility,
            "sample_records": sample_rows,
            "column_distributions": col_stats
        }

    @staticmethod
    def _detect_column_roles(df: pd.DataFrame) -> Dict[str, Any]:
        """
        Infers machine ID, cycle, timestamp, settings, sensors, and ground-truth RUL columns.
        """
        cols_lower = {col.lower(): col for col in df.columns}
        candidates = {
            "machine_id": None,
            "cycle": None,
            "timestamp": None,
            "operational_settings": [],
            "sensors": [],
            "target_rul": None
        }

        # 1. Machine ID
        machine_patterns = ["unit_id", "machine_id", "engine_id", "unit", "machine", "asset_id", "device_id", "id"]
        for p in machine_patterns:
            if p in cols_lower:
                candidates["machine_id"] = cols_lower[p]
                break

        # 2. Cycle / Timestamp
        cycle_patterns = ["cycle", "cyclenumber", "step", "time_cycle", "operational_cycle", "epoch"]
        for p in cycle_patterns:
            if p in cols_lower:
                candidates["cycle"] = cols_lower[p]
                break

        time_patterns = ["timestamp", "time", "datetime", "date", "recorded_at"]
        for p in time_patterns:
            if p in cols_lower:
                candidates["timestamp"] = cols_lower[p]
                break

        # 3. Operational Settings
        settings = []
        for i in range(1, 4):
            for pattern in [f"setting_{i}", f"setting{i}", f"op_setting_{i}", f"operational_setting_{i}"]:
                if pattern in cols_lower:
                    settings.append(cols_lower[pattern])
                    break
        candidates["operational_settings"] = settings

        # 4. Sensors
        sensors = []
        for i in range(1, 22):
            for pattern in [f"s_{i}", f"s{i}", f"sensor_{i}", f"sensor{i}"]:
                if pattern in cols_lower:
                    sensors.append(cols_lower[pattern])
                    break

        # Fallback to general sensor columns if s_1..s_21 not found
        if not sensors:
            general_patterns = ["temp", "vibr", "press", "rpm", "speed", "flow", "volt", "curr", "torque"]
            for col in df.columns:
                col_l = col.lower()
                if any(p in col_l for p in general_patterns) and col not in [candidates["machine_id"], candidates["cycle"]]:
                    sensors.append(col)

        candidates["sensors"] = sensors

        # 5. Target / Ground-truth RUL
        rul_patterns = ["target_rul", "raw_rul", "rul", "actual_rul", "ground_truth_rul", "remaining_cycles"]
        for p in rul_patterns:
            if p in cols_lower:
                candidates["target_rul"] = cols_lower[p]
                break

        return candidates

    @staticmethod
    def check_model_compatibility(df: pd.DataFrame, roles: Dict[str, Any]) -> Dict[str, Any]:
        """
        Determines whether the dataset matches trained NASA C-MAPSS models
        (XGBoost / Random Forest for FD001, PyTorch Attention-BiLSTM for FD002/FD004)
        or represents a custom industrial dataset.
        """
        sensors = roles.get("sensors", [])
        settings = roles.get("operational_settings", [])
        has_cmapss_sensors = any(s.lower().startswith("s_") or s.lower().startswith("sensor_") for s in sensors)

        # Check C-MAPSS compatibility
        if len(sensors) >= 14 and has_cmapss_sensors:
            # Check flight regime variation (FD001 vs FD002)
            is_multi_regime = False
            if len(settings) >= 2:
                for set_col in settings[:2]:
                    if set_col in df.columns:
                        std_val = df[set_col].std()
                        if std_val > 1.0:
                            is_multi_regime = True
                            break

            if is_multi_regime:
                return {
                    "is_compatible": True,
                    "dataset_type": "NASA C-MAPSS Multi-Regime (FD002/FD004)",
                    "matched_subset": "FD002",
                    "model_recommended": "Attention-CNN-BiLSTM (PyTorch) + RegimeNormalizer",
                    "window_size_required": 30,
                    "features_count": len(sensors),
                    "status_code": "COMPATIBLE_FD002",
                    "badge_text": "Compatible with Attention-CNN-BiLSTM (FD002)",
                    "badge_color": "emerald",
                    "message": "Dataset conforms to NASA C-MAPSS 6-regime schema. Supports live inference via Attention-CNN-BiLSTM with 30-cycle temporal window."
                }
            else:
                return {
                    "is_compatible": True,
                    "dataset_type": "NASA C-MAPSS Single-Condition (FD001/FD003)",
                    "matched_subset": "FD001",
                    "model_recommended": "XGBoost Regressor (FD001)",
                    "window_size_required": 1,
                    "features_count": len(sensors),
                    "status_code": "COMPATIBLE_FD001",
                    "badge_text": "Compatible with XGBoost (FD001)",
                    "badge_color": "emerald",
                    "message": "Dataset conforms to NASA C-MAPSS single-condition schema. Supports live inference via XGBoost Regressor (78 engineered features)."
                }
        else:
            # Custom industrial dataset
            return {
                "is_compatible": False,
                "dataset_type": "Custom Industrial Telemetry (Non-CMAPSS)",
                "matched_subset": "CUSTOM",
                "model_recommended": "Industrial Sensor Adapter Required",
                "window_size_required": 1,
                "features_count": len(sensors),
                "status_code": "CUSTOM_INDUSTRIAL",
                "badge_text": "Custom Industrial Schema (Adapter Required)",
                "badge_color": "amber",
                "message": (
                    "Custom industrial dataset detected. Pre-trained C-MAPSS Attention-BiLSTM and XGBoost models "
                    "expect NASA turbofan aerodynamic measurements (s_1 to s_21). Replay and 5-stage cleaning pipeline "
                    "will run in full, but RUL prediction requires sensor mapping or a custom model head."
                )
            }


# Singleton helper instance
dataset_analyzer = DatasetAnalyzer()
