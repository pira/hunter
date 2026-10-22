# Monster Hunter — Architecture & v3 Development Plan

Status: implemented 2026-10-22 (P1–P7: v2.3.0 → v3.1.0). Baseline: v2.2.0 (`66ba06a`). Live: https://oleg.manida.com

> Part 1 describes the v2.2.0 baseline the plan started from. For the current layout see the README; notes on what was built and where it deviates from this plan are in Part 3 at the end.

This document has two parts: how the game works today (so changes land in the right place), and the phased plan to v3 with every decision taken so far. Numbers marked *tunable* are starting values for playtesting, not commitments.

---

## Part 1 — Current architecture (v2.2.0)

### 1.1 Files

| File | Lines | Role |
|---|---|---|
| `index.html` | 332 | All markup (HUD, overlays) and CSS. Loads the scripts below as classic `<script>` tags, in order. |
| `config.js` | 5 | `window.HUNTER_CONFIG.leaderboardUrl` (Lambda function URL). Empty = local-only board. |
| `game-utils.js` | 176 | Pure helpers (UMD: browser global `GameUtils` + CommonJS for tests): XP curve, combo tiers, spawn interval, boss levels, name sanitizing, weighted picks, formatting. |
| `audio.js` | 161 | `Sfx`: Web Audio engine — 11 mp3 samples, per-sample throttle, synthesized tones/arpeggios/crackle, one music slot, mute. |
| `leaderboard.js` | 115 | `Leaderboard`: fetch client for the Lambda (6 s timeout) with a localStorage fallback board. |
| `game.js` | 3031 | Everything else: one `Game` class (constants at top, ~150 methods). Instantiated on `window.load`. |
| `leaderboard/lambda/index.mjs` | ~190 | Node 22 Lambda behind a function URL; DynamoDB single table. |
| `leaderboard/deploy.sh` | — | Idempotent create/update of table, IAM role, function, URL, CORS. |
| `test/game-utils.test.js` | 151 | `node --test` unit tests for `game-utils.js`. |
| `.githooks/pre-commit`, `update-version.{py,js}` | — | Bumps `this.version` / `this.buildDate` in `game.js` and `package.json` on every commit (`BUMP=patch|minor|major|none`). |
| `sfx/*.mp3` | 1.2 MB | Samples (see 1.8). |

No build step, no runtime dependencies. GitHub Pages serves the repo root of `main`; push = deploy.

### 1.2 Runtime model

- **Loop:** `requestAnimationFrame` → fixed-step accumulator. `STEP = 1/60`, but `GAME_SPEED = 0.9` scales real dt, so the simulation runs **54 steps per real second**. Max 6 catch-up steps per frame, then the accumulator is dropped. All gameplay timers are in steps; convert real seconds with `s * 60 * GAME_SPEED`.
- **Extras on the loop:** `hitStop` (skip steps for impact), `timeScale` (slow-mo), screen shake.
- **States:** `menu` (attract mode: wandering monsters) → `playing` ⇄ `paused` → `transition` (burning-film effect, 1.5 s) → `levelup` (shop overlay) → `playing` … → `dying` (monsters keep moving) → `gameover`.
- **World space:** every aspect ratio (clamped 0.5–2.0) gets the same play area `WORLD_AREA = 800×600`, so `W×H` changes shape but not size and scores stay comparable. Canvas is scaled by `scale × devicePixelRatio (≤2)`.
- **Rendering split:** the world is drawn on the canvas; HUD, shop, menus, boss bar and banners are DOM overlays. `updateHud()` diffs text/HTML through `setText/setHtml` caches to avoid layout churn.
- **Step order:** player → weapons → bullets → grenades → missiles → monsters (incl. bosses) → enemy shots → powerups → coins → combo → particles → spawning → sweep dead → open shop if a level is pending.
- **Render order:** background (cached offscreen per size+level) → edge warnings → coins → powerups → explosions → grenades → shadows → monsters/bosses → blades → player (🧙‍♂️ emoji) → projectiles → particles → floaters → screen fx → touch stick.

### 1.3 Input

Keyboard (WASD/arrows move, Space/E/Q/1–4/wheel switch weapon, P/Esc pause, M mute, 1–3/Enter in shop), mouse (hold to aim), touch (floating stick: anchor at touch, 55 px radius, anchor drags along). Blur/visibility-hidden pauses the run.

### 1.4 Combat & progression

