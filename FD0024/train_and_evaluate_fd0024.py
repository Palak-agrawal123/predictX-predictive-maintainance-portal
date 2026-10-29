"""
Master Training & Evaluation Pipeline for FD002 & FD004 (FD0024 Package)
========================================================================
Implements the 5 core diagnostic fixes:
1. Operating-Regime Normalization (KMeans k=6 on settings, fitted strictly on train).
2. Piecewise-linear RUL target capping (R_clip = 125 cycles).
3. Feature selection (drops flat sensors s_1, s_5, s_18, s_19) & EMA noise smoothing.
4. Unit-stratified validation split (80% train engines / 20% validation engines).
5. Sequence model with temporal attention (Attention-CNN-BiLSTM) + Regularized XGBoost baseline.
6. Standard NASA evaluation protocol: evaluates strictly on the last window of each test engine.
"""

import os
import sys
import json
import time
from pathlib import Path

# Ensure FD0024 directory is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

import numpy as np
import pandas as pd
import joblib

import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
import xgboost as xgb

from regime_normalizer import RegimeNormalizer
from model_architectures import AttentionCNNBiLSTM

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "CMaps"
OUTPUT_DIR = Path(__file__).resolve().parent
MODELS_DIR = OUTPUT_DIR / "models"
BENCHMARKS_DIR = OUTPUT_DIR / "benchmarks"

MODELS_DIR.mkdir(parents=True, exist_ok=True)
BENCHMARKS_DIR.mkdir(parents=True, exist_ok=True)

ID_COL = "unit_id"
CYCLE_COL = "cycle"
SETTINGS_COLS = ["setting_1", "setting_2", "setting_3"]
SENSOR_COLS = [f"s_{i}" for i in range(1, 22)]
ALL_COLS = [ID_COL, CYCLE_COL] + SETTINGS_COLS + SENSOR_COLS

RUL_CLIP_THRESHOLD = 125
WINDOW_SIZE = 30
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Deep Learning Device: {DEVICE}")


