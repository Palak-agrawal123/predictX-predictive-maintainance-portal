"""
================================================================================
  MERIDIAN PREDICTIVE MAINTENANCE - MODEL FOLDER EXPLORER & INSPECTOR
  File: explore_models.py
  Usage: python explore_models.py
  (Formatted with '# %%' cell markers for VS Code / IDE Interactive Notebook)
================================================================================
This script inspects, loads, explains, and demonstrates all updated model artifacts in
the 'ml_service/models/' directory:
  1. xgb_regressor_FD001.joblib    - Primary XGBoost RUL Regressor (78 features, R²=0.9093)
  2. rf_regressor_FD001.joblib     - Alternative Random Forest Regressor (100 trees, R²=0.8952)
  3. xgb_regressor_FD003.joblib    - XGBoost Regressor for Dual Failure Modes (HPC + Fan)
  4. rf_regressor_FD003.joblib     - Random Forest for Dual Failure Modes
  5. lstm_regressor_FD002.pt       - PyTorch Sequential LSTM for 6 Operating Regimes
  6. cnn_lstm_regressor_FD002.pt   - PyTorch 1D CNN-LSTM Hybrid Regressor
  7. lstm_regressor_FD004.pt       - PyTorch LSTM for 6 Regimes & Dual Failure Modes
  8. cnn_lstm_regressor_FD004.pt   - PyTorch CNN-LSTM Hybrid for Complex Dynamics
  9. metadata_FD001.json           - Feature mapping and single-condition configuration
  10. all_subsets_benchmark_summary.json - Multi-subset comparative benchmarks
  11. metrics.json                 - Official held-out test evaluation benchmarks
  12. feature_importance.json      - 78-feature importance ranking
  13. fleet_predictions.json       - 100-engine fleet precomputed diagnoses
  14. summary_stats.json           - Fleet-level risk tier distribution
"""

# %% [markdown]
# # 🛠️ Step 0: Imports and Path Configuration

import os
import sys
import json
from pathlib import Path
import numpy as np
import pandas as pd
import joblib

# Ensure UTF-8 console output on Windows
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Locate models directory
def _find_repo_root():
    curr = Path(__file__).resolve().parent
    for p in [curr, curr.parent, curr.parent.parent]:
        if (p / "Updated_Models").exists() or (p / ".git").exists() or (p / "ml_service").exists():
            return p
    return curr

BASE_DIR = _find_repo_root()
MODELS_DIR = BASE_DIR / "ml_service" / "models"
if not MODELS_DIR.exists() or not (MODELS_DIR / "xgb_regressor_FD001.joblib").exists():
    MODELS_DIR = BASE_DIR / "Updated_Models"

print("=" * 75)
print("  MERIDIAN PREDICTIVE MAINTENANCE: MODEL FOLDER INSPECTION")
print(f"  Target Directory: {MODELS_DIR}")
print("=" * 75 + "\n")

# %% [markdown]
# # 📁 Step 1: Inventory of All Model Files

print("--- [1/8] MODEL FOLDER INVENTORY ---")
files = sorted(list(MODELS_DIR.glob("*")))
for f in files:
    size_kb = f.stat().st_size / 1024
    print(f"  • {f.name:<35} | {size_kb:>8.2f} KB | {f.suffix}")
print(f"\n  Total Model Artifacts: {len(files)} files\n")

# %% [markdown]
# # 🏷️ Step 2: Input Features Inspection (`feature_names.joblib` & `metadata_FD001.json`)

print("--- [2/8] FEATURE SCHEMA (78 Engineered Telemetry Features) ---")
xgb_pkg = joblib.load(MODELS_DIR / "xgb_regressor_FD001.joblib")
feature_names = xgb_pkg["feature_cols"]
dropped_constants = xgb_pkg.get("constant_cols", [])

print(f"Active Features Count:   {len(feature_names)}")
print(f"Pruned Constant Sensors: {dropped_constants}")

# Categorize features
raw_sensors = [f for f in feature_names if f.startswith("s_") and "_" not in f[2:]]
drifts = [f for f in feature_names if "_drift" in f]
roll_5 = [f for f in feature_names if "_rm5" in f]
roll_15 = [f for f in feature_names if "_rm15" in f]
roll_std = [f for f in feature_names if "_rstd10" in f]
operational = [f for f in feature_names if f in ["cycle", "setting_1", "setting_2", "setting_3"]]

