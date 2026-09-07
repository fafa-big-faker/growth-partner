"""Import the approved Xianlai atlases without changing any gameplay assets."""

from __future__ import annotations

from collections import deque
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT.parent / "\u7f8e\u672f\u98ce\u683c\u53c2\u8003V\uff13"
OUTPUT_ROOT = ROOT / "assets/images/v3"
SOURCES = {
    "logo": "\u4ed9\u6765-logo.png",
    "frames": "\u4ed9\u6765-\u754c\u9762\u6846\u56fe\u96c6.png",
    "icons": "\u4ed9\u6765-\u529f\u80fd\u56fe\u6807\u56fe\u96c6.png",
    "login": "\u4ed9\u6765-\u767b\u5f55\u80cc\u666f.png",
}
FRAME_NAMES = ("frame-topbar", "frame-status", "frame-inventory", "frame-equip", "frame-nav", "button-primary")
ICON_NAMES = ("icon-cultivate", "icon-tasks", "icon-shop", "icon-mail", "icon-achievement", "icon-sound")
NINE_SLICE = {
    "frame-topbar": [16, 48, 16, 48],
    "frame-status": [30, 48, 30, 48],
    "frame-inventory": [52, 56, 52, 56],
    "frame-equip": [38, 58, 38, 58],
    "frame-nav": [28, 48, 18, 48],
    "button-primary": [36, 48, 36, 48],
}


def remove_key_fringe(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = []
    for red, green, blue, alpha in rgba.get_flattened_data():
        is_key_green = green > 135 and green - red > 38 and green - blue > 35
        pixels.append((red, green, blue, 0 if is_key_green else alpha))
    rgba.putdata(pixels)
    return rgba


def component_mask(image: Image.Image, keep_all_large: bool = False) -> Image.Image:
    width, height = image.size
    alpha = image.getchannel("A").tobytes()
    seen = bytearray(width * height)
    components = []
    for start, value in enumerate(alpha):
        if value < 12 or seen[start]:
            continue
        seen[start] = 1
        queue = deque([start])
        component = []
        while queue:
            current = queue.popleft()
            component.append(current)
            x, y = current % width, current // width
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if nx < 0 or nx >= width or ny < 0 or ny >= height:
                    continue
                neighbour = ny * width + nx
                if seen[neighbour] or alpha[neighbour] < 12:
                    continue
                seen[neighbour] = 1
                queue.append(neighbour)
        components.append(component)
    if not components:
        raise ValueError("Atlas cell has no visible artwork")
    largest = max(map(len, components))
    threshold = max(24, largest // 600) if keep_all_large else largest
    keep = bytearray(width * height)
    for component in components:
        if len(component) >= threshold:
            for pixel in component:
                keep[pixel] = 255
    return Image.frombytes("L", image.size, bytes(keep)).filter(ImageFilter.MaxFilter(5))


def clean_cutout(image: Image.Image, *, multiple_parts: bool = False, padding: int = 8) -> Image.Image:
    rgba = remove_key_fringe(image)
    mask = component_mask(rgba, keep_all_large=multiple_parts)
    rgba.putalpha(ImageChops.multiply(rgba.getchannel("A"), mask))
    bounds = rgba.getchannel("A").getbbox()
    if not bounds:
        raise ValueError("Cutout cleaning erased the artwork")
    cropped = rgba.crop(bounds)
    result = Image.new("RGBA", (cropped.width + padding * 2, cropped.height + padding * 2), (0, 0, 0, 0))
    result.alpha_composite(cropped, (padding, padding))
    return result


def split_grid(image: Image.Image, columns: int, rows: int) -> list[Image.Image]:
    if image.width % columns or image.height % rows:
        raise ValueError(f"Atlas size {image.size} does not divide into {columns}x{rows}")
    width, height = image.width // columns, image.height // rows
    return [image.crop((column * width, row * height, (column + 1) * width, (row + 1) * height))
            for row in range(rows) for column in range(columns)]


def save_source(image: Image.Image, group: str, name: str, assets: dict) -> None:
    destination = OUTPUT_ROOT / group / f"{name}.png"
    destination.parent.mkdir(parents=True, exist_ok=True)
    image.save(destination, "PNG", optimize=True)
    spec = {"path": destination.relative_to(ROOT).as_posix(), "size": list(image.size)}
    if name in NINE_SLICE:
        spec["slice"] = NINE_SLICE[name]
    assets.setdefault(group, {})[name] = spec
    print(f"{group}/{name}: {image.width}x{image.height}")


def main() -> None:
    source_paths = {key: SOURCE_ROOT / name for key, name in SOURCES.items()}
    images = {key: Image.open(path).copy() for key, path in source_paths.items()}
    for name in ("logo", "frames", "icons"):
        if "A" not in images[name].getbands() or images[name].getchannel("A").getextrema()[0] != 0:
            raise ValueError(f"{name} must have real transparent pixels; do not import a baked checkerboard")
    assets = {}
    save_source(images["login"].convert("RGB"), "backgrounds", "login", assets)
    save_source(clean_cutout(images["logo"], multiple_parts=True, padding=24), "ui", "logo", assets)
    for name, cell in zip(FRAME_NAMES, split_grid(images["frames"], 2, 3)):
        save_source(clean_cutout(cell, padding=8), "ui", name, assets)
    for name, cell in zip(ICON_NAMES, split_grid(images["icons"], 3, 2)):
        cutout = clean_cutout(cell, multiple_parts=True, padding=16)
        square = Image.new("RGBA", (max(cutout.size),) * 2, (0, 0, 0, 0))
        square.alpha_composite(cutout, ((square.width - cutout.width) // 2, (square.height - cutout.height) // 2))
        save_source(square, "icons", name, assets)
    provenance = {
        "sources": {key: {"file": path.name, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
                    for key, path in source_paths.items()},
        "assets": assets,
    }
    (OUTPUT_ROOT / "source-manifest.json").write_text(json.dumps(provenance, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
