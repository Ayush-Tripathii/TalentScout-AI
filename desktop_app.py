"""TalentScout Desktop Application Controller.

Launches the unified FastAPI backend (serving both REST API and React frontend)
and opens a native, borderless desktop window using Microsoft Edge or Google Chrome
in dedicated application mode with an isolated profile and window controls.
When the user closes the window, background services terminate cleanly.
"""

import os
import sys
import time
import urllib.request
import subprocess
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

# Ensure project root is in sys.path
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

APP_URL = "http://127.0.0.1:8000/"
HEALTH_URL = "http://127.0.0.1:8000/api/compliance/retention-status"
WINDOW_TITLE = "TalentScout AI — Autonomous Recruiter Engine"


def is_backend_healthy() -> bool:
    """Check if the backend API is already responding on port 8000."""
    try:
        req = urllib.request.Request(HEALTH_URL, headers={"User-Agent": "TalentScoutDesktop/1.0"})
        with urllib.request.urlopen(req, timeout=1.5) as response:
            return response.status == 200
    except Exception:
        return False


def start_backend():
    """Start uvicorn server in a silent background process."""
    python_exe = sys.executable
    # On Windows, use CREATE_NO_WINDOW so no black cmd prompt ever shows
    creation_flags = 0x08000000 if os.name == "nt" else 0

    cmd = [
        python_exe,
        "-m",
        "uvicorn",
        "app.main:app",
        "--host",
        "127.0.0.1",
        "--port",
        "8000",
        "--no-server-header"
    ]

    backend_proc = subprocess.Popen(
        cmd,
        cwd=str(BASE_DIR),
        creationflags=creation_flags,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )
    return backend_proc


def find_desktop_browser() -> str:
    """Locate Microsoft Edge or Google Chrome for dedicated native --app mode."""
    candidates = [
        # Microsoft Edge (Standard Windows 10 & 11)
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe"),
        # Google Chrome
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
        # Brave / Chromium
        r"C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe",
    ]

    for path in candidates:
        if os.path.isfile(path):
            return path
    return ""


def main():
    backend_proc = None
    started_by_us = False

    # 1. Check if backend is already running
    if not is_backend_healthy():
        backend_proc = start_backend()
        started_by_us = True

        # Wait up to 15 seconds for backend to become healthy
        start_time = time.time()
        while time.time() - start_time < 15:
            if is_backend_healthy():
                break
            time.sleep(0.3)

    # 2. Prepare isolated application profile directory
    profile_dir = BASE_DIR / "data" / ".desktop_profile"
    profile_dir.mkdir(parents=True, exist_ok=True)

    # 3. Locate browser for standalone app mode
    browser_exe = find_desktop_browser()

    if browser_exe:
        # Launch dedicated application window
        browser_args = [
            browser_exe,
            f"--app={APP_URL}",
            f"--user-data-dir={profile_dir}",
            "--window-size=1380,880",
            "--window-position=50,50",
            "--disable-extensions",
            "--disable-plugins",
            "--no-first-run",
            "--no-default-browser-check"
        ]

        app_window = subprocess.Popen(browser_args)
        # Wait until the user closes the desktop window
        app_window.wait()
    else:
        # Fallback to default browser
        import webbrowser
        webbrowser.open(APP_URL)
        # If fallback, wait until user terminates or exits
        if started_by_us and backend_proc:
            try:
                backend_proc.wait()
            except KeyboardInterrupt:
                pass

    # 4. Graceful Cleanup: Terminate backend if we started it
    if started_by_us and backend_proc:
        try:
            backend_proc.terminate()
            backend_proc.wait(timeout=3)
        except Exception:
            backend_proc.kill()


if __name__ == "__main__":
    main()
