import re
from pathlib import Path

from PIL import Image


FRAME_COUNT = 6
FRAME_SIZE = (362, 724)
REPO_ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = REPO_ROOT.parent / "砍树斧头对应帧"
OUTPUT_ROOT = REPO_ROOT / "assets" / "images" / "character" / "axes"


def split_atlas(source_path: Path) -> list[Path]:
    match = re.match(r"^(\d{5})-", source_path.name)
    if not match:
        raise ValueError(f"Missing item id prefix: {source_path.name}")
    item_id = match.group(1)
    outputs = []
    with Image.open(source_path) as source:
        if source.size != (FRAME_SIZE[0] * FRAME_COUNT, FRAME_SIZE[1]):
            raise ValueError(f"Unexpected atlas size for {source_path.name}: {source.size}")
        rgba = source.convert("RGBA")
        target_dir = OUTPUT_ROOT / item_id
        target_dir.mkdir(parents=True, exist_ok=True)
        for index in range(FRAME_COUNT):
            left = index * FRAME_SIZE[0]
            frame = rgba.crop((left, 0, left + FRAME_SIZE[0], FRAME_SIZE[1]))
            output = target_dir / f"frame-{index + 1:02d}.png"
            frame.save(output, "PNG", optimize=True)
            outputs.append(output)
    return outputs


def verify(path: Path) -> None:
    with Image.open(path) as frame:
        if frame.size != FRAME_SIZE or frame.mode != "RGBA":
            raise ValueError(f"Invalid output {path}: {frame.size} {frame.mode}")
        if frame.getchannel("A").getextrema()[0] == 255:
            raise ValueError(f"Output has no transparency: {path}")


def main() -> None:
    sources = sorted(SOURCE_DIR.glob("*.png"))
    if len(sources) != 9:
        raise ValueError(f"Expected 9 axe atlases, found {len(sources)}")
    outputs = [output for source in sources for output in split_atlas(source)]
    for output in outputs:
        verify(output)
    print(f"OK: {len(outputs)} axe frames ({FRAME_SIZE[0]}x{FRAME_SIZE[1]} RGBA)")


if __name__ == "__main__":
    main()
