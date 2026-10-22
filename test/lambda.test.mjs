import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createApp, sha256 } from '../leaderboard/lambda/app.mjs';
import { createFakeDb } from './fake-db.mjs';

const PID = '1b4e28ba-2fa1-4d2b-883f-0016d3cca427';
const SECRET = 'a'.repeat(43);

function setup(wrap = send => send) {
    const db = createFakeDb();
    let clock = 1_800_000_000_000;
    const app = createApp({ send: wrap(db.send, db), tokenSecret: 'test-secret', now: () => clock, random: randomBytes });
    const call = async (method, path, body, ip = '1.2.3.4', query) => {
        const res = await app({
            requestContext: { http: { method, sourceIp: ip } },
            rawPath: path,
            queryStringParameters: query,
            body: body ? JSON.stringify(body) : undefined
        });
        return { status: res.statusCode, body: JSON.parse(res.body) };
    };
    const startRun = async () => (await call('POST', '/run')).body.token;
    const advance = ms => { clock += ms; };
    return { db, call, startRun, advance };
}

const run = (extra = {}) => ({ name: 'Tester', score: 1200, level: 4, kills: 60, combo: 20, bosses: 0, duration: 120, ...extra });

describe('lambda: scores', () => {
    let t;
    beforeEach(() => { t = setup(); });

    it('accepts an anonymous run and ranks it', async () => {
        const token = await t.startRun();
        t.advance(130_000);
        const res = await t.call('POST', '/scores', { ...run(), token });
        assert.equal(res.status, 200);
        assert.equal(res.body.rank, 1);
        assert.equal(res.body.scores[0].name, 'Tester');
    });

    it('rejects a reused token', async () => {
        const token = await t.startRun();
        t.advance(130_000);
        assert.equal((await t.call('POST', '/scores', { ...run(), token })).status, 200);
        const again = await t.call('POST', '/scores', { ...run(), token });
        assert.equal(again.status, 409);
    });

    it('rejects runs longer than the token age', async () => {
        const token = await t.startRun();
        t.advance(10_000);
        const res = await t.call('POST', '/scores', { ...run({ duration: 120 }), token });
        assert.equal(res.status, 403);
    });

    it('rejects implausible levels', async () => {
        const token = await t.startRun();
        t.advance(130_000);
        const res = await t.call('POST', '/scores', { ...run({ level: 40 }), token });
        assert.equal(res.status, 422);
    });
});

describe('lambda: player profiles', () => {
    let t;
    beforeEach(() => { t = setup(); });

    async function submitAs(pid, secret, extra) {
        const token = await t.startRun();
        t.advance(130_000);
        return t.call('POST', '/scores', { ...run(extra), token, playerId: pid, secret });
    }

    it('claims a fresh id on first submit and accumulates stats', async () => {
        const a = await submitAs(PID, SECRET);
        assert.equal(a.status, 200);
        assert.equal(a.body.player.runs, 1);
        assert.equal(t.db.get(`player#${PID}`, 'meta').secretHash, sha256(SECRET));
        const b = await submitAs(PID, SECRET, { score: 2000, kills: 80 });
        assert.equal(b.status, 200);
        assert.equal(b.body.player.runs, 2);
        assert.equal(b.body.player.kills, 140);
        assert.equal(b.body.player.bestScore, 2000);
        assert.equal(b.body.scores[0].playerId, PID);
    });

    it('rejects a known uuid with the wrong secret', async () => {
        await submitAs(PID, SECRET);
        const forged = await submitAs(PID, 'b'.repeat(43));
        assert.equal(forged.status, 403);
        assert.equal(t.db.get(`player#${PID}`, 'meta').runs, 1);
    });

    it('never exposes the secret hash and lists recent runs newest first', async () => {
        await submitAs(PID, SECRET, { score: 500 });
        await submitAs(PID, SECRET, { score: 900 });
        const res = await t.call('GET', `/player/${PID}`);
        assert.equal(res.status, 200);
        assert.equal(res.body.player.secretHash, undefined);
        assert.deepEqual(res.body.runs.map(r => r.score), [900, 500]);
    });

    it('retries the optimistic lock when the profile changed underneath', async () => {
        let interfere = false;
        t = setup((send, db) => async (type, input) => {
            if (type === 'TransactWrite' && interfere) {
                interfere = false;
                const meta = db.items.get(`player#${PID}\u0000meta`);
                meta.version += 1; // a concurrent submit landed between our read and our write
                meta.runs += 1;
            }
            return send(type, input);
        });
        await submitAs(PID, SECRET);
        interfere = true;
        const res = await submitAs(PID, SECRET);
        assert.equal(res.status, 200);
        assert.equal(res.body.player.runs, 3);
    });

    it('renames with the right secret only', async () => {
        await submitAs(PID, SECRET);
        assert.equal((await t.call('POST', `/player/${PID}/name`, { secret: 'c'.repeat(43), name: 'Hacker' })).status, 403);
        const ok = await t.call('POST', `/player/${PID}/name`, { secret: SECRET, name: 'Hero' });
        assert.equal(ok.status, 200);
        assert.equal(ok.body.player.name, 'Hero');
    });

    it('404s for unknown players and 400s for bad ids', async () => {
        assert.equal((await t.call('GET', `/player/${PID}`)).status, 404);
        assert.equal((await t.call('GET', '/player/nope')).status, 400);
    });
});

