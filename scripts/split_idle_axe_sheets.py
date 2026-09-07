import json
import hashlib
import re
from pathlib import Path

from PIL import Image


FRAME_COUNT = 4
FRAME_SIZE = (362, 724)
SAFE_MARGIN_X = 12
BASELINE_MARGIN = 8
REPO_ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = REPO_ROOT.parent / "待机斧头对应帧"
OUTPUT_ROOT = REPO_ROOT / "assets" / "images" / "character" / "idle-axes"
ALIGNMENT_PATH = Path(__file__).with_name("idle_frame_offsets.json")
ALIGNMENT = json.loads(ALIGNMENT_PATH.read_text(encoding="utf-8"))
FRAME_OFFSETS = ALIGNMENT["offsets"]


def validate_source(source_path: Path, item_id: str) -> None:
    expected = ALIGNMENT["source_sha256"].get(item_id)
    if not expected or hashlib.sha256(source_path.read_bytes()).hexdigest() != expected:
        raise ValueError(f"Idle source changed for {item_id}; recalibrate idle_frame_offsets.json before splitting")


def build_frames(source_path: Path) -> tuple[str, list[Image.Image]]:
    match = re.match(r"^(\d{5})-", source_path.name)
    if not match:
        raise ValueError(f"Missing item id prefix: {source_path.name}")
    item_id = match.group(1)
    validate_source(source_path, item_id)

    with Image.open(source_path) as source:
        rgba = source.convert("RGBA")
        if rgba.width % FRAME_COUNT or rgba.height != FRAME_SIZE[1]:
            raise ValueError(f"Expected four equal idle cells in {source_path.name}: {rgba.size}")
        cell_width = rgba.width // FRAME_COUNT
        sprites = []
        for index in range(FRAME_COUNT):
            cell = rgba.crop((index * cell_width, 0, (index + 1) * cell_width, rgba.height))
            bounds = cell.getchannel("A").getbbox()
            if not bounds:
                raise ValueError(f"Empty idle frame {index + 1}: {source_path.name}")
            sprites.append(cell.crop(bounds))

    safe_width = FRAME_SIZE[0] - SAFE_MARGIN_X * 2
    safe_height = FRAME_SIZE[1] - BASELINE_MARGIN - SAFE_MARGIN_X
    scale = min(
        1,
        safe_width / max(sprite.width for sprite in sprites),
        safe_height / max(sprite.height for sprite in sprites),
    )

    frames = []
    for index, sprite in enumerate(sprites):
        if scale < 1:
            sprite = sprite.resize(
                (round(sprite.width * scale), round(sprite.height * scale)),
                Image.Resampling.LANCZOS,
            )
        frame = Image.new("RGBA", FRAME_SIZE, (0, 0, 0, 0))
        x = (FRAME_SIZE[0] - sprite.width) // 2
        y = FRAME_SIZE[1] - sprite.height - BASELINE_MARGIN
        frame.alpha_composite(sprite, (x, y))
        frames.append(frame)
    return item_id, frames


def align_frame(frame: Image.Image, item_id: str, index: int) -> tuple[Image.Image, tuple[int, int]]:
    dx, dy = FRAME_OFFSETS[item_id][index]
    if index == 0:
        return frame, (0, 0)

    # Alpha=1 specks outside the artwork were moving the old bbox anchor.
    # Keep all stronger alpha, including the entire antialiased skirt edge.
    bounds = frame.getchannel("A").point(lambda alpha: 255 if alpha >= 2 else 0).getbbox()
    if not bounds:
        raise ValueError(f"Empty character artwork: {item_id} frame {index + 1}")
    left, top, right, bottom = bounds
    dx = min(max(dx, 2 - left), FRAME_SIZE[0] - 2 - right)
    dy = min(max(dy, 2 - top), FRAME_SIZE[1] - 2 - bottom)
    aligned = Image.new("RGBA", FRAME_SIZE, (0, 0, 0, 0))
    aligned.alpha_composite(frame, (dx, dy))
    return aligned, (dx, dy)


def split_atlas(source_path: Path) -> list[Path]:
    item_id, frames = build_frames(source_path)
    target_dir = OUTPUT_ROOT / item_id
    target_dir.mkdir(parents=True, exist_ok=True)
    outputs = []
    for index, frame in enumerate(frames):
        aligned, offset = align_frame(frame, item_id, index)
        output = target_dir / f"frame-{index + 1:02d}.png"
        aligned.save(output, "PNG", optimize=True)
        outputs.append(output)
        print(f"{item_id} frame {index + 1}: offset={offset}")
    return outputs


def verify(path: Path) -> None:
    with Image.open(path) as frame:
        if frame.size != FRAME_SIZE or frame.mode != "RGBA":
            raise ValueError(f"Invalid output {path}: {frame.size} {frame.mode}")
        alpha = frame.getchannel("A")
        if not alpha.getbbox() or alpha.getextrema()[0] == 255:
            raise ValueError(f"Invalid transparency in {path}")


def main() -> None:
    sources = sorted(SOURCE_DIR.glob("*.png"))
    if len(sources) != 9:
        raise ValueError(f"Expected 9 idle atlases, found {len(sources)}")
    outputs = [output for source in sources for output in split_atlas(source)]
    for output in outputs:
        verify(output)
    print(f"OK: {len(outputs)} idle frames ({FRAME_SIZE[0]}x{FRAME_SIZE[1]} RGBA)")


if __name__ == "__main__":
    main()
