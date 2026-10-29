"""
Predictive Maintenance ML Models: RUL Regressor & Failure Risk Classifier.
Includes NASA PHM metric scoring and feature importance extraction.
"""
import numpy as np
import pandas as pd
from typing import Tuple, Dict, Any, List
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score, roc_auc_score, f1_score, precision_score, recall_score
import xgboost as xgb
import joblib
from pathlib import Path

def compute_nasa_phm_score(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """
    Official NASA PHM Prognostics Score:
    Asymmetric exponential penalty function penalizing late predictions more than early ones.
    d = y_pred - y_true
    S = sum(exp(-d/13) - 1 for d < 0) + sum(exp(d/10) - 1 for d >= 0)
    """
    d = np.array(y_pred) - np.array(y_true)
    score = 0.0
    for diff in d:
        if diff < 0:
            score += np.exp(-diff / 13.0) - 1.0
        else:
            score += np.exp(diff / 10.0) - 1.0
    return float(score)

class PredictiveMaintenanceModel:
    def __init__(self, n_estimators: int = 150, max_depth: int = 5, learning_rate: float = 0.05):
        self.scaler = StandardScaler()
        self.feature_names = []
        
        # XGBoost Regressor for Remaining Useful Life
        self.regressor = xgb.XGBRegressor(
            n_estimators=n_estimators,
            max_depth=max_depth,
            learning_rate=learning_rate,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=42,
            n_jobs=-1
        )
        
        # XGBoost Classifier for Failure within 30 cycles
        self.classifier = xgb.XGBClassifier(
            n_estimators=n_estimators,
            max_depth=max_depth,
            learning_rate=learning_rate,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=42,
            n_jobs=-1,
            eval_metric="logloss"
        )
        self.is_fitted = False

    def fit(self, X_train: pd.DataFrame, y_rul: np.ndarray, y_fail_soon: np.ndarray):
        self.feature_names = list(X_train.columns)
        X_scaled = self.scaler.fit_transform(X_train)
        
        # Fit models
        self.regressor.fit(X_scaled, y_rul)
        self.classifier.fit(X_scaled, y_fail_soon)
        self.is_fitted = True

    def predict_rul(self, X: pd.DataFrame) -> np.ndarray:
        if not self.is_fitted:
            raise ValueError("Model has not been trained yet.")
        X_scaled = self.scaler.transform(X[self.feature_names])
        preds = self.regressor.predict(X_scaled)
        return np.clip(preds, a_min=0, a_max=None)

    def predict_failure_proba(self, X: pd.DataFrame) -> np.ndarray:
        if not self.is_fitted:
            raise ValueError("Model has not been trained yet.")
        X_scaled = self.scaler.transform(X[self.feature_names])
        proba = self.classifier.predict_proba(X_scaled)[:, 1]
        return proba

    def evaluate(self, X_test: pd.DataFrame, y_true_rul: np.ndarray) -> Dict[str, float]:
        preds_rul = self.predict_rul(X_test)
        
        # True binary indicator for failure within 30 cycles
        y_true_binary = (y_true_rul <= 30).astype(int)
        preds_proba = self.predict_failure_proba(X_test)
        preds_binary = (preds_proba >= 0.5).astype(int)

        rmse = float(np.sqrt(mean_squared_error(y_true_rul, preds_rul)))
        mae = float(mean_absolute_error(y_true_rul, preds_rul))
        r2 = float(r2_score(y_true_rul, preds_rul))
        nasa_score = compute_nasa_phm_score(y_true_rul, preds_rul)
        
        auc = float(roc_auc_score(y_true_binary, preds_proba)) if len(np.unique(y_true_binary)) > 1 else 1.0
        f1 = float(f1_score(y_true_binary, preds_binary, zero_division=0))
        prec = float(precision_score(y_true_binary, preds_binary, zero_division=0))
        rec = float(recall_score(y_true_binary, preds_binary, zero_division=0))

        return {
            "rmse": round(rmse, 2),
            "mae": round(mae, 2),
            "r2_score": round(r2, 4),
            "nasa_phm_score": round(nasa_score, 1),
            "roc_auc": round(auc, 4),
            "f1_score": round(f1, 4),
            "precision": round(prec, 4),
            "recall": round(rec, 4)
        }

    def get_feature_importances(self, top_n: int = 15) -> List[Dict[str, Any]]:
        importances = self.regressor.feature_importances_
        sorted_idx = np.argsort(importances)[::-1]
        
        results = []
        for i in sorted_idx[:top_n]:
            results.append({
                "feature": self.feature_names[i],
                "importance": float(round(importances[i] * 100, 2))
            })
        return results

    def save(self, output_dir: Path):
        output_dir.mkdir(parents=True, exist_ok=True)
        joblib.dump(self.regressor, output_dir / "regressor_xgb.joblib")
        joblib.dump(self.classifier, output_dir / "classifier_xgb.joblib")
        joblib.dump(self.scaler, output_dir / "scaler.joblib")
        joblib.dump(self.feature_names, output_dir / "feature_names.joblib")

    @classmethod
    def load(cls, output_dir: Path):
        instance = cls()
        instance.regressor = joblib.load(output_dir / "regressor_xgb.joblib")
        instance.classifier = joblib.load(output_dir / "classifier_xgb.joblib")
        instance.scaler = joblib.load(output_dir / "scaler.joblib")
        instance.feature_names = joblib.load(output_dir / "feature_names.joblib")
        instance.is_fitted = True
        return instance
