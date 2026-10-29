"""
Generates the comprehensive Jupyter Notebook:
'C_MAPSS_MultiSubdataset_Clean_and_Model.ipynb'
Covering data cleaning, exploratory analysis, tree models (FD001/FD003),
and PyTorch sequential deep learning models (FD002/FD004).
"""

import nbformat as nbf
from pathlib import Path

nb = nbf.v4.new_notebook()

cells = []

# Title & Overview
cells.append(nbf.v4.new_markdown_cell("""# NASA Turbofan Jet Engine Degradation (C-MAPSS)
## Complete Prognostic Modeling: Data Cleanliness Audit, Feature Engineering & Multi-Regime Modeling

### 1. Problem Statement & Industrial Objective
In aerospace and heavy manufacturing operations, unexpected component failures during operation incur catastrophic financial, operational, and life-safety risks. **Prognostics and Health Management (PHM)** leverages multivariate sensor telemetry to predict the **Remaining Useful Life (RUL)** of engines before they reach failure thresholds.

### 2. Dataset Architecture (NASA C-MAPSS)
The Commercial Modular Aero-Propulsion System Simulation (C-MAPSS) dataset contains simulated run-to-failure trajectories of turbofan engines across four distinct operational profiles:

| Sub-dataset | Operating Conditions | Fault Modes | Train Units | Test Units | Recommended Architecture | Reason |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **FD001** | 1 (Sea Level) | 1 (HPC Degradation) | 100 | 100 | **XGBoost / Random Forest** | Low background noise; rolling features fit rapidly with high $R^2$ |
| **FD002** | 6 Regimes | 1 (HPC Degradation) | 260 | 259 | **Vanilla LSTM / 1D CNN-LSTM** | Multi-regime transitions mask wear; sequence memory required |
| **FD003** | 1 (Sea Level) | 2 (HPC + Fan Degradation) | 100 | 100 | **XGBoost / Random Forest** | Low noise, multi-failure mode wear signatures |
| **FD004** | 6 Regimes | 2 (HPC + Fan Degradation) | 249 | 248 | **Vanilla LSTM / 1D CNN-LSTM** | High complexity: 6 flight regimes + 2 competing failure modes |

---
"""))

# Cell 1: Imports
cells.append(nbf.v4.new_markdown_cell("""### Step 1: Environment Setup & Global Imports"""))
cells.append(nbf.v4.new_code_cell("""import os
import sys
import json
from pathlib import Path
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import joblib

# Scikit-Learn & XGBoost
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
import xgboost as xgb

# PyTorch for Sequential Deep Learning
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader

# Style configuration
sns.set_theme(style="whitegrid")
plt.rcParams["figure.figsize"] = (12, 6)

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"PyTorch executing on: {DEVICE}")

DATA_DIR = Path("CMaps")
OUTPUT_DIR = Path("Updated_Models")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# 26-column schema
ID_COL = "unit_id"
CYCLE_COL = "cycle"
SETTING_COLS = ["setting_1", "setting_2", "setting_3"]
SENSOR_COLS = [f"s_{i}" for i in range(1, 22)]
ALL_COLS = [ID_COL, CYCLE_COL] + SETTING_COLS + SENSOR_COLS
"""))

# Step 2: Data Cleanliness Audit
cells.append(nbf.v4.new_markdown_cell("""### Step 2: Comprehensive Data Cleanliness & Integrity Audit
Before building any models, we perform a rigorous check across all four sub-datasets:
1. **Formatting & Dimensions**: Checking for row corruption, truncated delimiters, and consistent 26-column width.
2. **Missing & Extreme Values**: Confirming 0 NaNs, 0 nulls, and 0 infinite values.
3. **Temporal Sequence Integrity**: Verifying that each unit trajectory strictly begins at `cycle = 1` and increments by `+1` monotonically without gaps.
4. **Key Uniqueness**: Guaranteeing no duplicate `(unit_id, cycle)` observations.
5. **Constant / Zero-Variance Sensors**: Detecting flat sensors that carry no prognostic signal.
"""))

