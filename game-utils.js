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

    function calculateLevelThreshold(level) {
        if (!Number.isInteger(level) || level < 1) {
            throw new RangeError('level must be a positive integer');
        }

        const levelPlusOne = level + 1;
        const levelPlusTwo = level + 2;
        return 10 * ((levelPlusOne * levelPlusTwo) / 2 - 1);
    }

    return {
        distanceSquared,
        isWithinRadius,
        vectorMagnitude,
        normalizeVector,
        calculateLevelThreshold
    };
});
