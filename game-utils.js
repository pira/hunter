(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.GameUtils = factory();
    }
})(typeof self !== 'undefined' ? self : this, function () {
    function distanceSquared(x1, y1, x2, y2) {
        const dx = x1 - x2;
        const dy = y1 - y2;
        return dx * dx + dy * dy;
    }

    function isWithinRadius(x1, y1, x2, y2, radius) {
        const radiusSquared = radius * radius;
        return distanceSquared(x1, y1, x2, y2) <= radiusSquared;
    }

    function vectorMagnitude(dx, dy) {
        return Math.hypot(dx, dy);
    }

    function normalizeVector(dx, dy) {
        const magnitude = vectorMagnitude(dx, dy);
        if (magnitude === 0) {
            return { x: 0, y: 0 };
        }
        return { x: dx / magnitude, y: dy / magnitude };
    }

    function clamp(value, min, max) {
        return value < min ? min : value > max ? max : value;
    }

    function lerp(a, b, t) {
        return a + (b - a) * t;
    }

    /** XP needed to go from `level` to `level + 1` (rounded to 10s). */
    function xpToNextLevel(level) {
        return Math.round((60 * Math.pow(level, 1.35) + 30) / 10) * 10;
    }

    /** Total XP needed to advance from `level` to `level + 1` (cumulative). */
    function calculateLevelThreshold(level) {
        if (!Number.isInteger(level) || level < 1) {
            throw new RangeError('level must be a positive integer');
        }
        let total = 0;
        for (let i = 1; i <= level; i++) {
            total += xpToNextLevel(i);
        }
        return total;
    }

    /** The level a given XP total corresponds to. Inverse of calculateLevelThreshold. */
    function levelForScore(xp) {
        if (!Number.isFinite(xp) || xp < 0) {
            return 1;
        }
        let level = 1;
        while (xp >= calculateLevelThreshold(level)) {
            level++;
        }
        return level;
    }

    /** Combo multiplier tiers: 0-4 → x1, 5-14 → x2, 15-29 → x3, 30-49 → x4, 50+ → x5. */
    const COMBO_TIERS = [0, 5, 15, 30, 50];

    function comboMultiplier(combo) {
        let multiplier = 1;
        for (let i = 1; i < COMBO_TIERS.length; i++) {
            if (combo >= COMBO_TIERS[i]) {
                multiplier = i + 1;
            }
        }
        return multiplier;
    }

    /** Kills needed to reach the next combo tier, or null when maxed. */
    function nextComboTier(combo) {
        for (let i = 1; i < COMBO_TIERS.length; i++) {
            if (combo < COMBO_TIERS[i]) {
                return COMBO_TIERS[i];
            }
        }
        return null;
    }

    /** Seconds between regular monster spawns at a given level. */
    function spawnInterval(level) {
        return Math.max(0.22, 1.4 * Math.pow(0.935, level - 1));
    }

    /** Bosses arrive every 5 levels. */
    function isBossLevel(level) {
        return Number.isInteger(level) && level > 0 && level % 5 === 0;
    }

    /** Trim, strip control/markup characters and clamp length of a player name. */
    function sanitizeName(name, maxLength = 16) {
        if (typeof name !== 'string') {
            return '';
        }
        return name
            .replace(/[\u0000-\u001F\u007F<>]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, maxLength);
    }

    /** Pick an item from `items` using each item's `weight` (default 1). */
    function pickWeighted(items, rng = Math.random) {
        const total = items.reduce((sum, item) => sum + (item.weight ?? 1), 0);
        if (total <= 0) {
            return null;
        }
        let roll = rng() * total;
        for (const item of items) {
            roll -= item.weight ?? 1;
            if (roll < 0) {
                return item;
            }
        }
        return items[items.length - 1];
    }

    /** Pick up to `count` distinct items by weight. */
    function pickWeightedUnique(items, count, rng = Math.random) {
        const pool = items.slice();
        const picked = [];
        while (picked.length < count && pool.length > 0) {
            const item = pickWeighted(pool, rng);
            picked.push(item);
            pool.splice(pool.indexOf(item), 1);
        }
        return picked;
    }

    function formatTime(totalSeconds) {
        const seconds = Math.max(0, Math.floor(totalSeconds));
        const minutes = Math.floor(seconds / 60);
        return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
    }

    /** Smallest signed difference between two angles (radians). */
    function angleDelta(from, to) {
        let delta = (to - from) % (Math.PI * 2);
        if (delta > Math.PI) delta -= Math.PI * 2;
        if (delta < -Math.PI) delta += Math.PI * 2;
        return delta;
    }

    /** Monster HP multiplier at a level (+30% every 6 levels). */
    function hpScale(level) {
        return 1 + Math.floor((Math.max(1, level) - 1) / 6) * 0.3;
    }

    /** Super meter gain for a kill: table value × multiplier, never above what is left to 100. */
    function superCharge(meter, tierCharge, mult = 1) {
        return Math.min(100, meter + Math.max(0, tierCharge) * mult);
    }

    /** Storm chain-lightning damage at a jump index (0 = first target). */
    function stormDamage(level, jump, base = 6, falloff = 0.65, damageMult = 1) {
        return base * hpScale(level) * damageMult * Math.pow(falloff, jump);
    }

    /** Effective damage that fills the level bar (~60 s of fighting at par skill). */
    function levelDamage(level) {
        const L = Math.max(1, level);
        return Math.round(70 * (1 + 0.3 * (L - 1)) * hpScale(L));
    }

    /** Encounter at the end of a level: big boss every 10, small boss at 5/15/25…, else gatekeeper/wave. */
    function encounterKind(level) {
        if (level % 10 === 0) return 'bigBoss';
        if (level % 10 === 5) return 'smallBoss';
        return 'regular';
    }

    /** Coins dropped by a kill: tier base × monster HP scale × random factor (0.8–1.2), at least 1. */
    function coinDrop(tierBase, level, rand = 1) {
        return Math.max(1, Math.round(tierBase * hpScale(level) * rand));
    }

    /**
     * Price of a shop card.
     * Permanent (whole run): cost × 3 × (1 + 0.75 × rank owned) — a finite sink that doesn't inflate.
     * One level: `cost` is the price on the first levels, rising +8% of it per level up to ×5 at
     * level 52 (Freeze I: 20 → ~100), rounded to 5.
     */
    const PERMANENT_PRICE_MULT = 3;
    function oneLevelScale(level) {
        return Math.min(5, 1 + 0.08 * Math.max(0, level - 2));
    }
    function cardPrice(card, rank, level = 2) {
        if (card.oneLevel) return Math.max(5, Math.round((card.cost * oneLevelScale(level)) / 5) * 5);
        return Math.round(card.cost * PERMANENT_PRICE_MULT * (1 + 0.75 * rank));
    }

    /** Coins a player can expect to earn during a level (kills + level bonus + encounter loot). */
    function expectedIncome(level) {
        return Math.round(0.7 * levelDamage(level) + 10 + 2 * level);
    }

    /**
     * Deals `count` shop cards: at least one permanent and one one-level card when both exist,
     * never two cards of the same `group` (e.g. Freeze I and II), the rest weighted at random.
     */
    function dealCards(permanent, oneLevel, count = 3, rng = Math.random) {
        const hand = [];
        const take = item => {
            if (!item) return;
            hand.push(item);
        };
        const fits = item => !hand.includes(item) && !(item.group && hand.some(h => h.group === item.group));
        if (permanent.length) take(pickWeighted(permanent, rng));
        if (oneLevel.length) take(pickWeighted(oneLevel, rng));
        const rest = permanent.concat(oneLevel);
        while (hand.length < count) {
            const pool = rest.filter(fits);
            if (!pool.length) break;
            take(pickWeighted(pool, rng));
        }
        return hand.slice(0, count);
    }

    return {
        dealCards,
        coinDrop,
        cardPrice,
        expectedIncome,
        levelDamage,
        encounterKind,
        hpScale,
        superCharge,
        stormDamage,
        distanceSquared,
        isWithinRadius,
        vectorMagnitude,
        normalizeVector,
        clamp,
        lerp,
        xpToNextLevel,
        calculateLevelThreshold,
        levelForScore,
        COMBO_TIERS,
        comboMultiplier,
        nextComboTier,
        spawnInterval,
        isBossLevel,
        sanitizeName,
        pickWeighted,
        pickWeightedUnique,
        formatTime,
        angleDelta
    };
});
