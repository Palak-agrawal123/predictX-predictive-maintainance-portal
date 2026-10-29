@echo off
echo ============================================================
echo   Starting Predictive Maintenance FastAPI ML Microservice
echo   Port: 8000 | XGBoost RUL Regressor & Risk Classifier
echo ============================================================
echo.
cd /d "%~dp0"
python server.py
pause
