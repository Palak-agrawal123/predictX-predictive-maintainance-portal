"""
Validation Dataset Generator for NASA C-MAPSS Turbofan Engine Dataset
=====================================================================
Crucial Rule in Industrial Prognostics (PHM):
NEVER perform random row-level splitting! Random row splitting causes massive
data leakage because consecutive cycles of the same engine would appear in both
training and validation.

This script performs strict UNIT-LEVEL (Group-based) splitting:
1. Holds out a random sample of complete engine units (e.g. 20% of engines).
2. Generates TWO standard validation formats:
   a) Full Run-to-Failure Validation ('val_full_FDxxx.csv'):
      Contains all cycles of the held-out engines with target RUL.
      Ideal for continuous degradation curve fitting & temporal monitoring.
   b) Censored Benchmark Validation ('val_censored_FDxxx.txt' & 'val_RUL_FDxxx.txt'):
      Censors each validation engine at a random cycle (30% to 85% of lifespan),
      mirroring the EXACT structure of NASA's test set.
      Ideal for tuning hyperparameters on RMSE, MAE, R², and the NASA PHM score.
3. Exports the remaining engines as 'train_split_FDxxx.txt'.
"""

import os
import json
from pathlib import Path
import numpy as np
import pandas as pd

# Paths
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "CMaps"
OUTPUT_DIR = BASE_DIR / "validation_data"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Standard C-MAPSS schema
ID_COL = "unit_id"
CYCLE_COL = "cycle"
SETTING_COLS = ["setting_1", "setting_2", "setting_3"]
SENSOR_COLS = [f"s_{i}" for i in range(1, 22)]
ALL_COLS = [ID_COL, CYCLE_COL] + SETTING_COLS + SENSOR_COLS


