import hashlib
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from import_xianlai_v5_art import SOURCE_ROOT, clean_paper_alpha, ink_to_alpha, padded_paper
import build_runtime_images


class XianlaiV5AssetsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = json.loads((ROOT / "assets/images/v5/source-manifest.json").read_text(encoding="utf-8"))
        cls.runtime = json.loads((ROOT / "assets/runtime/v5/manifest.json").read_text(encoding="utf-8"))

    def test_exact_assets_and_runtime_budget(self):
        self.assertEqual(set(self.runtime), {"ui", "effects"})
        self.assertEqual(set(self.runtime["ui"]), {"task-paper", "shop-paper"})
        self.assertEqual(set(self.runtime["effects"]), {f"ink-{index:02d}" for index in range(1, 7)})
        total = 0
        for group, assets in self.runtime.items():
            for name, spec in assets.items():
                with self.subTest(group=group, name=name):
                    path = ROOT / spec["path"]
                    with Image.open(path) as image:
                        self.assertEqual(image.format, "WEBP")
                        self.assertEqual(image.mode, "RGBA")
                        self.assertEqual(list(image.size), spec["size"])
                        self.assertEqual(list(image.getchannel("A").getextrema()), spec["alphaRange"])
                        self.assertEqual(image.getchannel("A").getextrema()[0], 0)
                        self.assertGreaterEqual(image.getchannel("A").getextrema()[1], 240)
                        if group == "effects":
                            self.assertEqual(image.size, (512, 512))
                            source_spec = self.source["assets"][group][name]
                            with Image.open(ROOT / source_spec["path"]) as source:
                                self.assertEqual(image.getchannel("A").tobytes(), source.getchannel("A").tobytes())
                        else:
                            self.assertLessEqual(image.width, 960)
                    self.assertEqual(path.stat().st_size, spec["bytes"])
                    total += spec["bytes"]
        self.assertLessEqual(total, 1024 * 1024)

    def test_nine_slice_preserves_corner_art_and_stretchable_centers(self):
        expected = {"task-paper": [86, 61, 51, 122], "shop-paper": [56, 130, 122, 61]}
        for name, spec in self.runtime["ui"].items():
            with self.subTest(name=name):
                top, right, bottom, left = spec["slice"]
                self.assertEqual(spec["slice"], expected[name])
                self.assertLess(left + right, spec["size"][0])
                self.assertLess(top + bottom, spec["size"][1])
                self.assertGreater(min(spec["slice"]), 0)

    def test_sources_are_preserved_and_content_stays_inside_each_cell(self):
        hashes = set()
        for key, spec in self.source["sources"].items():
            original = SOURCE_ROOT / spec["file"]
            if original.exists():
                self.assertEqual(hashlib.sha256(original.read_bytes()).hexdigest(), spec["sha256"])
        for group, assets in self.source["assets"].items():
            for name, spec in assets.items():
                with self.subTest(group=group, name=name):
                    path = ROOT / spec["path"]
                    digest = hashlib.sha256(path.read_bytes()).hexdigest()
                    self.assertNotIn(digest, hashes)
                    hashes.add(digest)
                    left, top, right, bottom = spec["contentBounds"]
                    cell_left, cell_top, cell_right, cell_bottom = spec["cell"]
                    self.assertGreaterEqual(min(left - cell_left, top - cell_top, cell_right - right, cell_bottom - bottom), 3)
                    with Image.open(path) as image:
                        self.assertEqual(list(image.size), spec["size"])
                        self.assertEqual(image.mode, "RGBA")
                        alpha = image.getchannel("A")
                        bounds = alpha.getbbox()
                        minimum = spec["padding"] if group == "ui" else 3
                        self.assertGreaterEqual(min(bounds[0], bounds[1], image.width - bounds[2], image.height - bounds[3]), minimum)
                        invisible = [pixel for pixel in image.get_flattened_data() if pixel[3] == 0]
                        self.assertTrue(all(pixel == (0, 0, 0, 0) for pixel in invisible))

    def test_ink_has_translucent_washes_without_white_backing(self):
        for name, spec in self.runtime["effects"].items():
            with self.subTest(name=name), Image.open(ROOT / spec["path"]) as image:
                alpha = image.getchannel("A")
                values = list(alpha.get_flattened_data())
                self.assertGreater(sum(8 < value < 230 for value in values), 500)
                self.assertGreater(sum(value == 0 for value in values), len(values) * 0.6)
                self.assertEqual(alpha.crop((0, 0, image.width, 3)).getextrema(), (0, 0))
                self.assertEqual(alpha.crop((0, image.height - 3, image.width, image.height)).getextrema(), (0, 0))

    def test_white_to_alpha_keeps_dark_ink_and_soft_gradation(self):
        original = Image.new("RGB", (5, 1))
        original.putdata([(255, 255, 255), (249, 249, 249), (200, 200, 200), (100, 100, 100), (0, 0, 0)])
        pixels = list(ink_to_alpha(original).get_flattened_data())
        self.assertEqual(pixels[0], (0, 0, 0, 0))
        self.assertEqual(pixels[1], (0, 0, 0, 0))
        self.assertTrue(0 < pixels[2][3] < pixels[3][3] < pixels[4][3])
        self.assertEqual(pixels[4][3], 255)
        self.assertEqual(pixels[2][:3], pixels[4][:3])

    def test_paper_cleanup_uses_alpha_not_hidden_dark_rgb(self):
        original = Image.new("RGBA", (30, 20), (5, 8, 7, 0))
        original.putpixel((1, 1), (12, 19, 13, 3))
        original.paste((35, 42, 38, 254), (8, 7, 22, 13))
        cleaned = clean_paper_alpha(original)
        self.assertEqual(cleaned.getpixel((0, 0)), (0, 0, 0, 0))
        self.assertEqual(cleaned.getpixel((1, 1)), (0, 0, 0, 0))
        self.assertEqual(cleaned.getpixel((10, 9)), (35, 42, 38, 254))
        result, bounds = padded_paper(original, padding=12)
        self.assertEqual(bounds, (8, 7, 22, 13))
        self.assertEqual(result.size, (38, 30))
        self.assertEqual(result.getchannel("A").getbbox(), (12, 12, 26, 18))

    def test_v5_only_never_invokes_existing_resource_builds(self):
        with patch.object(sys, "argv", ["build_runtime_images.py", "--v5-only"]), \
                patch.object(build_runtime_images, "build_v5_assets", return_value=({}, 8, 200, 100)) as v5, \
                patch.object(build_runtime_images, "build_character_frames", side_effect=AssertionError("Unexpected character rewrite")), \
                patch.object(build_runtime_images, "build_v2_assets", side_effect=AssertionError("Unexpected V2 rewrite")), \
                patch.object(build_runtime_images, "build_v3_assets", side_effect=AssertionError("Unexpected V3 rewrite")), \
                patch.object(build_runtime_images, "build_v4_assets", side_effect=AssertionError("Unexpected V4 rewrite")):
            build_runtime_images.main()
            v5.assert_called_once_with()


if __name__ == "__main__":
    unittest.main()
