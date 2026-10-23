/* Monster Hunter — shared constants and data tables (loaded first, before js/core.js). */
const GameMath = typeof GameUtils !== 'undefined' ? GameUtils : null;

if (!GameMath) {
    throw new Error('GameUtils must be loaded before js/config-data.js');
}

const U = GameMath;
const TAU = Math.PI * 2;
const STEP = 1 / 60;
const GAME_SPEED = 0.9; // whole simulation runs at 90% speed
const BURN_MS = 1200; // level-up burn transition length
const ARENA_HUES = [200, 265, 160, 330, 35, 225, 120, 290, 10, 185]; // one arena colour per level, cycling
const WORLD_AREA = 800 * 600; // Every screen shape gets the same play area, so scores stay comparable.
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const DISPLAY_FONT = '"Lilita One","Arial Rounded MT Bold",system-ui,sans-serif';

// Player classes: one primary weapon each, plus a super charged by kills (Space / SUPER button).
const CLASSES = {
    wizard: {
        name: 'Wizard', icon: '🧙', hearts: 2, speed: 2.86, power: 2, primary: 'bolt', color: '#8b5cf6',
        weapon: 'Magic Bolt', blurb: 'Auto-aiming magic bolts', superName: 'Arcane Barrage', superBlurb: 'A stream of fireballs at the nearest monsters'
    },
    barbarian: {
        name: 'Barbarian', icon: '🪓', hearts: 4, speed: 4.2, power: 5, primary: 'cleave', color: '#f97316',
        weapon: 'Cleave', blurb: 'Huge axe swings hit everything in front', superName: 'Whirlwind', superBlurb: '10 s of invincible spinning havoc'
    },
    goblin: {
        name: 'Goblin', icon: '💣', hearts: 3, speed: 5.2, power: 4, primary: 'grenade', color: '#22c55e',
        weapon: 'Grenades', blurb: 'Lobbed bombs with a big boom', superName: 'Bombardment', superBlurb: "It's raining bombs!"
    }
};
const CLASS_ORDER = ['wizard', 'barbarian', 'goblin'];
const PRIMARY = {
    bolt: { cooldown: 32, damage: 1, speed: 9, radius: 4.5 },
    cleave: { cooldown: 60, damage: 4, reach: 75, arc: (70 * Math.PI) / 180, swing: 12 },
    grenade: { cooldown: 76, damage: 5, radius: 33, range: 240, fuse: 60, speedMin: 5, speedMax: 8, bounces: 4 }
};
// Super meter charge per kill (0–100). Gatekeeper/boss values are used by the encounter system.
const SUPER_CHARGE = { small: 2, medium: 3, large: 5, elite: 6, legendary: 10, mythic: 12, ancient: 15, ultimate: 25, gatekeeper: 35, boss: 70 };
const GRENADE_G = 0.5; // grenade gravity (px/step²) for the bounce arcs
const WHIRLWIND_STEPS = Math.round(5 * 60 * GAME_SPEED);
const STORM = { duration: Math.round(15 * 60 * GAME_SPEED), every: Math.round(3 * 60 * GAME_SPEED), range: 260, jump: 120, jumps: 5, damage: 6, falloff: 0.65 };

