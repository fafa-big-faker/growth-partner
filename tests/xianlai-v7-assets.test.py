import hashlib
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from import_xianlai_v7_art import SOURCE_ROOT, clean_alpha, make_paper, make_reward
import build_runtime_images


SOURCE_HASHES = {
    "paper": "cc7ea0db7d5496ed5b83922cbb240f7370fb9e483f56364181623f92cf609e7b",
    "rewards": "7d5a79c3a4f33b31039b22fec81678ae73d633a89df9873e79dac8b45aca4b17",
}


class XianlaiV7AssetsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = json.loads((ROOT / "assets/images/v7/source-manifest.json").read_text(encoding="utf-8"))
        cls.runtime = json.loads((ROOT / "assets/runtime/v7/manifest.json").read_text(encoding="utf-8"))

    def test_exact_six_rgba_assets_and_runtime_budget(self):
        expected = {"rewards": {f"quality-{index}" for index in range(1, 6)}, "ui": {"inventory-paper"}}
        self.assertEqual(set(self.source["assets"]), set(expected))
        self.assertEqual(set(self.runtime), set(expected))
        total = 0
        for group, names in expected.items():
            self.assertEqual(set(self.source["assets"][group]), names)
            self.assertEqual(set(self.runtime[group]), names)
            for directory, extension in [("assets/images/v7", ".png"), ("assets/runtime/v7", ".webp")]:
                self.assertEqual({path.stem for path in (ROOT / directory / group).glob("*" + extension)}, names)
            for name, spec in self.runtime[group].items():
                source_spec = self.source["assets"][group][name]
                path = ROOT / spec["path"]
                with self.subTest(group=group, name=name), Image.open(path) as image, Image.open(ROOT / source_spec["path"]) as source:
                    self.assertEqual(image.format, "WEBP")
                    self.assertEqual(image.mode, "RGBA")
                    self.assertEqual(source.mode, "RGBA")
                    self.assertEqual(list(image.size), spec["size"])
                    self.assertEqual(list(source.size), source_spec["size"])
                    self.assertEqual(list(image.getchannel("A").getextrema()), spec["alphaRange"])
                    self.assertEqual(list(image.getchannel("A").getbbox()), spec["alphaBounds"])
                    self.assertEqual(image.getchannel("A").getextrema()[0], 0)
                    bounds = image.getchannel("A").getbbox()
                    self.assertGreaterEqual(min(bounds[0], bounds[1], image.width - bounds[2], image.height - bounds[3]), 3)
                    resized = build_runtime_images.fit_within(source, (256, 256) if group == "rewards" else (960, 960))
                    self.assertEqual(image.size, resized.size)
                    self.assertEqual(image.getchannel("A").tobytes(), resized.getchannel("A").tobytes())
                    if group == "rewards":
                        self.assertEqual(image.size, (256, 256))
                        self.assertEqual(source.size, (256, 256))
                    else:
                        self.assertEqual(image.size, (960, 391))
                self.assertEqual(path.stat().st_size, spec["bytes"])
                total += spec["bytes"]
        self.assertLess(total, 200 * 1024)

    def test_source_fingerprints_and_actual_not_prompt_dimensions(self):
        self.assertEqual(self.source["minimumAlpha"], 5)
        expected_sizes = {"paper": [1774, 887], "rewards": [1536, 1024]}
        for key, spec in self.source["sources"].items():
            self.assertEqual(spec["sha256"], SOURCE_HASHES[key])
            self.assertEqual(spec["size"], expected_sizes[key])
            self.assertEqual(spec["mode"], "RGBA")
            self.assertEqual(spec["alphaRange"], [0, 255 if key == "paper" else 254])
            original = SOURCE_ROOT / spec["file"]
            if original.exists():
                self.assertEqual(hashlib.sha256(original.read_bytes()).hexdigest(), spec["sha256"])
                with Image.open(original) as image:
                    self.assertEqual(list(image.size), spec["size"])
                    if key == "rewards":
                        self.assertIsNone(clean_alpha(image.crop((1024, 512, 1536, 1024))).getchannel("A").getbbox())

    def test_deterministic_crops_keep_all_visible_art_inside_safe_edges(self):
        for group, assets in self.source["assets"].items():
            for name, spec in assets.items():
                with self.subTest(group=group, name=name), Image.open(ROOT / spec["path"]) as image:
                    bounds = image.getchannel("A").getbbox()
                    self.assertIsNotNone(bounds)
                    self.assertGreaterEqual(min(bounds[0], bounds[1], image.width - bounds[2], image.height - bounds[3]), 10)
                    left, top, right, bottom = spec["contentBounds"]
                    x1, y1, x2, y2 = spec["cell"]
                    self.assertGreaterEqual(min(left - x1, top - y1, x2 - right, y2 - bottom), 3)
                    original = SOURCE_ROOT / self.source["sources"][spec["source"]]["file"]
                    if original.exists():
                        with Image.open(original) as source:
                            expected, local = (make_reward if group == "rewards" else make_paper)(source.crop(spec["cell"]))
                        self.assertEqual(image.tobytes(), expected.tobytes())
                        self.assertEqual(spec["contentBounds"], [local[0] + x1, local[1] + y1, local[2] + x1, local[3] + y1])

    def test_paper_nine_slice_keeps_ornaments_outside_a_readable_center(self):
        spec = self.runtime["ui"]["inventory-paper"]
        self.assertEqual(spec["slice"], [124, 183, 114, 217])
        top, right, bottom, left = spec["slice"]
        with Image.open(ROOT / spec["path"]) as image:
            center = image.crop((left, top, image.width - right, image.height - bottom))
            self.assertGreater(center.width, 500)
            self.assertGreater(center.height, 140)
            self.assertGreaterEqual(center.getchannel("A").getextrema()[0], 240)
            rgb = center.convert("RGB")
            self.assertGreaterEqual(min(channel.getextrema()[0] for channel in rgb.split()), 205)
            self.assertGreaterEqual(sum(rgb.getpixel((rgb.width // 2, rgb.height // 2))) / 3, 230)

    def test_reward_centers_retain_distinct_quality_hues(self):
        centers = []
        for index in range(1, 6):
            with Image.open(ROOT / self.runtime["rewards"][f"quality-{index}"]["path"]) as image:
                centers.append(image.getpixel((128, 128)))
                self.assertGreater(image.getpixel((128, 128))[3], 200)
        gray, blue, purple, rose, gold = centers
        self.assertLess(max(gray[:3]) - min(gray[:3]), 12)
        self.assertGreater(blue[2] - blue[0], 35)
        self.assertGreater(purple[2] - purple[1], 20)
        self.assertGreater(rose[0] - rose[1], 35)
        self.assertGreater(gold[0] - gold[2], 50)

    def test_cleanup_uses_alpha_without_removing_black_or_faint_brush_tips(self):
        original = Image.new("RGBA", (512, 512), (66, 95, 30, 0))
        original.putpixel((1, 1), (255, 255, 255, 4))
        original.paste((0, 0, 0, 254), (100, 100, 200, 200))
        original.putpixel((99, 150), (23, 30, 29, 5))
        cleaned = clean_alpha(original)
        self.assertEqual(cleaned.getpixel((0, 0)), (0, 0, 0, 0))
        self.assertEqual(cleaned.getpixel((1, 1)), (0, 0, 0, 0))
        self.assertEqual(cleaned.getpixel((120, 120)), (0, 0, 0, 254))
        self.assertEqual(cleaned.getpixel((99, 150)), (23, 30, 29, 5))
        with self.assertRaisesRegex(ValueError, "nonempty"):
            make_reward(Image.new("RGBA", (512, 512)))
        with self.assertRaisesRegex(ValueError, "cell edge"):
            make_paper(Image.new("RGBA", (30, 20), (0, 0, 0, 254)))

    def test_v7_only_never_rebuilds_older_artwork(self):
        with patch.object(sys, "argv", ["build_runtime_images.py", "--v7-only"]), \
                patch.object(build_runtime_images, "build_v7_assets", return_value=({}, 6, 200, 100)) as v7, \
                patch.object(build_runtime_images, "build_character_frames", side_effect=AssertionError("Unexpected character rewrite")), \
                patch.object(build_runtime_images, "build_v2_assets", side_effect=AssertionError("Unexpected V2 rewrite")), \
                patch.object(build_runtime_images, "build_v3_assets", side_effect=AssertionError("Unexpected V3 rewrite")), \
                patch.object(build_runtime_images, "build_v4_assets", side_effect=AssertionError("Unexpected V4 rewrite")), \
                patch.object(build_runtime_images, "build_v5_assets", side_effect=AssertionError("Unexpected V5 rewrite")), \
                patch.object(build_runtime_images, "build_v6_assets", side_effect=AssertionError("Unexpected V6 rewrite")):
            build_runtime_images.main()
            v7.assert_called_once_with()

    def test_full_build_includes_v7(self):
        with patch.object(sys, "argv", ["build_runtime_images.py"]), \
                patch.object(build_runtime_images, "build_character_frames", return_value=(90, 200, 100)), \
                patch.object(build_runtime_images, "build_v2_assets", return_value=({}, 1, 200, 100)), \
                patch.object(build_runtime_images, "build_v3_assets", return_value=({}, 1, 200, 100)), \
                patch.object(build_runtime_images, "build_v4_assets", return_value=({}, 1, 200, 100)), \
                patch.object(build_runtime_images, "build_v5_assets", return_value=({}, 1, 200, 100)), \
                patch.object(build_runtime_images, "build_v6_assets", return_value=({}, 1, 200, 100)), \
                patch.object(build_runtime_images, "build_v7_assets", return_value=({}, 6, 200, 100)) as v7:
            build_runtime_images.main()
            v7.assert_called_once_with()


if __name__ == "__main__":
    unittest.main()
