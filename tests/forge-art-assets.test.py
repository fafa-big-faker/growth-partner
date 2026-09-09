import hashlib
import json
from pathlib import Path
import sys
import unittest

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import import_forge_art as importer


class ForgeArtAssetsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = json.loads((importer.OUTPUT_ROOT / "source-manifest.json").read_text(encoding="utf-8"))
        cls.runtime = json.loads((importer.RUNTIME_ROOT / "manifest.json").read_text(encoding="utf-8"))

    def test_exact_two_public_assets_keep_transparency_and_compact_bytes(self):
        expected = {"stage": (320, 384), "equip-slip": (288, 86)}
        self.assertEqual(set(self.runtime), set(expected))
        self.assertEqual(set(self.source["assets"]), set(expected))
        self.assertEqual({path.stem for path in importer.OUTPUT_ROOT.glob("*.png")}, set(expected))
        self.assertEqual({path.stem for path in importer.RUNTIME_ROOT.glob("*.webp")}, set(expected))
        total = 0
        for name, size in expected.items():
            spec = self.runtime[name]
            path = ROOT / spec["path"]
            self.assertEqual(spec["path"], f"assets/runtime/forge-workshop/{name}.webp")
            with self.subTest(name=name), Image.open(path) as image:
                self.assertEqual(image.format, "WEBP")
                self.assertEqual(image.mode, "RGBA")
                self.assertEqual(image.size, size)
                self.assertEqual(list(image.size), spec["size"])
                self.assertEqual(list(image.getchannel("A").getextrema()), spec["alphaRange"])
                self.assertEqual(list(image.getchannel("A").getbbox()), spec["alphaBounds"])
                left, top, right, bottom = image.getchannel("A").getbbox()
                self.assertGreaterEqual(min(left, top, image.width - right, image.height - bottom), 3)
                self.assertGreaterEqual(image.getchannel("A").getextrema()[1], 250)
                self.assertEqual(image.getchannel("A").getextrema()[0], 0)
            payload = path.read_bytes()
            self.assertEqual(len(payload), spec["bytes"])
            self.assertEqual(hashlib.sha256(payload).hexdigest(), spec["sha256"])
            total += len(payload)
        self.assertEqual(self.source["runtimeBytes"], total)
        self.assertEqual(self.source["runtimeBudgetBytes"], 96 * 1024)
        self.assertLessEqual(total, 96 * 1024)

    def test_sources_have_recorded_fingerprints_and_original_dimensions(self):
        self.assertEqual(self.source["minimumAlpha"], 5)
        self.assertEqual(self.source["script"], "scripts/import_forge_art.py")
        self.assertEqual(set(self.source["sources"]), {"workshop"})
        spec = self.source["sources"]["workshop"]
        self.assertEqual(spec["size"], [1536, 1024])
        self.assertEqual(spec["mode"], "RGBA")
        self.assertEqual(spec["alphaRange"], [0, 254])
        self.assertEqual(spec["sha256"], importer.SOURCES["workshop"]["sha256"])
        path = importer.SOURCE_ROOT / spec["file"]
        if path.exists():
            self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), spec["sha256"])

    def test_runtime_is_proportional_to_png_and_keeps_lossless_alpha(self):
        for name, size in {"stage": (793, 951), "equip-slip": (693, 207)}.items():
            spec = self.source["assets"][name]
            with self.subTest(name=name), Image.open(ROOT / spec["path"]) as source, \
                    Image.open(ROOT / self.runtime[name]["path"]) as runtime:
                self.assertEqual(source.size, size)
                self.assertEqual(source.mode, "RGBA")
                self.assertEqual(source.getchannel("A").getbbox(), (12, 12, size[0] - 12, size[1] - 12))
                self.assertLess(abs(runtime.width / source.width - runtime.height / source.height), 0.002)
                expected = importer.make_runtime(source, name)
                self.assertEqual(expected.getchannel("A").tobytes(), runtime.getchannel("A").tobytes())
                self.assertEqual(hashlib.sha256((ROOT / spec["path"]).read_bytes()).hexdigest(), spec["sha256"])

    def test_alpha_cleanup_keeps_black_and_the_complete_low_opacity_outline(self):
        image = Image.new("RGBA", (5, 1))
        pixels = [(90, 120, 60, 0), (90, 120, 60, 4), (0, 0, 0, 255), (20, 30, 40, 5), (30, 40, 50, 6)]
        image.putdata(pixels)
        self.assertEqual(list(importer.clean_alpha(image).get_flattened_data()), [(0, 0, 0, 0)] * 2 + pixels[2:])
        for name in importer.ASSETS:
            with Image.open(ROOT / self.source["assets"][name]["path"]) as image:
                self.assertTrue(all(pixel[3] >= 5 or pixel == (0, 0, 0, 0) for pixel in image.get_flattened_data()))

    @unittest.skipUnless((importer.SOURCE_ROOT / importer.SOURCES["workshop"]["file"]).exists(), "Local source unavailable")
    def test_measured_crops_preserve_every_visible_pixel_without_cross_contamination(self):
        with Image.open(importer.SOURCE_ROOT / importer.SOURCES["workshop"]["file"]) as original:
            alpha = original.getchannel("A").point(lambda value: value if value >= 5 else 0)
            self.assertIsNone(alpha.crop((817, 0, 829, 1024)).getbbox(), "the split lies in a fully transparent gap")
            all_visible = sum(value >= 5 for value in alpha.get_flattened_data())
            exported_visible = 0
            expected_bounds = {"stage": (48, 52, 817, 979), "equip-slip": (829, 417, 1498, 600)}
            for name, bounds in expected_bounds.items():
                spec = self.source["assets"][name]
                self.assertEqual(spec["contentBounds"], list(bounds))
                self.assertEqual(spec["padding"], 12)
                crop = original.crop(bounds)
                crop.putdata([pixel if pixel[3] >= 5 else (0, 0, 0, 0) for pixel in crop.get_flattened_data()])
                with Image.open(ROOT / spec["path"]) as output:
                    center = output.crop((12, 12, output.width - 12, output.height - 12))
                    self.assertEqual(center.tobytes(), crop.tobytes(), name)
                    exported_visible += sum(value >= 5 for value in output.getchannel("A").get_flattened_data())
            self.assertEqual(exported_visible, all_visible, "every visible source pixel belongs to exactly one exported asset")

    @unittest.skipUnless((importer.SOURCE_ROOT / importer.SOURCES["workshop"]["file"]).exists(), "Local source unavailable")
    def test_deterministic_rebuild_only_targets_the_two_isolated_directories(self):
        outputs = importer.build_outputs()
        self.assertEqual(len(outputs), 6)
        for path, payload in outputs.items():
            self.assertIn(path.parent, [importer.OUTPUT_ROOT, importer.RUNTIME_ROOT])
            self.assertEqual(path.read_bytes(), payload, path.name)


if __name__ == "__main__":
    unittest.main()
