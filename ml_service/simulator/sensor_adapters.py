"""
Sensor Adapter Interface Layer
Provides standardized adapters between raw physical equipment telemetry (ESP32, Arduino, MQTT)
and validated, model-compatible feature representations.
Explicitly distinguishes between 'simulated_sensor' and 'physical_sensor' data sources.
"""
from abc import ABC, abstractmethod
from typing import Dict, Any, Tuple, List, Optional
import numpy as np
import time


class SensorAdapterBase(ABC):
    """
    Abstract base class for converting diverse industrial sensor payloads
    into standardized engine and machine telemetry schemas.
    """
    @abstractmethod
    def adapt(self, raw_payload: Dict[str, Any]) -> Tuple[str, Dict[str, float], Dict[str, float], List[str]]:
        """
        Accepts raw telemetry dictionary.
        Returns:
            (source_type, operational_settings, sensors_dict, quality_warnings)
        """
        pass


class SimulatedSensorAdapter(SensorAdapterBase):
    """
    Adapter for software-generated simulated IoT machine sensor telemetry.
    Tags source as 'simulated_sensor'.
    """
    def adapt(self, raw_payload: Dict[str, Any]) -> Tuple[str, Dict[str, float], Dict[str, float], List[str]]:
        source = "simulated_sensor"
        warnings: List[str] = []
        raw_sensors = raw_payload.get("sensors") or raw_payload.get("raw_sensors") or raw_payload
        settings = raw_payload.get("operational_settings") or {}

        standardized_sensors: Dict[str, float] = {}
        for key in ["temperature", "vibration", "rpm", "pressure", "current", "voltage", "torque"]:
            if key in raw_sensors and raw_sensors[key] is not None:
                try:
                    standardized_sensors[key] = float(raw_sensors[key])
                except (ValueError, TypeError):
                    warnings.append(f"Non-numeric simulated reading for {key}: {raw_sensors[key]}")
                    standardized_sensors[key] = np.nan
            else:
                standardized_sensors[key] = np.nan

        return source, settings, standardized_sensors, warnings


class ESP32SensorAdapter(SensorAdapterBase):
    """
    Adapter for physical ESP32 / Arduino / Raspberry Pi industrial IoT microcontrollers.
    Tags source as 'physical_sensor'.
    Parses JSON payloads typically broadcast over Wi-Fi HTTP POST from embedded edge nodes.
    Example ESP32 payload:
    {
        "device_id": "ESP32-NODE-04",
        "machine_id": "MOTOR-001",
        "temp_c": 48.2,
        "accel_rms": 1.45,
        "rpm": 1490,
        "pressure_bar": 4.15,
        "current_amps": 14.3,
        "line_voltage": 399.5,
        "torque_nm": 39.1,
        "analog_raw": [4095, 2048, 1024]
    }
    """
    def adapt(self, raw_payload: Dict[str, Any]) -> Tuple[str, Dict[str, float], Dict[str, float], List[str]]:
        source = "physical_sensor"
        warnings: List[str] = []
        warnings.append(f"PHYSICAL_HARDWARE_ACTIVE: Telemetry ingested from embedded node {raw_payload.get('device_id', 'ESP32')}")

        # Normalization of common microcontroller variable aliases
        temp_val = raw_payload.get("temperature") or raw_payload.get("temp_c") or raw_payload.get("temp")
        vib_val = raw_payload.get("vibration") or raw_payload.get("accel_rms") or raw_payload.get("vib_mms") or raw_payload.get("vibration_mms")
        rpm_val = raw_payload.get("rpm") or raw_payload.get("rotational_speed") or raw_payload.get("speed_rpm")
        press_val = raw_payload.get("pressure") or raw_payload.get("pressure_bar") or raw_payload.get("bar")
        curr_val = raw_payload.get("current") or raw_payload.get("current_amps") or raw_payload.get("amps")
        volt_val = raw_payload.get("voltage") or raw_payload.get("line_voltage") or raw_payload.get("volts")
        torque_val = raw_payload.get("torque") or raw_payload.get("torque_nm")

        def _parse_num(val, name, default=np.nan):
            if val is None:
                warnings.append(f"Physical sensor missing channel: {name}")
                return default
            try:
                return float(val)
            except (ValueError, TypeError):
                warnings.append(f"Invalid reading on physical channel {name}: {val}")
                return default

        standardized_sensors = {
            "temperature": _parse_num(temp_val, "temperature"),
            "vibration": _parse_num(vib_val, "vibration"),
            "rpm": _parse_num(rpm_val, "rpm"),
            "pressure": _parse_num(press_val, "pressure"),
            "current": _parse_num(curr_val, "current"),
            "voltage": _parse_num(volt_val, "voltage", default=400.0),
            "torque": _parse_num(torque_val, "torque")
        }

        settings = {
            "node_type": "ESP32_WIFI_EDGE",
            "rssi_dbm": float(raw_payload.get("rssi", -65.0)),
            "firmware_version": str(raw_payload.get("firmware", "v1.2.0-esp32"))
        }

        return source, settings, standardized_sensors, warnings


