# Monster Hunter

Fast arcade survival game in plain JavaScript + canvas. Play it at **https://oleg.manida.com**.

Pick a hero, run down the monster road through eleven biomes, chain kills into a combo, unleash your super, beat a gatekeeper, a wave or a boss at the end of every level, and put your name on the global leaderboard.

## How to play

| | Desktop | Touch |
|---|---|---|
| Move | WASD / arrow keys | drag anywhere (floating stick) |
| Attack | automatic (nearest monster, bosses first); hold click to aim | automatic |
| Super | Space (when the ring is full) | tap the round SUPER button in the lower right |
| Shop | 1–3 buy, Enter continue | tap a card, tap Continue |
| Pause / mute | P or Esc / M | ⏸ / 🔊 buttons |
| Fullscreen | automatic on Play (⛶ toggles; turning it off is remembered) | same; on iPhone use Share → Add to Home Screen |

- **Heroes** (picked on the menu, remembered):
  - 🧙 *Wizard* — auto-aiming magic bolts; super **Arcane Barrage**: a stream of fireballs (10× your bolts, two a second, double damage), each at the nearest monster.
  - 🪓 *Barbarian* — 4 hearts, a cleave that hits everything in front; super **Whirlwind**: 5 s of invincible spinning.
  - 💣 *Goblin* — fastest runner, throws grenades in pairs; super **Bombardment**: 10× a normal throw rains down at random spots over 5 s.
- **The road** scrolls down. Monsters come from the top and burst out of the bushes; loot drifts with the road and is gone once it leaves the bottom (it blinks first). Hiding at the very bottom works for three seconds only.
- **Levels** fill with the damage you deal. When the bar is full: **CLEAR!** → finish the stragglers → the level's encounter → loot → through the gate into the next biome → shop.
  - Encounters: a **gatekeeper** (Shieldbearer, Splitter, Bomber, Charger, Totem, Archers) or a **coordinated wave** (V-formation, Pincer, Closing Ring, Stampede, Conga Snake, Monster Rain); a **small boss** at levels 5, 15, 25… (Bonecrusher, Hexweaver, Broodmother, Voidmaw) and a **big boss** at 10, 20, 30… (Gravelord, Stormcaller, Hydra, Lich). Bosses talk.
- **Super ring** (lower right) fills with kills (bigger monsters charge more; 🔋 Overcharge fills it at once — and on a full ring it fires a super for free and stays full).
- **Combo:** kills within ~2.8 s of each other build a combo; 5/15/30/50 kills give ×2/×3/×4/×5 score. Getting hit resets it.
- **Coins & shop:** coins scale with monster HP. Every level opens a shop with 3 cards (always at least one permanent upgrade and one one-level card) plus a level bonus.
  - Whole-run upgrades (purple cards): fixed prices that rise per rank owned (a finite set). Class cards only show for your hero.
  - One-level cards — Freeze, Fleet Foot, Fury, Coin Magnet, Road Brake, Double Progress/Gold/Damage, Feast — cost a share of what you have been earning per level.
- **Pickups:** 🌩️ Storm (chain lightning every 3 s), 🔋 Overcharge, 🧪 Poison (spreads by touch), 💫 Stun, ⚡ Rapid Fire, 🛡️ Invincible, ❄️ Freeze, 🐢 Road Brake, 🧲 Magnet, 🪙×2/×3, ❤️ Extra Life, 🌋 Earthquake. Timers never stack past 30 s.
- **Your hunter:** the first launch asks for a name; every run is saved to your profile (best score, hunts, kills, bosses, play time, recent runs). Tap any name on the leaderboard to see that hunter's profile. A recovery code moves your hunter to another device.
- **Gold, the wheel and the profile shop:** coins you haven't spent when a hunt ends are banked into your profile. Feeling lucky? Spin **Double or nothing** as often as you dare (the server spins, 50/50), or keep it. Spend gold in your profile on **pet eggs** and **skins** for each hero (mythic ones glow, leave a trail and light up your name on the board).
- **Pets:** eggs (1000 gold, from the rare egg card in the level shop, or dropped by bosses) hatch in a nest in your profile after 6 hours — two nests, gems hurry them. Pets come in basic → rare → legendary → mythic; three of a kind merge into the next tier. One pet slot to start (2nd: 1000 gold, 3rd: 100 gems, 4th: 1000 gems); the pets in your slots follow you on hunts:
  🐢 Turtle (green hearts 1/2/3/4 that take hits first) · 🐝 Bees (1/2/4/8 bees, each stings a nearby monster for 1 every 2 s) · 🦅 Eagle (dives on the most wounded monster, 2/4/8/16 damage every 3 s) · 🐸 Frog (swallows a monster with up to 2/4/8/16 HP every 4 s) · 🫏 Donkey (kicks away the monster about to reach you, every 2.5/1.6/1/0.5 s) · 🐿️ Squirrel (1/2/4/8% double loot) · 🐇 Bunny (5/10/15/20% chance a hit drops a heart).
- **Leaderboard:** runs are submitted automatically. The *Classic* tab keeps the v2 board.

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
  profile.js        identity and profile overlay  road.js     scrolling, biomes, background tiles
  encounters.js     level flow, gatekeepers, waves, hazards
  sprites.js        vector player characters (cached per class × skin × frame)
  meta.js           banked gold, the wheel, the profile shop (pets, eggs, skins)
  pets.js           pets on the hunt
game-utils.js       pure helpers shared with tests (level curve, combo tiers, …)
audio.js            Web Audio engine: buses + limiter, voice manager, health watchdog,
                    procedural creature voices and hit sounds (samples in sfx/)
manifest.webmanifest, icons/   PWA install (fullscreen on iPhone via Add to Home Screen)
tools/audio/        prepare.sh rebuilds sfx/ from the originals in tools/audio/src/
tools/icons/        make-icons.py renders icons/ with headless Chromium
tools/voices/       make-voices.sh: boss lines (lines.json) → Piper TTS → ffmpeg → sfx/voice/
tools/sim/          balance.py: headless bot run per class, prints per-level pacing/economy
tools/dev-api.mjs   the Lambda app on an in-memory table, for local QA
leaderboard.js      leaderboard client with local fallback
leaderboard/        AWS backend: Lambda source + deploy script (see leaderboard/README.md)
test/               node:test unit tests
```

No build step and no runtime dependencies. Run locally with any static server:

```bash
python3 -m http.server 8000   # then open http://localhost:8000
npm test                      # unit tests (node --test): game-utils + the Lambda against a fake DynamoDB
open http://localhost:8000/?stats        # per-level calibration log overlay
open http://localhost:8000/?audiodebug   # audio engine state, voices, steals
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