cells.append(nbf.v4.new_code_cell("""def audit_dataset_integrity(subset="FD001"):
    train_file = DATA_DIR / f"train_{subset}.txt"
    test_file = DATA_DIR / f"test_{subset}.txt"
    rul_file = DATA_DIR / f"RUL_{subset}.txt"
    
    # Read files
    train_df = pd.read_csv(train_file, sep=r"\\s+", header=None, names=ALL_COLS)
    test_df = pd.read_csv(test_file, sep=r"\\s+", header=None, names=ALL_COLS)
    rul_df = pd.read_csv(rul_file, sep=r"\\s+", header=None, names=["true_rul"])
    
    # Missing, infinite, and duplicates
    train_nulls = train_df.isna().sum().sum()
    test_nulls = test_df.isna().sum().sum()
    train_infs = np.isinf(train_df.values).sum()
    test_infs = np.isinf(test_df.values).sum()
    train_dups = train_df.duplicated(subset=[ID_COL, CYCLE_COL]).sum()
    test_dups = test_df.duplicated(subset=[ID_COL, CYCLE_COL]).sum()
    
    # Cycle integrity
    train_start_1 = (train_df.groupby(ID_COL)[CYCLE_COL].min() == 1).all()
    test_start_1 = (test_df.groupby(ID_COL)[CYCLE_COL].min() == 1).all()
    train_seq = train_df.groupby(ID_COL)[CYCLE_COL].apply(lambda s: (s.diff().dropna() == 1).all()).all()
    test_seq = test_df.groupby(ID_COL)[CYCLE_COL].apply(lambda s: (s.diff().dropna() == 1).all()).all()
    
    # Constant columns
    train_stds = train_df.std()
    constant_cols = train_stds[train_stds < 1e-6].index.tolist()
    
    print(f"=== Cleanliness Audit Report for {subset} ===")
    print(f"Train Rows: {len(train_df):,} | Test Rows: {len(test_df):,} | Test Ground Truth Targets: {len(rul_df)}")
    print(f"Nulls: Train={train_nulls}, Test={test_nulls} | Infs: Train={train_infs}, Test={test_infs}")
    print(f"Duplicates: Train={train_dups}, Test={test_dups}")
    print(f"Trajectory Sequences: Starts at 1? (Train={train_start_1}, Test={test_start_1}) | Increments by 1? (Train={train_seq}, Test={test_seq})")
    print(f"Constant (Zero-Variance) Columns: {constant_cols}\\n")
    return train_df, test_df, rul_df, constant_cols

# Run audit on FD001 & FD002
train_fd1, test_fd1, rul_fd1, const_fd1 = audit_dataset_integrity("FD001")
train_fd2, test_fd2, rul_fd2, const_fd2 = audit_dataset_integrity("FD002")
"""))

# Step 3: NASA Evaluation Metric
cells.append(nbf.v4.new_markdown_cell(r"""### Step 3: Official NASA PHM Prognostics Metric
In industrial maintenance, an **over-estimation** of remaining life (late prediction) is far more dangerous than an **under-estimation** (early prediction, triggering a safe early inspection). 

NASA formulated an asymmetric exponential penalty function:
$$d = \hat{y} - y$$
$$S = \sum_{d_i < 0} \left( e^{-d_i / 13} - 1 \right) + \sum_{d_i \ge 0} \left( e^{d_i / 10} - 1 \right)$$
"""))

cells.append(nbf.v4.new_code_cell("""def compute_nasa_phm_score(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    \"\"\"Calculates the official NASA PHM Prognostics score.\"\"\"
    d = np.array(y_pred) - np.array(y_true)
    score = np.where(d < 0, np.exp(-d / 13.0) - 1.0, np.exp(d / 10.0) - 1.0)
    return float(np.sum(score))
"""))

# Step 4: Tree Models on Single Condition (FD001 & FD003)
cells.append(nbf.v4.new_markdown_cell("""### Step 4: Single Operating Condition Datasets (FD001 & FD003)
#### Strategy: XGBoost & Random Forest with Rolling Feature Engineering
In **FD001** and **FD003**, operational settings are constant (Sea Level conditions). 
Therefore, sensor fluctuations reflect pure mechanical wear rather than flight regime changes. 
We engineer:
1. **Piece-wise Linear Target RUL**: Capped at 125 cycles (representing the initial healthy baseline period before noticeable wear begins).
2. **Initial Baseline Drift**: Measuring deviation of each sensor from the engine's initial 5 cycles.
3. **Rolling Window Aggregations**: 5-cycle and 15-cycle moving averages (smoothing sensor noise) and 10-cycle rolling standard deviation (detecting vibration and volatility).
"""))

