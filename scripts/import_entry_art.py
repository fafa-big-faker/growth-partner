"""Import the approved entry preparation background without cropping its artwork."""
from pathlib import Path
import argparse
import hashlib
import io
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / "美术风格参考V7/仙来-入境准备背景.png"
SOURCE_SHA256 = "9a2b557b6f0eb11894276b237436aa417a9354337c079abad36aa077b3a5edb5"
IMAGE_DIRECTORY = ROOT / "assets/images/entry-preparation"
RUNTIME_DIRECTORY = ROOT / "assets/runtime/entry-preparation"
URL = "assets/runtime/entry-preparation/background.webp?v=entry-preparation-20260910"
BUDGET = 100 * 1024


def sha(data):
    return hashlib.sha256(data).hexdigest()


def json_bytes(data):
    return (json.dumps(data, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def generate():
    source_bytes = SOURCE.read_bytes()
    if sha(source_bytes) != SOURCE_SHA256:
        raise ValueError("Source artwork changed: inspect the new image and update its measured contract before importing.")
    with Image.open(io.BytesIO(source_bytes)) as opened:
        original = opened.convert("RGBA")
        source_mode = opened.mode
    if original.size != (1536, 1024):
        raise ValueError("Expected the approved 1536x1024 artwork.")
    alpha = original.getchannel("A").getextrema()
    # Opaque art needs no alpha plane; transparent replacements must never lose theirs.
    original = original.convert("RGB") if alpha == (255, 255) else original
    for width, quality in ((1536, 84), (1536, 80), (1280, 84), (1280, 80), (1024, 84)):
        size = (width, round(width * original.height / original.width))
        resized = original if size == original.size else original.resize(size, Image.Resampling.LANCZOS)
        buffer = io.BytesIO()
        resized.save(buffer, format="WEBP", quality=quality, method=6, exact=True)
        runtime = buffer.getvalue()
        if len(runtime) <= BUDGET:
            break
    else:
        raise ValueError("Background exceeds 100 KiB at the approved quality floor; inspect before reducing further.")
    archive = io.BytesIO()
    resized.save(archive, format="PNG", optimize=True)
    png = archive.getvalue()
    runtime_manifest = {
        "url": URL, "width": resized.width, "height": resized.height, "mode": resized.mode,
        "bytes": len(runtime), "sha256": sha(runtime), "quality": quality, "method": 6,
        "source_sha256": SOURCE_SHA256, "source_size": list(original.size),
        "crop": [0, 0, original.width, original.height], "budget_bytes": BUDGET,
    }
    source_manifest = {
        "source": SOURCE.name, "source_size": list(original.size), "source_mode": source_mode,
        "source_alpha": list(alpha), "source_bytes": len(source_bytes), "source_sha256": SOURCE_SHA256,
        "output_size": list(resized.size), "png_bytes": len(png), "png_sha256": sha(png),
        "treatment": "Whole image; uniform scaling only; no crop, added artwork, text or color replacement.",
    }
    return {
        IMAGE_DIRECTORY / "background.png": png,
        IMAGE_DIRECTORY / "source-manifest.json": json_bytes(source_manifest),
        RUNTIME_DIRECTORY / "background.webp": runtime,
        RUNTIME_DIRECTORY / "manifest.json": json_bytes(runtime_manifest),
    }, source_manifest, runtime_manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Rebuild in memory and compare every output without writing.")
    args = parser.parse_args()
    outputs, source, runtime = generate()
    for file, data in outputs.items():
        if args.check:
            if not file.is_file() or file.read_bytes() != data:
                raise SystemExit(f"Entry background differs: {file.relative_to(ROOT)}")
        else:
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_bytes(data)
    print(json.dumps({"checked": args.check, "source_size": source["source_size"],
                      "source_mode": source["source_mode"], "source_alpha": source["source_alpha"],
                      "runtime_size": [runtime["width"], runtime["height"]],
                      "runtime_bytes": runtime["bytes"], "quality": runtime["quality"],
                      "url": runtime["url"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
