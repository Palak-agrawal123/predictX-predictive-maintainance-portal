@echo off
title Predictive Maintenance Portal - Full Stack Service Launcher
echo =====================================================================
echo   Predictive Maintenance Portal: Launching Full Stack Services
echo =====================================================================
echo.

echo [1/5] Checking/Launching MongoDB Service (Port 27017)...
net start MongoDB >nul 2>&1
if %errorlevel% neq 0 (
    start "MongoDB Service" cmd /k "title MongoDB (27017) && color 0A && \"C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe\" --dbpath \"%USERPROFILE%\data\db\" --setParameter diagnosticDataCollectionEnabled=false"
)

ping 127.0.0.1 -n 3 >nul

echo [2/5] Launching Python ML Microservice (Port 8000)...
start "FastAPI ML Microservice" cmd /k "title ML Microservice (8000) && color 0B && cd /d %~dp0ml_service && python server.py"

ping 127.0.0.1 -n 2 >nul

echo [3/5] Launching Python RAG Microservice (Port 8001)...
start "FastAPI RAG Microservice" cmd /k "title RAG Microservice (8001) && color 0A && cd /d %~dp0rag_service && python server.py"

ping 127.0.0.1 -n 2 >nul

echo [4/5] Launching Node.js Express Backend (Port 5000)...
start "Backend Express API" cmd /k "title Backend API (5000) && color 0E && cd /d %~dp0backend && npm run dev"

ping 127.0.0.1 -n 2 >nul

echo [5/5] Launching React Vite Frontend Portal (Port 5173)...
start "Frontend Vite Portal" cmd /k "title Frontend Portal (5173) && color 0D && cd /d %~dp0frontend && npm run dev"

echo.
echo =====================================================================
echo   All 5 services launched successfully in dedicated terminal windows!
echo   * Frontend Portal:   http://localhost:5173
echo   * AI Copilot:        http://localhost:5173/ai-assistant
echo   * Backend API:       http://localhost:5000
echo   * ML API Docs:       http://127.0.0.1:8000/docs
echo   * RAG API Docs:      http://127.0.0.1:8001/docs
echo =====================================================================
echo.
echo Opening PredictX Dashboard in default browser...
ping 127.0.0.1 -n 4 >nul
start http://localhost:5173
pause
