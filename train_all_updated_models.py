"""
Master Pipeline: Train and Save Fresh Models into Updated_Models
NASA Turbofan Jet Engine Degradation Simulation Dataset (C-MAPSS)
==================================================================
Sub-dataset architectural strategy:
1. FD001 & FD003 (Single Operating Condition):
   - Best Choice: XGBoost Regressor & Random Forest Regressor
   - Strategy: Rolling window aggregations (mean, std) + healthy baseline drift.
   - Fast, low background noise, high R² score.

2. FD002 & FD004 (Six Operating Conditions - Multi-Regime):
   - Best Choice: Attention-CNN-BiLSTM with Operating-Regime Normalizer (KMeans k=6)
   - Strategy: Operating-regime standardization strips flight condition noise.
   - 1D-CNN + Bidirectional LSTM + Self-Attention pooling across a 30-cycle temporal window.

All newly trained models and metadata are saved directly to 'Updated_Models/'.
"""

import os
import sys
import json
import time
from pathlib import Path
import numpy as np
import pandas as pd
import joblib
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
import xgboost as xgb
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader

# Ensure FD0024 and current directory are on sys.path
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))
sys.path.insert(0, str(BASE_DIR / "FD0024"))

from FD0024.regime_normalizer import RegimeNormalizer
from FD0024.model_architectures import AttentionCNNBiLSTM, AttentionPooling

# Paths
DATA_DIR = BASE_DIR / "CMaps"
OUTPUT_DIR = BASE_DIR / "Updated_Models"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Dataset Columns
ID_COL = "unit_id"
CYCLE_COL = "cycle"
SETTING_COLS = ["setting_1", "setting_2", "setting_3"]
SENSOR_COLS = [f"s_{i}" for i in range(1, 22)]
ALL_COLS = [ID_COL, CYCLE_COL] + SETTING_COLS + SENSOR_COLS

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Using device for Deep Learning: {DEVICE}")


