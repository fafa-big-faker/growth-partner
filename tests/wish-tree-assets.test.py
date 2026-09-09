import hashlib
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import import_wish_trees as importer


class WishTreeAssetsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = json.loads((importer.OUTPUT_ROOT / "source-manifest.json").read_text(encoding="utf-8"))
        cls.runtime = json.loads((importer.RUNTIME_ROOT / "manifest.json").read_text(encoding="utf-8"))

    def test_exact_twenty_compact_transparent_assets(self):
        base_names = {f"tree_{n:02}" for n in range(1, 6)} | {f"light-{n:02}" for n in range(1, 6)}
        names = base_names | {name + "@2x" for name in base_names}
        self.assertEqual(set(self.runtime), names)
        self.assertEqual(set(self.source["assets"]), names)
        self.assertEqual({p.stem for p in importer.OUTPUT_ROOT.glob("*.png")}, names)
        self.assertEqual({p.stem for p in importer.RUNTIME_ROOT.glob("*.webp")}, names)
        totals = {1: 0, 2: 0}
        for name, spec in self.runtime.items():
            with self.subTest(name=name):
                path = ROOT / spec["path"]
                self.assertEqual(spec["path"], f"assets/runtime/wish-trees/{name}.webp")
                payload = path.read_bytes()
                self.assertEqual(hashlib.sha256(payload).hexdigest(), spec["sha256"])
                self.assertEqual(len(payload), spec["bytes"])
                density = spec["density"]
                self.assertEqual(density, 2 if name.endswith("@2x") else 1)
                self.assertEqual(spec["quality"], 95 if density == 2 else 90)
                totals[density] += len(payload)
                with Image.open(path) as runtime, Image.open(ROOT / self.source["assets"][name]["path"]) as png:
                    self.assertEqual(runtime.format, "WEBP")
                    self.assertEqual(runtime.mode, "RGBA")
                    size = 384 * density
                    self.assertEqual(runtime.size, (size, size))
                    self.assertEqual(png.size, runtime.size)
                    self.assertEqual(runtime.getchannel("A").tobytes(), png.getchannel("A").tobytes())
                    alpha = runtime.getchannel("A")
                    self.assertEqual(alpha.getextrema()[0], 0)
                    self.assertGreater(alpha.getextrema()[1], 100)
                    bounds = alpha.getbbox()
                    self.assertEqual(list(bounds), spec["alphaBounds"])
                    self.assertGreaterEqual(min(bounds[0], bounds[1], size - bounds[2], size - bounds[3]), 8 * density)
        self.assertEqual(sum(totals.values()), self.source["runtimeBytes"])
        for density, budget in [(1, 400 * 1024), (2, int(1.4 * 1024 * 1024))]:
            self.assertEqual(totals[density], self.source["densities"][str(density)]["runtimeBytes"])
            self.assertLessEqual(totals[density], budget)

    def test_published_1x_png_and_webp_bytes_are_unchanged(self):
        digest = hashlib.sha256()
        for directory, extension in [(importer.OUTPUT_ROOT, "*.png"), (importer.RUNTIME_ROOT, "*.webp")]:
            files = sorted(p for p in directory.glob(extension) if "@" not in p.name)
            self.assertEqual(len(files), 10)
            for path in files:
                digest.update(path.read_bytes())
        self.assertEqual(digest.hexdigest(), "c945ab06e0b0515f42d81e423dab04c0d16a3e8b59f1285f03348a8e0f8ec014")

    def test_five_ground_lines_and_solid_lower_trunk_strikes_match(self):
        previous_height = previous_pixels = 0
        for n in range(1, 6):
            name = f"tree_{n:02}"
            meta = self.runtime[name]
            self.assertEqual(meta["canvasAnchors"]["strike"], [176, 272])
            self.assertEqual(meta["canvasAnchors"]["ground"][1], 360)
            self.assertEqual(meta["anchors"]["strike"], [0.4583333333, 0.7083333333])
            self.assertEqual(meta["anchors"]["ground"][1], 0.9375)
            self.assertEqual(self.source["assets"][name]["scale"], 0.64)
            self.assertEqual(meta["anchors"], self.runtime[f"light-{n:02}"]["anchors"])
            with Image.open(ROOT / self.source["assets"][name]["path"]) as image:
                # The hit point must be actual opaque brown trunk, not a crown-bound approximation.
                r, g, b, alpha = image.getpixel((176, 272))
                self.assertGreaterEqual(alpha, 220)
                self.assertGreater(r, g)
                self.assertGreater(g, b)
                self.assertLess(g, 150)
                box = image.getchannel("A").getbbox()
                self.assertEqual(box[3], 360)
                self.assertGreater(box[3] - box[1], previous_height)
                self.assertGreater(meta["visiblePixels"], previous_pixels)
                previous_height, previous_pixels = box[3] - box[1], meta["visiblePixels"]
                crown = meta["canvasAnchors"]["crown"]
                self.assertLess(crown[1], 272)
                self.assertIsNotNone(image.getchannel("A").crop((int(crown[0]) - 6, int(crown[1]) - 6,
                                                                int(crown[0]) + 7, int(crown[1]) + 7)).getbbox())

    def test_hd_anchors_and_full_silhouette_align_with_1x(self):
        for n in range(1, 6):
            name = f"tree_{n:02}"
            base, hd = self.runtime[name], self.runtime[name + "@2x"]
            self.assertEqual(hd["anchors"], base["anchors"])
            self.assertEqual(hd["anchors"], self.runtime[f"light-{n:02}@2x"]["anchors"])
            self.assertEqual(hd["canvasAnchors"], {key: [round(v * 2, 6) for v in point]
                                                 for key, point in base["canvasAnchors"].items()})
            self.assertEqual(self.source["assets"][name + "@2x"]["scale"], 1.28)
            with Image.open(importer.OUTPUT_ROOT / f"{name}@2x.png") as image:
                r, g, b, alpha = image.getpixel((352, 544))
                self.assertGreaterEqual(alpha, 220)
                self.assertGreater(r, g)
                self.assertGreater(g, b)
                self.assertLess(g, 150)
                bounds = image.getchannel("A").getbbox()
                self.assertLessEqual(abs(bounds[3] - 720), 1)
                for normal, doubled in zip(base["alphaBounds"], bounds):
                    self.assertLessEqual(abs(normal * 2 - doubled), 3,
                                         "the original silhouette must keep its position at both densities")

    def test_light_is_a_small_subset_of_existing_bright_pixels(self):
        for n, suffix in ((n, suffix) for n in range(1, 6) for suffix in ("", "@2x")):
            with self.subTest(tree=n, density=suffix), \
                    Image.open(importer.OUTPUT_ROOT / f"tree_{n:02}{suffix}.png") as tree, \
                    Image.open(importer.OUTPUT_ROOT / f"light-{n:02}{suffix}.png") as light:
                visible_tree = visible_light = 0
                for base, highlight in zip(tree.get_flattened_data(), light.get_flattened_data()):
                    visible_tree += base[3] >= 5
                    if highlight[3] >= 5:
                        visible_light += 1
                        self.assertEqual(highlight[:3], base[:3], "highlight must retain original art RGB")
                        self.assertGreaterEqual(base[3], 64)
                        self.assertLessEqual(highlight[3], base[3])
                        self.assertGreater(sum(v * w for v, w in zip(base[:3], (0.2126, 0.7152, 0.0722))), 190)
                self.assertGreater(visible_light / visible_tree, 0.025)
                self.assertLess(visible_light / visible_tree, 0.25)
                self.assertEqual(light.tobytes(), importer.make_light(tree).tobytes())

    def test_alpha_cleanup_preserves_black_ink_and_visible_faint_edges(self):
        source = Image.new("RGBA", (5, 1))
        source.putdata([(255, 200, 0, 0), (100, 200, 0, 4), (0, 0, 0, 255), (2, 3, 4, 5), (10, 20, 30, 64)])
        self.assertEqual(list(importer.clean_alpha(source).get_flattened_data()),
                         [(0, 0, 0, 0), (0, 0, 0, 0), (0, 0, 0, 255), (2, 3, 4, 5), (10, 20, 30, 64)])

    def test_source_fingerprint_and_measured_partition_preserve_crossed_branches(self):
        self.assertEqual(self.source["source"]["sha256"], importer.SOURCE_SHA256)
        self.assertEqual(self.source["source"]["size"], [1536, 1024])
        self.assertEqual(self.source["source"]["mode"], "RGBA")
        if not importer.SOURCE_PATH.exists():
            self.skipTest("Original atlas exists only in the local art workspace")
        self.assertEqual(hashlib.sha256(importer.SOURCE_PATH.read_bytes()).hexdigest(), importer.SOURCE_SHA256)
        with Image.open(importer.SOURCE_PATH) as original:
            cleaned = importer.clean_alpha(original)
            alpha = cleaned.getchannel("A")
            self.assertIsNone(alpha.crop((0, 471, 1536, 490)).getbbox())
            self.assertIsNone(alpha.crop((509, 490, 532, 1024)).getbbox())
            # Stage five crosses the nominal 512-high/1024-wide cell boundaries.
            self.assertIsNotNone(alpha.crop((532, 490, 1024, 512)).getbbox())
            self.assertIsNotNone(alpha.crop((1024, 512, 1074, 996)).getbbox())
            exported_count = 0
            for name, spec in importer.ASSETS.items():
                box = alpha.crop(spec["cell"]).getbbox()
                c = spec["cell"]
                self.assertEqual((box[0] + c[0], box[1] + c[1], box[2] + c[0], box[3] + c[1]), spec["bounds"])
                exported_count += sum(v >= 5 for v in alpha.crop(spec["cell"]).get_flattened_data())
                expected = importer.make_tree(original, name)
                with Image.open(importer.OUTPUT_ROOT / f"{name}.png") as output:
                    self.assertEqual(expected.tobytes(), output.tobytes())
                strike = importer.source_anchors(name)["strike"]
                pixel = original.getpixel((int(strike[0]), int(strike[1])))
                self.assertGreater(pixel[3], 220)
            self.assertEqual(exported_count, sum(v >= 5 for v in alpha.get_flattened_data()),
                             "all visible art must belong to exactly one tree, without clipping or contamination")

    @unittest.skipUnless(importer.SOURCE_PATH.exists(), "Local source unavailable")
    def test_hd_retains_original_detail_without_resizing_the_1x_export(self):
        with Image.open(importer.SOURCE_PATH) as original:
            for name in importer.ASSETS:
                with patch.object(Image.Image, "resize", side_effect=AssertionError("HD must sample the atlas once")):
                    rebuilt = importer.make_tree(original, name, 2)
                with Image.open(importer.OUTPUT_ROOT / f"{name}@2x.png") as hd, \
                        Image.open(importer.OUTPUT_ROOT / f"{name}.png") as low:
                    self.assertEqual(rebuilt.tobytes(), hd.tobytes())
                    enlarged = low.resize(hd.size, Image.Resampling.BICUBIC)
                    differences = [sum(abs(a - b) for a, b in zip(source[:3], blurry[:3])) / 3
                                   for source, blurry in zip(hd.get_flattened_data(), enlarged.get_flattened_data())
                                   if source[3] >= 220 and blurry[3] >= 220]
                    self.assertGreater(len(differences), 1000)
                    self.assertGreater(sum(differences) / len(differences), 1,
                                       "HD must retain source detail absent from a 384px enlargement")

    @unittest.skipUnless(importer.SOURCE_PATH.exists(), "Local source unavailable")
    def test_deterministic_rebuild_only_writes_isolated_asset_directories(self):
        outputs = importer.build_outputs()
        self.assertEqual(len(outputs), 42)
        for path, payload in outputs.items():
            self.assertIn(path.parent, [importer.OUTPUT_ROOT, importer.RUNTIME_ROOT])
            self.assertEqual(path.read_bytes(), payload, path.name)


if __name__ == "__main__":
    unittest.main()
