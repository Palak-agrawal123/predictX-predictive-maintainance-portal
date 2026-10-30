"""
PredictX Full-Stack Unified Process Manager.
Launches and monitors all 4 microservices:
  1. Python ML Service (:8000)
  2. Python RAG Service (:8001)
  3. Express Node.js Backend (:5000)
  4. React Vite Frontend (:5173)
"""
import os
import sys
import time
import signal
import webbrowser
import subprocess
import threading
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent

SERVICES = [
    {
        "name": "ML Service",
        "port": 8000,
        "health_url": "http://127.0.0.1:8000/docs",
        "cwd": ROOT / "ml_service",
        "command": [sys.executable, "server.py"],
        "color": "\033[94m" # Blue
    },
    {
        "name": "RAG Service",
        "port": 8001,
        "health_url": "http://127.0.0.1:8001/health",
        "cwd": ROOT / "rag_service",
        "command": [sys.executable, "server.py"],
        "color": "\033[92m" # Green
    },
    {
        "name": "Express API",
        "port": 5000,
        "health_url": "http://127.0.0.1:5000/api/health",
        "cwd": ROOT / "backend",
        "command": ["node", "src/server.js"],
        "color": "\033[93m" # Yellow
    },
    {
        "name": "React Frontend",
        "port": 5173,
        "health_url": "http://localhost:5173",
        "cwd": ROOT / "frontend",
        "command": ["cmd.exe", "/c", "npm", "run", "dev"],
        "color": "\033[95m" # Magenta
    }
]

RESET_COLOR = "\033[0m"

running_processes = []

def stream_logs(pipe, prefix, color):
    try:
        for line in iter(pipe.readline, ''):
            if not line:
                break
            clean_line = line.rstrip()
            if clean_line:
                print(f"{color}[{prefix}]{RESET_COLOR} {clean_line}", flush=True)
    except Exception:
        pass

def wait_for_service(name, url, timeout=15):
    start = time.time()
    while time.time() - start < timeout:
        try:
            req = urllib.request.urlopen(url, timeout=2)
            if req.status in [200, 304]:
                return True
        except Exception:
            pass
        time.sleep(0.5)
    return False

def shutdown_all():
    print(f"\n{RESET_COLOR}Shutting down PredictX microservices...")
    for proc, name in running_processes:
        try:
            print(f"Stopping {name} (PID: {proc.pid})...")
            proc.terminate()
        except Exception:
            pass
    time.sleep(1)
    for proc, name in running_processes:
        try:
            if proc.poll() is None:
                proc.kill()
        except Exception:
            pass
    print("All services stopped.")

def main():
    print("=" * 65)
    print("   PREDICTX INDUSTRIAL PREDICTIVE MAINTENANCE PORTAL")
    print("   Full Stack Orchestrator & Live Service Manager")
    print("=" * 65)
    
    # Optional: Attempt starting MongoDB service if configured
    try:
        subprocess.run(["net", "start", "MongoDB"], capture_output=True, text=True, check=False)
    except Exception:
        pass

    threads = []
    
    for s in SERVICES:
        print(f"\n--> Starting {s['name']} on port {s['port']}...")
        env = os.environ.copy()
        env["PYTHONUNBUFFERED"] = "1"
        
        proc = subprocess.Popen(
            s["command"],
            cwd=str(s["cwd"]),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            env=env
        )
        running_processes.append((proc, s["name"]))
        
        t = threading.Thread(
            target=stream_logs,
            args=(proc.stdout, s["name"], s["color"]),
            daemon=True
        )
        t.start()
        threads.append(t)
        time.sleep(0.8)

    print("\n" + "=" * 65)
    print("Checking health endpoints across all 4 services...")
    for s in SERVICES:
        ok = wait_for_service(s["name"], s["health_url"], timeout=10)
        status = "[ONLINE]" if ok else "[STARTING]"
        print(f"  {status:12} {s['name']:16} -> {s['health_url']}")
    print("=" * 65)

    print("\nPredictX is running!")
    print("  Portal URL:    http://localhost:5173")
    print("  AI Copilot:    http://localhost:5173/ai-assistant")
    print("  Backend API:   http://localhost:5000/api/health")
    print("  ML Service:    http://localhost:8000/docs")
    print("  RAG Service:   http://localhost:8001/docs")
    print("\nPress Ctrl+C to terminate all services.\n")

    try:
        webbrowser.open("http://localhost:5173")
    except Exception:
        pass

    try:
        while True:
            time.sleep(1)
            # Check if any process terminated unexpectedly
            for proc, name in running_processes:
                ret = proc.poll()
                if ret is not None:
                    print(f"\n[Warning] {name} terminated with exit code {ret}")
    except KeyboardInterrupt:
        shutdown_all()

if __name__ == "__main__":
    signal.signal(signal.SIGINT, lambda s, f: sys.exit(0))
    try:
        main()
    finally:
        shutdown_all()
