"""
Integration test for FastAPI simulation dataset endpoints
"""
import sys
from pathlib import Path
from fastapi.testclient import TestClient

CURRENT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(CURRENT_DIR))

from server import app

client = TestClient(app)

def test_dataset_endpoints():
    # 1. List datasets
    res = client.get("/api/simulation/datasets")
    assert res.status_code == 200
    json_data = res.json()
    assert json_data["success"] is True
    assert json_data["count"] >= 2
    print("[Test 1 Passed] /api/simulation/datasets returned", json_data["count"], "datasets.")

    # 2. Inspect FD001
    res2 = client.get("/api/simulation/datasets/cmapss_val_full_FD001")
    assert res2.status_code == 200
    d2 = res2.json()
    assert d2["success"] is True
    assert d2["inspection"]["total_rows"] > 1000
    assert d2["inspection"]["compatibility"]["is_compatible"] is True
    print("[Test 2 Passed] /api/simulation/datasets/cmapss_val_full_FD001 inspection valid. Compatible:", d2["inspection"]["compatibility"]["matched_subset"])

    # 3. Preview first 5 rows
    res3 = client.get("/api/simulation/datasets/cmapss_val_full_FD001/preview?limit=5")
    assert res3.status_code == 200
    d3 = res3.json()
    assert len(d3["records"]) == 5
    assert "unit_id" in d3["columns"]
    print("[Test 3 Passed] /api/simulation/datasets/cmapss_val_full_FD001/preview returned 5 records.")

    # 4. Configure dataset replay
    res4 = client.post("/api/simulation/datasets/cmapss_val_full_FD001/configure", json={
        "dataset_id": "cmapss_val_full_FD001",
        "machine_id": "1",
        "is_looping": True
    })
    assert res4.status_code == 200
    d4 = res4.json()
    assert d4["success"] is True
    print("[Test 4 Passed] Dataset replay configured for Machine 1.")

if __name__ == "__main__":
    test_dataset_endpoints()
    print("\nAll FastAPI Dataset Endpoints Verified Successfully!")
