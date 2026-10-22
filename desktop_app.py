"""TalentScout Desktop Application Controller.

Launches the unified FastAPI backend (serving both REST API and React frontend)
and opens a native, borderless desktop window using Microsoft Edge or Google Chrome
in dedicated application mode with an isolated profile and window controls.
When the user closes the window, background services terminate cleanly.
"""

import os
import sys
import time
import socket
import urllib.request
import subprocess
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

# Ensure working directory is always the application folder
os.chdir(str(BASE_DIR))

# Ensure project root is in sys.path
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

APP_HOST = "127.0.0.1"
APP_PORT = 8000
APP_URL = f"http://{APP_HOST}:{APP_PORT}/"
WINDOW_TITLE = "TalentScout AI — Autonomous Recruiter Engine"


def is_backend_healthy(host: str = APP_HOST, port: int = APP_PORT) -> bool:
    """Check if the backend is actively listening on the target TCP port and serving HTTP."""
    # 1. TCP Port test
    try:
        with socket.create_connection((host, port), timeout=0.5):
            pass
    except (socket.timeout, ConnectionRefusedError, OSError):
        return False

    # 2. HTTP response check (bypassing any system proxy)
    try:
        proxy_handler = urllib.request.ProxyHandler({})
        opener = urllib.request.build_opener(proxy_handler)
        req = urllib.request.Request(
            f"http://{host}:{port}/",
            headers={"User-Agent": "TalentScoutDesktop/1.0"}
        )
        with opener.open(req, timeout=1.5) as resp:
            # 200 (OK), 301/302/307 (Redirect), or 404 all indicate the server is answering HTTP
            return resp.status in (200, 301, 302, 307, 308, 404)
    except Exception:
        # If TCP connection was successful, server is up and listening
        return True


def start_backend(log_file):
    """Start uvicorn server in a background process, capturing stdout & stderr to log_file."""
    python_exe = sys.executable
    py_path = Path(python_exe)
    # Prefer python.exe in the same folder if launched via pythonw.exe
    if py_path.name.lower() == "pythonw.exe" and (py_path.parent / "python.exe").exists():
        python_exe = str(py_path.parent / "python.exe")

    # On Windows, use CREATE_NO_WINDOW so no black cmd prompt ever shows
    creation_flags = 0x08000000 if os.name == "nt" else 0

    env = os.environ.copy()
    env["PYTHONPATH"] = str(BASE_DIR)
    env["PYTHONUNBUFFERED"] = "1"
    env["SQLALCHEMY_NO_CYTHON"] = "1"
    # Remove ambient system Python home if any
    env.pop("PYTHONHOME", None)

    cmd = [
        python_exe,
        "-m",
        "uvicorn",
        "app.main:app",
        "--host",
        APP_HOST,
        "--port",
        str(APP_PORT),
        "--app-dir",
        str(BASE_DIR),
        "--no-server-header"
    ]

    backend_proc = subprocess.Popen(
        cmd,
        cwd=str(BASE_DIR),
        env=env,
        creationflags=creation_flags,
        stdout=log_file,
        stderr=subprocess.STDOUT
    )
    return backend_proc


def show_native_alert(title: str, message: str):
    """Display a native Windows MessageBox even when running with pythonw."""
    if os.name == "nt":
        try:
            import ctypes
            # MB_OK | MB_ICONERROR = 0x00000000 | 0x00000010 = 0x10
            ctypes.windll.user32.MessageBoxW(0, message, title, 0x10)
            return
        except Exception:
            pass
    print(f"[{title}] {message}", file=sys.stderr)


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
    data_dir = BASE_DIR / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    log_path = data_dir / "backend.log"

    backend_proc = None
    started_by_us = False

    # 1. Check if backend is already running
    if not is_backend_healthy():
        # Open log file in append mode with UTF-8
        log_file = open(log_path, "a", encoding="utf-8", buffering=1)
        log_file.write(f"\n=======================================================\n")
        log_file.write(f"TalentScout Boot: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
        log_file.write(f"=======================================================\n")
        log_file.flush()

        backend_proc = start_backend(log_file)
        started_by_us = True

        # Wait up to 45 seconds for backend to become healthy
        start_time = time.time()
        backend_ready = False

        while time.time() - start_time < 45:
            # Check if backend process crashed
            if backend_proc.poll() is not None:
                log_file.flush()
                log_file.close()
                try:
                    lines = log_path.read_text(encoding="utf-8", errors="replace").strip().splitlines()
                    err_snippet = "\n".join(lines[-15:])
                except Exception:
                    err_snippet = f"Exit code: {backend_proc.returncode}"

                show_native_alert(
                    "TalentScout AI — Startup Failed",
                    f"Backend service terminated unexpectedly (Code {backend_proc.returncode}).\n\n"
                    f"Last log output:\n{err_snippet}\n\n"
                    f"Log file: {log_path}"
                )
                return

            if is_backend_healthy():
                backend_ready = True
                break
            time.sleep(0.5)

        if not backend_ready:
            try:
                backend_proc.terminate()
            except Exception:
                pass
            log_file.flush()
            log_file.close()
            show_native_alert(
                "TalentScout AI — Startup Timeout",
                "The application backend did not start within 45 seconds.\n\n"
                f"Please check the log file for details:\n{log_path}"
            )
            return

    # 2. Prepare isolated application profile directory
    profile_dir = data_dir / ".desktop_profile"
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