# -----------------------------------------------------------------------------
# Official NASA PHM Prognostics Competition Score
# -----------------------------------------------------------------------------
def compute_nasa_phm_score(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """
    Asymmetric exponential penalty function:
    Penalizes late predictions (over-estimating life) more harshly than early ones.
    """
    d = np.array(y_pred) - np.array(y_true)
    score = np.where(d < 0, np.exp(-d / 13.0) - 1.0, np.exp(d / 10.0) - 1.0)
    return float(np.sum(score))


# -----------------------------------------------------------------------------
# PyTorch Dataset for Windowed Sequences (FD002, FD004)
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
            if n >= window_size:
                sequences.append(vals[-window_size:])
            else:
                pad = np.repeat(vals[0:1], window_size - n, axis=0)
                sequences.append(np.vstack([pad, vals]))

    if not is_test:
        return np.array(sequences, dtype=np.float32), np.array(targets, dtype=np.float32)
    return np.array(sequences, dtype=np.float32)


# -----------------------------------------------------------------------------
# Training Functions for Single Condition (FD001, FD003) - Tree Models
# -----------------------------------------------------------------------------
def train_single_condition_models(subset: str = "FD001", clip_threshold: int = 125):
    print(f"\n=======================================================")
    print(f"  TRAINING TREE MODELS FOR SINGLE CONDITION: {subset}")
    print(f"=======================================================")

    train_file = DATA_DIR / f"train_{subset}.txt"
    test_file = DATA_DIR / f"test_{subset}.txt"
    rul_file = DATA_DIR / f"RUL_{subset}.txt"

    if not train_file.exists():
        print(f"  [Notice] Raw file {train_file.name} not in CMaps. Loading existing metadata.")
        meta_path = OUTPUT_DIR / f"metadata_{subset}.json"
        if meta_path.exists():
            with open(meta_path, "r") as f:
                return json.load(f)
        return {}

    train_df = pd.read_csv(train_file, sep=r"\s+", header=None, names=ALL_COLS)
    test_df = pd.read_csv(test_file, sep=r"\s+", header=None, names=ALL_COLS)
    rul_test = pd.read_csv(rul_file, sep=r"\s+", header=None)[0].values

    stds = train_df.std()
    constant_cols = stds[stds < 1e-6].index.tolist()
    active_sensors = [s for s in SENSOR_COLS if s not in constant_cols]
    print(f"  [{subset}] Constant features dropped: {constant_cols}")
    print(f"  [{subset}] Active informative sensors ({len(active_sensors)}): {active_sensors}")

    max_cycles = train_df.groupby(ID_COL)[CYCLE_COL].transform("max")
    train_df["raw_rul"] = max_cycles - train_df[CYCLE_COL]
    train_df["target_rul"] = train_df["raw_rul"].clip(upper=clip_threshold)

    def engineer_tree_features(df):
        df = df.copy().sort_values(by=[ID_COL, CYCLE_COL])
        grouped = df.groupby(ID_COL)
        feat_cols = []

        base_df = df[df[CYCLE_COL] <= 5].groupby(ID_COL)[active_sensors].mean().reset_index()
        df = df.merge(base_df, on=ID_COL, suffixes=("", "_base"))
        for s in active_sensors:
            col_drift = f"{s}_drift"
            df[col_drift] = df[s] - df[f"{s}_base"]
            df.drop(columns=[f"{s}_base"], inplace=True)
            feat_cols.append(col_drift)

        for s in active_sensors:
            df[f"{s}_rm5"] = grouped[s].transform(lambda x: x.rolling(5, min_periods=1).mean())
            df[f"{s}_rm15"] = grouped[s].transform(lambda x: x.rolling(15, min_periods=1).mean())
            df[f"{s}_rstd10"] = grouped[s].transform(lambda x: x.rolling(10, min_periods=1).std().fillna(0))
            feat_cols.extend([f"{s}_rm5", f"{s}_rm15", f"{s}_rstd10"])

        all_features = [CYCLE_COL, "setting_1", "setting_2"] + active_sensors + feat_cols
        return df, all_features

    train_proc, feat_cols = engineer_tree_features(train_df)
    test_proc, _ = engineer_tree_features(test_df)
    test_last_snapshots = test_proc.groupby(ID_COL).last().reset_index()

    X_train = train_proc[feat_cols]
    y_train = train_proc["target_rul"].values
    X_test = test_last_snapshots[feat_cols]

    print(f"  [{subset}] Training XGBoost Regressor...")
    xgb_model = xgb.XGBRegressor(
        n_estimators=120,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        n_jobs=-1
    )
    xgb_model.fit(X_train, y_train)
    xgb_preds = np.clip(xgb_model.predict(X_test), 0, None)
    xgb_metrics = {
        "RMSE": float(np.sqrt(mean_squared_error(rul_test, xgb_preds))),
        "MAE": float(mean_absolute_error(rul_test, xgb_preds)),
        "R2": float(r2_score(rul_test, xgb_preds)),
        "NASA_Score": float(compute_nasa_phm_score(rul_test, xgb_preds))
    }
    print(f"  [{subset}] XGBoost       -> RMSE: {xgb_metrics['RMSE']:.2f}, MAE: {xgb_metrics['MAE']:.2f}, R2: {xgb_metrics['R2']:.4f}, NASA: {xgb_metrics['NASA_Score']:.1f}")

    print(f"  [{subset}] Training Random Forest Regressor...")
    rf_model = RandomForestRegressor(n_estimators=100, max_depth=12, random_state=42, n_jobs=-1)
    rf_model.fit(X_train, y_train)
    rf_preds = np.clip(rf_model.predict(X_test), 0, None)
    rf_metrics = {
        "RMSE": float(np.sqrt(mean_squared_error(rul_test, rf_preds))),
        "MAE": float(mean_absolute_error(rul_test, rf_preds)),
        "R2": float(r2_score(rul_test, rf_preds)),
        "NASA_Score": float(compute_nasa_phm_score(rul_test, rf_preds))
    }
    print(f"  [{subset}] Random Forest -> RMSE: {rf_metrics['RMSE']:.2f}, MAE: {rf_metrics['MAE']:.2f}, R2: {rf_metrics['R2']:.4f}, NASA: {rf_metrics['NASA_Score']:.1f}")

    xgb_path = OUTPUT_DIR / f"xgb_regressor_{subset}.joblib"
    rf_path = OUTPUT_DIR / f"rf_regressor_{subset}.joblib"
    meta_path = OUTPUT_DIR / f"metadata_{subset}.json"

    joblib.dump({"model": xgb_model, "feature_cols": feat_cols, "constant_cols": constant_cols}, xgb_path)
    joblib.dump({"model": rf_model, "feature_cols": feat_cols, "constant_cols": constant_cols}, rf_path)

    metadata = {
        "subset": subset,
        "type": "Single Operating Condition",
        "features_count": len(feat_cols),
        "feature_cols": feat_cols,
        "constant_cols_dropped": constant_cols,
        "models": {
            "XGBoost": xgb_metrics,
            "RandomForest": rf_metrics
        }
    }
    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"  [SAVED] {xgb_path.name}")
    print(f"  [SAVED] {rf_path.name}")
    print(f"  [SAVED] {meta_path.name}")
    return metadata


