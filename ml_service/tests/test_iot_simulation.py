"""
Unit and Integration Tests for Live IoT Sensor Simulator & Real-Time Maintenance Pipeline
Verifies:
1. 10-second default tick interval and multi-machine step
2. Coupled thermo-mechanical & electrical physics (Torque, Current, RPM, Temp, Vibration)
3. Sensor adapters (Simulated, ESP32, MQTT)
4. 5-stage cleaning pipeline on 7 industrial sensors (Validation, Outliers, Imputation, Filter)
5. Predictor's Industrial Rotating Machinery Fault Classifier (Health Score, ISO Zone, Anomaly Score)
"""
import sys
import time
import math
import pytest
from pathlib import Path

CURRENT_DIR = Path(__file__).resolve().parent
ML_SERVICE_DIR = CURRENT_DIR.parent
sys.path.insert(0, str(ML_SERVICE_DIR))

from simulator.machine_profiles import INDUSTRIAL_MACHINE_PROFILES, INDUSTRIAL_SENSOR_SPECS
from simulator.degradation_engine import IndustrialDegradationEngine
from simulator.sensor_adapters import (
    SimulatedSensorAdapter,
    ESP32SensorAdapter,
    MQTTSensorAdapter
)
from simulator.sensor_simulator import SensorSimulator
from simulator.simulation_manager import SimulationManager
from simulator.schemas import SimulationMode, SensorReadingStatus, SimulationManagerConfig
from preprocessing.pipeline import DataCleaningPipeline
from predictor import predictor


def test_machine_profiles_exist():
    assert "MOTOR-001" in INDUSTRIAL_MACHINE_PROFILES
    assert "MOTOR-002" in INDUSTRIAL_MACHINE_PROFILES
    assert "MOTOR-003" in INDUSTRIAL_MACHINE_PROFILES

    m1 = INDUSTRIAL_MACHINE_PROFILES["MOTOR-001"]
    assert m1["nominal"]["vibration"] < 2.0
    assert m1["nominal"]["temperature"] < 55.0

    m3 = INDUSTRIAL_MACHINE_PROFILES["MOTOR-003"]
    assert m3["nominal"]["vibration"] > 6.0
    assert m3["nominal"]["temperature"] > 80.0


def test_industrial_degradation_physics():
    engine = IndustrialDegradationEngine(seed=42)
    m1 = INDUSTRIAL_MACHINE_PROFILES["MOTOR-001"]

    # Healthy step
    res_healthy = engine.generate_step(
        profile=m1,
        cycle=10,
        wear_index=0.05,
        scenario="healthy",
        inject_anomalies=False
    )
    s_h = res_healthy["clean_baseline"]
    assert 40.0 <= s_h["temperature"] <= 55.0
    assert 1.0 <= s_h["vibration"] <= 2.2
    assert 9.5 <= s_h["current"] <= 18.0

    # Critical degradation step (high wear)
    res_crit = engine.generate_step(
        profile=m1,
        cycle=200,
        wear_index=0.90,
        scenario="critical_degradation",
        inject_anomalies=False
    )
    s_c = res_crit["clean_baseline"]
    # Vibration and temperature should elevate with wear
    assert s_c["vibration"] > s_h["vibration"]
    assert s_c["temperature"] > s_h["temperature"]
    assert s_c["current"] > s_h["current"]


