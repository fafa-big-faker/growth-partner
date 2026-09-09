"""Preserve the official calligraphy and seal inside Android launcher masks."""
from pathlib import Path
import hashlib
import json
import math
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT.parent.parent / "美术风格参考V7/仙来-应用图标.png"
WEB = ROOT.parent / "assets/runtime/app-icon"


def digest(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()


def reflect_index(position, size):
    position %= size * 2
    return position if position < size else size * 2 - position - 1


def main():
    assert digest(SOURCE) == "1d00b2ad129a1d2e033afa129c37b0bb3b1d8128bdb769dec4eb5be767004a0a", \
        "Official source artwork changed: remeasure its ink, seal and mask safety before exporting."
    original = Image.open(SOURCE).convert("RGBA")
    assert original.size == (1254, 1254), "Source dimensions changed: remeasure the official artwork."
    assert original.getchannel("A").getextrema() == (255, 255), "Expected the approved opaque paper artwork."
    width, height = original.size
    # Preserve all dark calligraphy and red stamp pixels, including detached brush fragments.
    points = []
    for y in range(height):
        for x in range(width):
            red, green, blue, alpha = original.getpixel((x, y))
            if max(red, green, blue) < 135 or (red > 110 and red > green * 1.3 and red > blue * 1.3):
                points.append((x, y))
    assert points, "Calligraphy and seal were not detected."
    center = ((width - 1) / 2, (height - 1) / 2)
    radius = max(math.hypot(x - center[0], y - center[1]) for x, y in points)
    # Android's default mask fits in the central 72/108 of its foreground. The
    # invariant safe disk is 66/108; keep every measured mark another 4 px inside it.
    safe_radius = 324 * 33 / 108 - 4
    scaled_size = min(324, math.floor(width * safe_radius / radius))
    scaled = original.resize((scaled_size, scaled_size), Image.Resampling.LANCZOS)
    offset = (324 - scaled_size) // 2
    # Reflection continues the real paper texture at every edge with no flat inset frame.
    canvas = Image.new("RGBA", (324, 324))
    for y in range(324):
        for x in range(324):
            canvas.putpixel((x, y), scaled.getpixel((reflect_index(x - offset, scaled_size),
                                                   reflect_index(y - offset, scaled_size))))
    mapped = [(offset + (x + 0.5) * scaled_size / width,
               offset + (y + 0.5) * scaled_size / height) for x, y in points]
    max_radius = max(math.hypot(x - 162, y - 162) for x, y in mapped)
    assert max_radius <= 99, "A foreground mark falls outside Android's invariant safe disk."
    visible = canvas.crop((54, 54, 270, 270))
    circle = Image.new("L", (216, 216))
    ImageDraw.Draw(circle).ellipse((0, 0, 215, 215), fill=255)
    rounded = Image.new("L", (216, 216))
    ImageDraw.Draw(rounded).rounded_rectangle((0, 0, 215, 215), radius=48, fill=255)
    for name, mask in (("circle", circle), ("rounded-square", rounded)):
        clipped = sum(mask.getpixel((int(x - 54), int(y - 54))) == 0 for x, y in mapped)
        assert clipped == 0, f"The {name} mask clips {clipped} subject pixels."
    foreground = ROOT / "app/src/main/res/drawable-nodpi/launcher_foreground.png"
    legacy = ROOT / "app/src/main/res/mipmap-xxxhdpi/ic_launcher.png"
    canvas.save(foreground, optimize=True)
    visible.resize((192, 192), Image.Resampling.LANCZOS).save(legacy, optimize=True)
    WEB.mkdir(parents=True, exist_ok=True)
    for name, size in (("favicon.png", 64), ("apple-touch-icon.png", 180)):
        visible.resize((size, size), Image.Resampling.LANCZOS).save(WEB / name, optimize=True)
    metadata = {
        "source": SOURCE.name,
        "source_sha256": digest(SOURCE),
        "source_size": list(original.size),
        "source_alpha": [255, 255],
        "mode": "official-artwork-reflected-paper",
        "subject_source_bounds": [min(x for x, _ in points), min(y for _, y in points),
                                  max(x for x, _ in points) + 1, max(y for _, y in points) + 1],
        "foreground": "324x324; original artwork scaled uniformly; real edge paper reflected outward",
        "source_scaled_size": scaled_size,
        "source_offset": [offset, offset],
        "subject_radius_px": round(max_radius, 4),
        "adaptive_invariant_safe_radius_px": 99,
        "default_circle_radius_px": 108,
        "subject_pixels_clipped_circle": 0,
        "subject_pixels_clipped_rounded_square": 0,
        "foreground_sha256": digest(foreground),
        "legacy_sha256": digest(legacy),
        "web_icons": {name: {"size": size, "sha256": digest(WEB / name)}
                      for name, size in (("favicon.png", 64), ("apple-touch-icon.png", 180))},
    }
    (ROOT / "icon-source.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (WEB / "manifest.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    # Local asset review only: demonstrate actual masks, without opening a player session.
    preview = Image.new("RGB", (720, 256), "#e9e6df")
    for index, mask in enumerate((circle, rounded, Image.new("L", (216, 216), 255))):
        tile = visible.copy()
        tile.putalpha(mask)
        preview.paste(tile, (index * 240 + 12, 20), tile)
    preview_path = ROOT / "build/official-icon-mask-check.png"
    preview_path.parent.mkdir(parents=True, exist_ok=True)
    preview.save(preview_path)
    print(json.dumps({"source_size": original.size, "alpha": [255, 255],
                      "scaled_size": scaled_size, "subject_radius": round(max_radius, 4),
                      "safe_radius": 99, "clipped_subject_pixels": 0,
                      "source_sha256": metadata["source_sha256"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
