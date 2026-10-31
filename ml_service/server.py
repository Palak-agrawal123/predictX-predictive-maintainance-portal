"""
FastAPI Microservice for Predictive Maintenance ML Models & Dataset-Driven Live Simulation
Serves the multi-dataset models (XGBoost Regressor, Random Forest, Attention-CNN-BiLSTM)
with real-time sensor dataset replay, data cleaning pipeline, and streaming telemetry endpoints.
"""
import sys
import os
import json
import time
import shutil
import asyncio
from pathlib import Path
from typing import Dict, Any, Optional, List
from fastapi import FastAPI, HTTPException, Query, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, ConfigDict

CURRENT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(CURRENT_DIR))

from predictor import predictor
from simulator.simulation_manager import simulation_manager
from simulator.dataset_parser import ensure_manifest_exists, DatasetAnalyzer, DATASETS_DIR, MANIFEST_FILE
from simulator.schemas import (
    SimulationManagerConfig,
    MachineSimulationConfig,
    SimulationMode,
    SimulationStatusResponse
)

app = FastAPI(
    title="Predictive Maintenance ML & Live Simulation Microservice",
    description="FastAPI microservice serving trained XGBoost, Random Forest and Attention-CNN-BiLSTM models with dataset-driven sensor simulation",
    version="3.0.0"
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


class DirectIngestRequest(BaseModel):
    machine_id: Optional[str] = Field(default="MCH-EXT-01", alias="machineId")
    subset: Optional[str] = "FD001"
    cycle: Optional[int] = 1
    timestamp: Optional[str] = None
    sensors: Dict[str, Any] = Field(default_factory=dict)
    operational_settings: Optional[Dict[str, float]] = Field(default_factory=dict)
    simulation_scenario: Optional[str] = "custom"

    model_config = ConfigDict(populate_by_name=True)


class DatasetConfigureRequest(BaseModel):
    dataset_id: str
    machine_id: Optional[str] = "1"
    column_mapping: Optional[Dict[str, Any]] = None
    start_index: int = 0
    end_index: Optional[int] = None
    is_looping: bool = True


# -----------------------------------------------------------------------------
# Core Service Endpoints
# -----------------------------------------------------------------------------
@app.get("/")
def get_service_info():
    return {
        "status": "online",
        "service": "predictive-maintenance-ml-microservice",
        "version": "3.0.0",
        "activeModel": "XGBoost Regressor (models/xgb_regressor_FD001.joblib)",
        "alternativeModel": "Random Forest Regressor (models/rf_regressor_FD001.joblib)",
        "multiRegimeModel": "Attention-CNN-BiLSTM with RegimeNormalizer (FD002 and FD004)",
        "dataset": "NASA Turbofan C-MAPSS (FD001-FD004) & Industrial Telemetry",
        "featuresCount": len(predictor.feature_names),
        "benchmarkMetrics": predictor.metrics,
        "fleetSummary": predictor.summary_stats,
        "simulationStatus": simulation_manager.get_status().model_dump()
    }

@app.get("/health")
def healthcheck():
    return {
        "status": "healthy",
        "modelLoaded": predictor.is_loaded,
        "modelVersion": predictor.model_version,
        "featuresCount": len(predictor.feature_names),
        "simulatorRunning": simulation_manager.is_running,
        "simulationSource": simulation_manager.simulation_source,
        "activeDataset": simulation_manager.active_dataset_id
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


# -----------------------------------------------------------------------------
# Dataset Management & Schema Inspection Endpoints (Phases 2 & 3)
# -----------------------------------------------------------------------------
@app.get("/api/simulation/datasets")
def list_datasets():
    """
    Returns list of all available simulation datasets (pre-bundled C-MAPSS and user uploads).
    """
    manifest = ensure_manifest_exists()
    datasets = list(manifest.get("datasets", {}).values())
    return {
        "success": True,
        "count": len(datasets),
        "data": datasets
    }

@app.post("/api/simulation/datasets/upload")
async def upload_dataset(file: UploadFile = File(...)):
    """
    Upload a user-provided simulated sensor dataset (CSV).
    Saves file into persistent storage, parses schema, and registers in manifest.
    """
    if not file.filename.lower().endswith((".csv", ".txt")):
        raise HTTPException(status_code=400, detail="Only CSV or formatted tabular TXT datasets are currently supported.")

    DATASETS_DIR.mkdir(parents=True, exist_ok=True)
    clean_name = "".join(c for c in file.filename if c.isalnum() or c in (".", "_", "-")).strip()
    dataset_id = f"user_{int(time.time())}_{clean_name.split('.')[0]}"
    target_path = DATASETS_DIR / f"{dataset_id}.csv"

    try:
        with open(target_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save uploaded file: {str(e)}")

    # Inspect uploaded dataset schema
    try:
        inspection = DatasetAnalyzer.inspect_file(target_path)
    except Exception as e:
        if target_path.exists():
            target_path.unlink()
        raise HTTPException(status_code=400, detail=f"Failed to parse uploaded dataset CSV: {str(e)}")

    # Update manifest
    manifest = ensure_manifest_exists()
    entry = {
        "id": dataset_id,
        "name": file.filename.replace(".csv", "").replace("_", " ").title(),
        "filename": target_path.name,
        "original_filename": file.filename,
        "path": str(target_path),
        "subset": inspection.get("compatibility", {}).get("matched_subset", "CUSTOM"),
        "size_bytes": target_path.stat().st_size,
        "total_rows": inspection.get("total_rows", 0),
        "total_columns": inspection.get("total_columns", 0),
        "is_bundled": False,
        "created_at": time.time(),
        "description": f"User-uploaded sensor dataset ({inspection.get('total_rows')} records, {inspection.get('total_columns')} columns)."
    }
    manifest["datasets"][dataset_id] = entry

    try:
        with open(MANIFEST_FILE, "w", encoding="utf-8") as f:
            json.dump(manifest, f, indent=2)
    except Exception as e:
        print(f"[Manifest Write Error] {e}")

    return {
        "success": True,
        "message": "Dataset uploaded and analyzed successfully",
        "dataset": entry,
        "inspection": inspection
    }

@app.get("/api/simulation/datasets/{dataset_id}")
def inspect_dataset(dataset_id: str):
    """
    Returns full schema inspection, column types, machine IDs, missing counts,
    and model compatibility report for a dataset.
    """
    manifest = ensure_manifest_exists()
    datasets = manifest.get("datasets", {})
    if dataset_id not in datasets:
        raise HTTPException(status_code=404, detail=f"Dataset '{dataset_id}' not found.")

    ds_info = datasets[dataset_id]
    file_path = Path(ds_info["path"])

    try:
        inspection = DatasetAnalyzer.inspect_file(file_path)
        return {
            "success": True,
            "dataset": ds_info,
            "inspection": inspection
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to inspect dataset: {str(e)}")

@app.get("/api/simulation/datasets/{dataset_id}/preview")
def preview_dataset(dataset_id: str, limit: int = Query(15, ge=1, le=50)):
    """
    Returns the first N raw rows from the dataset file.
    """
    manifest = ensure_manifest_exists()
    datasets = manifest.get("datasets", {})
    if dataset_id not in datasets:
        raise HTTPException(status_code=404, detail=f"Dataset '{dataset_id}' not found.")

    file_path = Path(datasets[dataset_id]["path"])
    try:
        import pandas as pd
        df = pd.read_csv(file_path, nrows=limit)
        return {
            "success": True,
            "columns": list(df.columns),
            "records": df.replace({float("nan"): None}).to_dict(orient="records")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to preview dataset: {str(e)}")

@app.post("/api/simulation/datasets/{dataset_id}/configure")
def configure_dataset_replay(dataset_id: str, payload: DatasetConfigureRequest):
    """
    Loads and binds a specific dataset & machine ID to the replay engine.
    """
    try:
        replay_status = simulation_manager.load_dataset(
            dataset_id=dataset_id,
            machine_id=payload.machine_id,
            column_mapping=payload.column_mapping,
            start_index=payload.start_index,
            end_index=payload.end_index,
            is_looping=payload.is_looping
        )
        return {
            "success": True,
            "message": f"Dataset '{dataset_id}' configured for Machine {payload.machine_id}",
            "replay_status": replay_status
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to configure dataset replay: {str(e)}")


# -----------------------------------------------------------------------------
# Live Simulation & Pipeline Endpoints (Phases 4, 5, 6)
# -----------------------------------------------------------------------------
@app.post("/api/simulation/start")
def start_simulation(config: Optional[SimulationManagerConfig] = None):
    """
    Start or reconfigure the live dataset replay or multi-machine simulation.
    """
    cfg = config or SimulationManagerConfig()
    try:
        status = simulation_manager.configure_and_start(cfg)
        return {
            "success": True,
            "message": "Live sensor simulation started successfully",
            "data": status.model_dump()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start simulation: {str(e)}")

@app.post("/api/simulation/pause")
def pause_simulation():
    """
    Pause telemetry generation ticks.
    """
    status = simulation_manager.pause()
    return {
        "success": True,
        "message": "Simulation paused",
        "data": status.model_dump()
    }

@app.post("/api/simulation/resume")
def resume_simulation():
    """
    Resume paused telemetry generation.
    """
    status = simulation_manager.resume()
    return {
        "success": True,
        "message": "Simulation resumed",
        "data": status.model_dump()
    }

@app.post("/api/simulation/stop")
def stop_simulation():
    """
    Halt simulation and stop worker thread.
    """
    status = simulation_manager.stop()
    return {
        "success": True,
        "message": "Simulation stopped",
        "data": status.model_dump()
    }

@app.post("/api/simulation/reset")
def reset_simulation():
    """
    Reset simulation fleet, replay cursor, telemetry history, and data cleaning pipeline state.
    """
    status = simulation_manager.reset_fleet()
    return {
        "success": True,
        "message": "Simulation reset to initial demonstration state",
        "data": status.model_dump()
    }

@app.get("/api/simulation/status")
def get_simulation_status():
    """
    Retrieve live status of all simulated machines, active dataset replay, and pipeline metrics.
    """
    status = simulation_manager.get_status()
    return {
        "success": True,
        "data": status.model_dump()
    }

@app.get("/api/simulation/telemetry")
def get_simulation_telemetry(
    machine_id: Optional[str] = Query(None, description="Optional machine ID filter"),
    limit: int = Query(50, ge=1, le=100, description="Max history points")
):
    """
    Retrieve recent raw & cleaned telemetry history and comparison tables.
    """
    data = simulation_manager.get_telemetry_history(machine_id=machine_id, limit=limit)
    return {
        "success": True,
        "data": data
    }

@app.post("/api/telemetry/ingest")
def ingest_telemetry(payload: DirectIngestRequest):
    """
    Ingests raw sensor readings from external IoT sensors or test scripts,
    passing through the validation, outlier, noise reduction, and prediction pipeline.
    """
    try:
        result = simulation_manager.ingest_external_telemetry(payload.model_dump())
        return {
            "success": True,
            "message": "Telemetry ingested and processed through pipeline",
            "data": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Telemetry ingestion failed: {str(e)}")

class SwitchFleetRequest(BaseModel):
    fleet: str = "industrial"  # "industrial" or "turbofan"

@app.post("/api/simulation/switch-fleet")
def switch_fleet(payload: SwitchFleetRequest):
    """
    Switches active simulation fleet between Industrial Rotating Machines (7 sensors)
    and NASA C-MAPSS Turbofans (21 sensors).
    """
    target = payload.fleet.lower()
    if "turbo" in target or "cmapss" in target:
        simulation_manager.simulator.switch_to_turbofan_fleet()
        simulation_manager.simulation_source = "cmapss_synthetic"
        simulation_manager.active_machine_id = "Engine-001"
    else:
        simulation_manager.simulator.switch_to_industrial_fleet()
        simulation_manager.simulation_source = "iot_simulator"
        simulation_manager.active_machine_id = "MOTOR-001"

    simulation_manager._seed_initial_frames()
    return {
        "success": True,
        "message": f"Switched active simulation fleet to {target}",
        "fleet": simulation_manager.simulator.fleet_mode,
        "status": simulation_manager.get_status().model_dump()
    }

@app.get("/api/simulation/stream")
@app.get("/api/telemetry/stream")
async def simulation_stream(request: Request):
    """
    Real-time Server-Sent Events (SSE) feed streaming live telemetry ticks,
    cleaning results, pipeline KPIs, ground-truth RUL comparisons, and ML predictions.
    """
    q = simulation_manager.subscribe_sse()

    async def event_generator():
        try:
            # Initial connection greeting with current fleet status
            init_status = simulation_manager.get_status().model_dump()
            yield f"event: connected\ndata: {json.dumps({'status': 'connected', 'server_time': time.time(), 'simulation': init_status})}\n\n"

            while True:
                if await request.is_disconnected():
                    break

                try:
                    loop = asyncio.get_event_loop()
                    item = await loop.run_in_executor(None, lambda: q.get(timeout=0.8))
                    yield f"event: telemetry\ndata: {json.dumps(item)}\n\n"
                except Exception:
                    yield ": keep-alive\n\n"

        finally:
            simulation_manager.unsubscribe_sse(q)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


if __name__ == "__main__":
    import uvicorn
    print("[ML Service] Starting FastAPI microservice on http://127.0.0.1:8000...")
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=False, log_level="info")
