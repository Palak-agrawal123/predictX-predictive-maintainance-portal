@echo off
title PredictX Full Stack Orchestrator
echo ========================================================
echo Launching PredictX - Industrial Predictive Maintenance Portal
echo ========================================================
echo.

echo 0. Checking/Starting MongoDB Service...
net start MongoDB >nul 2>&1

echo 1. Launching Python ML Microservice (FastAPI on Port 8000)...
start "PredictX ML Microservice (:8000)" cmd /k "cd /d %~dp0ml_service && python server.py"

echo 2. Launching Python RAG Microservice (FastAPI on Port 8001)...
start "PredictX RAG Microservice (:8001)" cmd /k "cd /d %~dp0rag_service && python server.py"

echo 3. Launching Node.js Express Backend (Port 5000)...
start "PredictX Express Backend (:5000)" cmd /k "cd /d %~dp0backend && npm run dev"

echo 4. Launching React Vite Frontend Portal (Port 5173)...
start "PredictX React Frontend (:5173)" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ========================================================
echo All services launched in dedicated terminal windows:
echo  * Frontend Portal:   http://localhost:5173
echo  * Backend API:       http://localhost:5000
echo  * ML Prediction API: http://localhost:8000
echo  * RAG Assistant API: http://localhost:8001
echo  * RAG Swagger Docs:  http://localhost:8001/docs
echo ========================================================
echo.
echo Opening PredictX Dashboard in default browser...
ping 127.0.0.1 -n 4 >nul
start http://localhost:5173
