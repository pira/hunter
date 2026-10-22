#!/usr/bin/env python3
"""Renders icons/*.png from tools/icons/icon.html with headless Chromium (Playwright)."""
import pathlib
from playwright.sync_api import sync_playwright

root = pathlib.Path(__file__).resolve().parents[2]
html = (root / 'tools/icons/icon.html').as_uri()
out = root / 'icons'
out.mkdir(exist_ok=True)
jobs = [('icon-192.png', 192, 0), ('icon-512.png', 512, 0), ('icon-maskable-512.png', 512, 1), ('apple-touch-icon.png', 180, 1)]
with sync_playwright() as p:
    b = p.chromium.launch()
    for name, size, mask in jobs:
        pg = b.new_page(viewport={'width': size, 'height': size})
        pg.goto(f'{html}?size={size}&maskable={mask}')
        pg.wait_for_function('document.title === "ready"')
        pg.wait_for_timeout(200)
        pg.locator('#c').screenshot(path=str(out / name), omit_background=True)
        print('wrote', name)
    b.close()
