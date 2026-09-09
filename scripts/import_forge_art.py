"""Import the approved forge stage and equipment slip as isolated transparent assets."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT.parent / "美术风格参考V7"
OUTPUT_ROOT = ROOT / "assets/images/forge-workshop"
RUNTIME_ROOT = ROOT / "assets/runtime/forge-workshop"
MINIMUM_ALPHA = 5
RUNTIME_BUDGET = 96 * 1024
SOURCES = {
    "workshop": {
        "file": "仙来-锻造展示台与装备墨签.png",
        "size": (1536, 1024),
        "sha256": "f9ae42f8438a527edf3260467a0482c1fb8f125494f1daca044e4a968418103a",
    },
}
ASSETS = {
    "stage": {
        "source": "workshop", "cell": (0, 0, 823, 1024),
        "contentBounds": (48, 52, 817, 979), "padding": 12,
        "runtimeSize": (320, 384),
        "rendering": "Contain the complete scene without stretching; axes and controls remain separate overlays.",
    },
    "equip-slip": {
        "source": "workshop", "cell": (823, 0, 1536, 1024),
        "contentBounds": (829, 417, 1498, 600), "padding": 12,
        "runtimeSize": (288, 86),
        "rendering": "Contain at about 96px wide within an independent minimum 44px equipment hit target.",
    },
}


def clean_alpha(image: Image.Image) -> Image.Image:
    cleaned = image.convert("RGBA")
    # Keep dark ink and semitransparent brush edges; only remove invisible color noise.
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
    padding = spec["padding"]
    output = Image.new("RGBA", (artwork.width + padding * 2, artwork.height + padding * 2))
    output.paste(artwork, (padding, padding))
    return output


def make_runtime(image: Image.Image, name: str) -> Image.Image:
    size = ASSETS[name]["runtimeSize"]
    if abs(size[0] / image.width - size[1] / image.height) > 0.002:
        raise ValueError(f"Runtime dimensions would distort {name}")
    return clean_alpha(image.resize(size, Image.Resampling.LANCZOS))


def encoded(image: Image.Image, format_name: str, **options) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, format_name, **options)
    return buffer.getvalue()


def image_spec(image: Image.Image, path: Path, payload: bytes) -> dict:
    return {
        "path": path.relative_to(ROOT).as_posix(), "size": list(image.size),
        "alphaRange": list(image.getchannel("A").getextrema()),
        "alphaBounds": list(image.getchannel("A").getbbox()),
        "bytes": len(payload), "sha256": hashlib.sha256(payload).hexdigest(),
    }


def build_outputs() -> dict[Path, bytes]:
    images, sources, source_assets, runtime_assets, outputs = {}, {}, {}, {}, {}
    for key, expected in SOURCES.items():
        path = SOURCE_ROOT / expected["file"]
        payload = path.read_bytes()
        fingerprint = hashlib.sha256(payload).hexdigest()
        with Image.open(io.BytesIO(payload)) as source:
            image = source.copy()
        if image.size != expected["size"] or image.mode != "RGBA" or fingerprint != expected["sha256"]:
            raise ValueError(f"Source {key} changed; remeasure the replacement before importing")
        images[key] = image
        sources[key] = {
            "file": expected["file"], "size": list(image.size), "mode": image.mode,
            "alphaRange": list(image.getchannel("A").getextrema()),
            "bytes": len(payload), "sha256": fingerprint,
        }

    for name, spec in ASSETS.items():
        source = make_asset(images[spec["source"]], name)
        runtime = make_runtime(source, name)
        png_path = OUTPUT_ROOT / f"{name}.png"
        webp_path = RUNTIME_ROOT / f"{name}.webp"
        png = encoded(source, "PNG", optimize=True)
        webp = encoded(runtime, "WEBP", quality=90, method=6, exact=True)
        source_assets[name] = {
            **image_spec(source, png_path, png), "source": spec["source"],
            "cell": list(spec["cell"]), "contentBounds": list(spec["contentBounds"]),
            "padding": spec["padding"],
        }
        runtime_assets[name] = {
            **image_spec(runtime, webp_path, webp), "rendering": spec["rendering"],
            "quality": 90,
        }
        outputs[png_path], outputs[webp_path] = png, webp

    total = sum(spec["bytes"] for spec in runtime_assets.values())
    if total > RUNTIME_BUDGET:
        raise ValueError(f"Forge artwork exceeds runtime budget: {total} bytes")
    trace = {
        "script": "scripts/import_forge_art.py", "minimumAlpha": MINIMUM_ALPHA,
        "runtimeBudgetBytes": RUNTIME_BUDGET, "runtimeBytes": total,
        "sources": sources, "assets": source_assets,
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
    print(f"Forge artwork: 2 transparent images, {total} runtime bytes; " + ("verified" if args.check else "generated"))


if __name__ == "__main__":
    main()
