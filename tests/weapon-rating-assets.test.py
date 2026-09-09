import hashlib
import json
from pathlib import Path
import sys
import unittest

from PIL import Image, ImageStat


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import import_weapon_ratings as importer


class WeaponRatingAssetsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = json.loads((importer.OUTPUT_ROOT / "source-manifest.json").read_text(encoding="utf-8"))
        cls.runtime = json.loads((importer.RUNTIME_ROOT / "manifest.json").read_text(encoding="utf-8"))

    def test_exact_five_transparent_marks_with_safe_padding_and_byte_budget(self):
        names = {"rating-b", "rating-a", "rating-s", "rating-ss", "rating-sss"}
        self.assertEqual(set(self.runtime), names)
        self.assertEqual(set(self.source["assets"]), names)
        self.assertEqual({p.stem for p in importer.OUTPUT_ROOT.glob("*.png")}, names)
        self.assertEqual({p.stem for p in importer.RUNTIME_ROOT.glob("*.webp")}, names)
        total = 0
        for name in names:
            spec = self.runtime[name]
            path = ROOT / spec["path"]
            with self.subTest(name=name), Image.open(path) as image:
                self.assertEqual(image.format, "WEBP")
                self.assertEqual(image.mode, "RGBA")
                self.assertEqual(image.size, (192, 96))
                self.assertEqual(list(image.size), spec["size"])
                self.assertEqual(list(image.getchannel("A").getbbox()), spec["alphaBounds"])
                self.assertEqual(list(image.getchannel("A").getextrema()), spec["alphaRange"])
                left, top, right, bottom = image.getchannel("A").getbbox()
                self.assertGreaterEqual(min(left, top, image.width - right, image.height - bottom), 10)
                self.assertGreater(image.getchannel("A").getextrema()[1], 250)
            self.assertEqual(path.stat().st_size, spec["bytes"])
            total += spec["bytes"]
        self.assertLess(total, 40 * 1024)

    def test_marks_share_letter_height_and_baseline_without_stretching_width(self):
        widths = {}
        for name, original in importer.ASSETS.items():
            spec = self.runtime[name]
            left, top, right, bottom = spec["alphaBounds"]
            widths[name] = right - left
            self.assertEqual((top, bottom), (12, 84))
            self.assertLessEqual(abs((left + right) / 2 - 96), 0.5)
            bounds = original["contentBounds"]
            expected_width = (bounds[2] - bounds[0]) * 72 / (bounds[3] - bounds[1])
            self.assertLessEqual(abs(widths[name] - expected_width), 1)
            self.assertEqual(spec["normalization"], {
                "glyphHeight": 72, "baseline": 84, "alignment": "center", "scaling": "uniform",
            })
        self.assertLess(widths["rating-b"], widths["rating-ss"])
        self.assertLess(widths["rating-a"], widths["rating-sss"])
        self.assertLess(widths["rating-ss"], widths["rating-sss"])

    def test_five_rarity_colors_remain_distinct(self):
        means = {}
        for name, spec in self.runtime.items():
            with Image.open(ROOT / spec["path"]) as image:
                means[name] = ImageStat.Stat(image.convert("RGB"), image.getchannel("A")).mean
        for name, color in means.items():
            for other, second in means.items():
                if name != other:
                    self.assertGreater(sum((a - b) ** 2 for a, b in zip(color, second)) ** 0.5, 35)
        self.assertLess(max(means["rating-b"]) - min(means["rating-b"]), 20)
        self.assertGreater(means["rating-a"][2], means["rating-a"][0] + 50)
        self.assertGreater(means["rating-s"][2], means["rating-s"][1] + 40)
        self.assertGreater(means["rating-ss"][0], means["rating-ss"][2] + 50)
        self.assertGreater(means["rating-sss"][0], means["rating-sss"][2] + 100)

    def test_source_fingerprint_bounds_and_normalization_are_recorded(self):
        spec = self.source["source"]
        self.assertEqual(self.source["script"], "scripts/import_weapon_ratings.py")
        self.assertEqual(self.source["minimumAlpha"], 5)
        self.assertEqual(spec["size"], [1536, 1024])
        self.assertEqual(spec["mode"], "RGBA")
        self.assertEqual(spec["alphaRange"], [0, 254])
        self.assertEqual(spec["sha256"], importer.SOURCE["sha256"])
        self.assertEqual(spec["emptyCell"], [1024, 512, 1536, 1024])
        for name, expected in importer.ASSETS.items():
            actual = self.source["assets"][name]
            self.assertEqual(actual["cell"], list(expected["cell"]))
            self.assertEqual(actual["contentBounds"], list(expected["contentBounds"]))
            self.assertEqual(actual["normalization"], self.runtime[name]["normalization"])
        if importer.source_path().exists():
            self.assertEqual(hashlib.sha256(importer.source_path().read_bytes()).hexdigest(), spec["sha256"])

    def test_runtime_reconstruction_preserves_png_alpha(self):
        for name in importer.ASSETS:
            with self.subTest(name=name), Image.open(ROOT / self.source["assets"][name]["path"]) as source, \
                    Image.open(ROOT / self.runtime[name]["path"]) as runtime:
                self.assertEqual(source.size, runtime.size)
                self.assertEqual(source.getchannel("A").tobytes(), runtime.getchannel("A").tobytes())
                self.assertEqual(importer.encoded(source, "WEBP", quality=90, method=6, exact=True),
                                 (ROOT / self.runtime[name]["path"]).read_bytes())

    def test_cleaning_never_discards_black_ink_or_visible_transparency(self):
        image = Image.new("RGBA", (5, 1))
        pixels = [(150, 25, 90, 0), (80, 100, 55, 4), (0, 0, 0, 255), (0, 0, 0, 5), (20, 30, 40, 100)]
        image.putdata(pixels)
        self.assertEqual(list(importer.clean_alpha(image).get_flattened_data()),
                         [(0, 0, 0, 0), (0, 0, 0, 0), *pixels[2:]])
        for spec in self.source["assets"].values():
            with Image.open(ROOT / spec["path"]) as image:
                self.assertTrue(all(pixel[3] >= 5 or pixel == (0, 0, 0, 0)
                                    for pixel in image.get_flattened_data()))

    @unittest.skipUnless(importer.source_path().exists(), "Original local art directory is unavailable")
    def test_original_pixel_reconstruction_and_cell_isolation(self):
        with Image.open(importer.source_path()) as original:
            self.assertIsNone(importer.clean_alpha(original.crop(importer.EMPTY_CELL)).getchannel("A").getbbox())
            for name, spec in importer.ASSETS.items():
                with self.subTest(name=name), Image.open(ROOT / self.source["assets"][name]["path"]) as output:
                    self.assertEqual(output.tobytes(), importer.make_asset(original, name).tobytes())
                    cell_only = Image.new("RGBA", original.size, (255, 0, 255, 255))
                    cell_only.paste(original.crop(spec["cell"]), spec["cell"][:2])
                    self.assertEqual(output.tobytes(), importer.make_asset(cell_only, name).tobytes())

    @unittest.skipUnless(importer.source_path().exists(), "Original local art directory is unavailable")
    def test_deterministic_rebuild_is_restricted_to_the_rating_directories(self):
        outputs = importer.build_outputs()
        self.assertEqual(len(outputs), 12)
        for path, payload in outputs.items():
            self.assertIn(path.parent, [importer.OUTPUT_ROOT, importer.RUNTIME_ROOT])
            self.assertEqual(path.read_bytes(), payload, path.name)


if __name__ == "__main__":
    unittest.main()
