import json
from pathlib import Path
import unittest

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
RUNTIME_ROOT = ROOT / "assets" / "runtime"
AXE_IDS = ("51001", "51002", "52001", "52002", "53001", "53002", "54001", "54002", "55001")


class RuntimeImageAssetsTest(unittest.TestCase):
    def test_character_runtime_frames_are_compact_transparent_webp(self) -> None:
        paths = []
        for axe_id in AXE_IDS:
            for group, count in (("idle-axes", 4), ("axes", 6)):
                for frame in range(1, count + 1):
                    path = RUNTIME_ROOT / "character" / group / axe_id / f"frame-{frame:02d}.webp"
                    self.assertTrue(path.exists(), f"missing {path.relative_to(ROOT)}")
                    with Image.open(path) as image:
                        self.assertEqual(image.size, (256, 512))
                        self.assertEqual(image.format, "WEBP")
                        self.assertIn("A", image.getbands())
                    paths.append(path)

        self.assertEqual(len(paths), 90)
        self.assertLess(sum(path.stat().st_size for path in paths), 4_000_000)

    def test_runtime_manifest_points_to_bounded_webp_assets(self) -> None:
        manifest_path = RUNTIME_ROOT / "v2" / "manifest.json"
        self.assertTrue(manifest_path.exists())
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        self.assertIn("chop-button-bg", manifest["ui"])
        limits = {
            "backgrounds": (1600, 1000),
            "trees": (512, 512),
            "ui": (256, 256),
            "icons": (160, 160),
            "effects": (160, 160),
        }
        for group_name, group in manifest.items():
            for relative_path in group.values():
                self.assertTrue(relative_path.endswith(".webp"))
                path = ROOT / relative_path
                self.assertTrue(path.exists(), f"missing {relative_path}")
                with Image.open(path) as image:
                    max_width, max_height = limits[group_name]
                    self.assertLessEqual(image.width, max_width)
                    self.assertLessEqual(image.height, max_height)

        runtime_files = list(RUNTIME_ROOT.rglob("*.webp"))
        self.assertLess(sum(path.stat().st_size for path in runtime_files), 7_000_000)


if __name__ == "__main__":
    unittest.main()
