"""Import five wish trees without cutting crossed atlas cells or moving their chop anchors."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE_PATH = ROOT.parent / "美术风格参考V7/仙来-五阶段仙树图集.png"
OUTPUT_ROOT = ROOT / "assets/images/wish-trees"
RUNTIME_ROOT = ROOT / "assets/runtime/wish-trees"
SOURCE_SHA256 = "0640347cf5c52cb81282e0ce8ae7b391a47b9ce90f4b3cbb3d9c0d452049645e"
MINIMUM_ALPHA = 5
CANVAS_SIZE = (384, 384)
SCALE = 0.64
STRIKE = (176, 272)
GROUND_Y = 360
RUNTIME_BUDGET = 400 * 1024
HD_RUNTIME_BUDGET = int(1.4 * 1024 * 1024)
ASSETS = {
    "tree_01": {"cell": (0, 0, 512, 490), "bounds": (142, 101, 441, 468),
                "strikeX": 239, "rootX": 272, "crown": (306, 154)},
    "tree_02": {"cell": (512, 0, 1024, 490), "bounds": (589, 73, 956, 468),
                "strikeX": 756, "rootX": 772, "crown": (798, 144)},
    "tree_03": {"cell": (1024, 0, 1536, 490), "bounds": (1062, 33, 1490, 471),
                "strikeX": 1253, "rootX": 1281, "crown": (1264, 106)},
    "tree_04": {"cell": (0, 490, 520, 1024), "bounds": (23, 515, 509, 994),
                "strikeX": 244, "rootX": 265, "crown": (258, 601)},
    "tree_05": {"cell": (520, 490, 1536, 1024), "bounds": (532, 508, 1074, 996),
                "strikeX": 766, "rootX": 789, "crown": (793, 597)},
}


def clean_alpha(image: Image.Image) -> Image.Image:
    cleaned = image.convert("RGBA")
    # The atlas stores dark/halo RGB even in alpha=0..4; never remove ink by RGB.
    cleaned.putdata([p if p[3] >= MINIMUM_ALPHA else (0, 0, 0, 0)
                     for p in cleaned.get_flattened_data()])
    return cleaned


def source_anchors(name: str) -> dict:
    spec = ASSETS[name]
    ground = spec["bounds"][3]
    return {"strike": [spec["strikeX"], ground - (GROUND_Y - STRIKE[1]) / SCALE],
            "ground": [spec["rootX"], ground], "crown": list(spec["crown"])}


def canvas_point(name: str, point) -> list[float]:
    origin = source_anchors(name)["strike"]
    return [round(STRIKE[0] + (point[0] - origin[0]) * SCALE, 6),
            round(STRIKE[1] + (point[1] - origin[1]) * SCALE, 6)]


def normalized_anchors(name: str) -> dict:
    return {key: [round(value / CANVAS_SIZE[i], 10) for i, value in enumerate(canvas_point(name, point))]
            for key, point in source_anchors(name).items()}


def make_tree(image: Image.Image, name: str, density: int = 1) -> Image.Image:
    if density not in (1, 2):
        raise ValueError(f"Unsupported wish-tree density: {density}")
    spec = ASSETS[name]
    cell = spec["cell"]
    cleaned = clean_alpha(image.crop(cell))
    local = cleaned.getchannel("A").getbbox()
    if local is None:
        raise ValueError(f"Tree {name} is empty")
    measured = (local[0] + cell[0], local[1] + cell[1], local[2] + cell[0], local[3] + cell[1])
    if measured != spec["bounds"]:
        raise ValueError(f"Tree {name} changed outline; remeasure the replacement atlas")
    crop = cleaned.crop(local)
    left, top, right, bottom = measured
    anchors = source_anchors(name)
    strike_x, strike_y = anchors["strike"]
    # Preserve the published 1x pipeline byte-for-byte. The 2x image instead
    # retains this direct source-atlas sample, without a downsample/upscale cycle.
    factor = 2
    output = crop.transform((CANVAS_SIZE[0] * factor, CANVAS_SIZE[1] * factor),
                            Image.Transform.AFFINE,
                            (1 / (SCALE * factor), 0, strike_x - STRIKE[0] / SCALE - left,
                             0, 1 / (SCALE * factor), strike_y - STRIKE[1] / SCALE - top),
                            resample=Image.Resampling.BICUBIC)
    if density == 1:
        output = output.resize(CANVAS_SIZE, Image.Resampling.LANCZOS)
    output = clean_alpha(output)
    predicted = [canvas_point(name, (left, top)), canvas_point(name, (right, bottom))]
    if min(predicted[0]) < 8 or max(predicted[1]) > 376:
        raise ValueError(f"Tree {name} would lose its transparent safety margin")
    return output


def make_light(tree: Image.Image) -> Image.Image:
    """Copy existing bright art only; preserve RGB and avoid invented light geometry."""
    output = Image.new("RGBA", tree.size)
    pixels = []
    for r, g, b, alpha in tree.get_flattened_data():
        luminance = (2126 * r + 7152 * g + 722 * b) / 10000
        strength = min(1, max(0, (luminance - 190) / 50))
        light_alpha = round(alpha * strength * 0.72) if alpha >= 64 else 0
        pixels.append((r, g, b, light_alpha) if light_alpha >= MINIMUM_ALPHA else (0, 0, 0, 0))
    output.putdata(pixels)
    return output


def encode(image: Image.Image, format_name: str, **options) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, format_name, **options)
    return buffer.getvalue()


def image_spec(image: Image.Image, path: Path, payload: bytes) -> dict:
    alpha = image.getchannel("A")
    return {"path": path.relative_to(ROOT).as_posix(), "size": list(image.size),
            "alphaRange": list(alpha.getextrema()), "alphaBounds": list(alpha.getbbox()),
            "visiblePixels": sum(value >= MINIMUM_ALPHA for value in alpha.get_flattened_data()),
            "bytes": len(payload), "sha256": hashlib.sha256(payload).hexdigest()}


def build_outputs() -> dict[Path, bytes]:
    payload = SOURCE_PATH.read_bytes()
    fingerprint = hashlib.sha256(payload).hexdigest()
    with Image.open(io.BytesIO(payload)) as source:
        original = source.copy()
    if original.mode != "RGBA" or original.size != (1536, 1024) or fingerprint != SOURCE_SHA256:
        raise ValueError("Source wish-tree atlas changed; remeasure before importing")
    source_assets, runtime_assets, outputs, densities = {}, {}, {}, {}
    for name, spec in ASSETS.items():
        for density in (1, 2):
            tree = make_tree(original, name, density)
            light_name = f"light-{name[-2:]}"
            suffix, quality = ("", 90) if density == 1 else ("@2x", 95)
            for base_name, image, kind in [(name, tree, "tree"), (light_name, make_light(tree), "light")]:
                asset_name = base_name + suffix
                png_path, webp_path = OUTPUT_ROOT / f"{asset_name}.png", RUNTIME_ROOT / f"{asset_name}.webp"
                png = encode(image, "PNG", optimize=True)
                webp = encode(image, "WEBP", quality=quality, method=6, exact=True)
                metadata = {"tree": name, "kind": kind, "density": density,
                            "anchors": normalized_anchors(name),
                            "canvasAnchors": {key: [round(v * density, 6) for v in canvas_point(name, point)]
                                              for key, point in source_anchors(name).items()}}
                source_assets[asset_name] = {**image_spec(image, png_path, png), **metadata,
                                             "cell": list(spec["cell"]), "contentBounds": list(spec["bounds"]),
                                             "sourceAnchors": source_anchors(name), "scale": SCALE * density,
                                             "resampling": "bicubic+lanczos" if density == 1 else "single-affine-bicubic"}
                runtime_assets[asset_name] = {**image_spec(image, webp_path, webp), **metadata, "quality": quality}
                outputs[png_path], outputs[webp_path] = png, webp
    for density, budget in [(1, RUNTIME_BUDGET), (2, HD_RUNTIME_BUDGET)]:
        density_bytes = sum(spec["bytes"] for spec in runtime_assets.values() if spec["density"] == density)
        if density_bytes > budget:
            raise ValueError(f"Wish-tree {density}x assets exceed budget: {density_bytes}")
        densities[str(density)] = {"canvasSize": [value * density for value in CANVAS_SIZE],
                                  "scale": SCALE * density, "runtimeBytes": density_bytes,
                                  "runtimeBudgetBytes": budget}
    total = sum(spec["bytes"] for spec in runtime_assets.values())
    trace = {"script": "scripts/import_wish_trees.py", "minimumAlpha": MINIMUM_ALPHA,
             "canvasSize": list(CANVAS_SIZE), "scale": SCALE, "runtimeBytes": total,
             "runtimeBudgetBytes": RUNTIME_BUDGET + HD_RUNTIME_BUDGET, "densities": densities,
             "source": {"file": SOURCE_PATH.name, "size": list(original.size), "mode": original.mode,
                        "alphaRange": list(original.getchannel("A").getextrema()),
                        "bytes": len(payload), "sha256": fingerprint},
             "lightExtraction": {"luminanceStart": 190, "luminanceRamp": 50, "alphaScale": 0.72,
                                 "minimumSourceAlpha": 64, "preserveOriginalRgb": True},
             "assets": source_assets}
    outputs[OUTPUT_ROOT / "source-manifest.json"] = (json.dumps(trace, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    outputs[RUNTIME_ROOT / "manifest.json"] = (json.dumps(runtime_assets, indent=2) + "\n").encode("utf-8")
    return outputs


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Verify deterministic outputs without writes.")
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
    print(f"Wish trees: 5 trees + 5 original-art lights at 1x and 2x, {total} runtime bytes; "
          + ("verified" if args.check else "generated"))


if __name__ == "__main__":
    main()
