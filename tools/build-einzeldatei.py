#!/usr/bin/env python3
"""Baut die komplette Website als eine einzige, releasefähige HTML-Datei.

Alle Bilder (verkleinert und komprimiert), beide Schriften und das Favicon
werden als Data-URIs direkt in die Datei eingebettet – das Ergebnis
`wertacher-muehle.html` funktioniert ohne weitere Dateien, auch offline.

Aufruf (aus dem Projektstamm):  python3 tools/build-einzeldatei.py
Benötigt: Pillow  (pip install Pillow)
"""

import base64
import io
import os
import urllib.parse

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEMPLATE = os.path.join(ROOT, "tools", "einzeldatei-vorlage.html")
OUTPUT = os.path.join(ROOT, "wertacher-muehle.html")

# Platzhalter -> (Datei, maximale Breite in px, JPEG-Qualität)
IMAGES = {
    "IMG_hero": ("images/hero-muehle-abend.jpg", 1920, 80),
    "IMG_vogel": ("images/muehle-vogelperspektive.jpg", 1300, 78),
    "IMG_luftbild": ("images/muehle-luftbild.jpg", 1400, 78),
    "IMG_fassade": ("images/fassade-schindeln.jpg", 1300, 78),
    "IMG_allgaeu": ("images/allgaeu-landschaft.jpg", 1300, 78),
    "IMG_weide": ("images/pferde-weide.jpg", 1300, 78),
    "IMG_pferd": ("images/pferd-portrait.jpg", 900, 78),
    "IMG_katze_stall": ("images/katze-stall.jpg", 900, 78),
    "IMG_katze": ("images/katze.jpg", 900, 78),
    "IMG_hasen": ("images/hasen.jpg", 900, 78),
    "IMG_esel": ("images/esel.jpg", 900, 78),
    "IMG_kuehe": ("images/kuehe-morgennebel.jpg", 900, 78),
}

FONTS = {
    "FONT_FRAUNCES": "fonts/fraunces-var.woff2",
    "FONT_INTER": "fonts/inter-var.woff2",
}


def jpeg_data_uri(path, max_width, quality):
    """Bild verkleinern, als progressives JPEG komprimieren, Base64-kodieren."""
    with Image.open(path) as im:
        im = im.convert("RGB")
        if im.width > max_width:
            height = round(im.height * max_width / im.width)
            im = im.resize((max_width, height), Image.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=quality, optimize=True, progressive=True)
        data = base64.b64encode(buf.getvalue()).decode("ascii")
        return f"data:image/jpeg;base64,{data}", im.width, im.height, buf.tell()


def main():
    with open(TEMPLATE, encoding="utf-8") as f:
        html = f.read()

    total = 0
    for key, (rel, max_width, quality) in IMAGES.items():
        uri, w, h, size = jpeg_data_uri(os.path.join(ROOT, rel), max_width, quality)
        total += size
        html = html.replace(
            f"@@{key}@@", f'src="{uri}" width="{w}" height="{h}"'
        )
        print(f"  {rel}: {w}x{h}, {size // 1024} KB")

    for key, rel in FONTS.items():
        with open(os.path.join(ROOT, rel), "rb") as f:
            data = base64.b64encode(f.read()).decode("ascii")
        html = html.replace(f"@@{key}@@", f"data:font/woff2;base64,{data}")

    with open(os.path.join(ROOT, "favicon.svg"), encoding="utf-8") as f:
        svg = " ".join(f.read().split())
    html = html.replace(
        "@@FAVICON@@", "data:image/svg+xml," + urllib.parse.quote(svg)
    )

    if "@@" in html:
        rest = html[html.index("@@"):html.index("@@") + 40]
        raise SystemExit(f"Nicht ersetzter Platzhalter: {rest!r}")

    with open(OUTPUT, "w", encoding="utf-8") as f:
        f.write(html)

    print(f"Bilder gesamt: {total // 1024} KB")
    print(f"Geschrieben: {OUTPUT} ({os.path.getsize(OUTPUT) // 1024} KB)")


if __name__ == "__main__":
    main()
