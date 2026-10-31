"""
Data Cleaning and Preprocessing Pipeline
Orchestrates Stages 1-6, maintains telemetry auditability,
and generates model-ready inputs and comparison payloads.
"""
import time
from typing import Dict, Any, List, Optional
from pathlib import Path

try:
    from simulator.schemas import TelemetryPacket, PipelineMetrics, SensorReadingStatus
    from simulator.sensor_profiles import CMAPSS_SENSOR_SPECS
    from simulator.machine_profiles import INDUSTRIAL_SENSOR_SPECS
    from preprocessing.data_validator import DataValidator, ValidationResult
    from preprocessing.noise_filter import NoiseFilter
    from preprocessing.outlier_detector import OutlierDetector
    from preprocessing.missing_value_handler import MissingValueHandler
    from preprocessing.feature_engineering import FeatureEngineer
    from preprocessing.model_transformer import ModelTransformer
except ImportError:
    from ml_service.simulator.schemas import TelemetryPacket, PipelineMetrics, SensorReadingStatus
    from ml_service.simulator.sensor_profiles import CMAPSS_SENSOR_SPECS
    from ml_service.simulator.machine_profiles import INDUSTRIAL_SENSOR_SPECS
    from ml_service.preprocessing.data_validator import DataValidator, ValidationResult
    from ml_service.preprocessing.noise_filter import NoiseFilter
    from ml_service.preprocessing.outlier_detector import OutlierDetector
    from ml_service.preprocessing.missing_value_handler import MissingValueHandler
    from ml_service.preprocessing.feature_engineering import FeatureEngineer
    from ml_service.preprocessing.model_transformer import ModelTransformer


class CleanedTelemetryFrame:
    def __init__(
        self,
        machine_id: str,
        cycle: int,
        timestamp: str,
        subset: str,
        raw_sensors: Dict[str, float],
        cleaned_sensors: Dict[str, float],
        operational_settings: Dict[str, float],
        comparison_table: List[Dict[str, Any]],
        quality_status: SensorReadingStatus,
        stage_status: Dict[str, str],
        outliers_detected: Dict[str, Any],
        imputed_fields: Dict[str, Any],
        latency_ms: float,
        quarantined: bool = False
    ):
        self.machine_id = machine_id
        self.cycle = cycle
        self.timestamp = timestamp
        self.subset = subset
        self.raw_sensors = raw_sensors
        self.cleaned_sensors = cleaned_sensors
        self.operational_settings = operational_settings
        self.comparison_table = comparison_table
        self.quality_status = quality_status
        self.stage_status = stage_status
        self.outliers_detected = outliers_detected
        self.imputed_fields = imputed_fields
        self.latency_ms = latency_ms
        self.quarantined = quarantined

    def to_dict(self) -> Dict[str, Any]:
        return {
            "machine_id": self.machine_id,
            "cycle": self.cycle,
            "timestamp": self.timestamp,
            "subset": self.subset,
            "raw_sensors": self.raw_sensors,
            "cleaned_sensors": self.cleaned_sensors,
            "operational_settings": self.operational_settings,
            "comparison_table": self.comparison_table,
            "quality_status": self.quality_status.value,
            "stage_status": self.stage_status,
            "outliers_count": len(self.outliers_detected),
            "imputed_count": len(self.imputed_fields),
            "latency_ms": round(self.latency_ms, 2),
            "quarantined": self.quarantined
        }


