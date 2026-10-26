// Meta shop catalog: pets, eggs, skins, gem prices. Must match js/config-data.js
// (test/catalog.test.mjs checks that they do).

// Pets are collected in the profile. They hatch from eggs (bought for gold or dropped by bosses),
// three of a kind and tier merge into one of the next tier for gems, and the ones in the pet slots
// come along on hunts (one slot at first; more can be unlocked).
export const PETS = ['turtle', 'bees', 'eagle', 'frog', 'donkey', 'squirrel', 'bunny'];
export const MERGE_GEMS = [0, 0, 2, 5, 15]; // gems to merge 3 × tier-1 into one of this tier (2..4)
export const MAX_SLOTS = 4;
export const SLOT_UNLOCK = [null, null, { gold: 1000 }, { gems: 100 }, { gems: 1000 }]; // price of slot n
export const petKey = (id, tier) => `${id}_${tier}`;

// Pet levels (v3.7): feed gold to a kind of pet (all its tiers) for +5% a level, up to level 10.
// FEED_COST[n] = gold to go from level n to n + 1.
export const PET_LEVEL_MAX = 10;
export const PET_LEVEL_BONUS = 0.05;
export const FEED_COST = [500, 900, 1600, 2900, 5200, 9400, 17000, 30000, 55000, 100000];

// Eggs: the hatchery warms one egg per nest. Hatching takes a night; gems can hurry it.
export const EGG_PRICE = 1000; // gold
export const NESTS = 1; // nests everyone has
export const MAX_NESTS = 2;
export const NEST_UNLOCK = [null, null, { gold: 15000 }]; // price of nest n
export const HATCH_MS = 6 * 3600 * 1000;
export const HURRY_GEMS_PER_HOUR = 1;
// tier odds in % (basic, rare, legendary, mythic)
// one kind of egg, whether bought or dropped by a boss
export const EGG_ODDS = [80, 16, 3.5, 0.5];

// v3.2 artefacts are gone: owned ones were turned back into what they cost.
export const ART_REFUND_GOLD = [0, 1000, 3000, 9000, 27000];
export const ART_REFUND_GEMS = [0, 0, 2, 11, 48];

// Skins: basic/rare cost gold, legendary/mythic cost gems.
export const SKIN_PRICES = { basic: { gold: 300 }, rare: { gold: 2000 }, legendary: { gems: 25 }, mythic: { gems: 60 } };
export const SKINS = {
    frost: { cls: 'wizard', rarity: 'basic' },
    flame: { cls: 'wizard', rarity: 'rare' },
    shadow: { cls: 'wizard', rarity: 'legendary' },
    celestial: { cls: 'wizard', rarity: 'mythic' },
    viking: { cls: 'barbarian', rarity: 'basic' },
    warlord: { cls: 'barbarian', rarity: 'rare' },
    lava: { cls: 'barbarian', rarity: 'legendary' },
    titan: { cls: 'barbarian', rarity: 'mythic' },
    redcap: { cls: 'goblin', rarity: 'basic' },
    pirate: { cls: 'goblin', rarity: 'rare' },
    toxic: { cls: 'goblin', rarity: 'legendary' },
    king: { cls: 'goblin', rarity: 'mythic' }
};

export const CLASSES = ['wizard', 'barbarian', 'goblin'];

// Class mastery (v3.7): beating the boss of level 10, 20, 30 … with a class (= reaching level 11,
// 21, 31 …) gives that class a mastery tier. Must match GameUtils.masteryTier.
export const masteryTier = best => Math.max(0, Math.floor(((best || 0) - 1) / 10));
// A run that died after beating its tenth-level boss (level 10, 20 … with every boss so far, one per
// 5 levels) counts as reaching the next level.
export const reachedLevel = (level, bosses) => (level % 10 === 0 && (bosses || 0) >= level / 5 ? level + 1 : level);
// Difficulty (v3.15): Mastery I unlocks Hard (2), Mastery II Hell (3); a run on it has ×2/×3 monster HP
// and drops. Must match GameUtils.maxDifficulty.
export const maxDifficulty = best => Math.min(3, 1 + masteryTier(best));
export const WHEEL_WIN = 0.5; // chance to double the pot; at 0.5 average gold is unchanged
