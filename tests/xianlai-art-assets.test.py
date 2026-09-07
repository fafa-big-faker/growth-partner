import json
from pathlib import Path
import sys
import unittest

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from import_xianlai_art import remove_key_fringe, split_grid


class XianlaiArtAssetsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest = json.loads((ROOT / "assets/runtime/v3/manifest.json").read_text(encoding="utf-8"))

    def test_delivered_assets_keep_required_sizes_and_budget(self):
        self.assertEqual(set(self.manifest), {"backgrounds", "ui", "icons"})
        self.assertEqual(len(self.manifest["ui"]), 7)
        self.assertEqual(len(self.manifest["icons"]), 6)
        total = 0
        for group, assets in self.manifest.items():
            for name, spec in assets.items():
                with self.subTest(group=group, asset=name):
                    path = ROOT / spec["path"]
                    with Image.open(path) as image:
                        self.assertEqual(image.format, "WEBP")
                        self.assertEqual(list(image.size), spec["size"])
                        if group == "ui" and name != "logo":
                            self.assertGreaterEqual(image.width, 500, "long frame was compressed as a small UI icon")
                            self.assertLessEqual(image.width, 960)
                            top, right, bottom, left = spec["slice"]
                            self.assertLess(left + right, image.width)
                            self.assertLess(top + bottom, image.height)
                        if group == "icons":
                            self.assertEqual(image.size, (160, 160))
                    total += path.stat().st_size
        self.assertLess(total, 750_000)

    def test_cutouts_have_real_clear_edges_without_matte_rectangles(self):
        for group in ("ui", "icons"):
            for name, spec in self.manifest[group].items():
                with self.subTest(asset=name):
                    with Image.open(ROOT / spec["path"]) as image:
                        self.assertIn("A", image.getbands())
                        alpha = image.getchannel("A")
                        self.assertEqual(alpha.getpixel((0, 0)), 0)
                        self.assertEqual(alpha.getpixel((image.width - 1, image.height - 1)), 0)
                        left, top, right, bottom = alpha.point(lambda value: 255 if value > 10 else 0).getbbox()
                        self.assertGreater(left, 0)
                        self.assertGreater(top, 0)
                        self.assertLess(right, image.width)
                        self.assertLess(bottom, image.height)

    def test_fringe_cleanup_does_not_remove_dark_ink_or_jade(self):
        image = Image.new("RGBA", (3, 1))
        image.putdata([(20, 30, 30, 255), (72, 107, 92, 180), (0, 255, 0, 220)])
        result = remove_key_fringe(image)
        self.assertEqual(result.getpixel((0, 0)), (20, 30, 30, 255))
        self.assertEqual(result.getpixel((1, 0)), (72, 107, 92, 180))
        self.assertEqual(result.getpixel((2, 0))[3], 0)

    def test_grid_rejects_dimensions_that_would_clip_cells(self):
        with self.assertRaises(ValueError):
            split_grid(Image.new("RGBA", (101, 80)), 3, 2)


if __name__ == "__main__":
    unittest.main()
