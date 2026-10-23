#!/usr/bin/env python3
"""Late-game economy run: the balance bot plays each class up to a level and prints one row per level
(seconds, fight seconds, kills, coins earned, share of the fight with a ×2+ gold boost, mean coin
multiplier, monsters alive, powerups picked up, coins in hand). Serve the repo first, then:
    python3 tools/sim/econ.py wizard,barbarian,goblin 40 400000 [mythic|rare][,mortal][,best25]  (best25 = class mastery as if level 25 was reached)"""
import os
PORT = int(os.environ.get('PORT', 8000))
import sys, json, pathlib
from playwright.sync_api import sync_playwright
bot = (pathlib.Path(__file__).parent / 'bot.js').read_text()
flags = (sys.argv[4] if len(sys.argv) > 4 else '').split(',')
perks = next(({'mythic': {'drops': 1}, 'rare': {'coinDrop': 0.05}}[f] for f in flags if f in ('mythic', 'rare')), None)
best = next((int(f[4:]) for f in flags if f.startswith('best')), 0)
opts = {**({'perks': perks} if perks else {}), **({'mortal': True} if 'mortal' in flags else {}), **({'best': best} if best else {})}
with sync_playwright() as p:
    b = p.chromium.launch()
    for cls in sys.argv[1].split(','):
        ctx = b.new_context(viewport={'width': 1000, 'height': 700})
        ctx.route('**/config.js', lambda r: r.fulfill(body="window.HUNTER_CONFIG={leaderboardUrl:''};", content_type='application/javascript'))
        pg = ctx.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(f'http://127.0.0.1:{PORT}/')
        pg.wait_for_timeout(500)
        pg.evaluate("() => { Leaderboard.setName('Bot'); Sfx.muted = true; }")
        res = pg.evaluate(f"({bot})('{cls}', {sys.argv[2]}, {sys.argv[3]}, {json.dumps(opts)})")
        print(f"\n== {cls}: reached L{res['level']} in {res['secs']}s, {res['kills']} kills, {res['ms']} ms, errors {errs[:3]}")
        print(' L  secs fight kills earned boost mult alive pu hits gems  coins')
        tot = 0
        for r in res['econ']:
            tot += r['earned']
            print(f"{r['L']:>2} {r['secs']:>5} {r['fight']:>5} {r['kills']:>5} {r['earned']:>6} {r['boost']:>5} {r['mult']:>4} {r['alive']:>5} {r['pu']:>3} {r['hits']:>4} {r['gems']:>4} {r['coins']:>6}  Σ{tot}")
        tr = res['trace']
        enc = [f"L{t[1].split(':')[0]} {t[1].split('/')[-1]} {tr[i + 1][0] - t[0]}s" for i, t in enumerate(tr[:-1]) if 'Boss/' in t[1] and not t[1].endswith('/null')]
        print('bosses', ', '.join(enc))
        print('stacks', json.dumps(res['stacks']))
        print('last', json.dumps(res['trace'][-3:]))
        if res.get('stuck'): print('STUCK', json.dumps(res['stuck']))
        ctx.close()
    b.close()
