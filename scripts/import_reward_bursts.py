"""Import the two approved twelve-frame reward bursts without re-centering frames."""
from pathlib import Path
import argparse
import hashlib
import io
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIRECTORY = ROOT.parent / "美术风格参考V7"
IMAGE_DIRECTORY = ROOT / "assets/images/reward-bursts"
RUNTIME_DIRECTORY = ROOT / "assets/runtime/reward-bursts"
SOURCES = {
    "rare": ("掉落特效-珍品.png", "98a0b7f04e36e73ba1cdbcd58cf59f596fb7068bd15be931bc02eba9e062174c"),
    "high": ("掉落特效-神仙品.png", "cfcfda32b70833658f72c6cf87b68913ba2f3954f81b5f0adeb4594ce5292979"),
}
SOURCE_SIZE = (1448, 1086)
SOURCE_FRAME = 362
FRAME_SIZE = 256
CONTENT_SIZE = 224
PADDING = 16
COLUMNS, ROWS = 4, 3
FRAME_COUNT = COLUMNS * ROWS
VERSION = "reward-burst-20260910"
BUDGET = 600 * 1024


def sha(data):
    return hashlib.sha256(data).hexdigest()


def json_bytes(data):
    return (json.dumps(data, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def encode(image, kind):
    buffer = io.BytesIO()
    if kind == "PNG":
        image.save(buffer, format=kind, optimize=True)
    else:
        image.save(buffer, format=kind, quality=90, method=6, exact=True)
    return buffer.getvalue()


def source_box(index):
    left, top = index % COLUMNS * SOURCE_FRAME, index // COLUMNS * SOURCE_FRAME
    return (left, top, left + SOURCE_FRAME, top + SOURCE_FRAME)


def alpha_bounds(image, threshold=5):
    bounds = image.getchannel("A").point(lambda value: 255 if value >= threshold else 0).getbbox()
    return list(bounds) if bounds else None


def runtime_frame(original):
    # Keep every frame's whole canvas and shared center, including faint final fragments.
    cleaned = original.copy()
    cleaned.putalpha(cleaned.getchannel("A").point(lambda value: value if value >= 5 else 0))
    resized = cleaned.resize((CONTENT_SIZE, CONTENT_SIZE), Image.Resampling.LANCZOS)
    frame = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE))
    frame.paste(resized, (PADDING, PADDING))
    return frame


def generate():
    outputs = {}
    source_manifest = {
        "version": VERSION,
        "grid": {"columns": COLUMNS, "rows": ROWS, "frame_count": FRAME_COUNT, "order": "row-major"},
        "treatment": "Archive exact source cells; runtime clears only alpha<5 noise, uniformly resizes each complete 362px cell to 224px and adds 16px transparent padding. No per-frame crop, centering, color replacement or omitted frames.",
        "sources": {},
    }
    runtime_manifest = {
        "version": VERSION,
        "columns": COLUMNS, "rows": ROWS, "frame_count": FRAME_COUNT,
        "frame_width": FRAME_SIZE, "frame_height": FRAME_SIZE,
        "frame_anchor": [FRAME_SIZE // 2, FRAME_SIZE // 2],
        "content_size": CONTENT_SIZE, "padding": PADDING,
        "quality": 90, "method": 6, "alpha_lossless": True,
        "budget_bytes": BUDGET, "assets": {},
    }
    for key, (name, fingerprint) in SOURCES.items():
        source_data = (SOURCE_DIRECTORY / name).read_bytes()
        if sha(source_data) != fingerprint:
            raise ValueError(f"Source artwork changed: inspect {name} and update its measured contract before importing.")
        with Image.open(io.BytesIO(source_data)) as opened:
            if opened.mode != "RGBA" or opened.size != SOURCE_SIZE:
                raise ValueError(f"Expected approved RGBA {SOURCE_SIZE} artwork: {name}")
            source = opened.copy()
        if source.getchannel("A").getextrema()[0] != 0:
            raise ValueError(f"Expected genuine transparent background: {name}")
        atlas = Image.new("RGBA", (COLUMNS * FRAME_SIZE, ROWS * FRAME_SIZE))
        source_frames, frames = [], []
        for index in range(FRAME_COUNT):
            box = source_box(index)
            original = source.crop(box)
            archive_path = IMAGE_DIRECTORY / key / f"frame-{index + 1:02d}.png"
            archive = encode(original, "PNG")
            outputs[archive_path] = archive
            source_frames.append({
                "index": index, "box": list(box), "alpha_bounds": alpha_bounds(original),
                "path": archive_path.relative_to(ROOT).as_posix(),
                "bytes": len(archive), "sha256": sha(archive),
            })
            frame = runtime_frame(original)
            left, top = index % COLUMNS * FRAME_SIZE, index // COLUMNS * FRAME_SIZE
            atlas.paste(frame, (left, top))
            frames.append({
                "index": index, "x": left, "y": top,
                "alpha_bounds": alpha_bounds(frame, threshold=1),
            })
        path = RUNTIME_DIRECTORY / f"{key}.webp"
        data = encode(atlas, "WEBP")
        outputs[path] = data
        source_manifest["sources"][key] = {
            "name": name, "size": list(source.size), "mode": source.mode,
            "alpha": list(source.getchannel("A").getextrema()),
            "bytes": len(source_data), "sha256": fingerprint,
            "frame_size": SOURCE_FRAME, "frames": source_frames,
        }
        runtime_manifest["assets"][key] = {
            "url": f"{path.relative_to(ROOT).as_posix()}?v={VERSION}",
            "width": atlas.width, "height": atlas.height,
            "bytes": len(data), "sha256": sha(data), "source_sha256": fingerprint,
            "frames": frames,
        }
    runtime_manifest["total_bytes"] = sum(item["bytes"] for item in runtime_manifest["assets"].values())
    if runtime_manifest["total_bytes"] > BUDGET:
        raise ValueError("Reward atlases exceed 600 KiB; inspect before reducing resolution or quality.")
    outputs[IMAGE_DIRECTORY / "source-manifest.json"] = json_bytes(source_manifest)
    outputs[RUNTIME_DIRECTORY / "manifest.json"] = json_bytes(runtime_manifest)
    return outputs, source_manifest, runtime_manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Rebuild in memory and compare all outputs without writing.")
    args = parser.parse_args()
    outputs, source, runtime = generate()
    for path, data in outputs.items():
        if args.check:
            if not path.is_file() or path.read_bytes() != data:
                raise SystemExit(f"Reward burst differs: {path.relative_to(ROOT)}")
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
    print(json.dumps({"checked": args.check, "source_size": list(SOURCE_SIZE),
                      "frames": len(SOURCES) * FRAME_COUNT,
                      "frame_size": FRAME_SIZE, "runtime_bytes": runtime["total_bytes"],
                      "assets": {key: {field: asset[field] for field in ("url", "width", "height", "bytes")}
                                 for key, asset in runtime["assets"].items()}}, ensure_ascii=False))


if __name__ == "__main__":
    main()
