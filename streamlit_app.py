"""TalentScout AI - Streamlit Community Cloud Root Entry Point.

Ensures proper sys.path configuration, database initialization, and launches the
primary TalentScout sourcing intelligence interface.
"""

import sys
from pathlib import Path

# Add repository root to Python path
ROOT_DIR = Path(__file__).resolve().parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

# Ensure database and CMS defaults are initialized
from app.db import init_db
init_db()

# Launch main dashboard
home_path = ROOT_DIR / "ui" / "Home.py"
with open(home_path, "r", encoding="utf-8") as f:
    code = compile(f.read(), str(home_path), "exec")
    exec(code, globals())
