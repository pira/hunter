import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as server from '../leaderboard/lambda/catalog.mjs';

// Evaluate the client's data tables (classic script) and compare with the server catalog.
const src = readFileSync(new URL('../js/config-data.js', import.meta.url), 'utf8');
const client = new Function('GameUtils', `${src}; return { ARTEFACTS, ARTEFACT_PRICE, MERGE_GEMS, MAX_SLOTS, SKINS, SKIN_PRICES };`)({});

describe('meta catalog: client and server agree', () => {
    it('has the same artefact price, merge costs and slot count', () => {
        assert.equal(client.ARTEFACT_PRICE, server.ARTEFACT_PRICE);
        assert.deepEqual(client.MERGE_GEMS, server.MERGE_GEMS);
        assert.equal(client.MAX_SLOTS, server.MAX_SLOTS);
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
