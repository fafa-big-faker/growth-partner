import hashlib
import json
from pathlib import Path
import sys
import unittest

from PIL import Image, ImageStat


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import import_ink_controls as importer


class InkControlsAssetsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = json.loads((importer.OUTPUT_ROOT / "source-manifest.json").read_text(encoding="utf-8"))
        cls.runtime = json.loads((importer.RUNTIME_ROOT / "manifest.json").read_text(encoding="utf-8"))

    def test_exact_three_transparent_assets_and_byte_budget(self):
        expected = {"return-arrow": (160, 121), "exp-track": (960, 46), "exp-fill": (960, 46)}
        self.assertEqual(set(self.runtime), set(expected))
        self.assertEqual(set(self.source["assets"]), set(expected))
        self.assertEqual({p.stem for p in importer.OUTPUT_ROOT.glob("*.png")}, set(expected))
        self.assertEqual({p.stem for p in importer.RUNTIME_ROOT.glob("*.webp")}, set(expected))
        total = 0
        for name, size in expected.items():
            spec = self.runtime[name]
            path = ROOT / spec["path"]
            with self.subTest(name=name), Image.open(path) as image:
                self.assertEqual(image.format, "WEBP")
                self.assertEqual(image.mode, "RGBA")
                self.assertEqual(image.size, size)
                self.assertEqual(list(image.size), spec["size"])
                self.assertEqual(list(image.getchannel("A").getextrema()), spec["alphaRange"])
                self.assertEqual(list(image.getchannel("A").getbbox()), spec["alphaBounds"])
                left, top, right, bottom = image.getchannel("A").getbbox()
                self.assertGreaterEqual(min(left, top, image.width - right, image.height - bottom), 2)
                self.assertGreater(image.getchannel("A").getextrema()[1], 250)
            self.assertEqual(path.stat().st_size, spec["bytes"])
            total += spec["bytes"]
        self.assertLess(total, importer.RUNTIME_BUDGET)

    def test_sources_are_fingerprinted_and_original_dimensions_are_recorded(self):
        self.assertEqual(self.source["minimumAlpha"], 5)
        self.assertEqual(self.source["script"], "scripts/import_ink_controls.py")
        for key, expected in importer.SOURCES.items():
            spec = self.source["sources"][key]
            self.assertEqual(spec["size"], list(expected["size"]))
            self.assertEqual(spec["sha256"], expected["sha256"])
            self.assertEqual(spec["mode"], "RGBA")
            path = importer.SOURCE_ROOT / expected["file"]
            if path.exists():
                self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), expected["sha256"])

    def test_runtime_reconstructs_from_png_and_preserves_alpha(self):
        for name in importer.ASSETS:
            with self.subTest(name=name), Image.open(ROOT / self.source["assets"][name]["path"]) as source, \
                    Image.open(ROOT / self.runtime[name]["path"]) as runtime:
                expected = importer.make_runtime(source, name)
                self.assertEqual(expected.size, runtime.size)
                self.assertEqual(expected.getchannel("A").tobytes(), runtime.getchannel("A").tobytes())
                bounds = source.getchannel("A").getbbox()
                padding = importer.ASSETS[name]["padding"]
                self.assertEqual(bounds, (padding, padding, source.width - padding, source.height - padding))

    def test_original_crops_keep_visible_outlines_and_align_slot_endpoints(self):
        for name, expected in importer.ASSETS.items():
            spec = self.source["assets"][name]
            self.assertEqual(spec["contentBounds"], list(expected["contentBounds"]))
            self.assertEqual(spec["cell"], list(expected["cell"]))
            original = importer.SOURCE_ROOT / importer.SOURCES[expected["source"]]["file"]
            if original.exists():
                with Image.open(original) as image, Image.open(ROOT / spec["path"]) as output:
                    self.assertEqual(output.tobytes(), importer.make_asset(image, name).tobytes())
        track = self.source["assets"]["exp-track"]
        fill = self.source["assets"]["exp-fill"]
        self.assertEqual(track["size"], [1333, 64])
        self.assertEqual(track["size"], fill["size"])
        self.assertEqual(track["alphaBounds"], fill["alphaBounds"])
        self.assertEqual(track["contentBounds"][::2], fill["contentBounds"][::2])
        self.assertEqual(self.runtime["exp-track"]["alphaBounds"], self.runtime["exp-fill"]["alphaBounds"])
        for name in ["exp-track", "exp-fill"]:
            self.assertEqual(self.runtime[name]["slice"], [6, 44, 6, 44])

    def test_no_halo_or_accidental_black_removal(self):
        image = Image.new("RGBA", (4, 1))
        samples = [(120, 150, 120, 0), (120, 150, 120, 4), (0, 0, 0, 255), (23, 30, 29, 5)]
        image.putdata(samples)
        self.assertEqual(list(importer.clean_alpha(image).get_flattened_data()),
                         [(0, 0, 0, 0), (0, 0, 0, 0), samples[2], samples[3]])
        for name in importer.ASSETS:
            with Image.open(ROOT / self.source["assets"][name]["path"]) as image:
                self.assertTrue(all(pixel[3] >= 5 or pixel == (0, 0, 0, 0) for pixel in image.get_flattened_data()))

    def test_arrow_and_slots_retain_readable_ink_and_distinct_fill(self):
        with Image.open(ROOT / self.runtime["return-arrow"]["path"]) as arrow:
            alpha = arrow.getchannel("A")
            self.assertGreater(sum(value > 150 for value in alpha.get_flattened_data()), arrow.width * arrow.height * 0.27)
            mean = ImageStat.Stat(arrow.convert("RGB"), alpha).mean
            self.assertLess(max(mean), 100)
            self.assertGreater(mean[1], mean[0])
        with Image.open(ROOT / self.runtime["exp-track"]["path"]) as track, \
                Image.open(ROOT / self.runtime["exp-fill"]["path"]) as fill:
            track_center, fill_center = track.getpixel((480, 23)), fill.getpixel((480, 23))
            self.assertGreater(min(track_center[:3]), 180)
            self.assertGreater(fill_center[1] - fill_center[0], 15)
            self.assertGreater(sum(track_center[:3]) - sum(fill_center[:3]), 150)

    @unittest.skipUnless(all((importer.SOURCE_ROOT / s["file"]).exists() for s in importer.SOURCES.values()),
                         "Original local art directory is unavailable")
    def test_deterministic_rebuild_only_targets_the_isolated_directories(self):
        outputs = importer.build_outputs()
        self.assertEqual(len(outputs), 8)
        for path, payload in outputs.items():
            self.assertIn(path.parent, [importer.OUTPUT_ROOT, importer.RUNTIME_ROOT])
            self.assertEqual(path.read_bytes(), payload, path.name)


if __name__ == "__main__":
    unittest.main()
