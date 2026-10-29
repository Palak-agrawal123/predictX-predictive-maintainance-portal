"""
NASA C-MAPSS Group-K-Fold Cross-Validation Split Generator
==========================================================
Essential Rule for Prognostics & Time-Series:
Group-K-Fold ensures that complete engine trajectories (all cycles for a given unit_id)
belong exclusively to ONE fold. This guarantees ZERO DATA LEAKAGE between training
and validation folds.

With K = 5 folds:
- Each fold trains on 80% of engines and validates on 20% of engines.
- Across all 5 folds, every single engine in the fleet is validated out-of-fold exactly once.
- Produces:
  1. 'train_kfold_{subset}.csv': Full data with assigned 'fold' (0 to 4) and target RUL.
  2. 'kfold_assignments_{subset}.csv': Unit-to-fold mapping table.
  3. Fold subdirectories 'kfold_data/{subset}/fold_{i}/':
     - train_split.txt (26-column raw format for train)
     - val_censored.txt & val_RUL.txt (censored test-style validation)
     - val_full.csv (full trajectory validation)
"""

import os
import json
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.model_selection import KFold

def _find_repo_root():
    curr = Path(__file__).resolve().parent
    for p in [curr, curr.parent, curr.parent.parent]:
        if (p / "kfold_data").exists() or (p / ".git").exists() or (p / "ml_service").exists():
            return p
    return curr

BASE_DIR = _find_repo_root()
DATA_DIR = BASE_DIR / "CMaps"
OUTPUT_DIR = BASE_DIR / "kfold_data"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

ID_COL = "unit_id"
CYCLE_COL = "cycle"
SETTING_COLS = ["setting_1", "setting_2", "setting_3"]
SENSOR_COLS = [f"s_{i}" for i in range(1, 22)]
ALL_COLS = [ID_COL, CYCLE_COL] + SETTING_COLS + SENSOR_COLS


