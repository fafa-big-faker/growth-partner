"""Import V6 flat quality marks and layered login artwork from measured alpha."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT.parent / "\u7f8e\u672f\u98ce\u683c\u53c2\u8003V6"
OUTPUT_ROOT = ROOT / "assets/images/v6"
SOURCE_SIZE = (1536, 1024)
MINIMUM_ALPHA = 5
PADDING = 12
SOURCES = {
    "quality": "\u4ed9\u6765V6-\u54c1\u8d28\u5fbd\u8bb0\u56fe\u96c6.png",
    "login": "\u4ed9\u6765V6-\u767b\u5f55\u6309\u94ae\u56fe\u96c6.png",
}
CONTENT_BOUNDS = {
    "quality-1": (209, 63, 356, 474),
    "quality-2": (689, 63, 834, 474),
    "quality-3": (1187, 63, 1333, 474),
    "quality-4": (208, 560, 354, 971),
    "quality-5": (688, 560, 834, 971),
    "login-brush": (39, 179, 1502, 495),
    "login-lettering": (220, 567, 1383, 904),
}
LOGIN_CELLS = {
    "login-brush": (0, 0, 1536, 512),
    "login-lettering": (0, 512, 1536, 1024),
}


def clean_alpha(image: Image.Image) -> Image.Image:
    cleaned = image.convert("RGBA")
    # Transparent pixels contain dark RGB; only alpha distinguishes them from ink.
    cleaned.putdata([pixel if pixel[3] >= MINIMUM_ALPHA else (0, 0, 0, 0)
                     for pixel in cleaned.get_flattened_data()])
    return cleaned


def padded_asset(image: Image.Image, padding: int = PADDING) -> tuple[Image.Image, tuple[int, int, int, int]]:
    cleaned = clean_alpha(image)
    bounds = cleaned.getchannel("A").getbbox()
    if not bounds:
        raise ValueError("Expected a nonempty artwork cell")
    if min(bounds[0], bounds[1], image.width - bounds[2], image.height - bounds[3]) < 3:
        raise ValueError("Artwork touches a cell edge; remeasure before importing")
    artwork = cleaned.crop(bounds)
    result = Image.new("RGBA", (artwork.width + padding * 2, artwork.height + padding * 2))
    result.paste(artwork, (padding, padding))
    return result, bounds


def save_asset(image: Image.Image, group: str, name: str, assets: dict, *, source: str,
               cell: tuple[int, int, int, int]) -> None:
    output, local = padded_asset(image.crop(cell))
    bounds = (local[0] + cell[0], local[1] + cell[1], local[2] + cell[0], local[3] + cell[1])
    if bounds != CONTENT_BOUNDS[name]:
        raise ValueError(f"Artwork {name} outline changed; remeasure the source")
    destination = OUTPUT_ROOT / group / f"{name}.png"
    destination.parent.mkdir(parents=True, exist_ok=True)
    output.save(destination, "PNG", optimize=True)
    assets[group][name] = {
        "path": destination.relative_to(ROOT).as_posix(),
        "size": list(output.size),
        "source": source,
        "cell": list(cell),
        "contentBounds": list(bounds),
        "padding": PADDING,
        "alphaRange": list(output.getchannel("A").getextrema()),
    }
    print(f"{group}/{name}: {output.width}x{output.height}")


def main() -> None:
    images = {}
    sources = {}
    for key, filename in SOURCES.items():
        path = SOURCE_ROOT / filename
        with Image.open(path) as source:
            image = source.copy()
        if image.size != SOURCE_SIZE or image.mode != "RGBA":
            raise ValueError(f"Source {key} dimensions or mode changed; remeasure the atlas")
        alpha_range = image.getchannel("A").getextrema()
        if alpha_range != (0, 254):
            raise ValueError(f"Source {key} alpha changed; verify transparency before importing")
        images[key] = image
        sources[key] = {
            "file": filename,
            "size": list(image.size),
            "mode": image.mode,
            "alphaRange": list(alpha_range),
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        }

    if clean_alpha(images["quality"].crop((1024, 512, 1536, 1024))).getchannel("A").getbbox():
        raise ValueError("Expected the sixth quality cell to remain empty")

    assets = {"quality": {}, "ui": {}}
    for index in range(5):
        row, column = divmod(index, 3)
        cell = (column * 512, row * 512, (column + 1) * 512, (row + 1) * 512)
        save_asset(images["quality"], "quality", f"quality-{index + 1}", assets, source="quality", cell=cell)
    for name, cell in LOGIN_CELLS.items():
        save_asset(images["login"], "ui", name, assets, source="login", cell=cell)

    manifest = {"sources": sources, "assets": assets, "minimumAlpha": MINIMUM_ALPHA}
    (OUTPUT_ROOT / "source-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Imported 5 quality marks and 2 login layers; original atlases unchanged")


if __name__ == "__main__":
    main()
