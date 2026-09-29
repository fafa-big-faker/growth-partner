"""Generate printable demo QR assets and verify the exact decoded destination.

Dependencies: qrcode==8.2, zxing-cpp==3.1.1, Pillow.
No network calls. No embedded credential other than the public demo URL.
"""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
# Optional workspace-local build dependencies; never bundled in the website.
local_deps = ROOT.parent / "_tmp" / "demo-qr-deps"
if local_deps.is_dir():
    sys.path.insert(0, str(local_deps))

import qrcode
from qrcode.image.svg import SvgPathFillImage
import zxingcpp
from PIL import Image

URL = "https://fafa-big-faker.github.io/growth-partner/?demo=1"
OUTPUT = ROOT / "docs" / "portfolio"


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=20, border=4)
    qr.add_data(URL)
    qr.make(fit=True)
    image = qr.make_image(fill_color="#253b33", back_color="white").convert("RGB")
    png = OUTPUT / "仙来-演示二维码.png"
    svg = OUTPUT / "仙来-演示二维码.svg"
    image.save(png, optimize=True)
    qr.make_image(image_factory=SvgPathFillImage).save(svg)
    for size in [image.width, 256, 160]:
        result = zxingcpp.read_barcode(image.resize((size, size), Image.Resampling.LANCZOS))
        if not result or result.text != URL:
            raise RuntimeError(f"QR decode failed at {size}px")
    print(f"QR verified: {image.width}x{image.height}px and 256/160px reductions.")
    print(URL)
    print(f"PNG {png.stat().st_size} bytes; SVG {svg.stat().st_size} bytes.")


if __name__ == "__main__":
    main()
