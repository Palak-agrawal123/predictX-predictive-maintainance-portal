@echo off
title Predictive Maintenance Portal - Service Launcher
echo =====================================================================
echo   Predictive Maintenance Portal: Launching Full Stack Services
echo =====================================================================
echo.

echo [1/4] Launching MongoDB (Port 27017)...
start "MongoDB Service" cmd /k "title MongoDB (27017) && color 0A && \"C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe\" --dbpath \"%USERPROFILE%\data\db\" --setParameter diagnosticDataCollectionEnabled=false"

timeout /t 2 /nobreak >nul

echo [2/4] Launching FastAPI ML Microservice (Port 8000)...
start "FastAPI ML Microservice" cmd /k "title ML Microservice (8000) && color 0B && python ml_service\server.py"

timeout /t 2 /nobreak >nul

echo [3/4] Launching Node.js Express Backend (Port 5000)...
start "Backend Express API" cmd /k "title Backend API (5000) && color 0E && cd backend && npm run dev"

timeout /t 2 /nobreak >nul

echo [4/4] Launching React Vite Frontend (Port 5173)...
start "Frontend Vite Portal" cmd /k "title Frontend Portal (5173) && color 0D && cd frontend && npm run dev"

echo.
echo =====================================================================
echo   All 4 services launched successfully!
echo   Frontend URL: http://localhost:5173
echo   Backend URL:  http://localhost:5000
echo   ML API Docs:  http://127.0.0.1:8000/docs
echo =====================================================================
pause