const MONSTER_TYPES = {
    small: [
        { shape: 'circle', color: '#8B0000', size: 11, speed: 1.5, speedVariation: 0.5, health: 1, name: 'Imp', points: 10 },
        { shape: 'square', color: '#4B0082', size: 8, speed: 1.6, speedVariation: 0.4, health: 1, name: 'Shadow', points: 10 },
        { shape: 'triangle', color: '#006400', size: 9, speed: 1.6, speedVariation: 0.5, health: 1, name: 'Goblin', points: 10 },
        { shape: 'diamond', color: '#8B4513', size: 10, speed: 1.4, speedVariation: 0.4, health: 1, name: 'Kobold', points: 10 }
    ],
    medium: [
        { shape: 'star', color: '#DC143C', size: 14, speed: 1.2, speedVariation: 0.3, health: 2, name: 'Demon', points: 25 },
        { shape: 'hexagon', color: '#8A2BE2', size: 12, speed: 1.3, speedVariation: 0.4, health: 2, name: 'Wraith', points: 25 },
        { shape: 'cross', color: '#228B22', size: 13, speed: 1.1, speedVariation: 0.3, health: 3, name: 'Troll', points: 25 }
    ],
    large: [
        { shape: 'spiky', color: '#FF4500', size: 15, speed: 0.8, speedVariation: 0.2, health: 5, name: 'Dragon Lord', points: 100 },
        { shape: 'giant', color: '#800080', size: 19, speed: 1.0, speedVariation: 0.2, health: 4, name: 'Ancient One', points: 80 },
        { shape: 'behemoth', color: '#2F4F4F', size: 17, speed: 0.7, speedVariation: 0.2, health: 6, name: 'Behemoth', points: 120 }
    ],
    elite: [{ shape: 'aura', color: '#FFD700', size: 20, speed: 1.4, speedVariation: 0.5, health: 3, name: 'Elite Guard', points: 50 }],
    legendary: [{ shape: 'aura', color: '#FF1493', size: 24, speed: 1.5, speedVariation: 0.3, health: 10, name: 'Legendary Beast', points: 150 }],
    mythic: [{ shape: 'aura', color: '#00FFFF', size: 28, speed: 1.8, speedVariation: 0.4, health: 14, name: 'Mythic Titan', points: 250 }],
    ancient: [{ shape: 'aura', color: '#FF00FF', size: 34, speed: 2.2, speedVariation: 0.5, health: 20, name: 'Ancient Horror', points: 400 }],
    ultimate: [{ shape: 'aura', color: '#FFFFFF', size: 40, speed: 2.4, speedVariation: 0.4, health: 50, name: 'Ultimate Destroyer', points: 1000 }]
};
const TIER_UNLOCK = { elite: 6, legendary: 11, mythic: 16, ancient: 22, ultimate: 28 };
const DROP_CHANCE = { small: 0.004, medium: 0.01, large: 0.03, elite: 0.06, legendary: 0.1, mythic: 0.14, ancient: 0.2, ultimate: 0.4 };
const DROP_COOLDOWN = 480;         // frames between powerup drops from kills
const MAX_FIELD_POWERUPS = 4;      // never more than this many lying around (boss loot excepted)
// Loot vs the road (v3.3.1): drops from low kills pop up-screen, the bottom strip is sticky, and
// coins/gems/eggs that still fall off are kept by the next boss and dropped when it dies.
const LOOT_POP_ZONE = 0.66;   // kills below this share of the screen height launch their loot upwards
const STICKY_STRIP = 70;      // px above the bottom edge where loot grips the ground…
const STICKY_ROAD = 0.25;     // …and the road moves it at this fraction of its speed
const POWERUP_LIFE = 990;     // steps a dropped powerup lasts (coins never expire)
const CHASE_ROAD_GRIP = 0.2;  // chasers walk against the road: they cancel this share of its drift
const WANDER_UP_BIAS = 0.01;  // wanderers turn up-screen this much more often than down
// Picking up a powerup that is already running refills its timer (no stacking, no cap: Overtime counts).
const KICK = { every: Math.round(2 * 60 * GAME_SPEED), radius: 140, push: 70 }; // Kickback powerup
// Coins per kill: [chance, tierBase]; amount = tierBase × hpScale(L) × rand(0.8–1.2) × coin multipliers.
const COIN_DROPS = {
    small: [0.35, 1], medium: [0.5, 2], large: [0.85, 4], elite: [1, 6],
    legendary: [1, 8], mythic: [1, 11], ancient: [1, 15], ultimate: [1, 25]
};

