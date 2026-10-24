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
- **Monsters** come in five families — 💀 Undead, 🐺 Beasts, 👹 Fantasy (trolls & ogres), 🗡️ Bandits, 🪲 Bugs — and eight ranks (from Skeleton, Skeleton Soldier, Skeleton Officer, Skeleton General up to crowned, glowing champions like the Skeleton Emperor). Each biome favours two families. Later levels bring fewer but tougher monsters: the heavy ranks become more common level by level, and past level 12 monster (and boss) HP keeps climbing, so even a fully upgraded hero meets a wall somewhere past level 30. Every family has its own soft hit sound and a louder death (bones collapse, a heavy fall, a dropped blade, a squish).
- **The road** scrolls down. Monsters come from the top and burst out of the bushes; loot drifts with the road and is gone once it leaves the bottom (it blinks first). Hiding at the very bottom works for three seconds only.
- **Levels** fill with the damage you deal. When the bar is full: **CLEAR!** → finish the stragglers → the level's encounter → loot → through the gate into the next biome → shop.
  - Encounters: a **gatekeeper** (Shieldbearer, Splitter, Bomber, Charger, Totem, Archers) or a **coordinated wave** (V-formation, Pincer, Closing Ring, Stampede, Conga Snake, Monster Rain — soldiers and officers with a few elite or champion leaders, so they take a while to clear); a **small boss** at levels 5, 15, 25… (Bonecrusher, Hexweaver, Broodmother, Voidmaw) and a **big boss** at 10, 20, 30… (Gravelord, Stormcaller, Hydra, Lich). Bosses talk.
- **Super ring** (lower right) fills with kills (bigger monsters charge more; 🔋 Overcharge fills it at once — and on a full ring it fires a super for free and stays full).
- **Combo:** kills within ~2.8 s of each other build a combo; 5/15/30/50 kills give ×2/×3/×4/×5 score. Getting hit resets it.
- **Coins & shop:** bigger monsters drop more coins, but coin values don't grow with monster HP any more, so income grows about linearly with the level (roughly 200 a level early, 700–1000 around level 20, 1,300–1,800 past level 30 with the usual boosts). Gold boosts add up instead of multiplying (Double Gold +100%, ×2/×3 pickups, Triple Gold +200%: ×6 at most). Every level opens a shop: a row of four core whole-run upgrades that is always there (attack speed, more projectiles — or reach for the axe —, damage, move speed) and 3 dealt cards (at least one whole-run and one one-level card; a rare pet egg takes the third spot), plus a level bonus. Powerup mastery cards: ☠️ Toxic Cloud (poison ×2), 🧊 Deep Freeze (+10% slow a rank), ⛈️ Thunder God (first storm strike ×2), 🌪️ Big Kick (kickback ×2 reach). 💰 Gold Rush raises the chance monsters drop coins (+15% a rank); above 100% a drop can come twice.
  - Whole-run upgrades (purple cards): fixed prices that rise per rank owned (a finite set). Class cards only show for your hero.
  - One-level cards — Freeze, Fleet Foot, Fury, Coin Magnet, Road Brake, Double Progress/Gold/Damage, Feast — cost a share of what you have been earning per level.
