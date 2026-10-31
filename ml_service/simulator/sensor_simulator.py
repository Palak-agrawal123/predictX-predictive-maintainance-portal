"""
Sensor Simulator Engine
Manages concurrent industrial IoT machines (Motors/Pumps) and Turbofans,
advancing operational cycles, tracking physical wear, and generating realistic telemetry.
"""
import threading
from typing import Dict, List, Optional, Any
from collections import deque
from datetime import datetime, timezone

from .schemas import (
    SimulationMode,
    MachineSimulationConfig,
    TelemetryPacket,
    SensorReadingStatus
)
from .machine_profiles import INDUSTRIAL_MACHINE_PROFILES
from .degradation_engine import IndustrialDegradationEngine
from .scenario_generator import ScenarioGenerator


class MachineSimulatorState:
    def __init__(self, config: MachineSimulationConfig, seed: Optional[int] = None):
        self.config = config
        self.machine_id = config.machine_id
        self.machine_name = config.name or config.machine_id
        self.machine_type = config.type or "PUMP_MOTOR"
        self.scenario = config.scenario
        self.subset = config.subset
        self.current_cycle = config.initial_cycle
        self.wear_index = config.initial_wear
        self.wear_rate = config.wear_rate
        self.max_cycles = config.max_cycles
        self.sequence_number = 0
        self.history: deque = deque(maxlen=100)

        # Check if machine is an Industrial IoT rotating machine or a C-MAPSS engine
        self.is_industrial_motor = self.machine_id.startswith("MOTOR-") or self.subset == "INDUSTRIAL_IOT"
        self.industrial_engine = IndustrialDegradationEngine(seed=seed)
        self.turbofan_generator = ScenarioGenerator(seed=seed)

        # Set baseline wear according to scenario
        if self.scenario == SimulationMode.HEALTHY:
            self.wear_index = max(0.04, min(0.15, self.wear_index))
            self.wear_rate = 0.0008
        elif self.scenario == SimulationMode.GRADUAL:
            self.wear_index = max(0.40, min(0.60, self.wear_index))
            self.wear_rate = 0.0045
        elif self.scenario == SimulationMode.CRITICAL:
            self.wear_index = max(0.82, min(0.96, self.wear_index))
            self.wear_rate = 0.0110

    def step(self) -> TelemetryPacket:
        self.current_cycle += 1
        self.sequence_number += 1

        # Non-linear wear acceleration in the wearout regime
        wear_accel = 1.0 + (self.wear_index * 0.75)
        self.wear_index = min(1.0, self.wear_index + (self.wear_rate * wear_accel))

        if self.is_industrial_motor:
            profile = INDUSTRIAL_MACHINE_PROFILES.get(self.machine_id, {
                "machine_id": self.machine_id,
                "name": self.machine_name,
                "type": self.machine_type,
                "scenario": str(self.scenario),
                "nominal": {
                    "rpm": 1500.0, "rpm_std": 8.0,
                    "temperature": 50.0, "temperature_std": 1.2,
                    "vibration": 1.8, "vibration_std": 0.15,
                    "pressure": 4.5, "pressure_std": 0.1,
                    "current": 15.0, "current_std": 0.4,
                    "voltage": 400.0, "voltage_std": 1.5,
                    "torque": 40.0, "torque_std": 1.0
                }
            })

            gen_result = self.industrial_engine.generate_step(
                profile=profile,
                cycle=self.current_cycle,
                wear_index=self.wear_index,
                scenario=str(self.scenario),
                sequence_number=self.sequence_number,
                inject_anomalies=self.config.inject_anomalies,
                anomaly_prob=self.config.anomaly_probability
            )

            packet = TelemetryPacket(
                machine_id=self.machine_id,
                machine_name=profile.get("name", self.machine_name),
                machine_type=profile.get("type", self.machine_type),
                source="simulated_sensor",
                subset="INDUSTRIAL_IOT",
                cycle=self.current_cycle,
                timestamp=gen_result["timestamp"],
                sequence_number=self.sequence_number,
                simulation_scenario=self.scenario,
                operational_settings={
                    "load_pct": round(float(gen_result["clean_baseline"]["torque"] / profile["nominal"]["torque"] * 100.0), 1),
                    "target_rpm": profile["nominal"]["rpm"],
                    "nominal_voltage": profile["nominal"].get("voltage", 400.0)
                },
                sensors=gen_result["sensors"],
                raw_sensors=gen_result["raw_sensors"],
                data_quality_flags=gen_result["quality_flags"],
                status=gen_result["status"]
            )
        else:
            # NASA C-MAPSS Turbofan generator
            raw_pkt = self.turbofan_generator.generate_cycle_reading(
                machine_id=self.machine_id,
                cycle=self.current_cycle,
                scenario=self.scenario,
                wear_index=self.wear_index,
                subset=self.subset,
                sequence_number=self.sequence_number,
                inject_anomalies=self.config.inject_anomalies,
                anomaly_prob=self.config.anomaly_probability
            )
            packet = TelemetryPacket(
                machine_id=self.machine_id,
                machine_name=f"Turbofan Engine {self.machine_id}",
                machine_type="TURBINE",
                source="simulated_sensor",
                subset=self.subset,
                cycle=self.current_cycle,
                timestamp=raw_pkt.timestamp,
                sequence_number=self.sequence_number,
                simulation_scenario=self.scenario,
                operational_settings=raw_pkt.operational_settings,
                sensors=raw_pkt.sensors,
                raw_sensors=raw_pkt.sensor_readings,
                data_quality_flags=list(raw_pkt.data_quality_flags.keys()) if isinstance(raw_pkt.data_quality_flags, dict) else [],
                status=raw_pkt.status
            )

        self.history.append(packet)
        return packet

    def reset(self, seed: Optional[int] = None):
        self.current_cycle = self.config.initial_cycle
        self.wear_index = self.config.initial_wear
        self.sequence_number = 0
        self.history.clear()
        if seed is not None:
            self.industrial_engine.set_seed(seed)
            self.turbofan_generator.set_seed(seed)

    def to_dict(self) -> Dict[str, Any]:
        latest = self.history[-1] if self.history else None
        return {
            "machine_id": self.machine_id,
            "machine_name": self.machine_name,
            "machine_type": self.machine_type,
            "scenario": str(self.scenario.value if hasattr(self.scenario, "value") else self.scenario),
            "subset": self.subset,
            "current_cycle": self.current_cycle,
            "wear_index": round(self.wear_index, 4),
            "sequence_number": self.sequence_number,
            "buffered_readings_count": len(self.history),
            "latest_reading": latest.model_dump() if latest else None
        }


