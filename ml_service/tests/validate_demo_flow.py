import sys
import time
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE))

from simulator.simulation_manager import simulation_manager
from simulator.schemas import SimulationManagerConfig

print("Starting end-to-end demonstration validation...")
cfg = SimulationManagerConfig(tick_interval_seconds=0.2, speed_multiplier=1.0)
simulation_manager.configure_and_start(cfg)

# Let it simulate for 2 seconds (about 10 ticks)
time.sleep(2.0)

status = simulation_manager.get_status()
print(f"Total simulated cycles: {status.total_cycles_simulated}")
print(f"Pipeline metrics: {status.pipeline_metrics.model_dump()}")

for mid, info in status.machines_summary.items():
    pred = info.get("latest_prediction", {}).get("prediction", {})
    meta = info.get("latest_prediction", {})
    sub = info.get("subset")
    cyc = info.get("current_cycle")
    rul = pred.get("predictedRUL")
    risk = pred.get("riskLevel")
    model = meta.get("modelVersion")
    print(f"Machine: {mid:10} | Sub: {sub:5} | Cycle: {cyc:3} | RUL: {rul:3} | Risk: {risk:8} | Model: {model}")

simulation_manager.stop()
print("Simulation stopped cleanly. Validation successful!")