# -----------------------------------------------------------------------------
# Metric Calculations
# -----------------------------------------------------------------------------
def compute_nasa_phm_score(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """
    Official NASA PHM Prognostics score:
    Penalizes late predictions exponentially more than early predictions.
    """
    d = np.array(y_pred) - np.array(y_true)
    score = np.where(d < 0, np.exp(-d / 13.0) - 1.0, np.exp(d / 10.0) - 1.0)
    return float(np.sum(score))


# -----------------------------------------------------------------------------
# PyTorch Dataset for Sequence Windows
# -----------------------------------------------------------------------------
class WindowedSequenceDataset(Dataset):
    def __init__(self, sequences: np.ndarray, targets: np.ndarray):
        self.sequences = torch.tensor(sequences, dtype=torch.float32)
        self.targets = torch.tensor(targets, dtype=torch.float32)

    def __len__(self):
        return len(self.sequences)

    def __getitem__(self, idx):
        return self.sequences[idx], self.targets[idx]


def build_sequence_windows(df: pd.DataFrame, feature_cols: list, window_size: int = 30, is_test: bool = False):
    """
    Constructs sliding sequence windows of fixed length.
    If is_test is True, extracts strictly the LAST window of each engine unit (NASA standard protocol).
    """
    sequences, targets = [], []
    for uid, grp in df.groupby(ID_COL):
        vals = grp[feature_cols].values
        n = len(vals)
        if not is_test:
            ruls = grp["target_rul"].values
            if n >= window_size:
                for i in range(n - window_size + 1):
                    sequences.append(vals[i : i + window_size])
                    targets.append(ruls[i + window_size - 1])
            else:
                pad = np.repeat(vals[0:1], window_size - n, axis=0)
                sequences.append(np.vstack([pad, vals]))
                targets.append(ruls[-1])
        else:
            # For test: extract strictly the last window of each engine
            if n >= window_size:
                sequences.append(vals[-window_size:])
            else:
                pad = np.repeat(vals[0:1], window_size - n, axis=0)
                sequences.append(np.vstack([pad, vals]))

    if not is_test:
        return np.array(sequences, dtype=np.float32), np.array(targets, dtype=np.float32)
    return np.array(sequences, dtype=np.float32)


# -----------------------------------------------------------------------------
# End-to-End Pipeline for a Given Subset (FD002 or FD004)
# -----------------------------------------------------------------------------
def run_pipeline_for_subset(subset: str = "FD002", epochs: int = 25, batch_size: int = 256):
    print("\n" + "=" * 80)
    print(f"  EXECUTING SOTA REGIME-NORMALIZED PIPELINE FOR: {subset}")
    print("=" * 80)

    # 1. Load Raw Datasets
    train_path = DATA_DIR / f"train_{subset}.txt"
    test_path = DATA_DIR / f"test_{subset}.txt"
    rul_path = DATA_DIR / f"RUL_{subset}.txt"

    train_df = pd.read_csv(train_path, sep=r"\s+", header=None, names=ALL_COLS)
    test_df = pd.read_csv(test_path, sep=r"\s+", header=None, names=ALL_COLS)
    test_rul = pd.read_csv(rul_path, sep=r"\s+", header=None)[0].values

    # 2. Capped Piecewise-Linear Target RUL (Standard NASA PHM Practice)
    max_c = train_df.groupby(ID_COL)[CYCLE_COL].transform("max")
    train_df["raw_rul"] = max_c - train_df[CYCLE_COL]
    train_df["target_rul"] = train_df["raw_rul"].clip(upper=RUL_CLIP_THRESHOLD)

    # 3. Leak-Free Engine-Unit Validation Split (80% Train, 20% Val)
    unique_units = np.array(sorted(train_df[ID_COL].unique()))
    rng = np.random.RandomState(42)
    n_val = int(np.round(len(unique_units) * 0.20))
    val_units = sorted(list(rng.choice(unique_units, size=n_val, replace=False)))
    train_units = sorted(list(set(unique_units) - set(val_units)))

    train_split = train_df[train_df[ID_COL].isin(train_units)].copy().reset_index(drop=True)
    val_split = train_df[train_df[ID_COL].isin(val_units)].copy().reset_index(drop=True)

    print(f"[{subset}] Engines split: {len(train_units)} Train units ({len(train_split):,} cycles), {len(val_units)} Validation units ({len(val_split):,} cycles)")

    # 4. Operating-Regime Specific Normalization (KMeans k=6 fitted strictly on train_split)
    print(f"[{subset}] Fitting KMeans (k=6) regime clustering on train split operational settings...")
    normalizer = RegimeNormalizer(n_clusters=6, random_state=42)
    normalizer.fit(train_split)

    print(f"[{subset}] Detected flat uninformative sensors: {normalizer.flat_sensors}")
    print(f"[{subset}] Active informative sensors ({len(normalizer.active_sensors)}): {normalizer.active_sensors}")

    # Save normalizer
    normalizer.save(MODELS_DIR / f"regime_normalizer_{subset}.joblib")

    # Transform splits
    train_split = normalizer.transform(train_split)
    val_split = normalizer.transform(val_split)
    test_df = normalizer.transform(test_df)

    # 5. Exponential Moving Average (EMA) Smoothing per Engine
    norm_sensor_cols = [f"{s}_norm" for s in normalizer.active_sensors]
    for c in norm_sensor_cols:
        train_split[f"{c}_ema"] = train_split.groupby(ID_COL)[c].transform(lambda x: x.ewm(span=5).mean())
        val_split[f"{c}_ema"] = val_split.groupby(ID_COL)[c].transform(lambda x: x.ewm(span=5).mean())
        test_df[f"{c}_ema"] = test_df.groupby(ID_COL)[c].transform(lambda x: x.ewm(span=5).mean())

    feature_cols = [f"{c}_ema" for c in norm_sensor_cols]

    # -------------------------------------------------------------------------
    # Model A: Regime-Normalized XGBoost Baseline (Fast Sanity-Check)
    # -------------------------------------------------------------------------
    print(f"\n[{subset}] Training Regime-Normalized XGBoost Baseline...")
    # Add rolling volatility and drift for tabular tree model
    def add_tree_features(df):
        df = df.copy()
        feat_list = []
        for c in norm_sensor_cols:
            df[f"{c}_rstd5"] = df.groupby(ID_COL)[c].transform(lambda x: x.rolling(5, min_periods=1).std().fillna(0))
            feat_list.extend([f"{c}_ema", f"{c}_rstd5"])
        return df, feat_list + [CYCLE_COL]

    train_tree_df, tree_feats = add_tree_features(train_split)
    val_tree_df, _ = add_tree_features(val_split)
    test_tree_df, _ = add_tree_features(test_df)

    test_tree_last = test_tree_df.groupby(ID_COL).last().reset_index()

    xgb_model = xgb.XGBRegressor(
        n_estimators=150,
        max_depth=5,
        learning_rate=0.04,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        n_jobs=-1
    )
    xgb_model.fit(train_tree_df[tree_feats], train_tree_df["target_rul"])
    xgb_preds = np.clip(xgb_model.predict(test_tree_last[tree_feats]), 0, None)

    xgb_rmse = float(np.sqrt(mean_squared_error(test_rul, xgb_preds)))
    xgb_mae = float(mean_absolute_error(test_rul, xgb_preds))
    xgb_r2 = float(r2_score(test_rul, xgb_preds))
    xgb_phm = float(compute_nasa_phm_score(test_rul, xgb_preds))
    print(f"[{subset}] XGBoost (Regime-Normalized) -> Test RMSE: {xgb_rmse:.2f}, MAE: {xgb_mae:.2f}, R²: {xgb_r2:.4f}, NASA: {xgb_phm:.1f}")
    joblib.dump(xgb_model, MODELS_DIR / f"xgb_regime_{subset}.joblib")

    # -------------------------------------------------------------------------
    # Model B: Deep Attention-CNN-BiLSTM Sequence Model
    # -------------------------------------------------------------------------
    print(f"\n[{subset}] Building sliding sequence windows (window_size={WINDOW_SIZE})...")
    X_train_seq, y_train_seq = build_sequence_windows(train_split, feature_cols, WINDOW_SIZE, is_test=False)
    X_val_seq, y_val_seq = build_sequence_windows(val_split, feature_cols, WINDOW_SIZE, is_test=False)
    X_test_seq = build_sequence_windows(test_df, feature_cols, WINDOW_SIZE, is_test=True)

    print(f"[{subset}] Sequence Shapes: Train={X_train_seq.shape}, Val={X_val_seq.shape}, Test Last-Window={X_test_seq.shape}")

    train_loader = DataLoader(WindowedSequenceDataset(X_train_seq, y_train_seq), batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(WindowedSequenceDataset(X_val_seq, y_val_seq), batch_size=batch_size, shuffle=False)

    model = AttentionCNNBiLSTM(
        input_dim=len(feature_cols),
        conv_channels=64,
        kernel_size=3,
        lstm_hidden=64,
        lstm_layers=2,
        dropout=0.25
    ).to(DEVICE)

    criterion = nn.SmoothL1Loss(beta=1.0)
    optimizer = torch.optim.AdamW(model.parameters(), lr=0.001, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs, eta_min=1e-5)

    best_val_loss = float("inf")
    best_weights_path = MODELS_DIR / f"best_attention_cnn_bilstm_{subset}.pt"
    patience, patience_counter = 6, 0

    print(f"[{subset}] Training Attention-CNN-BiLSTM for up to {epochs} epochs with Early Stopping...")
    for ep in range(epochs):
        model.train()
        train_loss = 0.0
        for batch_x, batch_y in train_loader:
            batch_x, batch_y = batch_x.to(DEVICE), batch_y.to(DEVICE)
            optimizer.zero_grad()
            preds = model(batch_x)
            loss = criterion(preds, batch_y)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), max_norm=2.0)
            optimizer.step()
            train_loss += loss.item() * len(batch_x)
        scheduler.step()

        # Validation Loss
        model.eval()
        val_loss = 0.0
        with torch.no_grad():
            for vx, vy in val_loader:
                vx, vy = vx.to(DEVICE), vy.to(DEVICE)
                v_preds = model(vx)
                val_loss += criterion(v_preds, vy).item() * len(vx)

        epoch_train_loss = train_loss / len(X_train_seq)
        epoch_val_loss = val_loss / len(X_val_seq)

        if (ep + 1) % 5 == 0 or ep == epochs - 1:
            print(f"    Epoch {ep+1:2d}/{epochs} - Train Loss: {epoch_train_loss:.4f} | Val Loss: {epoch_val_loss:.4f}")

        # Check early stopping
        if epoch_val_loss < best_val_loss:
            best_val_loss = epoch_val_loss
            patience_counter = 0
            torch.save(model.state_dict(), best_weights_path)
        else:
            patience_counter += 1
            if patience_counter >= patience:
                print(f"    Early stopping triggered at epoch {ep+1}!")
                break

    # 6. Evaluate Deep Model on Held-out NASA Test Set (Strict Last Window Protocol)
    model.load_state_dict(torch.load(best_weights_path, map_location=DEVICE, weights_only=True))
    model.eval()
    with torch.no_grad():
        test_tensor = torch.tensor(X_test_seq, dtype=torch.float32).to(DEVICE)
        dl_preds = np.clip(model(test_tensor).cpu().numpy(), 0, None)

    dl_rmse = float(np.sqrt(mean_squared_error(test_rul, dl_preds)))
    dl_mae = float(mean_absolute_error(test_rul, dl_preds))
    dl_r2 = float(r2_score(test_rul, dl_preds))
    dl_phm = float(compute_nasa_phm_score(test_rul, dl_preds))

    print(f"\n[{subset}] Attention-CNN-BiLSTM -> Test RMSE: {dl_rmse:.2f}, MAE: {dl_mae:.2f}, R²: {dl_r2:.4f}, NASA: {dl_phm:.1f}")

    # 7. Package and Return Results
    return {
        "subset": subset,
        "XGBoost_RegimeNorm": {
            "RMSE": xgb_rmse,
            "MAE": xgb_mae,
            "R2": xgb_r2,
            "NASA_Score": xgb_phm
        },
        "Attention_CNN_BiLSTM": {
            "RMSE": dl_rmse,
            "MAE": dl_mae,
            "R2": dl_r2,
            "NASA_Score": dl_phm
        }
    }


