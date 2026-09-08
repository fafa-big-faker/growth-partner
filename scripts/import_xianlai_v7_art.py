"""Import the approved V7 reward washes and inventory paper by measured alpha."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT.parent / "\u7f8e\u672f\u98ce\u683c\u53c2\u8003V7"
OUTPUT_ROOT = ROOT / "assets/images/v7"
MINIMUM_ALPHA = 5
PAPER_PADDING = 12
REWARD_SIZE = (256, 256)
SOURCES = {
    "paper": "\u4ed9\u6765V7-\u53cc\u680f\u80cc\u5305\u5e95\u7eb8.png",
    "rewards": "\u4ed9\u6765V7-\u5956\u52b1\u54c1\u8d28\u58a8\u56e2\u56fe\u96c6.png",
}
SOURCE_SIZES = {"paper": (1774, 887), "rewards": (1536, 1024)}
CONTENT_BOUNDS = {
    "inventory-paper": (61, 114, 1716, 773),
    "quality-1": (52, 80, 467, 448),
    "quality-2": (561, 76, 988, 448),
    "quality-3": (1068, 74, 1492, 448),
    "quality-4": (46, 580, 474, 957),
    "quality-5": (561, 580, 988, 959),
}
# Top/right/bottom/left include the complete cloud, leaf and wind corner ornaments.
PAPER_SLICE = [216, 320, 200, 380]


def clean_alpha(image: Image.Image) -> Image.Image:
    cleaned = image.convert("RGBA")
    # Alpha, not dark RGB hidden in transparent pixels, determines visible artwork.
    cleaned.putdata([pixel if pixel[3] >= MINIMUM_ALPHA else (0, 0, 0, 0)
                     for pixel in cleaned.get_flattened_data()])
    return cleaned


def measured_cell(image: Image.Image) -> tuple[Image.Image, tuple[int, int, int, int]]:
    cleaned = clean_alpha(image)
    bounds = cleaned.getchannel("A").getbbox()
    if not bounds:
        raise ValueError("Expected a nonempty artwork cell")
    if min(bounds[0], bounds[1], image.width - bounds[2], image.height - bounds[3]) < 3:
        raise ValueError("Artwork touches a cell edge; remeasure before importing")
    return cleaned, bounds


def make_reward(image: Image.Image) -> tuple[Image.Image, tuple[int, int, int, int]]:
    if image.size != (512, 512):
        raise ValueError("Expected a measured 512x512 reward cell")
    cleaned, bounds = measured_cell(image)
    return cleaned.resize(REWARD_SIZE, Image.Resampling.LANCZOS), bounds


def make_paper(image: Image.Image) -> tuple[Image.Image, tuple[int, int, int, int]]:
    cleaned, bounds = measured_cell(image)
    artwork = cleaned.crop(bounds)
    output = Image.new("RGBA", (artwork.width + PAPER_PADDING * 2, artwork.height + PAPER_PADDING * 2))
    output.paste(artwork, (PAPER_PADDING, PAPER_PADDING))
    return output, bounds


def save_asset(image: Image.Image, group: str, name: str, assets: dict, *, source: str,
               cell: tuple[int, int, int, int]) -> None:
    output, local = (make_reward if group == "rewards" else make_paper)(image.crop(cell))
    bounds = (local[0] + cell[0], local[1] + cell[1], local[2] + cell[0], local[3] + cell[1])
    if bounds != CONTENT_BOUNDS[name]:
        raise ValueError(f"Artwork {name} outline changed; remeasure the source")
    destination = OUTPUT_ROOT / group / f"{name}.png"
    destination.parent.mkdir(parents=True, exist_ok=True)
    output.save(destination, "PNG", optimize=True)
    spec = {
        "path": destination.relative_to(ROOT).as_posix(),
        "size": list(output.size),
        "source": source,
        "cell": list(cell),
        "contentBounds": list(bounds),
        "padding": 0 if group == "rewards" else PAPER_PADDING,
        "alphaRange": list(output.getchannel("A").getextrema()),
        "alphaBounds": list(output.getchannel("A").getbbox()),
    }
    if group == "ui":
        spec["slice"] = PAPER_SLICE
    assets[group][name] = spec
    print(f"{group}/{name}: {output.width}x{output.height}")


def main() -> None:
    images = {}
    sources = {}
    for key, filename in SOURCES.items():
        path = SOURCE_ROOT / filename
        with Image.open(path) as source:
            image = source.copy()
        if image.size != SOURCE_SIZES[key] or image.mode != "RGBA":
            raise ValueError(f"Source {key} dimensions or mode changed; remeasure the atlas")
        alpha_range = image.getchannel("A").getextrema()
        if alpha_range != (0, 255 if key == "paper" else 254):
            raise ValueError(f"Source {key} alpha changed; verify transparency before importing")
        images[key] = image
        sources[key] = {
            "file": filename,
            "size": list(image.size),
            "mode": image.mode,
            "alphaRange": list(alpha_range),
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        }

    if clean_alpha(images["rewards"].crop((1024, 512, 1536, 1024))).getchannel("A").getbbox():
        raise ValueError("Expected the sixth reward cell to remain empty")

    assets = {"rewards": {}, "ui": {}}
    for index in range(5):
        row, column = divmod(index, 3)
        cell = (column * 512, row * 512, (column + 1) * 512, (row + 1) * 512)
        save_asset(images["rewards"], "rewards", f"quality-{index + 1}", assets, source="rewards", cell=cell)
    save_asset(images["paper"], "ui", "inventory-paper", assets, source="paper", cell=(0, 0, 1774, 887))

    manifest = {"sources": sources, "assets": assets, "minimumAlpha": MINIMUM_ALPHA}
    (OUTPUT_ROOT / "source-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Imported 5 reward washes and 1 inventory paper; original atlases unchanged")


if __name__ == "__main__":
    main()
