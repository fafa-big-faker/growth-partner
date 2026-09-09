from pathlib import Path
import importlib.util
import io
import json
import unittest
from PIL import Image, ImageChops, ImageStat

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("entry_art_import", ROOT / "scripts/import_entry_art.py")
importer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(importer)


class EntryPreparationArtworkTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.outputs, cls.source, cls.runtime = importer.generate()

    def test_source_fingerprint_and_complete_original_are_preserved(self):
        source = Image.open(importer.SOURCE).convert("RGB")
        archive = Image.open(importer.IMAGE_DIRECTORY / "background.png").convert("RGB")
        self.assertEqual(source.size, (1536, 1024))
        self.assertEqual(archive.size, source.size)
        self.assertIsNone(ImageChops.difference(source, archive).getbbox(), "Archived artwork must preserve every source pixel")
        self.assertEqual(self.source["source_sha256"], importer.sha(importer.SOURCE.read_bytes()))
        self.assertEqual(self.source["source_alpha"], [255, 255])

    def test_webp_retains_full_artwork_and_meets_small_download_budget(self):
        file = importer.RUNTIME_DIRECTORY / "background.webp"
        image = Image.open(file).convert("RGB")
        source = Image.open(importer.SOURCE).convert("RGB")
        self.assertEqual(image.size, (1536, 1024))
        self.assertEqual(self.runtime["crop"], [0, 0, 1536, 1024])
        self.assertEqual(self.runtime["quality"], 84)
        self.assertLessEqual(file.stat().st_size, 100 * 1024)
        self.assertEqual(file.stat().st_size, self.runtime["bytes"])
        self.assertEqual(importer.sha(file.read_bytes()), self.runtime["sha256"])
        self.assertLess(max(ImageStat.Stat(ImageChops.difference(image, source)).rms), 8,
                        "Compression must preserve the original paper and brush detail")

    def test_exact_outputs_are_deterministic_and_url_is_versioned(self):
        self.assertEqual(len(self.outputs), 4)
        for file, expected in self.outputs.items():
            self.assertEqual(file.read_bytes(), expected, str(file.relative_to(ROOT)))
        manifest = json.loads((importer.RUNTIME_DIRECTORY / "manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(manifest["url"], "assets/runtime/entry-preparation/background.webp?v=entry-preparation-20260910")
        self.assertEqual(manifest["source_sha256"], importer.SOURCE_SHA256)


if __name__ == "__main__":
    unittest.main()
