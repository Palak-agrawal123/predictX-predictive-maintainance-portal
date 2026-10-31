"""
Scenario Generator for Industrial Machine Simulation
Generates realistic, physically-grounded sensor trajectories for NASA C-MAPSS
across Healthy, Gradual Degradation, Critical, and Custom operating scenarios.
"""
from typing import Dict, Any, Tuple, List, Optional
import numpy as np
from datetime import datetime, timezone

from .schemas import SimulationMode, TelemetryPacket, SensorReadingStatus
from .sensor_profiles import CMAPSS_SENSOR_SPECS, FLIGHT_REGIMES_FD0024


class ScenarioGenerator:
    def __init__(self, seed: Optional[int] = None):
        self.rng = np.random.RandomState(seed)
        self.seed = seed

    def set_seed(self, seed: Optional[int]):
        self.seed = seed
        self.rng = np.random.RandomState(seed)

    def generate_cycle_reading(
        self,
        machine_id: str,
        cycle: int,
        scenario: SimulationMode,
        wear_index: float,
        subset: str = "FD001",
        sequence_number: int = 0,
        inject_anomalies: bool = False,
        anomaly_prob: float = 0.05
    ) -> TelemetryPacket:
        """
        Synthesizes a single deterministic or stochastic telemetry packet.
        wear_index: float between 0.0 (brand new engine) and 1.0 (end-of-life threshold).
        """
        # 1. Operational settings selection
        if subset in ["FD002", "FD004"]:
            # Pick regime based on cycle or cyclic mission profile
            regime_idx = (cycle // 10) % len(FLIGHT_REGIMES_FD0024)
            regime = FLIGHT_REGIMES_FD0024[regime_idx]
            settings = {
                "setting_1": float(regime["setting_1"]),
                "setting_2": float(regime["setting_2"]),
                "setting_3": float(regime["setting_3"])
            }
        else:
            # Single condition FD001 / FD003
            settings = {
                "setting_1": float(self.rng.normal(0.000, 0.0015)),
                "setting_2": float(self.rng.normal(0.000, 0.0003)),
                "setting_3": 100.0
            }

        # 2. Physics & Wear scaling
        # Wear causes progressive non-linear degradation
        effective_wear = float(np.clip(wear_index ** 1.35, 0.0, 1.2))

        sensors: Dict[str, float] = {}
        flags: List[str] = []
        status = SensorReadingStatus.VALID

        for s_key, spec in CMAPSS_SENSOR_SPECS.items():
            base_mean = spec["nominal_mean"]
            base_std = spec["nominal_std"]
            slope = spec["degradation_slope"]

            # In multi-regime FD002/FD004, altitude and Mach cause physical offsets
            regime_offset = 0.0
            if subset in ["FD002", "FD004"]:
                # Flight altitude & throttle shift base thermodynamic operating point
                s1 = settings["setting_1"] # Altitude
                s2 = settings["setting_2"] # Mach
                if "temp" in spec["description"].lower():
                    regime_offset = -(s1 * 1.5) + (s2 * 35.0)
                elif "pressure" in spec["description"].lower():
                    regime_offset = -(s1 * 3.8) + (s2 * 15.0)
                elif "speed" in spec["description"].lower():
                    regime_offset = -(s1 * 8.0) + (s2 * 25.0)

            # Jitter noise
            noise = float(self.rng.normal(0.0, base_std if base_std > 0 else 0.001))
            val = base_mean + regime_offset + (slope * effective_wear) + noise
            sensors[s_key] = round(float(val), 4)

        # 3. Mode-specific adjustments
        if scenario == SimulationMode.HEALTHY:
            # Low, stationary wear
            pass
        elif scenario == SimulationMode.GRADUAL:
            # Progressive degradation with subtle harmonic drift
            pass
        elif scenario == SimulationMode.CRITICAL:
            # Elevated exhaust gas temperature (T50/s_4) and static pressure (Ps30/s_11)
            sensors["s_4"] += float(self.rng.uniform(6.0, 15.0))
            sensors["s_11"] += float(self.rng.uniform(0.3, 0.7))
            sensors["s_3"] += float(self.rng.uniform(5.0, 12.0))
            flags.append("HIGH_DEGRADATION_ZONE")

        # 4. Optional Demonstration Anomaly Injection (Spurious Outliers / Missing Values)
        if inject_anomalies and self.rng.random() < anomaly_prob:
            anomaly_type = self.rng.choice(["spike_outlier", "sensor_dropout", "extreme_noise"])
            if anomaly_type == "spike_outlier":
                # Inject physical telemetry spike on sensor s_4 (T50) or s_11 (Ps30)
                target_sensor = self.rng.choice(["s_4", "s_11", "s_2"])
                spike_direction = self.rng.choice([1.0, -1.0])
                spike_magnitude = 8.0 * CMAPSS_SENSOR_SPECS[target_sensor]["nominal_std"]
                if spike_magnitude < 1.0:
                    spike_magnitude = 15.0
                sensors[target_sensor] = round(sensors[target_sensor] + (spike_direction * spike_magnitude), 4)
                flags.append(f"INJECTED_SPIKE_{target_sensor.upper()}")
                status = SensorReadingStatus.OUTLIER_DETECTED

            elif anomaly_type == "sensor_dropout":
                # Sensor packet drops to NaN or 0.0
                target_sensor = self.rng.choice(["s_3", "s_7", "s_14"])
                sensors[target_sensor] = float("nan")
                flags.append(f"INJECTED_NULL_{target_sensor.upper()}")
                status = SensorReadingStatus.MISSING_VALUE

            elif anomaly_type == "extreme_noise":
                target_sensor = self.rng.choice(["s_2", "s_8", "s_12"])
                noise_boost = float(self.rng.normal(0.0, 4.0 * CMAPSS_SENSOR_SPECS[target_sensor]["nominal_std"]))
                sensors[target_sensor] = round(sensors[target_sensor] + noise_boost, 4)
                flags.append(f"INJECTED_NOISE_{target_sensor.upper()}")
                status = SensorReadingStatus.NOISY

        # 5. Workshop Industrial Sensor Proxies
        industrial_sensors = {
            "vibration": round(float(1.5 + (effective_wear * 3.8) + self.rng.normal(0.0, 0.15)), 2),
            "toolWear": round(float(effective_wear * 230.0), 1),
            "processTemperature": round(float(305.0 + (effective_wear * 18.0) + self.rng.normal(0.0, 0.4)), 1),
            "airTemperature": round(float(298.0 + self.rng.normal(0.0, 0.2)), 1),
            "torque": round(float(38.0 + (effective_wear * 22.0) + self.rng.normal(0.0, 0.8)), 1),
            "rotationalSpeed": round(float(1520.0 - (effective_wear * 120.0) + self.rng.normal(0.0, 8.0)), 1)
        }

        now_iso = datetime.now(timezone.utc).isoformat()

        return TelemetryPacket(
            machine_id=machine_id,
            engine_id=f"ENG-{machine_id.upper()}",
            subset=subset,
            cycle=cycle,
            timestamp=now_iso,
            sequence_number=sequence_number,
            simulation_scenario=scenario,
            operational_settings=settings,
            sensors=sensors,
            industrial_sensors=industrial_sensors,
            data_quality_flags=flags,
            status=status
        )
