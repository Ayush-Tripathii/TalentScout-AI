@echo off
title TalentScout Autonomous Recruiter AI Launcher
color 0A
echo ===============================================================================
echo                TALENTSCOUT - AUTONOMOUS RECRUITMENT ENGINE
echo                Compliance, Sourcing, Enrichment & Operations
echo ===============================================================================
echo.

cd /d "%~dp0"

:: 1. Check Python Virtual Environment
if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] Virtual environment (.venv) not found!
    echo Please create it first: python -m venv .venv
    pause
    exit /b 1
)

:: 2. Check Frontend node_modules
if not exist "frontend\node_modules" (
    echo [INFO] Installing frontend dependencies...
    cd frontend
    call npm install
    cd ..
)

echo [1/3] Starting FastAPI Backend on http://127.0.0.1:8000 ...
start "TalentScout Backend" cmd.exe /k "cd /d ""%~dp0"" && .venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

timeout /t 2 >nul

echo [2/3] Starting Vite Frontend on http://127.0.0.1:5173 ...
start "TalentScout Frontend" cmd.exe /k "cd /d ""%~dp0frontend"" && npm run dev -- --host 127.0.0.1 --port 5173"

timeout /t 3 >nul

echo [3/3] Launching Web Application in default browser...
start http://127.0.0.1:5173/

echo.
echo ===============================================================================
echo  TalentScout is now active!
echo  - Frontend Web UI:    http://127.0.0.1:5173/
echo  - Backend API Docs:    http://127.0.0.1:8000/docs
echo  - Retention & Audit:  http://127.0.0.1:8000/api/compliance/retention-status
echo ===============================================================================
echo.
echo Press any key to stop all TalentScout processes...
pause >nul

echo Shutting down services...
taskkill /fi "WINDOWTITLE eq TalentScout Backend*" /f >nul 2>&1
taskkill /fi "WINDOWTITLE eq TalentScout Frontend*" /f >nul 2>&1
echo Done.