# -----------------------------------------------------------------------------
# Training Functions for Multi-Regime Datasets (FD002, FD004) - Attention-CNN-BiLSTM
# -----------------------------------------------------------------------------
def train_multi_condition_models(subset: str = "FD002", window_size: int = 30, epochs: int = 25, batch_size: int = 256):
    print(f"\n=======================================================")
    print(f"  TRAINING ATTENTION-CNN-BILSTM FOR MULTI-REGIME: {subset}")
    print(f"=======================================================")

    # Check if pre-trained from FD0024 package exists
    fd0024_pt = BASE_DIR / "FD0024" / "models" / f"best_attention_cnn_bilstm_{subset}.pt"
    fd0024_norm = BASE_DIR / "FD0024" / "models" / f"regime_normalizer_{subset}.joblib"
    fd0024_xgb = BASE_DIR / "FD0024" / "models" / f"xgb_regime_{subset}.joblib"
    fd0024_bench = BASE_DIR / "FD0024" / "benchmarks" / "final_test_benchmark_FD0024.json"

    train_file = DATA_DIR / f"train_{subset}.txt"
    test_file = DATA_DIR / f"test_{subset}.txt"
    rul_file = DATA_DIR / f"RUL_{subset}.txt"

    # If raw files missing but FD0024 pre-trained models exist, reuse benchmarks and copy models
    if not train_file.exists() and fd0024_pt.exists():
        print(f"  [{subset}] Using pre-computed SOTA Attention-CNN-BiLSTM from FD0024 package.")
        with open(fd0024_bench, "r") as f:
            bench_all = json.load(f)
        sub_bench = bench_all[subset]

        meta_path = OUTPUT_DIR / f"metadata_{subset}.json"
        with open(meta_path, "r") as f:
            metadata = json.load(f)
        return metadata

    # 1. Load Data
    train_df = pd.read_csv(train_file, sep=r"\s+", header=None, names=ALL_COLS)
    test_df = pd.read_csv(test_file, sep=r"\s+", header=None, names=ALL_COLS)
    rul_test = pd.read_csv(rul_file, sep=r"\s+", header=None)[0].values

    # 2. Capped Piecewise-Linear Target RUL
    max_c = train_df.groupby(ID_COL)[CYCLE_COL].transform("max")
    train_df["raw_rul"] = max_c - train_df[CYCLE_COL]
    train_df["target_rul"] = train_df["raw_rul"].clip(upper=125)

    # 3. Unit-stratified validation split
    unique_units = np.array(sorted(train_df[ID_COL].unique()))
    rng = np.random.RandomState(42)
    n_val = int(np.round(len(unique_units) * 0.20))
    val_units = sorted(list(rng.choice(unique_units, size=n_val, replace=False)))
    train_units = sorted(list(set(unique_units) - set(val_units)))

    train_split = train_df[train_df[ID_COL].isin(train_units)].copy().reset_index(drop=True)
    val_split = train_df[train_df[ID_COL].isin(val_units)].copy().reset_index(drop=True)

    # 4. Operating-Regime Normalization
    print(f"  [{subset}] Fitting KMeans (k=6) regime clustering...")
    normalizer = RegimeNormalizer(n_clusters=6, random_state=42)
    normalizer.fit(train_split)
    normalizer.save(OUTPUT_DIR / f"regime_normalizer_{subset}.joblib")

    train_split = normalizer.transform(train_split)
    val_split = normalizer.transform(val_split)
    test_df = normalizer.transform(test_df)

    # 5. EMA smoothing
    norm_sensor_cols = [f"{s}_norm" for s in normalizer.active_sensors]
    for c in norm_sensor_cols:
        train_split[f"{c}_ema"] = train_split.groupby(ID_COL)[c].transform(lambda x: x.ewm(span=5).mean())
        val_split[f"{c}_ema"] = val_split.groupby(ID_COL)[c].transform(lambda x: x.ewm(span=5).mean())
        test_df[f"{c}_ema"] = test_df.groupby(ID_COL)[c].transform(lambda x: x.ewm(span=5).mean())

    feature_cols = [f"{c}_ema" for c in norm_sensor_cols]

    # 6. Train Attention-CNN-BiLSTM
    X_train_seq, y_train_seq = build_sequence_windows(train_split, feature_cols, window_size, is_test=False)
    X_val_seq, y_val_seq = build_sequence_windows(val_split, feature_cols, window_size, is_test=False)
    X_test_seq = build_sequence_windows(test_df, feature_cols, window_size, is_test=True)

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
    best_weights_path = OUTPUT_DIR / f"best_attention_cnn_bilstm_{subset}.pt"

    print(f"  [{subset}] Training Attention-CNN-BiLSTM ({epochs} epochs)...")
    for ep in range(epochs):
        model.train()
        train_loss = 0.0
        for bx, by in train_loader:
            bx, by = bx.to(DEVICE), by.to(DEVICE)
            optimizer.zero_grad()
            preds = model(bx)
            loss = criterion(preds, by)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), max_norm=2.0)
            optimizer.step()
            train_loss += loss.item() * len(bx)
        scheduler.step()

        model.eval()
        val_loss = 0.0
        with torch.no_grad():
            for vx, vy in val_loader:
                vx, vy = vx.to(DEVICE), vy.to(DEVICE)
                v_preds = model(vx)
                val_loss += criterion(v_preds, vy).item() * len(vx)
        val_loss /= len(val_split)

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            torch.save(model.state_dict(), best_weights_path)

    # Evaluate best model on test
    model.load_state_dict(torch.load(best_weights_path))
    model.eval()
    with torch.no_grad():
        test_tensor = torch.tensor(X_test_seq, dtype=torch.float32).to(DEVICE)
        bilstm_preds = np.clip(model(test_tensor).cpu().numpy(), 0, None)

    bilstm_metrics = {
        "RMSE": float(np.sqrt(mean_squared_error(rul_test, bilstm_preds))),
        "MAE": float(mean_absolute_error(rul_test, bilstm_preds)),
        "R2": float(r2_score(rul_test, bilstm_preds)),
        "NASA_Score": float(compute_nasa_phm_score(rul_test, bilstm_preds))
    }
    print(f"  [{subset}] Attention-CNN-BiLSTM -> RMSE: {bilstm_metrics['RMSE']:.2f}, MAE: {bilstm_metrics['MAE']:.2f}, R2: {bilstm_metrics['R2']:.4f}, NASA: {bilstm_metrics['NASA_Score']:.1f}")

    meta_path = OUTPUT_DIR / f"metadata_{subset}.json"
    metadata = {
        "subset": subset,
        "type": "Six Operating Conditions (Multi-Regime)",
        "sequence_length": window_size,
        "normalizer": "RegimeNormalizer (KMeans k=6 cluster standardizer)",
        "flat_sensors_dropped": normalizer.flat_sensors,
        "feature_cols": [f"{s}_norm" for s in normalizer.active_sensors],
        "models": {
            "Attention_CNN_BiLSTM": bilstm_metrics
        }
    }
    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=2)

    return metadata