class SensorSimulator:
    """
    Multi-machine concurrent sensor simulation manager.
    """
    def __init__(self, random_seed: Optional[int] = None):
        self.seed = random_seed
        self.machines: Dict[str, MachineSimulatorState] = {}
        self.lock = threading.Lock()
        self.fleet_mode = "industrial" # "industrial" or "turbofan"
        self._initialize_default_fleet()

    def _initialize_default_fleet(self):
        """
        Creates default 3-machine industrial rotating equipment fleet:
        MOTOR-001: Healthy (Centrifugal Water Pump Motor)
        MOTOR-002: Degrading (CNC Extruder Spindle Motor)
        MOTOR-003: Critical (Gas Booster Compressor Motor)
        """
        self.machines.clear()
        configs = [
            MachineSimulationConfig(
                machine_id="MOTOR-001",
                name="Centrifugal Water Pump Motor",
                type="PUMP_MOTOR",
                scenario=SimulationMode.HEALTHY,
                subset="INDUSTRIAL_IOT",
                initial_cycle=45,
                initial_wear=0.06,
                wear_rate=0.0008,
                inject_anomalies=False
            ),
            MachineSimulationConfig(
                machine_id="MOTOR-002",
                name="CNC Extruder Spindle Motor",
                type="SPINDLE_MOTOR",
                scenario=SimulationMode.GRADUAL,
                subset="INDUSTRIAL_IOT",
                initial_cycle=110,
                initial_wear=0.46,
                wear_rate=0.0050,
                inject_anomalies=True,
                anomaly_probability=0.06
            ),
            MachineSimulationConfig(
                machine_id="MOTOR-003",
                name="Gas Booster Compressor Motor",
                type="COMPRESSOR_MOTOR",
                scenario=SimulationMode.CRITICAL,
                subset="INDUSTRIAL_IOT",
                initial_cycle=185,
                initial_wear=0.86,
                wear_rate=0.0120,
                inject_anomalies=True,
                anomaly_probability=0.08
            )
        ]

        for cfg in configs:
            self.add_or_update_machine(cfg)

    def switch_to_turbofan_fleet(self):
        with self.lock:
            self.machines.clear()
            self.fleet_mode = "turbofan"
            turbofan_configs = [
                MachineSimulationConfig(
                    machine_id="Engine-001",
                    name="Turbofan Engine 001",
                    type="TURBINE",
                    scenario=SimulationMode.HEALTHY,
                    subset="FD001",
                    initial_cycle=45,
                    initial_wear=0.08,
                    wear_rate=0.0012,
                    inject_anomalies=False
                ),
                MachineSimulationConfig(
                    machine_id="Engine-002",
                    name="Turbofan Engine 002",
                    type="TURBINE",
                    scenario=SimulationMode.GRADUAL,
                    subset="FD001",
                    initial_cycle=110,
                    initial_wear=0.45,
                    wear_rate=0.0055,
                    inject_anomalies=True,
                    anomaly_probability=0.06
                ),
                MachineSimulationConfig(
                    machine_id="Engine-003",
                    name="Turbofan Engine 003",
                    type="TURBINE",
                    scenario=SimulationMode.CRITICAL,
                    subset="FD002",
                    initial_cycle=185,
                    initial_wear=0.82,
                    wear_rate=0.0110,
                    inject_anomalies=True,
                    anomaly_probability=0.08
                )
            ]
            for cfg in turbofan_configs:
                self.add_or_update_machine(cfg)

    def switch_to_industrial_fleet(self):
        with self.lock:
            self.fleet_mode = "industrial"
            self._initialize_default_fleet()

    def add_or_update_machine(self, config: MachineSimulationConfig):
        with self.lock:
            seed = self.seed + len(self.machines) if self.seed is not None else None
            self.machines[config.machine_id] = MachineSimulatorState(config, seed=seed)

    def remove_machine(self, machine_id: str) -> bool:
        with self.lock:
            if machine_id in self.machines:
                del self.machines[machine_id]
                return True
            return False

    def step_machine(self, machine_id: str) -> Optional[TelemetryPacket]:
        with self.lock:
            if machine_id in self.machines:
                return self.machines[machine_id].step()
            return None

    def step_all(self) -> List[TelemetryPacket]:
        with self.lock:
            packets = []
            for state in self.machines.values():
                packets.append(state.step())
            return packets

    def reset_all(self):
        with self.lock:
            for state in self.machines.values():
                state.reset(self.seed)

    def get_machine_history(self, machine_id: str, limit: int = 50) -> List[TelemetryPacket]:
        with self.lock:
            if machine_id in self.machines:
                hist = list(self.machines[machine_id].history)
                return hist[-limit:]
            return []

    def get_summary(self) -> Dict[str, Any]:
        with self.lock:
            return {
                mid: state.to_dict()
                for mid, state in self.machines.items()
            }
