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

    it('renaming also renames the player on the leaderboards', async () => {
        await submitAs(PID, SECRET);
        await submitAs(PID, SECRET, { score: 2000 });
        const res = await t.call('POST', `/player/${PID}/name`, { secret: SECRET, name: 'Renamed' });
        assert.equal(res.status, 200);
        const board = await t.call('GET', '/scores');
        assert.deepEqual(board.body.scores.filter(s => s.playerId === PID).map(s => s.name), ['Renamed', 'Renamed']);
    });

    it('accepts a run that was paused for a long time (up to a week)', async () => {
        const token = await t.startRun();
        t.advance(3 * 24 * 3600 * 1000);
        const res = await t.call('POST', '/scores', { ...run(), token, playerId: PID, secret: SECRET });
        assert.equal(res.status, 200);
        const late = await t.startRun();
        t.advance(8 * 24 * 3600 * 1000);
        assert.equal((await t.call('POST', '/scores', { ...run(), token: late })).status, 403);
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
    let rngs;
    beforeEach(() => {
        rolls = [];
        rngs = [];
        t = setup();
    });
    // a fresh app whose wheel follows `rolls` (true = win)
    function rigged() {
        const db = t.db;
        let clock = 1_800_000_000_000;
        const app = createApp({ send: db.send, tokenSecret: 'test-secret', now: () => clock, random: randomBytes, wheel: () => rolls.shift(), rng: () => (rngs.length ? rngs.shift() : 0) });
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
        const prof = await api.call('GET', `/player/${PID}`);
        assert.equal(prof.body.runs[0].gold, 120);
        assert.equal(prof.body.runs[0].cls, 'wizard');
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

    it('buys eggs, warms one in the hatchery, hatches after the night (or now for gems)', async () => {
        const api = rigged();
        await finishRun(api, 1500, { gems: 3 });
        const p = `/player/${PID}`;
        const post = (route, body = {}) => api.call('POST', `${p}/${route}`, { secret: SECRET, ...body });
        const bought = await post('buy', { item: 'egg' });
        assert.equal(bought.status, 200);
        assert.equal(bought.body.player.eggs, 1);
        assert.equal(bought.body.player.gold, 500);
        assert.equal((await post('buy', { item: 'egg' })).status, 409); // gold spent
        const warm = await post('warm');
        assert.equal(warm.status, 200);
        const nest = warm.body.player.nests[0];
        assert.equal(warm.body.player.eggs, 0);
        assert.equal((await post('warm')).status, 409); // no eggs left
        assert.equal((await post('hatch', { nest: nest.id })).status, 409); // not ready
        api.advance(3 * 3600 * 1000 + 1);
        // hurry: 3 h left → 3 gems; rng picks pet index 0.5*7 → 'frog', tier roll 0.9 → rare (80 < 90 < 96)
        rngs.push(0.5, 0.9);
        const hurried = await post('hurry', { nest: nest.id });
        assert.equal(hurried.status, 200);
        assert.deepEqual(hurried.body.hatched, { id: 'frog', tier: 2 });
        assert.equal(hurried.body.player.gems, 0);
        assert.equal(hurried.body.player.pets.frog_2, 1);
        assert.deepEqual(hurried.body.player.petSlots, ['frog_2']); // the first pet goes into the free slot
        assert.equal(hurried.body.player.nests.length, 0);
    });

    it('hatches ready eggs for free, merges three pets, unlocks slots and slots pets', async () => {
        const api = rigged();
        await finishRun(api, 1520, { gems: 7 });
        const p = `/player/${PID}`;
        const post = (route, body = {}) => api.call('POST', `${p}/${route}`, { secret: SECRET, ...body });
        // three basic bee eggs straight into the profile (as if bought earlier)
        const m = t.db.get(`player#${PID}`, 'meta');
        await t.db.send('Put', { Item: { ...m, eggs: { gold: 3, boss: 1 }, gold: 1600 } }); // 3.3.0 shape: becomes 4 eggs
        assert.equal((await post('warm')).status, 200);
        assert.equal((await post('warm')).status, 409); // one hatchery
        assert.equal((await api.call('GET', p)).body.player.eggs, 3);
        let res;
        for (let i = 0; i < 3; i++) {
            if (i) await post('warm');
            api.advance(6 * 3600 * 1000);
            rngs.push(0.2, 0); // bees, basic
            const nest = (await api.call('GET', p)).body.player.nests[0];
            res = await post('hatch', { nest: nest.id });
            assert.equal(res.status, 200);
        }
        assert.equal(res.body.player.pets.bees_1, 3);
        const merged = await post('merge', { id: 'bees', tier: 2 });
        assert.equal(merged.status, 200);
        assert.equal(merged.body.player.pets.bees_2, 1);
        assert.equal(merged.body.player.pets.bees_1, undefined);
        assert.deepEqual(merged.body.player.petSlots, ['bees_2']);
        assert.equal(merged.body.player.gems, 5);
        assert.equal((await post('slots', { slots: ['bees_2', 'frog_1'] })).status, 400); // one slot unlocked
        const unlocked = await post('unlock');
        assert.equal(unlocked.body.player.petSlotCount, 2);
        assert.equal(unlocked.body.player.gold, 600);
        assert.equal((await post('unlock')).status, 409); // 3rd costs 100 gems
        assert.equal((await post('slots', { slots: ['bees_2', 'bees_2'] })).status, 400);
        assert.equal((await post('slots', { slots: ['frog_1'] })).status, 403); // not owned
        assert.equal((await post('slots', { slots: [] })).status, 200);
    });

    it('credits egg cards and boss eggs from a run, within caps', async () => {
        const api = rigged();
        assert.equal((await finishRun(api, 0, { eggs: 5 })).status, 422); // level 5 → at most 2
        assert.equal((await finishRun(api, 0, { bossEggs: 1 })).status, 422); // no boss killed
        const ok = await finishRun(api, 0, { eggs: 2, artCards: ['greed'] });
        assert.equal(ok.body.player.eggs, 2);
        const old = await finishRun(api, 0, { artCards: ['greed'] }); // a 3.2 client
        assert.equal(old.body.player.eggs, 3);
    });

    it('turns old artefacts back into gold and gems', async () => {
        const api = rigged();
        await finishRun(api, 0);
        const m = t.db.get(`player#${PID}`, 'meta');
        await t.db.send('Put', { Item: { ...m, arts: { greed_1: 2, shard_3: 1 }, slots: ['greed_1', 'shard_3'], gold: 100, gems: 1 } });
        const res = await finishRun(api, 0);
        assert.equal(res.body.player.gold, 100 + 2000 + 9000);
        assert.equal(res.body.player.gems, 1 + 11);
        assert.deepEqual(res.body.player.artRefund, { gold: 11000, gems: 11 });
        const stored = t.db.get(`player#${PID}`, 'meta');
        assert.equal(stored.arts, undefined);
        assert.equal(stored.slots, undefined);
        // P7 tier maps too
        await t.db.send('Put', { Item: { ...stored, artefacts: { boots: 2 } } });
        assert.equal((await finishRun(api, 0)).body.player.gold, 11100 + 3000);
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

    it('keeps the best level per class (mastery) and puts the badge on the board', async () => {
        const api = rigged();
        await finishRun(api, 0, { level: 12, score: 5000 }); // wizard reached 12: the level-10 boss fell
        await finishRun(api, 0, { level: 7, cls: 'goblin' });
        await finishRun(api, 0, { level: 9 });
        // died at level 10 right after its boss (2 bosses: L5 and L10): that counts as level 11
        await finishRun(api, 0, { level: 10, bosses: 2, cls: 'barbarian' });
        await finishRun(api, 0, { level: 10, bosses: 1, cls: 'goblin' }); // the boss won
        const prof = (await api.call('GET', `/player/${PID}`)).body.player;
        assert.deepEqual(prof.classBest, { wizard: 12, goblin: 10, barbarian: 11 });
        const board = (await t.call('GET', '/scores', undefined, '1.2.3.4', { board: 'v3' })).body.scores;
        assert.equal(board.find(s => s.cls === 'wizard' && s.level === 12).mastery, 1);
        assert.equal(board.find(s => s.cls === 'goblin').mastery, undefined);
    });

    it('works out mastery for profiles from before v3.7 from their run history', async () => {
        const api = rigged();
        await finishRun(api, 0, { level: 6 });
        await finishRun(api, 0, { level: 11, cls: 'barbarian' });
        const m = t.db.get(`player#${PID}`, 'meta');
        delete m.classBest;
        await t.db.send('Put', { Item: m });
        assert.deepEqual((await api.call('GET', `/player/${PID}`)).body.player.classBest, { wizard: 6, barbarian: 11 });
        // the next write stores it
        await finishRun(api, 0, { level: 3 });
        assert.deepEqual(t.db.get(`player#${PID}`, 'meta').classBest, { wizard: 6, barbarian: 11 });
    });

    it('feeds owned pets up to level 10 for gold, and builds a second nest', async () => {
        const api = rigged();
        await finishRun(api, 0);
        const post = (route, body = {}) => api.call('POST', `/player/${PID}/${route}`, { secret: SECRET, ...body });
        const m = t.db.get(`player#${PID}`, 'meta');
        await t.db.send('Put', { Item: { ...m, gold: 300000, pets: { bees_2: 1 }, eggs: 3 } });
        assert.equal((await post('feed', { id: 'frog' })).status, 403); // not owned
        assert.equal((await post('feed', { id: 'dragon' })).status, 400);
        let res;
        for (let i = 0; i < 10; i++) res = await post('feed', { id: 'bees' });
        assert.equal(res.body.player.petLevels.bees, 10);
        assert.equal(res.body.player.gold, 300000 - 222500);
        assert.equal((await post('feed', { id: 'bees' })).status, 409); // top level
        // hatchery: one nest, then a second for 15k gold
        assert.equal((await post('warm')).status, 200);
        assert.equal((await post('warm')).status, 409);
        const built = await post('nest');
        assert.equal(built.body.player.nestCount, 2);
        assert.equal(built.body.player.gold, 300000 - 222500 - 15000);
        assert.equal((await post('warm')).status, 200);
        assert.equal((await post('nest')).status, 409); // all nests built
    });
});
