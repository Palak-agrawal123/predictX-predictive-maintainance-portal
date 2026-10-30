@echo off
title PredictX - Stop All Services
echo =====================================================================
echo   Predictive Maintenance Portal: Shutting Down All Services
echo =====================================================================
echo.

powershell -NoProfile -Command ^
  "$ports = 5173, 5000, 8000, 8001; " ^
  "$killed = 0; " ^
  "foreach ($p in $ports) { " ^
  "  $pids = (Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue).OwningProcess | Where-Object { $_ -gt 0 } | Select-Object -Unique; " ^
  "  foreach ($id in $pids) { " ^
  "    Write-Host \"[x] Terminating process on Port $p (PID: $id)...\" -ForegroundColor Yellow; " ^
  "    Stop-Process -Id $id -Force -ErrorAction SilentlyContinue; " ^
  "    $killed++; " ^
  "  } " ^
  "} " ^
  "if ($killed -eq 0) { Write-Host 'No active processes found on service ports (Ports 5173, 5000, 8000, 8001 already free).' -ForegroundColor Green; } " ^
  "else { Write-Host \"Successfully closed $killed process(es). All ports are now free!\" -ForegroundColor Green; }"

echo.
echo =====================================================================
echo   All PredictX servers have been terminated cleanly.
echo =====================================================================
timeout /t 3 /nobreak >nul
