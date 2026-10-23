import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as server from '../leaderboard/lambda/catalog.mjs';

// Evaluate the client's data tables (classic script) and compare with the server catalog.
const src = readFileSync(new URL('../js/config-data.js', import.meta.url), 'utf8');
const client = new Function('GameUtils', `${src}; return { PETS, MERGE_GEMS, MAX_SLOTS, SLOT_UNLOCK, EGG_PRICE, NESTS, HATCH_MS, HURRY_GEMS_PER_HOUR, EGG_ODDS, SKINS, SKIN_PRICES };`)({});

describe('meta catalog: client and server agree', () => {
    it('has the same egg, nest, merge and slot numbers', () => {
        for (const k of ['MERGE_GEMS', 'MAX_SLOTS', 'SLOT_UNLOCK', 'EGG_PRICE', 'NESTS', 'HATCH_MS', 'HURRY_GEMS_PER_HOUR', 'EGG_ODDS']) assert.deepEqual(client[k], server[k], k);
    });
    it('has the same pets', () => {
        assert.deepEqual(Object.keys(client.PETS).sort(), [...server.PETS].sort());
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
