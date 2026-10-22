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
