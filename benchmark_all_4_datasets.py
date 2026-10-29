"""
Master 3-Way Benchmark Across All 4 C-MAPSS Subsets (FD001, FD002, FD003, FD004)
=================================================================================
Evaluates the trained models from 'Updated_Models/' across:
1. Training Split (train_split_FD00x.txt)
2. Validation Split (val_censored_FD00x.txt vs val_RUL_FD00x.txt)
3. Official NASA Test Set (test_FD00x.txt vs RUL_FD00x.txt)

Computes:
- Regression Accuracy: R², RMSE, MAE, Accuracy within ±10 cycles, Accuracy within ±20 cycles, NASA Score.
- Alert Accuracy: Failure prediction accuracy within 30 cycles (Accuracy %, Precision %, Recall %, F1-Score %).
"""

import json
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

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "CMaps"
VAL_DIR = BASE_DIR / "validation_data"
MODELS_DIR = BASE_DIR / "Updated_Models"

ID_COL = "unit_id"
CYCLE_COL = "cycle"
SETTING_COLS = ["setting_1", "setting_2", "setting_3"]
SENSOR_COLS = [f"s_{i}" for i in range(1, 22)]
ALL_COLS = [ID_COL, CYCLE_COL] + SETTING_COLS + SENSOR_COLS
ALERT_THRESHOLD = 30
SEQ_LEN = 20

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")


# -----------------------------------------------------------------------------
# Deep Learning Architecture Definitions for FD002 & FD004
# -----------------------------------------------------------------------------
class CNNLSTMHybridRegressor(nn.Module):
    def __init__(self, input_size: int = 24, conv_filters: int = 32, kernel_size: int = 3, lstm_hidden: int = 64, dropout: float = 0.2):
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv1d(in_channels=input_size, out_channels=conv_filters, kernel_size=kernel_size, padding=kernel_size // 2),
            nn.ReLU(),
            nn.Dropout(dropout)
        )
        self.lstm = nn.LSTM(input_size=conv_filters, hidden_size=lstm_hidden, batch_first=True)
        self.fc = nn.Sequential(
            nn.Linear(lstm_hidden, 32),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(32, 1)
        )

    def forward(self, x):
        x_conv = x.permute(0, 2, 1)
        feat = self.conv(x_conv).permute(0, 2, 1)
        out, _ = self.lstm(feat)
        return self.fc(out[:, -1, :]).squeeze(-1)


# -----------------------------------------------------------------------------
# Metric Calculations
# -----------------------------------------------------------------------------
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

    # 30-cycle early warning failure alert
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


