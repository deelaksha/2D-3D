# PowerShell script to launch both AI Backend and Frontend services
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   Starting AI Backend and Frontend Services     " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$BackendDir = Join-Path $ScriptDir "AI_MODEL\backend"
$FrontendDir = Join-Path $ScriptDir "AI_MODEL\frontend"

if (-not (Test-Path $FrontendDir)) {
    $FrontendDir = $ScriptDir
}

Write-Host "[LAUNCHER] Backend Directory  : $BackendDir" -ForegroundColor Gray
Write-Host "[LAUNCHER] Frontend Directory : $FrontendDir" -ForegroundColor Gray

Write-Host "[LAUNCHER] Launching AI Backend on http://localhost:8000 ..." -ForegroundColor Green
$backendJob = Start-Job -ScriptBlock {
    param($dir)
    Set-Location $dir
    python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
} -ArgumentList $BackendDir

Write-Host "[LAUNCHER] Launching Frontend Dev Server ..." -ForegroundColor Green
$frontendJob = Start-Job -ScriptBlock {
    param($dir)
    Set-Location $dir
    cmd /c npm run dev
} -ArgumentList $FrontendDir

Write-Host "`n[LAUNCHER] Services started in background jobs!" -ForegroundColor Yellow
Write-Host "[LAUNCHER] AI Backend API : http://localhost:8000 (Swagger docs: http://localhost:8000/docs)" -ForegroundColor Yellow
Write-Host "[LAUNCHER] Frontend App   : Check output logs below" -ForegroundColor Yellow
Write-Host "[LAUNCHER] Press Ctrl+C to terminate services cleanly.`n" -ForegroundColor White

try {
    while ($true) {
        Receive-Job -Job $backendJob -WarningAction SilentlyContinue | ForEach-Object { Write-Host "[AI-BACKEND] $_" -ForegroundColor DarkCyan }
        Receive-Job -Job $frontendJob -WarningAction SilentlyContinue | ForEach-Object { Write-Host "[FRONTEND] $_" -ForegroundColor DarkYellow }
        Start-Sleep -Milliseconds 500
    }
} finally {
    Write-Host "`n[LAUNCHER] Shutting down services..." -ForegroundColor Red
    Stop-Job -Job $backendJob, $frontendJob
    Remove-Job -Job $backendJob, $frontendJob
    Write-Host "[LAUNCHER] All services stopped." -ForegroundColor Red
}