- **Weapons:** Blaster (auto-aim, dmg 1, cd 32), Blade (stab nearest within 80 px, 10 × 2^chain, chain resets after ~1.85 s), Grenades (dmg 8, r 32, cd 96, unlocked in shop ≥ L3), Missiles (homing, cd 100, unlocked ≥ L6). Multi-Shot powerup = volley in 4 directions.
- **Monsters:** 8 tiers (`small … ultimate`), 15 types. Tier unlock levels 6/11/16/22/28. HP × `1 + 0.3·floor((L−1)/6)`, speed × up to 1.45. 30–60% chase, rest wander; off-screen mobs turn back (75%) or escape. Damaged mobs regen 1 HP / 240 steps.
- **Spawning:** single spawns every `spawnInterval(L) = max(0.22, 1.4·0.935^(L−1))` s up to cap `min(110, 40+2L)`; packs of `5+L/2` from one edge from L2.
- **XP/levels:** XP = monster points; `xpToNextLevel(L) = round((60·L^1.35+30)/10)·10`. Level-up → shop.
- **Bosses:** every 5 levels (`isBossLevel`), rotating Bonecrusher (charge), Hexweaver (rings), Broodmother (summon), Voidmaw (chaos = all three). HP `base·(1+0.4(n−1))·(1+0.4·cycle)`, enrage < 50%. Death: ~4 s crumble spilling `25+15n` coins, a heart and 2 powerups.
- **Combo:** kills within 150 steps (+36 per Hot Streak rank) chain; 5/15/30/50 → ×2…×5 score. Hit resets.
- **Loot:** coins per tier (`COIN_DROPS`), powerups per tier (`DROP_CHANCE`) with an 8 s cooldown and ≤ 3 on the field, plus a field spawn every 12–20 s and a pity heart roll while hurt. Timers capped at 30 real seconds.
- **Shop:** 3 cards per level-up (`pickWeightedUnique`), buy any you can afford, level bonus `5+L`. Permanent cards (21) cost `base·(1+0.75·rank)`; one-level buffs (Double XP/Gold/Damage, Slow Mobs, Feast) cost a 0.25–0.5 share of `max(expectedIncome(L), incomeEMA)`.

### 1.5 Persistence (localStorage)

`hunter.playerName`, `hunter.best`, `hunter.localScores` (top 20 fallback board), `hunter.muted`.

### 1.6 Backend

