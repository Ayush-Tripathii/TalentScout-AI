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

:: 2. Target the native executable
set "TARGET_EXE=%APP_DIR%\TalentScout.exe"
if not exist "%TARGET_EXE%" (
    if exist "%APP_DIR%\runtime\pythonw.exe" (
        set "TARGET_EXE=%APP_DIR%\runtime\pythonw.exe"
    ) else if exist "%APP_DIR%\runtime\python.exe" (
        set "TARGET_EXE=%APP_DIR%\runtime\python.exe"
    )
)

set "ICON_PATH=%APP_DIR%\talentscout.ico"

echo [1/2] Creating Native Desktop Shortcut...

powershell -NoProfile -Command ^
    "$wsh = New-Object -ComObject WScript.Shell; " ^
    "$desktop = [Environment]::GetFolderPath('Desktop'); " ^
    "$shortcutPath = Join-Path $desktop 'TalentScout AI.lnk'; " ^
    "if (Test-Path $shortcutPath) { Remove-Item -Force $shortcutPath }; " ^
    "$shortcut = $wsh.CreateShortcut($shortcutPath); " ^
    "$shortcut.TargetPath = '%TARGET_EXE%'; " ^
    "if ('%TARGET_EXE%' -match 'python') { $shortcut.Arguments = [char]34 + '%APP_DIR%\desktop_app.py' + [char]34 }; " ^
    "$shortcut.WorkingDirectory = '%APP_DIR%'; " ^
    "if (Test-Path '%ICON_PATH%') { $shortcut.IconLocation = '%ICON_PATH%,0' }; " ^
    "$shortcut.Description = 'TalentScout AI - Autonomous Recruiter Engine'; " ^
    "$shortcut.Save(); " ^
    "Write-Host '[SUCCESS] Desktop shortcut created at:' $shortcutPath -ForegroundColor Green"

:: Also update OneDrive Desktop if synced
powershell -NoProfile -Command ^
    "$wsh = New-Object -ComObject WScript.Shell; " ^
    "$paths = @( " ^
    "    ($env:OneDrive + '\Desktop'), " ^
    "    ($env:USERPROFILE + '\OneDrive\Desktop') " ^
    "); " ^
    "foreach ($d in $paths) { " ^
    "    if ($d -and (Test-Path $d)) { " ^
    "        $scPath = Join-Path $d 'TalentScout AI.lnk'; " ^
    "        $sc = $wsh.CreateShortcut($scPath); " ^
    "        $sc.TargetPath = '%TARGET_EXE%'; " ^
    "        if ('%TARGET_EXE%' -match 'python') { $sc.Arguments = [char]34 + '%APP_DIR%\desktop_app.py' + [char]34 }; " ^
    "        $sc.WorkingDirectory = '%APP_DIR%'; " ^
    "        if (Test-Path '%ICON_PATH%') { $sc.IconLocation = '%ICON_PATH%,0' }; " ^
    "        $sc.Description = 'TalentScout AI - Autonomous Recruiter Engine'; " ^
    "        $sc.Save(); " ^
    "    } " ^
    "}"

echo.
echo [2/2] Done! Shortcut has been successfully created on your Desktop.
echo ===============================================================================
echo.
set /p "LAUNCH=Start TalentScout AI now? [Y/n]: "
if /i "%LAUNCH%"=="" set "LAUNCH=Y"
if /i "%LAUNCH%"=="Y" (
    echo Launching TalentScout AI...
    start "" "%TARGET_EXE%"
)
