import hashlib
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from import_xianlai_v6_art import SOURCE_ROOT, clean_alpha, padded_asset
import build_runtime_images


SOURCE_HASHES = {
    "quality": "f8b4bef3e8c3fc440ee0f85382fec3eeae8cb0d6f9748a30eca3172b666a6347",
    "login": "d083c1d0f22d2f78a1ddf72c710b2eecea0d1c554a999fa9433cef7bd076550a",
}


class XianlaiV6AssetsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = json.loads((ROOT / "assets/images/v6/source-manifest.json").read_text(encoding="utf-8"))
        cls.runtime = json.loads((ROOT / "assets/runtime/v6/manifest.json").read_text(encoding="utf-8"))

    def test_exact_seven_assets_and_runtime_budget(self):
        expected = {"quality": {f"quality-{index}" for index in range(1, 6)},
                    "ui": {"login-brush", "login-lettering"}}
        self.assertEqual(set(self.source["assets"]), set(expected))
        self.assertEqual(set(self.runtime), set(expected))
        total = 0
        for group, names in expected.items():
            self.assertEqual(set(self.source["assets"][group]), names)
            self.assertEqual(set(self.runtime[group]), names)
            self.assertEqual({path.stem for path in (ROOT / "assets/images/v6" / group).glob("*.png")}, names)
            self.assertEqual({path.stem for path in (ROOT / "assets/runtime/v6" / group).glob("*.webp")}, names)
            for name, spec in self.runtime[group].items():
                path = ROOT / spec["path"]
                with self.subTest(group=group, name=name), Image.open(path) as image:
                    self.assertEqual(image.format, "WEBP")
                    self.assertEqual(image.mode, "RGBA")
                    self.assertEqual(list(image.size), spec["size"])
                    self.assertEqual(list(image.getchannel("A").getextrema()), spec["alphaRange"])
                    self.assertEqual(image.getchannel("A").getextrema()[0], 0)
                    self.assertGreaterEqual(image.getchannel("A").getextrema()[1], 240)
                    limit = (48, 112) if group == "quality" else ((960, 256) if name == "login-brush" else (768, 256))
                    self.assertLessEqual(image.width, limit[0])
                    self.assertLessEqual(image.height, limit[1])
                    with Image.open(ROOT / self.source["assets"][group][name]["path"]) as source:
                        resized = build_runtime_images.fit_within(source, limit)
                        self.assertEqual(image.size, resized.size)
                        self.assertEqual(image.getchannel("A").tobytes(), resized.getchannel("A").tobytes())
                self.assertEqual(path.stat().st_size, spec["bytes"])
                total += spec["bytes"]
        self.assertLess(total, 180 * 1024)

    def test_source_fingerprints_dimensions_and_empty_sixth_cell(self):
        self.assertEqual(self.source["minimumAlpha"], 5)
        self.assertEqual(set(self.source["sources"]), set(SOURCE_HASHES))
        for key, spec in self.source["sources"].items():
            self.assertEqual(spec["sha256"], SOURCE_HASHES[key])
            self.assertEqual(spec["size"], [1536, 1024])
            self.assertEqual(spec["mode"], "RGBA")
            self.assertEqual(spec["alphaRange"], [0, 254])
            original = SOURCE_ROOT / spec["file"]
            if original.exists():
                self.assertEqual(hashlib.sha256(original.read_bytes()).hexdigest(), spec["sha256"])
                with Image.open(original) as image:
                    self.assertEqual(list(image.size), spec["size"])
                    self.assertEqual(image.mode, spec["mode"])
                    if key == "quality":
                        self.assertIsNone(clean_alpha(image.crop((1024, 512, 1536, 1024))).getchannel("A").getbbox())

    def test_outputs_preserve_complete_alpha_outlines_and_padding(self):
        hashes = set()
        for group, assets in self.source["assets"].items():
            for name, spec in assets.items():
                path = ROOT / spec["path"]
                with self.subTest(group=group, name=name), Image.open(path) as image:
                    digest = hashlib.sha256(path.read_bytes()).hexdigest()
                    self.assertNotIn(digest, hashes)
                    hashes.add(digest)
                    self.assertEqual(image.mode, "RGBA")
                    self.assertEqual(list(image.size), spec["size"])
                    self.assertEqual(list(image.getchannel("A").getextrema()), spec["alphaRange"])
                    self.assertEqual(spec["padding"], 12)
                    self.assertEqual(image.getchannel("A").getbbox(), (12, 12, image.width - 12, image.height - 12))
                    self.assertTrue(all(pixel == (0, 0, 0, 0) for pixel in image.get_flattened_data() if pixel[3] == 0))
                    left, top, right, bottom = spec["contentBounds"]
                    x1, y1, x2, y2 = spec["cell"]
                    self.assertGreaterEqual(min(left - x1, top - y1, x2 - right, y2 - bottom), 3)
                    if group == "quality":
                        self.assertEqual((x2 - x1, y2 - y1), (512, 512))
                        self.assertEqual(bottom - top, 411)
                    original = SOURCE_ROOT / self.source["sources"][spec["source"]]["file"]
                    if original.exists():
                        with Image.open(original) as source:
                            expected, local = padded_asset(source.crop(spec["cell"]))
                        self.assertEqual(image.tobytes(), expected.tobytes())
                        self.assertEqual(spec["contentBounds"], [local[0] + x1, local[1] + y1, local[2] + x1, local[3] + y1])

    def test_alpha_cleanup_keeps_black_ink_white_letters_and_soft_tips(self):
        original = Image.new("RGBA", (30, 20), (50, 90, 12, 0))
        original.putpixel((1, 1), (255, 255, 255, 4))
        original.paste((0, 0, 0, 254), (8, 7, 22, 13))
        original.putpixel((10, 8), (248, 246, 240, 254))
        original.putpixel((7, 9), (25, 30, 29, 5))
        cleaned = clean_alpha(original)
        self.assertEqual(cleaned.getpixel((0, 0)), (0, 0, 0, 0))
        self.assertEqual(cleaned.getpixel((1, 1)), (0, 0, 0, 0))
        for point in [(9, 9), (10, 8), (7, 9)]:
            self.assertEqual(cleaned.getpixel(point), original.getpixel(point))
        output, bounds = padded_asset(original)
        self.assertEqual(bounds, (7, 7, 22, 13))
        self.assertEqual(output.size, (39, 30))
        self.assertEqual(output.getpixel((12, 14)), (25, 30, 29, 5))

    def test_empty_or_cell_edge_artwork_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "nonempty"):
            padded_asset(Image.new("RGBA", (30, 20)))
        with self.assertRaisesRegex(ValueError, "cell edge"):
            padded_asset(Image.new("RGBA", (30, 20), (0, 0, 0, 254)))

    def test_v6_only_never_rebuilds_older_artwork(self):
        with patch.object(sys, "argv", ["build_runtime_images.py", "--v6-only"]), \
                patch.object(build_runtime_images, "build_v6_assets", return_value=({}, 7, 200, 100)) as v6, \
                patch.object(build_runtime_images, "build_character_frames", side_effect=AssertionError("Unexpected character rewrite")), \
                patch.object(build_runtime_images, "build_v2_assets", side_effect=AssertionError("Unexpected V2 rewrite")), \
                patch.object(build_runtime_images, "build_v3_assets", side_effect=AssertionError("Unexpected V3 rewrite")), \
                patch.object(build_runtime_images, "build_v4_assets", side_effect=AssertionError("Unexpected V4 rewrite")), \
                patch.object(build_runtime_images, "build_v5_assets", side_effect=AssertionError("Unexpected V5 rewrite")):
            build_runtime_images.main()
            v6.assert_called_once_with()


if __name__ == "__main__":
    unittest.main()