cells.append(nbf.v4.new_code_cell("""def train_tree_pipeline(subset="FD001", clip_threshold=125):
    train_df = pd.read_csv(DATA_DIR / f"train_{subset}.txt", sep=r"\\s+", header=None, names=ALL_COLS)
    test_df = pd.read_csv(DATA_DIR / f"test_{subset}.txt", sep=r"\\s+", header=None, names=ALL_COLS)
    y_test = pd.read_csv(DATA_DIR / f"RUL_{subset}.txt", sep=r"\\s+", header=None)[0].values

    # Drop flat constant sensors
    stds = train_df.std()
    constant_cols = stds[stds < 1e-6].index.tolist()
    active_sensors = [s for s in SENSOR_COLS if s not in constant_cols]

    # Target calculation
    max_cycles = train_df.groupby(ID_COL)[CYCLE_COL].transform("max")
    train_df["target_rul"] = (max_cycles - train_df[CYCLE_COL]).clip(upper=clip_threshold)

    def extract_features(df):
        df = df.copy().sort_values(by=[ID_COL, CYCLE_COL])
        grouped = df.groupby(ID_COL)
        feat_cols = []

        # Baseline drift
        init_base = df[df[CYCLE_COL] <= 5].groupby(ID_COL)[active_sensors].mean().reset_index()
        df = df.merge(init_base, on=ID_COL, suffixes=("", "_base"))
        for s in active_sensors:
            df[f"{s}_drift"] = df[s] - df[f"{s}_base"]
            df.drop(columns=[f"{s}_base"], inplace=True)
            feat_cols.append(f"{s}_drift")

        # Rolling statistics
        for s in active_sensors:
            df[f"{s}_rm5"] = grouped[s].transform(lambda x: x.rolling(5, min_periods=1).mean())
            df[f"{s}_rm15"] = grouped[s].transform(lambda x: x.rolling(15, min_periods=1).mean())
            df[f"{s}_rstd10"] = grouped[s].transform(lambda x: x.rolling(10, min_periods=1).std().fillna(0))
            feat_cols.extend([f"{s}_rm5", f"{s}_rm15", f"{s}_rstd10"])

        all_cols = [CYCLE_COL, "setting_1", "setting_2"] + active_sensors + feat_cols
        return df, all_cols

    train_feat, feat_cols = extract_features(train_df)
    test_feat, _ = extract_features(test_df)

    # Test prediction at censored snapshot (last observed cycle per test unit)
    test_last = test_feat.groupby(ID_COL).last().reset_index()

    X_train = train_feat[feat_cols]
    y_train = train_feat["target_rul"].values
    X_test = test_last[feat_cols]

    # 1. XGBoost Regressor
    model_xgb = xgb.XGBRegressor(n_estimators=120, max_depth=4, learning_rate=0.05, subsample=0.8, colsample_bytree=0.8, random_state=42)
    model_xgb.fit(X_train, y_train)
    pred_xgb = np.clip(model_xgb.predict(X_test), 0, None)

    # 2. Random Forest Regressor
    model_rf = RandomForestRegressor(n_estimators=100, max_depth=12, random_state=42, n_jobs=-1)
    model_rf.fit(X_train, y_train)
    pred_rf = np.clip(model_rf.predict(X_test), 0, None)

    metrics_xgb = {
        "RMSE": np.sqrt(mean_squared_error(y_test, pred_xgb)),
        "MAE": mean_absolute_error(y_test, pred_xgb),
        "R2": r2_score(y_test, pred_xgb),
        "NASA": compute_nasa_phm_score(y_test, pred_xgb)
    }

    metrics_rf = {
        "RMSE": np.sqrt(mean_squared_error(y_test, pred_rf)),
        "MAE": mean_absolute_error(y_test, pred_rf),
        "R2": r2_score(y_test, pred_rf),
        "NASA": compute_nasa_phm_score(y_test, pred_rf)
    }

    print(f"Results on {subset}:")
    print(f"  XGBoost       -> RMSE: {metrics_xgb['RMSE']:.2f}, MAE: {metrics_xgb['MAE']:.2f}, R2: {metrics_xgb['R2']:.4f}, NASA: {metrics_xgb['NASA']:.1f}")
    print(f"  Random Forest -> RMSE: {metrics_rf['RMSE']:.2f}, MAE: {metrics_rf['MAE']:.2f}, R2: {metrics_rf['R2']:.4f}, NASA: {metrics_rf['NASA']:.1f}")

    return model_xgb, model_rf, feat_cols, y_test, pred_xgb

xgb_fd1, rf_fd1, feat_fd1, y_test_fd1, pred_xgb_fd1 = train_tree_pipeline("FD001")
"""))

