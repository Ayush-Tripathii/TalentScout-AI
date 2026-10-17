import sys
from pathlib import Path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

target_file = ROOT_DIR / "ui" / "pages" / "1_Jobs_and_Intake.py"
with open(target_file, "r", encoding="utf-8") as f:
    exec(compile(f.read(), str(target_file), "exec"), globals())
