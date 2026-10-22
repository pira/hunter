# Monster Hunter

Fast arcade survival game in plain JavaScript + canvas. Play it at **https://oleg.manida.com**.

Kite waves of monsters, chain kills into a combo multiplier, pick an upgrade card every level, beat a boss every five levels, and put your name on the global leaderboard.

## How to play

| | Desktop | Touch |
|---|---|---|
| Move | WASD / arrow keys | drag anywhere (floating stick) |
| Shoot | automatic (nearest monster, bosses first); hold click to aim | automatic |
| Switch weapon | Space / E / Q, 1–4, mouse wheel | tap a weapon slot or the big button |
| Shop | 1–3 buy, Enter continue | tap a card, tap Continue |
| Pause / mute | P or Esc / M | ⏸ / 🔊 buttons |
| Fullscreen | automatic on Play (⛶ toggles; turning it off is remembered) | same; on iPhone use Share → Add to Home Screen |

- **Weapons:** 🔫 Blaster and 🗡️ Blade from the start; 💣 Grenades and 🚀 Missiles are unlocked in the shop.
  - *Blaster* auto-aims (bosses first). Split Shot adds bullets; Multi-Shot fires the whole volley in 4 directions.
  - *Blade* stabs the nearest monster in reach. Each consecutive hit doubles the damage (10 → 20 → 40 → …); the chain resets after ~1.5 s without a hit or when you get hurt. The steel glows from black to red to white-hot with the chain.
  - *Grenades* max 4 per throw (×4 with Multi-Shot), *Missiles* max 3 per salvo (×4 with Multi-Shot).
- **Combo:** kills within ~2.8 s of each other build a combo; 5/15/30/50 kills give ×2/×3/×4/×5 score. Getting hit resets it.
- **Coins & shop:** monsters drop 🪙 coins (bigger monsters drop more). Every level-up opens a shop with 3 cards and a level bonus; buy as many as you can afford (gold price = affordable, red = not), then continue.
  - Permanent upgrades have fixed prices that rise with each rank you own (the set is finite, so it converges).
  - One-level buffs — Double XP, Double Gold, Double Damage, Slow Mobs — are always on sale (even when everything else is maxed) and cost a share of what you have been earning per level, so they stay a real choice late in a run.
- **Bosses:** levels 5, 10, 15, … bring Bonecrusher (telegraphed charges), Hexweaver (bullet rings), Broodmother (summons) and Voidmaw (all of it). Boss bullets are magenta. A beaten boss slowly cracks and falls apart, spilling gold coins, a heart and two powerups.
- **Powerups:** 🏹 Multi-Shot, ⚡ Rapid Fire, 🛡️ Invincible (giant mode — you trample monsters), ❄️ Freeze, 🪙×2 / 🪙×3 coin multipliers, ❤️ Extra Life, 💣 Bomb. Drops are throttled (one every few seconds, at most 3 on the floor) and a timer never stacks past 30 s. Hearts drop more often while you're hurt.
- **Leaderboard:** after you die, enter a name to submit. Scores go to the global board (AWS) and are also kept on your device; if the API is unreachable the device board is shown instead.

## Project layout

```
index.html          markup, HUD, menus, styles
config.js           runtime config (leaderboard API URL)
js/                 the game, as classic scripts mixed into one Game class (no build step):
  config-data.js    constants and data tables     core.js     Game class: loop, states, input, platform
  player.js         movement, damage, stats       combat.js   weapons, projectiles, damage pipeline
  monsters.js       spawning, movement, kills     bosses.js   boss patterns and death sequence
  loot.js           coins, drops, powerups        shop.js     levels, pricing, burn transition, shop
  hud.js            DOM HUD, game over, board     render.js   canvas drawing and particles
  profile.js        identity and profile overlay
game-utils.js       pure helpers shared with tests (level curve, combo tiers, …)
audio.js            Web Audio engine: buses + limiter, voice manager, health watchdog,
                    procedural creature voices and hit sounds (samples in sfx/)
manifest.webmanifest, icons/   PWA install (fullscreen on iPhone via Add to Home Screen)
tools/audio/        prepare.sh rebuilds sfx/ from the originals in tools/audio/src/
tools/icons/        make-icons.py renders icons/ with headless Chromium
leaderboard.js      leaderboard client with local fallback
leaderboard/        AWS backend: Lambda source + deploy script (see leaderboard/README.md)
test/               node:test unit tests
```

No build step and no runtime dependencies. Run locally with any static server:

```bash
python3 -m http.server 8000   # then open http://localhost:8000
npm test                      # unit tests (node --test)
```

## Deploy

The site is **GitHub Pages, deployed from the root of `main`** of `pira/hunter`; `CNAME` maps it to `oleg.manida.com`. There is no CI step — pushing to `main` publishes within a minute or two (Pages caches for ~10 min).

```bash
git push origin main
```

The leaderboard API is deployed separately with `leaderboard/deploy.sh` (only needed when the Lambda code changes).

## Versioning

Every commit bumps the version shown in the game (see [VERSION-README.md](VERSION-README.md)). Enable the hook once per clone:

```bash
git config core.hooksPath .githooks
```
