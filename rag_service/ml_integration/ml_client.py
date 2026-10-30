"""
ML Integration Client for PredictX RAG Service.
Fetches real-time machine telemetry and predictions from the active ML Microservice
and Node.js Express backend.
"""
from typing import Dict, Any, Optional
import httpx

from config import settings

class MLServiceClient:
    def __init__(self):
        self.ml_url = settings.ML_SERVICE_URL.rstrip("/")
        self.backend_url = settings.BACKEND_URL.rstrip("/")
        self.timeout = 3.5  # seconds

    async def get_machine_telemetry(self, machine_id: str) -> Optional[Dict[str, Any]]:
        """
        Attempts to fetch live machine details from the Node.js Express backend.
        """
        clean_id = machine_id.strip().upper()
        url = f"{self.backend_url}/api/machines/{clean_id}"
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(url)
                if resp.status_code == 200:
                    data = resp.json()
                    return data.get("data")
        except Exception as e:
            # Backend might be offline or running in mock mode
            print(f"[MLClient Note] Backend unavailable at {url} ({e}); using synthetic/default context.")
        
        return None

    async def get_live_prediction(
        self,
        machine_id: str,
        sensors: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Requests inference from the active FastAPI ML service at :8000.
        Falls back gracefully if the ML service is offline.
        """
        clean_id = machine_id.strip().upper()
        sensor_data = sensors or {}
        meta_data = metadata or {}

        payload = {
            "machine_id": clean_id,
            "sensors": sensor_data,
            "metadata": meta_data
        }

        url = f"{self.ml_url}/predict"
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.post(url, json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    return {
                        "online": True,
                        "data": data,
                        "source": "ml_service_fastapi"
                    }
                else:
                    return {
                        "online": False,
                        "reason": f"ML Service responded with HTTP {resp.status_code}",
                        "source": "unavailable"
                    }
        except Exception as e:
            return {
                "online": False,
                "reason": f"ML Service connection failed: {str(e)}",
                "source": "unavailable"
            }

    async def check_ml_health(self) -> Dict[str, Any]:
        """
        Checks health of the ML service.
        """
        url = f"{self.ml_url}/health"
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                resp = await client.get(url)
                if resp.status_code == 200:
                    return {"online": True, "details": resp.json()}
                return {"online": False, "status": resp.status_code}
        except Exception as e:
            return {"online": False, "error": str(e)}

# Global singleton
ml_client = MLServiceClient()