class DataCleaningPipeline:
    def __init__(self, models_dir: Path):
        self.validator = DataValidator()
        self.noise_filter = NoiseFilter(ema_alpha=0.35, window_size=5)
        self.outlier_detector = OutlierDetector(window_size=15, z_threshold=3.0, iqr_multiplier=1.5)
        self.missing_handler = MissingValueHandler(max_consecutive_missing=5)
        self.feature_engineer = FeatureEngineer(baseline_cycles=5)
        self.model_transformer = ModelTransformer(models_dir=models_dir)

        # Performance & Telemetry Accounting (Session-specific)
        self.total_raw_readings = 0
        self.valid_readings = 0
        self.rejected_readings = 0
        self.noise_filtered_readings = 0
        self.packets_with_outliers = 0
        self.outliers_detected = 0
        self.packets_with_imputation = 0
        self.missing_values_handled = 0
        self.transformed_vectors = 0
        self.total_latency_ms = 0.0

    def process(self, packet: TelemetryPacket) -> CleanedTelemetryFrame:
        t_start = time.perf_counter()
        self.total_raw_readings += 1

        machine_id = packet.machine_id
        cycle = packet.cycle
        timestamp = packet.timestamp
        subset = packet.subset or "FD001"
        raw_sensors = dict(packet.sensors)
        settings = dict(packet.operational_settings)

        stage_status = {
            "stage_1_validation": "PENDING",
            "stage_2_noise_reduction": "PENDING",
            "stage_3_outlier_detection": "PENDING",
            "stage_4_missing_imputation": "PENDING",
            "stage_5_feature_engineering": "PENDING"
        }

        # -------------------------------------------------------------
        # STAGE 1: RAW DATA VALIDATION
        # -------------------------------------------------------------
        val_res = self.validator.validate_packet(packet.model_dump())
        if not val_res.is_valid:
            stage_status["stage_1_validation"] = "REJECTED"
            self.rejected_readings += 1
            t_end = time.perf_counter()
            lat = (t_end - t_start) * 1000.0
            return CleanedTelemetryFrame(
                machine_id=machine_id,
                cycle=cycle,
                timestamp=timestamp,
                subset=subset,
                raw_sensors=raw_sensors,
                cleaned_sensors={},
                operational_settings=settings,
                comparison_table=[],
                quality_status=SensorReadingStatus.INVALID,
                stage_status=stage_status,
                outliers_detected={},
                imputed_fields={},
                latency_ms=lat,
                quarantined=True
            )
        else:
            stage_status["stage_1_validation"] = "PASSED"
            self.valid_readings += 1

        # -------------------------------------------------------------
        # STAGE 2: MISSING VALUE HANDLING
        # -------------------------------------------------------------
        miss_res = self.missing_handler.process(machine_id, val_res.cleaned_data)
        if miss_res.imputed_fields:
            self.packets_with_imputation += 1
            self.missing_values_handled += len(miss_res.imputed_fields)
            stage_status["stage_4_missing_imputation"] = "IMPUTED"
        else:
            stage_status["stage_4_missing_imputation"] = "NOMINAL"

        if miss_res.quarantined:
            self.rejected_readings += 1
            t_end = time.perf_counter()
            lat = (t_end - t_start) * 1000.0
            return CleanedTelemetryFrame(
                machine_id=machine_id,
                cycle=cycle,
                timestamp=timestamp,
                subset=subset,
                raw_sensors=raw_sensors,
                cleaned_sensors={},
                operational_settings=settings,
                comparison_table=[],
                quality_status=SensorReadingStatus.INVALID,
                stage_status=stage_status,
                outliers_detected={},
                imputed_fields=miss_res.imputed_fields,
                latency_ms=lat,
                quarantined=True
            )

        # -------------------------------------------------------------
        # STAGE 3: OUTLIER DETECTION & CORRECTION (IQR & Z-score)
        # -------------------------------------------------------------
        outlier_res = self.outlier_detector.process(machine_id, miss_res.sensors)
        if outlier_res.outliers_found:
            self.packets_with_outliers += 1
            self.outliers_detected += len(outlier_res.outliers_found)
            stage_status["stage_3_outlier_detection"] = "OUTLIER_CORRECTED"
        else:
            stage_status["stage_3_outlier_detection"] = "NOMINAL"

        # -------------------------------------------------------------
        # STAGE 4: NOISE REDUCTION (EMA Filter)
        # -------------------------------------------------------------
        smoothed_sensors = self.noise_filter.apply_filter(machine_id, outlier_res.cleaned_sensors)
        self.noise_filtered_readings += 1
        stage_status["stage_2_noise_reduction"] = "FILTERED_EMA"

        # -------------------------------------------------------------
        # STAGE 5: FEATURE ENGINEERING & TEMPORAL STATS
        # -------------------------------------------------------------
        self.feature_engineer.process(machine_id, cycle, settings, smoothed_sensors)
        self.model_transformer.append_sequence_observation(machine_id, cycle, settings, smoothed_sensors)
        self.transformed_vectors += 1
        stage_status["stage_5_feature_engineering"] = "COMPLETED"

        # -------------------------------------------------------------
        # STAGE 6: COMPARISON TABLE GENERATION (Raw vs Cleaned Inspector)
        # -------------------------------------------------------------
        comparison_table = []
        is_industrial = any(k in smoothed_sensors for k in INDUSTRIAL_SENSOR_SPECS.keys())
        target_specs = INDUSTRIAL_SENSOR_SPECS if is_industrial else CMAPSS_SENSOR_SPECS

        keys_to_show = list(target_specs.keys()) if is_industrial else sorted(CMAPSS_SENSOR_SPECS.keys(), key=lambda x: int(x.split('_')[1]))

        for s_key in keys_to_show:
            spec = target_specs[s_key]
            r_val = raw_sensors.get(s_key)
            c_val = smoothed_sensors.get(s_key)

            is_outlier = s_key in outlier_res.outliers_found
            is_imputed = s_key in miss_res.imputed_fields

            if is_outlier:
                param_status = "Outlier Corrected"
                action = f"Clamped ({outlier_res.outliers_found[s_key].get('reason', '')})"
            elif is_imputed:
                param_status = "Value Imputed"
                action = f"Forward Fill (Gap: {miss_res.imputed_fields[s_key].get('consecutive_drops', 1)})"
            elif r_val is not None and c_val is not None and abs(r_val - c_val) > 0.01:
                param_status = "Noise Filtered"
                action = "EMA Attenuated"
            else:
                param_status = "Valid"
                action = "Preserved"

            comparison_table.append({
                "sensor_key": s_key,
                "name": spec["name"],
                "description": spec.get("description", spec["name"]),
                "unit": spec["unit"],
                "raw_value": r_val,
                "cleaned_value": c_val,
                "diff": round(c_val - r_val, 4) if (r_val is not None and c_val is not None) else 0.0,
                "status": param_status,
                "action": action,
                "is_outlier": is_outlier,
                "is_imputed": is_imputed,
                "informative": spec.get("informative_fd001", True)
            })

        t_end = time.perf_counter()
        lat_ms = (t_end - t_start) * 1000.0
        self.total_latency_ms += lat_ms

        quality_status = SensorReadingStatus.VALID
        if outlier_res.outliers_found:
            quality_status = SensorReadingStatus.OUTLIER_DETECTED
        elif miss_res.imputed_fields:
            quality_status = SensorReadingStatus.MISSING_VALUE

        return CleanedTelemetryFrame(
            machine_id=machine_id,
            cycle=cycle,
            timestamp=timestamp,
            subset=subset,
            raw_sensors=raw_sensors,
            cleaned_sensors=smoothed_sensors,
            operational_settings=settings,
            comparison_table=comparison_table,
            quality_status=quality_status,
            stage_status=stage_status,
            outliers_detected=outlier_res.outliers_found,
            imputed_fields=miss_res.imputed_fields,
            latency_ms=lat_ms,
            quarantined=False
        )

    def get_metrics(self) -> PipelineMetrics:
        succ_rate = 100.0
        if self.total_raw_readings > 0:
            succ_rate = round(
                float((self.total_raw_readings - self.rejected_readings) / self.total_raw_readings) * 100.0,
                2
            )
        avg_lat = 0.0
        if self.total_raw_readings > 0:
            avg_lat = round(float(self.total_latency_ms / self.total_raw_readings), 2)

        return PipelineMetrics(
            total_raw_readings=self.total_raw_readings,
            valid_readings=self.valid_readings,
            rejected_readings=self.rejected_readings,
            noise_filtered_readings=self.noise_filtered_readings,
            outliers_detected=self.packets_with_outliers,
            missing_values_handled=self.packets_with_imputation,
            transformed_vectors=self.transformed_vectors,
            total_sensor_spikes_corrected=self.outliers_detected,
            total_sensor_gaps_imputed=self.missing_values_handled,
            cleaning_success_rate=succ_rate,
            average_latency_ms=avg_lat
        )

    def reset_all(self):
        self.total_raw_readings = 0
        self.valid_readings = 0
        self.rejected_readings = 0
        self.noise_filtered_readings = 0
        self.packets_with_outliers = 0
        self.outliers_detected = 0
        self.packets_with_imputation = 0
        self.missing_values_handled = 0
        self.transformed_vectors = 0
        self.total_latency_ms = 0.0

    def reset_machine(self, machine_id: str):
        self.noise_filter.reset_machine(machine_id)
        self.outlier_detector.reset_machine(machine_id)
        self.missing_handler.reset_machine(machine_id)
        self.feature_engineer.reset_machine(machine_id)
        self.model_transformer.reset_machine(machine_id)
