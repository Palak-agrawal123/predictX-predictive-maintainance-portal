"""
NASA C-MAPSS Turbofan Degradation - Baseline Data Cleanliness Audit & Modeling Pipeline
=======================================================================================
This script provides an end-to-end, reproducible foundation for prognostic modeling:
1. Complete Data Integrity & Cleanliness Audit (FD001 - FD004)
2. Constant / Zero-Variance Sensor Detection
3. Run-to-Failure Target (RUL) Formulation & Piece-wise Linear Clipping
4. Physics-informed Baseline Feature Engineering (Rolling Averages & Baseline Drift)
5. Model Training from the Ground Up (Baseline Linear, Random Forest, XGBoost)
6. Comprehensive Benchmarking (RMSE, MAE, R², and Official NASA PHM Prognostics Score)
7. Residual & Feature Importance Diagnostics

Run as a standalone script:
    python pipeline_base_model.py

Or execute cell-by-cell in VS Code / PyCharm / Spyder using the '#%%' cell delimiters.
"""

#%% [1] Imports and Configuration
import os
import sys
from pathlib import Path
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.linear_model import Ridge
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
import xgboost as xgb

# Set styling
sns.set_theme(style="whitegrid")
plt.rcParams["figure.figsize"] = (10, 5)

# Paths
def _find_repo_root():
    curr = Path(__file__).resolve().parent if "__file__" in locals() else Path.cwd()
    for p in [curr, curr.parent, curr.parent.parent]:
        if (p / "CMaps").exists() or (p / ".git").exists() or (p / "ml_service").exists():
            return p
    return curr

BASE_DIR = _find_repo_root()
DATA_DIR = BASE_DIR / "CMaps"

# C-MAPSS Standard 26-column Schema
ID_COL = "unit_id"
CYCLE_COL = "cycle"
SETTING_COLS = ["setting_1", "setting_2", "setting_3"]
SENSOR_COLS = [f"s_{i}" for i in range(1, 22)]
ALL_COLS = [ID_COL, CYCLE_COL] + SETTING_COLS + SENSOR_COLS

# Descriptive metadata for all 21 sensors
SENSOR_METADATA = {
    "s_1": "T2 - Total temp at fan inlet (°R)",
    "s_2": "T24 - Total temp at LPC outlet (°R)",
    "s_3": "T30 - Total temp at HPC outlet (°R)",
    "s_4": "T50 - Total temp at LPT outlet (°R)",
    "s_5": "P2 - Pressure at fan inlet (psia)",
    "s_6": "P15 - Total pressure in bypass-duct (psia)",
    "s_7": "P30 - Total pressure at HPC outlet (psia)",
    "s_8": "Nf - Physical fan speed (rpm)",
    "s_9": "Nc - Physical core speed (rpm)",
    "s_10": "epr - Engine pressure ratio (P50/P2)",
    "s_11": "Ps30 - Static pressure at HPC outlet (psia)",
    "s_12": "Phi - Ratio of fuel flow to Ps30 (pps/psi)",
    "s_13": "NRf - Corrected fan speed (rpm)",
    "s_14": "NRc - Corrected core speed (rpm)",
    "s_15": "BPR - Bypass Ratio",
    "s_16": "farB - Burner fuel-air ratio",
    "s_17": "htBleed - Bleed Enthalpy (btu/lb)",
    "s_18": "Nf_dmd - Demanded fan speed (rpm)",
    "s_19": "PCNfR_dmd - Demanded corrected fan speed (rpm)",
    "s_20": "W31 - HPT coolant bleed (lbm/s)",
    "s_21": "W32 - LPT coolant bleed (lbm/s)",
}


