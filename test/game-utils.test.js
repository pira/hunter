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
    it('computes the cumulative score thresholds for leveling', () => {
        assert.equal(GameUtils.calculateLevelThreshold(1), 20);
        assert.equal(GameUtils.calculateLevelThreshold(2), 50);
        assert.equal(GameUtils.calculateLevelThreshold(3), 90);
        assert.equal(GameUtils.calculateLevelThreshold(10), 650);
    });

    it('throws for invalid levels', () => {
        assert.throws(() => GameUtils.calculateLevelThreshold(0), RangeError);
        assert.throws(() => GameUtils.calculateLevelThreshold(1.5), RangeError);
        assert.throws(() => GameUtils.calculateLevelThreshold(-3), RangeError);
    });
});