class MQTTSensorAdapter(SensorAdapterBase):
    """
    Adapter for industrial MQTT brokers (Sparkplug B / Mosquitto / AWS IoT Core).
    Tags source as 'physical_sensor'.
    """
    def adapt(self, raw_payload: Dict[str, Any]) -> Tuple[str, Dict[str, float], Dict[str, float], List[str]]:
        source = "physical_sensor"
        warnings: List[str] = []
        topic = raw_payload.get("topic", "predictx/iot/telemetry")
        warnings.append(f"MQTT_BROKER_ACTIVE: Ingested packet from topic '{topic}'")

        metrics = raw_payload.get("metrics") or raw_payload.get("d") or raw_payload

        standardized_sensors: Dict[str, float] = {}
        for key in ["temperature", "vibration", "rpm", "pressure", "current", "voltage", "torque"]:
            val = metrics.get(key)
            if val is not None:
                try:
                    standardized_sensors[key] = float(val)
                except (ValueError, TypeError):
                    standardized_sensors[key] = np.nan
            else:
                standardized_sensors[key] = np.nan

        settings = {
            "protocol": "MQTT_TCP",
            "qos": int(raw_payload.get("qos", 1)),
            "retain": bool(raw_payload.get("retain", False))
        }

        return source, settings, standardized_sensors, warnings


class CMAPSSSensorAdapter(SensorAdapterBase):
    """
    Direct C-MAPSS telemetry adapter.
    Preserves exact s_1 through s_21 nomenclature and operational settings.
    """
    def adapt(self, raw_payload: Dict[str, Any]) -> Tuple[str, Dict[str, float], Dict[str, float], List[str]]:
        source = "simulated_sensor"
        warnings: List[str] = []
        settings: Dict[str, float] = {}
        sensors: Dict[str, float] = {}

        # Extract operational settings
        for k in ["setting_1", "setting_2", "setting_3"]:
            val = raw_payload.get(k)
            if val is not None:
                try:
                    settings[k] = float(val)
                except (ValueError, TypeError):
                    warnings.append(f"Invalid non-numeric setting {k}: {val}")
                    settings[k] = 0.0
            else:
                settings[k] = 0.0 if k != "setting_3" else 100.0

        # Extract s_1 through s_21
        for i in range(1, 22):
            key = f"s_{i}"
            val = raw_payload.get(key)
            if val is not None:
                try:
                    sensors[key] = float(val)
                except (ValueError, TypeError):
                    warnings.append(f"Invalid non-numeric sensor reading {key}: {val}")
                    sensors[key] = np.nan
            else:
                nested = raw_payload.get("sensors", {})
                nested_val = nested.get(key) if isinstance(nested, dict) else None
                if nested_val is not None:
                    try:
                        sensors[key] = float(nested_val)
                    except (ValueError, TypeError):
                        warnings.append(f"Invalid nested non-numeric reading {key}: {nested_val}")
                        sensors[key] = np.nan
                else:
                    sensors[key] = np.nan

        return source, settings, sensors, warnings


class IndustrialWorkshopAdapter(SensorAdapterBase):
    """
    Adapts generic workshop telemetry into C-MAPSS feature proxies
    using physically grounded thermodynamic transfer functions.
    """
    def adapt(self, raw_payload: Dict[str, Any]) -> Tuple[str, Dict[str, float], Dict[str, float], List[str]]:
        source = raw_payload.get("source", "simulated_sensor")
        warnings: List[str] = ["PHYSICAL_ADAPTER_ACTIVE: Workshop industrial telemetry mapped via thermodynamic proxy"]

        air_temp = float(raw_payload.get("airTemperature") or raw_payload.get("airTempKelvin") or 300.0)
        proc_temp = float(raw_payload.get("processTemperature") or raw_payload.get("processTempKelvin") or 310.0)
        speed_rpm = float(raw_payload.get("rotationalSpeed") or raw_payload.get("rotationalSpeedRpm") or 1500.0)
        torque_nm = float(raw_payload.get("torque") or raw_payload.get("torqueNm") or 40.0)
        tool_wear = float(raw_payload.get("toolWear") or raw_payload.get("toolWearMinutes") or 0.0)
        vibration = float(raw_payload.get("vibration") or raw_payload.get("vibrationMmS") or 2.0)

        settings = {
            "setting_1": 0.0,
            "setting_2": 0.0,
            "setting_3": 100.0
        }

        wear_ratio = min(1.0, max(0.0, tool_wear / 220.0))
        temp_delta = max(0.0, proc_temp - air_temp)
        thermal_stress = min(2.0, temp_delta / 10.0)
        vib_ratio = min(2.0, max(0.0, vibration / 4.5))

        sensors = {
            "s_1": 518.67,
            "s_2": 642.68 + (wear_ratio * 1.8) + (thermal_stress * 0.5),
            "s_3": 1588.50 + (wear_ratio * 15.0) + (thermal_stress * 4.0),
            "s_4": 1406.80 + (wear_ratio * 22.0) + (thermal_stress * 8.0) + (vib_ratio * 3.0),
            "s_5": 14.62,
            "s_6": 21.61,
            "s_7": 554.20 - (wear_ratio * 2.5),
            "s_8": 2388.08 - (wear_ratio * 0.25),
            "s_9": 9055.00 + (wear_ratio * 30.0) + ((speed_rpm - 1500) * 0.02),
            "s_10": 1.30,
            "s_11": 47.35 + (wear_ratio * 0.75),
            "s_12": 522.10 - (wear_ratio * 2.2),
            "s_13": 2388.08 - (wear_ratio * 0.2),
            "s_14": 8138.50 + (wear_ratio * 18.0),
            "s_15": 8.42 + (wear_ratio * 0.12),
            "s_16": 0.03,
            "s_17": 392.20 + (wear_ratio * 4.2),
            "s_18": 2388.0,
            "s_19": 100.0,
            "s_20": 38.92 - (wear_ratio * 0.38),
            "s_21": 23.35 - (wear_ratio * 0.22)
        }

        return source, settings, sensors, warnings
