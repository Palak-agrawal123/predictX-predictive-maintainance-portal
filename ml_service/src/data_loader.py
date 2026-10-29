"""
Data loader and feature engineering module for C-MAPSS dataset.
Calculates ground truth RUL, rolling statistics, and degradation indicators.
"""
import pandas as pd
import numpy as np
from pathlib import Path
from typing import Tuple, List, Dict
from src.config import (
    DATA_DIR, ID_COL, CYCLE_COL, SETTING_COLS, 
    SENSOR_COLS, ALL_RAW_COLS, ACTIVE_SENSORS, RUL_CLIP_THRESHOLD
)

def load_raw_dataset(subset: str = "FD001") -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """
    Load raw train, test, and ground-truth RUL files for a C-MAPSS subset.
    """
    train_path = DATA_DIR / f"train_{subset}.txt"
    test_path = DATA_DIR / f"test_{subset}.txt"
    rul_path = DATA_DIR / f"RUL_{subset}.txt"

    if not train_path.exists():
        raise FileNotFoundError(f"Training file {train_path} not found.")

    train_df = pd.read_csv(train_path, sep=r"\s+", header=None, names=ALL_RAW_COLS)
    test_df = pd.read_csv(test_path, sep=r"\s+", header=None, names=ALL_RAW_COLS)
    rul_df = pd.read_csv(rul_path, sep=r"\s+", header=None, names=["true_rul"])
    
    return train_df, test_df, rul_df

def compute_train_rul(df: pd.DataFrame, clip_threshold: int = RUL_CLIP_THRESHOLD) -> pd.DataFrame:
    """
    Calculate piece-wise linear Remaining Useful Life (RUL) for training engines.
    """
    df = df.copy()
    max_cycles = df.groupby(ID_COL)[CYCLE_COL].transform("max")
    df["raw_rul"] = max_cycles - df[CYCLE_COL]
    df["rul"] = df["raw_rul"].clip(upper=clip_threshold)
    # Binary failure risk within 30 cycles
    df["failure_soon"] = (df["raw_rul"] <= 30).astype(int)
    return df

def engineer_features(df: pd.DataFrame, active_sensors: List[str] = ACTIVE_SENSORS) -> pd.DataFrame:
    """
    Extract physics-informed degradation features:
    - Rolling window averages (trend smoothing)
    - Rolling window standard deviations (vibration / turbulence increase)
    - Cumulative baseline delta (drift from initial healthy operating envelope)
    """
    df = df.copy().sort_values(by=[ID_COL, CYCLE_COL])
    
    feature_cols = []
    
    # Baseline for each machine (average of first 5 cycles)
    baseline_df = (
        df[df[CYCLE_COL] <= 5]
        .groupby(ID_COL)[active_sensors]
        .mean()
        .reset_index()
    )
    df = df.merge(baseline_df, on=ID_COL, suffixes=("", "_baseline"))
    
    # Sensor drift from machine initial baseline
    for s in active_sensors:
        drift_col = f"{s}_drift"
        df[drift_col] = df[s] - df[f"{s}_baseline"]
        feature_cols.append(drift_col)
        # Drop redundant baseline col to keep dataframe clean
        df.drop(columns=[f"{s}_baseline"], inplace=True)

    # Rolling statistics grouped by engine unit
    grouped = df.groupby(ID_COL)
    
    for s in active_sensors:
        # 5-cycle short-term rolling mean
        df[f"{s}_roll_mean_5"] = grouped[s].transform(lambda x: x.rolling(5, min_periods=1).mean())
        # 15-cycle long-term rolling mean
        df[f"{s}_roll_mean_15"] = grouped[s].transform(lambda x: x.rolling(15, min_periods=1).mean())
        # 10-cycle rolling standard deviation (volatility/flutter)
        df[f"{s}_roll_std_10"] = grouped[s].transform(lambda x: x.rolling(10, min_periods=1).std().fillna(0))
        
        feature_cols.extend([f"{s}_roll_mean_5", f"{s}_roll_mean_15", f"{s}_roll_std_10"])

    # Raw active sensors and operational cycle
    all_features = [CYCLE_COL] + SETTING_COLS + active_sensors + feature_cols
    return df, all_features

def get_test_last_snapshots(test_df: pd.DataFrame) -> pd.DataFrame:
    """
    Retrieve the most recent operational snapshot (latest cycle) for each test engine.
    """
    idx = test_df.groupby(ID_COL)[CYCLE_COL].idxmax()
    return test_df.loc[idx].copy().reset_index(drop=True)
