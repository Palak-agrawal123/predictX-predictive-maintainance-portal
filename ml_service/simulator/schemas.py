"""
Pydantic Schemas for Live IoT Sensor Simulator & Telemetry Ingestion Pipeline
"""
from typing import Dict, Any, Optional, List
from enum import Enum
from pydantic import BaseModel, Field, ConfigDict


class SimulationMode(str, Enum):
    HEALTHY = "healthy"               # Normal operating baseline, low vibration, nominal temps
    GRADUAL = "gradual_degradation"   # Progressive wear, developing bearing race defect, temperature rise
    CRITICAL = "critical_degradation" # Severe degradation, high vibration (Zone D), thermal runaway, imminent trip
    CUSTOM = "custom"                 # User-configured or external IoT feed


class SensorReadingStatus(str, Enum):
    VALID = "VALID"
    NOISY = "NOISY"
    OUTLIER_DETECTED = "OUTLIER_DETECTED"
    MISSING_VALUE = "MISSING_VALUE"
    INVALID = "INVALID"


class TelemetryPacket(BaseModel):
    machine_id: str = Field(..., description="Unique Machine / Engine ID (e.g. MOTOR-001, Engine-001)")
    machine_name: Optional[str] = Field(None, description="Human readable equipment name")
    machine_type: Optional[str] = Field("PUMP_MOTOR", description="Asset type: PUMP_MOTOR, SPINDLE_MOTOR, COMPRESSOR_MOTOR, TURBINE")
    source: str = Field("simulated_sensor", description="'simulated_sensor' or 'physical_sensor'")
    subset: Optional[str] = Field("INDUSTRIAL_IOT", description="Target dataset/equipment subset")
    cycle: int = Field(1, ge=1, description="Operational cycle or uptime increment")
    timestamp: str = Field(..., description="ISO 8601 formatted timestamp")
    sequence_number: int = Field(0, ge=0, description="Monotonically increasing sequence counter")
    simulation_session_id: Optional[str] = Field(None, description="Unique identifier for the active simulation session")
    simulation_scenario: SimulationMode = Field(SimulationMode.HEALTHY, description="Operating scenario")
    operational_settings: Dict[str, Any] = Field(default_factory=dict, description="Operating parameters")
    sensors: Dict[str, Optional[float]] = Field(default_factory=dict, description="Active sensor measurements")
    raw_sensors: Optional[Dict[str, Optional[float]]] = Field(default_factory=dict, description="Original uncleaned readings")
    data_quality_flags: List[str] = Field(default_factory=list, description="Quality indicators")
    status: SensorReadingStatus = Field(SensorReadingStatus.VALID, description="Validation status")

    model_config = ConfigDict(populate_by_name=True)


class MachineSimulationConfig(BaseModel):
    machine_id: str
    name: Optional[str] = None
    type: Optional[str] = "PUMP_MOTOR"
    scenario: SimulationMode = SimulationMode.HEALTHY
    subset: str = "INDUSTRIAL_IOT"
    initial_cycle: int = 1
    max_cycles: int = 500
    initial_wear: float = Field(0.05, ge=0.0, le=1.0, description="Wear fraction between 0.0 (fresh) and 1.0 (failure)")
    wear_rate: float = Field(0.005, ge=0.0001, le=0.1, description="Wear increment per cycle")
    inject_anomalies: bool = Field(True, description="Whether to inject spikes, dropouts, and noise")
    anomaly_probability: float = Field(0.06, ge=0.0, le=0.5, description="Probability of injecting a noisy reading or outlier")


class SimulationManagerConfig(BaseModel):
    simulation_source: str = Field("iot_simulator", description="'iot_simulator' (default 10s rotating machines), 'cmapss_synthetic', 'dataset'")
    tick_interval_seconds: float = Field(10.0, ge=0.2, le=60.0, description="Time between simulation steps (default 10s)")
    speed_multiplier: float = Field(1.0, ge=0.1, le=20.0, description="Speed acceleration factor")
    random_seed: Optional[int] = Field(None, description="Deterministic seed for repeatable demos")
    auto_predict: bool = Field(True, description="Automatically pass cleaned data into ML inference engine")
    dataset_id: Optional[str] = Field(None, description="Optional dataset ID if replaying from file")
    selected_machine_id: Optional[str] = Field("MOTOR-001", description="Default selected machine")
    machines: List[MachineSimulationConfig] = Field(default_factory=list)


class PipelineMetrics(BaseModel):
    total_raw_readings: int = 0
    valid_readings: int = 0
    rejected_readings: int = 0
    noise_filtered_readings: int = 0
    outliers_detected: int = 0
    missing_values_handled: int = 0
    transformed_vectors: int = 0
    total_sensor_spikes_corrected: int = 0
    total_sensor_gaps_imputed: int = 0
    cleaning_success_rate: float = 100.0
    average_latency_ms: float = 0.0


class SimulationStatusResponse(BaseModel):
    is_running: bool
    is_paused: bool
    simulation_source: str = "iot_simulator"
    active_machines: List[str]
    tick_interval_seconds: float = 10.0
    speed_multiplier: float = 1.0
    total_cycles_simulated: int = 0
    pipeline_metrics: PipelineMetrics
    machines_summary: Dict[str, Any] = Field(default_factory=dict)