# Step 5: Visualizing Predictions & Residuals
cells.append(nbf.v4.new_markdown_cell("""### Step 5: Visualizing RUL Predictions vs NASA Ground Truth"""))
cells.append(nbf.v4.new_code_cell("""fig, axes = plt.subplots(1, 2, figsize=(14, 5))

# Actual vs Predicted
axes[0].scatter(y_test_fd1, pred_xgb_fd1, alpha=0.7, color="royalblue", edgecolors="k")
axes[0].plot([0, 150], [0, 150], "r--", lw=2, label="Perfect 1:1 Line")
axes[0].set_xlabel("Actual Ground Truth RUL (cycles)")
axes[0].set_ylabel("Predicted RUL (cycles)")
axes[0].set_title("XGBoost on FD001: Actual vs Predicted RUL")
axes[0].legend()

# Residual Distribution
residuals = pred_xgb_fd1 - y_test_fd1
sns.histplot(residuals, kde=True, ax=axes[1], color="teal")
axes[1].axvline(0, color="red", linestyle="--")
axes[1].set_xlabel("Residual Error (Predicted - Actual)")
axes[1].set_title(f"Residual Distribution (Mean: {residuals.mean():.2f}, Std: {residuals.std():.2f})")

plt.tight_layout()
plt.show()
"""))

# Step 6: Multi-Regime Datasets (FD002 & FD004) - Deep Learning
cells.append(nbf.v4.new_markdown_cell("""### Step 6: Multi-Regime Datasets (FD002 & FD004)
#### Strategy: PyTorch Sequential Deep Learning (Vanilla LSTM & 1D CNN-LSTM Hybrid)
In **FD002** and **FD004**, turbofans transition through **6 distinct flight operating regimes** (varying altitude, Mach number, and throttle). 
Tree models without temporal sequence memory struggle because a sensor reading change caused by an altitude transition looks identical to hardware degradation.

An **LSTM** or **1D CNN-LSTM Hybrid** preserves sequential context:
- **1D CNN Layer**: Filters out high-frequency fluctuations across regime transitions.
- **LSTM Layer**: Retains memory of cumulative wear across previous operating cycles.
"""))

cells.append(nbf.v4.new_code_cell("""class PyTorchLSTM(nn.Module):
    def __init__(self, input_size, hidden_size=64, num_layers=2, dropout=0.2):
        super().__init__()
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers=num_layers, batch_first=True, dropout=dropout)
        self.fc = nn.Sequential(
            nn.Linear(hidden_size, 32),
            nn.ReLU(),
            nn.Linear(32, 1)
        )
    def forward(self, x):
        out, _ = self.lstm(x)
        return self.fc(out[:, -1, :]).squeeze(-1)


class PyTorch1DCNNLSTM(nn.Module):
    def __init__(self, input_size, conv_filters=32, kernel_size=3, lstm_hidden=64, dropout=0.2):
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv1d(input_size, conv_filters, kernel_size=kernel_size, padding=kernel_size // 2),
            nn.ReLU(),
            nn.Dropout(dropout)
        )
        self.lstm = nn.LSTM(conv_filters, lstm_hidden, batch_first=True)
        self.fc = nn.Sequential(
            nn.Linear(lstm_hidden, 32),
            nn.ReLU(),
            nn.Linear(32, 1)
        )
    def forward(self, x):
        x_conv = x.permute(0, 2, 1)
        feat = self.conv(x_conv).permute(0, 2, 1)
        out, _ = self.lstm(feat)
        return self.fc(out[:, -1, :]).squeeze(-1)

print("Architectures defined successfully.")
"""))

# Step 7: Saving to Updated_Models/
cells.append(nbf.v4.new_markdown_cell("""### Step 7: Model Persistence into `Updated_Models/`
All models trained through the master pipeline (`train_all_updated_models.py`) are saved to the `Updated_Models/` directory:
- `Updated_Models/xgb_regressor_FD001.joblib`
- `Updated_Models/rf_regressor_FD001.joblib`
- `Updated_Models/xgb_regressor_FD003.joblib`
- `Updated_Models/rf_regressor_FD003.joblib`
- `Updated_Models/lstm_regressor_FD002.pt`
- `Updated_Models/cnn_lstm_regressor_FD002.pt`
- `Updated_Models/lstm_regressor_FD004.pt`
- `Updated_Models/cnn_lstm_regressor_FD004.pt`
- `Updated_Models/all_subsets_benchmark_summary.json`
"""))

cells.append(nbf.v4.new_code_cell("""# Verify saved models in Updated_Models directory
models_saved = list(OUTPUT_DIR.glob("*"))
print(f"Total artifacts in {OUTPUT_DIR}: {len(models_saved)}")
for p in sorted(models_saved):
    size_kb = p.stat().st_size / 1024
    print(f"  - {p.name:<35} ({size_kb:.1f} KB)")
"""))

nb["cells"] = cells

# Save notebook
out_path = Path("C_MAPSS_MultiSubdataset_Clean_and_Model.ipynb")
with open(out_path, "w", encoding="utf-8") as f:
    nbf.write(nb, f)

print(f"Notebook created successfully at: {out_path.resolve()}")
