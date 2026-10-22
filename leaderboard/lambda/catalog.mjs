// Meta shop catalog: artefacts, skins, gem prices. Must match js/config-data.js
// (test/catalog.test.mjs checks that they do).

// Artefacts are collected items. Only basic ones are sold (gold) or won (the rare in-run artefact
// card); three of a tier merge into one of the next tier for gems. Up to 4 different artefacts sit
// in the profile's slots and are the ones active in runs.
export const ARTEFACTS = ['greed', 'whetstone', 'rune', 'shard', 'boots', 'idol', 'charm', 'hourglass', 'amulet'];
export const ARTEFACT_PRICE = 1000; // gold, basic tier
export const MERGE_GEMS = [0, 0, 2, 5, 15]; // gems to merge 3 × tier-1 into one of this tier (2..4)
export const MAX_SLOTS = 4;
export const artKey = (id, tier) => `${id}_${tier}`;

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
export const WHEEL_WIN = 0.5; // chance to double the pot; at 0.5 average gold is unchanged
