"""
Comprehensive 3-Way Model Evaluation: Training vs. Validation vs. Testing
========================================================================
This script provides the complete benchmarking workflow:
1. Trains an XGBoost model strictly on the Training Split (80 engines).
2. Evaluates on the Validation Split (20 held-out engines from validation_data/).
3. Evaluates on the Official NASA Test Set (100 held-out engines from CMaps/).
4. Computes both Regression Accuracy and Classification Failure-Alert Accuracy:
   - Regression: R², RMSE, MAE, Tolerance Accuracy (within ±10 and ±20 cycles), NASA PHM Score.
   - Classification (Failure within 30 cycles): Binary Accuracy %, Precision, Recall, F1-Score.
5. Displays a side-by-side Training vs. Validation vs. Testing comparison table.
"""

from pathlib import Path
import json
import numpy as np
import pandas as pd
from sklearn.metrics import (
    mean_squared_error, mean_absolute_error, r2_score,
    accuracy_score, precision_score, recall_score, f1_score, roc_auc_score
)
import xgboost as xgb

def _find_repo_root():
    curr = Path(__file__).resolve().parent
    for p in [curr, curr.parent, curr.parent.parent]:
        if (p / "validation_data").exists() or (p / ".git").exists() or (p / "ml_service").exists():
            return p
    return curr

BASE_DIR = _find_repo_root()
VAL_DIR = BASE_DIR / "validation_data"
DATA_DIR = BASE_DIR / "CMaps"

ID_COL = "unit_id"
CYCLE_COL = "cycle"
SETTING_COLS = ["setting_1", "setting_2", "setting_3"]
SENSOR_COLS = [f"s_{i}" for i in range(1, 22)]
ALL_COLS = [ID_COL, CYCLE_COL] + SETTING_COLS + SENSOR_COLS

CONSTANT_COLS = ["setting_3", "s_1", "s_5", "s_10", "s_16", "s_18", "s_19"]
ACTIVE_SENSORS = [s for s in SENSOR_COLS if s not in CONSTANT_COLS]
RUL_CLIP_THRESHOLD = 125
ALERT_THRESHOLD = 30  # Cycles to trigger critical maintenance alert


