#!/usr/bin/env python3
"""
ZapiTV — Gerador Oficial de Ícones do Aplicativo (PWA / Favicon / Apple Touch)
Utiliza exclusivamente como matriz o arquivo oficial:
C:\\Users\\gebel\\Downloads\\Mobile Icon.jpg

Exporta:
- pwa-512x512.png (purpose: any)
- pwa-192x192.png (purpose: any)
- pwa-maskable-512x512.png (purpose: maskable com safe-zone 80%)
- pwa-maskable-192x192.png (purpose: maskable com safe-zone 80%)
- apple-touch-icon.png (180x180)
- favicon-32x32.png
- favicon-16x16.png
- favicon.ico (16x16, 32x32, 48x48)
"""

import os
import sys
from PIL import Image

def generate_icons(
    src_path=r"C:\Users\gebel\Downloads\Mobile Icon.jpg",
    public_dir=None
):
    if public_dir is None:
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        public_dir = os.path.join(base_dir, "public")

    if not os.path.exists(src_path):
        raise FileNotFoundError(f"Imagem matriz oficial não encontrada em: {src_path}")

    img = Image.open(src_path).convert("RGB")
    bg_color = img.getpixel((0, 0))

    # 1. pwa-512x512.png
    img.resize((512, 512), Image.Resampling.LANCZOS).save(
        os.path.join(public_dir, "pwa-512x512.png"),
        format="PNG",
        optimize=True
    )

    # 2. pwa-192x192.png
    img.resize((192, 192), Image.Resampling.LANCZOS).save(
        os.path.join(public_dir, "pwa-192x192.png"),
        format="PNG",
        optimize=True
    )

    # 3. Maskable: 80% do diâmetro central para conformidade W3C Safe-Zone
    maskable_canvas = Image.new("RGB", (1024, 1024), bg_color)
    scaled_symbol = img.resize((820, 820), Image.Resampling.LANCZOS)
    offset = ((1024 - 820) // 2, (1024 - 820) // 2)
    maskable_canvas.paste(scaled_symbol, offset)

    maskable_canvas.resize((512, 512), Image.Resampling.LANCZOS).save(
        os.path.join(public_dir, "pwa-maskable-512x512.png"),
        format="PNG",
        optimize=True
    )
    maskable_canvas.resize((192, 192), Image.Resampling.LANCZOS).save(
        os.path.join(public_dir, "pwa-maskable-192x192.png"),
        format="PNG",
        optimize=True
    )

    # 4. apple-touch-icon.png (180x180)
    img.resize((180, 180), Image.Resampling.LANCZOS).save(
        os.path.join(public_dir, "apple-touch-icon.png"),
        format="PNG",
        optimize=True
    )

    # 5. favicon-32x32.png
    img.resize((32, 32), Image.Resampling.LANCZOS).save(
        os.path.join(public_dir, "favicon-32x32.png"),
        format="PNG",
        optimize=True
    )

    # 6. favicon-16x16.png
    img.resize((16, 16), Image.Resampling.LANCZOS).save(
        os.path.join(public_dir, "favicon-16x16.png"),
        format="PNG",
        optimize=True
    )

    # 7. favicon.ico (16x16, 32x32, 48x48)
    img.save(
        os.path.join(public_dir, "favicon.ico"),
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)]
    )
    print("Ícones oficiais do ZapiTV gerados com sucesso em:", public_dir)

if __name__ == "__main__":
    generate_icons()
