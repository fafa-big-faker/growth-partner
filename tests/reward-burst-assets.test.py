from pathlib import Path
import importlib.util
import io
import unittest
from PIL import Image, ImageChops, ImageStat

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("reward_burst_import", ROOT / "scripts/import_reward_bursts.py")
importer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(importer)


class RewardBurstArtworkTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.outputs, cls.source, cls.runtime = importer.generate()

    def test_source_fingerprints_and_all_twelve_cells_are_preserved_exactly(self):
        for key, (name, fingerprint) in importer.SOURCES.items():
            path = importer.SOURCE_DIRECTORY / name
            source = Image.open(path).convert("RGBA")
            self.assertEqual(importer.sha(path.read_bytes()), fingerprint)
            self.assertEqual(source.size, (1448, 1086))
            reconstructed = Image.new("RGBA", source.size)
            for frame in self.source["sources"][key]["frames"]:
                image = Image.open(ROOT / frame["path"]).convert("RGBA")
                self.assertEqual(image.size, (362, 362))
                self.assertEqual(image.tobytes(), source.crop(frame["box"]).tobytes())
                reconstructed.paste(image, frame["box"][:2])
            self.assertEqual(reconstructed.tobytes(), source.tobytes(), "Every original pixel must be archived once, including edge fragments")

    def test_runtime_contains_all_frames_in_row_major_order_with_lossless_alpha(self):
        for key, (name, _) in importer.SOURCES.items():
            source = Image.open(importer.SOURCE_DIRECTORY / name).convert("RGBA")
            atlas = Image.open(importer.RUNTIME_DIRECTORY / f"{key}.webp").convert("RGBA")
            self.assertEqual(atlas.size, (1024, 768))
            self.assertEqual(len(self.runtime["assets"][key]["frames"]), 12)
            for index, frame in enumerate(self.runtime["assets"][key]["frames"]):
                x, y = index % 4 * 256, index // 4 * 256
                self.assertEqual((frame["index"], frame["x"], frame["y"]), (index, x, y))
                expected = importer.runtime_frame(source.crop(importer.source_box(index)))
                actual = atlas.crop((x, y, x + 256, y + 256))
                self.assertEqual(actual.getchannel("A").tobytes(), expected.getchannel("A").tobytes())
                # Compare visible colors on the game's paper, not arbitrary invisible RGB.
                paper = Image.new("RGBA", (256, 256), (240, 236, 225, 255))
                difference = ImageChops.difference(Image.alpha_composite(paper, actual).convert("RGB"),
                                                  Image.alpha_composite(paper, expected).convert("RGB"))
                self.assertLess(max(ImageStat.Stat(difference).rms), 8, "Compression must preserve brush texture and silver accents")

    def test_shared_center_full_frame_scale_and_transparent_padding_prevent_bleed(self):
        self.assertEqual(self.runtime["frame_anchor"], [128, 128])
        self.assertEqual(self.runtime["padding"], 16)
        self.assertEqual(self.runtime["content_size"], 224)
        for key, (name, _) in importer.SOURCES.items():
            source = Image.open(importer.SOURCE_DIRECTORY / name).convert("RGBA")
            for index in range(12):
                frame = source.crop(importer.source_box(index))
                # Measured source borders contain at most almost-transparent alpha=5.
                alpha = frame.getchannel("A")
                for border in ((0, 0, 362, 1), (0, 361, 362, 362), (0, 0, 1, 362), (361, 0, 362, 362)):
                    self.assertLessEqual(alpha.crop(border).getextrema()[1], 5, "Inspect replacement art for cross-cell motion before cutting")
                bounds = self.runtime["assets"][key]["frames"][index]["alpha_bounds"]
                self.assertIsNotNone(bounds)
                self.assertGreaterEqual(min(bounds[:2]), 16)
                self.assertLessEqual(max(bounds[2:]), 240)

    def test_initial_and_final_fragments_remain_and_explosion_has_real_shape_changes(self):
        for key, (name, _) in importer.SOURCES.items():
            atlas = Image.open(importer.RUNTIME_DIRECTORY / f"{key}.webp").convert("RGBA")
            masses, masks = [], []
            for index in range(12):
                x, y = index % 4 * 256, index // 4 * 256
                alpha = atlas.crop((x, y, x + 256, y + 256)).getchannel("A")
                masses.append(sum(alpha.tobytes()))
                masks.append(importer.sha(alpha.tobytes()))
            self.assertEqual(len(set(masks)), 12, "Do not replace real motion with copies of one scaled image")
            self.assertGreater(masses[0], 0)
            self.assertGreater(masses[-1], 0, "Retain final source particles instead of deleting the last frame")
            self.assertLess(masses[-1], max(masses) * 0.02)
            self.assertIn(masses.index(max(masses)), (4, 5))

    def test_exact_scoped_outputs_deterministic_versions_and_download_budget(self):
        self.assertEqual(len(self.outputs), 28)
        allowed_roots = (importer.IMAGE_DIRECTORY, importer.RUNTIME_DIRECTORY)
        for path, expected in self.outputs.items():
            self.assertTrue(any(path.is_relative_to(directory) for directory in allowed_roots))
            self.assertEqual(path.read_bytes(), expected, path.relative_to(ROOT))
        self.assertEqual(len(list(importer.IMAGE_DIRECTORY.glob("*/frame-*.png"))), 24)
        self.assertEqual(len(list(importer.RUNTIME_DIRECTORY.glob("*.webp"))), 2)
        self.assertLessEqual(self.runtime["total_bytes"], 600 * 1024)
        self.assertEqual(self.runtime["quality"], 90)
        for key, asset in self.runtime["assets"].items():
            path = importer.RUNTIME_DIRECTORY / f"{key}.webp"
            self.assertEqual(asset["bytes"], path.stat().st_size)
            self.assertEqual(asset["sha256"], importer.sha(path.read_bytes()))
            self.assertEqual(asset["url"], f"assets/runtime/reward-bursts/{key}.webp?v={importer.VERSION}")


if __name__ == "__main__":
    unittest.main()
