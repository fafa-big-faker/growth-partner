from pathlib import Path
import shutil


repo_root = Path(__file__).resolve().parents[1]
source = repo_root.parent / "新登录页" / "登录背景.png"
target = repo_root / "assets" / "images" / "v2" / "backgrounds" / "login-main.png"

if not source.exists():
    raise FileNotFoundError(source)
target.parent.mkdir(parents=True, exist_ok=True)
shutil.copy2(source, target)
print(f"OK: {source.name} -> {target.relative_to(repo_root)}")
