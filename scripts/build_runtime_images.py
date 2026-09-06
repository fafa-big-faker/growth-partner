"""Build compact WebP assets for browser delivery.

Source PNG/WebP files remain untouched under assets/images. Generated files live
under assets/runtime and can be recreated whenever source artwork changes.
"""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT / "assets" / "images"
RUNTIME_ROOT = ROOT / "assets" / "runtime"
AXE_IDS = ("51001", "51002", "52001", "52002", "53001", "53002", "54001", "54002", "55001")
CHARACTER_SIZE = (256, 512)
GROUP_LIMITS = {
    "backgrounds": (1600, 1000),
    "trees": (512, 512),
    "ui": (256, 256),
    "icons": (160, 160),
    "effects": (160, 160),
}
IMAGE_SUFFIXES = {".png", ".webp", ".jpg", ".jpeg"}


def save_webp(image: Image.Image, destination: Path, quality: int) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    converted = image.convert("RGBA") if "A" in image.getbands() else image.convert("RGB")
    converted.save(destination, "WEBP", quality=quality, method=6, exact=True)


def build_character_frames() -> tuple[int, int, int]:
    source_bytes = 0
    runtime_bytes = 0
    count = 0
    for group, frame_count in (("idle-axes", 4), ("axes", 6)):
        for axe_id in AXE_IDS:
            for frame_number in range(1, frame_count + 1):
                source = SOURCE_ROOT / "character" / group / axe_id / f"frame-{frame_number:02d}.png"
                destination = RUNTIME_ROOT / "character" / group / axe_id / f"frame-{frame_number:02d}.webp"
                if not source.exists():
                    raise FileNotFoundError(f"Missing character source: {source.relative_to(ROOT)}")
                with Image.open(source) as image:
                    frame = image.convert("RGBA").resize(CHARACTER_SIZE, Image.Resampling.LANCZOS)
                    save_webp(frame, destination, quality=90)
                source_bytes += source.stat().st_size
                runtime_bytes += destination.stat().st_size
                count += 1
    return count, source_bytes, runtime_bytes


def fit_within(image: Image.Image, limit: tuple[int, int]) -> Image.Image:
    max_width, max_height = limit
    scale = min(1.0, max_width / image.width, max_height / image.height)
    if scale >= 1.0:
        return image.copy()
    size = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
    return image.resize(size, Image.Resampling.LANCZOS)


def build_v2_assets() -> tuple[dict[str, dict[str, str]], int, int, int]:
    source_v2 = SOURCE_ROOT / "v2"
    manifest: dict[str, dict[str, str]] = {}
    source_bytes = 0
    runtime_bytes = 0
    count = 0
    for group, limit in GROUP_LIMITS.items():
        group_manifest: dict[str, str] = {}
        group_root = source_v2 / group
        for source in sorted(group_root.iterdir()):
            if not source.is_file() or source.suffix.lower() not in IMAGE_SUFFIXES:
                continue
            destination = RUNTIME_ROOT / "v2" / group / f"{source.stem}.webp"
            with Image.open(source) as image:
                optimized = fit_within(image, limit)
                quality = 84 if group == "backgrounds" else 90
                save_webp(optimized, destination, quality=quality)
            key = source.stem
            group_manifest[key] = destination.relative_to(ROOT).as_posix()
            source_bytes += source.stat().st_size
            runtime_bytes += destination.stat().st_size
            count += 1
        manifest[group] = group_manifest

    manifest_path = RUNTIME_ROOT / "v2" / "manifest.json"
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return manifest, count, source_bytes, runtime_bytes


def mib(byte_count: int) -> float:
    return byte_count / (1024 * 1024)


def main() -> None:
    character_count, character_source, character_runtime = build_character_frames()
    _, v2_count, v2_source, v2_runtime = build_v2_assets()
    source_total = character_source + v2_source
    runtime_total = character_runtime + v2_runtime
    reduction = 100 * (1 - runtime_total / source_total) if source_total else 0
    print(f"Character frames: {character_count} ({mib(character_source):.2f} MiB -> {mib(character_runtime):.2f} MiB)")
    print(f"V2 assets: {v2_count} ({mib(v2_source):.2f} MiB -> {mib(v2_runtime):.2f} MiB)")
    print(f"Total: {mib(source_total):.2f} MiB -> {mib(runtime_total):.2f} MiB ({reduction:.1f}% smaller)")


if __name__ == "__main__":
    main()
