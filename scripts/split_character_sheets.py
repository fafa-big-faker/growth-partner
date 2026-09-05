import argparse
from pathlib import Path

from PIL import Image


FRAME_COUNT = 6
EXPECTED_SIZE = (362, 724)
REPO_ROOT = Path(__file__).resolve().parents[1]
WORKSPACE_ROOT = REPO_ROOT.parent

SHEETS = {
    "idle": WORKSPACE_ROOT / "修炼者待机序列帧.png",
    "chop": WORKSPACE_ROOT / "修炼者砍树序列帧.png",
}


def remove_magenta_background(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    cleaned = []
    for red, green, blue, alpha in rgba.get_flattened_data():
        is_magenta = red >= 170 and blue >= 125 and green <= 105 and green * 2 < red + blue
        cleaned.append((red, green, blue, 0 if is_magenta else alpha))
    rgba.putdata(cleaned)
    return rgba


def split_sheet(name: str, source_path: Path) -> list[Path]:
    with Image.open(source_path) as source:
        if source.width % FRAME_COUNT != 0:
            raise ValueError(f"{source_path.name}: width is not divisible by {FRAME_COUNT}")

        frame_size = (source.width // FRAME_COUNT, source.height)
        if frame_size != EXPECTED_SIZE:
            raise ValueError(
                f"{source_path.name}: expected frames {EXPECTED_SIZE}, got {frame_size}"
            )

        rgba = remove_magenta_background(source)
        output_dir = REPO_ROOT / "assets" / "images" / "character" / name
        output_dir.mkdir(parents=True, exist_ok=True)

        output_paths = []
        for index in range(FRAME_COUNT):
            left = index * frame_size[0]
            frame = rgba.crop((left, 0, left + frame_size[0], frame_size[1]))
            output_path = output_dir / f"frame-{index + 1:02d}.png"
            frame.save(output_path, format="PNG", optimize=True)
            output_paths.append(output_path)

    return output_paths


def verify_frame(path: Path) -> None:
    with Image.open(path) as frame:
        if frame.size != EXPECTED_SIZE:
            raise ValueError(f"{path}: expected {EXPECTED_SIZE}, got {frame.size}")
        if frame.mode != "RGBA":
            raise ValueError(f"{path}: expected RGBA, got {frame.mode}")
        alpha_min, _ = frame.getchannel("A").getextrema()
        if alpha_min == 255:
            raise ValueError(f"{path}: no transparent pixels found")


def main() -> None:
    parser = argparse.ArgumentParser(description="Split six-frame character atlases")
    parser.add_argument("--only", choices=["idle", "chop", "all"], default="all")
    parser.add_argument("--idle-source", type=Path, default=SHEETS["idle"])
    parser.add_argument("--chop-source", type=Path, default=SHEETS["chop"])
    args = parser.parse_args()

    sources = {"idle": args.idle_source, "chop": args.chop_source}
    selected = sources.items() if args.only == "all" else [(args.only, sources[args.only])]
    outputs = []
    for name, source_path in selected:
        if not source_path.exists():
            raise FileNotFoundError(source_path)
        outputs.extend(split_sheet(name, source_path))

    for output_path in outputs:
        verify_frame(output_path)
        print(f"OK {output_path.relative_to(REPO_ROOT)} {EXPECTED_SIZE[0]}x{EXPECTED_SIZE[1]} RGBA")


if __name__ == "__main__":
    main()
