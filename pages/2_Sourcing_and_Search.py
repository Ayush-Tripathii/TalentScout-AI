import sys
from pathlib import Path

current = Path(__file__).resolve()
ROOT_DIR = None
for p in [current] + list(current.parents):
    if (p / "app").is_dir() and (p / "ui").is_dir():
        ROOT_DIR = p
        break
if ROOT_DIR is None:
    ROOT_DIR = current.parent.parent

if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

target_file = ROOT_DIR / "ui" / "pages" / "2_Sourcing_and_Search.py"
globals()["__file__"] = str(target_file)
with open(target_file, "r", encoding="utf-8") as f:
    exec(compile(f.read(), str(target_file), "exec"), globals())