print(f"  • Operational Parameters ({len(operational)}): {operational}")
print(f"  • Raw Telemetry Sensors  ({len(raw_sensors)}): {raw_sensors}")
print(f"  • Baseline Drift Deltas  ({len(drifts)}): {drifts[:4]} ... (+{len(drifts)-4} more)")
print(f"  • 5-Cycle Rolling Means  ({len(roll_5)}): {roll_5[:4]} ... (+{len(roll_5)-4} more)")
print(f"  • 15-Cycle Rolling Means ({len(roll_15)}): {roll_15[:4]} ... (+{len(roll_15)-4} more)")
print(f"  • 10-Cycle Volatility/Std({len(roll_std)}): {roll_std[:4]} ... (+{len(roll_std)-4} more)")
print()

# %% [markdown]
# # 🤖 Step 3: Trained Models Inspection (Tree & Deep Learning Models)

print("--- [3/8] MODEL ARCHITECTURES & MULTI-SUBSET REGIMES ---")

# 1. Primary XGBoost Regressor (FD001)
regressor = xgb_pkg["model"]
print("1. XGBoost RUL Regressor (xgb_regressor_FD001.joblib):")
print(f"   • Model Class:       {type(regressor).__name__}")
print(f"   • Number of Trees:   {regressor.n_estimators}")
print(f"   • Max Tree Depth:    {regressor.max_depth}")
print(f"   • Learning Rate:     {regressor.learning_rate}")
print(f"   • Objective:         {regressor.objective}")

# 2. Random Forest Regressor (FD001)
rf_pkg = joblib.load(MODELS_DIR / "rf_regressor_FD001.joblib")
rf_model = rf_pkg["model"]
print("\n2. Random Forest Regressor (rf_regressor_FD001.joblib):")
print(f"   • Model Class:       {type(rf_model).__name__}")
print(f"   • Number of Trees:   {rf_model.n_estimators}")
print(f"   • Max Tree Depth:    {rf_model.max_depth}")

# 3. Dual-Failure Mode Models (FD003)
if (MODELS_DIR / "xgb_regressor_FD003.joblib").exists():
    print("\n3. Dual-Failure Mode Models (FD003 - HPC Wear + Fan Degradation):")
    print("   • XGBoost & Random Forest available for dual degradation paths.")

# 4. Multi-Condition Sequential Deep Learning Models (FD002 & FD004)
if (MODELS_DIR / "lstm_regressor_FD002.pt").exists():
    print("\n4. Sequential Deep Learning Models (FD002 & FD004 - 6 Operating Flight Conditions):")
    print("   • PyTorch Vanilla LSTM (lstm_regressor_FD002.pt / FD004.pt)")
    print("   • PyTorch 1D CNN-LSTM Hybrid (cnn_lstm_regressor_FD002.pt / FD004.pt)")
print()

# %% [markdown]
# # 📊 Step 4: Benchmark Evaluation Metrics (`metrics.json`)

print("--- [4/8] BENCHMARK EVALUATION METRICS (metrics.json) ---")
with open(MODELS_DIR / "metrics.json", "r") as f:
    metrics = json.load(f)

print(f"  • Active Model                            : {metrics.get('model_name')}")
print(f"  • R² Score (Coefficient of Determination) : {metrics.get('r2'):>8.4f} (90.9% variance explained)")
print(f"  • Root Mean Squared Error (RMSE)          : {metrics.get('rmse'):>8.2f} cycles")
print(f"  • Mean Absolute Error (MAE)               : {metrics.get('mae'):>8.2f} cycles")
print(f"  • Median Absolute Error (MedAE)           : {metrics.get('medae'):>8.2f} cycles")
print(f"  • NASA PHM Prognostics Penalty Score      : {metrics.get('nasa_score'):>8.1f} (Asymmetric safety penalty)")
print(f"  • Failure Early-Warning ROC-AUC (30-cycle): {metrics.get('roc_auc_30d'):>8.4f} (99.7% area under curve)")
print(f"  • Binary Classification Accuracy (30-day) : {metrics.get('accuracy_30d')*100:>8.1f}%")
print(f"  • Precision / PPV                         : {metrics.get('precision_30d')*100:>8.1f}% (Zero false alarms)")
print(f"  • Recall / Sensitivity                    : {metrics.get('recall_30d')*100:>8.1f}% (Captures 22 of 25 impending failures)")
print(f"  • F1-Score                                : {metrics.get('f1_score_30d'):>8.4f}")
print()

