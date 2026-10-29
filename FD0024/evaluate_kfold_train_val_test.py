"""
Comprehensive 4-Way Evaluation:
Training vs. K-Fold Continuous Validation vs. K-Fold Censored Validation vs. Official Test Set
for NASA C-MAPSS FD002 & FD004 using SOTA Regime-Normalized Models in FD0024.
"""

import sys
import json
import time
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.metrics import (
    mean_squared_error, mean_absolute_error, r2_score,
    accuracy_score, precision_score, recall_score, f1_score
)
import joblib
import torch
import torch.nn as nn

# Ensure FD0024 is on sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
FD0024_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(FD0024_DIR))

from regime_normalizer import RegimeNormalizer
from model_architectures import AttentionCNNBiLSTM

DATA_DIR = BASE_DIR / "CMaps"
KFOLD_DIR = BASE_DIR / "kfold_data"
MODELS_DIR = FD0024_DIR / "models"
BENCHMARKS_DIR = FD0024_DIR / "benchmarks"

ID_COL = "unit_id"
CYCLE_COL = "cycle"
SETTINGS_COLS = ["setting_1", "setting_2", "setting_3"]
SENSOR_COLS = [f"s_{i}" for i in range(1, 22)]
ALL_COLS = [ID_COL, CYCLE_COL] + SETTINGS_COLS + SENSOR_COLS

RUL_CLIP_THRESHOLD = 125
WINDOW_SIZE = 30
ALERT_THRESHOLD = 30
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")


