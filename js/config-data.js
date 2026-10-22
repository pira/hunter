/* Monster Hunter — shared constants and data tables (loaded first, before js/core.js). */
const GameMath = typeof GameUtils !== 'undefined' ? GameUtils : null;

if (!GameMath) {
    throw new Error('GameUtils must be loaded before game.js');
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

const WEAPONS = {
    bullets: { name: 'Blaster', icon: '🔫' },
    sword: { name: 'Blade', icon: '🗡️' },
    grenades: { name: 'Grenades', icon: '💣' },
    missiles: { name: 'Missiles', icon: '🚀' }
};
const START_WEAPONS = ['bullets', 'sword']; // grenades + missiles are bought in the shop
const WEAPON_ORDER = ['bullets', 'sword', 'grenades', 'missiles'];

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
// [chance, min, max] coins dropped per kill
const COIN_DROPS = {
    small: [0.3, 1, 1], medium: [0.45, 1, 2], large: [0.8, 2, 4], elite: [1, 3, 5],
    legendary: [1, 4, 6], mythic: [1, 6, 9], ancient: [1, 9, 13], ultimate: [1, 18, 28]
};

const POWERUPS = {
    multiShot: { emoji: '🏹', name: 'Multi-Shot', color: '#FF69B4', timed: true, weight: 1 },
    rapidFire: { emoji: '⚡', name: 'Rapid Fire', color: '#00CED1', timed: true, weight: 1 },
    invincible: { emoji: '🛡️', name: 'Invincible', color: '#7CFC00', timed: true, weight: 0.7 },
    freeze: { emoji: '❄️', name: 'Freeze', color: '#87CEEB', timed: true, weight: 0.8 },
    coins2: { emoji: '🪙', tag: '×2', name: 'Coins ×2', color: '#FFC300', timed: true, weight: 0.8 },
    coins3: { emoji: '🪙', tag: '×3', name: 'Coins ×3', color: '#FF8C00', timed: true, weight: 0.4 },
    heart: { emoji: '❤️', name: 'Extra Life', color: '#FF1493', weight: 1 },
    bomb: { emoji: '💣', name: 'Bomb', color: '#FF4500', weight: 0.8 }
};
const TIMED_POWERUPS = ['multiShot', 'rapidFire', 'invincible', 'freeze', 'coins2', 'coins3'];

// Shop cards. Price = cost × (1 + 0.75 × rank already owned).
const UPGRADES = [
    { id: 'unlock_grenades', icon: '💣', name: 'Grenades', max: 1, cost: 30, unlocks: 'grenades', minLevel: 3, weight: 2.5, desc: 'Unlock lobbed grenades (slot 3)' },
    { id: 'unlock_missiles', icon: '🚀', name: 'Missiles', max: 1, cost: 50, unlocks: 'missiles', minLevel: 6, weight: 2.5, desc: 'Unlock homing missiles (slot 4)' },
    { id: 'power', icon: '💪', name: 'Power', max: 5, cost: 15, desc: '+20% damage with every weapon' },
    { id: 'haste', icon: '⏱️', name: 'Haste', max: 5, cost: 15, desc: '+15% attack speed' },
    { id: 'boots', icon: '👟', name: 'Swift Boots', max: 4, cost: 10, desc: '+10% move speed' },
    { id: 'vitality', icon: '❤️', name: 'Vitality', max: 3, cost: 25, desc: '+1 max heart and heal 1' },
    { id: 'crit', icon: '🎯', name: 'Keen Eye', max: 4, cost: 15, desc: '+8% chance to crit for 2.5× damage' },
    { id: 'streak', icon: '🔥', name: 'Hot Streak', max: 3, cost: 10, desc: 'Combo timer lasts 0.6s longer' },
    { id: 'luck', icon: '🍀', name: 'Lucky Charm', max: 3, cost: 12, desc: '+30% powerup and coin drops' },
    { id: 'magnet', icon: '🧲', name: 'Magnet', max: 3, cost: 10, desc: 'Pull coins and pickups from further away' },
    { id: 'overtime', icon: '⌛', name: 'Overtime', max: 3, cost: 12, desc: 'Powerups last 30% longer (cap 30s)' },
    { id: 'regen', icon: '🌿', name: 'Regeneration', max: 2, cost: 25, desc: 'Regrow a heart every 40s (25s at rank 2)' },
    { id: 'nova', icon: '💫', name: 'Static Nova', max: 2, cost: 20, desc: 'Taking a hit blasts nearby monsters' },
    { id: 'split', icon: '🔱', name: 'Split Shot', max: 3, cost: 18, weapon: 'bullets', desc: 'Blaster fires +1 bullet' },
    { id: 'pierce', icon: '🏹', name: 'Piercing Rounds', max: 3, cost: 15, weapon: 'bullets', desc: 'Bullets pierce +1 monster' },
    { id: 'reach', icon: '📏', name: 'Long Blade', max: 3, cost: 12, weapon: 'sword', desc: '+25% stab reach' },
    { id: 'quick', icon: '💨', name: 'Quick Thrust', max: 3, cost: 15, weapon: 'sword', desc: '+25% stab speed' },
    { id: 'heavy', icon: '🪓', name: 'Heavy Edge', max: 3, cost: 20, weapon: 'sword', desc: 'First stab hits ×2 harder (10 → 20 → 40 → 80)' },
    { id: 'cluster', icon: '🧨', name: 'Cluster Bombs', max: 3, cost: 18, weapon: 'grenades', desc: '+1 grenade per throw (max 4)' },
    { id: 'blast', icon: '💥', name: 'Big Bang', max: 3, cost: 15, weapon: 'grenades', desc: '+30% blast radius' },
    { id: 'swarm', icon: '🎇', name: 'Swarm', max: 2, cost: 25, weapon: 'missiles', desc: '+1 missile per salvo (max 3)' }
];
// One-level buffs: always on sale (also once every permanent card is maxed). Last until the next level-up.
const LEVEL_BUFFS = [
    { id: 'xp2', icon: '📘', name: 'Double XP', buff: true, max: Infinity, cost: 18, share: 0.35, weight: 0.6, desc: 'This level: ×2 XP' },
    { id: 'gold2', icon: '💰', name: 'Double Gold', buff: true, max: Infinity, cost: 15, share: 0.3, weight: 0.6, desc: 'This level: ×2 coins' },
    { id: 'dmg2', icon: '🗡️', name: 'Double Damage', buff: true, max: Infinity, cost: 25, share: 0.5, weight: 0.6, desc: 'This level: ×2 damage' },
    { id: 'slow', icon: '🐌', name: 'Slow Mobs', buff: true, max: Infinity, cost: 20, share: 0.4, weight: 0.6, desc: 'This level: monsters 40% slower' },
    { id: 'feast', icon: '🍖', name: 'Feast', max: Infinity, cost: 15, share: 0.25, weight: 0.4, desc: 'Fully heal' }
];
// Blade: one sword that stabs at the nearest monster; damage doubles with every consecutive hit.
const STAB = { reach: 80, out: 5, back: 5, cooldown: 10, baseDamage: 10, maxDoublings: 9, chainFrames: 100 };

const BOSSES = [
    { name: 'Bonecrusher', title: 'The Juggernaut', color: '#C0392B', accent: '#F5B041', size: 40, hp: 60, speed: 0.9, pattern: 'charge' },
    { name: 'Hexweaver', title: 'Witch of the Ninth Moon', color: '#7D3C98', accent: '#F4D03F', size: 36, hp: 60, speed: 1.1, pattern: 'rings' },
    { name: 'Broodmother', title: 'Queen of the Swarm', color: '#1E8449', accent: '#ABEBC6', size: 46, hp: 80, speed: 0.6, pattern: 'summon' },
    { name: 'Voidmaw', title: 'Devourer of Light', color: '#1B2631', accent: '#E74C3C', size: 44, hp: 110, speed: 1.0, pattern: 'chaos' }
];
