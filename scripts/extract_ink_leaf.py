"""Extract a quiet pixel leaf from existing V2 artwork, leaving originals intact."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageOps


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/images/v2/effects/effect-leaf-green.png"
OUTPUT = ROOT / "assets/images/effects/leaf-ink.png"
RUNTIME = ROOT / "assets/runtime/effects/leaf-ink.webp"
TRACE = ROOT / "assets/images/effects/leaf-ink-source.json"
SOURCE_SIZE = (264, 257)
LEAF_OUTLINE = (
    (211, 22), (224, 52), (225, 84), (216, 119), (205, 151),
    (190, 176), (164, 194), (137, 202), (111, 198), (97, 191),
    (87, 207), (79, 215), (74, 212), (83, 193), (92, 178),
    (94, 151), (101, 124), (115, 97), (135, 78), (163, 61),
    (184, 52), (199, 39),
)


def extract_leaf() -> Image.Image:
    with Image.open(SOURCE) as source:
        image = source.convert("RGBA")
    if image.size != SOURCE_SIZE:
        raise ValueError("The original atlas changed; remeasure the leaf outline first.")

    mask = Image.new("L", image.size)
    ImageDraw.Draw(mask).polygon(LEAF_OUTLINE, fill=255)
    alpha = ImageChops.multiply(mask, image.getchannel("A"))
    clean_alpha = []
    for (red, green, blue, _), opacity in zip(image.get_flattened_data(), alpha.get_flattened_data()):
        chroma_edge = red > green * 1.13 and blue > green * 1.12
        clean_alpha.append(0 if chroma_edge or opacity < 24 else opacity)
    alpha.putdata(clean_alpha)

    # A cool sage ramp keeps the original pixel veins without luminous yellow.
    leaf = ImageOps.colorize(ImageOps.grayscale(image), "#243c36", "#c2d7c9").convert("RGBA")
    leaf.putalpha(alpha)
    leaf = leaf.crop(alpha.getbbox())
    leaf.thumbnail((44, 60), Image.Resampling.NEAREST)
    canvas = Image.new("RGBA", (48, 64))
    canvas.alpha_composite(leaf, ((48 - leaf.width) // 2, (64 - leaf.height) // 2))
    return canvas


def encoded(image: Image.Image, format_name: str, **options) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, format_name, **options)
    return buffer.getvalue()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Verify outputs without overwriting them.")
    args = parser.parse_args()
    leaf = extract_leaf()
    png = encoded(leaf, "PNG", optimize=True)
    webp = encoded(leaf, "WEBP", lossless=True, method=6, exact=True)
    trace = {
        "source": SOURCE.relative_to(ROOT).as_posix(),
        "source_sha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        "source_size": SOURCE_SIZE,
        "outline": LEAF_OUTLINE,
        "output_size": leaf.size,
        "palette": ["#243c36", "#c2d7c9"],
        "runtime": RUNTIME.relative_to(ROOT).as_posix(),
        "script": "scripts/extract_ink_leaf.py",
    }
    outputs = {
        OUTPUT: png,
        RUNTIME: webp,
        TRACE: (json.dumps(trace, indent=2) + "\n").encode("utf-8"),
    }
    if leaf.getchannel("A").getextrema() != (0, 255) or len(webp) > 4096:
        raise ValueError("The leaf must remain transparent and under 4 KiB.")
    for path, payload in outputs.items():
        if args.check:
            if not path.exists() or path.read_bytes() != payload:
                raise ValueError(f"Output differs: {path.relative_to(ROOT)}")
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(payload)
    print(f"Ink leaf: 48x64 RGBA, {len(webp)} bytes; " + ("verified" if args.check else "generated"))


if __name__ == "__main__":
    main()
