"""
Simulation Manager Orchestration Layer
Coordinates 10-second automatic background execution, live industrial IoT sensor simulation,
physical sensor ingestion (ESP32 / MQTT), 5-stage cleaning pipeline, ML prognostics,
and Server-Sent Events (SSE) streaming.
"""
import time
import json
import threading
import queue
import uuid
from typing import Dict, Any, List, Optional
from collections import defaultdict, deque
from pathlib import Path

try:
    from simulator.schemas import (
        SimulationMode,
        SensorReadingStatus,
        TelemetryPacket,
        MachineSimulationConfig,
        SimulationManagerConfig,
        PipelineMetrics,
        SimulationStatusResponse
    )
    from simulator.sensor_simulator import SensorSimulator
    from simulator.sensor_adapters import (
        SimulatedSensorAdapter,
        ESP32SensorAdapter,
        MQTTSensorAdapter,
        CMAPSSSensorAdapter,
        IndustrialWorkshopAdapter
    )
    from simulator.dataset_replay_engine import dataset_replay_engine, DatasetReplayEngine
    from simulator.dataset_parser import ensure_manifest_exists
    from preprocessing.pipeline import DataCleaningPipeline, CleanedTelemetryFrame
    from predictor import predictor
except ImportError:
    from ml_service.simulator.schemas import (
        SimulationMode,
        SensorReadingStatus,
        TelemetryPacket,
        MachineSimulationConfig,
        SimulationManagerConfig,
        PipelineMetrics,
        SimulationStatusResponse
    )
    from ml_service.simulator.sensor_simulator import SensorSimulator
    from ml_service.simulator.sensor_adapters import (
        SimulatedSensorAdapter,
        ESP32SensorAdapter,
        MQTTSensorAdapter,
        CMAPSSSensorAdapter,
        IndustrialWorkshopAdapter
    )
    from ml_service.simulator.dataset_replay_engine import dataset_replay_engine, DatasetReplayEngine
    from ml_service.simulator.dataset_parser import ensure_manifest_exists
    from ml_service.preprocessing.pipeline import DataCleaningPipeline, CleanedTelemetryFrame
    from ml_service.predictor import predictor