def test_sensor_adapters():
    # 1. ESP32 Sensor Adapter
    esp32_payload = {
        "device_id": "ESP32-NODE-01",
        "machine_id": "MOTOR-001",
        "temp_c": 49.5,
        "accel_rms": 1.62,
        "speed_rpm": 1488,
        "pressure_bar": 4.18,
        "current_amps": 14.6,
        "line_voltage": 399.0,
        "torque_nm": 39.0
    }
    esp32_adapter = ESP32SensorAdapter()
    source, settings, sensors, warnings = esp32_adapter.adapt(esp32_payload)
    assert source == "physical_sensor"
    assert sensors["temperature"] == 49.5
    assert sensors["vibration"] == 1.62
    assert sensors["rpm"] == 1488.0

    # 2. MQTT Sensor Adapter
    mqtt_payload = {
        "topic": "factory/floor1/pump01",
        "metrics": {
            "temperature": 51.0,
            "vibration": 1.75,
            "rpm": 1492.0,
            "pressure": 4.22,
            "current": 14.8,
            "voltage": 401.0,
            "torque": 39.5
        }
    }
    mqtt_adapter = MQTTSensorAdapter()
    m_source, m_settings, m_sensors, m_warnings = mqtt_adapter.adapt(mqtt_payload)
    assert m_source == "physical_sensor"
    assert m_sensors["temperature"] == 51.0

    # 3. Simulated Sensor Adapter
    sim_adapter = SimulatedSensorAdapter()
    s_src, s_set, s_sens, s_warn = sim_adapter.adapt({
        "sensors": {"temperature": 48.0, "vibration": 1.4, "rpm": 1480, "pressure": 4.1, "current": 14.2, "voltage": 400.0, "torque": 38.0}
    })
    assert s_src == "simulated_sensor"
    assert s_sens["temperature"] == 48.0


def test_cleaning_pipeline_on_industrial_sensors():
    pipeline = DataCleaningPipeline(models_dir=predictor.models_dir)
    simulator = SensorSimulator(random_seed=123)

    packets = simulator.step_all()
    assert len(packets) == 3

    for pkt in packets:
        clean_frame = pipeline.process(pkt)
        assert clean_frame.machine_id == pkt.machine_id
        assert not clean_frame.quarantined
        assert len(clean_frame.comparison_table) == 7

        # Check all 7 physical industrial fields are cleaned
        for field in ["temperature", "vibration", "rpm", "pressure", "current", "voltage", "torque"]:
            assert field in clean_frame.cleaned_sensors
            assert clean_frame.cleaned_sensors[field] is not None


def test_industrial_motor_prediction():
    # 1. Healthy motor
    healthy_sensors = {
        "temperature": 47.0,
        "vibration": 1.35,
        "rpm": 1485.0,
        "pressure": 4.2,
        "current": 14.3,
        "voltage": 400.0,
        "torque": 38.5
    }
    pred_h = predictor.predict_industrial_motor("MOTOR-001", healthy_sensors)
    assert pred_h["success"] is True
    assert pred_h["prediction"]["riskLevel"] == "low"
    assert pred_h["prediction"]["healthScore"] >= 85
    assert pred_h["prediction"]["anomalyScore"] <= 20
    assert pred_h["prediction"]["faultCategory"] == "NORMAL_HEALTHY_OPERATION"

    # 2. Critical motor (severe vibration and high temperature)
    critical_sensors = {
        "temperature": 89.0,
        "vibration": 7.6,
        "rpm": 2940.0,
        "pressure": 8.1,
        "current": 30.5,
        "voltage": 390.0,
        "torque": 76.0
    }
    pred_c = predictor.predict_industrial_motor("MOTOR-003", critical_sensors)
    assert pred_c["success"] is True
    assert pred_c["prediction"]["riskLevel"] == "critical"
    assert pred_c["prediction"]["healthScore"] <= 35
    assert pred_c["prediction"]["anomalyScore"] >= 65
    assert "CRITICAL" in pred_c["prediction"]["faultCategory"]


def test_simulation_manager_10s_default_and_lifecycle():
    manager = SimulationManager()
    assert manager.tick_interval_seconds == 10.0
    assert manager.simulation_source == "iot_simulator"

    # Ingest external telemetry
    res = manager.ingest_external_telemetry({
        "machine_id": "MOTOR-001",
        "device_id": "ESP32-DEV-99",
        "temperature": 48.5,
        "vibration": 1.45,
        "rpm": 1490.0,
        "pressure": 4.15,
        "current": 14.4,
        "voltage": 400.0,
        "torque": 38.8
    })
    assert res["machine_id"] == "MOTOR-001"
    assert res["prediction"]["healthScore"] >= 85
    assert res["source"] == "physical_sensor"
