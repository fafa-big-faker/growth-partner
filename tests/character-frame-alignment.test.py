from pathlib import Path
import sys
import tempfile
import unittest

from PIL import Image, ImageChops, ImageFilter, ImageStat


ROOT = Path(__file__).resolve().parents[1]
CHARACTER_ROOT = ROOT / "assets" / "images" / "character"
AXE_IDS = ("51001", "51002", "52001", "52002", "53001", "53002", "54001", "54002", "55001")
FRAME_SIZE = (362, 724)
sys.path.insert(0, str(ROOT / "scripts"))
from split_idle_axe_sheets import align_frame, build_frames


def torso_position(reference: Image.Image, frame: Image.Image) -> tuple[int, int]:
    def prepare(image):
        canvas = Image.new("RGB", image.size, "#d4ddd5")
        canvas.paste(image, (0, 0), image)
        return canvas.convert("L").filter(ImageFilter.GaussianBlur(1.5))

    template = prepare(reference).crop((110, 465, 192, 536))
    candidate = prepare(frame)
    scores = []
    for dy in range(-12, 13):
        for dx in range(-12, 13):
            patch = candidate.crop((110 + dx, 465 + dy, 192 + dx, 536 + dy))
            score = ImageStat.Stat(ImageChops.difference(template, patch)).mean[0]
            scores.append((score, dx, dy))
    _, dx, dy = min(scores)
    return dx, dy


def alpha_bounds(path: Path) -> tuple[int, int, int, int]:
    with Image.open(path) as image:
        if image.size != FRAME_SIZE or image.mode != "RGBA":
            raise AssertionError(f"Unexpected frame format: {path} {image.size} {image.mode}")
        bounds = image.getchannel("A").getbbox()
        if bounds is None:
            raise AssertionError(f"Empty frame: {path}")
        return bounds


class CharacterFrameAlignmentTest(unittest.TestCase):
    def test_replacement_source_requires_new_alignment_calibration(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "51001-replacement.png"
            Image.new("RGBA", (1448, 724), (0, 0, 0, 0)).save(source)
            with self.assertRaisesRegex(ValueError, "recalibrate"):
                build_frames(source)

    def test_idle_body_and_boot_baseline_stay_anchored(self) -> None:
        for axe_id in AXE_IDS:
            reference = Image.open(CHARACTER_ROOT / "idle-axes" / axe_id / "frame-01.png").convert("RGBA")
            reference_bottom = reference.getchannel("A").point(lambda alpha: 255 if alpha > 32 else 0).getbbox()[3]
            for frame_number in range(2, 5):
                with self.subTest(axe_id=axe_id, frame=frame_number):
                    frame = Image.open(CHARACTER_ROOT / "idle-axes" / axe_id / f"frame-{frame_number:02d}.png").convert("RGBA")
                    bottom = frame.getchannel("A").point(lambda alpha: 255 if alpha > 32 else 0).getbbox()[3]
                    self.assertEqual(bottom, reference_bottom, "boots slide vertically")
                    dx, dy = torso_position(reference, frame)
                    # The widest purple-axe skirt needs 8 source pixels of room;
                    # at game scale this is under 3 CSS pixels without clipping it.
                    self.assertLessEqual(abs(dx), 8, "torso drifts horizontally")
                    self.assertLessEqual(abs(dy), 5, "torso drifts vertically")

    def test_alignment_preserves_antialiased_edges_and_reference(self) -> None:
        frame = Image.new("RGBA", FRAME_SIZE, (0, 0, 0, 0))
        frame.putpixel((5, 700), (80, 120, 110, 2))
        frame.putpixel((340, 715), (20, 40, 30, 255))
        aligned, (dx, dy) = align_frame(frame, "51001", 3)
        self.assertEqual(aligned.getpixel((5 + dx, 700 + dy)), (80, 120, 110, 2))
        self.assertEqual(aligned.getpixel((340 + dx, 715 + dy)), (20, 40, 30, 255))
        reference, offset = align_frame(frame, "51001", 0)
        self.assertEqual(reference.tobytes(), frame.tobytes())
        self.assertEqual(offset, (0, 0))

    def test_idle_and_chop_reference_frames_share_a_visual_anchor(self) -> None:
        for axe_id in AXE_IDS:
            with self.subTest(axe_id=axe_id):
                idle = alpha_bounds(CHARACTER_ROOT / "idle-axes" / axe_id / "frame-01.png")
                chop = alpha_bounds(CHARACTER_ROOT / "axes" / axe_id / "frame-01.png")
                idle_center = (idle[0] + idle[2]) / 2
                chop_center = (chop[0] + chop[2]) / 2

                # The authored swing changes stance; at rendered size 36 vertical pixels
                # and 16 horizontal pixels stay below roughly 12 and 6 CSS pixels.
                self.assertLessEqual(abs(idle[3] - chop[3]), 36, "foot baselines drift")
                self.assertLessEqual(abs(idle_center - chop_center), 16, "character centers drift")

    def test_chop_sequences_keep_alpha_inside_the_canvas(self) -> None:
        for axe_id in AXE_IDS:
            for frame_number in range(1, 7):
                with self.subTest(axe_id=axe_id, frame=frame_number):
                    left, top, right, bottom = alpha_bounds(
                        CHARACTER_ROOT / "axes" / axe_id / f"frame-{frame_number:02d}.png"
                    )
                    self.assertGreater(left, 0)
                    self.assertGreater(top, 0)
                    self.assertLess(right, FRAME_SIZE[0])
                    self.assertLess(bottom, FRAME_SIZE[1])


if __name__ == "__main__":
    unittest.main()
