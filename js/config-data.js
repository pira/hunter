/* Monster Hunter — shared constants and data tables (loaded first, before js/core.js). */
const GameMath = typeof GameUtils !== 'undefined' ? GameUtils : null;

if (!GameMath) {
    throw new Error('GameUtils must be loaded before js/config-data.js');
}

const U = GameMath;
const TAU = Math.PI * 2;
const STEP = 1 / 60;
const GAME_SPEED = 0.9; // whole simulation runs at 90% speed
const BURN_MS = 1500; // level-up burn transition length
const ARENA_HUES = [200, 265, 160, 330, 35, 225, 120, 290, 10, 185]; // one arena colour per level, cycling
const WORLD_AREA = 800 * 600; // Every screen shape gets the same play area, so scores stay comparable.
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const DISPLAY_FONT = '"Lilita One","Arial Rounded MT Bold",system-ui,sans-serif';

// Player classes: one primary weapon each, plus a super charged by kills (Space / SUPER button).
const CLASSES = {
    wizard: {
        name: 'Wizard', icon: '🧙', hearts: 2, speed: 2.86, power: 2, primary: 'bolt', color: '#8b5cf6',
        weapon: 'Magic Bolt', blurb: 'Auto-aiming magic bolts', superName: 'Arcane Nova', superBlurb: 'Rings of giant piercing bolts'
    },
    barbarian: {
        name: 'Barbarian', icon: '🪓', hearts: 4, speed: 4.2, power: 5, primary: 'cleave', color: '#f97316',
        weapon: 'Cleave', blurb: 'Huge axe swings hit everything in front', superName: 'Whirlwind', superBlurb: '5 s of invincible spinning havoc'
    },
    goblin: {
        name: 'Goblin', icon: '💣', hearts: 3, speed: 5.2, power: 4, primary: 'grenade', color: '#22c55e',
        weapon: 'Grenades', blurb: 'Lobbed bombs with a big boom', superName: 'Bombardment', superBlurb: 'Bombs in all four directions'
    }
};
const CLASS_ORDER = ['wizard', 'barbarian', 'goblin'];
const PRIMARY = {
    bolt: { cooldown: 32, damage: 0.7, speed: 9, radius: 4.5 },
    cleave: { cooldown: 64, damage: 10, reach: 80, arc: (70 * Math.PI) / 180, swing: 12 },
    grenade: { cooldown: 66, damage: 8, radius: 38, range: 240, fuse: 60, speed: 8.45, bounces: 5 }
};
// Super meter charge per kill (0–100). Gatekeeper/boss values are used by the encounter system.
const SUPER_CHARGE = { small: 2, medium: 3, large: 5, elite: 6, legendary: 10, mythic: 12, ancient: 15, ultimate: 25, gatekeeper: 35, boss: 100 };
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
const MAX_FIELD_POWERUPS = 3;      // never more than this many lying around (boss loot excepted)
const TIMER_CAP = Math.round(30 * 60 * GAME_SPEED); // a powerup can never stack past 30 real seconds
// Coins per kill: [chance, tierBase]; amount = tierBase × hpScale(L) × rand(0.8–1.2) × coin multipliers.
const COIN_DROPS = {
    small: [0.3, 1], medium: [0.45, 1.5], large: [0.8, 3], elite: [1, 4],
    legendary: [1, 5], mythic: [1, 7.5], ancient: [1, 11], ultimate: [1, 23]
};

// Pickups. Timed ones last `secs` (× Overtime, × Hourglass), capped at 30 real seconds.
const POWERUPS = {
    storm: { emoji: '🌩️', name: 'Storm', color: '#7dd3fc', timed: true, secs: 15, weight: 0.8 },
    overcharge: { emoji: '🔋', name: 'Overcharge', color: '#facc15', weight: 0.5 },
    poison: { emoji: '🧪', name: 'Poison Cloud', color: '#84cc16', timed: true, secs: 12, weight: 0.7 },
    stun: { emoji: '💫', name: 'Stun', color: '#fde047', weight: 0.25 },
    rapidFire: { emoji: '⚡', name: 'Rapid Fire', color: '#00CED1', timed: true, secs: 10, weight: 0.9 },
    invincible: { emoji: '🛡️', name: 'Invincible', color: '#7CFC00', timed: true, secs: 10, weight: 0.35 },
    freeze: { emoji: '❄️', name: 'Freeze', color: '#87CEEB', timed: true, secs: 10, weight: 0.7 },
    roadBrake: { emoji: '🐢', name: 'Road Brake', color: '#a3a3a3', timed: true, secs: 10, weight: 0.6 },
    magnet: { emoji: '🧲', name: 'Magnet', color: '#f43f5e', timed: true, secs: 15, weight: 0.7 },
    coins2: { emoji: '🪙', tag: '×2', name: 'Coins ×2', color: '#FFC300', timed: true, secs: 10, weight: 0.8 },
    coins3: { emoji: '🪙', tag: '×3', name: 'Coins ×3', color: '#FF8C00', timed: true, secs: 10, weight: 0.4 },
    heart: { emoji: '❤️', name: 'Extra Life', color: '#FF1493', weight: 1 },
    quake: { emoji: '🌋', name: 'Earthquake', color: '#FF4500', weight: 0.3 }
};
const TIMED_POWERUPS = Object.keys(POWERUPS).filter(k => POWERUPS[k].timed);
const POISON_RADIUS = 78;

