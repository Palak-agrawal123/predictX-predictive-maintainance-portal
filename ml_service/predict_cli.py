"""
Predictive Maintenance CLI Inference Bridge
Allows the Node.js backend to invoke the real ML model directly via process execution
when the FastAPI HTTP microservice is not running.
Usage:
  python predict_cli.py '{"machine_id": "MCH-TUR-303", "sensors": {...}}'
"""
import sys
import json
from pathlib import Path

# Add current dir to path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from predictor import predictor

def main():
    try:
        if len(sys.argv) > 1:
            raw_input = sys.argv[1]
        else:
            raw_input = sys.stdin.read().strip()

        if not raw_input:
            print(json.dumps({"error": "Empty input payload"}))
            sys.exit(1)

        data = json.loads(raw_input)
        machine_id = data.get("machine_id") or data.get("machineId") or "MCH-UNKNOWN"
        sensors = data.get("sensors") or {}
        metadata = data.get("metadata") or {}

        result = predictor.predict(machine_id, sensors, metadata)
        print(json.dumps(result))
    except Exception as e:
        err_res = {
            "error": str(e),
            "success": False
        }
        print(json.dumps(err_res))
        sys.exit(1)

if __name__ == "__main__":
    main()