// Pickups. `instant` ones hit monsters right away, so end-of-level loot (nobody left to hit) never has them.
// Timed ones last `secs` (× Overtime, × Hourglass), capped at 30 real seconds.
const POWERUPS = {
    storm: { emoji: '🌩️', name: 'Storm', color: '#7dd3fc', timed: true, secs: 15, weight: 0.8 },
    overcharge: { emoji: '🔋', name: 'Overcharge', color: '#facc15', weight: 0.5 },
    poison: { emoji: '🧪', name: 'Poison Cloud', color: '#84cc16', timed: true, secs: 20, weight: 0.7 },
    stun: { emoji: '💫', name: 'Stun', color: '#fde047', weight: 0.25, instant: true },
    rapidFire: { emoji: '⚡', name: 'Rapid Fire', color: '#00CED1', timed: true, secs: 10, weight: 0.9 },
    invincible: { emoji: '🛡️', name: 'Invincible', color: '#7CFC00', timed: true, secs: 10, weight: 0.35 },
    freeze: { emoji: '❄️', name: 'Ice Cloud', color: '#87CEEB', timed: true, secs: 12, weight: 0.7 },
    kickback: { emoji: '💨', name: 'Kickback', color: '#e2e8f0', timed: true, secs: 30, weight: 0.6 },
    roadBrake: { emoji: '🐢', name: 'Road Brake', color: '#a3a3a3', timed: true, secs: 10, weight: 0.6 },
    magnet: { emoji: '🧲', name: 'Magnet', color: '#f43f5e', timed: true, secs: 30, weight: 0.7 },
    coins2: { emoji: '🪙', pouch: true, tag: '×2', name: 'Coins ×2', color: '#FFC300', timed: true, secs: 30, weight: 0.8 },
    coins3: { emoji: '🪙', pouch: true, tag: '×3', name: 'Coins ×3', color: '#FF8C00', timed: true, secs: 30, weight: 0.4 },
    heart: { emoji: '❤️', name: 'Extra Life', color: '#FF1493', weight: 1 },
    petBoost: { emoji: '🦴', name: 'Pet Treat', color: '#f59e0b', timed: true, secs: 30, weight: 0.6, needsPets: true },
    quake: { emoji: '🌋', name: 'Earthquake', color: '#FF4500', weight: 0.3, instant: true }
};
const TIMED_POWERUPS = Object.keys(POWERUPS).filter(k => POWERUPS[k].timed);
const POISON_RADIUS = 140;
// UI icons (CSS-drawn, match the canvas drops): a coin, a pouch = a pile of coins, a gem
const COIN = '<i class="i-coin"></i>';
const POUCH = '<i class="i-pouch"></i>';
const GEM = '<i class="i-gem"></i>';

