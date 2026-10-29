"""
Operating-Regime Specific Normalization for NASA C-MAPSS FD002 & FD004
=======================================================================
Problem:
In FD002 and FD004, turbofans transition through 6 distinct flight conditions
(varying altitude from 0 to 42,000 ft, Mach 0.0 to 0.84, throttle 60 to 100).
A global scaler causes altitude/Mach shifts to dwarf subtle mechanical wear.

Solution:
1. Cluster the 3 operational settings using KMeans (k=6) fit strictly on train.
2. Compute sensor mean and std within each regime on train data only.
3. Standardize each observation relative to its specific operating cluster.
4. Drop sensors that have near-zero variance across all clusters (flat sensors).
"""

from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
import joblib

SETTINGS_COLS = ["setting_1", "setting_2", "setting_3"]
SENSOR_COLS = [f"s_{i}" for i in range(1, 22)]


class RegimeNormalizer:
    def __init__(self, n_clusters: int = 6, random_state: int = 42):
        self.n_clusters = n_clusters
        self.random_state = random_state
        self.kmeans = KMeans(n_clusters=n_clusters, random_state=random_state, n_init=10)
        self.means_df = None
        self.stds_df = None
        self.flat_sensors = []
        self.active_sensors = []
        self.is_fitted = False

    def fit(self, train_df: pd.DataFrame):
        # 1. Fit KMeans clustering strictly on training operational settings
        regimes = self.kmeans.fit_predict(train_df[SETTINGS_COLS])
        df_copy = train_df.copy()
        df_copy["_regime"] = regimes

        # 2. Compute mean and standard deviation per regime for every sensor
        means = df_copy.groupby("_regime")[SENSOR_COLS].mean()
        stds = df_copy.groupby("_regime")[SENSOR_COLS].std().replace(0, 1.0).fillna(1.0)

        # 3. Detect flat / uninformative sensors (variance < 0.02 across regimes)
        norm_test = (df_copy[SENSOR_COLS].values - means.loc[regimes, SENSOR_COLS].values) / stds.loc[regimes, SENSOR_COLS].values
        norm_stds = pd.DataFrame(norm_test, columns=SENSOR_COLS).std()
        self.flat_sensors = norm_stds[norm_stds < 0.05].index.tolist()
        self.active_sensors = [s for s in SENSOR_COLS if s not in self.flat_sensors]

        self.means_df = means[self.active_sensors]
        self.stds_df = stds[self.active_sensors]
        self.is_fitted = True

        return self

    def transform(self, df: pd.DataFrame) -> pd.DataFrame:
        if not self.is_fitted:
            raise RuntimeError("RegimeNormalizer must be fitted before transforming.")

        df = df.copy()
        regimes = self.kmeans.predict(df[SETTINGS_COLS])
        df["_regime"] = regimes

        # Vectorized lookup across clusters
        means_array = self.means_df.loc[regimes, self.active_sensors].values
        stds_array = self.stds_df.loc[regimes, self.active_sensors].values

        norm_values = (df[self.active_sensors].values - means_array) / stds_array

        for idx, s in enumerate(self.active_sensors):
            df[f"{s}_norm"] = norm_values[:, idx]

        return df

    def fit_transform(self, train_df: pd.DataFrame) -> pd.DataFrame:
        self.fit(train_df)
        return self.transform(train_df)

    def save(self, filepath: Path):
        joblib.dump(self, filepath)

    @staticmethod
    def load(filepath: Path) -> "RegimeNormalizer":
        return joblib.load(filepath)