describe('lambda: v3 board', () => {
    let t;
    beforeEach(() => { t = setup(); });
    const v3 = (extra = {}) => ({ ...run({ level: 5, duration: 120 }), board: 'v3', cls: 'wizard', coins: 40, ...extra });

    it('stores v3 runs on their own board with the class', async () => {
        const token = await t.startRun();
        t.advance(130_000);
        const res = await t.call('POST', '/scores', { ...v3(), token });
        assert.equal(res.status, 200);
        assert.equal(res.body.scores[0].cls, 'wizard');
        const classic = await t.call('GET', '/scores', null, '1.2.3.4', { limit: '10' });
        assert.equal(classic.body.scores.length, 0);
        const board = await t.call('GET', '/scores', null, '1.2.3.4', { limit: '10', board: 'v3' });
        assert.equal(board.body.scores.length, 1);
        assert.equal(board.body.scores[0].coins, undefined);
    });

    it('bounds the level by run length and validates the class', async () => {
        let token = await t.startRun();
        t.advance(130_000);
        assert.equal((await t.call('POST', '/scores', { ...v3({ level: 30 }), token })).status, 422);
        token = await t.startRun();
        t.advance(130_000);
        assert.equal((await t.call('POST', '/scores', { ...v3({ cls: 'ninja' }), token })).status, 400);
        token = await t.startRun();
        t.advance(130_000);
        assert.equal((await t.call('POST', '/scores', { ...v3({ coins: 999999 }), token })).status, 422);
    });
});

