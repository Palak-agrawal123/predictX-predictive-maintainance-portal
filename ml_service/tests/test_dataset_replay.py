"""
Unit test for Dataset-Driven Live Replay Engine & Schema Analyzer
"""
import sys
import unittest
from pathlib import Path

CURRENT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(CURRENT_DIR))

from simulator.dataset_parser import ensure_manifest_exists, DatasetAnalyzer, DATASETS_DIR
from simulator.dataset_replay_engine import dataset_replay_engine
from simulator.simulation_manager import simulation_manager
from simulator.schemas import SimulationManagerConfig


class TestDatasetReplayEngine(unittest.TestCase):

    def setUp(self):
        self.manifest = ensure_manifest_exists()
        self.datasets = self.manifest.get("datasets", {})

    def test_manifest_discovery(self):
        self.assertIn("cmapss_val_full_FD001", self.datasets)
        self.assertIn("cmapss_val_full_FD002", self.datasets)

    def test_dataset_inspection(self):
        fd1_path = Path(self.datasets["cmapss_val_full_FD001"]["path"])
        self.assertTrue(fd1_path.exists())

        inspection = DatasetAnalyzer.inspect_file(fd1_path)
        self.assertGreater(inspection["total_rows"], 1000)
        self.assertIn("unit_id", inspection["columns"])
        self.assertIn("s_4", inspection["columns"])
        self.assertIn("target_rul", inspection["columns"])

        # Role candidates
        roles = inspection["role_candidates"]
        self.assertEqual(roles["machine_id"], "unit_id")
        self.assertEqual(roles["cycle"], "cycle")
        self.assertGreaterEqual(len(roles["sensors"]), 21)

        # Model compatibility check
        compat = inspection["compatibility"]
        self.assertTrue(compat["is_compatible"])
        self.assertEqual(compat["matched_subset"], "FD001")
        self.assertEqual(compat["status_code"], "COMPATIBLE_FD001")

    def test_dataset_replay_step(self):
        status = dataset_replay_engine.load_dataset(
            dataset_id="cmapss_val_full_FD001",
            machine_id="1",
            is_looping=True
        )
        self.assertEqual(status["dataset_id"], "cmapss_val_full_FD001")
        self.assertGreater(dataset_replay_engine.total_records, 30)

        # Step 1
        res1 = dataset_replay_engine.step()
        self.assertIsNotNone(res1)
        pkt1, gt1 = res1
        self.assertEqual(pkt1.cycle, 1)
        self.assertIsNotNone(gt1)
        self.assertAlmostEqual(gt1, 125.0)  # C-MAPSS FD001 capped RUL is 125
        self.assertIn("s_4", pkt1.sensor_readings)
        self.assertAlmostEqual(pkt1.sensor_readings["s_4"], 1400.6, places=1)

        # Step 2
        res2 = dataset_replay_engine.step()
        self.assertIsNotNone(res2)
        pkt2, gt2 = res2
        self.assertEqual(pkt2.cycle, 2)
        self.assertAlmostEqual(pkt2.sensor_readings["s_4"], 1403.14, places=1)

    def test_simulation_manager_dataset_tick(self):
        cfg = SimulationManagerConfig(
            simulation_source="dataset",
            dataset_id="cmapss_val_full_FD001",
            selected_machine_id="1",
            speed_multiplier=5.0,
            auto_predict=True
        )
        # Configure without starting background thread
        simulation_manager.load_dataset("cmapss_val_full_FD001", machine_id="1", is_looping=True)

        step_res = simulation_manager.replay_engine.step()
        self.assertIsNotNone(step_res)
        pkt, gt_rul = step_res

        out = simulation_manager._process_single_packet(pkt, ground_truth_rul=gt_rul)
        self.assertEqual(out["type"], "telemetry_tick")
        self.assertEqual(out["simulation_source"], "dataset")
        self.assertIn("raw_sensors", out)
        self.assertIn("cleaned_sensors", out)
        self.assertIn("prediction", out)
        self.assertIsNotNone(out["ground_truth_rul"])
        self.assertIsNotNone(out["prediction_error"])
        print("\n[Test Success] Dataset tick processed: Cycle #", out["cycle"], "Predicted RUL:", out["prediction"]["predictedRUL"], "Actual RUL:", out["ground_truth_rul"], "Error:", out["prediction_error"])


if __name__ == "__main__":
    unittest.main()
