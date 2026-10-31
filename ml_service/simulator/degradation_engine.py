"""
Industrial Machine Physics and Degradation Engine
Implements coupled thermo-mechanical and electro-dynamic equations for rotating machines:
- Torque-RPM-Current coupling: I = (tau * omega) / (sqrt(3) * V * pf * eta)
- Bearing degradation and ISO 10816-3 vibration severity
- Thermal buildup from stator I^2*R losses and bearing friction
- Dynamic fluid pressure delivery
- Deterministic and stochastic sensor artifact injection (spikes, missing values, noise)
"""
import math
from typing import Dict, Any, Tuple, List, Optional
import numpy as np
from datetime import datetime, timezone

from .schemas import SimulationMode, SensorReadingStatus


class IndustrialDegradationEngine:
    def __init__(self, seed: Optional[int] = None):
        self.rng = np.random.RandomState(seed)
        self.seed = seed

    def set_seed(self, seed: Optional[int]):
        self.seed = seed
        self.rng = np.random.RandomState(seed)

    def generate_step(
        self,
        profile: Dict[str, Any],
        cycle: int,
        wear_index: float,
        scenario: str,
        sequence_number: int = 0,
        inject_anomalies: bool = False,
        anomaly_prob: float = 0.06
    ) -> Dict[str, Any]:
        """
        Generates a realistic, physically correlated 7-sensor reading packet for an industrial rotating machine.
        """
        nominal = profile["nominal"]
        wear = float(np.clip(wear_index, 0.0, 1.0))

        # -------------------------------------------------------------
        # 1. Physics: Rotational Speed & Mechanical Torque
        # -------------------------------------------------------------
        # Friction increases with bearing wear, introducing mechanical drag
        drag_torque = (nominal["torque"] * 0.22) * (wear ** 1.5)
        rpm_droop = (nominal["rpm"] * 0.035) * (wear ** 1.3)

        base_rpm = nominal["rpm"] - rpm_droop + self.rng.normal(0, nominal.get("rpm_std", 8.0))
        rpm = max(100.0, round(float(base_rpm), 1))

        base_torque = nominal["torque"] + drag_torque + self.rng.normal(0, nominal.get("torque_std", 1.0))
        torque = max(5.0, round(float(base_torque), 2))

        # Angular velocity omega in rad/s
        omega = (2.0 * math.pi * rpm) / 60.0

        # Mechanical shaft power in Watts: P_mech = tau * omega
        p_mech = torque * omega

        # -------------------------------------------------------------
        # 2. Electro-dynamics: Efficiency, Voltage & Line Current
        # -------------------------------------------------------------
        # Degraded bearings and winding thermal stress reduce efficiency eta
        efficiency = max(0.72, 0.93 - (0.16 * (wear ** 1.2)))
        power_factor = max(0.78, 0.88 - (0.07 * (wear ** 1.1)))

        # Supply voltage with slight feeder drop under heavy current
        v_nominal = nominal.get("voltage", 400.0)
        v_drop = (torque / 50.0) * 1.8
        voltage = round(float(v_nominal - v_drop + self.rng.normal(0, nominal.get("voltage_std", 1.5))), 1)

        # 3-Phase AC motor current: I = P_mech / (sqrt(3) * V * cos(phi) * eta)
        p_elec = p_mech / efficiency
        i_calc = p_elec / (math.sqrt(3) * voltage * power_factor)
        # Add slight electrical harmonic noise
        current = max(1.0, round(float(i_calc + self.rng.normal(0, nominal.get("current_std", 0.4))), 2))

        # -------------------------------------------------------------
        # 3. Structural Dynamics: Vibration (ISO 10816-3 RMS Velocity)
        # -------------------------------------------------------------
        # Bearing wear produces exponential increase in vibration harmonics
        # Healthy: ~1.2-1.8 mm/s, Degrading: ~3.0-4.8 mm/s, Critical: > 7.1 mm/s (Danger Zone D)
        vib_wear_factor = 1.0 + (4.5 * (wear ** 1.7))
        base_vib = nominal["vibration"] * vib_wear_factor
        vib_noise = self.rng.normal(0, nominal.get("vibration_std", 0.15) * (1.0 + wear))
        vibration = max(0.1, round(float(base_vib + vib_noise), 3))

        # -------------------------------------------------------------
        # 4. Thermodynamics: Machine Temperature (°C)
        # -------------------------------------------------------------
        # Ambient temperature ~24°C, nominal operational delta, plus bearing friction & I^2*R heat
        ambient_temp = 24.5
        heat_load = (torque / nominal["torque"]) * 18.0
        heat_friction = 35.0 * (wear ** 1.4)
        temp_noise = self.rng.normal(0, nominal.get("temperature_std", 1.0))
        temperature = max(15.0, round(float(ambient_temp + heat_load + heat_friction + temp_noise), 2))

        # -------------------------------------------------------------
        # 5. Fluid Dynamics: Operating Pressure (bar)
        # -------------------------------------------------------------
        # Impeller/compressor pressure depends on RPM and internal seal wear
        pressure_baseline = nominal["pressure"] * ((rpm / nominal["rpm"]) ** 1.25)
        pressure_leakage = (nominal["pressure"] * 0.12) * (wear ** 1.2)
        p_noise = self.rng.normal(0, nominal.get("pressure_std", 0.1))
        pressure = max(0.5, round(float(pressure_baseline - pressure_leakage + p_noise), 2))

        # -------------------------------------------------------------
        # 6. Assemble Clean Physical Baseline
        # -------------------------------------------------------------
        sensors: Dict[str, Optional[float]] = {
            "temperature": temperature,
            "vibration": vibration,
            "rpm": rpm,
            "pressure": pressure,
            "current": current,
            "voltage": voltage,
            "torque": torque
        }

        raw_sensors = dict(sensors)
        quality_flags: List[str] = []
        quality_status = SensorReadingStatus.VALID

        # -------------------------------------------------------------
        # 7. Realistic Anomaly & Noise Injection (Demonstrating Pipeline)
        # -------------------------------------------------------------
        if inject_anomalies and self.rng.random() < anomaly_prob:
            anomaly_type = self.rng.choice(["spike", "missing", "range_violation", "drift"])

            if anomaly_type == "spike":
                # High-frequency transient spike (e.g. electrical arc or sensor probe bounce)
                spike_sensor = self.rng.choice(["vibration", "temperature", "current", "torque"])
                if spike_sensor == "vibration":
                    raw_sensors["vibration"] = round(float(vibration * float(self.rng.uniform(2.5, 4.0))), 2)
                    quality_flags.append("VIBRATION_SPIKE_INJECTED")
                elif spike_sensor == "temperature":
                    raw_sensors["temperature"] = round(float(temperature + float(self.rng.uniform(18.0, 32.0))), 2)
                    quality_flags.append("THERMAL_SPIKE_INJECTED")
                elif spike_sensor == "current":
                    raw_sensors["current"] = round(float(current * float(self.rng.uniform(1.8, 2.5))), 2)
                    quality_flags.append("CURRENT_SURGE_INJECTED")
                elif spike_sensor == "torque":
                    raw_sensors["torque"] = round(float(torque * float(self.rng.uniform(1.7, 2.2))), 2)
                    quality_flags.append("TORQUE_IMPULSE_INJECTED")
                quality_status = SensorReadingStatus.OUTLIER_DETECTED

            elif anomaly_type == "missing":
                # Sensor packet dropout / loose wire / ADC communication timeout
                missing_sensor = self.rng.choice(["current", "pressure", "vibration", "temperature"])
                raw_sensors[missing_sensor] = None
                quality_flags.append(f"MISSING_VALUE_INJECTED_{missing_sensor.upper()}")
                quality_status = SensorReadingStatus.MISSING_VALUE

            elif anomaly_type == "range_violation":
                # Out of physical bound (e.g. negative value or broken transducer)
                bad_sensor = self.rng.choice(["pressure", "vibration"])
                if bad_sensor == "pressure":
                    raw_sensors["pressure"] = -1.5
                    quality_flags.append("NEGATIVE_PRESSURE_RANGE_VIOLATION")
                else:
                    raw_sensors["vibration"] = 38.5
                    quality_flags.append("OUT_OF_BOUNDS_VIBRATION")
                quality_status = SensorReadingStatus.INVALID

            elif anomaly_type == "drift":
                # Subtle calibration offset drift
                raw_sensors["temperature"] = round(float(temperature + 8.5), 2)
                quality_flags.append("SENSOR_CALIBRATION_DRIFT")
                quality_status = SensorReadingStatus.NOISY

        return {
            "machine_id": profile["machine_id"],
            "machine_name": profile["name"],
            "machine_type": profile["type"],
            "cycle": cycle,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "sequence_number": sequence_number,
            "wear_index": round(wear, 4),
            "scenario": scenario,
            "raw_sensors": raw_sensors,
            "sensors": raw_sensors,
            "clean_baseline": sensors,
            "quality_flags": quality_flags,
            "status": quality_status
        }
