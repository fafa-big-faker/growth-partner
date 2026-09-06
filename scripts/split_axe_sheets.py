import re
from pathlib import Path

from PIL import Image


FRAME_COUNT = 6
FRAME_SIZE = (362, 724)
REPO_ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = REPO_ROOT.parent / "砍树斧头对应帧V2"
OUTPUT_ROOT = REPO_ROOT / "assets" / "images" / "character" / "axes"


def remove_magenta_separators(image: Image.Image) -> tuple[Image.Image, list[int]]:
    rgba = image.convert("RGBA")
    width, height = rgba.size
    column_scores = [0] * width
    pixels = []
    for offset, (red, green, blue, alpha) in enumerate(rgba.getdata()):
        is_separator = red >= 215 and green <= 85 and blue >= 210 and red + blue >= 455
        if is_separator:
            column_scores[offset % width] += 1
            pixels.append((red, green, blue, 0))
        else:
            pixels.append((red, green, blue, alpha))
    cleaned = Image.new("RGBA", rgba.size)
    cleaned.putdata(pixels)

    expected_width = width / FRAME_COUNT
    boundaries = []
    for index in range(1, FRAME_COUNT):
        midpoint = round(expected_width * index)
        start = max(0, midpoint - 75)
        end = min(width, midpoint + 76)
        boundary = max(range(start, end), key=column_scores.__getitem__)
        if column_scores[boundary] < height * 0.18:
            raise ValueError(f"Missing magenta separator {index}")
        boundaries.append(boundary)
    return cleaned, boundaries


def normalize_frame(region: Image.Image) -> Image.Image:
    target_width, target_height = FRAME_SIZE
    if region.height != target_height:
        raise ValueError(f"Unexpected frame height: {region.height}")
    canvas = Image.new("RGBA", FRAME_SIZE, (0, 0, 0, 0))
    if region.width > target_width:
        left = (region.width - target_width) // 2
        region = region.crop((left, 0, left + target_width, target_height))
        x = 0
    else:
        x = (target_width - region.width) // 2
    canvas.alpha_composite(region, (x, 0))
    return canvas


def split_atlas(source_path: Path) -> list[Path]:
    match = re.match(r"^(\d{5})-", source_path.name)
    if not match:
        raise ValueError(f"Missing item id prefix: {source_path.name}")
    item_id = match.group(1)
    outputs = []
    with Image.open(source_path) as source:
        if source.height != FRAME_SIZE[1]:
            raise ValueError(f"Unexpected atlas height for {source_path.name}: {source.size}")
        rgba, boundaries = remove_magenta_separators(source)
        edges = [0, *boundaries, source.width]
        target_dir = OUTPUT_ROOT / item_id
        target_dir.mkdir(parents=True, exist_ok=True)
        for index in range(FRAME_COUNT):
            region = rgba.crop((edges[index], 0, edges[index + 1], source.height))
            clear_width = min(14, max(0, region.width // 8))
            if clear_width:
                alpha = region.getchannel("A")
                alpha.paste(0, (0, 0, clear_width, region.height))
                alpha.paste(0, (region.width - clear_width, 0, region.width, region.height))
                region.putalpha(alpha)
            frame = normalize_frame(region)
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
