"""
Diagnostics and Root Cause Analysis Engine.
Pinpoints the likely failing turbofan component (HPC, Fan, Turbine, Fuel System)
and ranks sensor anomalies against healthy operational baseline.
"""
import pandas as pd
import numpy as np
from typing import Dict, Any, List
from src.config import SUBSYSTEM_MAP, SENSOR_METADATA, RISK_LEVELS

def calculate_sensor_deviations(unit_history: pd.DataFrame, window: int = 5) -> pd.DataFrame:
    """
    Calculate baseline vs current reading and deviation percentage for all active sensors.
    """
    if len(unit_history) == 0:
        return pd.DataFrame()

    baseline_rows = unit_history.head(min(5, len(unit_history)))
    recent_rows = unit_history.tail(min(window, len(unit_history)))

    results = []
    for s, meta in SENSOR_METADATA.items():
        if not meta["varies"]:
            continue
        
        base_val = baseline_rows[s].mean()
        curr_val = recent_rows[s].mean()
        
        # Absolute and percentage change
        abs_diff = curr_val - base_val
        pct_diff = (abs_diff / (abs(base_val) + 1e-6)) * 100.0
        
        # Historical standard deviation for normalization
        std_val = unit_history[s].std()
        z_score = abs_diff / (std_val + 1e-6) if std_val > 0 else 0.0

        results.append({
            "sensor": s,
            "sensor_name": meta["name"],
            "description": meta["desc"],
            "unit": meta["unit"],
            "baseline": round(base_val, 3),
            "current": round(curr_val, 3),
            "pct_change": round(pct_diff, 2),
            "z_score": round(z_score, 2),
            "abs_z": abs(round(z_score, 2))
        })

    dev_df = pd.DataFrame(results)
    return dev_df.sort_values(by="abs_z", ascending=False).reset_index(drop=True)

def diagnose_failing_component(unit_history: pd.DataFrame, predicted_rul: float) -> Dict[str, Any]:
    """
    Analyze telemetry signatures across turbofan subassemblies to determine the
    likely failing component and root cause diagnosis.
    """
    dev_df = calculate_sensor_deviations(unit_history)
    if dev_df.empty:
        return {
            "primary_component": "High Pressure Compressor (HPC)",
            "confidence": 75.0,
            "subsystem_scores": {},
            "top_anomalous_sensors": [],
            "diagnosis_summary": "Insufficient telemetry history.",
            "recommended_action": "Schedule routine diagnostic check."
        }

    dev_lookup = dev_df.set_index("sensor")["abs_z"].to_dict()

    subsystem_scores = {}
    for comp_name, comp_info in SUBSYSTEM_MAP.items():
        sensors = comp_info["sensors"]
        # Mean z-score across component sensors
        scores = [dev_lookup.get(s, 0.0) for s in sensors if s in dev_lookup]
        mean_z = np.mean(scores) if scores else 0.0
        
        # Scale to 0-100% degradation health score
        # Z-scores > 3.0 denote severe divergence from normal operating envelope
        degradation_score = min(100.0, (mean_z / 3.0) * 100.0)
        subsystem_scores[comp_name] = {
            "score": round(degradation_score, 1),
            "mean_z": round(mean_z, 2),
            "primary_symptom": comp_info["primary_symptom"],
            "wear_pattern": comp_info["wear_pattern"],
            "recommended_action": comp_info["recommended_action"]
        }

    # Identify primary failing component
    sorted_comps = sorted(subsystem_scores.items(), key=lambda x: x[1]["score"], reverse=True)
    primary_comp_name, primary_data = sorted_comps[0]
    
    # Calculate confidence based on score margin over second highest
    top_score = primary_data["score"]
    second_score = sorted_comps[1][1]["score"] if len(sorted_comps) > 1 else 0.0
    margin = top_score - second_score
    confidence = min(96.0, max(65.0, 70.0 + margin * 0.8))

    # Top anomalous sensors for explanation
    top_sensors = dev_df.head(4).to_dict(orient="records")

    summary = (
        f"{primary_comp_name} exhibits critical degradation ({primary_data['score']}% wear index). "
        f"Key telemetry indicators demonstrate {primary_data['primary_symptom'].lower()}."
    )

    return {
        "primary_component": primary_comp_name,
        "confidence": round(confidence, 1),
        "degradation_score": primary_data["score"],
        "subsystem_scores": subsystem_scores,
        "top_anomalous_sensors": top_sensors,
        "symptoms": primary_data["primary_symptom"],
        "wear_pattern": primary_data["wear_pattern"],
        "diagnosis_summary": summary,
        "recommended_action": primary_data["recommended_action"]
    }

def get_risk_assessment(predicted_rul: float) -> Dict[str, Any]:
    """
    Map predicted Remaining Useful Life to standard Meridian Risk Tiers.
    """
    if predicted_rul <= RISK_LEVELS["CRITICAL"]["rul_max"]:
        tier = "CRITICAL"
        risk_pct = min(100.0, 90.0 + (25 - predicted_rul) * 0.4)
    elif predicted_rul <= RISK_LEVELS["HIGH"]["rul_max"]:
        tier = "HIGH"
        risk_pct = 65.0 + (50 - predicted_rul) * 0.8
    elif predicted_rul <= RISK_LEVELS["MEDIUM"]["rul_max"]:
        tier = "MEDIUM"
        risk_pct = 35.0 + (90 - predicted_rul) * 0.75
    else:
        tier = "LOW"
        risk_pct = max(5.0, 30.0 - (predicted_rul - 90) * 0.25)

    info = RISK_LEVELS[tier]
    return {
        "risk_tier": tier,
        "risk_label": info["label"],
        "risk_score_pct": round(risk_pct, 1),
        "priority": info["priority"],
        "badge_color": info["color"],
        "recommended_action": info["action"]
    }