// Permanent shop cards. Price = cost × 3 × (1 + 0.75 × rank already owned) — a finite sink (D3).
const UPGRADES = [
    { id: 'power', icon: '💪', name: 'Power', max: 5, cost: 40, desc: '+20% basic attack damage' },
    { id: 'haste', icon: '⏱️', name: 'Haste', max: 5, cost: 35, desc: '+10% attack speed' },
    { id: 'boots', icon: '👟', name: 'Swift Boots', max: 4, cost: 20, desc: '+10% move speed' },
    { id: 'vitality', icon: '❤️', name: 'Vitality', max: 3, cost: 50, desc: '+1 max heart and heal 1' },
    { id: 'crit', icon: '🎯', name: 'Keen Eye', max: 4, cost: 30, desc: '+8% chance to crit for 2.5× damage' },
    { id: 'streak', icon: '🔥', name: 'Hot Streak', max: 3, cost: 8, desc: 'Combo timer lasts 1s longer' },
    { id: 'luck', icon: '🍀', name: 'Lucky Charm', max: 3, cost: 20, desc: '+30% powerup drops' },
    { id: 'goldrush', icon: '💰', name: 'Gold Rush', max: 4, cost: 20, desc: '+15% chance that monsters drop coins' },
    { id: 'goldrun', icon: '🏦', name: 'Double Gold', max: 1, cost: 80, desc: '×2 coins (stacks with Triple Gold for ×6)' },
    { id: 'magnet', icon: '🧲', name: 'Magnet', max: 3, cost: 9, desc: 'Pull coins from further away' },
    { id: 'overtime', icon: '⌛', name: 'Overtime', max: 3, cost: 15, desc: 'Powerups last 30% longer' },
    { id: 'toxin', icon: '☠️', name: 'Toxic Cloud', max: 1, cost: 20, desc: 'Whole run: Poison Cloud does ×2 damage' },
    { id: 'frost', icon: '🧊', name: 'Deep Freeze', max: 3, cost: 15, desc: 'Whole run: Ice Cloud slows 10% more' },
    { id: 'thunder', icon: '⛈️', name: 'Thunder God', max: 1, cost: 20, desc: 'Whole run: Storm’s first strike hits ×2' },
    { id: 'recoil', icon: '🌪️', name: 'Big Kick', max: 1, cost: 20, desc: 'Whole run: Kickback reaches ×2 as far' },
    { id: 'regen', icon: '🌿', name: 'Regeneration', max: 2, cost: 60, desc: 'Regrow a heart every 40s (25s at rank 2)' },
    { id: 'nova', icon: '💫', name: 'Static Nova', max: 2, cost: 35, desc: 'Taking a hit blasts nearby monsters' },
    { id: 'impact', icon: '💥', name: 'Impact', max: 3, cost: 30, desc: '+15% bolt size, cleave reach and blast radius' },
    { id: 'split', icon: '🔱', name: 'Split Shot', max: 3, cost: 40, cls: 'wizard', desc: 'Bolts fire +1 projectile' },
    { id: 'pierce', icon: '🏹', name: 'Piercing Rounds', max: 3, cost: 30, cls: 'wizard', desc: 'Bolts pierce +1 monster' },
    { id: 'packLeader', icon: '🦮', name: 'Pack Leader', max: 1, cost: 40, needsPets: true, desc: 'Whole run: your pets are twice as strong' },
    { id: 'quick', icon: '💨', name: 'Quick Swing', max: 3, cost: 30, cls: 'barbarian', desc: '+10% swing speed' },
    { id: 'cluster', icon: '🧨', name: 'Cluster Bombs', max: 3, cost: 30, cls: 'goblin', desc: '+1 grenade per throw' },
    { id: 'fuse', icon: '⏲️', name: 'Short Fuse', max: 3, cost: 30, cls: 'goblin', desc: 'Grenades burst 20% sooner and throw 10% faster' }
];
// Core upgrades: always on offer in their own row above the three dealt cards —
// attack speed, more projectiles (or reach, for the axe), damage and move speed.
const CORE_CARDS = { wizard: ['haste', 'split', 'power', 'boots'], barbarian: ['haste', 'impact', 'power', 'boots'], goblin: ['haste', 'cluster', 'power', 'boots'] };
// One-level cards: last until the next level. `cost` = price on the first levels; it grows slowly with
// the level (×5 by level 52, then flat — U.cardPrice). Cheap = nice to have, pricier = strong.
const LEVEL_BUFFS = [
    { id: 'brake', icon: '🐢', name: 'Road Brake', buff: true, cost: 5, weight: 0.5, desc: 'This level: the road moves at 60%' },
    { id: 'magnetAll', icon: '🧲', name: 'Coin Magnet', buff: true, cost: 10, weight: 0.5, desc: 'This level: pull coins from the whole map' },
    { id: 'fleet1', group: 'fleet', icon: '🏃', name: 'Fleet Foot I', buff: true, cost: 10, weight: 0.5, desc: 'This level: you run 150% fast' },
    { id: 'fleet2', group: 'fleet', icon: '🐆', name: 'Fleet Foot II', buff: true, cost: 13, weight: 0.35, desc: 'This level: you run 200% fast' },
    { id: 'feast', icon: '🍖', name: 'Feast', cost: 5, weight: 0.4, desc: 'Fully heal' },
    { id: 'freeze1', group: 'freeze', icon: '🧊', name: 'Freeze I', buff: true, cost: 10, weight: 0.5, desc: 'This level: monsters move at 75%' },
    { id: 'gold3', icon: '💰', name: 'Triple Gold', buff: true, cost: 30, weight: 0.5, desc: 'This level: ×3 coins' },
    { id: 'fury1', group: 'fury', icon: '😤', name: 'Fury I', buff: true, cost: 15, weight: 0.5, desc: 'This level: attack 150% as often' },
    { id: 'fury2', group: 'fury', icon: '👹', name: 'Fury II', buff: true, cost: 20, weight: 0.35, desc: 'This level: attack twice as often' },
    { id: 'swarm', icon: '👯', name: 'Double Trouble', buff: true, cost: 40, weight: 0.45, desc: 'This level: twice the monsters — they all come in pairs. More kills, more coins!' },
    { id: 'xp2', icon: '📘', name: 'Double Progress', buff: true, cost: 10, weight: 0.5, desc: 'This level: the level bar fills twice as fast' },
    { id: 'freeze2', group: 'freeze', icon: '❄️', name: 'Freeze II', buff: true, cost: 15, weight: 0.35, desc: 'This level: monsters move at 50%' },
    { id: 'petParty', icon: '🐾', name: 'Pet Party', buff: true, cost: 15, weight: 0.5, needsPets: true, desc: 'This level: your pets are twice as strong' },
    { id: 'dmg2', icon: '🗡️', name: 'Double Damage', buff: true, cost: 12, weight: 0.5, desc: 'This level: ×2 damage' }
];
LEVEL_BUFFS.forEach(b => { b.oneLevel = true; });