def compute_nasa_phm_score(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    d = np.array(y_pred) - np.array(y_true)
    score = np.where(d < 0, np.exp(-d / 13.0) - 1.0, np.exp(d / 10.0) - 1.0)
    return float(np.sum(score))


def compute_metrics(subset: str, model_name: str, split_name: str, y_true: np.ndarray, y_pred: np.ndarray) -> dict:
    y_pred = np.clip(y_pred, 0, None)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    mae = mean_absolute_error(y_true, y_pred)
    r2 = r2_score(y_true, y_pred)
    nasa_score = compute_nasa_phm_score(y_true, y_pred)
    acc_10 = float(np.mean(np.abs(y_pred - y_true) <= 10) * 100.0)
    acc_20 = float(np.mean(np.abs(y_pred - y_true) <= 20) * 100.0)

    # 30-cycle alert accuracy
    y_true_bin = (y_true <= ALERT_THRESHOLD).astype(int)
    y_pred_bin = (y_pred <= ALERT_THRESHOLD).astype(int)

    acc_alert = float(accuracy_score(y_true_bin, y_pred_bin) * 100.0)
    prec_alert = float(precision_score(y_true_bin, y_pred_bin, zero_division=0) * 100.0)
    rec_alert = float(recall_score(y_true_bin, y_pred_bin, zero_division=0) * 100.0)
    f1_alert = float(f1_score(y_true_bin, y_pred_bin, zero_division=0) * 100.0)

    return {
        "Subset": subset,
        "Model": model_name,
        "Split": split_name,
        "Samples": len(y_true),
        "R² Score": round(float(r2), 4),
        "RMSE (cycles)": round(float(rmse), 2),
        "MAE (cycles)": round(float(mae), 2),
        "Acc (±10 cycles)": f"{acc_10:.1f}%",
        "Acc (±20 cycles)": f"{acc_20:.1f}%",
        "NASA PHM Score": round(float(nasa_score), 1),
        "Alert Accuracy": f"{acc_alert:.1f}%",
        "Alert Precision": f"{prec_alert:.1f}%",
        "Alert Recall": f"{rec_alert:.1f}%",
        "Alert F1-Score": f"{f1_alert:.1f}%",
    }


def build_test_windows(df: pd.DataFrame, feature_cols: list, window_size: int = 30) -> np.ndarray:
    """Extracts strictly the last window for each engine."""
    sequences = []
    for uid, grp in df.groupby(ID_COL):
        vals = grp[feature_cols].values
        n = len(vals)
        if n >= window_size:
            sequences.append(vals[-window_size:])
        else:
            pad = np.repeat(vals[0:1], window_size - n, axis=0)
            sequences.append(np.vstack([pad, vals]))
    return np.array(sequences, dtype=np.float32)


def build_all_windows(df: pd.DataFrame, feature_cols: list, window_size: int = 30, sample_size: int = None, seed: int = 42):
    """Extracts sliding sequence windows with target RUL across continuous lifespans."""
    sequences, targets = [], []
    for uid, grp in df.groupby(ID_COL):
        vals = grp[feature_cols].values
        ruls = grp["target_rul"].values
        n = len(vals)
        if n >= window_size:
            for i in range(n - window_size + 1):
                sequences.append(vals[i : i + window_size])
                targets.append(ruls[i + window_size - 1])
        else:
            pad = np.repeat(vals[0:1], window_size - n, axis=0)
            sequences.append(np.vstack([pad, vals]))
            targets.append(ruls[-1])
    sequences = np.array(sequences, dtype=np.float32)
    targets = np.array(targets, dtype=np.float32)
    if sample_size and len(sequences) > sample_size:
        rng = np.random.RandomState(seed)
        idx = rng.choice(len(sequences), size=sample_size, replace=False)
        return sequences[idx], targets[idx]
    return sequences, targets


def evaluate_subset(subset: str = "FD002") -> list:
    print(f"\n{'='*75}")
    print(f"  EVALUATING SOTA MODELS ON {subset}: TRAIN vs. K-FOLD VAL vs. TEST")
    print(f"{'='*75}")

    # 1. Load artifacts
    normalizer_path = MODELS_DIR / f"regime_normalizer_{subset}.joblib"
    normalizer: RegimeNormalizer = joblib.load(normalizer_path)

    xgb_path = MODELS_DIR / f"xgb_regime_{subset}.joblib"
    xgb_model = joblib.load(xgb_path)

    norm_sensor_cols = [f"{s}_norm" for s in normalizer.active_sensors]
    feature_cols = [f"{c}_ema" for c in norm_sensor_cols]

    dl_model_path = MODELS_DIR / f"best_attention_cnn_bilstm_{subset}.pt"
    dl_model = AttentionCNNBiLSTM(
        input_dim=len(feature_cols),
        conv_channels=64,
        kernel_size=3,
        lstm_hidden=64,
        lstm_layers=2,
        dropout=0.25
    ).to(DEVICE)
    dl_model.load_state_dict(torch.load(dl_model_path, map_location=DEVICE, weights_only=True))
    dl_model.eval()

    # Preprocessing helper
    def preprocess_df(raw_df: pd.DataFrame, compute_rul: bool = True):
        df = raw_df.copy()
        if compute_rul:
            max_c = df.groupby(ID_COL)[CYCLE_COL].transform("max")
            df["raw_rul"] = max_c - df[CYCLE_COL]
            df["target_rul"] = df["raw_rul"].clip(upper=RUL_CLIP_THRESHOLD)
        df = normalizer.transform(df)
        for c in norm_sensor_cols:
            df[f"{c}_ema"] = df.groupby(ID_COL)[c].transform(lambda x: x.ewm(span=5).mean())
            df[f"{c}_rstd5"] = df.groupby(ID_COL)[c].transform(lambda x: x.rolling(5, min_periods=1).std().fillna(0))
        return df

    def get_xgb_features(df: pd.DataFrame):
        feat_list = []
        for c in norm_sensor_cols:
            feat_list.extend([f"{c}_ema", f"{c}_rstd5"])
        return df[feat_list + [CYCLE_COL]]

    # -------------------------------------------------------------------------
    # 2. Data Splits (Using K-Fold Directory for strict consistency)
    # -------------------------------------------------------------------------
    fold_dir = KFOLD_DIR / subset / "fold_0"

    # Train split
    train_raw = pd.read_csv(fold_dir / "train_split.txt", sep=r"\s+", header=None, names=ALL_COLS)
    train_df = preprocess_df(train_raw, compute_rul=True)

    # Validation Full (Continuous Degradation Tracking)
    val_full_raw = pd.read_csv(fold_dir / "val_full.csv")
    val_full_df = preprocess_df(val_full_raw, compute_rul=False)  # target_rul already in val_full.csv

    # Validation Censored (Official K-Fold Test-Style Snapshot)
    val_censored_raw = pd.read_csv(fold_dir / "val_censored.txt", sep=r"\s+", header=None, names=ALL_COLS)
    val_censored_df = preprocess_df(val_censored_raw, compute_rul=False)
    val_true_rul = np.loadtxt(fold_dir / "val_RUL.txt")

    # Official Test Set
    test_raw = pd.read_csv(DATA_DIR / f"test_{subset}.txt", sep=r"\s+", header=None, names=ALL_COLS)
    test_df = preprocess_df(test_raw, compute_rul=False)
    test_true_rul = np.loadtxt(DATA_DIR / f"RUL_{subset}.txt")

    results = []

    # -------------------------------------------------------------------------
    # 3. Evaluate Deep Attention-CNN-BiLSTM
    # -------------------------------------------------------------------------
    print(f"[{subset}] Evaluating Attention-CNN-BiLSTM...")
    # Train Split (Sampled 2000 windows across lifecycle for exact comparability)
    X_train_seq, y_train_true = build_all_windows(train_df, feature_cols, WINDOW_SIZE, sample_size=2000, seed=42)
    with torch.no_grad():
        y_train_dl = np.clip(dl_model(torch.tensor(X_train_seq).to(DEVICE)).cpu().numpy(), 0, None)
    results.append(compute_metrics(subset, "Attention-CNN-BiLSTM", "Training Split (Sampled)", y_train_true, y_train_dl))

    # Validation Continuous Full (8,000+ run-to-failure cycles)
    X_val_full_seq, y_val_full_true = build_all_windows(val_full_df, feature_cols, WINDOW_SIZE)
    with torch.no_grad():
        y_val_full_dl = np.clip(dl_model(torch.tensor(X_val_full_seq).to(DEVICE)).cpu().numpy(), 0, None)
    results.append(compute_metrics(subset, "Attention-CNN-BiLSTM", "K-Fold Val (Continuous Full Life)", y_val_full_true, y_val_full_dl))

    # Validation Censored (K-Fold Held-out Engines - Last Window)
    X_val_seq = build_test_windows(val_censored_df, feature_cols, WINDOW_SIZE)
    with torch.no_grad():
        y_val_dl = np.clip(dl_model(torch.tensor(X_val_seq).to(DEVICE)).cpu().numpy(), 0, None)
    results.append(compute_metrics(subset, "Attention-CNN-BiLSTM", "K-Fold Val (Censored Snapshot)", val_true_rul, y_val_dl))

    # Official Test Set (Held-out Engines - Last Window)
    X_test_seq = build_test_windows(test_df, feature_cols, WINDOW_SIZE)
    with torch.no_grad():
        y_test_dl = np.clip(dl_model(torch.tensor(X_test_seq).to(DEVICE)).cpu().numpy(), 0, None)
    results.append(compute_metrics(subset, "Attention-CNN-BiLSTM", "Official NASA Test Set", test_true_rul, y_test_dl))

    # -------------------------------------------------------------------------
    # 4. Evaluate XGBoost Baseline (Regime-Normalized)
    # -------------------------------------------------------------------------
    print(f"[{subset}] Evaluating XGBoost (Regime-Norm)...")
    # Train
    train_sample = train_df.sample(n=min(len(train_df), 2000), random_state=42)
    y_train_xgb = np.clip(xgb_model.predict(get_xgb_features(train_sample)), 0, None)
    results.append(compute_metrics(subset, "XGBoost (Regime-Norm)", "Training Split (Sampled)", train_sample["target_rul"].values, y_train_xgb))

    # Val Full Continuous
    y_val_full_xgb = np.clip(xgb_model.predict(get_xgb_features(val_full_df)), 0, None)
    results.append(compute_metrics(subset, "XGBoost (Regime-Norm)", "K-Fold Val (Continuous Full Life)", val_full_df["target_rul"].values, y_val_full_xgb))

    # Val Censored
    val_last = val_censored_df.groupby(ID_COL).last().reset_index()
    y_val_xgb = np.clip(xgb_model.predict(get_xgb_features(val_last)), 0, None)
    results.append(compute_metrics(subset, "XGBoost (Regime-Norm)", "K-Fold Val (Censored Snapshot)", val_true_rul, y_val_xgb))

    # Test
    test_last = test_df.groupby(ID_COL).last().reset_index()
    y_test_xgb = np.clip(xgb_model.predict(get_xgb_features(test_last)), 0, None)
    results.append(compute_metrics(subset, "XGBoost (Regime-Norm)", "Official NASA Test Set", test_true_rul, y_test_xgb))

    return results


def main():
    start = time.time()
    res_fd002 = evaluate_subset("FD002")
    res_fd004 = evaluate_subset("FD004")

    all_results = res_fd002 + res_fd004
    df = pd.DataFrame(all_results)

    output_csv = BENCHMARKS_DIR / "kfold_train_val_test_benchmarks.csv"
    output_json = BENCHMARKS_DIR / "kfold_train_val_test_benchmarks.json"
    df.to_csv(output_csv, index=False)
    with open(output_json, "w") as f:
        json.dump(all_results, f, indent=2)

    print("\n" + "=" * 110)
    print("  COMPLETE 4-WAY BENCHMARK: TRAINING vs. K-FOLD VAL vs. TEST")
    print("=" * 110)
    print(df.to_string(index=False))
    print("=" * 110 + "\n")
    print(f"Saved reports to:\n - {output_csv}\n - {output_json}\nElapsed: {time.time()-start:.1f}s")


if __name__ == "__main__":
    main()