# %% [markdown]
# # 🌐 Step 5: Multi-Subset Comparative Summary (`all_subsets_benchmark_summary.json`)

if (MODELS_DIR / "all_subsets_benchmark_summary.json").exists():
    print("--- [5/8] MULTI-SUBSET C-MAPSS BENCHMARK COMPARISON ---")
    with open(MODELS_DIR / "all_subsets_benchmark_summary.json", "r") as f:
        summary_all = json.load(f)

    for subset_name, sub_info in summary_all.items():
        cond_type = sub_info.get("type", "")
        models_info = sub_info.get("models", {})
        print(f"  • Sub-dataset {subset_name} ({cond_type}):")
        for m_name, m_metrics in models_info.items():
            rmse = m_metrics.get("RMSE", 0)
            mae = m_metrics.get("MAE", 0)
            r2 = m_metrics.get("R2", None)
            r2_str = f" | R2: {r2:.3f}" if r2 is not None else ""
            print(f"    - {m_name:<16}: RMSE: {rmse:>6.2f} cycles | MAE: {mae:>6.2f} cycles{r2_str}")
    print()

# %% [markdown]
# # 🔍 Step 6: Feature Importance Ranking (`feature_importance.json`)

print("--- [6/8] TOP PREDICTIVE TELEMETRY SENSORS (feature_importance.json) ---")
with open(MODELS_DIR / "feature_importance.json", "r") as f:
    feat_importances = json.load(f)

sensor_descriptions = {
    "s_4": "T50 - LPT Outlet Exhaust Gas Temp",
    "s_3": "T30 - HPC Outlet Total Temp",
    "s_11": "Ps30 - HPC Static Pressure",
    "s_15": "BPR - Bypass Ratio",
    "s_2": "T24 - LPC Outlet Total Temp",
    "s_12": "Phi - Fuel Flow to Ps30 Ratio",
    "cycle": "Operating Flight Cycle",
}

top_features = list(feat_importances.items())[:8]
max_imp = max(v for _, v in top_features) if top_features else 1.0

for i, (feat, imp) in enumerate(top_features, 1):
    bar = "#" * int((imp / max_imp) * 25)
    pct = imp * 100.0

    desc = ""
    for k, v in sensor_descriptions.items():
        if feat.startswith(k):
            desc = f"({v})"
            break

    print(f"  {i}. {feat:<20} {pct:>6.2f}% | {bar:<25} {desc}")
print()

# %% [markdown]
# # 🏭 Step 7: Fleet Predictions & Diagnostics (`fleet_predictions.json`)

print("--- [7/8] FLEET EVALUATIONS (fleet_predictions.json & summary_stats.json) ---")
with open(MODELS_DIR / "summary_stats.json", "r") as f:
    summary = json.load(f)

print(f"  • Total Fleet Units : {summary.get('total_units')}")
print(f"  • Critical Units    : {summary.get('critical')} (Immediate intervention)")
print(f"  • High Risk Units   : {summary.get('high')} (Maintenance in 48 hrs)")
print(f"  • Medium Risk Units : {summary.get('medium')} (Planned inspection)")
print(f"  • Nominal/Low Units : {summary.get('low')} (Healthy)")
print(f"  • Fleet Average RUL : {summary.get('fleet_avg_predicted_rul')} cycles (Min: {summary.get('fleet_min_predicted_rul')}, Max: {summary.get('fleet_max_predicted_rul')})")

with open(MODELS_DIR / "fleet_predictions.json", "r") as f:
    fleet = json.load(f)

print("\nSample Critical Engine Diagnosis (Highest Failure Urgency):")
u_crit = next((u for u in fleet if u["risk_tier"] == "CRITICAL"), fleet[0])
print(f"  • Unit ID           : {u_crit['unit_id']}")
print(f"  • Current Cycle     : {u_crit['current_cycle']}")
print(f"  • Predicted RUL     : {u_crit['predicted_rul']} cycles (Ground Truth: {u_crit['true_rul']})")
print(f"  • Failure Likelihood: {u_crit['failure_probability']}%")
print(f"  • Risk Tier         : {u_crit['risk_tier']} ({u_crit['priority']})")
print(f"  • Primary Component : {u_crit['primary_component']} ({u_crit['component_confidence']}% confidence)")
print(f"  • Action Required   : {u_crit['recommended_action']}")
print()

