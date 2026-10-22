import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as server from '../leaderboard/lambda/catalog.mjs';

// Evaluate the client's data tables (classic script) and compare with the server catalog.
const src = readFileSync(new URL('../js/config-data.js', import.meta.url), 'utf8');
const client = new Function('GameUtils', `${src}; return { TIERS, ARTEFACTS, SKINS, SKIN_PRICES };`)({});

describe('meta catalog: client and server agree', () => {
    it('has the same tier prices and gates', () => {
        for (let t = 1; t <= 4; t++) {
            assert.equal(client.TIERS[t].price, server.TIERS[t].price);
            assert.equal(client.TIERS[t].gate, server.TIERS[t].gate);
        }
    });
    it('has the same artefacts', () => {
        assert.deepEqual(Object.keys(client.ARTEFACTS).sort(), [...server.ARTEFACTS].sort());
    });
    it('has the same skins, classes, rarities and prices', () => {
        assert.deepEqual(Object.keys(client.SKINS).sort(), Object.keys(server.SKINS).sort());
        for (const [id, s] of Object.entries(server.SKINS)) {
            assert.equal(client.SKINS[id].cls, s.cls);
            assert.equal(client.SKINS[id].rarity, s.rarity);
        }
        assert.deepEqual(client.SKIN_PRICES, server.SKIN_PRICES);
    });
});
