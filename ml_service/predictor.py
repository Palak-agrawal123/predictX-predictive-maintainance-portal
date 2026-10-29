"""
Meridian Predictive Maintenance ML Predictor
Updated to load the newly trained models from 'Updated_Models/' (XGBoost Regressor & Random Forest)
with full multi-subdataset benchmark metadata and root-cause failure diagnostics.
"""
import os
import json
from pathlib import Path
from typing import Dict, Any, Optional
import numpy as np
import pandas as pd
import joblib

CURRENT_DIR = Path(__file__).resolve().parent
MODELS_DIR = CURRENT_DIR / "models"
if not (MODELS_DIR / "xgb_regressor_FD001.joblib").exists():
    MODELS_DIR = CURRENT_DIR / "Updated_Models"
if not (MODELS_DIR / "xgb_regressor_FD001.joblib").exists():
    MODELS_DIR = CURRENT_DIR.parent / "Updated_Models"

class MLPredictor:
    def __init__(self, models_dir: Path = MODELS_DIR):
        self.models_dir = Path(models_dir)
        self.is_loaded = False
        self.load_models()

    def load_models(self):
        try:
            # 1. Load Primary Updated Models from models directory
            xgb_path = self.models_dir / "xgb_regressor_FD001.joblib"
            rf_path = self.models_dir / "rf_regressor_FD001.joblib"
            summary_path = self.models_dir / "all_subsets_benchmark_summary.json"
            meta_path = self.models_dir / "metadata_FD001.json"

            if xgb_path.exists():
                self.xgb_pkg = joblib.load(xgb_path)
                self.rf_pkg = joblib.load(rf_path)
                self.regressor = self.xgb_pkg["model"]
                self.rf_regressor = self.rf_pkg["model"]
                self.feature_names = self.xgb_pkg["feature_cols"]
                self.constant_cols = self.xgb_pkg.get("constant_cols", [])

                if summary_path.exists():
                    with open(summary_path, "r") as f:
                        self.all_subsets_summary = json.load(f)
                else:
                    self.all_subsets_summary = {}

                if meta_path.exists():
                    with open(meta_path, "r") as f:
                        self.metadata = json.load(f)
                else:
                    self.metadata = {}

                self.metrics = self.metadata.get("models", {}).get("XGBoost", {})
                self.model_version = "meridian-updated-xgb-v2.0"
                print(f"[MLPredictor] Loaded newly trained models successfully from {self.models_dir}")
            else:
                raise FileNotFoundError(f"Model file not found at {xgb_path}")

            # 2. Multi-regime Attention-CNN-BiLSTM and RegimeNormalizer models (FD002 and FD004)
            self.multiregime_models = {}
            for sub in ["FD002", "FD004"]:
                bilstm_path = self.models_dir / f"best_attention_cnn_bilstm_{sub}.pt"
                norm_path = self.models_dir / f"regime_normalizer_{sub}.joblib"
                xgb_reg_path = self.models_dir / f"xgb_regime_{sub}.joblib"

                entry = {}
                if norm_path.exists():
                    entry["normalizer"] = joblib.load(norm_path)
                if xgb_reg_path.exists():
                    entry["xgb_regime"] = joblib.load(xgb_reg_path)
                if bilstm_path.exists():
                    try:
                        import torch
                        from model_architectures import AttentionCNNBiLSTM
                        bilstm_net = AttentionCNNBiLSTM(input_dim=17)
                        bilstm_net.load_state_dict(torch.load(bilstm_path, map_location="cpu"))
                        bilstm_net.eval()
                        entry["bilstm"] = bilstm_net
                    except Exception as ex:
                        print(f"[MLPredictor] Attention-CNN-BiLSTM init note for {sub}: {ex}")

                if entry:
                    self.multiregime_models[sub] = entry
            if self.multiregime_models:
                print(f"[MLPredictor] Loaded Attention-CNN-BiLSTM and RegimeNormalizer models for: {list(self.multiregime_models.keys())}")

            # Precomputed fleet predictions if available
            self.fleet_predictions = {}
            fleet_path = self.models_dir / "fleet_predictions.json"
            if fleet_path.exists():
                with open(fleet_path, "r") as f:
                    fleet_list = json.load(f)
                    for item in fleet_list:
                        self.fleet_predictions[item.get("unit_id")] = item

            # Summary stats
            self.summary_stats = {
                "total_subsets": 4,
                "subsets_evaluated": ["FD001", "FD002", "FD003", "FD004"],
                "active_model": "XGBoost Regressor (FD001 Single Regime)",
                "multiregime_model": "Attention-CNN-BiLSTM (FD002 and FD004 Multi-Regime)",
                "fd001_metrics": self.metrics,
                "fd002_metrics": self.all_subsets_summary.get("FD002", {}).get("models", {}).get("Attention_CNN_BiLSTM", {}),
                "fd004_metrics": self.all_subsets_summary.get("FD004", {}).get("models", {}).get("Attention_CNN_BiLSTM", {})
            }

            self.is_loaded = True
        except Exception as e:
            print(f"[MLPredictor Error] Failed to load models: {e}")
            raise e

    def build_feature_dataframe(self, sensors: Dict[str, Any]) -> pd.DataFrame:
        """
        Constructs a 1-row DataFrame matching the 78 features expected by the new model.
        """
        # Baseline healthy operating defaults for informative sensors
        defaults = {
            "cycle": 100.0,
            "setting_1": 0.0,
            "setting_2": 0.0,
            "s_2": 642.68,
            "s_3": 1590.52,
            "s_4": 1408.93,
            "s_6": 21.61,
            "s_7": 553.37,
            "s_8": 2388.10,
            "s_9": 9065.24,
            "s_11": 47.54,
            "s_12": 521.66,
            "s_13": 2388.10,
            "s_14": 8143.76,
            "s_15": 8.44,
            "s_17": 393.20,
            "s_20": 38.81,
            "s_21": 23.29
        }

        row = {}
        for col in self.feature_names:
            if col in defaults:
                row[col] = defaults[col]
            else:
                row[col] = 0.0

        # Update raw sensors if passed in directly
        for feat in self.feature_names:
            if feat in sensors and sensors[feat] is not None:
                try:
                    row[feat] = float(sensors[feat])
                except (ValueError, TypeError):
                    pass

        # Industrial sensor telemetry mapping
        air_temp = sensors.get("airTemperature") or sensors.get("airTempKelvin")
        proc_temp = sensors.get("processTemperature") or sensors.get("processTempKelvin")
        speed = sensors.get("rotationalSpeed") or sensors.get("rotationalSpeedRpm")
        torque = sensors.get("torque") or sensors.get("torqueNm")
        tool_wear = sensors.get("toolWear") or sensors.get("toolWearMinutes")
        vibration = sensors.get("vibration") or sensors.get("vibrationMmS")
        cycle = sensors.get("cycle")

        if cycle is not None:
            try:
                row["cycle"] = float(cycle)
            except (ValueError, TypeError):
                pass

        if any(v is not None for v in [air_temp, proc_temp, speed, torque, tool_wear, vibration]):
            tool_wear_val = float(tool_wear or 0.0)
            vibration_val = float(vibration or 2.0)
            torque_val = float(torque or 40.0)
            speed_val = float(speed or 1500.0)
            air_temp_val = float(air_temp or 300.0)
            proc_temp_val = float(proc_temp or 310.0)
            temp_diff = proc_temp_val - air_temp_val

            wear_ratio = min(1.3, max(0.0, tool_wear_val / 220.0))
            vib_ratio = min(2.0, max(0.0, vibration_val / 4.5))
            temp_stress = min(2.0, max(0.0, (temp_diff - 8.6) / 10.0))

            row["cycle"] = max(row["cycle"], 50.0 + wear_ratio * 160.0)

            # Thermal exhaust elevation
            row["s_4"] += (temp_stress * 18.0) + (wear_ratio * 15.0)
            row["s_4_rm5"] = row["s_4"]
            row["s_4_rm15"] = row["s_4"]
            row["s_4_drift"] = (temp_stress * 10.0) + (wear_ratio * 12.0)

            # Core compressor temp
            row["s_3"] += (wear_ratio * 14.0) + (temp_stress * 8.0)
            row["s_3_rm5"] = row["s_3"]
            row["s_3_rm15"] = row["s_3"]
            row["s_3_drift"] = wear_ratio * 10.0

            # Static pressure & flutter
            row["s_11"] += wear_ratio * 0.35
            row["s_11_rm5"] = row["s_11"]
            row["s_11_rm15"] = row["s_11"]
            row["s_11_drift"] = wear_ratio * 0.40

            # Vibration flutter
            if vib_ratio > 1.0:
                row["s_4_rstd10"] = max(row.get("s_4_rstd10", 0.0), (vib_ratio - 1.0) * 4.0)
                row["s_11_rstd10"] = max(row.get("s_11_rstd10", 0.0), (vib_ratio - 1.0) * 0.1)

        df = pd.DataFrame([row], columns=self.feature_names)
        return df

    def predict(self, machine_id: str, sensors: Dict[str, Any], metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Runs prediction using the newly trained XGBoost model from Updated_Models.
        """
        clean_id = str(machine_id).strip().upper()
        unit_match = None
        if clean_id.startswith("UNIT-"):
            try:
                u_num = int(clean_id.replace("UNIT-", ""))
                unit_match = self.fleet_predictions.get(u_num)
            except ValueError:
                pass
        elif clean_id.isdigit():
            unit_match = self.fleet_predictions.get(int(clean_id))

        if unit_match and len(sensors) <= 1:
            pred_rul = unit_match["predicted_rul"]
            risk_prob = unit_match["failure_probability"] / 100.0
            risk_level = unit_match["risk_tier"].lower()
            health_score = max(0, min(100, int(100 - unit_match["risk_score_pct"])))
            failure_mode = unit_match["primary_component"]
            recommendation = unit_match["recommended_action"]
            confidence = unit_match["component_confidence"] / 100.0
        else:
            df_features = self.build_feature_dataframe(sensors)
            pred_rul_arr = self.regressor.predict(df_features)
            pred_rul = float(np.clip(pred_rul_arr[0], a_min=1.0, a_max=125.0))

            # Domain failure triggers
            air_temp = float(sensors.get("airTemperature") or sensors.get("airTempKelvin") or 300.0)
            proc_temp = float(sensors.get("processTemperature") or sensors.get("processTempKelvin") or 310.0)
            speed_val = float(sensors.get("rotationalSpeed") or sensors.get("rotationalSpeedRpm") or 1500.0)
            torque_val = float(sensors.get("torque") or sensors.get("torqueNm") or 40.0)
            tool_wear_val = float(sensors.get("toolWear") or sensors.get("toolWearMinutes") or 0.0)
            vibration_val = float(sensors.get("vibration") or sensors.get("vibrationMmS") or 1.8)
            temp_diff = proc_temp - air_temp
            power_watts = torque_val * (speed_val * (2.0 * np.pi / 60.0))

            # Raw risk probability mapped from RUL
            if pred_rul <= 15:
                raw_prob = 0.95
            elif pred_rul <= 30:
                raw_prob = 0.82
            elif pred_rul <= 50:
                raw_prob = 0.55
            elif pred_rul <= 85:
                raw_prob = 0.28
            else:
                raw_prob = 0.05

            physics_risk = 0.05
            if temp_diff < 8.6 and speed_val < 1380:
                physics_risk = max(physics_risk, 0.82)
            if power_watts < 3500 or power_watts > 9000:
                physics_risk = max(physics_risk, 0.88)
            if tool_wear_val >= 220:
                physics_risk = max(physics_risk, 0.95)
            elif tool_wear_val >= 180:
                physics_risk = max(physics_risk, 0.65)
            if tool_wear_val * torque_val > 11000:
                physics_risk = max(physics_risk, 0.90)
            if vibration_val > 4.5:
                physics_risk = max(physics_risk, 0.78)

            risk_prob = max(raw_prob, physics_risk)

            if risk_prob >= 0.80:
                pred_rul = min(pred_rul, max(1.0, round(5.0 * (1.0 - risk_prob), 1)))
            elif risk_prob >= 0.50:
                pred_rul = min(pred_rul, round(14.0 * (1.0 - risk_prob) + 5.0, 1))

            risk_prob = round(float(np.clip(risk_prob, 0.01, 0.99)), 3)

            if risk_prob >= 0.80 or pred_rul <= 25:
                risk_level = "critical"
            elif risk_prob >= 0.50 or pred_rul <= 50:
                risk_level = "high"
            elif risk_prob >= 0.25 or pred_rul <= 85:
                risk_level = "medium"
            else:
                risk_level = "low"

            health_score = max(0, min(100, int((1.0 - risk_prob) * 100)))
            failure_mode, recommendation = self._diagnose_failure(sensors, pred_rul, risk_level)
            confidence = 0.95 if risk_level in ["critical", "high"] else 0.91

        return {
            "success": True,
            "machineId": clean_id,
            "predictionType": "failure_risk_classification",
            "modelVersion": self.model_version,
            "isMock": False,
            "executionSource": "ml_service_fastapi",
            "prediction": {
                "riskProbability": risk_prob,
                "riskLevel": risk_level,
                "healthScore": health_score,
                "estimatedRULDays": int(round(pred_rul)),
                "suspectedFailureMode": failure_mode,
                "recommendedAction": recommendation,
                "confidence": confidence
            }
        }

    def _diagnose_failure(self, sensors: Dict[str, Any], pred_rul: float, risk_level: str) -> tuple[str, str]:
        tool_wear = float(sensors.get("toolWear") or sensors.get("toolWearMinutes") or 0.0)
        torque = float(sensors.get("torque") or sensors.get("torqueNm") or 40.0)
        vibration = float(sensors.get("vibration") or sensors.get("vibrationMmS") or 1.8)
        proc_temp = float(sensors.get("processTemperature") or sensors.get("processTempKelvin") or 310.0)
        air_temp = float(sensors.get("airTemperature") or sensors.get("airTempKelvin") or 300.0)
        speed = float(sensors.get("rotationalSpeed") or sensors.get("rotationalSpeedRpm") or 1500.0)

        temp_diff = proc_temp - air_temp
        power_watts = torque * (speed * (2 * np.pi / 60))

        if tool_wear >= 200 or torque * tool_wear > 11000:
            return (
                "Tool Wear & Mechanical Overstrain Failure (TWF/OSF)",
                "IMMEDIATE ACTION: Replace cutting insert and spindle toolholder; reduce feed torque."
            )
        elif vibration > 4.5:
            return (
                "Bearing Misalignment / Rotor Imbalance",
                "ACTION: Check dynamic rotor balancing, bearing raceway clearance, and vibration dampeners."
            )
        elif temp_diff < 8.6 and speed < 1380:
            return (
                "Heat Dissipation Failure (HDF)",
                "ACTION: Inspect cooling duct flow, coolant pressure, and heat exchanger fins."
            )
        elif power_watts < 3500 or power_watts > 9000:
            return (
                "Power Transmission Failure (PWF)",
                "ACTION: Inspect drive belt tension, electric motor windings, and power inverter."
            )
        elif risk_level == "critical":
            return (
                "High Pressure Compressor (HPC) Degradation",
                "Borescope inspection of stages 4-9; compressor wash; replace eroded blade sets."
            )
        elif risk_level == "high":
            return (
                "Turbine Section Thermal Wear",
                "Overhaul hot section; check nozzle guide vanes; replace high-temperature seals."
            )
        elif risk_level == "medium":
            return (
                "Elevated Telemetry Drift",
                "Schedule preventative inspection during upcoming planned maintenance window."
            )
        else:
            return (
                "None",
                "Machine operating within normal parameters. Routine monitoring scheduled."
            )

# Global singleton
predictor = MLPredictor()
