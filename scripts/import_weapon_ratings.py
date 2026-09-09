"""Import five transparent weapon rating marks with equal letter height and baseline."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT.parent / "\u7f8e\u672f\u98ce\u683c\u53c2\u8003V7"
OUTPUT_ROOT = ROOT / "assets/images/weapon-ratings"
RUNTIME_ROOT = ROOT / "assets/runtime/weapon-ratings"
MINIMUM_ALPHA = 5
SOURCE = {
    "file": "`\u4ed9\u6765-\u4ed9\u65a7\u8bc4\u7ea7\u5b57\u6807\u56fe\u96c6.png",
    "size": (1536, 1024),
    "sha256": "e768f3d402b123b847e99b67eb87e69d477f042d2f3cd8402dcbd0a85b31fb9b",
}
ASSETS = {
    "rating-b": {"cell": (0, 0, 512, 512), "contentBounds": (148, 112, 399, 432)},
    "rating-a": {"cell": (512, 0, 1024, 512), "contentBounds": (631, 104, 942, 428)},
    "rating-s": {"cell": (1024, 0, 1536, 512), "contentBounds": (1139, 92, 1411, 426)},
    "rating-ss": {"cell": (0, 512, 512, 1024), "contentBounds": (62, 613, 447, 905)},
    "rating-sss": {"cell": (512, 512, 1024, 1024), "contentBounds": (534, 617, 993, 900)},
}
EMPTY_CELL = (1024, 512, 1536, 1024)
OUTPUT_SIZE = (192, 96)
GLYPH_HEIGHT = 72
BASELINE = 84
RUNTIME_BUDGET = 40 * 1024
NORMALIZATION = {
    "glyphHeight": GLYPH_HEIGHT, "baseline": BASELINE,
    "alignment": "center", "scaling": "uniform",
}


def source_path() -> Path:
    return SOURCE_ROOT / SOURCE["file"]


def clean_alpha(image: Image.Image) -> Image.Image:
    cleaned = image.convert("RGBA")
    cleaned.putdata([pixel if pixel[3] >= MINIMUM_ALPHA else (0, 0, 0, 0)
                     for pixel in cleaned.get_flattened_data()])
    return cleaned


def make_asset(image: Image.Image, name: str) -> Image.Image:
    spec = ASSETS[name]
    cell = spec["cell"]
    cleaned = clean_alpha(image.crop(cell))
    local = cleaned.getchannel("A").getbbox()
    if local is None:
        raise ValueError(f"Expected nonempty artwork for {name}")
    bounds = (local[0] + cell[0], local[1] + cell[1], local[2] + cell[0], local[3] + cell[1])
    if bounds != spec["contentBounds"]:
        raise ValueError(f"Artwork {name} outline changed; remeasure before importing")
    artwork = cleaned.crop(local)
    width = round(artwork.width * GLYPH_HEIGHT / artwork.height)
    resized = clean_alpha(artwork.resize((width, GLYPH_HEIGHT), Image.Resampling.LANCZOS))
    output = Image.new("RGBA", OUTPUT_SIZE)
    output.paste(resized, ((output.width - width) // 2, BASELINE - GLYPH_HEIGHT))
    alpha_bounds = output.getchannel("A").getbbox()
    if alpha_bounds[1::2] != (BASELINE - GLYPH_HEIGHT, BASELINE):
        raise ValueError(f"Resampling changed {name} letter height; remeasure the normalization")
    return output


def encoded(image: Image.Image, format_name: str, **options) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, format_name, **options)
    return buffer.getvalue()


def image_spec(image: Image.Image, path: Path, payload: bytes) -> dict:
    return {
        "path": path.relative_to(ROOT).as_posix(), "size": list(image.size),
        "alphaRange": list(image.getchannel("A").getextrema()),
        "alphaBounds": list(image.getchannel("A").getbbox()),
        "normalization": NORMALIZATION, "bytes": len(payload),
    }


def build_outputs() -> dict[Path, bytes]:
    payload = source_path().read_bytes()
    fingerprint = hashlib.sha256(payload).hexdigest()
    with Image.open(io.BytesIO(payload)) as source:
        image = source.copy()
    if image.size != SOURCE["size"] or image.mode != "RGBA" or fingerprint != SOURCE["sha256"]:
        raise ValueError("Source atlas changed; remeasure the replacement before importing")
    if clean_alpha(image.crop(EMPTY_CELL)).getchannel("A").getbbox() is not None:
        raise ValueError("Expected bottom-right atlas cell to be empty")

    outputs, source_assets, runtime_assets = {}, {}, {}
    for name, spec in ASSETS.items():
        artwork = make_asset(image, name)
        png_path, webp_path = OUTPUT_ROOT / f"{name}.png", RUNTIME_ROOT / f"{name}.webp"
        png = encoded(artwork, "PNG", optimize=True)
        webp = encoded(artwork, "WEBP", quality=90, method=6, exact=True)
        source_assets[name] = {
            **image_spec(artwork, png_path, png), "cell": list(spec["cell"]),
            "contentBounds": list(spec["contentBounds"]),
            "scale": GLYPH_HEIGHT / (spec["contentBounds"][3] - spec["contentBounds"][1]),
        }
        runtime_assets[name] = image_spec(artwork, webp_path, webp)
        outputs[png_path], outputs[webp_path] = png, webp

    total = sum(spec["bytes"] for spec in runtime_assets.values())
    if total > RUNTIME_BUDGET:
        raise ValueError(f"Weapon ratings exceed runtime budget: {total} bytes")
    trace = {
        "script": "scripts/import_weapon_ratings.py", "minimumAlpha": MINIMUM_ALPHA,
        "source": {
            "file": SOURCE["file"], "size": list(image.size), "mode": image.mode,
            "alphaRange": list(image.getchannel("A").getextrema()), "sha256": fingerprint,
            "bytes": len(payload), "emptyCell": list(EMPTY_CELL),
        },
        "assets": source_assets,
    }
    outputs[OUTPUT_ROOT / "source-manifest.json"] = (json.dumps(trace, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    outputs[RUNTIME_ROOT / "manifest.json"] = (json.dumps(runtime_assets, indent=2) + "\n").encode("utf-8")
    return outputs


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Verify deterministic outputs without writing files.")
    args = parser.parse_args()
    outputs = build_outputs()
    for path, payload in outputs.items():
        if args.check:
            if not path.exists() or path.read_bytes() != payload:
                raise ValueError(f"Output differs: {path.relative_to(ROOT)}")
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(payload)
    total = sum(len(payload) for path, payload in outputs.items() if path.suffix == ".webp")
    print(f"Weapon ratings: 5 transparent 192x96 images, {total} runtime bytes; "
          + ("verified" if args.check else "generated"))


if __name__ == "__main__":
    main()