# -----------------------------------------------------------------------------
# Evaluation for Tree Models (FD001 & FD003)
# -----------------------------------------------------------------------------
def evaluate_tree_subset(subset: str = "FD001") -> list:
    print(f"\n--- Evaluating {subset} (Single Condition / XGBoost) ---")
    # Load model artifact
    model_path = MODELS_DIR / f"xgb_regressor_{subset}.joblib"
    artifact = joblib.load(model_path)
    model = artifact["model"]
    feature_cols = artifact["feature_cols"]
    constant_cols = artifact["constant_cols"]
    active_sensors = [s for s in SENSOR_COLS if s not in constant_cols]

    def extract_features(df):
        df = df.copy().sort_values(by=[ID_COL, CYCLE_COL])
        grouped = df.groupby(ID_COL)
        base = df[df[CYCLE_COL] <= 5].groupby(ID_COL)[active_sensors].mean().reset_index()
        df = df.merge(base, on=ID_COL, suffixes=("", "_base"))
        for s in active_sensors:
            df[f"{s}_drift"] = df[s] - df[f"{s}_base"]
            df.drop(columns=[f"{s}_base"], inplace=True)
        for s in active_sensors:
            df[f"{s}_rm5"] = grouped[s].transform(lambda x: x.rolling(5, min_periods=1).mean())
            df[f"{s}_rm15"] = grouped[s].transform(lambda x: x.rolling(15, min_periods=1).mean())
            df[f"{s}_rstd10"] = grouped[s].transform(lambda x: x.rolling(10, min_periods=1).std().fillna(0))
        return df

    # 1. Train Split
    train_df = pd.read_csv(VAL_DIR / f"train_split_{subset}.txt", sep=r"\s+", header=None, names=ALL_COLS)
    max_c = train_df.groupby(ID_COL)[CYCLE_COL].transform("max")
    train_df["target_rul"] = (max_c - train_df[CYCLE_COL]).clip(upper=125)
    train_feat = extract_features(train_df)
    train_sample = train_feat.sample(n=min(len(train_feat), 2000), random_state=42)
    y_train_true = train_sample["target_rul"].values
    y_train_pred = model.predict(train_sample[feature_cols])

    # 2. Validation Split
    val_df = pd.read_csv(VAL_DIR / f"val_censored_{subset}.txt", sep=r"\s+", header=None, names=ALL_COLS)
    val_true_rul = np.loadtxt(VAL_DIR / f"val_RUL_{subset}.txt")
    val_feat = extract_features(val_df)
    val_last = val_feat.groupby(ID_COL).last().reset_index()
    y_val_pred = model.predict(val_last[feature_cols])

    # 3. Test Set
    test_df = pd.read_csv(DATA_DIR / f"test_{subset}.txt", sep=r"\s+", header=None, names=ALL_COLS)
    test_true_rul = np.loadtxt(DATA_DIR / f"RUL_{subset}.txt")
    test_feat = extract_features(test_df)
    test_last = test_feat.groupby(ID_COL).last().reset_index()
    y_test_pred = model.predict(test_last[feature_cols])

    return [
        compute_metrics(subset, "XGBoost", "Training Split (Sampled)", y_train_true, y_train_pred),
        compute_metrics(subset, "XGBoost", "Validation Split (Held-out)", val_true_rul, y_val_pred),
        compute_metrics(subset, "XGBoost", "Official Test Set", test_true_rul, y_test_pred),
    ]


# -----------------------------------------------------------------------------
# Evaluation for Deep Learning Models (FD002 & FD004)
# -----------------------------------------------------------------------------
def evaluate_dl_subset(subset: str = "FD002") -> list:
    print(f"\n--- Evaluating {subset} (Six Regimes / 1D CNN-LSTM Hybrid) ---")
    model_path = MODELS_DIR / f"cnn_lstm_regressor_{subset}.pt"
    scaler_path = MODELS_DIR / f"scaler_{subset}.joblib"
    scaler = joblib.load(scaler_path)

    feature_cols = SETTING_COLS + SENSOR_COLS
    model = CNNLSTMHybridRegressor(input_size=len(feature_cols)).to(DEVICE)
    model.load_state_dict(torch.load(model_path, map_location=DEVICE, weights_only=True))
    model.eval()

    def get_test_sequences(df):
        df_scaled = df.copy()
        df_scaled[feature_cols] = scaler.transform(df_scaled[feature_cols])
        seqs = []
        for uid, grp in df_scaled.groupby(ID_COL):
            vals = grp[feature_cols].values
            n = len(vals)
            if n >= SEQ_LEN:
                seqs.append(vals[-SEQ_LEN:])
            else:
                pad = np.repeat(vals[0:1], SEQ_LEN - n, axis=0)
                seqs.append(np.vstack([pad, vals]))
        return np.array(seqs, dtype=np.float32)

    def get_train_sequences(df, max_samples=2000):
        df_scaled = df.copy()
        max_c = df_scaled.groupby(ID_COL)[CYCLE_COL].transform("max")
        df_scaled["target_rul"] = (max_c - df_scaled[CYCLE_COL]).clip(upper=125)
        df_scaled[feature_cols] = scaler.transform(df_scaled[feature_cols])
        seqs, targets = [], []
        for uid, grp in df_scaled.groupby(ID_COL):
            vals = grp[feature_cols].values
            ruls = grp["target_rul"].values
            n = len(vals)
            if n >= SEQ_LEN:
                for i in range(0, n - SEQ_LEN + 1, 2):  # step of 2 to sub-sample
                    seqs.append(vals[i : i + SEQ_LEN])
                    targets.append(ruls[i + SEQ_LEN - 1])
        seqs = np.array(seqs, dtype=np.float32)
        targets = np.array(targets, dtype=np.float32)
        if len(seqs) > max_samples:
            idx = np.random.RandomState(42).choice(len(seqs), max_samples, replace=False)
            return seqs[idx], targets[idx]
        return seqs, targets

    # 1. Train Split
    train_df = pd.read_csv(VAL_DIR / f"train_split_{subset}.txt", sep=r"\s+", header=None, names=ALL_COLS)
    X_train_seq, y_train_true = get_train_sequences(train_df)
    with torch.no_grad():
        y_train_pred = model(torch.tensor(X_train_seq).to(DEVICE)).cpu().numpy()

    # 2. Validation Split
    val_df = pd.read_csv(VAL_DIR / f"val_censored_{subset}.txt", sep=r"\s+", header=None, names=ALL_COLS)
    val_true_rul = np.loadtxt(VAL_DIR / f"val_RUL_{subset}.txt")
    X_val_seq = get_test_sequences(val_df)
    with torch.no_grad():
        y_val_pred = model(torch.tensor(X_val_seq).to(DEVICE)).cpu().numpy()

    # 3. Test Set
    test_df = pd.read_csv(DATA_DIR / f"test_{subset}.txt", sep=r"\s+", header=None, names=ALL_COLS)
    test_true_rul = np.loadtxt(DATA_DIR / f"RUL_{subset}.txt")
    X_test_seq = get_test_sequences(test_df)
    with torch.no_grad():
        y_test_pred = model(torch.tensor(X_test_seq).to(DEVICE)).cpu().numpy()

    return [
        compute_metrics(subset, "1D CNN-LSTM", "Training Split (Sampled)", y_train_true, y_train_pred),
        compute_metrics(subset, "1D CNN-LSTM", "Validation Split (Held-out)", val_true_rul, y_val_pred),
        compute_metrics(subset, "1D CNN-LSTM", "Official Test Set", test_true_rul, y_test_pred),
    ]


