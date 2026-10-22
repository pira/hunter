#!/usr/bin/env python3
"""Headless balance run: a simple kiting bot plays each class at full simulation speed and prints
per-level rows (level, seconds, coins earned, expected income, spent, hits) from the ?stats log.
Serve the repo first (python3 -m http.server 8000), then:
    python3 tools/sim/balance.py wizard,barbarian,goblin 12 80000      # classes, max level, max steps
The bot is immortal (99 hearts) so the numbers measure pacing and economy, not difficulty."""
PORT = 8000
import sys, json
from playwright.sync_api import sync_playwright
import pathlib
bot = (pathlib.Path(__file__).parent / 'bot.js').read_text()
with sync_playwright() as p:
    b = p.chromium.launch()
    for cls in sys.argv[1].split(','):
        ctx = b.new_context(viewport={'width': 1000, 'height': 700})
        ctx.route('**/config.js', lambda r: r.fulfill(body="window.HUNTER_CONFIG={leaderboardUrl:''};", content_type='application/javascript'))
        pg = ctx.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(f'http://127.0.0.1:{PORT}/?stats')
        pg.wait_for_timeout(500)
        pg.evaluate("() => { Leaderboard.setName('Bot'); Sfx.muted = true; }")
        res = pg.evaluate(f"({bot})('{cls}', {sys.argv[2]}, {sys.argv[3]})")
        print(json.dumps(res), errs[:3])
        ctx.close()
    b.close()
