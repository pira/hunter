const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const GameUtils = require('../game-utils.js');

describe('GameUtils.distanceSquared', () => {
    it('returns the squared distance between two points', () => {
        assert.equal(GameUtils.distanceSquared(0, 0, 3, 4), 25);
        assert.equal(GameUtils.distanceSquared(-2, 5, 1, 1), 25);
    });
});

describe('GameUtils.isWithinRadius', () => {
    it('detects points inside the radius (inclusive)', () => {
        assert.equal(GameUtils.isWithinRadius(0, 0, 3, 4, 5), true);
        assert.equal(GameUtils.isWithinRadius(0, 0, 2, 0, 2), true);
    });

    it('detects points outside the radius', () => {
        assert.equal(GameUtils.isWithinRadius(0, 0, 6, 0, 5), false);
    });
});

describe('GameUtils.normalizeVector', () => {
    it('normalizes non-zero vectors', () => {
        const normalized = GameUtils.normalizeVector(3, 4);
        assert.ok(Math.abs(normalized.x - 0.6) < 1e-10);
        assert.ok(Math.abs(normalized.y - 0.8) < 1e-10);
    });

    it('returns zero vector when input is zero', () => {
        const normalized = GameUtils.normalizeVector(0, 0);
        assert.equal(normalized.x, 0);
        assert.equal(normalized.y, 0);
    });
});

describe('GameUtils.calculateLevelThreshold', () => {
    it('computes the cumulative XP thresholds for leveling', () => {
        assert.equal(GameUtils.calculateLevelThreshold(1), 90);
        assert.equal(GameUtils.calculateLevelThreshold(2), 270);
        assert.equal(GameUtils.calculateLevelThreshold(3), 560);
        assert.equal(GameUtils.calculateLevelThreshold(10), 6690);
    });

    it('grows strictly with level', () => {
        for (let level = 1; level < 60; level++) {
            assert.ok(GameUtils.xpToNextLevel(level + 1) > GameUtils.xpToNextLevel(level));
        }
    });

    it('throws for invalid levels', () => {
        assert.throws(() => GameUtils.calculateLevelThreshold(0), RangeError);
        assert.throws(() => GameUtils.calculateLevelThreshold(1.5), RangeError);
        assert.throws(() => GameUtils.calculateLevelThreshold(-3), RangeError);
    });
});

describe('GameUtils.levelForScore', () => {
    it('inverts calculateLevelThreshold', () => {
        assert.equal(GameUtils.levelForScore(0), 1);
        assert.equal(GameUtils.levelForScore(89), 1);
        assert.equal(GameUtils.levelForScore(90), 2);
        for (let level = 1; level < 40; level++) {
            const threshold = GameUtils.calculateLevelThreshold(level);
            assert.equal(GameUtils.levelForScore(threshold), level + 1);
            assert.equal(GameUtils.levelForScore(threshold - 1), level);
        }
    });

    it('treats bad input as level 1', () => {
        assert.equal(GameUtils.levelForScore(-5), 1);
        assert.equal(GameUtils.levelForScore(NaN), 1);
    });
});

describe('GameUtils.comboMultiplier', () => {
    it('maps combo counts to multiplier tiers', () => {
        assert.equal(GameUtils.comboMultiplier(0), 1);
        assert.equal(GameUtils.comboMultiplier(4), 1);
        assert.equal(GameUtils.comboMultiplier(5), 2);
        assert.equal(GameUtils.comboMultiplier(14), 2);
        assert.equal(GameUtils.comboMultiplier(15), 3);
        assert.equal(GameUtils.comboMultiplier(30), 4);
        assert.equal(GameUtils.comboMultiplier(50), 5);
        assert.equal(GameUtils.comboMultiplier(500), 5);
    });

    it('reports the next tier threshold', () => {
        assert.equal(GameUtils.nextComboTier(0), 5);
        assert.equal(GameUtils.nextComboTier(5), 15);
        assert.equal(GameUtils.nextComboTier(49), 50);
        assert.equal(GameUtils.nextComboTier(50), null);
    });
});

describe('GameUtils.isBossLevel', () => {
    it('flags every fifth level', () => {
        assert.deepEqual([1, 4, 5, 9, 10, 15, 21].map(GameUtils.isBossLevel), [false, false, true, false, true, true, false]);
    });
});

describe('GameUtils.spawnInterval', () => {
    it('shrinks with level but never below the floor', () => {
        assert.equal(GameUtils.spawnInterval(1), 1.4);
        assert.ok(GameUtils.spawnInterval(10) < GameUtils.spawnInterval(5));
        assert.equal(GameUtils.spawnInterval(200), 0.22);
    });
});

describe('GameUtils.sanitizeName', () => {
    it('trims, collapses whitespace, strips markup and control characters', () => {
        assert.equal(GameUtils.sanitizeName('  Pira   the  Great '), 'Pira the Great');
        assert.equal(GameUtils.sanitizeName('<b>x</b>'), 'bx/b');
        assert.equal(GameUtils.sanitizeName('a\u0000b\nc'), 'abc');
    });

    it('clamps length and rejects non-strings', () => {
        assert.equal(GameUtils.sanitizeName('x'.repeat(40)).length, 16);
        assert.equal(GameUtils.sanitizeName(null), '');
    });
});