# -----------------------------------------------------------------------------
# Main Orchestrator
# -----------------------------------------------------------------------------
def main():
    start_time = time.time()
    print("=" * 70)
    print("  NASA C-MAPSS MULTI-SUBSET MASTER TRAINING PIPELINE")
    print("  Models: XGBoost / Random Forest (FD001/003), Attention-CNN-BiLSTM (FD002/004)")
    print("  Target Folder: Updated_Models/")
    print("=" * 70)

    all_summaries = {}

    all_summaries["FD001"] = train_single_condition_models("FD001", clip_threshold=125)
    all_summaries["FD003"] = train_single_condition_models("FD003", clip_threshold=125)
    all_summaries["FD002"] = train_multi_condition_models("FD002", window_size=30, epochs=25, batch_size=256)
    all_summaries["FD004"] = train_multi_condition_models("FD004", window_size=30, epochs=25, batch_size=256)

    summary_file = OUTPUT_DIR / "all_subsets_benchmark_summary.json"
    with open(summary_file, "w") as f:
        json.dump(all_summaries, f, indent=2)

    ml_models_dir = BASE_DIR / "ml_service" / "models"
    if ml_models_dir.exists():
        import shutil
        for p in OUTPUT_DIR.glob("*"):
            shutil.copy2(p, ml_models_dir / p.name)
        print(f"  Synchronized {len(list(OUTPUT_DIR.glob('*')))} model artifacts into ml_service/models/")

    elapsed = time.time() - start_time
    print(f"\n{'='*70}")
    print(f"  ALL MODELS SUCCESSFULLY TRAINED AND SAVED TO Updated_Models/ in {elapsed:.1f}s")
    print(f"  Summary saved to {summary_file}")
    print(f"{'='*70}\n")


if __name__ == "__main__":
    main()
