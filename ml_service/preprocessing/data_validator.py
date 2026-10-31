"""
Stage 1: Raw Data Validation Layer
Validates data types, required fields, sensor physical ranges, duplicate timestamps,
and missing keys for both Industrial IoT Machinery (7 sensors) and Turbofans (21 sensors).
"""
from typing import Dict, Any, List, Tuple
import math
import numpy as np

try:
    from simulator.sensor_profiles import CMAPSS_SENSOR_SPECS
    from simulator.machine_profiles import INDUSTRIAL_SENSOR_SPECS
except ImportError:
    from ml_service.simulator.sensor_profiles import CMAPSS_SENSOR_SPECS
    from ml_service.simulator.machine_profiles import INDUSTRIAL_SENSOR_SPECS


class ValidationResult:
    def __init__(self, is_valid: bool, errors: List[str], cleaned_data: Dict[str, float], raw_data: Dict[str, Any]):
        self.is_valid = is_valid
        self.errors = errors
        self.cleaned_data = cleaned_data
        self.raw_data = raw_data


class DataValidator:
    """
    Validates incoming raw telemetry against physical and schema constraints.
    """
    def __init__(self):
        self.seen_sequences: Dict[str, int] = {}

    def validate_packet(self, packet_dict: Dict[str, Any]) -> ValidationResult:
        errors: List[str] = []
        cleaned_sensors: Dict[str, float] = {}

        machine_id = str(packet_dict.get("machine_id") or "UNKNOWN").strip().upper()
        seq_num = packet_dict.get("sequence_number")

        # 1. Sequence tracking & duplicate detection
        if seq_num is not None:
            last_seq = self.seen_sequences.get(machine_id)
            if last_seq is not None and seq_num <= last_seq:
                errors.append(f"Duplicate or out-of-order sequence: received {seq_num}, latest was {last_seq}")
            else:
                self.seen_sequences[machine_id] = seq_num

        # 2. Extract sensor dictionary (either top-level or under 'sensors')
        raw_sensors = packet_dict.get("sensors")
        if not isinstance(raw_sensors, dict):
            raw_sensors = packet_dict.get("sensor_readings")
        if not isinstance(raw_sensors, dict):
            raw_sensors = {k: v for k, v in packet_dict.items() if k in INDUSTRIAL_SENSOR_SPECS or k.startswith("s_")}

        # 3. Detect sensor schema: Industrial IoT (7 sensors) vs C-MAPSS (s_1..s_21)
        is_industrial = any(k in raw_sensors for k in ["temperature", "vibration", "rpm", "pressure", "current", "voltage", "torque"])
        target_specs = INDUSTRIAL_SENSOR_SPECS if is_industrial else CMAPSS_SENSOR_SPECS

        for s_key, spec in target_specs.items():
            if s_key not in raw_sensors:
                errors.append(f"Missing required sensor measurement: {s_key}")
                cleaned_sensors[s_key] = np.nan
                continue

            val = raw_sensors.get(s_key)

            # Null / None check
            if val is None:
                errors.append(f"Null value in sensor {s_key}")
                cleaned_sensors[s_key] = np.nan
                continue

            # Data type check
            try:
                num_val = float(val)
            except (ValueError, TypeError):
                errors.append(f"Invalid non-numeric type for sensor {s_key}: '{val}'")
                cleaned_sensors[s_key] = np.nan
                continue

            # NaN or Infinity check
            if math.isnan(num_val) or math.isinf(num_val):
                errors.append(f"Sensor {s_key} contains NaN/Infinity")
                cleaned_sensors[s_key] = np.nan
                continue

            # Physical range validation
            min_lim = spec.get("min_valid", -1e6)
            max_lim = spec.get("max_valid", 1e6)
            if num_val < min_lim or num_val > max_lim:
                errors.append(f"Range violation on {s_key} ({spec['name']}): {num_val:.2f} out of [{min_lim}, {max_lim}]")
                # Clamp to physical boundary for downstream cleaning
                num_val = float(np.clip(num_val, min_lim, max_lim))

            cleaned_sensors[s_key] = num_val

        # Packet is structurally valid if no non-numeric types or structural corruptions
        fatal_errors = [e for e in errors if "Invalid non-numeric" in e]
        is_valid = len(fatal_errors) == 0

        return ValidationResult(
            is_valid=is_valid,
            errors=errors,
            cleaned_data=cleaned_sensors,
            raw_data=raw_sensors
        )