// Small bosses (L5, 15, 25 …)
const BOSSES = [
    { name: 'Bonecrusher', voice: 'bonecrusher', title: 'The Juggernaut', color: '#C0392B', accent: '#F5B041', size: 40, hp: 60, speed: 0.9, pattern: 'charge' },
    { name: 'Hexweaver', voice: 'hexweaver', title: 'Witch of the Ninth Moon', color: '#7D3C98', accent: '#F4D03F', size: 36, hp: 60, speed: 1.1, pattern: 'rings' },
    { name: 'Broodmother', voice: 'broodmother', title: 'Queen of the Swarm', color: '#1E8449', accent: '#ABEBC6', size: 46, hp: 80, speed: 0.6, pattern: 'summon' },
    { name: 'Voidmaw', voice: 'voidmaw', title: 'Devourer of Light', color: '#1B2631', accent: '#E74C3C', size: 44, hp: 110, speed: 1.0, pattern: 'chaos' }
];
// Big bosses (L10, 20, 30, 40, then cycling with more HP)
const BIG_BOSSES = [
    { name: 'Gravelord', voice: 'gravelord', title: 'The Mountain That Walks', color: '#78716c', accent: '#fb923c', size: 54, hp: 260, speed: 0.6, pattern: 'gravelord', big: true },
    { name: 'Stormcaller', voice: 'stormcaller', title: 'Master of Thunder', color: '#1e3a8a', accent: '#7dd3fc', size: 40, hp: 240, speed: 1.0, pattern: 'stormcaller', big: true },
    { name: 'Hydra', voice: 'hydra', title: 'Three Heads, One Appetite', color: '#0f766e', accent: '#a3e635', size: 46, hp: 200, speed: 0.5, pattern: 'hydra', big: true },
    { name: 'Lich', voice: 'lich', title: 'King of the Restless Dead', color: '#3b2f6b', accent: '#a78bfa', size: 38, hp: 220, speed: 0.8, pattern: 'lich', big: true }
];

