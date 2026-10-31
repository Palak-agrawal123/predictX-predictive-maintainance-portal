"""
Industrial Machine Profiles and Sensor Specifications
Defines baseline nominal parameters, operating states, and sensor characteristics
for physical industrial rotating machinery (Motors, Pumps, Compressors) and Turbofans.
"""
from typing import Dict, Any

# -----------------------------------------------------------------------------
# Industrial Rotating Machine 7-Sensor Specifications
# -----------------------------------------------------------------------------
INDUSTRIAL_SENSOR_SPECS: Dict[str, Dict[str, Any]] = {
    "temperature": {
        "name": "Machine Temperature",
        "unit": "°C",
        "description": "Stator & bearing housing temperature",
        "min_valid": 10.0,
        "max_valid": 130.0,
        "warning_threshold": 75.0,
        "critical_threshold": 85.0
    },
    "vibration": {
        "name": "Vibration Velocity",
        "unit": "mm/s",
        "description": "RMS vibration amplitude (ISO 10816-3 standard)",
        "min_valid": 0.05,
        "max_valid": 25.0,
        "warning_threshold": 4.5,
        "critical_threshold": 7.1
    },
    "rpm": {
        "name": "Rotational Speed",
        "unit": "RPM",
        "description": "Shaft rotational frequency",
        "min_valid": 100.0,
        "max_valid": 4500.0,
        "warning_deviation_pct": 10.0,
        "critical_deviation_pct": 20.0
    },
    "pressure": {
        "name": "Operating Pressure",
        "unit": "bar",
        "description": "Hydraulic or discharge fluid delivery pressure",
        "min_valid": 0.5,
        "max_valid": 20.0,
        "warning_threshold": 8.0,
        "critical_threshold": 10.0
    },
    "current": {
        "name": "Motor Current",
        "unit": "A",
        "description": "Total RMS 3-phase line current draw",
        "min_valid": 1.0,
        "max_valid": 80.0,
        "warning_threshold": 24.0,
        "critical_threshold": 32.0
    },
    "voltage": {
        "name": "Supply Voltage",
        "unit": "V",
        "description": "Line-to-line AC supply voltage",
        "min_valid": 320.0,
        "max_valid": 460.0,
        "nominal": 400.0
    },
    "torque": {
        "name": "Drive Torque",
        "unit": "Nm",
        "description": "Mechanical shaft load torque",
        "min_valid": 5.0,
        "max_valid": 150.0,
        "warning_threshold": 65.0,
        "critical_threshold": 80.0
    }
}

# -----------------------------------------------------------------------------
# Industrial Rotating Machinery Fleet Profiles
# -----------------------------------------------------------------------------
INDUSTRIAL_MACHINE_PROFILES: Dict[str, Dict[str, Any]] = {
    "MOTOR-001": {
        "machine_id": "MOTOR-001",
        "name": "Centrifugal Water Pump Motor",
        "type": "PUMP_MOTOR",
        "category": "Industrial Rotating Equipment",
        "subsystem": "Cooling Loop Primary Feed",
        "scenario": "healthy",
        "initial_cycle": 45,
        "initial_wear": 0.06,
        "wear_rate": 0.0008,
        "nominal": {
            "rpm": 1485.0,
            "rpm_std": 6.0,
            "temperature": 46.5,
            "temperature_std": 0.8,
            "vibration": 1.4,
            "vibration_std": 0.12,
            "pressure": 4.2,
            "pressure_std": 0.08,
            "current": 14.2,
            "current_std": 0.35,
            "voltage": 400.0,
            "voltage_std": 1.2,
            "torque": 38.5,
            "torque_std": 0.8
        },
        "description": "Nominal baseline operation with balanced load and minimal bearing friction."
    },
    "MOTOR-002": {
        "machine_id": "MOTOR-002",
        "name": "CNC Extruder Spindle Motor",
        "type": "SPINDLE_MOTOR",
        "category": "Industrial Rotating Equipment",
        "subsystem": "Extrusion Line 4 Drive",
        "scenario": "gradual_degradation",
        "initial_cycle": 110,
        "initial_wear": 0.46,
        "wear_rate": 0.0055,
        "nominal": {
            "rpm": 1750.0,
            "rpm_std": 14.0,
            "temperature": 63.5,
            "temperature_std": 1.8,
            "vibration": 3.8,
            "vibration_std": 0.30,
            "pressure": 5.2,
            "pressure_std": 0.15,
            "current": 19.8,
            "current_std": 0.70,
            "voltage": 398.0,
            "voltage_std": 2.0,
            "torque": 48.0,
            "torque_std": 1.5
        },
        "description": "Gradual bearing degradation with developing race pit, elevated 1x harmonics, and thermal rise."
    },
    "MOTOR-003": {
        "machine_id": "MOTOR-003",
        "name": "Gas Booster Compressor Motor",
        "type": "COMPRESSOR_MOTOR",
        "category": "Industrial Rotating Equipment",
        "subsystem": "Gas Turbine Fuel Booster",
        "scenario": "critical_degradation",
        "initial_cycle": 185,
        "initial_wear": 0.86,
        "wear_rate": 0.0125,
        "nominal": {
            "rpm": 2940.0,
            "rpm_std": 28.0,
            "temperature": 88.5,
            "temperature_std": 3.2,
            "vibration": 7.4,
            "vibration_std": 0.55,
            "pressure": 8.2,
            "pressure_std": 0.35,
            "current": 29.5,
            "current_std": 1.4,
            "voltage": 391.0,
            "voltage_std": 3.5,
            "torque": 75.0,
            "torque_std": 2.8
        },
        "description": "Severe cage degradation, impending thermal runaway, severe vibration in ISO Zone D (Danger)."
    }
}
