"""
FastAPI Microservice for Predictive Maintenance ML Models
Serves the newly trained multi-dataset models (XGBoost Regressor, Random Forest, Attention-CNN-BiLSTM)
from Updated_Models/ with multi-subset benchmark metrics and fleet diagnostics.
"""
import sys
from pathlib import Path
from typing import Dict, Any, Optional, List
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ConfigDict

CURRENT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(CURRENT_DIR))

from predictor import predictor

app = FastAPI(
    title="Predictive Maintenance ML Microservice",
    description="FastAPI microservice serving trained XGBoost, Random Forest & Attention-CNN-BiLSTM models",
    version="2.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PredictRequest(BaseModel):
    machine_id: Optional[str] = Field(default=None, alias="machineId")
    sensors: Dict[str, Any] = Field(default_factory=dict)
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)

    model_config = ConfigDict(populate_by_name=True)

@app.get("/")
def get_service_info():
    return {
        "status": "online",
        "service": "predictive-maintenance-ml-microservice",
        "version": "2.1.0",
        "activeModel": "XGBoost Regressor (models/xgb_regressor_FD001.joblib)",
        "alternativeModel": "Random Forest Regressor (models/rf_regressor_FD001.joblib)",
        "multiRegimeModel": "Attention-CNN-BiLSTM with RegimeNormalizer (FD002 and FD004)",
        "dataset": "NASA Turbofan C-MAPSS (FD001-FD004) & Industrial Telemetry",
        "featuresCount": len(predictor.feature_names),
        "benchmarkMetrics": predictor.metrics,
        "fleetSummary": predictor.summary_stats
    }

@app.get("/health")
def healthcheck():
    return {
        "status": "healthy",
        "modelLoaded": predictor.is_loaded,
        "modelVersion": predictor.model_version,
        "featuresCount": len(predictor.feature_names),
        "models": {
            "xgb_regressor_FD001": "models/xgb_regressor_FD001.joblib",
            "rf_regressor_FD001": "models/rf_regressor_FD001.joblib",
            "attention_cnn_bilstm_FD002": "models/best_attention_cnn_bilstm_FD002.pt",
            "regime_normalizer_FD002": "models/regime_normalizer_FD002.joblib",
            "xgb_regime_FD002": "models/xgb_regime_FD002.joblib",
            "attention_cnn_bilstm_FD004": "models/best_attention_cnn_bilstm_FD004.pt",
            "regime_normalizer_FD004": "models/regime_normalizer_FD004.joblib",
            "xgb_regime_FD004": "models/xgb_regime_FD004.joblib"
        }
    }

@app.get("/metrics")
def get_metrics():
    return {
        "success": True,
        "dataset": "NASA C-MAPSS Benchmark Suite",
        "active_subset": "FD001",
        "metrics": predictor.metrics,
        "all_subsets": getattr(predictor, "all_subsets_summary", {})
    }

@app.get("/subsets")
def get_subsets_summary():
    """
    Returns the complete 4-dataset benchmark summary (FD001, FD002, FD003, FD004)
    """
    return {
        "success": True,
        "data": getattr(predictor, "all_subsets_summary", {})
    }

@app.get("/fleet-predictions")
def get_fleet_predictions(
    risk_tier: Optional[str] = Query(None, description="Filter by risk tier: CRITICAL, HIGH, MEDIUM, LOW"),
    limit: int = Query(50, ge=1, le=100)
):
    all_units = list(predictor.fleet_predictions.values())
    if risk_tier:
        all_units = [u for u in all_units if u.get("risk_tier", "").upper() == risk_tier.upper()]

    return {
        "success": True,
        "count": len(all_units[:limit]),
        "total": len(all_units),
        "data": all_units[:limit]
    }

@app.post("/predict")
def predict(payload: PredictRequest):
    machine_id = payload.machine_id or "MCH-GENERIC"
    sensors = payload.sensors or {}
    metadata = payload.metadata or {}

    try:
        result = predictor.predict(machine_id, sensors, metadata)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction evaluation failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    print("[ML Service] Starting FastAPI microservice on http://127.0.0.1:8000...")
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=False, log_level="info")