// ---------------------------------------------------------------------- meta progression (P7, v3.2)
// Must match leaderboard/lambda/catalog.mjs (test/catalog.test.mjs checks it).
// Rarity tiers (display only): artefact tiers 1–4 and skin rarities share these colours.
const TIERS = [
    null,
    { name: 'basic', label: 'Basic', color: '#cbd5e1' },
    { name: 'rare', label: 'Rare', color: '#60a5fa' },
    { name: 'legendary', label: 'Legendary', color: '#f59e0b' },
    { name: 'mythic', label: 'Mythic', color: '#e879f9' }
];
// Pets are collected in the profile: they hatch from eggs (gold or boss drops), three of a kind and
// tier merge into the next tier for gems, and the ones in the pet slots come along on hunts.
// values[tier] is the pet's number at that tier (see `label`). Mirrors leaderboard/lambda/catalog.mjs.
const MERGE_GEMS = [0, 0, 2, 5, 15];
const MAX_SLOTS = 4;
const SLOT_UNLOCK = [null, null, { gold: 1000 }, { gems: 100 }, { gems: 1000 }];
const EGG_PRICE = 1000;
const NESTS = 1;
const HATCH_MS = 6 * 3600 * 1000;
const HURRY_GEMS_PER_HOUR = 1;
const EGG_ODDS = [80, 16, 3.5, 0.5]; // one kind of egg, bought or dropped by a boss
const BOSS_EGG_CHANCE = 0.1;         // any boss, small or big
const PETS = {
    turtle: { icon: '🐢', name: 'Turtle', what: 'extra green hearts that take hits first', values: [0, 1, 2, 3, 4], label: v => `+${v} green ${v > 1 ? 'hearts' : 'heart'}` },
    bees: { icon: '🐝', name: 'Bees', what: 'each bee stings a monster near you every 2 s', values: [0, 1, 2, 4, 8], label: v => `${v} ${v > 1 ? 'bees' : 'bee'}` },
    eagle: { icon: '🦅', name: 'Eagle', what: 'dives on wounded monsters every 3 s', values: [0, 2, 4, 8, 16], label: v => `${v} damage dives` },
    frog: { icon: '🐸', name: 'Frog', what: 'swallows a monster whole every 4 s', values: [0, 2, 4, 8, 16], label: v => `eats up to ${v} HP` },
    donkey: { icon: '🫏', alt: '🐴', name: 'Donkey', what: 'kicks monsters away before they reach you', values: [0, 2.5, 1.6, 1, 0.5], label: v => `a kick every ${v} s` },
    squirrel: { icon: '🐿️', name: 'Squirrel', what: 'chance that a kill drops double loot', values: [0, 1, 2, 4, 8], label: v => `${v}% double drops` },
    bunny: { icon: '🐇', name: 'Bunny', what: 'chance to drop a heart when you get hit', values: [0, 5, 10, 15, 20], label: v => `${v}% heart on a hit` }
};
const SKIN_PRICES = { basic: { gold: 300 }, rare: { gold: 2000 }, legendary: { gems: 25 }, mythic: { gems: 60 } };
// What a skin adds in runs, by rarity (the same for every class):
//   basic +5% damage · rare +5% gold drop chance · legendary +10% attack speed and damage ·
//   mythic ×2 every drop chance (above 100% the rest is a chance of a second drop)
const RARITY_PERKS = {
    basic: { bonus: { damage: 0.05 }, text: '+5% damage' },
    rare: { bonus: { coinDrop: 0.05 }, text: '+5% gold drop chance' },
    legendary: { bonus: { rate: 0.1, damage: 0.1 }, text: '+10% attack speed & damage' },
    mythic: { bonus: { drops: 1 }, text: '×2 all drop chances' }
};
const skinPerk = id => (SKINS[id] ? RARITY_PERKS[SKINS[id].rarity] : null);
const STAT_NAMES = { gold: 'gold', damage: 'damage', rate: 'attack speed', charge: 'super charge', speed: 'move speed', luck: 'drop chance', road: 'road speed', timed: 'timed effects', guard: 'dodge' };
// Gems: very rare drops, likelier from harder monsters; bosses always drop some.
const GEM_CHANCE = { small: 0.0005, medium: 0.001, large: 0.003, elite: 0.006, legendary: 0.01, mythic: 0.015, ancient: 0.025, ultimate: 0.06, gatekeeper: 0.25 };
// Cosmetic skins per class: palette overrides for js/sprites.js + extras (headgear, trail, aura, kill burst).
const SKINS = {
    frost: { cls: 'wizard', rarity: 'basic', name: 'Frost Mage', palette: { robe: '#38bdf8', robeDark: '#0369a1', hat: '#0284c7', trim: '#e0f2fe', hatBand: '#e0f2fe', star: '#ffffff', orb: '#e0f2fe' } },
    flame: { cls: 'wizard', rarity: 'rare', name: 'Flame King', palette: { robe: '#dc2626', robeDark: '#991b1b', trim: '#fbbf24', orb: '#fb923c' }, extras: { noHat: true, crown: '#fbbf24' } },
    shadow: { cls: 'wizard', rarity: 'legendary', name: 'Shadow Archmage', palette: { robe: '#1f2937', robeDark: '#111827', hat: '#312e81', hatBand: '#a78bfa', trim: '#a78bfa', star: '#c4b5fd', orb: '#c084fc', beard: '#9ca3af' }, extras: { trail: '#a78bfa' } },
    celestial: { cls: 'wizard', rarity: 'mythic', name: 'Celestial', palette: { robe: '#fef3c7', robeDark: '#fde68a', hat: '#f8fafc', hatBand: '#facc15', trim: '#facc15', star: '#facc15', orb: '#fde047' }, extras: { trail: '#fde047', aura: '#facc15', burst: '#fde047' } },
    viking: { cls: 'barbarian', rarity: 'basic', name: 'Snow Viking', palette: { hair: '#facc15', hairDark: '#ca8a04', fur: '#e5e7eb', furLight: '#ffffff', pants: '#1e3a8a' } },
    warlord: { cls: 'barbarian', rarity: 'rare', name: 'Golden Warlord', palette: { fur: '#7f1d1d', furLight: '#b91c1c', axeHead: '#fde047', buckle: '#fde047' }, extras: { noHelmet: true, crown: '#facc15' } },
    lava: { cls: 'barbarian', rarity: 'legendary', name: 'Lava Berserker', palette: { hair: '#f97316', hairDark: '#c2410c', helmet: '#292524', helmetDark: '#1c1917', horn: '#fb923c', axeHead: '#fb923c', axeEdge: '#fde047', fur: '#292524', furLight: '#57534e' }, extras: { trail: '#fb923c' } },
    titan: { cls: 'barbarian', rarity: 'mythic', name: 'Storm Titan', palette: { skin: '#bfdbfe', skinShade: '#93c5fd', hair: '#f8fafc', hairDark: '#cbd5e1', helmet: '#e5e7eb', horn: '#fde047', axeHead: '#fde047', fur: '#1e3a8a', furLight: '#3b82f6' }, extras: { trail: '#93c5fd', aura: '#60a5fa', burst: '#bfdbfe' } },
    redcap: { cls: 'goblin', rarity: 'basic', name: 'Red Cap', palette: { cap: '#dc2626', vest: '#1d4ed8', vestDark: '#1e3a8a' } },
    pirate: { cls: 'goblin', rarity: 'rare', name: 'Pirate Goblin', palette: { vest: '#f8fafc', vestDark: '#1f2937', pants: '#1f2937' }, extras: { noCap: true, pirate: true } },
    toxic: { cls: 'goblin', rarity: 'legendary', name: 'Toxic Goblin', palette: { skin: '#a3e635', ear: '#bef264', eye: '#f0abfc', vest: '#581c87', vestDark: '#3b0764', bomb: '#4d7c0f', fuse: '#d946ef' }, extras: { trail: '#a3e635' } },
    king: { cls: 'goblin', rarity: 'mythic', name: 'Goblin King', palette: { vest: '#7e22ce', vestDark: '#581c87', satchel: '#facc15' }, extras: { noCap: true, crown: '#facc15', trail: '#facc15', aura: '#fde047', burst: '#facc15' } }
};
const RARITY = { basic: 1, rare: 2, legendary: 3, mythic: 4 };