def generate_kfold_splits(
    subset: str = "FD001",
    n_splits: int = 5,
    random_seed: int = 42,
    clip_threshold: int = 125,
    min_censor_pct: float = 0.35,
    max_censor_pct: float = 0.85,
) -> dict:
    train_file = DATA_DIR / f"train_{subset}.txt"
    if not train_file.exists():
        raise FileNotFoundError(f"File not found: {train_file}")

    print(f"\n{'='*70}")
    print(f"  GENERATING {n_splits}-FOLD GROUP-SPLITS FOR: {subset}")
    print(f"{'='*70}")

    df = pd.read_csv(train_file, sep=r"\s+", header=None, names=ALL_COLS)
    unique_units = np.array(sorted(df[ID_COL].unique()))
    n_units = len(unique_units)

    # Compute piece-wise linear target RUL
    max_c = df.groupby(ID_COL)[CYCLE_COL].transform("max")
    df["raw_rul"] = max_c - df[CYCLE_COL]
    df["target_rul"] = df["raw_rul"].clip(upper=clip_threshold)

    # Unit-level K-Fold splitting
    kf = KFold(n_splits=n_splits, shuffle=True, random_state=random_seed)
    unit_fold_map = {}

    for fold_idx, (train_unit_indices, val_unit_indices) in enumerate(kf.split(unique_units)):
        for u_idx in val_unit_indices:
            unit_fold_map[int(unique_units[u_idx])] = fold_idx

    # Annotate dataframe with fold
    df["fold"] = df[ID_COL].map(unit_fold_map)

    # Save annotated training dataset
    annotated_csv_path = OUTPUT_DIR / f"train_kfold_{subset}.csv"
    df.to_csv(annotated_csv_path, index=False)
    print(f"  [Created] {annotated_csv_path.name} ({len(df):,} rows with 'fold' column 0..{n_splits-1})")

    # Unit assignment summary
    unit_lifespans = df.groupby(ID_COL)[CYCLE_COL].max().to_dict()
    assignment_df = pd.DataFrame([
        {"unit_id": uid, "assigned_fold": unit_fold_map[uid], "total_cycles": unit_lifespans[uid]}
        for uid in unique_units
    ]).sort_values(by=["assigned_fold", "unit_id"]).reset_index(drop=True)

    assignment_csv_path = OUTPUT_DIR / f"kfold_assignments_{subset}.csv"
    assignment_df.to_csv(assignment_csv_path, index=False)
    print(f"  [Created] {assignment_csv_path.name} ({len(assignment_df)} units mapped)")

    # RNG for censored cuts
    rng = np.random.RandomState(random_seed)

    subset_fold_dir = OUTPUT_DIR / subset
    subset_fold_dir.mkdir(parents=True, exist_ok=True)

    fold_summaries = []

    # Generate partitioned files for each fold
    for fold_idx in range(n_splits):
        fold_dir = subset_fold_dir / f"fold_{fold_idx}"
        fold_dir.mkdir(parents=True, exist_ok=True)

        val_units_in_fold = sorted([uid for uid, f in unit_fold_map.items() if f == fold_idx])
        train_units_in_fold = sorted([uid for uid, f in unit_fold_map.items() if f != fold_idx])

        train_fold_df = df[df[ID_COL].isin(train_units_in_fold)].copy()
        val_full_fold_df = df[df[ID_COL].isin(val_units_in_fold)].copy()

        # 1. Save train partition (space-separated 26-cols)
        train_path = fold_dir / "train_split.txt"
        train_fold_df[ALL_COLS].to_csv(train_path, sep=" ", header=False, index=False)

        # 2. Save full validation trajectory (CSV with target_rul)
        val_full_path = fold_dir / "val_full.csv"
        val_full_fold_df.to_csv(val_full_path, index=False)

        # 3. Save censored validation set & RUL ground truth
        val_censored_rows = []
        val_true_ruls = []
        val_unit_details = []

        for uid in val_units_in_fold:
            u_df = val_full_fold_df[val_full_fold_df[ID_COL] == uid].sort_values(CYCLE_COL)
            lifespan = u_df[CYCLE_COL].max()

            censor_pct = rng.uniform(min_censor_pct, max_censor_pct)
            cutoff_cycle = int(np.clip(np.round(lifespan * censor_pct), 15, lifespan - 5))

            censored_u = u_df[u_df[CYCLE_COL] <= cutoff_cycle][ALL_COLS].copy()
            val_censored_rows.append(censored_u)

            true_rul = int(lifespan - cutoff_cycle)
            val_true_ruls.append(true_rul)

            val_unit_details.append({
                "unit_id": int(uid),
                "total_lifespan": int(lifespan),
                "cutoff_cycle": int(cutoff_cycle),
                "true_remaining_cycles": int(true_rul),
                "censor_pct": round(float(cutoff_cycle / lifespan), 3),
            })

        val_censored_df = pd.concat(val_censored_rows, ignore_index=True)

        val_censored_path = fold_dir / "val_censored.txt"
        val_censored_df.to_csv(val_censored_path, sep=" ", header=False, index=False)

        val_rul_path = fold_dir / "val_RUL.txt"
        np.savetxt(val_rul_path, val_true_ruls, fmt="%d")

        # Fold metadata
        fold_meta = {
            "subset": subset,
            "fold_index": fold_idx,
            "train_units_count": len(train_units_in_fold),
            "val_units_count": len(val_units_in_fold),
            "val_unit_ids": val_units_in_fold,
            "train_rows": len(train_fold_df),
            "val_full_rows": len(val_full_fold_df),
            "val_censored_rows": len(val_censored_df),
            "val_units_detail": val_unit_details,
        }
        with open(fold_dir / "fold_metadata.json", "w") as f:
            json.dump(fold_meta, f, indent=2)

        fold_summaries.append(fold_meta)
        print(f"  -> Fold {fold_idx}: Train {len(train_units_in_fold)} units ({len(train_fold_df):,} rows) | Val {len(val_units_in_fold)} units ({len(val_censored_df):,} censored rows)")

    # Master summary
    summary_path = OUTPUT_DIR / f"kfold_summary_{subset}.json"
    master_summary = {
        "subset": subset,
        "n_splits": n_splits,
        "random_seed": random_seed,
        "total_units": n_units,
        "clip_threshold": clip_threshold,
        "folds": fold_summaries,
    }
    with open(summary_path, "w") as f:
        json.dump(master_summary, f, indent=2)
    print(f"  [Created] {summary_path.name}")
    return master_summary


def main():
    print("=" * 70)
    print("  NASA C-MAPSS K-FOLD VALIDATION DATASET BUILDER")
    print("  Destination: kfold_data/")
    print("=" * 70)

    for sub in ["FD001", "FD002", "FD003", "FD004"]:
        generate_kfold_splits(subset=sub, n_splits=5, random_seed=42)

    print("\n" + "=" * 70)
    print("  ALL 5-FOLD DATASETS SUCCESSFULLY CREATED IN kfold_data/")
    print("=" * 70)


if __name__ == "__main__":
    main()
