"""Import the approved V4 atlases using their measured transparent gutters."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT.parent / "\u7f8e\u672f\u98ce\u683c\u53c2\u8003V4"
OUTPUT_ROOT = ROOT / "assets/images/v4"
SOURCES = {
    "basic": ("\u57fa\u7840\u4e0e\u6210\u957f\u9053\u5177.png", (1254, 1254)),
    "exchange": ("\u4ed9\u6765V4-\u5408\u6210\u5151\u6362\u56fe\u96c6.png", (1448, 1086)),
    "axes": ("\u4ed9\u6765V4-\u65a7\u5934\u56fe\u96c6.png", (1254, 1254)),
    "slots": ("\u4ed9\u6765V4-\u7269\u54c1\u6846\u56fe\u96c6.png", (1448, 1086)),
    "modal": ("\u4ed9\u6765V4-\u901a\u7528\u5f39\u7a97.png", (1122, 1402)),
    "forge": ("\u4ed9\u6765V4-\u953b\u9020\u56fe\u96c6.png", (1774, 887)),
}
BASIC_IDS = ("0", "1", "30001", "30101", "30201", "40001", "40002")
# 星/月系列的道具 ID 已在配置中对换；保持图集单元格与最终文件名一致。
EXCHANGE_IDS = ("10101", "10001", "10201", "10301", "10102", "10002", "10202", "10302", "20101", "20001", "20201", "20301")
AXE_IDS = ("51001", "51002", "52001", "52002", "53001", "53002", "54001", "54002", "55001")

# These gutters are measured from alpha, not the requested AI canvas grid.
ATLAS_CUTS = {
    "basic": ((0, 442, 847, 1254), (0, 473, 827, 1254)),
    "exchange": ((0, 377, 729, 1075, 1448), (0, 373, 708, 1086)),
    "axes": ((0, 436, 856, 1254), (0, 434, 825, 1254)),
    "slots": ((0, 824, 1448), (0, 1086)),
    "forge": ((0, 844, 1774), (0, 887)),
}
NINE_SLICE = {
    "slot-item": [86, 86, 86, 86],
    "slot-weapon": [86, 86, 86, 86],
    "modal-paper": [172, 100, 104, 196],
    "button-forge": [44, 178, 66, 124],
}


def clean_alpha(image: Image.Image) -> Image.Image:
    result = image.convert("RGBA")
    # Generated edges contain vivid RGB noise at alpha 1. Keep opaque ink and
    # legitimate coloured flames; never remove colours or select one component.
    result.putalpha(result.getchannel("A").point(lambda value: 0 if value < 5 else value))
    return result


def split_atlas(image: Image.Image, key: str) -> list[tuple[Image.Image, tuple[int, int, int, int]]]:
    xs, ys = ATLAS_CUTS[key]
    return [(image.crop(box), box)
            for row in range(len(ys) - 1)
            for column in range(len(xs) - 1)
            for box in [(xs[column], ys[row], xs[column + 1], ys[row + 1])]]


def padded_cutout(image: Image.Image, *, aspect: str | None = None, padding: int = 16) -> tuple[Image.Image, tuple[int, int, int, int]]:
    cleaned = clean_alpha(image)
    bounds = cleaned.getchannel("A").getbbox()
    if not bounds:
        raise ValueError("Expected an independent nonempty atlas resource")
    if min(bounds[0], bounds[1], image.width - bounds[2], image.height - bounds[3]) < 3:
        raise ValueError(f"Artwork touches a crop edge: {bounds} within {image.size}")
    artwork = cleaned.crop(bounds)
    width, height = artwork.width + padding * 2, artwork.height + padding * 2
    if aspect == "square":
        width = height = max(width, height)
    elif aspect == "weapon":
        unit = math.ceil(max(width / 3, height / 4))
        width, height = unit * 3, unit * 4
    result = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    result.alpha_composite(artwork, ((width - artwork.width) // 2, (height - artwork.height) // 2))
    return result, bounds


def save_asset(image: Image.Image, group: str, name: str, assets: dict, *, source: str, cell: tuple[int, int, int, int], aspect: str | None = None, padding: int = 16) -> None:
    cutout, bounds = padded_cutout(image, aspect=aspect, padding=padding)
    destination = OUTPUT_ROOT / group / f"{name}.png"
    destination.parent.mkdir(parents=True, exist_ok=True)
    cutout.save(destination, "PNG", optimize=True)
    spec = {
        "path": destination.relative_to(ROOT).as_posix(),
        "size": list(cutout.size),
        "source": source,
        "cell": list(cell),
        "contentBounds": [bounds[0] + cell[0], bounds[1] + cell[1], bounds[2] + cell[0], bounds[3] + cell[1]],
        "padding": padding,
    }
    if name in NINE_SLICE:
        spec["slice"] = NINE_SLICE[name]
    assets.setdefault(group, {})[name] = spec
    print(f"{group}/{name}: {cutout.width}x{cutout.height}")


def main() -> None:
    images = {}
    sources = {}
    for key, (filename, expected_size) in SOURCES.items():
        source = SOURCE_ROOT / filename
        with Image.open(source) as loaded:
            image = loaded.copy()
        if image.size != expected_size:
            raise ValueError(f"Source {key} changed size: measure its gutters before replacing {expected_size}")
        if image.mode != "RGBA" or image.getchannel("A").getextrema() != (0, 255):
            raise ValueError(f"Source {key} needs real transparency and opaque artwork")
        images[key] = image
        sources[key] = {"file": filename, "size": list(image.size), "sha256": hashlib.sha256(source.read_bytes()).hexdigest()}

    assets = {}
    for key, ids in (("basic", BASIC_IDS), ("exchange", EXCHANGE_IDS), ("axes", AXE_IDS)):
        cells = split_atlas(images[key], key)
        for item_id, (image, cell) in zip(ids, cells):
            save_asset(image, "items", item_id, assets, source=key, cell=cell, aspect="weapon" if key == "axes" else "square")
        for image, _ in cells[len(ids):]:
            if clean_alpha(image).getchannel("A").getbbox():
                raise ValueError(f"Unexpected artwork in the unused {key} atlas cells")
    for name, (image, cell) in zip(("slot-item", "slot-weapon"), split_atlas(images["slots"], "slots")):
        save_asset(image, "ui", name, assets, source="slots", cell=cell, padding=8)
    modal = images["modal"]
    save_asset(modal, "ui", "modal-paper", assets, source="modal", cell=(0, 0, modal.width, modal.height), padding=8)
    for name, (image, cell) in zip(("icon-forge", "button-forge"), split_atlas(images["forge"], "forge")):
        save_asset(image, "icons" if name == "icon-forge" else "ui", name, assets,
                   source="forge", cell=cell, aspect="square" if name == "icon-forge" else None)
    (OUTPUT_ROOT / "source-manifest.json").write_text(json.dumps({"sources": sources, "assets": assets}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Imported {sum(map(len, assets.values()))} independent V4 resources")


if __name__ == "__main__":
    main()
