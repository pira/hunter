# Monster Hunter

Fast arcade survival game in plain JavaScript + canvas. Play it at **https://oleg.manida.com**.

Kite waves of monsters, chain kills into a combo multiplier, pick an upgrade card every level, beat a boss every five levels, and put your name on the global leaderboard.

## How to play

| | Desktop | Touch |
|---|---|---|
| Move | WASD / arrow keys | drag anywhere (floating stick) |
| Shoot | automatic (nearest monster, bosses first); hold click to aim | automatic |
| Switch weapon | Space / E / Q, 1–4, mouse wheel | tap a weapon slot or the big button |
| Pause / mute | P or Esc / M | ⏸ / 🔊 buttons |

- **Weapons:** 🔫 Blaster and ⚔️ spinning Blades from the start, 💣 Grenades at level 4, 🚀 homing Missiles at level 8.
- **Combo:** kills within ~2.5 s of each other build a combo; 5/15/30/50 kills give ×2/×3/×4/×5 score. Getting hit resets it.
- **Upgrade cards:** every level-up pauses the game and offers 3 of 17 upgrades (damage, attack speed, split shot, piercing, extra blades, blast radius, crits, regen, …). Weapon-specific cards appear once that weapon is unlocked.
- **Bosses:** levels 5, 10, 15, … bring Bonecrusher (telegraphed charges), Hexweaver (bullet rings), Broodmother (summons) and Voidmaw (all of it), scaling up each cycle. Beating one drops loot and a bonus card.
- **Powerups:** 🏹 Multi-Shot, ⚡ Rapid Fire, 🛡️ Invincible (giant mode — you trample monsters), ❄️ Freeze, ❤️ Extra Life, 💣 Bomb. They despawn after 12 s.
- **Leaderboard:** after you die, enter a name to submit. Scores go to the global board (AWS) and are also kept on your device; if the API is unreachable the device board is shown instead.

## Project layout

```
index.html          markup, HUD, menus, styles
config.js           runtime config (leaderboard API URL)
game.js             the game (fixed 60 Hz simulation, canvas rendering)
game-utils.js       pure helpers shared with tests (level curve, combo tiers, …)
audio.js            Web Audio sound engine (samples in sfx/ + synthesized UI blips)
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