- AWS 318456756271 / ap-southeast-1. Lambda `monster-hunter-leaderboard` (Node 22 arm64, 256 MB, reserved concurrency 10, logs 30 d), DynamoDB `monster-hunter-scores` (on-demand, TTL `ttl`), role `monster-hunter-leaderboard` (Query/PutItem/UpdateItem), S3 `monster-hunter-deploy-318456756271` for zips. CORS: oleg.manida.com, pira.github.io, localhost:8000.
- Routes: `GET /scores?limit`, `POST /run` (HMAC-signed single-use token), `POST /scores`.
- Items: `pk=board#v2, sk=<MAX−score>#<ts>#<id>`; `pk=nonce` (consumed tokens, TTL 8 h); `pk=rate, sk=<ip>#<minute>` (6 submits/IP/min).
- Plausibility: duration fits token age, `level ≤ levelFor(2·score)+1`, `score ≤ 500+4000·s`, `kills ≤ 60+25·s`, `combo ≤ kills`.
- Deploying from the Cowork VM: zip locally → presigned S3 PUT → `UpdateFunctionCode` from S3 (the connector can't upload zips inline).

### 1.7 Known debt

- `game.js` is a single 3k-line class; v3 roughly doubles it. Split before P3 (see 2.3).
- Player is an emoji: renders differently per OS and can't be recoloured — blocks skins.
- No pure-logic tests for anything inside `Game`.

### 1.8 Audio — diagnosis of "lousy / disappears mid-game"

Confirmed from code:

1. **No voice limit.** Every `play()` creates a new source. `boom.mp3` is **4.1 s** long; a Multi-Shot grenade volley (16 explosions) stacks ~16 four-second booms at gain 0.55 each. `bossDeath` (1.6 s) is unthrottled and plays for every large+ kill; coin pickup tones are unthrottled, so a boss coin spill fires dozens of oscillators in a few frames.
2. **No limiter.** All voices sum straight into `master (0.8) → destination`, so loud moments clip hard — the crunchy "lousy" sound.
3. **Nodes are never disconnected** (`onended` unused) — extra audio-thread load, worst on Safari.
4. **Recovery only on new gestures.** On touch you hold the stick for minutes, so no new `pointerdown` arrives. If iOS interrupts the context (notification, call, Siri, another tab's audio, AirPods switching) it stays silent until the next tap. There is no `statechange` handler and no user-visible hint.
5. **Dead output device.** When the output switches (AirPods auto-switch/disconnect), a context can stay `running` on a sink that no longer plays. Plausible cause of "disappears completely" on Apple hardware; not provable from code, so the fix below detects it.
6. **Assets:** 256 kbps stereo mp3s with long tails and unrelated loudness levels, compensated by ad-hoc per-call volumes.

---

## Part 2 — Development plan

### 2.1 Decisions (approved)

| # | Decision |
|---|---|
| D1 | Missiles removed (screen clutter, hundreds of projectiles). Replaced by the **Storm** powerup: chain lightning every 3 s for 15 s. |
| D2 | Blade/chain-doubling retired; the barbarian's super **Whirlwind** = 5 s of invincible havoc. Weapon switching removed — one primary per class. |
| D3 | In-run permanent cards keep static `base·(1+0.75·rank)` pricing; exponential pricing only for meta artefacts. |
| D4 | Every level ends with an encounter: **gatekeeper or coordinated wave**; **small boss** at L5, 15, 25…; **big boss** at L10, 20, 30…; **super boss** at L100 (hook only, not implemented). |
| D5 | Unspent gold is banked 100% at death. A **double-or-nothing wheel** can be spun any number of times before banking. |
| D6 | Artefacts have rarity tiers (basic/rare/legendary/mythic) with **small** permanent effects (e.g. Greed +1/3/5/7% gold). |
| D7 | Road slow-down exists as artefact, one-level card and timed drop. |
| D8 | Cosmetic **player skins** with the same four rarities. |
| D9 | Sound engine rebuilt for robustness; distinct hit/death sounds per mob type; spoken boss lines. |
| D10 | Execution order 1 → 2 → 3 → 5 → 4 → 6 → 7 (original item numbers). |

### 2.2 Phases and releases

| Phase | Original item | Content | Server | Release |
|---|---|---|---|---|
| P1 | 1 + sound | Fullscreen/game lock, audio engine rebuild, creature sounds | — | v2.3.0 (main) |
| P2 | 2 | Identity (name + uuid), public profile, run history | player routes | v2.4.0 (main) |
| P3 | 3 | Code split, classes, supers, Storm, vector player sprites | — | `v3` branch |
| P4 | 5 | Road, biomes, spawn rework, level flow, encounters, bosses, boss voices | — | `v3` branch |
| P5 | 4 | Cards/drops/economy rebalance, calibration | plausibility v3, `board#v3` | `v3` branch |
| P6 | 6 | Final HUD: super bar/button, owned-upgrade icons | — | **v3.0.0** (merge) |
| P7 | 7 | Banking, wheel, artefacts, skins, profile shop | bank/spin/buy/equip | v3.1.0 |

Branching: `main` keeps shipping v2.x. P3–P6 live on branch `v3`; commit there with `BUMP=none` (the hook would otherwise bump patch versions and conflict on merge), then merge with `BUMP=major` → 3.0.0. The v2 board stays readable (`GET /scores?board=v2`) as "Classic".

### 2.3 Code layout for v3 (start of P3)

Split `game.js` into classic scripts that extend `Game.prototype` with `Object.assign` — no build step, no module migration, load order in `index.html`:

```
js/config-data.js   constants: classes, monsters, powerups, cards, bosses, biomes, artefacts, skins
js/core.js          Game class: constructor, loop, states, resize, input   (holds this.version → update hook target)
js/player.js        movement, damage, classes, supers, sprite cache
js/combat.js        projectiles, cleave, explosions, Storm, poison, damage pipeline
js/monsters.js      spawning, movement, road interaction, encounters
js/bosses.js        boss + gatekeeper pattern library
js/road.js          scroll, biome tiles, scenery
js/loot.js          coins, drops, timed effects
js/shop.js          cards, pricing, burn transition
js/hud.js           DOM HUD, overlays
js/render.js        canvas drawing
js/profile.js       identity, profile overlay, meta (P2/P7)
```

Update `update-version.py`/`.js` and the hook's `git add` to the new path of `this.version`. Pure functions (pricing, charge, level targets, artefact math, wheel odds) go to `game-utils.js` with tests.

---

### P1 — Fullscreen, game-mode lock, sound (v2.3.0)

**Fullscreen**
- On Play / Play again / Resume: `stage.requestFullscreen({ navigationUI: 'hide' })` (webkit-prefixed fallback), feature-detected, errors ignored. ⛶ toggle in menu and HUD.
- While a run is active: `screen.orientation.lock(screen.orientation.type)` (locks the current orientation; Android only, try/catch), unlock on menu. Leaving fullscreen during a run pauses it.
- `navigator.wakeLock.request('screen')` during runs (re-acquire on `visibilitychange`).
- iPhone Safari has no element fullscreen → PWA path: `manifest.webmanifest` (`display: fullscreen`, `orientation: any`, theme colour, 192/512 + maskable icons), `apple-touch-icon`, and a one-time menu hint "Share → Add to Home Screen for fullscreen" when iOS and `!navigator.standalone`. No service worker (avoids stale-version caching with no hashed assets).

**Lock-in**
- Remove `user-select: text` from `.panel` (keep it on `#nameInput`).
- `html, body { position: fixed; inset: 0; overscroll-behavior: none; }` against rubber-banding and URL-bar shifts.
- Prevent `gesturestart` (iOS pinch), `dblclick`, `selectstart` (outside inputs), document-wide `contextmenu`.

**Audio engine** (`audio.js` rewrite, same public API so call sites keep working)
- Graph: `voice → bus (sfx | ui | voice | music) → master → DynamicsCompressor as limiter (threshold −6 dB, knee 0, ratio 20, attack 2 ms, release 150 ms) → destination`. Boss voice ducks the sfx bus by 6 dB.
- Voice manager: global cap 24; per-sound polyphony (*tunable*: shoot 3, hit 6, death 4, boom 3, coin 2, others 2) with oldest-voice stealing (10 ms fade); priority so player-hit, boss and UI never get dropped; existing throttles kept. `onended` disconnects nodes.
- Synthesized sounds (coin ticks, combo arpeggios, crackle) pre-rendered once into buffers with `OfflineAudioContext`, played through the same voice manager.
- Health watchdog every 1 s while playing: `state !== 'running'` → `resume()`; `statechange` listener; resume attempted on every `touchstart/touchend/pointerdown/keydown`. Still silent after 2 s → small "🔇 tap to restore sound" chip (the tap is the gesture). Zombie check: `running` but `currentTime` advanced < 0.5 s over 1 s wall time → rebuild the context and re-decode from cached bytes (keep `arrayBuffer.slice(0)` before `decodeAudioData`, which detaches it). Also rebuild on `navigator.mediaDevices` `devicechange`.
- iOS 17+: `navigator.audioSession.type = 'ambient'` when available (mixes with the player's music; respects the silent switch).
- `?audiodebug` overlay: context state, active voices, dropped/stolen counts.

**Assets** (ffmpeg is available on the Mac VM)
- Trim tails (boom → ~1.2 s with fade), mono, 44.1 kHz, loudness-normalised (`loudnorm` to −16 LUFS), 96 kbps mp3. Game-over music stays stereo. Script in `tools/audio/prepare.sh` so it's repeatable.

**Creature sounds**
- Procedural, rendered at load with `OfflineAudioContext` (~100 ms, zero downloads): one deterministic "voice" per monster type (15 types) from tier parameters — small: 600–900 Hz squeak/chirp 0.15 s; medium: 250–400 Hz snarl with 30 Hz AM 0.25 s; large: 90–150 Hz roar, noise + low-pass 0.5 s; elite: ring-modulated metallic 0.35 s; legendary+: layered roar with generated-impulse reverb 0.6–0.9 s. 3 variants each (seeded), random pitch ±6% at play.
- Hit sounds: short (40–80 ms) filtered-noise thwack + falling sine, pitch from mob size; hard-throttled (30 ms gap, 6 voices). Weapon-flavoured impacts arrive in P3.
- The engine also accepts recorded samples per name, so any type that sounds too synthetic can be swapped for a generated/licensed sample later without code changes.

**Done when:** game enters fullscreen on Play on Android/desktop and installs fullscreen on iPhone; no text selection or page shift anywhere outside the name field; a 16-grenade volley doesn't clip; sound survives a notification, an app switch and an AirPods switch without reload; each monster type is audibly distinct.

---

### P2 — Identity & public profile (v2.4.0)

**Client**
- First launch: menu asks "What should we call you, hunter?" (prefilled from `hunter.playerName`), then shows "Welcome back, *name*" with tap-to-rename.
- `hunter.identity = { id, secret, name, createdAt }`: `id` = UUID v4 and `secret` = 32 random bytes, both from `crypto.getRandomValues` (works on plain-http LAN testing where `randomUUID` doesn't).
- Score submit becomes automatic at game over with the stored name (the name form goes away). Offline: queue the submission in `hunter.pendingSubmit` and retry on next launch while the run token is still valid (< 6 h).
- Profile overlay: name, best score/level, runs, kills, bosses, play time, last 20 runs; later gold, artefacts, skins (P7). Opened by tapping your name in the menu or any linked leaderboard row; deep link `?p=<id>`.
- Stretch: "recovery code" (base64 of id+secret) shown in your own profile, pasteable on another browser.

**Server**
- `POST /scores` accepts `playerId, secret`. First write claims the id by storing `sha256(secret)`; later writes must match (so a uuid read off the public board can't be used to write to someone's profile).
- Writes in one `TransactWriteItems`: nonce, board row (+`playerId`), run row, player meta (optimistic lock on `version`).
- `GET /player/{id}` → public meta + last 20 runs (never the secret hash).
- IAM: add `GetItem`, `ConditionCheckItem` (transactions are authorised per contained action).

| Item | pk | sk | Fields |
|---|---|---|---|
| board row | `board#v2` (v3 later) | `<MAX−score>#<ts>#<id>` | + `playerId`, `class`, `skin` |
| player meta | `player#<pid>` | `meta` | `name, secretHash, bestScore, bestLevel, runs, kills, bosses, playSeconds, gold, artefacts{}, skins[], equipped{}, version, createdAt, updatedAt` |
| player run | `player#<pid>` | `run#<ts>#<id>` | `score, level, class, kills, combo, bosses, duration, banked` |

**Done when:** a fresh browser asks for a name once, greets by name afterwards, every finished run appears on the profile, leaderboard names open profiles, and a forged submit with a known uuid but wrong secret is rejected.

---

### P3 — Classes, supers, Storm (branch `v3`)

Remove: missiles (code, card, sample), blade + chain, weapon slots/switching, `unlock_*`, `heavy`, `swarm`, Multi-Shot powerup. Space becomes the super key. Class picker on the menu after the name (remembered; changeable each run).

| | 🧙 Wizard | 🪓 Barbarian | 💣 Goblin |
|---|---|---|---|
| Hearts / speed (*tunable*) | 3 / 4.4 | 4 / 4.2 | 3 / 4.8 |
| Primary | **Bolt**: auto-aim, dmg 1, cd 32, speed 9, r 4.5 (current blaster) | **Cleave**: quick arc at nearest mob, dmg 10, cd 64, reach 80, ±70°, hits everything in the arc, knockback | **Grenade**: dmg 8, cd 96, r 32, range ≤ 220 (current grenades) |
| Super | **Arcane Nova**: 3 rings × 12 bolts, 0.2 s apart, double size (r 9), dmg 2, pierce +2 | **Whirlwind**: 5 s invincible, 360° sweep every 8 steps (dmg 10), +30% speed, tramples on contact | **Bombardment**: full cluster thrown in all 4 directions (up to 16), blast radius ×1.5 |
| Class cards | Split Shot, Piercing Rounds | Long Reach, Quick Swing | Cluster Bombs, Short Fuse |

- Shared card **Impact** (+15% bolt size / cleave reach / blast radius per rank) covers "weapon impact area" for all classes.
- **Super meter** 0–100, charge per kill (*tunable*): small 2, medium 3, large 5, elite 6, legendary 10, mythic 12, ancient 15, ultimate 25, gatekeeper 35, boss 100. 🔋 **Overcharge** drop fills it instantly. P3 ships a functional bar + button; P6 finalises the HUD.
- ⚡ **Storm** (timed drop, replaces missiles): 15 s, strikes on pickup and every 3 s (5 strikes). Target: nearest mob within 260 px (bosses allowed). Chains up to 5 jumps to the nearest un-hit mob within 120 px; damage `6 · hpScale(L) · damageMult`, ×0.65 per jump. Visual: midpoint-displacement bolt (4–5 subdivisions, 30% chance of a fork), re-jittered every 2 steps for 12 steps, three strokes (wide 10 px cyan @0.15, 4 px @0.5, 1.5 px white core), impact sparks + scorch decal, 3-step tint flash. Sound: noise crack + falling sine + short thunder tail.
- **Player sprites:** replace the emoji with vector characters drawn once per (class, skin, frame) into an offscreen sprite cache — consistent on every OS and recolourable, which P7 skins need. Emojis stay for pickups and icons.
- **Sounds:** bolt zap, cleave whoosh + meaty hit, grenade thud, whirlwind loop (fades), super activation sting per class.

**Done when:** all three classes clear L10 in playtests with comparable times (±25%), supers feel like a payoff, Storm reads clearly without hiding mobs, nothing references missiles/blade.

---

### P4 — The road (branch `v3`)

**Scrolling**
- Screen-space simulation stays; the road adds `ROAD_SPEED` (*tunable* 0.8 px/step ≈ 43 px/s; a screen in ~14 s) to the y of every grounded entity each step: monsters, coins, powerups, grenades, explosions, ground particles, decals. Flying projectiles are unaffected. The player is not pushed.
- Loot drifting off the bottom despawns; it blinks in the last 80 px.
- Speed multipliers: `roadMult = artefact × card × drop` (D7).

**Biomes & scenery**
- One biome per level, cycling: meadow, pine forest, lakes, rocky hills, autumn, swamp, snow, canyon, volcanic, crystal caves, night forest…
- Road ≈ 65% of width, scenery strips on both sides (≥ 70 px on narrow portrait). Each biome = palette + road texture + seeded scenery generator (trees, bushes, grass tufts, rocks, ponds, reeds), pre-rendered into a vertically seamless tile (1.5 H) per biome; 2 `drawImage` calls per frame. Stretch: slower far layer (mountains/lakes) for parallax.
- Level change: the next biome's tile scrolls in behind a gate/bridge seam during the encounter's loot phase.

**Spawning & movement**
- Spawns from the top edge and from inside the scenery strips (emerge with a rustle burst). Never from the bottom.
- Soft floor at `H − 90`: below it mobs move at 50% and wanderers turn back, which gives roughly a second to grab loot near the bottom; a player who stays below the floor > 3 s loses the protection (no hiding). Bosses, packs and waves ignore the floor.

**Level flow**
1. Progress bar fills with **effective damage** (damage up to the target's remaining HP — fair across classes, overkill doesn't count). Target `LEVEL_DAMAGE(L)` in `game-utils.js`, tuned so a regular level is ~60 s of fighting at par skill.
2. Bar full → "CLEAR!" — spawning stops. Remaining mobs die or leave through the bottom (10 s timeout, stragglers flee).
3. Encounter (D4): regular level → gatekeeper or coordinated wave (alternating, random within type); L%10 = 5 → small boss; L%10 = 0 → big boss; L100 → super boss hook (falls back to big boss).
4. Encounter loot → burn transition → shop → next biome.

**Encounter library** (so nothing repeats inside a normal run)

| Type | Entries |
|---|---|
| Gatekeepers (~15–20 s) | Shieldbearer (frontal shield, hit from sides/AoE), Splitter (2 → 4 on death), Bomber (mines that scroll toward you), Charger (telegraphed lane charges), Totem (stationary, heals/spawns until destroyed), Archer pair (ranged, in the scenery strips) |
| Coordinated waves | V-formation from the top, pincer from both strips, closing ring (telegraphed), stampede down one lane, conga snake |
| Small bosses (L5/15/25/…) | existing Bonecrusher, Hexweaver, Broodmother, Voidmaw — adapted to the road |
| Big bosses (L10/20/30/40, then cycle with HP scaling) | Gravelord (ground-slam shockwave rings + boulders rolling down lanes), Stormcaller (rotating telegraphed laser + bullet walls with gaps + teleport), Hydra (3 heads with own HP/patterns, regrow if the body isn't finished in time), Lich (shielded while adds live, vortex pull, splits at 50%) |

**Boss voices**
- Each boss: intro, 2–3 taunts (on hitting the player, 8 s cooldown), enrage line (50%), death line — shown as a speech bubble (works muted) plus a clip. E.g. Bonecrusher: "I'll grind your bones to gravel!" / "Stand still, snack!" / "ENOUGH!" / "Impossible…".
- Pipeline `tools/voices/`: `lines.json` → TTS (local Piper with a voice whose model card permits commercial use, or a connected generator such as Higgsfield/ElevenLabs if quality demands it) → ffmpeg chain per boss (pitch −5…−8 semitones, overdrive, chorus for Voidmaw/Lich, reverb, loudnorm, mono 64 kbps) → `sfx/voice/<boss>-<event>-<n>.mp3` (~10–15 KB each, ~40 lines). Clips for the next boss are fetched when its level starts.

**Done when:** scrolling is smooth at 60 fps on a mid-range phone, each biome is recognisable, loot is pickable without a safe corner, levels end in encounters per D4, and no encounter repeats before L30.

---

### P5 — Cards, drops, economy (branch `v3`)

**One-level cards** (always on sale; price = share × `max(expectedIncome(L), incomeEMA)`, *tunable*)

| Card | Effect | Share |
|---|---|---|
| Freeze I / II | mobs 75% / 50% speed | 0.30 / 0.50 |
| Fleet Foot I / II | player 150% / 200% speed | 0.25 / 0.40 |
| Fury I / II | attack rate 150% / 200% | 0.35 / 0.60 |
| Coin Magnet | screen-wide magnet | 0.20 |
| Road Brake | road 60% speed | 0.25 |
| Double XP (progress) / Double Gold / Double Damage | as today | 0.35 / 0.30 / 0.50 |
| Feast | full heal | 0.25 |

Freeze replaces Slow Mobs. The shop deals 3 cards with at least one permanent and one one-level card when both are available.

**Permanent cards:** shared set (Power, Haste, Swift Boots, Vitality = extra heart, Keen Eye, Hot Streak, Lucky Charm = powerup chance, **Gold Rush** = +15% coins per rank, Magnet, Overtime, Regeneration, Static Nova, Impact) + 2 class cards. Pricing per D3.

**Drops**

| Drop | Kind | Notes (*tunable*) |
|---|---|---|
| 🪙 Coins | instant | `tierBase · hpScale(L) · rand(0.8–1.2) · coinMult` — scales with mob HP, which v2 didn't |
| ❤️ Heart | instant | pity roll while hurt (as today) |
| ⚡ Storm | 15 s | P3 |
| 🔋 Overcharge | instant | fills super |
| 🧪 Poison | 12 s | hits poison for 4 s (0.5·hpScale dmg/s, ticks every 0.5 s); poisoned mobs infect mobs they touch; green tint + drips |
| 💫 Stun | instant | all on-screen mobs frozen 3 s, bosses 1 s; rare |
| 🛡️ Invincible | 10 s | rare (weight 0.7 → 0.35) |
| 🌋 Earthquake | instant | the current Bomb renamed, rarer (0.8 → 0.3), crack-line visual |
| ❄️ Freeze | 10 s | mobs 50% |
| 🐢 Road Brake | 10 s | road 50% |
| 🧲 Magnet | 6 s | screen-wide |
| ⚡ Rapid Fire, 🪙×2, 🪙×3 | timed | as today |

**Calibration:** a dev overlay (`?stats`) logs per level: duration, effective damage, coins earned/spent, kills, deaths. Re-fit `expectedIncome`, `LEVEL_DAMAGE` and card shares from 10+ playtest runs per class.

**Server (v3 rules):** new board `board#v3` (v2 kept as Classic). Replace the XP-based level rule (XP is now damage) with `level ≤ 2 + duration / MIN_LEVEL_SECONDS` and re-measure the score/kill/sec caps at 3× the observed maxima. Add `class` validation and `unspent ≤ coin cap(kills, bosses, level)`.

---

### P6 — HUD (→ release v3.0.0)

- Left stack: hearts → **super bar** (blinks when full) → level/progress bar → coins.
- **SUPER button** appears top-centre under the score when full (tap); desktop: Space. Gentle pulse + sound sting when it becomes ready.
- Top-right: active timed effects with countdown (as today), one-level cards (dashed), then owned permanent upgrades as small icons with a rank superscript. Show ≤ 8, collapse the rest into "+n" (tap to expand while paused) so it never covers the road on phones.
- Release: merge `v3` → `main` with `BUMP=major`, deploy the Lambda with v3 rules first, then push.

---

### P7 — Meta: banking, wheel, artefacts, skins (v3.1.0)

**Banking + wheel**
- At game over the server credits unspent gold to the profile in the submit transaction (capped by plausibility) and returns a **pot** = that amount. Closing the tab = banked; there is no unbanked limbo.
- 🎰 **Double or nothing** stakes the pot, server-side with crypto RNG: win → `gold += pot`, pot doubles; lose → `gold −= pot`, pot = 0. Unlimited spins until 🏦 Bank or a loss. Each spin is one transaction conditioned on `pot.spins = n` (no double-taps) and `gold ≥ pot`.
- `WHEEL_WIN` (*tunable*, default 0.5 as requested). At exactly 0.5 the average gold is unchanged — the wheel only spreads it into a few rich and many broke players. 0.45 would make every spin a 10% expected sink if inflation shows up in practice. Optional pot cap if a 10-win streak (0.1%) proves too disruptive.
- Wheel animation 1.2 s; the result comes from the server, the animation just lands on it.

**Artefacts** — permanent, all owned ones active, small numbers (D6). Buy basic, then upgrade tier by tier; a tier's value replaces the previous one.

| Artefact | Basic | Rare | Legendary | Mythic |
|---|---|---|---|---|
| 💍 Greed Ring — gold | +1% | +3% | +5% | +7% |
| 🪨 Whetstone — damage | +1% | +2% | +3% | +5% |
| 🌀 Quickening Rune — attack speed | +1% | +2% | +3% | +5% |
| 🔷 Storm Shard — super charge | +2% | +4% | +6% | +10% |
| 🥾 Wind Boots — move speed | +1% | +2% | +3% | +5% |
| 🗿 Luck Idol — drop chance | +2% | +4% | +6% | +10% |
| 🧿 Road Charm — road speed | −2% | −4% | −6% | −8% |
| ⏳ Hourglass — timed effects | +2% | +5% | +8% | +12% |
| 🛡️ Guardian Amulet — ignore a hit | 1% | 2% | 3% | 5% |

Prices and gates (*tunable*): basic 1,000 · rare 4,000 (best level ≥ 10) · legendary 15,000 (≥ 20) · mythic 60,000 (≥ 30). For scale, today's expected in-run income totals ~300 coins by L10, ~1,250 by L20, ~3,000 by L30 — only part of it survives the shop, so a basic artefact is several good runs and mythic needs a long grind or the wheel.

**Skins** — cosmetic only, per class, rendered through the P3 sprite cache: basic = palette variant (300), rare = palette + outfit/headgear (2,000), legendary = + particle trail (8,000), mythic = + aura and custom kill burst + glowing name on the board (30,000). Equipped skin shows in-game, on the profile and as an icon on leaderboard rows.

**Server routes**

| Route | Body | Effect |
|---|---|---|
| `POST /player/{id}/spin` | `secret, pot` | one wheel spin (rate-limited) |
| `POST /player/{id}/bank` | `secret, pot` | closes the pot |
| `POST /player/{id}/buy` | `secret, item, tier` | conditional on `gold ≥ price`, current tier = tier−1, `bestLevel ≥ gate` |
| `POST /player/{id}/equip` | `secret, class, skin` | must own it |

New item: `pk=pot#<nonce>, sk=pot` → `playerId, amount, spins, status (open|banked|lost), ttl 24 h`. Client caches its profile (`hunter.profileCache`) and applies artefacts at run start; offline runs use the cache.

**Done when:** gold survives death into the profile, the wheel can't be forced client-side, artefacts and skins can be bought, applied and seen publicly, and no write path trusts a client-side gold value.

---

### 2.4 Testing

- Unit (`node --test`): every new pure helper — level target, charge table, pricing, artefact multipliers, coin formula, wheel accounting.
- Lambda: `node --test` with an injected fake `db.send` (no new dependencies): claim/secret checks, transactions, spin/bank race, buy conditions, plausibility v3.
- Browser QA (Playwright on the VM): stub `config.js` to empty or delete test rows afterwards (two "Tester" rows leaked once). Check 0.5, 1.0 and 2.0 aspect ratios.
- Phones over LAN (`python3 -m http.server 8000 --bind 0.0.0.0`): insecure context, so no wake lock and the API falls back to local; for https phone tests use a quick tunnel and temporarily add its origin to CORS.

### 2.5 Performance budget

60 fps on a mid-range phone at the 110-mob cap: background ≤ 2 `drawImage`/frame, player and scenery from sprite caches, Storm ≤ 3 strokes per segment, ≤ 24 audio voices, particles capped as today.

### 2.6 Open tunables to settle in playtests

`ROAD_SPEED`, soft-floor height, `LEVEL_DAMAGE(L)`, class hearts/speed/cooldowns, super charge table, Storm damage, card shares, coin `tierBase`, artefact prices, `WHEEL_WIN`.


---

## Part 3 — As built (2026-10-22)

All seven phases are implemented: v2.3.0 (P1), v2.4.0 (P2), P3–P6 on branch `v3` merged as v3.0.0, P7 as v3.1.0.
Where the build differs from the plan above:

- **Code layout:** as 2.3 plus `js/road.js` (scroll, biome tiles), `js/encounters.js` (level flow, gatekeepers, waves,
  hazards), `js/sprites.js` (vector heroes) and `js/meta.js` (P7). `extendGame()` copies property descriptors, so
  getters survive the mixin. The version lives in `js/core.js`.
- **Fullscreen** targets `document.documentElement` rather than `#stage` (the stage has a fixed CSS size and would be
  stretched). Auto-fullscreen on Play can be switched off with ⛶ and stays off (`hunter.fullscreen`).
- **Audio:** synth sounds and creature voices are rendered in plain JS DSP into AudioBuffers (same idea as
  OfflineAudioContext, but synchronous and cheap: ~8 ms per creature voice, pre-warmed in the background).
- **Boss voices:** Piper `en_US-john-medium` (LibriVox, public domain) + per-boss ffmpeg chains, `tools/voices/`.
- **Encounter decks:** 6 gatekeepers and 6 waves, each with an easy (A) and a hard/twin (B) variant, dealt as
  "all A shuffled, then all B shuffled" — 12 + 12 regular encounters before any repeat, i.e. none before L30.
- **Balance (bot-calibrated, `tools/sim/balance.py`):** `levelDamage(L) = 70·(1+0.3(L−1))·hpScale(L)` gives ~60–90 s
  levels; goblins throw grenades in pairs (cd 66, r 38) to keep the classes within ~±25% of each other;
  permanent card base prices doubled because v3 levels pay more coins; `expectedIncome(L) = 0.7·levelDamage(L)+10+2L`.
- **Server:** one Lambda serves both boards. v2 clients keep working unchanged.
- **Open tunables** remain as listed in 2.6; `?stats` and the balance bot are the tools to settle them.