def create_validation_split(
    subset: str = "FD001",
    val_ratio: float = 0.20,
    random_seed: int = 42,
    clip_threshold: int = 125,
    min_censor_pct: float = 0.35,
    max_censor_pct: float = 0.85,
) -> dict:
    """
    Splits the training run-to-failure file into Train Split and Validation Split
    at the engine (unit_id) level.
    """
    train_file = DATA_DIR / f"train_{subset}.txt"
    if not train_file.exists():
        raise FileNotFoundError(f"File not found: {train_file}")

    # Load raw training data
    df = pd.read_csv(train_file, sep=r"\s+", header=None, names=ALL_COLS)
    unique_units = np.array(sorted(df[ID_COL].unique()))
    n_units = len(unique_units)

    # Set seed for reproducible splitting
    rng = np.random.RandomState(random_seed)
    n_val = int(np.round(n_units * val_ratio))
    val_units = rng.choice(unique_units, size=n_val, replace=False)
    val_units = [int(u) for u in sorted(list(val_units))]
    train_units = [int(u) for u in sorted(list(set(unique_units) - set(val_units)))]

    print(f"\n[{subset}] Total Units: {n_units} | Train Units: {len(train_units)} ({(1-val_ratio)*100:.0f}%) | Val Units: {len(val_units)} ({val_ratio*100:.0f}%)")
    print(f"[{subset}] Validation Unit IDs: {val_units}")

    # Partition by unit_id
    train_split_df = df[df[ID_COL].isin(train_units)].copy().reset_index(drop=True)
    val_full_df = df[df[ID_COL].isin(val_units)].copy().reset_index(drop=True)

    # Compute ground truth piece-wise RUL for full sets
    for split_df in [train_split_df, val_full_df]:
        max_c = split_df.groupby(ID_COL)[CYCLE_COL].transform("max")
        split_df["raw_rul"] = max_c - split_df[CYCLE_COL]
        split_df["target_rul"] = split_df["raw_rul"].clip(upper=clip_threshold)

    # -------------------------------------------------------------------------
    # Format B: Censored Validation (Mirroring NASA Test Set Structure)
    # -------------------------------------------------------------------------
    # For each validation unit, pick a random cutoff cycle between min_censor_pct and max_censor_pct
    val_censored_rows = []
    val_true_ruls = []
    val_metadata_records = []

    for uid in val_units:
        unit_df = val_full_df[val_full_df[ID_COL] == uid].sort_values(CYCLE_COL)
        total_lifespan = unit_df[CYCLE_COL].max()

        # Randomly censor between min_censor_pct and max_censor_pct of total life
        censor_pct = rng.uniform(min_censor_pct, max_censor_pct)
        cutoff_cycle = int(np.clip(np.round(total_lifespan * censor_pct), 15, total_lifespan - 5))

        # Censored trajectory (cycles 1 to cutoff_cycle)
        censored_trajectory = unit_df[unit_df[CYCLE_COL] <= cutoff_cycle][ALL_COLS].copy()
        val_censored_rows.append(censored_trajectory)

        # True remaining useful life at the cutoff point
        true_rul_at_cutoff = int(total_lifespan - cutoff_cycle)
        val_true_ruls.append(true_rul_at_cutoff)

        val_metadata_records.append({
            "unit_id": int(uid),
            "total_lifespan": int(total_lifespan),
            "cutoff_cycle": int(cutoff_cycle),
            "true_remaining_cycles": int(true_rul_at_cutoff),
            "censor_pct_of_lifespan": round(float(cutoff_cycle / total_lifespan), 3)
        })

    val_censored_df = pd.concat(val_censored_rows, ignore_index=True)

    # -------------------------------------------------------------------------
    # Save files to disk
    # -------------------------------------------------------------------------
    # 1. Train split in original space-separated format (26 cols)
    train_split_path = OUTPUT_DIR / f"train_split_{subset}.txt"
    train_split_df[ALL_COLS].to_csv(train_split_path, sep=" ", header=False, index=False)

    # 2. Full run-to-failure validation in CSV with RUL target
    val_full_path = OUTPUT_DIR / f"val_full_{subset}.csv"
    val_full_df.to_csv(val_full_path, index=False)

    # 3. Censored validation text file (exact same format as test_FDxxx.txt)
    val_censored_path = OUTPUT_DIR / f"val_censored_{subset}.txt"
    val_censored_df.to_csv(val_censored_path, sep=" ", header=False, index=False)

    # 4. Validation ground truth RUL (exact same format as RUL_FDxxx.txt)
    val_rul_path = OUTPUT_DIR / f"val_RUL_{subset}.txt"
    np.savetxt(val_rul_path, val_true_ruls, fmt="%d")

    # 5. Metadata summary
    meta_path = OUTPUT_DIR / f"val_metadata_{subset}.json"
    summary_meta = {
        "subset": subset,
        "total_units_original": n_units,
        "train_units_count": len(train_units),
        "val_units_count": len(val_units),
        "train_units": train_units,
        "val_units": val_units,
        "random_seed": random_seed,
        "clip_threshold": clip_threshold,
        "train_split_rows": len(train_split_df),
        "val_full_rows": len(val_full_df),
        "val_censored_rows": len(val_censored_df),
        "val_units_detail": val_metadata_records,
    }
    with open(meta_path, "w") as f:
        json.dump(summary_meta, f, indent=2)

    print(f"  -> Saved {train_split_path.name} ({len(train_split_df):,} rows)")
    print(f"  -> Saved {val_full_path.name} ({len(val_full_df):,} rows)")
    print(f"  -> Saved {val_censored_path.name} ({len(val_censored_df):,} rows across {len(val_units)} units)")
    print(f"  -> Saved {val_rul_path.name} ({len(val_true_ruls)} ground-truth targets)")
    print(f"  -> Saved {meta_path.name}")

    return summary_meta


def main():
    print("=" * 70)
    print("  NASA C-MAPSS VALIDATION DATASET GENERATOR")
    print("  Destination: validation_data/")
    print("=" * 70)

    for sub in ["FD001", "FD002", "FD003", "FD004"]:
        create_validation_split(subset=sub, val_ratio=0.20, random_seed=42)

    print("\n" + "=" * 70)
    print("  ALL VALIDATION DATASETS SUCCESSFULLY GENERATED IN validation_data/")
    print("=" * 70)


if __name__ == "__main__":
    main()