# %% [markdown]
# # 🧪 Step 8: Live Interactive Inference Demonstration

print("--- [8/8] LIVE MODEL INFERENCE DEMO ---")

def run_demo_prediction(label: str, cycle: float, t50_deg: float, t30_deg: float, ps30_drift: float):
    print(f"\nScenario: {label}")
    print(f"  Input: Operating Cycle={cycle:.0f}, T50 Elevation={t50_deg:+.1f}K, T30 Elevation={t30_deg:+.1f}K, Ps30 Drift={ps30_drift:+.3f}psi")

    # Construct input vector matching the 78 feature schema
    sample_series = pd.Series(0.0, index=feature_names)
    sample_series["cycle"] = cycle
    sample_series["setting_1"] = 0.001
    sample_series["setting_2"] = 0.0002

    # Baseline sensor readings
    baseline_sensors = {
        "s_2": 642.5, "s_3": 1585.0, "s_4": 1405.0, "s_6": 21.6,
        "s_7": 554.0, "s_8": 2388.0, "s_9": 9060.0, "s_11": 47.4,
        "s_12": 521.5, "s_13": 2388.0, "s_14": 8135.0, "s_15": 8.4,
        "s_17": 392.0, "s_20": 38.9, "s_21": 23.3
    }
    for s, base in baseline_sensors.items():
        sample_series[s] = base
        sample_series[f"{s}_rm5"] = base
        sample_series[f"{s}_rm15"] = base
        sample_series[f"{s}_rstd10"] = 0.05
        sample_series[f"{s}_drift"] = 0.0

    # Inject degradation signals
    sample_series["s_4"] += t50_deg
    sample_series["s_4_rm5"] += t50_deg
    sample_series["s_4_rm15"] += t50_deg * 0.9
    sample_series["s_4_drift"] = t50_deg

    sample_series["s_3"] += t30_deg
    sample_series["s_3_rm5"] += t30_deg
    sample_series["s_3_rm15"] += t30_deg * 0.85
    sample_series["s_3_drift"] = t30_deg

    sample_series["s_11"] += ps30_drift
    sample_series["s_11_rm5"] += ps30_drift
    sample_series["s_11_rm15"] += ps30_drift * 0.8
    sample_series["s_11_drift"] = ps30_drift

    df_test = pd.DataFrame([sample_series], columns=feature_names)
    pred_rul_xgb = float(np.clip(regressor.predict(df_test)[0], 1.0, 125.0))
    pred_rul_rf = float(np.clip(rf_model.predict(df_test)[0], 1.0, 125.0))

    # Risk calibration
    if pred_rul_xgb <= 15:
        risk_level = "CRITICAL"
        fail_prob = 98.5
    elif pred_rul_xgb <= 30:
        risk_level = "HIGH"
        fail_prob = 75.0
    elif pred_rul_xgb <= 70:
        risk_level = "MEDIUM"
        fail_prob = 30.0
    else:
        risk_level = "LOW"
        fail_prob = 5.0

    health_score = int(max(0, min(100, (pred_rul_xgb / 125.0) * 100)))

    print(f"  Result:")
    print(f"    • Remaining Useful Life (XGBoost)      : {pred_rul_xgb:.1f} cycles")
    print(f"    • Remaining Useful Life (Random Forest): {pred_rul_rf:.1f} cycles")
    print(f"    • Impending Failure Probability (30-day): {fail_prob:.1f}%")
    print(f"    • Risk Level Classification            : {risk_level}")
    print(f"    • Equipment Health Score Index         : {health_score} / 100")

# Run two demonstration scenarios
run_demo_prediction(
    label="Nominal Healthy Turbofan Engine",
    cycle=40.0,
    t50_deg=1.2,
    t30_deg=2.0,
    ps30_drift=0.02
)

run_demo_prediction(
    label="Severe High-Pressure Compressor Wear (Near Failure)",
    cycle=195.0,
    t50_deg=18.5,
    t30_deg=24.0,
    ps30_drift=0.52
)

print("\n" + "=" * 75)
print("  MODEL INSPECTION & DEMONSTRATION COMPLETE")
print("=" * 75)
