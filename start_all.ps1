# PredictX Full Stack Orchestrator (PowerShell)
$root = $PSScriptRoot

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Launching PredictX - Industrial Predictive Maintenance Portal" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# 0. Start MongoDB if installed and stopped
Write-Host "`n[0/4] Checking MongoDB service..." -ForegroundColor Yellow
try {
    Start-Service MongoDB -ErrorAction SilentlyContinue
} catch {}

# 1. Start Python ML Microservice
Write-Host "[1/4] Launching ML Microservice (:8000)..." -ForegroundColor Green
Start-Process cmd.exe -ArgumentList "/k", "cd /d `"$root\ml_service`" && python server.py"

# 2. Start Python RAG Microservice
Write-Host "[2/4] Launching RAG Microservice (:8001)..." -ForegroundColor Green
Start-Process cmd.exe -ArgumentList "/k", "cd /d `"$root\rag_service`" && python server.py"

# 3. Start Node.js Express Backend
Write-Host "[3/4] Launching Express Backend (:5000)..." -ForegroundColor Green
Start-Process cmd.exe -ArgumentList "/k", "cd /d `"$root\backend`" && npm run dev"

# 4. Start React Vite Frontend
Write-Host "[4/4] Launching React Vite Frontend (:5173)..." -ForegroundColor Green
Start-Process cmd.exe -ArgumentList "/k", "cd /d `"$root\frontend`" && npm run dev"

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "All 4 microservices launched in separate interactive windows:" -ForegroundColor Cyan
Write-Host " - Frontend Portal:   http://localhost:5173" -ForegroundColor White
Write-Host " - Express Backend:   http://localhost:5000" -ForegroundColor White
Write-Host " - ML Prediction:     http://localhost:8000" -ForegroundColor White
Write-Host " - RAG Service:       http://localhost:8001" -ForegroundColor White
Write-Host " - RAG Swagger API:   http://localhost:8001/docs" -ForegroundColor White
Write-Host "========================================================`n" -ForegroundColor Cyan

Start-Sleep -Seconds 3
Start-Process "http://localhost:5173"
