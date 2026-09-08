"""Build compact WebP assets for browser delivery.

Source PNG/WebP files remain untouched under assets/images. Generated files live
under assets/runtime and can be recreated whenever source artwork changes.
"""

from __future__ import annotations

import argparse
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
V3_GROUP_LIMITS = {"backgrounds": (1600, 1200), "ui": (960, 512), "icons": (160, 160)}
V4_UI_LIMITS = {
    "slot-item": (256, 256),
    "slot-weapon": (256, 256),
    "modal-paper": (768, 960),
    "button-forge": (640, 192),
}


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


def build_v3_assets() -> tuple[dict, int, int, int]:
    source_manifest = SOURCE_ROOT / "v3/source-manifest.json"
    if not source_manifest.exists():
        return {}, 0, 0, 0
    specs = json.loads(source_manifest.read_text(encoding="utf-8"))["assets"]
    manifest = {}
    count = source_bytes = runtime_bytes = 0
    for group, assets in specs.items():
        manifest[group] = {}
        for name, spec in assets.items():
            source = ROOT / spec["path"]
            destination = RUNTIME_ROOT / "v3" / group / f"{name}.webp"
            with Image.open(source) as image:
                optimized = fit_within(image, V3_GROUP_LIMITS[group])
                save_webp(optimized, destination, quality=86 if group == "backgrounds" else 92)
                runtime_spec = {"path": destination.relative_to(ROOT).as_posix(), "size": list(optimized.size)}
                if "slice" in spec:
                    scale = optimized.width / image.width
                    runtime_spec["slice"] = [round(value * scale) for value in spec["slice"]]
                manifest[group][name] = runtime_spec
            source_bytes += source.stat().st_size
            runtime_bytes += destination.stat().st_size
            count += 1
    destination = RUNTIME_ROOT / "v3/manifest.json"
    destination.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return manifest, count, source_bytes, runtime_bytes


def build_v4_assets() -> tuple[dict, int, int, int]:
    source_manifest = SOURCE_ROOT / "v4/source-manifest.json"
    if not source_manifest.exists():
        return {}, 0, 0, 0
    specs = json.loads(source_manifest.read_text(encoding="utf-8"))["assets"]
    manifest = {}
    count = source_bytes = runtime_bytes = 0
    for group, assets in specs.items():
        manifest[group] = {}
        for name, spec in assets.items():
            source = ROOT / spec["path"]
            destination = RUNTIME_ROOT / "v4" / group / f"{name}.webp"
            if group == "ui":
                limit = V4_UI_LIMITS[name]
            else:
                limit = (192, 256) if group == "items" and name in AXE_IDS else (160, 160)
            with Image.open(source) as image:
                optimized = fit_within(image, limit)
                save_webp(optimized, destination, quality=92 if group == "ui" else 90)
                runtime_spec = {"path": destination.relative_to(ROOT).as_posix(), "size": list(optimized.size)}
                if "slice" in spec:
                    scale_x = optimized.width / image.width
                    scale_y = optimized.height / image.height
                    runtime_spec["slice"] = [round(value * (scale_y if index % 2 == 0 else scale_x))
                                             for index, value in enumerate(spec["slice"])]
                manifest[group][name] = runtime_spec
            source_bytes += source.stat().st_size
            runtime_bytes += destination.stat().st_size
            count += 1
    destination = RUNTIME_ROOT / "v4/manifest.json"
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return manifest, count, source_bytes, runtime_bytes


def build_v5_assets() -> tuple[dict, int, int, int]:
    source_manifest = SOURCE_ROOT / "v5/source-manifest.json"
    if not source_manifest.exists():
        return {}, 0, 0, 0
    specs = json.loads(source_manifest.read_text(encoding="utf-8"))["assets"]
    manifest = {}
    count = source_bytes = runtime_bytes = 0
    for group, assets in specs.items():
        manifest[group] = {}
        for name, spec in assets.items():
            source = ROOT / spec["path"]
            destination = RUNTIME_ROOT / "v5" / group / f"{name}.webp"
            with Image.open(source) as image:
                optimized = fit_within(image, (960, 960) if group == "ui" else (512, 512))
                save_webp(optimized, destination, quality=91 if group == "ui" else 88)
                runtime_spec = {
                    "path": destination.relative_to(ROOT).as_posix(),
                    "size": list(optimized.size),
                    "alphaRange": list(optimized.getchannel("A").getextrema()),
                    "bytes": destination.stat().st_size,
                }
                if "slice" in spec:
                    scale_x = optimized.width / image.width
                    scale_y = optimized.height / image.height
                    runtime_spec["slice"] = [round(value * (scale_y if index % 2 == 0 else scale_x))
                                             for index, value in enumerate(spec["slice"])]
                manifest[group][name] = runtime_spec
            source_bytes += source.stat().st_size
            runtime_bytes += destination.stat().st_size
            count += 1
    destination = RUNTIME_ROOT / "v5/manifest.json"
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return manifest, count, source_bytes, runtime_bytes


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--v5-only", action="store_true", help="Build only imported V5 assets, leaving existing runtime artwork untouched.")
    args = parser.parse_args()
    if args.v5_only:
        _, count, source_bytes, runtime_bytes = build_v5_assets()
        if not count:
            raise FileNotFoundError("Import V5 artwork before building its runtime assets")
        print(f"V5 assets: {count} ({mib(source_bytes):.2f} MiB -> {mib(runtime_bytes):.2f} MiB)")
        return
    character_count, character_source, character_runtime = build_character_frames()
    _, v2_count, v2_source, v2_runtime = build_v2_assets()
    _, v3_count, v3_source, v3_runtime = build_v3_assets()
    _, v4_count, v4_source, v4_runtime = build_v4_assets()
    _, v5_count, v5_source, v5_runtime = build_v5_assets()
    source_total = character_source + v2_source + v3_source + v4_source + v5_source
    runtime_total = character_runtime + v2_runtime + v3_runtime + v4_runtime + v5_runtime
    reduction = 100 * (1 - runtime_total / source_total) if source_total else 0
    print(f"Character frames: {character_count} ({mib(character_source):.2f} MiB -> {mib(character_runtime):.2f} MiB)")
    print(f"V2 assets: {v2_count} ({mib(v2_source):.2f} MiB -> {mib(v2_runtime):.2f} MiB)")
    print(f"V3 assets: {v3_count} ({mib(v3_source):.2f} MiB -> {mib(v3_runtime):.2f} MiB)")
    print(f"V4 assets: {v4_count} ({mib(v4_source):.2f} MiB -> {mib(v4_runtime):.2f} MiB)")
    print(f"V5 assets: {v5_count} ({mib(v5_source):.2f} MiB -> {mib(v5_runtime):.2f} MiB)")
    print(f"Total: {mib(source_total):.2f} MiB -> {mib(runtime_total):.2f} MiB ({reduction:.1f}% smaller)")


if __name__ == "__main__":
    main()
