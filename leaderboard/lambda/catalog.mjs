// Meta shop catalog: artefacts and skins. Must match ARTEFACTS / SKINS in js/config-data.js
// (test/catalog.test.mjs checks that they do).

// Tier 1–4 = basic, rare, legendary, mythic. Price and the best level needed to buy each tier.
export const TIERS = [
    null,
    { name: 'basic', price: 1000, gate: 0 },
    { name: 'rare', price: 4000, gate: 10 },
    { name: 'legendary', price: 15000, gate: 20 },
    { name: 'mythic', price: 60000, gate: 30 }
];

export const ARTEFACTS = ['greed', 'whetstone', 'rune', 'shard', 'boots', 'idol', 'charm', 'hourglass', 'amulet'];

export const SKIN_PRICES = { basic: 300, rare: 2000, legendary: 8000, mythic: 30000 };
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

export const WHEEL_WIN = 0.5; // chance to double the pot; at 0.5 average gold is unchanged
