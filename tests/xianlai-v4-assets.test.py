import hashlib
import json
from pathlib import Path
import sys
import unittest

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from import_xianlai_v4_art import AXE_IDS, SOURCE_ROOT, clean_alpha, padded_cutout


EXPECTED_ITEM_IDS = {
    "0", "1", "10001", "10002", "10101", "10102", "10201", "10202", "10301", "10302",
    "20001", "20101", "20201", "20301", "30001", "30101", "30201", "40001", "40002",
    "51001", "51002", "52001", "52002", "53001", "53002", "54001", "54002", "55001",
}


class XianlaiV4AssetsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.runtime = json.loads((ROOT / "assets/runtime/v4/manifest.json").read_text(encoding="utf-8"))
        cls.source = json.loads((ROOT / "assets/images/v4/source-manifest.json").read_text(encoding="utf-8"))

    def test_exact_asset_mapping_dimensions_and_delivery_budget(self):
        self.assertEqual(set(self.runtime), {"items", "ui", "icons"})
        self.assertEqual(set(self.runtime["items"]), EXPECTED_ITEM_IDS)
        self.assertEqual(set(self.runtime["ui"]), {"slot-item", "slot-weapon", "modal-paper", "button-forge"})
        self.assertEqual(set(self.runtime["icons"]), {"icon-forge"})
        total = 0
        for group, assets in self.runtime.items():
            for name, spec in assets.items():
                with self.subTest(group=group, name=name):
                    path = ROOT / spec["path"]
                    with Image.open(path) as image:
                        self.assertEqual(image.format, "WEBP")
                        self.assertEqual(list(image.size), spec["size"])
                        self.assertEqual(image.mode, "RGBA")
                        if group in {"items", "icons"}:
                            self.assertEqual(image.size, (192, 256) if name in AXE_IDS else (160, 160))
                        if group == "ui":
                            top, right, bottom, left = spec["slice"]
                            self.assertLess(left + right, image.width)
                            self.assertLess(top + bottom, image.height)
                            self.assertLessEqual(max(image.size), 960)
                    total += path.stat().st_size
        self.assertLess(total, 800_000, "V4 UI and item artwork should remain lightweight")

    def test_every_cutout_has_nonempty_alpha_and_clear_safety_padding(self):
        for assets in self.runtime.values():
            for name, spec in assets.items():
                with self.subTest(name=name), Image.open(ROOT / spec["path"]) as image:
                    alpha = image.getchannel("A")
                    self.assertEqual(alpha.getextrema(), (0, 255))
                    mask = alpha.point(lambda value: 255 if value > 10 else 0)
                    left, top, right, bottom = mask.getbbox()
                    self.assertGreaterEqual(min(left, top, image.width - right, image.height - bottom), 1)
                    self.assertGreater(sum(value > 10 for value in alpha.get_flattened_data()), image.width * image.height * 0.15)

    def test_generated_sources_retain_independent_original_parts(self):
        seen_hashes = set()
        for group, assets in self.source["assets"].items():
            for name, spec in assets.items():
                with self.subTest(group=group, name=name):
                    path = ROOT / spec["path"]
                    digest = hashlib.sha256(path.read_bytes()).hexdigest()
                    self.assertNotIn(digest, seen_hashes, "two IDs unexpectedly use an identical cutout")
                    seen_hashes.add(digest)
                    with Image.open(path) as generated:
                        self.assertEqual(generated.mode, "RGBA")
                        self.assertEqual(list(generated.size), spec["size"])
                        bbox = generated.getchannel("A").getbbox()
                        self.assertGreaterEqual(min(bbox[0], bbox[1], generated.width - bbox[2], generated.height - bbox[3]), spec["padding"])
                        original_path = SOURCE_ROOT / self.source["sources"][spec["source"]]["file"]
                        if original_path.exists():
                            with Image.open(original_path) as original:
                                crop = clean_alpha(original.crop(spec["contentBounds"]))
                                self.assertEqual(generated.crop(bbox).getchannel("A").tobytes(), crop.getchannel("A").tobytes())

    def test_crop_bounds_never_touch_other_cells_or_original_edges(self):
        for assets in self.source["assets"].values():
            for name, spec in assets.items():
                with self.subTest(name=name):
                    left, top, right, bottom = spec["contentBounds"]
                    cell_left, cell_top, cell_right, cell_bottom = spec["cell"]
                    self.assertGreaterEqual(min(left - cell_left, top - cell_top, cell_right - right, cell_bottom - bottom), 3)

    def test_low_alpha_noise_cleanup_preserves_ink_and_colour(self):
        image = Image.new("RGBA", (4, 1))
        image.putdata([(12, 20, 23, 255), (255, 30, 10, 255), (255, 0, 255, 1), (66, 88, 75, 50)])
        cleaned = clean_alpha(image)
        self.assertEqual(cleaned.getpixel((0, 0)), image.getpixel((0, 0)))
        self.assertEqual(cleaned.getpixel((1, 0)), image.getpixel((1, 0)))
        self.assertEqual(cleaned.getpixel((2, 0))[3], 0)
        self.assertEqual(cleaned.getpixel((3, 0)), image.getpixel((3, 0)))

    def test_padding_preserves_detached_shards_without_stretching(self):
        image = Image.new("RGBA", (40, 40))
        image.paste((15, 30, 40, 255), (8, 9, 16, 25))
        image.paste((120, 150, 170, 180), (27, 16, 31, 21))
        result, bbox = padded_cutout(image, aspect="square", padding=8)
        self.assertEqual(bbox, (8, 9, 31, 25))
        self.assertEqual(result.width, result.height)
        original_alpha = sorted(value for value in image.getchannel("A").get_flattened_data() if value)
        result_alpha = sorted(value for value in result.getchannel("A").get_flattened_data() if value)
        self.assertEqual(original_alpha, result_alpha)
        with self.assertRaises(ValueError):
            padded_cutout(Image.new("RGBA", (10, 10), (0, 0, 0, 255)))


if __name__ == "__main__":
    unittest.main()
