"""Export the approved cultivation artwork as a safe Android adaptive icon."""
from pathlib import Path
import argparse
import hashlib
import json
import runpy
from PIL import Image

ROOT = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("source", nargs="?", type=Path,
                    help="Custom icon source; omit to regenerate the approved official icon.")
parser.add_argument("--full-bleed", action="store_true",
                    help="Keep a square icon's full background; fully opaque sources select this automatically.")
args = parser.parse_args()
if args.source is None:
    runpy.run_path(str(ROOT / "import-official-icon.py"), run_name="__main__")
    raise SystemExit(0)
source = args.source.resolve()
with Image.open(source) as image:
    image = image.convert("RGBA")
    bounds = image.getbbox()
    if not bounds:
        raise SystemExit("The icon source has no visible pixels.")
    full_bleed = args.full_bleed or image.getchannel("A").getextrema()[0] == 255
    if full_bleed:
        if image.width != image.height:
            raise SystemExit("Full-bleed icons must be square, with the subject inside the central 62% safe area.")
        canvas = image.resize((324, 324), Image.Resampling.LANCZOS)
        legacy = image.resize((192, 192), Image.Resampling.LANCZOS)
    else:
        image = image.crop(bounds)
        image.thumbnail((176, 176), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (324, 324), (0, 0, 0, 0))
        canvas.alpha_composite(image, ((324 - image.width) // 2, (324 - image.height) // 2))
        legacy = Image.new("RGBA", (192, 192), "#f4f1e8")
        icon = canvas.resize((288, 288), Image.Resampling.LANCZOS)
        legacy.alpha_composite(icon, (-48, -48))
    target = ROOT / "app/src/main/res/drawable-nodpi/launcher_foreground.png"
    target.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(target, optimize=True)
    fallback = ROOT / "app/src/main/res/mipmap-xxxhdpi/ic_launcher.png"
    fallback.parent.mkdir(parents=True, exist_ok=True)
    legacy.save(fallback, optimize=True)
manifest = {
    "source": source.name,
    "source_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
    "mode": "full-bleed" if full_bleed else "transparent-artwork",
    "foreground": "324x324 full square background; source subject must fit central 62%" if full_bleed
                  else "324x324, artwork fits central 176x176 adaptive safe zone",
    "foreground_sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
    "legacy_sha256": hashlib.sha256(fallback.read_bytes()).hexdigest(),
}
(ROOT / "icon-source.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("Exported approved icon: adaptive foreground and legacy launcher PNG.")
