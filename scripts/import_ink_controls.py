"""Import the approved return arrow and aligned experience slots without RGB removal."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT.parent / "\u7f8e\u672f\u98ce\u683c\u53c2\u8003V7"
OUTPUT_ROOT = ROOT / "assets/images/ink-controls"
RUNTIME_ROOT = ROOT / "assets/runtime/ink-controls"
MINIMUM_ALPHA = 5
SOURCES = {
    "arrow": {
        "file": "\u4ed9\u6765-\u8fd4\u56de\u7bad\u5934.png",
        "size": (1254, 1254),
        "sha256": "a31c29515989c2061616bcef9d8a9b3603aa3f828533e00aef797bd1904cbddd",
    },
    "experience": {
        "file": "\u4ed9\u6765-\u7b49\u7ea7\u7ecf\u9a8c\u6761\u56fe\u96c6.png",
        "size": (1536, 1024),
        "sha256": "a53ada5fc4f945e8f3b64f8991322890d4ca57e921290d11b3a1214f97c03f04",
    },
}
ASSETS = {
    "return-arrow": {
        "source": "arrow", "cell": (0, 0, 1254, 1254),
        "contentBounds": (267, 362, 986, 898), "padding": 12,
        "runtimeSize": (160, 121),
    },
    "exp-track": {
        "source": "experience", "cell": (0, 0, 1536, 512),
        "contentBounds": (106, 288, 1431, 344), "padding": 4,
        "runtimeSize": (960, 46),
    },
    "exp-fill": {
        "source": "experience", "cell": (0, 512, 1536, 1024),
        "contentBounds": (106, 682, 1431, 738), "padding": 4,
        "runtimeSize": (960, 46),
    },
}
SOURCE_SLICE = [8, 61, 8, 61]
RUNTIME_SLICE = [6, 44, 6, 44]
RUNTIME_BUDGET = 96 * 1024


def clean_alpha(image: Image.Image) -> Image.Image:
    cleaned = image.convert("RGBA")
    # The apparent halo is RGB stored behind alpha 0..4, not part of either slot.
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


def image_spec(image: Image.Image, path: Path) -> dict:
    return {
        "path": path.relative_to(ROOT).as_posix(), "size": list(image.size),
        "alphaRange": list(image.getchannel("A").getextrema()),
        "alphaBounds": list(image.getchannel("A").getbbox()),
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
            "alphaRange": list(image.getchannel("A").getextrema()), "sha256": fingerprint,
        }

    for name, spec in ASSETS.items():
        source = make_asset(images[spec["source"]], name)
        runtime = make_runtime(source, name)
        png_path, webp_path = OUTPUT_ROOT / f"{name}.png", RUNTIME_ROOT / f"{name}.webp"
        png = encoded(source, "PNG", optimize=True)
        webp = encoded(runtime, "WEBP", quality=90, method=6, exact=True)
        source_assets[name] = {
            **image_spec(source, png_path), "source": spec["source"],
            "cell": list(spec["cell"]), "contentBounds": list(spec["contentBounds"]),
            "padding": spec["padding"],
        }
        runtime_assets[name] = {**image_spec(runtime, webp_path), "bytes": len(webp)}
        if name.startswith("exp-"):
            source_assets[name]["slice"] = SOURCE_SLICE
            runtime_assets[name]["slice"] = RUNTIME_SLICE
            runtime_assets[name]["rendering"] = "Fixed complete texture; reveal fill by clipping, never scale by progress."
        outputs[png_path], outputs[webp_path] = png, webp

    total = sum(spec["bytes"] for spec in runtime_assets.values())
    if total > RUNTIME_BUDGET:
        raise ValueError(f"Ink controls exceed runtime budget: {total} bytes")
    trace = {
        "script": "scripts/import_ink_controls.py", "minimumAlpha": MINIMUM_ALPHA,
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
    print(f"Ink controls: 3 transparent images, {total} runtime bytes; " + ("verified" if args.check else "generated"))


if __name__ == "__main__":
    main()