class SimulationManager:
    _instance: Optional["SimulationManager"] = None
    _lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._initialized = False
            return cls._instance

    def __init__(self, models_dir: Optional[Path] = None):
        if getattr(self, "_initialized", False):
            return

        self.models_dir = Path(models_dir) if models_dir else predictor.models_dir
        self.simulator = SensorSimulator()
        self.replay_engine: DatasetReplayEngine = dataset_replay_engine
        self.pipeline = DataCleaningPipeline(models_dir=self.models_dir)

        # Primary Mode: 'iot_simulator' (10-second Industrial Rotating Machinery)
        self.simulation_source: str = "iot_simulator"
        self.active_dataset_id: Optional[str] = None
        self.active_machine_id: Optional[str] = "MOTOR-001"

        # Session & Sequence Tracking (Phases 2 & 8)
        self.simulation_session_id: str = f"sim_{int(time.time())}_{uuid.uuid4().hex[:6]}"
        self.sequence_number: int = 0

        self.is_running = False
        self.is_paused = False
        # Default 10.0 seconds interval as strictly specified by user requirements
        self.tick_interval_seconds = 10.0
        self.speed_multiplier = 1.0
        self.auto_predict = True
        self.random_seed: Optional[int] = None

        self.total_cycles_simulated = 0
        self._worker_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()

        # Telemetry ring buffers: machine_id -> deque of recent processed dicts
        self.telemetry_history: Dict[str, deque] = defaultdict(lambda: deque(maxlen=100))
        # Latest prediction result per machine
        self.latest_predictions: Dict[str, Dict[str, Any]] = {}
        # Latest frame per machine
        self.latest_frames: Dict[str, Dict[str, Any]] = {}

        # SSE Client subscriber queues
        self.sse_subscribers: List[queue.Queue] = []
        self._sub_lock = threading.Lock()

        # Seed initial frames for default machines so UI immediately renders live metrics
        self._seed_initial_frames()
        self._initialized = True

    def _seed_initial_frames(self):
        """
        Seeds initial status and baseline telemetry for default machines on startup.
        """
        try:
            for mid in list(self.simulator.machines.keys()):
                state = self.simulator.machines[mid]
                dummy_pkt = state.step()
                clean_frame = self.pipeline.process(dummy_pkt)
                pred_res = predictor.predict_industrial_motor(mid, clean_frame.cleaned_sensors)
                self.latest_predictions[mid] = pred_res
                initial_payload = {
                    "type": "telemetry_tick",
                    "simulation_source": "iot_simulator",
                    "source": "simulated_sensor",
                    "machine_id": mid,
                    "machine_name": state.machine_name,
                    "machine_type": state.machine_type,
                    "cycle": state.current_cycle,
                    "timestamp": clean_frame.timestamp,
                    "sequence_number": 0,
                    "simulation_session_id": self.simulation_session_id,
                    "subset": "INDUSTRIAL_IOT",
                    "scenario": str(state.scenario.value if hasattr(state.scenario, "value") else state.scenario),
                    "quality_status": "VALID",
                    "data_quality_flags": [],
                    "stage_status": clean_frame.stage_status,
                    "raw_sensors": clean_frame.raw_sensors,
                    "cleaned_sensors": clean_frame.cleaned_sensors,
                    "operational_settings": dummy_pkt.operational_settings,
                    "comparison_table": clean_frame.comparison_table,
                    "pipeline_metrics": self.pipeline.get_metrics().model_dump(),
                    "prediction": pred_res.get("prediction"),
                    "model_metadata": {
                        "modelVersion": pred_res.get("modelVersion"),
                        "architecture": pred_res.get("architecture"),
                        "inferenceLatencyMs": pred_res.get("inferenceLatencyMs", 1.2)
                    }
                }
                self.latest_frames[mid] = initial_payload
                self.telemetry_history[mid].append(initial_payload)
        except Exception as e:
            print(f"[SimulationManager Init Seed] Note: {e}")

    def configure_and_start(self, config: SimulationManagerConfig) -> SimulationStatusResponse:
        with self._lock:
            self.tick_interval_seconds = config.tick_interval_seconds or 10.0
            self.speed_multiplier = config.speed_multiplier or 1.0
            self.auto_predict = config.auto_predict
            self.random_seed = config.random_seed
            self.simulation_source = config.simulation_source or "iot_simulator"

            # Create new session if not already running
            if not self.is_running:
                self.simulation_session_id = f"sim_{int(time.time())}_{uuid.uuid4().hex[:6]}"
                self.sequence_number = 0

            print(f"[SIMULATION START] Session: {self.simulation_session_id} | Source: {self.simulation_source} | Interval: {self.tick_interval_seconds}s | Speed: {self.speed_multiplier}x")

            if self.simulation_source == "cmapss_synthetic":
                self.simulator.switch_to_turbofan_fleet()
            elif self.simulation_source == "iot_simulator":
                if self.simulator.fleet_mode != "industrial":
                    self.simulator.switch_to_industrial_fleet()
                if config.machines:
                    for m_cfg in config.machines:
                        self.simulator.add_or_update_machine(m_cfg)
            elif self.simulation_source == "dataset":
                ds_id = config.dataset_id or self.active_dataset_id or "cmapss_val_full_FD001"
                m_id = config.selected_machine_id or "1"
                self.replay_engine.load_dataset(dataset_id=ds_id, machine_id=m_id, is_looping=True)

            self.is_running = True
            self.is_paused = False
            self._stop_event.clear()

            # Emit initial tick immediately so frontend updates at t = 0 without waiting 10s
            try:
                self._step_once()
            except Exception as e:
                print(f"[SimulationManager] Initial step note: {e}")

            if self._worker_thread is None or not self._worker_thread.is_alive():
                self._worker_thread = threading.Thread(target=self._run_loop, daemon=True, name="PredictX-SimRunner")
                self._worker_thread.start()

        return self.get_status()

    def pause(self) -> SimulationStatusResponse:
        with self._lock:
            if self.is_running:
                self.is_paused = True
                print(f"[SIMULATION PAUSE] Session: {self.simulation_session_id} | Suspended at Cycle: {self.total_cycles_simulated}")
        return self.get_status()

    def resume(self) -> SimulationStatusResponse:
        with self._lock:
            if self.is_running:
                self.is_paused = False
                print(f"[SIMULATION RESUME] Session: {self.simulation_session_id} | Resumed at Cycle: {self.total_cycles_simulated}")
        return self.get_status()

    def stop(self) -> SimulationStatusResponse:
        with self._lock:
            self.is_running = False
            self.is_paused = False
            self._stop_event.set()
            print(f"[SIMULATION STOP] Session: {self.simulation_session_id} | Total Packets: {self.total_cycles_simulated}")

        if self._worker_thread and self._worker_thread.is_alive():
            self._worker_thread.join(timeout=1.0)
            self._worker_thread = None

        return self.get_status()

    def reset_fleet(self) -> SimulationStatusResponse:
        self.stop()
        with self._lock:
            self.simulator.reset_all()
            self.telemetry_history.clear()
            self.latest_predictions.clear()
            self.latest_frames.clear()
            self.total_cycles_simulated = 0
            self.sequence_number = 0
            self.simulation_session_id = f"sim_{int(time.time())}_{uuid.uuid4().hex[:6]}"
            self.pipeline.reset_all()
            for mid in list(self.simulator.machines.keys()):
                self.pipeline.reset_machine(mid)
            self._seed_initial_frames()
            print(f"[SIMULATION RESET] Session: {self.simulation_session_id} | Fleet and pipeline metrics cleared.")
        return self.get_status()

    def _step_once(self):
        """
        Executes one single simulation step across all machines or dataset.
        """
        if self.simulation_source == "dataset":
            step_res = self.replay_engine.step()
            if step_res is not None:
                packet, gt_rul = step_res
                self._process_single_packet(packet, ground_truth_rul=gt_rul)
                self.total_cycles_simulated += 1
        else:
            packets = self.simulator.step_all()
            for packet in packets:
                self._process_single_packet(packet)
                self.total_cycles_simulated += 1

    def _run_loop(self):
        """
        Background simulation loop streaming readings every 10 seconds (scaled by speed multiplier).
        """
        while not self._stop_event.is_set():
            if self.is_paused or not self.is_running:
                time.sleep(0.2)
                continue

            # Sleep duration in seconds: default 10.0s / speed_multiplier
            sleep_sec = max(0.1, self.tick_interval_seconds / max(0.1, self.speed_multiplier))
            time.sleep(sleep_sec)

            if self.is_paused or not self.is_running or self._stop_event.is_set():
                continue

            try:
                self._step_once()
            except Exception as e:
                print(f"[SimulationManager Error] Tick execution failed: {e}")

    def _process_single_packet(
        self,
        packet: TelemetryPacket,
        ground_truth_rul: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Passes packet through 5-stage cleaning pipeline, executes appropriate ML model,
        and broadcasts live telemetry payload to all connected SSE clients.
        """
        clean_frame = self.pipeline.process(packet)

        # Determine machine model path: Industrial Rotating Equipment vs C-MAPSS Turbofan
        is_motor = (
            clean_frame.subset == "INDUSTRIAL_IOT" or
            clean_frame.machine_id.startswith("MOTOR-") or
            any(k in clean_frame.cleaned_sensors for k in ["temperature", "vibration", "rpm", "pressure", "current", "voltage", "torque"])
        )

        pred_res = None
        if self.auto_predict and not clean_frame.quarantined:
            try:
                if is_motor:
                    # Model Path B: Multi-sensor industrial anomaly & fault classifier
                    pred_res = predictor.predict_industrial_motor(
                        machine_id=clean_frame.machine_id,
                        sensors=clean_frame.cleaned_sensors
                    )
                else:
                    # Model Path A: C-MAPSS RUL Regressors (XGBoost / Attention-CNN-BiLSTM)
                    eng_feat = self.pipeline.feature_engineer.process(
                        clean_frame.machine_id,
                        clean_frame.cycle,
                        clean_frame.operational_settings,
                        clean_frame.cleaned_sensors
                    )
                    pred_res = predictor.predict_cmaps_cleaned(
                        machine_id=clean_frame.machine_id,
                        subset=clean_frame.subset,
                        cycle=clean_frame.cycle,
                        operational_settings=clean_frame.operational_settings,
                        cleaned_sensors=clean_frame.cleaned_sensors,
                        pipeline_features=eng_feat,
                        transformer=self.pipeline.model_transformer
                    )

                self.latest_predictions[clean_frame.machine_id] = pred_res
            except Exception as ex:
                print(f"[SimulationManager Predict Error] Machine {clean_frame.machine_id}: {ex}")

        prediction_block = pred_res["prediction"] if pred_res else None
        pred_error = None

        if prediction_block and ground_truth_rul is not None:
            pred_rul_val = prediction_block.get("predictedRUL")
            if pred_rul_val is not None:
                pred_error = round(float(pred_rul_val) - float(ground_truth_rul), 2)
                prediction_block["actualRUL"] = round(float(ground_truth_rul), 2)
                prediction_block["predictionError"] = pred_error

        self.sequence_number += 1

        combined_payload = {
            "type": "telemetry_tick",
            "simulation_source": self.simulation_source,
            "source": getattr(packet, "source", "simulated_sensor"),
            "machine_id": clean_frame.machine_id,
            "machine_name": getattr(packet, "machine_name", clean_frame.machine_id),
            "machine_type": getattr(packet, "machine_type", "PUMP_MOTOR"),
            "cycle": clean_frame.cycle,
            "timestamp": clean_frame.timestamp,
            "sequence_number": self.sequence_number,
            "simulation_session_id": self.simulation_session_id,
            "subset": clean_frame.subset,
            "scenario": packet.simulation_scenario.value if hasattr(packet.simulation_scenario, "value") else str(packet.simulation_scenario),
            "quality_status": clean_frame.quality_status.value if hasattr(clean_frame.quality_status, "value") else str(clean_frame.quality_status),
            "data_quality_flags": packet.data_quality_flags,
            "stage_status": clean_frame.stage_status,
            "raw_sensors": clean_frame.raw_sensors,
            "cleaned_sensors": clean_frame.cleaned_sensors,
            "operational_settings": clean_frame.operational_settings,
            "comparison_table": clean_frame.comparison_table,
            "pipeline_metrics": self.pipeline.get_metrics().model_dump(),
            "prediction": prediction_block,
            "ground_truth_rul": round(float(ground_truth_rul), 2) if ground_truth_rul is not None else None,
            "prediction_error": pred_error,
            "model_metadata": {
                "modelVersion": pred_res.get("modelVersion") if pred_res else "None",
                "architecture": pred_res.get("architecture") if pred_res else "None",
                "inferenceLatencyMs": pred_res.get("inferenceLatencyMs", 1.2) if pred_res else 1.2
            } if pred_res else None
        }

        print(f"[TELEMETRY PACKET #{self.sequence_number}] Machine: {clean_frame.machine_id} | Cycle: {clean_frame.cycle} | Session: {self.simulation_session_id} | Stage: {clean_frame.quality_status.value} | Model: {pred_res.get('modelVersion') if pred_res else 'Awaiting'}")

        self.telemetry_history[clean_frame.machine_id].append(combined_payload)
        self.latest_frames[clean_frame.machine_id] = combined_payload

        self._broadcast_sse(combined_payload)
        return combined_payload

    def ingest_external_telemetry(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Public ingestion endpoint for external physical IoT sensor payloads (ESP32 / MQTT / REST).
        """
        machine_id = str(raw_data.get("machine_id") or raw_data.get("machineId") or "MOTOR-001").strip().upper()
        cycle = int(raw_data.get("cycle") or 1)
        source_hint = raw_data.get("source", "").lower()
        device_id = raw_data.get("device_id", "")

        # Select appropriate adapter based on hardware signature
        if "esp32" in device_id.lower() or "esp32" in source_hint or any(k in raw_data for k in ["temp_c", "accel_rms", "pressure_bar"]):
            adapter = ESP32SensorAdapter()
        elif "mqtt" in source_hint or "topic" in raw_data:
            adapter = MQTTSensorAdapter()
        elif "s_1" in raw_data or ("sensors" in raw_data and "s_1" in raw_data["sensors"]):
            adapter = CMAPSSSensorAdapter()
        else:
            adapter = SimulatedSensorAdapter()

        source_type, settings, sensors, warnings = adapter.adapt(raw_data)

        packet = TelemetryPacket(
            machine_id=machine_id,
            machine_name=raw_data.get("machine_name", f"Equipment {machine_id}"),
            machine_type=raw_data.get("machine_type", "PUMP_MOTOR"),
            source=source_type,
            subset="INDUSTRIAL_IOT",
            cycle=cycle,
            timestamp=raw_data.get("timestamp") or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            sequence_number=self.total_cycles_simulated + 1,
            simulation_scenario=SimulationMode.CUSTOM,
            operational_settings=settings,
            sensors=sensors,
            raw_sensors=sensors,
            data_quality_flags=warnings
        )

        return self._process_single_packet(packet)

    def subscribe_sse(self) -> queue.Queue:
        q = queue.Queue(maxsize=100)
        with self._sub_lock:
            self.sse_subscribers.append(q)
        return q

    def unsubscribe_sse(self, q: queue.Queue):
        with self._sub_lock:
            if q in self.sse_subscribers:
                self.sse_subscribers.remove(q)

    def _broadcast_sse(self, message: Dict[str, Any]):
        dead_queues = []
        with self._sub_lock:
            for q in self.sse_subscribers:
                try:
                    q.put_nowait(message)
                except queue.Full:
                    dead_queues.append(q)

            for dq in dead_queues:
                if dq in self.sse_subscribers:
                    self.sse_subscribers.remove(dq)

    def get_status(self) -> SimulationStatusResponse:
        active_m = list(self.simulator.machines.keys())

        machines_summary = {}
        for mid in active_m:
            last_frame = self.latest_frames.get(mid)
            last_pred = self.latest_predictions.get(mid)
            machines_summary[mid] = {
                "machine_id": mid,
                "machine_name": last_frame.get("machine_name", mid) if last_frame else mid,
                "machine_type": last_frame.get("machine_type", "PUMP_MOTOR") if last_frame else "PUMP_MOTOR",
                "source": last_frame.get("source", "simulated_sensor") if last_frame else "simulated_sensor",
                "current_cycle": last_frame.get("cycle", 1) if last_frame else 1,
                "status": "operational" if not self.is_running else ("paused" if self.is_paused else "running"),
                "latest_prediction": last_pred.get("prediction") if last_pred else None,
                "model_metadata": last_pred.get("model_metadata") if last_pred else None
            }

        return SimulationStatusResponse(
            is_running=self.is_running,
            is_paused=self.is_paused,
            simulation_source=self.simulation_source,
            active_machines=active_m,
            tick_interval_seconds=self.tick_interval_seconds,
            speed_multiplier=self.speed_multiplier,
            total_cycles_simulated=self.total_cycles_simulated,
            pipeline_metrics=self.pipeline.get_metrics(),
            machines_summary=machines_summary
        )

    def get_telemetry_history(self, machine_id: Optional[str] = None, limit: int = 50) -> Dict[str, Any]:
        if machine_id:
            buf = self.telemetry_history.get(machine_id)
            return {
                "machine_id": machine_id,
                "count": len(buf) if buf else 0,
                "data": list(buf)[-limit:] if buf else []
            }

        return {
            "machines": {
                mid: list(buf)[-limit:]
                for mid, buf in self.telemetry_history.items()
            }
        }


# Global singleton instance
simulation_manager = SimulationManager()