// Permanent shop cards. Price = cost × 3 × (1 + 0.75 × rank already owned) — a finite sink (D3).
const UPGRADES = [
    { id: 'power', icon: '💪', name: 'Power', max: 5, cost: 40, desc: '+20% basic attack damage' },
    { id: 'haste', icon: '⏱️', name: 'Haste', max: 5, cost: 40, desc: '+15% attack speed' },
    { id: 'boots', icon: '👟', name: 'Swift Boots', max: 4, cost: 20, desc: '+10% move speed' },
    { id: 'vitality', icon: '❤️', name: 'Vitality', max: 3, cost: 50, desc: '+1 max heart and heal 1' },
    { id: 'crit', icon: '🎯', name: 'Keen Eye', max: 4, cost: 35, desc: '+8% chance to crit for 2.5× damage' },
    { id: 'streak', icon: '🔥', name: 'Hot Streak', max: 3, cost: 15, desc: 'Combo timer lasts 0.6s longer' },
    { id: 'luck', icon: '🍀', name: 'Lucky Charm', max: 3, cost: 20, desc: '+30% powerup drops' },
    { id: 'goldrush', icon: '💰', name: 'Gold Rush', max: 4, cost: 25, desc: '+15% coins' },
    { id: 'magnet', icon: '🧲', name: 'Magnet', max: 3, cost: 15, desc: 'Pull coins and pickups from further away' },
    { id: 'overtime', icon: '⌛', name: 'Overtime', max: 3, cost: 20, desc: 'Powerups last 30% longer (cap 30s)' },
    { id: 'regen', icon: '🌿', name: 'Regeneration', max: 2, cost: 45, desc: 'Regrow a heart every 40s (25s at rank 2)' },
    { id: 'nova', icon: '💫', name: 'Static Nova', max: 2, cost: 35, desc: 'Taking a hit blasts nearby monsters' },
    { id: 'impact', icon: '💥', name: 'Impact', max: 3, cost: 30, desc: '+15% bolt size, cleave reach and blast radius' },
    { id: 'split', icon: '🔱', name: 'Split Shot', max: 3, cost: 40, cls: 'wizard', desc: 'Bolts fire +1 projectile' },
    { id: 'pierce', icon: '🏹', name: 'Piercing Rounds', max: 3, cost: 30, cls: 'wizard', desc: 'Bolts pierce +1 monster' },
    { id: 'reach', icon: '📏', name: 'Longer Handle', max: 3, cost: 25, cls: 'barbarian', desc: 'Axe handle +10% longer (10 → 20 → 30%): more reach' },
    { id: 'quick', icon: '💨', name: 'Quick Swing', max: 3, cost: 30, cls: 'barbarian', desc: '+25% swing speed' },
    { id: 'cluster', icon: '🧨', name: 'Cluster Bombs', max: 3, cost: 40, cls: 'goblin', desc: '+1 grenade per throw (max 5)' },
    { id: 'fuse', icon: '⏲️', name: 'Short Fuse', max: 3, cost: 30, cls: 'goblin', desc: 'Grenades burst 20% sooner and throw 10% faster' }
];
// One-level cards: last until the next level. `cost` = price at level 2; it grows with the level's
// expected income (U.cardPrice). Cheap = nice to have, expensive = strong.
const LEVEL_BUFFS = [
    { id: 'brake', icon: '🐢', name: 'Road Brake', buff: true, cost: 20, weight: 0.5, desc: 'This level: the road moves at 60%' },
    { id: 'magnetAll', icon: '🧲', name: 'Coin Magnet', buff: true, cost: 25, weight: 0.5, desc: 'This level: pull coins from the whole map' },
    { id: 'fleet1', group: 'fleet', icon: '🏃', name: 'Fleet Foot I', buff: true, cost: 30, weight: 0.5, desc: 'This level: you run 150% fast' },
    { id: 'fleet2', group: 'fleet', icon: '🐆', name: 'Fleet Foot II', buff: true, cost: 50, weight: 0.35, desc: 'This level: you run 200% fast' },
    { id: 'feast', icon: '🍖', name: 'Feast', cost: 40, weight: 0.4, desc: 'Fully heal' },
    { id: 'freeze1', group: 'freeze', icon: '🧊', name: 'Freeze I', buff: true, cost: 45, weight: 0.5, desc: 'This level: monsters move at 75%' },
    { id: 'gold2', icon: '💰', name: 'Double Gold', buff: true, cost: 60, weight: 0.5, desc: 'This level: ×2 coins' },
    { id: 'fury1', group: 'fury', icon: '😤', name: 'Fury I', buff: true, cost: 70, weight: 0.5, desc: 'This level: attack 150% as often' },
    { id: 'swarm', icon: '👯', name: 'Double Trouble', buff: true, cost: 70, weight: 0.45, desc: 'This level: twice the monsters — they all come in pairs. More kills, more coins!' },
    { id: 'xp2', icon: '📘', name: 'Double Progress', buff: true, cost: 80, weight: 0.5, desc: 'This level: the level bar fills twice as fast' },
    { id: 'freeze2', group: 'freeze', icon: '❄️', name: 'Freeze II', buff: true, cost: 80, weight: 0.35, desc: 'This level: monsters move at 50%' },
    { id: 'fury2', group: 'fury', icon: '👹', name: 'Fury II', buff: true, cost: 120, weight: 0.35, desc: 'This level: attack twice as often' },
    { id: 'dmg2', icon: '🗡️', name: 'Double Damage', buff: true, cost: 120, weight: 0.5, desc: 'This level: ×2 damage' }
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
// Artefacts are collected items: basic ones cost gold (or come from the rare in-run artefact card),
// three of a tier merge into one of the next tier for gems. Up to MAX_SLOTS different ones are
// slotted in the profile and only those are active in runs. values[tier] is the bonus in %.
const ARTEFACT_PRICE = 1000;
const MERGE_GEMS = [0, 0, 2, 5, 15];
const MAX_SLOTS = 4;
const ARTEFACTS = {
    greed: { icon: '💍', name: 'Greed Ring', stat: 'gold', what: 'gold', values: [0, 1, 2, 3, 4] },
    whetstone: { icon: '🪨', name: 'Whetstone', stat: 'damage', what: 'damage', values: [0, 1, 2, 3, 4] },
    rune: { icon: '🌀', name: 'Quickening Rune', stat: 'rate', what: 'attack speed', values: [0, 1, 2, 3, 4] },
    shard: { icon: '🔷', name: 'Storm Shard', stat: 'charge', what: 'super charge', values: [0, 2, 4, 6, 8] },
    boots: { icon: '🥾', name: 'Wind Boots', stat: 'speed', what: 'move speed', values: [0, 1, 2, 3, 4] },
    idol: { icon: '🗿', name: 'Luck Idol', stat: 'luck', what: 'drop chance', values: [0, 2, 4, 6, 8] },
    charm: { icon: '🧿', name: 'Road Charm', stat: 'road', what: 'road speed', values: [0, -2, -4, -6, -8] },
    hourglass: { icon: '⏳', name: 'Hourglass', stat: 'timed', what: 'timed effects', values: [0, 2, 4, 6, 8] },
    amulet: { icon: '🛡️', name: 'Guardian Amulet', stat: 'guard', what: 'chance to ignore a hit', values: [0, 1, 2, 3, 4] }
};
const SKIN_PRICES = { basic: { gold: 300 }, rare: { gold: 2000 }, legendary: { gems: 25 }, mythic: { gems: 60 } };
// What a skin adds in runs (rare and up): a small themed bonus, same stat keys as artefacts.
const SKIN_PERKS = {
    flame: { stat: 'damage', pct: 3 }, shadow: { stat: 'rate', pct: 5 }, celestial: { stat: 'charge', pct: 8 },
    warlord: { stat: 'gold', pct: 3 }, lava: { stat: 'damage', pct: 5 }, titan: { stat: 'luck', pct: 8 },
    pirate: { stat: 'gold', pct: 3 }, toxic: { stat: 'timed', pct: 5 }, king: { stat: 'gold', pct: 8 }
};
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
