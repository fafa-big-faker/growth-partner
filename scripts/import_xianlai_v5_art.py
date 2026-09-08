"""Import the approved V5 paper and ink atlases without touching the originals."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT.parent / "\u7f8e\u672f\u98ce\u683c\u53c2\u8003V\uff15"
OUTPUT_ROOT = ROOT / "assets/images/v5"
SOURCE_SIZE = (1536, 1024)
SOURCES = {
    "paper": "\u4ed9\u6765V5-\u4efb\u52a1\u5546\u54c1\u7eb8\u7b3a\u56fe\u96c6.png",
    "ink": "\u4ed9\u6765V5-\u58a8\u5f71\u56fe\u96c6.png",
}
PAPER_CELLS = {
    "task-paper": (0, 0, 1536, 512),
    "shop-paper": (0, 512, 1536, 1024),
}
PAPER_BOUNDS = {
    "task-paper": (25, 163, 1513, 454),
    "shop-paper": (25, 572, 1513, 861),
}
# Top/right/bottom/left include padding and the measured bamboo or orchid corner.
PAPER_SLICES = {
    "task-paper": [136, 96, 80, 192],
    "shop-paper": [88, 204, 192, 96],
}
INK_COLOUR = (39, 44, 42)
WHITE_LEVEL = 246


def clean_paper_alpha(image: Image.Image) -> Image.Image:
    cleaned = image.convert("RGBA")
    cleaned.putdata([pixel if pixel[3] >= 5 else (0, 0, 0, 0)
                     for pixel in cleaned.get_flattened_data()])
    return cleaned


def padded_paper(image: Image.Image, padding: int = 12) -> tuple[Image.Image, tuple[int, int, int, int]]:
    cleaned = clean_paper_alpha(image)
    bounds = cleaned.getchannel("A").getbbox()
    if not bounds:
        raise ValueError("Expected a nonempty paper frame")
    if min(bounds[0], bounds[1], image.width - bounds[2], image.height - bounds[3]) < 3:
        raise ValueError("Paper artwork touches a cell edge; remeasure its source")
    artwork = cleaned.crop(bounds)
    result = Image.new("RGBA", (artwork.width + padding * 2, artwork.height + padding * 2))
    result.alpha_composite(artwork, (padding, padding))
    return result, bounds


def ink_to_alpha(image: Image.Image) -> Image.Image:
    luminance = ImageOps.grayscale(image)
    # Subtract only the near-white substrate, keeping the wash's graded opacity.
    lookup = [max(0, round((WHITE_LEVEL - value) * 255 / WHITE_LEVEL)) for value in range(256)]
    lookup = [value if value >= 4 else 0 for value in lookup]
    alpha = luminance.point(lookup)
    output = Image.new("RGBA", image.size)
    output.putdata([(*INK_COLOUR, value) if value else (0, 0, 0, 0)
                    for value in alpha.get_flattened_data()])
    return output


def save_asset(image: Image.Image, group: str, name: str, assets: dict, *, source: str,
               cell: tuple[int, int, int, int], bounds: tuple[int, int, int, int], padding: int = 0) -> None:
    destination = OUTPUT_ROOT / group / f"{name}.png"
    destination.parent.mkdir(parents=True, exist_ok=True)
    image.save(destination, "PNG", optimize=True)
    spec = {
        "path": destination.relative_to(ROOT).as_posix(),
        "size": list(image.size),
        "source": source,
        "cell": list(cell),
        "contentBounds": list(bounds),
        "padding": padding,
        "alphaRange": list(image.getchannel("A").getextrema()),
    }
    if name in PAPER_SLICES:
        spec["slice"] = PAPER_SLICES[name]
    assets[group][name] = spec
    print(f"{group}/{name}: {image.width}x{image.height}")


def main() -> None:
    images = {}
    sources = {}
    for key, filename in SOURCES.items():
        path = SOURCE_ROOT / filename
        with Image.open(path) as source:
            image = source.copy()
        if image.size != SOURCE_SIZE:
            raise ValueError(f"Source {key} changed dimensions; remeasure the atlas")
        expected_mode = "RGBA" if key == "paper" else "RGB"
        if image.mode != expected_mode:
            raise ValueError(f"Expected {expected_mode} for the {key} atlas")
        if key == "paper" and image.getchannel("A").getextrema() != (0, 254):
            raise ValueError("Paper alpha changed; verify transparency before importing")
        images[key] = image
        sources[key] = {
            "file": filename, "size": list(image.size), "mode": image.mode,
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        }

    assets = {"ui": {}, "effects": {}}
    for name, cell in PAPER_CELLS.items():
        output, local_bounds = padded_paper(images["paper"].crop(cell))
        bounds = (local_bounds[0] + cell[0], local_bounds[1] + cell[1],
                  local_bounds[2] + cell[0], local_bounds[3] + cell[1])
        if bounds != PAPER_BOUNDS[name]:
            raise ValueError(f"Paper {name} outline changed; remeasure corner slices")
        save_asset(output, "ui", name, assets, source="paper", cell=cell, bounds=bounds, padding=12)

    for index in range(6):
        row, column = divmod(index, 3)
        cell = (column * 512, row * 512, (column + 1) * 512, (row + 1) * 512)
        output = ink_to_alpha(images["ink"].crop(cell))
        local_bounds = output.getchannel("A").getbbox()
        if not local_bounds or min(local_bounds[0], local_bounds[1], 512 - local_bounds[2], 512 - local_bounds[3]) < 3:
            raise ValueError(f"Ink cell {index + 1} is empty or touches another cell")
        bounds = (local_bounds[0] + cell[0], local_bounds[1] + cell[1],
                  local_bounds[2] + cell[0], local_bounds[3] + cell[1])
        save_asset(output, "effects", f"ink-{index + 1:02d}", assets, source="ink", cell=cell, bounds=bounds)

    manifest = {"sources": sources, "assets": assets,
                "inkConversion": {"whiteLevel": WHITE_LEVEL, "colour": list(INK_COLOUR), "minimumAlpha": 4}}
    (OUTPUT_ROOT / "source-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Imported 2 paper frames and 6 ink textures; original atlases unchanged")


if __name__ == "__main__":
    main()
