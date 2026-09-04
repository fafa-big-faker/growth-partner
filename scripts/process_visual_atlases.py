#!/usr/bin/env python3
import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw


SCENE_NAMES = ["login", "cultivate", "tasks", "reward"]
TREE_NAMES = ["sprout", "spirit", "divine"]
UI_NAMES = [
    "slot-neutral", "slot-blue", "slot-purple", "slot-rose",
    "slot-gold", "panel-corner", "panel-divider", "button-primary",
    "button-secondary", "tab-active", "tab-inactive", "status-pill",
    "modal-crest", "checkbox-on", "checkbox-off", "scroll-thumb",
]
FEATURE_NAMES = [
    "icon-cultivate", "icon-tasks", "icon-reward", "icon-mail",
    "icon-achievement", "icon-forge", "icon-breakthrough", "icon-tree-info",
    "icon-shop", "icon-wallet", "icon-lock", "icon-close",
    "effect-leaf-green", "effect-leaf-gold", "effect-hit-spark", "effect-drop-glow",
]


def crop_grid(image, rows, columns, names, inset=10):
    if len(names) > rows * columns:
        raise ValueError("more names than atlas cells")
    cell_width = image.width / columns
    cell_height = image.height / rows
    crops = {}
    for index, name in enumerate(names):
        row, column = divmod(index, columns)
        left = round(column * cell_width) + inset
        top = round(row * cell_height) + inset
        right = round((column + 1) * cell_width) - inset
        bottom = round((row + 1) * cell_height) - inset
        crops[name] = image.crop((left, top, right, bottom))
    return crops


def remove_edge_background(image, threshold=82):
    rgba = image.convert("RGBA")
    draw = ImageDraw.Draw(rgba)
    transparent = (255, 0, 255, 0)
    width, height = rgba.size
    seeds = [
        (0, 0), (width - 1, 0), (0, height - 1), (width - 1, height - 1),
        (width // 2, 0), (width // 2, height - 1),
        (0, height // 2), (width - 1, height // 2),
    ]
    for seed in seeds:
        ImageDraw.floodfill(rgba, seed, transparent, thresh=threshold)
    return rgba


def trim_transparent(image, padding=8):
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if not bbox:
        return image
    left, top, right, bottom = bbox
    return image.crop((
        max(0, left - padding),
        max(0, top - padding),
        min(image.width, right + padding),
        min(image.height, bottom + padding),
    ))


def save_backgrounds(source, output_dir, manifest):
    crops = crop_grid(source, 2, 2, SCENE_NAMES, inset=12)
    target_dir = output_dir / "backgrounds"
    target_dir.mkdir(parents=True, exist_ok=True)
    for name, image in crops.items():
        path = target_dir / f"{name}.webp"
        image.convert("RGB").save(path, "WEBP", quality=88, method=6)
        manifest["backgrounds"][name] = path.as_posix()


def save_transparent_group(source, rows, columns, names, target_dir, manifest_group):
    target_dir.mkdir(parents=True, exist_ok=True)
    for name, image in crop_grid(source, rows, columns, names, inset=10).items():
        keyed = trim_transparent(remove_edge_background(image))
        path = target_dir / f"{name}.png"
        keyed.save(path, "PNG", optimize=True)
        manifest_group[name] = path.as_posix()


def relative_manifest_paths(manifest, project_root):
    for group in manifest.values():
        for name, value in group.items():
            group[name] = Path(value).resolve().relative_to(project_root.resolve()).as_posix()


def main():
    parser = argparse.ArgumentParser(description="Crop the four visual-overhaul atlases")
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()

    required = {
        "scene": args.input / "scene-atlas.png",
        "tree": args.input / "tree-atlas.png",
        "ui": args.input / "ui-atlas.png",
        "feature": args.input / "feature-effects-atlas.png",
    }
    missing = [str(path) for path in required.values() if not path.exists()]
    if missing:
        raise FileNotFoundError("Missing atlas files: " + ", ".join(missing))

    manifest = {"backgrounds": {}, "trees": {}, "ui": {}, "icons": {}, "effects": {}}
    with Image.open(required["scene"]) as image:
        save_backgrounds(image, args.output, manifest)
    with Image.open(required["tree"]) as image:
        save_transparent_group(image, 1, 3, TREE_NAMES, args.output / "trees", manifest["trees"])
    with Image.open(required["ui"]) as image:
        save_transparent_group(image, 4, 4, UI_NAMES, args.output / "ui", manifest["ui"])
    with Image.open(required["feature"]) as image:
        feature_crops = crop_grid(image, 4, 4, FEATURE_NAMES, inset=10)
        for name, crop in feature_crops.items():
            group_name = "effects" if name.startswith("effect-") else "icons"
            target_dir = args.output / group_name
            target_dir.mkdir(parents=True, exist_ok=True)
            path = target_dir / f"{name}.png"
            trim_transparent(remove_edge_background(crop)).save(path, "PNG", optimize=True)
            manifest[group_name][name] = path.as_posix()

    relative_manifest_paths(manifest, Path.cwd())
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