- **Pickups:** 🌩️ Storm (chain lightning every 3 s), 🔋 Overcharge, 🧪 Poison (spreads by touch), 💫 Stun, ⚡ Rapid Fire, 🛡️ Invincible, ❄️ Ice Cloud (monsters inside move at half speed), 💨 Kickback (a shockwave every 2 s for 30 s), 🐢 Road Brake, 🧲 Magnet (doubles the coin pickup range; with the Coin Magnet card ×4, but never more than half the screen), 🪙×2/×3 (the screen edges glow gold), ❤️ Extra Life, 🌋 Earthquake, 🦴 Pet Treat. Picking up a running powerup refills its timer (Overtime makes them longer, except the gold boosts). Kills drop at most one powerup every ~18 s (down to ~11 s late), the road adds one every 18–26 s, never more than 3 lying around. End-of-level loot never has the instant ones (Stun, Earthquake).
- **Your hunter:** the first launch asks for a name; every run is saved to your profile (best score, hunts, kills, bosses, play time, recent runs). Tap any name on the leaderboard to see that hunter's profile. A recovery code moves your hunter to another device.
- **Gold, the wheel and the profile shop:** coins you haven't spent when a hunt ends are banked into your profile. Feeling lucky? Spin **Double or nothing** as often as you dare (the server spins, 50/50), or keep it. Spend gold in your profile on **pet eggs** and **skins** for each hero — basic +5% damage, rare +5% gold drop chance, legendary +10% attack speed and damage, mythic ×2 every drop chance (mythic ones also glow, leave a trail and light up your name on the board).
- **Saved hunts:** the run in progress is saved on this device (pause, switching away, every few seconds); after a reload the menu offers ⏯ Resume. Paused hunts can be finished and submitted up to a week later.
- **Class mastery:** beat the level 10, 20, 30 … boss with a class to earn its mastery tiers (I bronze, II silver, III gold, IV diamond …). A block of ten levels then runs ×2 (its progress bar fills twice as fast; its gatekeepers and bosses have ÷√2 HP, loot and travel are quicker), and ×3 once the next block's boss has fallen too: with Mastery II levels 1–10 run ×3 and 11–20 ×2. Fewer kills means fewer coins on those levels. The ⚡ switch on the class card turns it off; the badge shows on the class card, the profile and the leaderboard (the server counts it from the runs it has checked).
- **Pets:** eggs (1000 gold, from the rare egg card in the level shop, or a 10% boss drop) — all the same kind of egg — hatch in the profile's hatchery, one per nest (a second nest costs 15,000 gold), after 6 hours (gems hurry it; odds 80% basic, 16% rare, 3.5% legendary, 0.5% mythic). Pets come in basic → rare → legendary → mythic; three of a kind merge into the next tier. One pet slot to start (2nd: 1000 gold, 3rd: 100 gems, 4th: 1000 gems); the pets in your slots follow you on hunts:
  🐢 Turtle (green hearts 1/2/3/4 that take hits first) · 🐝 Bees (1/2/4/8 bees, each stings a nearby monster for 1 every 2 s) · 🦅 Eagle (dives on the most wounded monster, 2/4/8/16 damage every 3 s) · 🐸 Frog (swallows a monster with up to 2/4/8/16 HP every 4 s) · 🫏 Donkey (kicks away the monster about to reach you, every 2.5/1.6/1/0.5 s) · 🐿️ Squirrel (1/2/4/8% double loot) · 🐇 Bunny (5/10/15/20% chance a hit drops a heart).
  **Pet levels:** feed gold to a kind of pet to level it up (all its tiers): +5% a level up to level 10 (500 → 100,000 gold a level, ~222k to max one pet). Bees sting harder, the Donkey kicks more often, the Turtle gets an extra green heart at levels 5 and 10.
  Twice as strong pets: 🦴 Pet Treat pickup (30 s), 🐾 Pet Party card (this level), 🦮 Pack Leader card (whole run) — they stack up to ×4. Bees and Donkey act twice as often, Eagle hits twice as hard, Frog swallows twice the HP, Squirrel/Bunny chances and Turtle hearts double.
- **Leaderboard:** runs are submitted automatically. The *Classic* tab keeps the v2 board.

## Project layout

```
index.html          markup, HUD, menus, styles
config.js           runtime config (leaderboard API URL)
js/                 the game, as classic scripts mixed into one Game class (no build step):
  config-data.js    constants and data tables     core.js     Game class: loop, states, input, platform
  player.js         movement, damage, stats       combat.js   weapons, projectiles, damage pipeline
  monsters.js       spawning, tier mix, kills     bosses.js   boss patterns and death sequence
  loot.js           coins, drops, powerups        shop.js     levels, pricing, burn transition, shop
  hud.js            DOM HUD, game over, board     render.js   canvas drawing and particles
  profile.js        identity and profile overlay  road.js     scrolling, biomes, background tiles
  encounters.js     level flow, gatekeepers, waves, hazards
  sprites.js        heroes: illustrated sprites from img/heroes/ (every class and skin) brought to life in code
                    (hop, sway, breath, facing); the vector characters remain as stand-ins and for tools/icons
  mobs.js           monster families drawn as cached vector sprites (tools/mobs/lineup.html shows them all)
  bossart.js        bosses and gatekeepers: illustrated sprites from img/bosses/ animated in code, with vector
                    stand-ins until they load (tools/mobs/bosses.html shows them all; ?vector for the stand-ins)
  meta.js           banked gold, the wheel, the profile shop (pets, eggs, skins)
  pets.js           pets on the hunt
game-utils.js       pure helpers shared with tests (level curve, combo tiers, …)
audio.js            Web Audio engine: buses + limiter, voice manager, health watchdog,
                    synth monster hits/deaths and hero hurt sound (samples in sfx/)
img/heroes/         hero sprites per class and skin (WebP, 256 px tall, ~20–30 KB each)
img/bosses/         boss and gatekeeper sprites (WebP, 360 px, ~40 KB each; generated with GPT Image 2.5)
manifest.webmanifest, icons/   PWA install (fullscreen on iPhone via Add to Home Screen)
tools/audio/        prepare.sh rebuilds sfx/ from the originals in tools/audio/src/
tools/icons/        make-icons.py renders icons/ with headless Chromium
tools/voices/       make-voices.sh: boss lines (lines.json) → Piper TTS → ffmpeg → sfx/voice/
tools/sim/          balance.py: headless bot run per class, prints per-level pacing/economy;
                    econ.py: late-game economy run (to level 45+, optional mythic skin)
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
