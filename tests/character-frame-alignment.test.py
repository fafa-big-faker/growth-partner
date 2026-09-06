from pathlib import Path
import unittest

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
CHARACTER_ROOT = ROOT / "assets" / "images" / "character"
AXE_IDS = ("51001", "51002", "52001", "52002", "53001", "53002", "54001", "54002", "55001")
FRAME_SIZE = (362, 724)


def alpha_bounds(path: Path) -> tuple[int, int, int, int]:
    with Image.open(path) as image:
        if image.size != FRAME_SIZE or image.mode != "RGBA":
            raise AssertionError(f"Unexpected frame format: {path} {image.size} {image.mode}")
        bounds = image.getchannel("A").getbbox()
        if bounds is None:
            raise AssertionError(f"Empty frame: {path}")
        return bounds


class CharacterFrameAlignmentTest(unittest.TestCase):
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
