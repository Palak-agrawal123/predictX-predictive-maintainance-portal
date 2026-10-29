"""
Master Pipeline: Train and Save Fresh Models into Updated_Models
NASA Turbofan Jet Engine Degradation Simulation Dataset (C-MAPSS)
==================================================================
Sub-dataset architectural strategy:
1. FD001 & FD003 (Single Operating Condition):
   - Best Choice: XGBoost Regressor & Random Forest Regressor
   - Strategy: Rolling window aggregations (mean, std) + healthy baseline drift.
   - Fast, low background noise, high R² score.

2. FD002 & FD004 (Six Operating Conditions):
   - Best Choice: Vanilla LSTM & 1D CNN-LSTM Hybrid (PyTorch)
   - Strategy: Sequential sliding window (length=20 cycles) across operating regimes.
   - Filters regime-switch noise and tracks multi-modal degradation transitions.

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
from torch.utils.data import Dataset, DataLoader

# Paths
BASE_DIR = Path(__file__).resolve().parent
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
# PyTorch Deep Learning Architectures for Multi-Regime Datasets (FD002, FD004)
# -----------------------------------------------------------------------------
class SequenceDataset(Dataset):
    def __init__(self, sequences: np.ndarray, targets: np.ndarray):
        self.sequences = torch.tensor(sequences, dtype=torch.float32)
        self.targets = torch.tensor(targets, dtype=torch.float32)

    def __len__(self):
        return len(self.sequences)

    def __getitem__(self, idx):
        return self.sequences[idx], self.targets[idx]


class VanillaLSTMRegressor(nn.Module):
    def __init__(self, input_size: int, hidden_size: int = 64, num_layers: int = 2, dropout: float = 0.2):
        super().__init__()
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0.0
        )
        self.fc = nn.Sequential(
            nn.Linear(hidden_size, 32),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(32, 1)
        )

    def forward(self, x):
        out, _ = self.lstm(x)
        # Take the hidden representation of the final time step
        return self.fc(out[:, -1, :]).squeeze(-1)


class CNNLSTMHybridRegressor(nn.Module):
    def __init__(
        self, 
        input_size: int, 
        conv_filters: int = 32, 
        kernel_size: int = 3, 
        lstm_hidden: int = 64, 
        dropout: float = 0.2
    ):
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
        # x shape: (batch, seq_len, features) -> conv1d needs (batch, features, seq_len)
        x_conv = x.permute(0, 2, 1)
        feat = self.conv(x_conv)
        # return to (batch, seq_len, conv_filters)
        feat = feat.permute(0, 2, 1)
        out, _ = self.lstm(feat)
        return self.fc(out[:, -1, :]).squeeze(-1)


def create_sequences(df: pd.DataFrame, seq_len: int, feature_cols: list, is_test: bool = False):
    """
    Slices time series into sequence windows of fixed length.
    Pads short sequences so all engines are preserved.
    """
    seqs, targets = [], []
    for uid, grp in df.groupby(ID_COL):
        vals = grp[feature_cols].values
        n = len(vals)
        if not is_test:
            ruls = grp["target_rul"].values
            if n >= seq_len:
                for i in range(n - seq_len + 1):
                    seqs.append(vals[i : i + seq_len])
                    targets.append(ruls[i + seq_len - 1])
            else:
                pad = np.repeat(vals[0:1], seq_len - n, axis=0)
                seqs.append(np.vstack([pad, vals]))
                targets.append(ruls[-1])
        else:
            # For test, we predict remaining life at the last observed cycle
            if n >= seq_len:
                seqs.append(vals[-seq_len:])
            else:
                pad = np.repeat(vals[0:1], seq_len - n, axis=0)
                seqs.append(np.vstack([pad, vals]))
                
    if not is_test:
        return np.array(seqs, dtype=np.float32), np.array(targets, dtype=np.float32)
    return np.array(seqs, dtype=np.float32)


# -----------------------------------------------------------------------------
# Training Functions for Single Condition (FD001, FD003) - Tree Models
# -----------------------------------------------------------------------------
def train_single_condition_models(subset: str = "FD001", clip_threshold: int = 125):
    print(f"\n=======================================================")
    print(f"  TRAINING TREE MODELS FOR SINGLE CONDITION: {subset}")
    print(f"=======================================================")

    # 1. Load Data
    train_file = DATA_DIR / f"train_{subset}.txt"
    test_file = DATA_DIR / f"test_{subset}.txt"
    rul_file = DATA_DIR / f"RUL_{subset}.txt"

    train_df = pd.read_csv(train_file, sep=r"\s+", header=None, names=ALL_COLS)
    test_df = pd.read_csv(test_file, sep=r"\s+", header=None, names=ALL_COLS)
    rul_test = pd.read_csv(rul_file, sep=r"\s+", header=None)[0].values

    # 2. Identify and drop constant columns
    stds = train_df.std()
    constant_cols = stds[stds < 1e-6].index.tolist()
    active_sensors = [s for s in SENSOR_COLS if s not in constant_cols]
    print(f"  [{subset}] Constant features dropped: {constant_cols}")
    print(f"  [{subset}] Active informative sensors ({len(active_sensors)}): {active_sensors}")

    # 3. Target calculation
    max_cycles = train_df.groupby(ID_COL)[CYCLE_COL].transform("max")
    train_df["raw_rul"] = max_cycles - train_df[CYCLE_COL]
    train_df["target_rul"] = train_df["raw_rul"].clip(upper=clip_threshold)

    # 4. Feature Engineering: Rolling Window + Initial Healthy Drift
    def engineer_tree_features(df):
        df = df.copy().sort_values(by=[ID_COL, CYCLE_COL])
        grouped = df.groupby(ID_COL)
        feat_cols = []

        # Baseline drift (difference from first 5 healthy cycles)
        healthy_base = df[df[CYCLE_COL] <= 5].groupby(ID_COL)[active_sensors].mean().reset_index()
        df = df.merge(healthy_base, on=ID_COL, suffixes=("", "_base"))

        for s in active_sensors:
            drift_col = f"{s}_drift"
            df[drift_col] = df[s] - df[f"{s}_base"]
            df.drop(columns=[f"{s}_base"], inplace=True)
            feat_cols.append(drift_col)

        # 5-cycle & 15-cycle rolling averages + 10-cycle rolling std
        for s in active_sensors:
            df[f"{s}_rm5"] = grouped[s].transform(lambda x: x.rolling(5, min_periods=1).mean())
            df[f"{s}_rm15"] = grouped[s].transform(lambda x: x.rolling(15, min_periods=1).mean())
            df[f"{s}_rstd10"] = grouped[s].transform(lambda x: x.rolling(10, min_periods=1).std().fillna(0))
            feat_cols.extend([f"{s}_rm5", f"{s}_rm15", f"{s}_rstd10"])

        all_features = [CYCLE_COL, "setting_1", "setting_2"] + active_sensors + feat_cols
        return df, all_features

    train_feat, feat_cols = engineer_tree_features(train_df)
    test_feat, _ = engineer_tree_features(test_df)

    # Last observed cycle per test unit
    test_last = test_feat.groupby(ID_COL).last().reset_index()

    X_train = train_feat[feat_cols]
    y_train = train_feat["target_rul"].values
    X_test = test_last[feat_cols]
    y_test = rul_test

    benchmarks = {}

    # Train XGBoost
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
    xgb_pred = np.clip(xgb_model.predict(X_test), 0, None)

    xgb_metrics = {
        "RMSE": float(np.sqrt(mean_squared_error(y_test, xgb_pred))),
        "MAE": float(mean_absolute_error(y_test, xgb_pred)),
        "R2": float(r2_score(y_test, xgb_pred)),
        "NASA_Score": float(compute_nasa_phm_score(y_test, xgb_pred)),
    }
    print(f"  [{subset}] XGBoost -> RMSE: {xgb_metrics['RMSE']:.2f}, MAE: {xgb_metrics['MAE']:.2f}, R2: {xgb_metrics['R2']:.4f}, NASA: {xgb_metrics['NASA_Score']:.1f}")

    # Train Random Forest
    print(f"  [{subset}] Training Random Forest Regressor...")
    rf_model = RandomForestRegressor(n_estimators=100, max_depth=12, random_state=42, n_jobs=-1)
    rf_model.fit(X_train, y_train)
    rf_pred = np.clip(rf_model.predict(X_test), 0, None)

    rf_metrics = {
        "RMSE": float(np.sqrt(mean_squared_error(y_test, rf_pred))),
        "MAE": float(mean_absolute_error(y_test, rf_pred)),
        "R2": float(r2_score(y_test, rf_pred)),
        "NASA_Score": float(compute_nasa_phm_score(y_test, rf_pred)),
    }
    print(f"  [{subset}] Random Forest -> RMSE: {rf_metrics['RMSE']:.2f}, MAE: {rf_metrics['MAE']:.2f}, R2: {rf_metrics['R2']:.4f}, NASA: {rf_metrics['NASA_Score']:.1f}")

    # Save Models and Metadata
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
# Training Functions for Multi-Regime Datasets (FD002, FD004) - LSTM / CNN-LSTM
# -----------------------------------------------------------------------------
def train_multi_condition_models(subset: str = "FD002", seq_len: int = 20, epochs: int = 15, batch_size: int = 256):
    print(f"\n=======================================================")
    print(f"  TRAINING DEEP LEARNING (LSTM / CNN-LSTM) FOR MULTI-REGIME: {subset}")
    print(f"=======================================================")

    # 1. Load Data
    train_file = DATA_DIR / f"train_{subset}.txt"
    test_file = DATA_DIR / f"test_{subset}.txt"
    rul_file = DATA_DIR / f"RUL_{subset}.txt"

    train_df = pd.read_csv(train_file, sep=r"\s+", header=None, names=ALL_COLS)
    test_df = pd.read_csv(test_file, sep=r"\s+", header=None, names=ALL_COLS)
    rul_test = pd.read_csv(rul_file, sep=r"\s+", header=None)[0].values

    # 2. Target calculation
    max_cycles = train_df.groupby(ID_COL)[CYCLE_COL].transform("max")
    train_df["target_rul"] = (max_cycles - train_df[CYCLE_COL]).clip(upper=125)

    # In multi-condition datasets, all 3 settings and all 21 sensors are dynamic
    feature_cols = SETTING_COLS + SENSOR_COLS

    # 3. Standardization
    scaler = StandardScaler()
    train_df[feature_cols] = scaler.fit_transform(train_df[feature_cols])
    test_df[feature_cols] = scaler.transform(test_df[feature_cols])

    # 4. Sequence Generation
    print(f"  [{subset}] Creating sequence windows of length {seq_len}...")
    X_train_seq, y_train_seq = create_sequences(train_df, seq_len=seq_len, feature_cols=feature_cols, is_test=False)
    X_test_seq = create_sequences(test_df, seq_len=seq_len, feature_cols=feature_cols, is_test=True)
    print(f"  [{subset}] Train sequences: {X_train_seq.shape}, Test sequences: {X_test_seq.shape}")

    train_dataset = SequenceDataset(X_train_seq, y_train_seq)
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)

    input_size = len(feature_cols)

    # 5. Train Vanilla LSTM
    print(f"  [{subset}] Training Vanilla LSTM ({epochs} epochs)...")
    lstm = VanillaLSTMRegressor(input_size=input_size, hidden_size=64, num_layers=2, dropout=0.2).to(DEVICE)
    criterion = nn.MSELoss()
    optimizer = torch.optim.Adam(lstm.parameters(), lr=0.002, weight_decay=1e-5)

    lstm.train()
    for ep in range(epochs):
        ep_loss = 0.0
        for batch_x, batch_y in train_loader:
            batch_x, batch_y = batch_x.to(DEVICE), batch_y.to(DEVICE)
            optimizer.zero_grad()
            preds = lstm(batch_x)
            loss = criterion(preds, batch_y)
            loss.backward()
            optimizer.step()
            ep_loss += loss.item() * len(batch_x)
        if (ep + 1) % 5 == 0 or ep == epochs - 1:
            avg_loss = ep_loss / len(train_dataset)
            print(f"      Epoch {ep+1:2d}/{epochs} - Train MSE: {avg_loss:.2f} (RMSE: {np.sqrt(avg_loss):.2f})")

    # Evaluate LSTM on Test
    lstm.eval()
    with torch.no_grad():
        test_tensor = torch.tensor(X_test_seq, dtype=torch.float32).to(DEVICE)
        lstm_preds = np.clip(lstm(test_tensor).cpu().numpy(), 0, None)

    lstm_metrics = {
        "RMSE": float(np.sqrt(mean_squared_error(rul_test, lstm_preds))),
        "MAE": float(mean_absolute_error(rul_test, lstm_preds)),
        "R2": float(r2_score(rul_test, lstm_preds)),
        "NASA_Score": float(compute_nasa_phm_score(rul_test, lstm_preds)),
    }
    print(f"  [{subset}] Vanilla LSTM -> RMSE: {lstm_metrics['RMSE']:.2f}, MAE: {lstm_metrics['MAE']:.2f}, R2: {lstm_metrics['R2']:.4f}, NASA: {lstm_metrics['NASA_Score']:.1f}")

    # 6. Train 1D CNN-LSTM Hybrid
    print(f"  [{subset}] Training 1D CNN-LSTM Hybrid ({epochs} epochs)...")
    cnn_lstm = CNNLSTMHybridRegressor(input_size=input_size, conv_filters=32, kernel_size=3, lstm_hidden=64).to(DEVICE)
    opt_cnn = torch.optim.Adam(cnn_lstm.parameters(), lr=0.002, weight_decay=1e-5)

    cnn_lstm.train()
    for ep in range(epochs):
        ep_loss = 0.0
        for batch_x, batch_y in train_loader:
            batch_x, batch_y = batch_x.to(DEVICE), batch_y.to(DEVICE)
            opt_cnn.zero_grad()
            preds = cnn_lstm(batch_x)
            loss = criterion(preds, batch_y)
            loss.backward()
            opt_cnn.step()
            ep_loss += loss.item() * len(batch_x)
        if (ep + 1) % 5 == 0 or ep == epochs - 1:
            avg_loss = ep_loss / len(train_dataset)
            print(f"      Epoch {ep+1:2d}/{epochs} - Train MSE: {avg_loss:.2f} (RMSE: {np.sqrt(avg_loss):.2f})")

    # Evaluate CNN-LSTM on Test
    cnn_lstm.eval()
    with torch.no_grad():
        cnn_preds = np.clip(cnn_lstm(test_tensor).cpu().numpy(), 0, None)

    cnn_metrics = {
        "RMSE": float(np.sqrt(mean_squared_error(rul_test, cnn_preds))),
        "MAE": float(mean_absolute_error(rul_test, cnn_preds)),
        "R2": float(r2_score(rul_test, cnn_preds)),
        "NASA_Score": float(compute_nasa_phm_score(rul_test, cnn_preds)),
    }
    print(f"  [{subset}] 1D CNN-LSTM -> RMSE: {cnn_metrics['RMSE']:.2f}, MAE: {cnn_metrics['MAE']:.2f}, R2: {cnn_metrics['R2']:.4f}, NASA: {cnn_metrics['NASA_Score']:.1f}")

    # Save Models, Scaler and Metadata
    lstm_path = OUTPUT_DIR / f"lstm_regressor_{subset}.pt"
    cnn_path = OUTPUT_DIR / f"cnn_lstm_regressor_{subset}.pt"
    scaler_path = OUTPUT_DIR / f"scaler_{subset}.joblib"
    meta_path = OUTPUT_DIR / f"metadata_{subset}.json"

    torch.save(lstm.state_dict(), lstm_path)
    torch.save(cnn_lstm.state_dict(), cnn_path)
    joblib.dump(scaler, scaler_path)

    metadata = {
        "subset": subset,
        "type": "Six Operating Conditions (Multi-Regime)",
        "sequence_length": seq_len,
        "feature_cols": feature_cols,
        "models": {
            "Vanilla_LSTM": lstm_metrics,
            "1D_CNN_LSTM_Hybrid": cnn_metrics
        }
    }
    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"  [SAVED] {lstm_path.name}")
    print(f"  [SAVED] {cnn_path.name}")
    print(f"  [SAVED] {scaler_path.name}")
    print(f"  [SAVED] {meta_path.name}")
    return metadata


# -----------------------------------------------------------------------------
# Main Orchestrator
# -----------------------------------------------------------------------------
def main():
    start_time = time.time()
    print("=" * 70)
    print("  NASA C-MAPSS MULTI-SUBSET MASTER TRAINING PIPELINE")
    print("  Target Folder: Updated_Models/")
    print("=" * 70)

    all_summaries = {}

    # 1. Single condition: FD001
    all_summaries["FD001"] = train_single_condition_models("FD001", clip_threshold=125)

    # 2. Single condition: FD003
    all_summaries["FD003"] = train_single_condition_models("FD003", clip_threshold=125)

    # 3. Multi condition: FD002
    all_summaries["FD002"] = train_multi_condition_models("FD002", seq_len=20, epochs=12, batch_size=256)

    # 4. Multi condition: FD004
    all_summaries["FD004"] = train_multi_condition_models("FD004", seq_len=20, epochs=12, batch_size=256)

    # Overall Summary File
    summary_file = OUTPUT_DIR / "all_subsets_benchmark_summary.json"
    with open(summary_file, "w") as f:
        json.dump(all_summaries, f, indent=2)

    # Sync trained artifacts directly to ml_service/models/ for production deployment
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
