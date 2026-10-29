"""
5-Fold Cross-Validation & Out-of-Fold (OOF) Evaluation Pipeline
==============================================================
Runs an end-to-end 5-fold cross-validation experiment on NASA C-MAPSS FD001.
- Trains 5 independent XGBoost models (one per fold).
- Evaluates out-of-fold on both censored validation snapshots and full lifecycles.
- Aggregates predictions across all 100 units to compute the true Fleet OOF Score.
- Saves out-of-fold predictions to 'kfold_data/oof_predictions_FD001.csv'.
"""

import json
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
import xgboost as xgb

BASE_DIR = Path(__file__).resolve().parent
KFOLD_DIR = BASE_DIR / "kfold_data"
SUBSET = "FD001"

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


def add_features(df: pd.DataFrame) -> tuple:
    df = df.copy().sort_values(by=[ID_COL, CYCLE_COL])
    grouped = df.groupby(ID_COL)
    feat_cols = []

    # Healthy baseline drift (first 5 cycles)
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


def run_kfold_cv(n_splits: int = 5):
    print("=" * 75)
    print(f"  STARTING {n_splits}-FOLD CROSS-VALIDATION ON NASA C-MAPSS {SUBSET}")
    print("=" * 75)

    fold_metrics = []
    oof_records = []

    subset_dir = KFOLD_DIR / SUBSET

    for fold_idx in range(n_splits):
        f_dir = subset_dir / f"fold_{fold_idx}"

        # 1. Load train split and censored validation
        train_df = pd.read_csv(f_dir / "train_split.txt", sep=r"\s+", header=None, names=ALL_COLS)
        val_censored_df = pd.read_csv(f_dir / "val_censored.txt", sep=r"\s+", header=None, names=ALL_COLS)
        val_true_rul = np.loadtxt(f_dir / "val_RUL.txt")

        # 2. Target calculation on train fold
        max_c = train_df.groupby(ID_COL)[CYCLE_COL].transform("max")
        train_df["target_rul"] = (max_c - train_df[CYCLE_COL]).clip(upper=125)

        # 3. Feature extraction
        train_feat, feat_cols = add_features(train_df)
        val_censored_feat, _ = add_features(val_censored_df)

        val_last = val_censored_feat.groupby(ID_COL).last().reset_index()

        X_train = train_feat[feat_cols]
        y_train = train_feat["target_rul"].values
        X_val = val_last[feat_cols]

        # 4. Train fold model
        model = xgb.XGBRegressor(
            n_estimators=120,
            max_depth=4,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=42,
            n_jobs=-1,
        )
        model.fit(X_train, y_train)

        # 5. Evaluate on fold validation units
        val_preds = np.clip(model.predict(X_val), 0, None)

        rmse = np.sqrt(mean_squared_error(val_true_rul, val_preds))
        mae = mean_absolute_error(val_true_rul, val_preds)
        r2 = r2_score(val_true_rul, val_preds)
        phm = compute_nasa_phm_score(val_true_rul, val_preds)

        fold_metrics.append({
            "Fold": f"Fold {fold_idx + 1}",
            "Train Units": train_df[ID_COL].nunique(),
            "Val Units": len(val_true_rul),
            "RMSE": round(rmse, 2),
            "MAE": round(mae, 2),
            "R²": round(r2, 4),
            "NASA PHM": round(phm, 1),
        })

        # Collect OOF predictions
        for uid, cutoff, true_r, pred_r in zip(val_last[ID_COL], val_last[CYCLE_COL], val_true_rul, val_preds):
            oof_records.append({
                "unit_id": int(uid),
                "fold": fold_idx,
                "cutoff_cycle": int(cutoff),
                "actual_rul": int(true_r),
                "predicted_rul": round(float(pred_r), 2),
                "error": round(float(pred_r - true_r), 2),
            })

        print(f"  -> Fold {fold_idx + 1}/5 completed: RMSE={rmse:.2f}, MAE={mae:.2f}, R²={r2:.4f}, NASA Score={phm:.1f}")

    # Summary table
    metrics_df = pd.DataFrame(fold_metrics)
    mean_rmse = np.mean([m["RMSE"] for m in fold_metrics])
    std_rmse = np.std([m["RMSE"] for m in fold_metrics])
    mean_mae = np.mean([m["MAE"] for m in fold_metrics])
    std_mae = np.std([m["MAE"] for m in fold_metrics])
    mean_r2 = np.mean([m["R²"] for m in fold_metrics])
    total_phm = np.sum([m["NASA PHM"] for m in fold_metrics])

    print("\n" + "=" * 75)
    print("  K-FOLD CROSS-VALIDATION SUMMARY TABLE")
    print("=" * 75)
    print(metrics_df.to_string(index=False))
    print("-" * 75)
    print(f"  CROSS-VALIDATED MEAN RMSE:     {mean_rmse:.2f} ± {std_rmse:.2f} cycles")
    print(f"  CROSS-VALIDATED MEAN MAE:      {mean_mae:.2f} ± {std_mae:.2f} cycles")
    print(f"  CROSS-VALIDATED MEAN R²:       {mean_r2:.4f}")
    print(f"  FLEET-WIDE TOTAL NASA SCORE:   {total_phm:.1f}")
    print("=" * 75)

    # Save OOF predictions
    oof_df = pd.DataFrame(oof_records).sort_values("unit_id").reset_index(drop=True)
    oof_path = KFOLD_DIR / f"oof_predictions_{SUBSET}.csv"
    oof_df.to_csv(oof_path, index=False)

    # Calculate overall Fleet Out-of-Fold Metrics across all 100 engines
    overall_rmse = np.sqrt(mean_squared_error(oof_df["actual_rul"], oof_df["predicted_rul"]))
    overall_mae = mean_absolute_error(oof_df["actual_rul"], oof_df["predicted_rul"])
    overall_r2 = r2_score(oof_df["actual_rul"], oof_df["predicted_rul"])
    print(f"\n  FLEET-WIDE OUT-OF-FOLD EVALUATION (ALL {len(oof_df)} ENGINES VALIDATED ONCE):")
    print(f"    - Overall OOF RMSE: {overall_rmse:.2f} cycles")
    print(f"    - Overall OOF MAE:  {overall_mae:.2f} cycles")
    print(f"    - Overall OOF R²:   {overall_r2:.4f} ({overall_r2*100:.1f}%)")
    print(f"    - Saved OOF predictions to {oof_path.name}")
    print("=" * 75 + "\n")

    return metrics_df, oof_df


if __name__ == "__main__":
    run_kfold_cv()
