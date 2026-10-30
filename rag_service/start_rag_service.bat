@echo off
title PredictX RAG Microservice (Port 8001)
echo ===================================================
echo Starting PredictX RAG FastAPI Microservice on Port 8001...
echo ===================================================
cd /d "%~dp0"
python server.py
pause
