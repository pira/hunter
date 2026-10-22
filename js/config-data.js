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
        name: 'Wizard', icon: '🧙', hearts: 3, speed: 4.4, primary: 'bolt', color: '#8b5cf6',
        weapon: 'Magic Bolt', blurb: 'Auto-aiming magic bolts', superName: 'Arcane Nova', superBlurb: 'Rings of giant piercing bolts'
    },
    barbarian: {
        name: 'Barbarian', icon: '🪓', hearts: 4, speed: 4.2, primary: 'cleave', color: '#f97316',
        weapon: 'Cleave', blurb: 'Huge axe swings hit everything in front', superName: 'Whirlwind', superBlurb: '5 s of invincible spinning havoc'
    },
    goblin: {
        name: 'Goblin', icon: '💣', hearts: 3, speed: 4.8, primary: 'grenade', color: '#22c55e',
        weapon: 'Grenades', blurb: 'Lobbed bombs with a big boom', superName: 'Bombardment', superBlurb: 'Bombs in all four directions'
    }
};
const CLASS_ORDER = ['wizard', 'barbarian', 'goblin'];
const PRIMARY = {
    bolt: { cooldown: 32, damage: 1, speed: 9, radius: 4.5 },
    cleave: { cooldown: 64, damage: 10, reach: 80, arc: (70 * Math.PI) / 180, swing: 12 },
    grenade: { cooldown: 96, damage: 8, radius: 32, range: 220, fuse: 64 }
};
// Super meter charge per kill (0–100). Gatekeeper/boss values are used by the encounter system.
const SUPER_CHARGE = { small: 2, medium: 3, large: 5, elite: 6, legendary: 10, mythic: 12, ancient: 15, ultimate: 25, gatekeeper: 35, boss: 100 };
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
// [chance, min, max] coins dropped per kill
const COIN_DROPS = {
    small: [0.3, 1, 1], medium: [0.45, 1, 2], large: [0.8, 2, 4], elite: [1, 3, 5],
    legendary: [1, 4, 6], mythic: [1, 6, 9], ancient: [1, 9, 13], ultimate: [1, 18, 28]
};

const POWERUPS = {
    storm: { emoji: '🌩️', name: 'Storm', color: '#7dd3fc', timed: true, weight: 0.8 },
    overcharge: { emoji: '🔋', name: 'Overcharge', color: '#facc15', weight: 0.5 },
    rapidFire: { emoji: '⚡', name: 'Rapid Fire', color: '#00CED1', timed: true, weight: 1 },
    invincible: { emoji: '🛡️', name: 'Invincible', color: '#7CFC00', timed: true, weight: 0.7 },
    freeze: { emoji: '❄️', name: 'Freeze', color: '#87CEEB', timed: true, weight: 0.8 },
    coins2: { emoji: '🪙', tag: '×2', name: 'Coins ×2', color: '#FFC300', timed: true, weight: 0.8 },
    coins3: { emoji: '🪙', tag: '×3', name: 'Coins ×3', color: '#FF8C00', timed: true, weight: 0.4 },
    heart: { emoji: '❤️', name: 'Extra Life', color: '#FF1493', weight: 1 },
    bomb: { emoji: '💣', name: 'Bomb', color: '#FF4500', weight: 0.8 }
};
const TIMED_POWERUPS = ['storm', 'rapidFire', 'invincible', 'freeze', 'coins2', 'coins3'];

// Shop cards. Price = cost × (1 + 0.75 × rank already owned).
const UPGRADES = [
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
    { id: 'impact', icon: '💥', name: 'Impact', max: 3, cost: 15, desc: '+15% bolt size, cleave reach and blast radius' },
    { id: 'split', icon: '🔱', name: 'Split Shot', max: 3, cost: 18, cls: 'wizard', desc: 'Bolts fire +1 projectile' },
    { id: 'pierce', icon: '🏹', name: 'Piercing Rounds', max: 3, cost: 15, cls: 'wizard', desc: 'Bolts pierce +1 monster' },
    { id: 'reach', icon: '📏', name: 'Long Reach', max: 3, cost: 12, cls: 'barbarian', desc: '+25% cleave reach' },
    { id: 'quick', icon: '💨', name: 'Quick Swing', max: 3, cost: 15, cls: 'barbarian', desc: '+25% swing speed' },
    { id: 'cluster', icon: '🧨', name: 'Cluster Bombs', max: 3, cost: 18, cls: 'goblin', desc: '+1 grenade per throw (max 4)' },
    { id: 'fuse', icon: '⏲️', name: 'Short Fuse', max: 3, cost: 15, cls: 'goblin', desc: 'Grenades burst 20% sooner and throw 10% faster' }
];
// One-level buffs: always on sale (also once every permanent card is maxed). Last until the next level-up.
const LEVEL_BUFFS = [
    { id: 'xp2', icon: '📘', name: 'Double XP', buff: true, max: Infinity, cost: 18, share: 0.35, weight: 0.6, desc: 'This level: ×2 XP' },
    { id: 'gold2', icon: '💰', name: 'Double Gold', buff: true, max: Infinity, cost: 15, share: 0.3, weight: 0.6, desc: 'This level: ×2 coins' },
    { id: 'dmg2', icon: '🗡️', name: 'Double Damage', buff: true, max: Infinity, cost: 25, share: 0.5, weight: 0.6, desc: 'This level: ×2 damage' },
    { id: 'slow', icon: '🐌', name: 'Slow Mobs', buff: true, max: Infinity, cost: 20, share: 0.4, weight: 0.6, desc: 'This level: monsters 40% slower' },
    { id: 'feast', icon: '🍖', name: 'Feast', max: Infinity, cost: 15, share: 0.25, weight: 0.4, desc: 'Fully heal' }
];

const BOSSES = [
    { name: 'Bonecrusher', title: 'The Juggernaut', color: '#C0392B', accent: '#F5B041', size: 40, hp: 60, speed: 0.9, pattern: 'charge' },
    { name: 'Hexweaver', title: 'Witch of the Ninth Moon', color: '#7D3C98', accent: '#F4D03F', size: 36, hp: 60, speed: 1.1, pattern: 'rings' },
    { name: 'Broodmother', title: 'Queen of the Swarm', color: '#1E8449', accent: '#ABEBC6', size: 46, hp: 80, speed: 0.6, pattern: 'summon' },
    { name: 'Voidmaw', title: 'Devourer of Light', color: '#1B2631', accent: '#E74C3C', size: 44, hp: 110, speed: 1.0, pattern: 'chaos' }
];
