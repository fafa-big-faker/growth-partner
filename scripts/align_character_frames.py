#!/usr/bin/env python3
"""Align each complete weapon chop sequence to its matching idle anchor."""

from collections import deque
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
CHARACTER_ROOT = ROOT / "assets" / "images" / "character"
AXE_IDS = ("51001", "51002", "52001", "52002", "53001", "53002", "54001", "54002", "55001")
FRAME_SIZE = (362, 724)
SAFE_MARGIN = 4
MIN_COMPONENT_PIXELS = 48


def remove_separator_residue(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    cleaned = []
    for red, green, blue, alpha in rgba.get_flattened_data():
        is_separator = (
            red >= 170
            and blue >= 125
            and green <= 105
            and abs(red - blue) <= 115
            and green * 2 < red + blue
        )
        cleaned.append((red, green, blue, 0 if is_separator else alpha))
    rgba.putdata(cleaned)
    return remove_isolated_artifacts(rgba)


def remove_isolated_artifacts(image: Image.Image) -> Image.Image:
    width, height = image.size
    alpha = bytearray(image.getchannel("A").tobytes())
    visited = bytearray(width * height)

    for start in range(width * height):
        if visited[start] or alpha[start] == 0:
            continue
        visited[start] = 1
        pending = deque([start])
        component = []
        min_x = max_x = start % width
        min_y = max_y = start // width

        while pending:
            current = pending.popleft()
            component.append(current)
            x = current % width
            y = current // width
            min_x = min(min_x, x)
            max_x = max(max_x, x)
            min_y = min(min_y, y)
            max_y = max(max_y, y)
            for neighbour in (current - 1, current + 1, current - width, current + width):
                if neighbour < 0 or neighbour >= width * height or visited[neighbour] or alpha[neighbour] == 0:
                    continue
                neighbour_x = neighbour % width
                if abs(neighbour_x - x) > 1:
                    continue
                visited[neighbour] = 1
                pending.append(neighbour)

        component_width = max_x - min_x + 1
        component_height = max_y - min_y + 1
        touches_edge = min_x == 0 or min_y == 0 or max_x == width - 1 or max_y == height - 1
        is_edge_line = touches_edge and (component_width <= 12 or component_height <= 12)
        if len(component) < MIN_COMPONENT_PIXELS or is_edge_line:
            for index in component:
                alpha[index] = 0

    image.putalpha(Image.frombytes("L", image.size, bytes(alpha)))
    return image


def bounds(image: Image.Image) -> tuple[int, int, int, int]:
    result = image.getchannel("A").getbbox()
    if result is None:
        raise ValueError("Encountered an empty animation frame")
    return result


def scale_frame(image: Image.Image, scale: float) -> Image.Image:
    if scale >= 0.9999:
        return image
    scaled_size = (round(image.width * scale), round(image.height * scale))
    scaled = image.resize(scaled_size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", FRAME_SIZE, (0, 0, 0, 0))
    canvas.alpha_composite(scaled, (0, 0))
    return canvas


def translate_frame(image: Image.Image, dx: int, dy: int) -> Image.Image:
    canvas = Image.new("RGBA", FRAME_SIZE, (0, 0, 0, 0))
    source_left = max(0, -dx)
    source_top = max(0, -dy)
    source_right = min(image.width, image.width - dx)
    source_bottom = min(image.height, image.height - dy)
    if source_right <= source_left or source_bottom <= source_top:
        raise ValueError(f"Translation moves frame outside canvas: {(dx, dy)}")
    region = image.crop((source_left, source_top, source_right, source_bottom))
    canvas.alpha_composite(region, (max(0, dx), max(0, dy)))
    return canvas


def group_scale(frames: list[Image.Image]) -> float:
    frame_bounds = [bounds(frame) for frame in frames]
    group_width = max(box[2] for box in frame_bounds) - min(box[0] for box in frame_bounds)
    group_height = max(box[3] for box in frame_bounds) - min(box[1] for box in frame_bounds)
    usable_width = FRAME_SIZE[0] - SAFE_MARGIN * 2
    usable_height = FRAME_SIZE[1] - SAFE_MARGIN * 2
    return min(1.0, usable_width / group_width, usable_height / group_height)


def clamp_offset(requested: int, minimum: int, maximum: int) -> int:
    if minimum > maximum:
        raise ValueError(f"Animation group cannot fit inside canvas: {minimum} > {maximum}")
    return min(max(requested, minimum), maximum)


def align_weapon(axe_id: str) -> tuple[float, int, int]:
    idle_path = CHARACTER_ROOT / "idle-axes" / axe_id / "frame-01.png"
    chop_paths = [CHARACTER_ROOT / "axes" / axe_id / f"frame-{index:02d}.png" for index in range(1, 7)]
    with Image.open(idle_path) as source:
        idle = remove_separator_residue(source)
    chop_frames = []
    for path in chop_paths:
        with Image.open(path) as source:
            chop_frames.append(remove_separator_residue(source))

    scale = group_scale(chop_frames)
    chop_frames = [scale_frame(frame, scale) for frame in chop_frames]
    idle_box = bounds(idle)
    reference_box = bounds(chop_frames[0])
    group_boxes = [bounds(frame) for frame in chop_frames]

    idle_center = (idle_box[0] + idle_box[2]) / 2
    reference_center = (reference_box[0] + reference_box[2]) / 2
    requested_dx = round(idle_center - reference_center)
    requested_dy = idle_box[3] - reference_box[3]

    dx = clamp_offset(
        requested_dx,
        SAFE_MARGIN - min(box[0] for box in group_boxes),
        FRAME_SIZE[0] - SAFE_MARGIN - max(box[2] for box in group_boxes),
    )
    dy = clamp_offset(
        requested_dy,
        SAFE_MARGIN - min(box[1] for box in group_boxes),
        FRAME_SIZE[1] - SAFE_MARGIN - max(box[3] for box in group_boxes),
    )

    for path, frame in zip(chop_paths, chop_frames):
        translated = translate_frame(frame, dx, dy)
        translated.save(path, "PNG", optimize=True)
    return scale, dx, dy


def main() -> None:
    for axe_id in AXE_IDS:
        scale, dx, dy = align_weapon(axe_id)
        print(f"{axe_id}: scale={scale:.4f}, offset=({dx:+d}, {dy:+d})")
    print(f"OK: aligned {len(AXE_IDS) * 6} chop frames")


if __name__ == "__main__":
    main()
