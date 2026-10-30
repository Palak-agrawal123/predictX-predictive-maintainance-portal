# PredictX - Stop All Full Stack Services
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host "  Predictive Maintenance Portal: Shutting Down All Services" -ForegroundColor Cyan
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host ""

$ports = 5173, 5000, 8000, 8001
$killed = 0

foreach ($p in $ports) {
    $conns = Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue
    if ($conns) {
        $pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique | Where-Object { $_ -gt 0 }
        foreach ($id in $pids) {
            try {
                $proc = Get-Process -Id $id -ErrorAction SilentlyContinue
                $procName = if ($proc) { $proc.ProcessName } else { "Unknown" }
                Write-Host "[x] Freeing port $p : Killing $procName (PID $id)..." -ForegroundColor Yellow
                Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
                $killed++
            } catch {}
        }
    }
}

if ($killed -eq 0) {
    Write-Host "All ports (5173, 5000, 8000, 8001) are already completely free." -ForegroundColor Green
} else {
    Write-Host "`nSuccessfully terminated $killed service process(es). All ports are now free!" -ForegroundColor Green
}

Write-Host "=====================================================================" -ForegroundColor Cyan