describe('lambda: banking, wheel and meta shop', () => {
    let t;
    let rolls;
    beforeEach(() => {
        rolls = [];
        t = setup();
    });
    // a fresh app whose wheel follows `rolls` (true = win)
    function rigged() {
        const db = t.db;
        let clock = 1_800_000_000_000;
        const app = createApp({ send: db.send, tokenSecret: 'test-secret', now: () => clock, random: randomBytes, wheel: () => rolls.shift() });
        const call = async (method, path, body) => {
            const res = await app({ requestContext: { http: { method, sourceIp: '9.9.9.9' } }, rawPath: path, body: body ? JSON.stringify(body) : undefined });
            return { status: res.statusCode, body: JSON.parse(res.body) };
        };
        return { call, advance: ms => { clock += ms; } };
    }
    async function finishRun(api, coins, extra = {}) {
        const token = (await api.call('POST', '/run')).body.token;
        api.advance(130_000);
        return api.call('POST', '/scores', { ...run({ level: 5 }), board: 'v3', cls: 'wizard', coins, token, playerId: PID, secret: SECRET, ...extra });
    }

    it('banks unspent gold at death and returns a pot', async () => {
        const api = rigged();
        const res = await finishRun(api, 120);
        assert.equal(res.status, 200);
        assert.equal(res.body.player.gold, 120);
        assert.deepEqual(res.body.pot, { id: res.body.pot.id, amount: 120, spins: 0, status: 'open' });
    });

    it('doubles on a win, loses it all on a loss, and refuses stale or closed spins', async () => {
        const api = rigged();
        const { pot } = (await finishRun(api, 100)).body;
        rolls.push(true);
        const won = await api.call('POST', `/player/${PID}/spin`, { secret: SECRET, pot: pot.id, spins: 0 });
        assert.equal(won.status, 200);
        assert.equal(won.body.win, true);
        assert.equal(won.body.gold, 200);
        assert.equal(won.body.pot.amount, 200);
        // double tap with the old spin count is rejected
        assert.equal((await api.call('POST', `/player/${PID}/spin`, { secret: SECRET, pot: pot.id, spins: 0 })).status, 409);
        rolls.push(false);
        const lost = await api.call('POST', `/player/${PID}/spin`, { secret: SECRET, pot: pot.id, spins: 1 });
        assert.equal(lost.body.win, false);
        assert.equal(lost.body.gold, 0);
        assert.equal(t.db.get(`player#${PID}`, 'meta').gold, 0);
        rolls.push(true);
        assert.equal((await api.call('POST', `/player/${PID}/spin`, { secret: SECRET, pot: pot.id, spins: 2 })).status, 409);
    });

    it('bank closes the pot; the wheel cannot be spun with a wrong secret', async () => {
        const api = rigged();
        const { pot } = (await finishRun(api, 80)).body;
        assert.equal((await api.call('POST', `/player/${PID}/spin`, { secret: 'z'.repeat(43), pot: pot.id, spins: 0 })).status, 403);
        const banked = await api.call('POST', `/player/${PID}/bank`, { secret: SECRET, pot: pot.id });
        assert.equal(banked.body.pot.status, 'banked');
        rolls.push(true);
        assert.equal((await api.call('POST', `/player/${PID}/spin`, { secret: SECRET, pot: pot.id, spins: 0 })).status, 409);
    });

    it('buys basic artefacts for gold, merges three into the next tier for gems, and slots them', async () => {
        const api = rigged();
        await finishRun(api, 1500, { gems: 3, artCards: ['greed'] });
        const p = `/player/${PID}`;
        const buy = id => api.call('POST', `${p}/buy`, { secret: SECRET, item: 'artefact', id });
        const ok = await buy('greed');
        assert.equal(ok.status, 200);
        assert.equal(ok.body.player.arts.greed_1, 2);
        assert.deepEqual(ok.body.player.slots, ['greed_1']);
        assert.equal(ok.body.player.gold, 500);
        const merge = tier => api.call('POST', `${p}/merge`, { secret: SECRET, id: 'greed', tier });
        assert.equal((await merge(2)).status, 409); // only two
        await finishRun(api, 1500, { artCards: ['greed'] });
        const merged = await merge(2);
        assert.equal(merged.status, 200);
        assert.equal(merged.body.player.arts.greed_1, undefined);
        assert.equal(merged.body.player.arts.greed_2, 1);
        assert.equal(merged.body.player.gems, 1);
        assert.deepEqual(merged.body.player.slots, ['greed_2']);
        assert.equal((await merge(3)).status, 409);
        await buy('boots');
        const slots = s => api.call('POST', `${p}/slots`, { secret: SECRET, slots: s });
        assert.equal((await slots(['greed_2', 'boots_1'])).status, 200);
        assert.equal((await slots(['greed_2', 'greed_2'])).status, 400); // same artefact twice
        assert.equal((await slots(['rune_1'])).status, 403); // not owned
        assert.equal((await slots(['a_1', 'b_1', 'c_1', 'd_1', 'e_1'])).status, 400);
        assert.equal((await buy('rune')).status, 200);
        assert.equal((await buy('rune')).status, 409); // gold spent
        const pub = await api.call('GET', p);
        assert.deepEqual(pub.body.player.slots, ['greed_2', 'boots_1', 'rune_1']); // a new kind takes a free slot
        assert.equal(pub.body.player.secretHash, undefined);
    });

    it('caps gems and artefact cards per run', async () => {
        const api = rigged();
        assert.equal((await finishRun(api, 0, { gems: 500 })).status, 422);
        assert.equal((await finishRun(api, 0, { artCards: ['greed', 'greed', 'greed'] })).status, 422);
        assert.equal((await finishRun(api, 0, { artCards: ['nope'] })).status, 400);
    });

    it('upgrades P7 profiles: tier map becomes owned and slotted items', async () => {
        const api = rigged();
        await finishRun(api, 0);
        const m = t.db.get(`player#${PID}`, 'meta');
        delete m.arts; delete m.slots; delete m.gems;
        m.artefacts = { greed: 3, boots: 1 };
        await t.db.send('Put', { Item: m });
        const res = await finishRun(api, 0);
        assert.deepEqual(res.body.player.arts, { greed_3: 1, boots_1: 1 });
        assert.deepEqual(res.body.player.slots, ['greed_3', 'boots_1']);
        assert.equal(t.db.get(`player#${PID}`, 'meta').artefacts, undefined);
    });

    it('sets the public icon to an owned skin and filters the board by class', async () => {
        const api = rigged();
        await finishRun(api, 400);
        const icon = (cls, skin) => api.call('POST', `/player/${PID}/icon`, { secret: SECRET, cls, skin });
        assert.equal((await icon('wizard', 'frost')).status, 403);
        await api.call('POST', `/player/${PID}/buy`, { secret: SECRET, item: 'skin', id: 'frost' });
        assert.deepEqual((await icon('wizard', 'frost')).body.player.icon, { cls: 'wizard', skin: 'frost' });
        assert.equal((await icon('goblin', 'frost')).status, 400);
        // legendary skins cost gems
        assert.equal((await api.call('POST', `/player/${PID}/buy`, { secret: SECRET, item: 'skin', id: 'shadow' })).status, 409);
        const token = (await api.call('POST', '/run')).body.token;
        api.advance(130_000);
        await api.call('POST', '/scores', { ...run({ level: 5, score: 900 }), board: 'v3', cls: 'goblin', token });
        const res = await t.call('GET', '/scores', undefined, '1.2.3.4', { board: 'v3', cls: 'goblin' });
        assert.deepEqual(res.body.scores.map(s => s.cls), ['goblin']);
        const all = await t.call('GET', '/scores', undefined, '1.2.3.4', { board: 'v3' });
        assert.equal(all.body.scores.length, 2);
    });

    it('buys and equips skins; equipping needs ownership; the board shows the equipped skin', async () => {
        const api = rigged();
        await finishRun(api, 400);
        const eq = skin => api.call('POST', `/player/${PID}/equip`, { secret: SECRET, cls: 'wizard', skin });
        assert.equal((await eq('frost')).status, 403);
        const bought = await api.call('POST', `/player/${PID}/buy`, { secret: SECRET, item: 'skin', id: 'frost' });
        assert.equal(bought.status, 200);
        assert.equal(bought.body.player.gold, 100);
        assert.equal((await eq('frost')).status, 200);
        assert.equal((await eq('viking')).status, 400); // barbarian skin on a wizard
        const res = await finishRun(api, 0, { skin: 'celestial' });
        assert.equal(res.body.scores.find(s => s.playerId === PID && s.skin).skin, 'frost');
    });
});