describe('GameUtils.pickWeightedUnique', () => {
    it('returns distinct items up to the requested count', () => {
        const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
        const picked = GameUtils.pickWeightedUnique(items, 3);
        assert.equal(picked.length, 3);
        assert.equal(new Set(picked).size, 3);
        assert.equal(GameUtils.pickWeightedUnique(items.slice(0, 2), 3).length, 2);
    });

    it('respects weights', () => {
        const items = [{ id: 'never', weight: 0 }, { id: 'always', weight: 1 }];
        for (let i = 0; i < 50; i++) {
            assert.equal(GameUtils.pickWeighted(items).id, 'always');
        }
    });
});

describe('GameUtils.formatTime / angleDelta', () => {
    it('formats seconds as m:ss', () => {
        assert.equal(GameUtils.formatTime(0), '0:00');
        assert.equal(GameUtils.formatTime(75.9), '1:15');
    });

    it('returns the shortest signed angle difference', () => {
        assert.ok(Math.abs(GameUtils.angleDelta(0, Math.PI / 2) - Math.PI / 2) < 1e-9);
        assert.ok(Math.abs(GameUtils.angleDelta(0.1, Math.PI * 2 - 0.1) + 0.2) < 1e-9);
    });
});

describe('GameUtils v3 helpers', () => {
    it('scales monster HP by 30% every 6 levels', () => {
        assert.equal(GameUtils.hpScale(1), 1);
        assert.equal(GameUtils.hpScale(6), 1);
        assert.equal(GameUtils.hpScale(7), 1.3);
        assert.ok(Math.abs(GameUtils.hpScale(13) - 1.6) < 1e-9);
    });

    it('charges the super meter and caps it at 100', () => {
        assert.equal(GameUtils.superCharge(0, 2), 2);
        assert.equal(GameUtils.superCharge(90, 25), 100);
        assert.equal(GameUtils.superCharge(10, 5, 1.1), 15.5);
    });

    it('decays storm damage per chain jump', () => {
        assert.equal(GameUtils.stormDamage(1, 0), 6);
        assert.ok(Math.abs(GameUtils.stormDamage(1, 2) - 6 * 0.65 * 0.65) < 1e-9);
        assert.ok(Math.abs(GameUtils.stormDamage(7, 0, 6, 0.65, 2) - 6 * 1.3 * 2) < 1e-9);
    });
});

describe('GameUtils level flow', () => {
    it('grows the level damage target', () => {
        assert.equal(GameUtils.levelDamage(1), 70);
        assert.ok(GameUtils.levelDamage(10) > GameUtils.levelDamage(9));
        assert.equal(GameUtils.levelDamage(7), Math.round(70 * 2.8 * 1.3));
    });

    it('schedules encounters per D4', () => {
        assert.equal(GameUtils.encounterKind(5), 'smallBoss');
        assert.equal(GameUtils.encounterKind(15), 'smallBoss');
        assert.equal(GameUtils.encounterKind(10), 'bigBoss');
        assert.equal(GameUtils.encounterKind(100), 'bigBoss');
        assert.equal(GameUtils.encounterKind(7), 'regular');
    });
});

describe('GameUtils economy', () => {
    it('scales coin drops with monster HP and never drops nothing', () => {
        assert.equal(GameUtils.coinDrop(1, 1, 0.8), 1);
        assert.equal(GameUtils.coinDrop(3, 7, 1), 4);
        assert.equal(GameUtils.coinDrop(0.2, 1, 1), 1);
    });

    it('prices permanent cards statically per rank and one-level cards by income', () => {
        const perm = { cost: 20 };
        assert.equal(GameUtils.cardPrice(perm, 0, 100), 60);
        assert.equal(GameUtils.cardPrice(perm, 2, 100), 150);
        const buff = { cost: 10, share: 0.3 };
        assert.equal(GameUtils.cardPrice(buff, 0, 100, 50), 30);
        assert.equal(GameUtils.cardPrice(buff, 0, 100, 200), 60);
        assert.equal(GameUtils.cardPrice(buff, 0, 10, 0), 10);
    });

    it('expects more income on later levels', () => {
        assert.ok(GameUtils.expectedIncome(10) > GameUtils.expectedIncome(1));
    });
});

describe('GameUtils.dealCards', () => {
    const perm = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const one = [{ id: 'f1', group: 'freeze' }, { id: 'f2', group: 'freeze' }, { id: 'g' }];
    it('always mixes permanent and one-level cards when both exist', () => {
        for (let i = 0; i < 200; i++) {
            const hand = GameUtils.dealCards(perm, one, 3);
            assert.equal(hand.length, 3);
            assert.ok(hand.some(c => perm.includes(c)));
            assert.ok(hand.some(c => one.includes(c)));
            assert.ok(!(hand.some(c => c.id === 'f1') && hand.some(c => c.id === 'f2')));
            assert.equal(new Set(hand).size, 3);
        }
    });
    it('falls back to one kind when the other is empty', () => {
        assert.equal(GameUtils.dealCards([], one, 3).length, 2);
        assert.equal(GameUtils.dealCards(perm, [], 3).length, 3);
    });
});
