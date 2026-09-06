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


def split_atlas(source_path: Path) -> list[Path]:
    match = re.match(r"^(\d{5})-", source_path.name)
    if not match:
        raise ValueError(f"Missing item id prefix: {source_path.name}")
    item_id = match.group(1)

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

    target_dir = OUTPUT_ROOT / item_id
    target_dir.mkdir(parents=True, exist_ok=True)
    outputs = []
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
        output = target_dir / f"frame-{index + 1:02d}.png"
        frame.save(output, "PNG", optimize=True)
        outputs.append(output)
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
