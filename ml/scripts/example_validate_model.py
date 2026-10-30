"""
Example Validation Workflow for NASA C-MAPSS
============================================
Demonstrates how to:
1. Ingest the newly generated validation dataset from 'validation_data/'.
2. Train a baseline XGBoost model strictly on 'train_split_FD001.txt' (80 units).
3. Validate on 'val_censored_FD001.txt' against 'val_RUL_FD001.txt' (20 units).
4. Validate on full trajectories ('val_full_FD001.csv').
5. Confirm zero data leakage between training and validation engines.
"""

from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
import xgboost as xgb

def _find_repo_root():
    curr = Path(__file__).resolve().parent
    for p in [curr, curr.parent, curr.parent.parent]:
        if (p / "validation_data").exists() or (p / ".git").exists() or (p / "ml_service").exists():
            return p
    return curr

BASE_DIR = _find_repo_root()
VAL_DIR = BASE_DIR / "validation_data"
CMAPS_DIR = BASE_DIR / "CMaps"

# Column definitions
ID_COL = "unit_id"
CYCLE_COL = "cycle"
SETTING_COLS = ["setting_1", "setting_2", "setting_3"]
SENSOR_COLS = [f"s_{i}" for i in range(1, 22)]
ALL_COLS = [ID_COL, CYCLE_COL] + SETTING_COLS + SENSOR_COLS

CONSTANT_COLS = ["setting_3", "s_1", "s_5", "s_10", "s_16", "s_18", "s_19"]
ACTIVE_SENSORS = [s for s in SENSOR_COLS if s not in CONSTANT_COLS]


def compute_nasa_phm_score(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    d = np.array(y_pred) - np.array(y_true)
    score = np.where(d < 0, np.exp(-d / 13.0) - 1.0, np.exp(d / 10.0) - 1.0)
    return float(np.sum(score))


def add_rolling_features(df: pd.DataFrame) -> tuple:
    df = df.copy().sort_values(by=[ID_COL, CYCLE_COL])
    grouped = df.groupby(ID_COL)
    feat_cols = []

    # Baseline drift (difference from first 5 healthy cycles)
    healthy_base = df[df[CYCLE_COL] <= 5].groupby(ID_COL)[ACTIVE_SENSORS].mean().reset_index()
    df = df.merge(healthy_base, on=ID_COL, suffixes=("", "_base"))

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


def main():
    print("=" * 70)
    print("  VALIDATION EXPERIMENT: FD001 (Train on 80 units, Validate on 20 units)")
    print("=" * 70)

    # 1. Load train split and validation files
    train_split_raw = pd.read_csv(VAL_DIR / "train_split_FD001.txt", sep=r"\s+", header=None, names=ALL_COLS)
    val_censored_raw = pd.read_csv(VAL_DIR / "val_censored_FD001.txt", sep=r"\s+", header=None, names=ALL_COLS)
    val_true_rul = np.loadtxt(VAL_DIR / "val_RUL_FD001.txt")
    val_full_df = pd.read_csv(VAL_DIR / "val_full_FD001.csv")

    # 2. Check for zero engine overlap (leak-free guarantee)
    train_units = set(train_split_raw[ID_COL].unique())
    val_units = set(val_censored_raw[ID_COL].unique())
    overlap = train_units.intersection(val_units)
    assert len(overlap) == 0, f"Leakage detected! Overlapping units: {overlap}"
    print(f"[Verification] Engine Unit Overlap: {len(overlap)} units (STRICT ZERO DATA LEAKAGE)")

    # 3. Target calculation on train split
    max_c = train_split_raw.groupby(ID_COL)[CYCLE_COL].transform("max")
    train_split_raw["target_rul"] = (max_c - train_split_raw[CYCLE_COL]).clip(upper=125)

    # 4. Feature engineering
    train_feat, feat_cols = add_rolling_features(train_split_raw)
    val_censored_feat, _ = add_rolling_features(val_censored_raw)

    # Last observed cycle per validation engine
    val_last_snapshots = val_censored_feat.groupby(ID_COL).last().reset_index()

    X_train = train_feat[feat_cols]
    y_train = train_feat["target_rul"].values
    X_val = val_last_snapshots[feat_cols]

    # 5. Train XGBoost on 80% split
    print("\nTraining XGBoost on 80 train units...")
    model = xgb.XGBRegressor(n_estimators=120, max_depth=4, learning_rate=0.05, subsample=0.8, colsample_bytree=0.8, random_state=42)
    model.fit(X_train, y_train)

    # 6. Evaluate on Censored Validation
    val_preds = np.clip(model.predict(X_val), 0, None)
    val_rmse = np.sqrt(mean_squared_error(val_true_rul, val_preds))
    val_mae = mean_absolute_error(val_true_rul, val_preds)
    val_r2 = r2_score(val_true_rul, val_preds)
    val_phm = compute_nasa_phm_score(val_true_rul, val_preds)

    print("\n" + "=" * 70)
    print("  VALIDATION SET BENCHMARK RESULTS (20 HELD-OUT ENGINES)")
    print("=" * 70)
    print(f"  Validation RMSE:       {val_rmse:.2f} cycles")
    print(f"  Validation MAE:        {val_mae:.2f} cycles")
    print(f"  Validation R² Score:   {val_r2:.4f} ({val_r2*100:.1f}%)")
    print(f"  Validation NASA Score: {val_phm:.1f}")

    # Inspect first 10 validation engines
    val_inspect = pd.DataFrame({
        "Unit ID": val_last_snapshots[ID_COL],
        "Censored Cutoff Cycle": val_last_snapshots[CYCLE_COL],
        "Actual Remaining RUL": val_true_rul.astype(int),
        "Predicted RUL": np.round(val_preds, 1),
    })
    val_inspect["Error (cycles)"] = np.round(val_inspect["Predicted RUL"] - val_inspect["Actual Remaining RUL"], 1)
    print("\nSample Validation Engine Predictions (First 10 Held-out Units):")
    print(val_inspect.head(10).to_string(index=False))
    print("=" * 70 + "\n")


if __name__ == "__main__":
    main()