# -----------------------------------------------------------------------------
# Main Orchestrator
# -----------------------------------------------------------------------------
def main():
    print("=" * 85)
    print("  NASA C-MAPSS FULL BENCHMARK SUITE: ALL 4 DATASETS (TRAIN vs. VAL vs. TEST)")
    print("  Using Models from Updated_Models/")
    print("=" * 85)

    all_results = []

    # FD001
    all_results.extend(evaluate_tree_subset("FD001"))

    # FD002
    all_results.extend(evaluate_dl_subset("FD002"))

    # FD003
    all_results.extend(evaluate_tree_subset("FD003"))

    # FD004
    all_results.extend(evaluate_dl_subset("FD004"))

    df_results = pd.DataFrame(all_results)

    # Save to disk
    json_path = MODELS_DIR / "all_4_datasets_train_val_test_benchmarks.json"
    csv_path = MODELS_DIR / "all_4_datasets_train_val_test_benchmarks.csv"

    df_results.to_json(json_path, orient="records", indent=2)
    df_results.to_csv(csv_path, index=False)

    print("\n" + "=" * 105)
    print("  COMPLETE 4-DATASET 3-WAY ACCURACY BENCHMARK TABLE")
    print("=" * 105)
    cols_display = [
        "Subset", "Model", "Split", "Samples", "R² Score", "RMSE (cycles)", "MAE (cycles)",
        "Acc (±10 cycles)", "Acc (±20 cycles)", "NASA PHM Score"
    ]
    print(df_results[cols_display].to_string(index=False))

    print("\n" + "=" * 105)
    print("  CRITICAL EARLY-WARNING ALERT ACCURACY TABLE (Failure within 30 Cycles)")
    print("=" * 105)
    alert_cols = ["Subset", "Model", "Split", "Alert Accuracy", "Alert Precision", "Alert Recall", "Alert F1-Score"]
    print(df_results[alert_cols].to_string(index=False))
    print("=" * 105 + "\n")

    print(f"Results successfully exported to:")
    print(f"  - {json_path}")
    print(f"  - {csv_path}\n")


if __name__ == "__main__":
    main()