def main():
    start_time = time.time()
    print("=" * 85)
    print("  NASA C-MAPSS HIGH-PERFORMANCE BENCHMARK FOR FD002 & FD004")
    print("  Package: FD0024/")
    print("=" * 85)

    fd002_res = run_pipeline_for_subset("FD002", epochs=25, batch_size=256)
    fd004_res = run_pipeline_for_subset("FD004", epochs=25, batch_size=256)

    # Export Benchmarks
    all_res = {"FD002": fd002_res, "FD004": fd004_res}
    with open(BENCHMARKS_DIR / "final_test_benchmark_FD0024.json", "w") as f:
        json.dump(all_res, f, indent=2)

    # Format comparison table
    rows = [
        {"Subset": "FD002", "Baseline Model (Before)": "Vanilla / CNN-LSTM (Global Scaler)", "Test RMSE (Before)": 30.78, "Test R² (Before)": 0.6724, "NASA Score (Before)": 19629.5, "New Model (Regime Norm)": "XGBoost (Regime Norm)", "Test RMSE (New)": fd002_res["XGBoost_RegimeNorm"]["RMSE"], "Test R² (New)": fd002_res["XGBoost_RegimeNorm"]["R2"], "NASA Score (New)": fd002_res["XGBoost_RegimeNorm"]["NASA_Score"]},
        {"Subset": "FD002", "Baseline Model (Before)": "Vanilla / CNN-LSTM (Global Scaler)", "Test RMSE (Before)": 30.78, "Test R² (Before)": 0.6724, "NASA Score (Before)": 19629.5, "New Model (Regime Norm)": "Attention-CNN-BiLSTM", "Test RMSE (New)": fd002_res["Attention_CNN_BiLSTM"]["RMSE"], "Test R² (New)": fd002_res["Attention_CNN_BiLSTM"]["R2"], "NASA Score (New)": fd002_res["Attention_CNN_BiLSTM"]["NASA_Score"]},
        {"Subset": "FD004", "Baseline Model (Before)": "Vanilla / CNN-LSTM (Global Scaler)", "Test RMSE (Before)": 31.93, "Test R² (Before)": 0.6571, "NASA Score (Before)": 9476.6, "New Model (Regime Norm)": "XGBoost (Regime Norm)", "Test RMSE (New)": fd004_res["XGBoost_RegimeNorm"]["RMSE"], "Test R² (New)": fd004_res["XGBoost_RegimeNorm"]["R2"], "NASA Score (New)": fd004_res["XGBoost_RegimeNorm"]["NASA_Score"]},
        {"Subset": "FD004", "Baseline Model (Before)": "Vanilla / CNN-LSTM (Global Scaler)", "Test RMSE (Before)": 31.93, "Test R² (Before)": 0.6571, "NASA Score (Before)": 9476.6, "New Model (Regime Norm)": "Attention-CNN-BiLSTM", "Test RMSE (New)": fd004_res["Attention_CNN_BiLSTM"]["RMSE"], "Test R² (New)": fd004_res["Attention_CNN_BiLSTM"]["R2"], "NASA Score (New)": fd004_res["Attention_CNN_BiLSTM"]["NASA_Score"]},
    ]
    df_compare = pd.DataFrame(rows)
    df_compare.to_csv(BENCHMARKS_DIR / "final_test_benchmark_FD0024.csv", index=False)

    elapsed = time.time() - start_time
    print("\n" + "=" * 90)
    print(f"  ALL BENCHMARKS COMPLETED IN {elapsed:.1f}s")
    print("=" * 90)
    print(df_compare.to_string(index=False))
    print("=" * 90 + "\n")


if __name__ == "__main__":
    main()
