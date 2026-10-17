# TalentScout Autonomous Recruiter AI Launcher (PowerShell)
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host "               TALENTSCOUT - AUTONOMOUS RECRUITMENT ENGINE                     " -ForegroundColor Green
Write-Host "               Compliance, Sourcing, Enrichment & Operations                   " -ForegroundColor Cyan
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host ""

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# 1. Check Python Venv
$PythonExe = Join-Path $ScriptDir ".venv\Scripts\python.exe"
if (-not (Test-Path $PythonExe)) {
    Write-Host "[ERROR] Virtual environment not found at $PythonExe" -ForegroundColor Red
    Write-Host "Please run: python -m venv .venv; .venv\Scripts\pip install -r requirements.txt" -ForegroundColor Yellow
    exit 1
}

# 2. Check Node modules
$NodeModules = Join-Path $ScriptDir "frontend\node_modules"
if (-not (Test-Path $NodeModules)) {
    Write-Host "[INFO] Installing frontend dependencies..." -ForegroundColor Yellow
    Set-Location (Join-Path $ScriptDir "frontend")
    npm install
    Set-Location $ScriptDir
}

# 3. Launch Backend
Write-Host "[1/3] Starting FastAPI Backend on http://127.0.0.1:8000..." -ForegroundColor Green
$BackendProc = Start-Process -FilePath "cmd.exe" -ArgumentList "/k cd /d `"$ScriptDir`" && .venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload" -PassThru

Start-Sleep -Seconds 2

# 4. Launch Frontend
Write-Host "[2/3] Starting Vite Frontend on http://127.0.0.1:5173..." -ForegroundColor Green
$FrontendProc = Start-Process -FilePath "cmd.exe" -ArgumentList "/k cd /d `"$ScriptDir\frontend`" && npm run dev -- --host 127.0.0.1 --port 5173" -PassThru

Start-Sleep -Seconds 3

# 5. Open Browser
Write-Host "[3/3] Opening Browser..." -ForegroundColor Green
Start-Process "http://127.0.0.1:5173/"

Write-Host ""
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host " TalentScout is now active!" -ForegroundColor Green
Write-Host " - Frontend Web UI:    http://127.0.0.1:5173/" -ForegroundColor White
Write-Host " - Backend API Docs:   http://127.0.0.1:8000/docs" -ForegroundColor White
Write-Host " - Retention & Audit: http://127.0.0.1:8000/api/compliance/retention-status" -ForegroundColor White
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host ""
Read-Host "Press ENTER to terminate TalentScout services"

Stop-Process -Id $BackendProc.Id -Force -ErrorAction SilentlyContinue
Stop-Process -Id $FrontendProc.Id -Force -ErrorAction SilentlyContinue
Write-Host "Services stopped cleanly." -ForegroundColor Yellow