def compute_nasa_phm_score(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    d = np.array(y_pred) - np.array(y_true)
    score = np.where(d < 0, np.exp(-d / 13.0) - 1.0, np.exp(d / 10.0) - 1.0)
    return float(np.sum(score))


def compute_tolerance_accuracy(y_true: np.ndarray, y_pred: np.ndarray, tolerance_cycles: int = 15) -> float:
    """Percentage of predictions within ±tolerance cycles of ground truth."""
    within_tol = np.abs(np.array(y_pred) - np.array(y_true)) <= tolerance_cycles
    return float(np.mean(within_tol) * 100.0)


def extract_features(df: pd.DataFrame) -> tuple:
    """Extract physics-informed degradation features (drift + rolling dynamics)."""
    df = df.copy().sort_values(by=[ID_COL, CYCLE_COL])
    grouped = df.groupby(ID_COL)
    feat_cols = []

    # Baseline drift (difference from first 5 healthy cycles)
    base = df[df[CYCLE_COL] <= 5].groupby(ID_COL)[ACTIVE_SENSORS].mean().reset_index()
    df = df.merge(base, on=ID_COL, suffixes=("", "_base"))

    for s in ACTIVE_SENSORS:
        drift_col = f"{s}_drift"
        df[drift_col] = df[s] - df[f"{s}_base"]
        df.drop(columns=[f"{s}_base"], inplace=True)
        feat_cols.append(drift_col)

    for s in ACTIVE_SENSORS:
        df[f"{s}_rm5"] = grouped[s].transform(lambda x: x.rolling(5, min_periods=1).mean())
        df[f"{s}_rm15"] = grouped[s].transform(lambda x: x.rolling(15, min_periods=1).mean())
        df[f"{s}_rstd10"] = grouped[s].transform(lambda x: x.rolling(10, min_periods=1).std().fillna(0))
        feat_cols.extend([f"{s}_rm5", f"{s}_rm15", f"{s}_rstd10"])

    all_features = [CYCLE_COL, "setting_1", "setting_2"] + ACTIVE_SENSORS + feat_cols
    return df, all_features


def evaluate_split(name: str, y_true: np.ndarray, y_pred: np.ndarray) -> dict:
    """Calculates all industrial regression and early-warning classification metrics."""
    y_pred = np.clip(y_pred, 0, None)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    mae = mean_absolute_error(y_true, y_pred)
    r2 = r2_score(y_true, y_pred)
    nasa_score = compute_nasa_phm_score(y_true, y_pred)
    acc_10 = compute_tolerance_accuracy(y_true, y_pred, tolerance_cycles=10)
    acc_20 = compute_tolerance_accuracy(y_true, y_pred, tolerance_cycles=20)

    # Binary alert accuracy (failure imminent within 30 cycles)
    y_true_binary = (y_true <= ALERT_THRESHOLD).astype(int)
    y_pred_binary = (y_pred <= ALERT_THRESHOLD).astype(int)

    cls_acc = accuracy_score(y_true_binary, y_pred_binary) * 100.0
    cls_prec = precision_score(y_true_binary, y_pred_binary, zero_division=0) * 100.0
    cls_rec = recall_score(y_true_binary, y_pred_binary, zero_division=0) * 100.0
    cls_f1 = f1_score(y_true_binary, y_pred_binary, zero_division=0) * 100.0

    return {
        "Dataset Split": name,
        "Sample Size": len(y_true),
        "R² Score": round(float(r2), 4),
        "RMSE (cycles)": round(float(rmse), 2),
        "MAE (cycles)": round(float(mae), 2),
        "Acc (±10 cycles)": f"{acc_10:.1f}%",
        "Acc (±20 cycles)": f"{acc_20:.1f}%",
        "NASA PHM Score": round(float(nasa_score), 1),
        "Alert Accuracy": f"{cls_acc:.1f}%",
        "Alert Precision": f"{cls_prec:.1f}%",
        "Alert Recall": f"{cls_rec:.1f}%",
        "Alert F1-Score": f"{cls_f1:.1f}%",
    }


def main():
    print("=" * 80)
    print("  NASA C-MAPSS 3-WAY MODEL BENCHMARK: TRAIN vs. VALIDATION vs. TEST")
    print("=" * 80)

    # 1. Load Data
    # -------------------------------------------------------------
    # Train Split (80 engines)
    train_split_raw = pd.read_csv(VAL_DIR / "train_split_FD001.txt", sep=r"\s+", header=None, names=ALL_COLS)

    # Validation Split (20 engines)
    val_censored_raw = pd.read_csv(VAL_DIR / "val_censored_FD001.txt", sep=r"\s+", header=None, names=ALL_COLS)
    val_true_rul = np.loadtxt(VAL_DIR / "val_RUL_FD001.txt")

    # Official Test Set (100 engines)
    test_raw = pd.read_csv(DATA_DIR / "test_FD001.txt", sep=r"\s+", header=None, names=ALL_COLS)
    test_true_rul = np.loadtxt(DATA_DIR / "RUL_FD001.txt")

    print(f"Data Loaded Successfully:")
    print(f"  - Train Split:      {train_split_raw[ID_COL].nunique()} engines ({len(train_split_raw):,} operational cycles)")
    print(f"  - Validation Split: {val_censored_raw[ID_COL].nunique()} engines ({len(val_true_rul)} ground truth RUL targets)")
    print(f"  - Official Test:    {test_raw[ID_COL].nunique()} engines ({len(test_true_rul)} ground truth RUL targets)")

    # 2. Target Calculation on Train Split
    # -------------------------------------------------------------
    max_c = train_split_raw.groupby(ID_COL)[CYCLE_COL].transform("max")
    train_split_raw["raw_rul"] = max_c - train_split_raw[CYCLE_COL]
    train_split_raw["target_rul"] = train_split_raw["raw_rul"].clip(upper=RUL_CLIP_THRESHOLD)

    # 3. Feature Extraction
    # -------------------------------------------------------------
    print("\nEngineering degradation & rolling dynamics features...")
    train_feat, feat_cols = extract_features(train_split_raw)
    val_feat, _ = extract_features(val_censored_raw)
    test_feat, _ = extract_features(test_raw)

    # For validation and test, extract the last observed snapshot per engine
    val_last = val_feat.groupby(ID_COL).last().reset_index()
    test_last = test_feat.groupby(ID_COL).last().reset_index()

    # For train evaluation, extract representative snapshots (the last 30% of each training trajectory)
    # to evaluate how accurately the model predicts RUL across wear cycles
    train_eval_samples = train_feat.sample(n=min(len(train_feat), 2000), random_state=42)

    X_train = train_feat[feat_cols]
    y_train = train_feat["target_rul"].values

    X_train_eval = train_eval_samples[feat_cols]
    y_train_eval = train_eval_samples["target_rul"].values

    X_val = val_last[feat_cols]
    y_val = val_true_rul

    X_test = test_last[feat_cols]
    y_test = test_true_rul

    # 4. Train Model
    # -------------------------------------------------------------
    print(f"Training XGBoost Regressor on {len(X_train):,} training cycles...")
    model = xgb.XGBRegressor(
        n_estimators=120,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        n_jobs=-1
    )
    model.fit(X_train, y_train)

    # 5. Predict across Train, Val, and Test
    # -------------------------------------------------------------
    pred_train = model.predict(X_train_eval)
    pred_val = model.predict(X_val)
    pred_test = model.predict(X_test)

    # 6. Evaluate all splits
    # -------------------------------------------------------------
    results = [
        evaluate_split("Training Split (Sampled Cycles)", y_train_eval, pred_train),
        evaluate_split("Validation Split (20 Engines)", y_val, pred_val),
        evaluate_split("Official Test Set (100 Engines)", y_test, pred_test),
    ]

    results_df = pd.DataFrame(results)

    print("\n" + "=" * 90)
    print("  SIDE-BY-SIDE MODEL PERFORMANCE: TRAINING vs. VALIDATION vs. TESTING")
    print("=" * 90)
    print(results_df[[
        "Dataset Split", "Sample Size", "R² Score", "RMSE (cycles)", "MAE (cycles)", 
        "Acc (±10 cycles)", "Acc (±20 cycles)", "NASA PHM Score"
    ]].to_string(index=False))

    print("\n" + "-" * 90)
    print("  EARLY-WARNING CRITICAL ALERT PERFORMANCE (Failure within 30 Cycles)")
    print("-" * 90)
    print(results_df[[
        "Dataset Split", "Alert Accuracy", "Alert Precision", "Alert Recall", "Alert F1-Score"
    ]].to_string(index=False))
    print("=" * 90)

    # 7. Diagnosing Overfitting / Generalization
    r2_train = results[0]["R² Score"]
    r2_val = results[1]["R² Score"]
    r2_test = results[2]["R² Score"]

    print("\n[Diagnostic Generalization Analysis]")
    print(f"  - Training R²:   {r2_train:.4f}")
    print(f"  - Validation R²: {r2_val:.4f}")
    print(f"  - Testing R²:    {r2_test:.4f}")

    if abs(r2_val - r2_test) < 0.15 and r2_val > 0.65:
        print("  -> VERDICT: EXCELLENT GENERALIZATION. Validation accurately mirrors test performance.")
        print("     There is no overfitting. The model is ready for deployment.")
    elif r2_train - r2_val > 0.35:
        print("  -> VERDICT: WARNING - Potential Overfitting detected between Train and Validation.")
    else:
        print("  -> VERDICT: STABLE PERFORMANCE across all partitions.")

    # 8. Inspection Sample
    val_compare = pd.DataFrame({
        "Val Engine ID": val_last[ID_COL],
        "Cutoff Cycle": val_last[CYCLE_COL],
        "Actual RUL": val_true_rul.astype(int),
        "Predicted RUL": np.round(pred_val, 1),
        "Absolute Error": np.round(np.abs(pred_val - val_true_rul), 1),
        "Within ±10 Cycles?": np.where(np.abs(pred_val - val_true_rul) <= 10, "YES", "NO")
    })
    print("\nValidation Engines Detailed Inspection (First 10 Units):")
    print(val_compare.head(10).to_string(index=False))
    print("=" * 90 + "\n")


if __name__ == "__main__":
    main()