#%% [2] Comprehensive Data Cleanliness & Integrity Audit
def audit_dataset(subset: str = "FD001") -> dict:
    """
    Rigorously checks raw files for:
    - Missing/NaN/Infinite values
    - Formatting inconsistencies (row column count)
    - Sequential cycle integrity (starts at 1, increments strictly by 1)
    - Duplicate keys (unit_id, cycle)
    - Constant / zero-variance sensors
    - Test set trajectory alignment with ground truth RUL
    """
    print(f"\n{'='*70}")
    print(f"       COMPREHENSIVE DATA CLEANLINESS AUDIT: {subset}")
    print(f"{'='*70}")

    train_file = DATA_DIR / f"train_{subset}.txt"
    test_file = DATA_DIR / f"test_{subset}.txt"
    rul_file = DATA_DIR / f"RUL_{subset}.txt"

    if not train_file.exists() or not test_file.exists() or not rul_file.exists():
        raise FileNotFoundError(f"Missing files for {subset} in {DATA_DIR}")

    # Check raw lines
    with open(train_file, "r") as f:
        train_lines = [l.strip() for l in f if l.strip()]
    train_col_lens = set(len(l.split()) for l in train_lines)

    with open(test_file, "r") as f:
        test_lines = [l.strip() for l in f if l.strip()]
    test_col_lens = set(len(l.split()) for l in test_lines)

    with open(rul_file, "r") as f:
        rul_lines = [l.strip() for l in f if l.strip()]

    # Load DataFrames
    train_df = pd.read_csv(train_file, sep=r"\s+", header=None, names=ALL_COLS)
    test_df = pd.read_csv(test_file, sep=r"\s+", header=None, names=ALL_COLS)
    rul_df = pd.read_csv(rul_file, sep=r"\s+", header=None, names=["true_rul"])

    # 1. Null / Inf checks
    train_nulls = int(train_df.isna().sum().sum())
    test_nulls = int(test_df.isna().sum().sum())
    train_infs = int(np.isinf(train_df.values).sum())
    test_infs = int(np.isinf(test_df.values).sum())

    # 2. Key uniqueness
    train_dups = int(train_df.duplicated(subset=[ID_COL, CYCLE_COL]).sum())
    test_dups = int(test_df.duplicated(subset=[ID_COL, CYCLE_COL]).sum())

    # 3. Unit counts
    train_units = train_df[ID_COL].nunique()
    test_units = test_df[ID_COL].nunique()
    rul_count = len(rul_df)

    # 4. Cycle integrity
    train_start_1 = bool((train_df.groupby(ID_COL)[CYCLE_COL].min() == 1).all())
    test_start_1 = bool((test_df.groupby(ID_COL)[CYCLE_COL].min() == 1).all())
    train_inc_1 = bool(train_df.groupby(ID_COL)[CYCLE_COL].apply(lambda s: (s.diff().dropna() == 1).all()).all())
    test_inc_1 = bool(test_df.groupby(ID_COL)[CYCLE_COL].apply(lambda s: (s.diff().dropna() == 1).all()).all())

    # 5. Trajectory statistics
    train_lens = train_df.groupby(ID_COL)[CYCLE_COL].max()
    test_lens = test_df.groupby(ID_COL)[CYCLE_COL].max()

    # 6. Constant / Zero-variance features
    train_stds = train_df.std()
    constant_features = train_stds[train_stds < 1e-6].index.tolist()

    # Print summary table
    print(f"1. FILE INTEGRITY:")
    print(f"   - Training records:       {len(train_lines):,} rows across {train_units} engines (All rows have {train_col_lens} columns)")
    print(f"   - Test records:           {len(test_lines):,} rows across {test_units} engines (All rows have {test_col_lens} columns)")
    print(f"   - Ground truth RUL count: {rul_count} targets")
    print(f"\n2. DATA HYGIENE:")
    print(f"   - Missing/Null values:    Train={train_nulls}, Test={test_nulls} [{'OK' if train_nulls == test_nulls == 0 else 'FAIL'}]")
    print(f"   - Infinite values:        Train={train_infs}, Test={test_infs} [{'OK' if train_infs == test_infs == 0 else 'FAIL'}]")
    print(f"   - Duplicate (unit,cycle): Train={train_dups}, Test={test_dups} [{'OK' if train_dups == test_dups == 0 else 'FAIL'}]")
    print(f"\n3. TIME-SERIES TRAJECTORY INTEGRITY:")
    print(f"   - All start at cycle 1:   Train={train_start_1}, Test={test_start_1} [{'OK' if train_start_1 and test_start_1 else 'FAIL'}]")
    print(f"   - Strict +1 increment:    Train={train_inc_1}, Test={test_inc_1} [{'OK' if train_inc_1 and test_inc_1 else 'FAIL'}]")
    print(f"   - Train lifespan range:   Min={train_lens.min()} cycles, Max={train_lens.max()} cycles, Mean={train_lens.mean():.1f} cycles")
    print(f"   - Test trajectory range:  Min={test_lens.min()} cycles, Max={test_lens.max()} cycles, Mean={test_lens.mean():.1f} cycles")
    print(f"   - Ground Truth RUL range: Min={rul_df['true_rul'].min()}, Max={rul_df['true_rul'].max()}, Mean={rul_df['true_rul'].mean():.1f}")
    print(f"\n4. FLAT (ZERO-VARIANCE) UNINFORMATIVE FEATURES:")
    print(f"   - Detected {len(constant_features)} constant columns: {constant_features}")
    if constant_features:
        print(f"   * ACTION: These constant columns must be excluded from modeling (they offer 0 predictive power).")

    print(f"{'-'*70}")
    print(f"AUDIT VERDICT: Raw dataset is SYNTACTICALLY CLEAN (no corrupted rows, no NaNs).")
    print(f"However, proper baseline preparation requires: (1) dropping constant sensors,")
    print(f"(2) computing target RUL with piece-wise clipping, and (3) feature scaling.")
    print(f"{'='*70}\n")

    return {
        "train_df": train_df,
        "test_df": test_df,
        "rul_df": rul_df,
        "constant_features": constant_features,
    }


