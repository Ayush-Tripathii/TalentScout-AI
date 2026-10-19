@echo off
title TalentScout AI Desktop
cd /d "%~dp0"
if exist ".venv\Scripts\pythonw.exe" (
    start "" ".venv\Scripts\pythonw.exe" desktop_app.py
) else if exist ".venv\Scripts\python.exe" (
    start "" ".venv\Scripts\python.exe" desktop_app.py
) else (
    echo [ERROR] Virtual environment not found. Please ensure .venv is present.
    pause
)
