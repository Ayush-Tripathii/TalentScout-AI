@echo off
title TalentScout Desktop Shortcut Creator
color 0B
echo ===============================================================================
echo            TALENTSCOUT AI - DESKTOP SHORTCUT INSTALLER
echo ===============================================================================
echo.

cd /d "%~dp0"
set "APP_DIR=%~dp0"
if "%APP_DIR:~-1%"=="\" set "APP_DIR=%APP_DIR:~0,-1%"

:: 1. Check if running from inside a zip or temporary folder
echo %APP_DIR% | findstr /i "\\AppData\\Local\\Temp \\Temp" >nul
if %errorlevel% == 0 (
    color 0C
    echo [ERROR] YOU ARE RUNNING FROM INSIDE A ZIP FILE WITHOUT EXTRACTING!
    echo.
    echo Please EXTRACT (Unzip) the zip package first:
    echo  1. Close this window.
    echo  2. Right-click 'TalentScout-Desktop-App.zip'
    echo  3. Click 'Extract All...' and choose a folder (e.g. Desktop or C:\)
    echo  4. Open the extracted folder and run this script again.
    echo.
    echo ===============================================================================
    pause
    exit /b 1
)

:: 2. Locate portable Python runtime
set "PYTHON_EXE="
if exist "%APP_DIR%\runtime\pythonw.exe" (
    set "PYTHON_EXE=%APP_DIR%\runtime\pythonw.exe"
) else if exist "%APP_DIR%\runtime\python.exe" (
    set "PYTHON_EXE=%APP_DIR%\runtime\python.exe"
) else if exist "%APP_DIR%\.venv\Scripts\pythonw.exe" (
    set "PYTHON_EXE=%APP_DIR%\.venv\Scripts\pythonw.exe"
) else if exist "%APP_DIR%\.venv\Scripts\python.exe" (
    set "PYTHON_EXE=%APP_DIR%\.venv\Scripts\python.exe"
)

if "%PYTHON_EXE%"=="" (
    color 0C
    echo [ERROR] Python runtime was not found in:
    echo   "%APP_DIR%\runtime\"
    echo.
    echo Please make sure the entire zip file was extracted and the 'runtime'
    echo folder is present alongside this script.
    echo.
    echo ===============================================================================
    pause
    exit /b 1
)

set "SCRIPT_PATH=%APP_DIR%\desktop_app.py"
set "ICON_PATH=%APP_DIR%\talentscout.ico"

echo [1/2] Creating Desktop Shortcut pointing to:
echo       %PYTHON_EXE%
echo.

powershell -NoProfile -Command ^
    "$wsh = New-Object -ComObject WScript.Shell; " ^
    "$desktop = [Environment]::GetFolderPath('Desktop'); " ^
    "$shortcutPath = Join-Path $desktop 'TalentScout AI.lnk'; " ^
    "if (Test-Path $shortcutPath) { Remove-Item -Force $shortcutPath }; " ^
    "$shortcut = $wsh.CreateShortcut($shortcutPath); " ^
    "$shortcut.TargetPath = '%PYTHON_EXE%'; " ^
    "$shortcut.Arguments = [char]34 + '%SCRIPT_PATH%' + [char]34; " ^
    "$shortcut.WorkingDirectory = '%APP_DIR%'; " ^
    "if (Test-Path '%ICON_PATH%') { $shortcut.IconLocation = '%ICON_PATH%,0' }; " ^
    "$shortcut.Description = 'TalentScout AI - Autonomous Recruiter Engine'; " ^
    "$shortcut.Save(); " ^
    "Write-Host '[SUCCESS] Desktop shortcut created at:' $shortcutPath -ForegroundColor Green"

echo.
echo [2/2] Done! Shortcut has been successfully created/updated on your Desktop.
echo ===============================================================================
echo.
set /p "LAUNCH=Start TalentScout AI now? [Y/n]: "
if /i "%LAUNCH%"=="" set "LAUNCH=Y"
if /i "%LAUNCH%"=="Y" (
    echo Launching TalentScout AI...
    start "" "%PYTHON_EXE%" "%SCRIPT_PATH%"
)