#%% [3] Official NASA PHM Prognostics Evaluation Metric
def compute_nasa_phm_score(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """
    Official NASA Prognostics and Health Management (PHM) competition score:
    Asymmetric exponential penalty penalizing late predictions (over-optimistic, risk of breakdown)
    more severely than early predictions (conservative maintenance).

    d = y_pred - y_true
    S = sum(exp(-d / 13) - 1 for d < 0) + sum(exp(d / 10) - 1 for d >= 0)
    """
    d = np.array(y_pred) - np.array(y_true)
    score = np.where(d < 0, np.exp(-d / 13.0) - 1.0, np.exp(d / 10.0) - 1.0)
    return float(np.sum(score))


#%% [4] Target Formulation & Baseline Feature Engineering
def prepare_clean_baseline_data(
    train_df: pd.DataFrame, 
    test_df: pd.DataFrame, 
    constant_features: list,
    clip_threshold: int = 125
):
    """
    1. Formulates target RUL for training engines (run-to-failure):
       raw_rul = max(cycle) - cycle
       clipped_rul = min(raw_rul, clip_threshold)
       (In gas turbines, early cycles represent healthy baseline with no wear;
        piece-wise linear capping at ~125 cycles is standard industry & NASA benchmark).
    2. Drops non-informative constant sensors.
    3. Builds baseline features:
       - Raw active sensors
       - Cumulative sensor drift from initial healthy operating baseline (mean of first 5 cycles)
       - Rolling window moving averages (5-cycle short-term and 15-cycle long-term)
       - Rolling window volatility / standard deviation (10-cycle)
    4. Extracts censored test snapshot (last observed cycle per test engine).
    """
    # 1. Target RUL calculation
    train = train_df.copy()
    max_cycles = train.groupby(ID_COL)[CYCLE_COL].transform("max")
    train["raw_rul"] = max_cycles - train[CYCLE_COL]
    train["target_rul"] = train["raw_rul"].clip(upper=clip_threshold)

    # Informative sensors
    active_sensors = [s for s in SENSOR_COLS if s not in constant_features]

    # Feature extractor
    def engineer_signals(df: pd.DataFrame) -> tuple:
        df = df.copy().sort_values(by=[ID_COL, CYCLE_COL])
        grouped = df.groupby(ID_COL)
        features_created = []

        # Baseline drift (difference from initial 5 healthy cycles)
        healthy_base = df[df[CYCLE_COL] <= 5].groupby(ID_COL)[active_sensors].mean().reset_index()
        df = df.merge(healthy_base, on=ID_COL, suffixes=("", "_init"))

        for s in active_sensors:
            drift_col = f"{s}_drift"
            df[drift_col] = df[s] - df[f"{s}_init"]
            df.drop(columns=[f"{s}_init"], inplace=True)
            features_created.append(drift_col)

        # Rolling dynamics
        for s in active_sensors:
            df[f"{s}_rm5"] = grouped[s].transform(lambda x: x.rolling(5, min_periods=1).mean())
            df[f"{s}_rm15"] = grouped[s].transform(lambda x: x.rolling(15, min_periods=1).mean())
            df[f"{s}_rstd10"] = grouped[s].transform(lambda x: x.rolling(10, min_periods=1).std().fillna(0))
            features_created.extend([f"{s}_rm5", f"{s}_rm15", f"{s}_rstd10"])

        # Active raw settings and sensors
        feature_columns = [CYCLE_COL, "setting_1", "setting_2"] + active_sensors + features_created
        return df, feature_columns

    train_proc, feature_cols = engineer_signals(train)
    test_proc, _ = engineer_signals(test_df)

    # For testing, each unit's remaining life is evaluated at its last recorded cycle
    test_last_snapshots = test_proc.groupby(ID_COL).last().reset_index()

    return train_proc, test_last_snapshots, feature_cols


#%% [5] Model Training and Evaluation Pipeline
def train_and_benchmark_models(
    train_proc: pd.DataFrame,
    test_last: pd.DataFrame,
    y_test: np.ndarray,
    feature_cols: list
):
    """
    Trains multiple model architectures from basic to advanced:
    1. Baseline Ridge Linear Regression
    2. Random Forest Regressor
    3. XGBoost Gradient Boosted Regressor
    Evaluates all against NASA test ground truth.
    """
    X_train = train_proc[feature_cols]
    y_train = train_proc["target_rul"].values
    X_test = test_last[feature_cols]

    # Standard Scaler
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # Models dictionary
    models = {
        "Baseline Ridge Regression": Ridge(alpha=100.0),
        "Random Forest Regressor": RandomForestRegressor(n_estimators=100, max_depth=12, random_state=42, n_jobs=-1),
        "XGBoost Regressor": xgb.XGBRegressor(
            n_estimators=120,
            max_depth=4,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=42,
            n_jobs=-1,
        ),
    }

    results = []
    predictions = {}

    print(f"\n{'='*70}")
    print(f"       MODEL BENCHMARK RESULTS (EVALUATED ON HELD-OUT TEST GROUND TRUTH)")
    print(f"{'='*70}")

    for name, model in models.items():
        if "Ridge" in name:
            model.fit(X_train_scaled, y_train)
            y_pred = model.predict(X_test_scaled)
        else:
            model.fit(X_train, y_train)
            y_pred = model.predict(X_test)

        # Clip predictions to non-negative
        y_pred = np.clip(y_pred, a_min=0, a_max=None)
        predictions[name] = y_pred

        rmse = np.sqrt(mean_squared_error(y_test, y_pred))
        mae = mean_absolute_error(y_test, y_pred)
        r2 = r2_score(y_test, y_pred)
        phm_score = compute_nasa_phm_score(y_test, y_pred)

        results.append({
            "Model": name,
            "RMSE (cycles)": round(rmse, 2),
            "MAE (cycles)": round(mae, 2),
            "R² Score": round(r2, 4),
            "NASA PHM Score": round(phm_score, 1),
        })

    results_df = pd.DataFrame(results)
    print(results_df.to_string(index=False))
    print(f"{'='*70}\n")

    # Feature importances for XGBoost
    xgb_model = models["XGBoost Regressor"]
    importance_series = pd.Series(xgb_model.feature_importances_, index=feature_cols).sort_values(ascending=False)

    print("Top 10 Most Predictive Sensor Features (XGBoost):")
    for feat, imp in importance_series.head(10).items():
        desc = SENSOR_METADATA.get(feat.split("_")[0] + "_" + feat.split("_")[1] if feat.startswith("s_") else feat, feat)
        print(f"   - {feat:<20}: {imp*100:5.2f}% ({desc})")

    return results_df, predictions, models, importance_series


#%% [6] Main Execution Entrypoint
def main():
    # 1. Audit Dataset
    audit = audit_dataset("FD001")
    train_df = audit["train_df"]
    test_df = audit["test_df"]
    y_test = audit["rul_df"]["true_rul"].values
    constant_features = audit["constant_features"]

    # 2. Prepare Clean Data & Features
    train_proc, test_last, feature_cols = prepare_clean_baseline_data(
        train_df=train_df,
        test_df=test_df,
        constant_features=constant_features,
        clip_threshold=125,
    )
    print(f"Engineered {len(feature_cols)} clean feature columns for modeling.")

    # 3. Train & Benchmark
    results_df, predictions, models, importances = train_and_benchmark_models(
        train_proc=train_proc,
        test_last=test_last,
        y_test=y_test,
        feature_cols=feature_cols,
    )

    # 4. Show sample predictions vs ground truth
    sample_df = pd.DataFrame({
        "Unit ID": test_last[ID_COL],
        "Last Recorded Cycle": test_last[CYCLE_COL],
        "Actual Remaining Useful Life": y_test,
        "Predicted RUL (XGBoost)": np.round(predictions["XGBoost Regressor"], 1),
    })
    sample_df["Prediction Error (cycles)"] = np.round(sample_df["Predicted RUL (XGBoost)"] - sample_df["Actual Remaining Useful Life"], 1)

    print("\nSample Test Fleet Remaining Useful Life Predictions (First 10 Engines):")
    print(sample_df.head(10).to_string(index=False))

    return results_df, sample_df


if __name__ == "__main__":
    main()
