@echo off
title TalentScout Desktop Shortcut Creator
color 0B
echo ===============================================================================
echo            TALENTSCOUT AI - DESKTOP SHORTCUT INSTALLER
echo ===============================================================================
echo.

cd /d "%~dp0"
set "APP_DIR=%~dp0"
set "APP_DIR=%APP_DIR:~0,-1%"
set "PYTHONW_PATH=%APP_DIR%\runtime\pythonw.exe"
if not exist "%PYTHONW_PATH%" set "PYTHONW_PATH=%APP_DIR%\.venv\Scripts\pythonw.exe"
set "SCRIPT_PATH=%APP_DIR%\desktop_app.py"
set "ICON_PATH=%APP_DIR%\talentscout.ico"

echo [1/2] Creating Native Desktop Shortcut (100%% Portable Launcher)...

powershell -NoProfile -Command ^
    "$wsh = New-Object -ComObject WScript.Shell; " ^
    "$desktop = [Environment]::GetFolderPath('Desktop'); " ^
    "$shortcutPath = Join-Path $desktop 'TalentScout AI.lnk'; " ^
    "$shortcut = $wsh.CreateShortcut($shortcutPath); " ^
    "$shortcut.TargetPath = '%PYTHONW_PATH%'; " ^
    "$shortcut.Arguments = [char]34 + '%SCRIPT_PATH%' + [char]34; " ^
    "$shortcut.WorkingDirectory = '%APP_DIR%'; " ^
    "$shortcut.IconLocation = '%ICON_PATH%,0'; " ^
    "$shortcut.Description = 'TalentScout AI - Autonomous Recruiter Engine'; " ^
    "$shortcut.Save(); " ^
    "Write-Host '[SUCCESS] Shortcut updated at:' $shortcutPath -ForegroundColor Green"

echo.
echo [2/2] Done! You can now launch TalentScout AI directly from your Desktop.
echo ===============================================================================
echo.
pause
