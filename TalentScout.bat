@echo off
title TalentScout AI Desktop
cd /d "%~dp0"
if exist "runtime\pythonw.exe" (
    start "" "runtime\pythonw.exe" desktop_app.py
) else if exist "runtime\python.exe" (
    start "" "runtime\python.exe" desktop_app.py
) else if exist ".venv\Scripts\pythonw.exe" (
    start "" ".venv\Scripts\pythonw.exe" desktop_app.py
) else if exist ".venv\Scripts\python.exe" (
    start "" ".venv\Scripts\python.exe" desktop_app.py
) else (
    echo [ERROR] Python runtime not found. Please ensure runtime folder is present.
    pause
)
