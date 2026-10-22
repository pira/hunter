// Monster Hunter API — request handling, independent of the AWS SDK so it can be unit-tested.
//
// `send(type, input)` performs one DynamoDB DocumentClient call; type is one of
// Get | Put | Update | Query | TransactWrite. index.mjs wires it to the real SDK, tests to a fake.
//
// Routes
//   GET  /scores?limit=10            top scores
//   POST /run                        start a run, returns a signed single-use token
//   POST /scores                     submit a finished run (optionally with playerId + secret)
//   GET  /player/{id}                public profile + last 20 runs
//   POST /player/{id}/name           rename { secret, name }
//
// Items (single table):
//   pk="board#v2"      sk="<inverted score>#<ts>#<id>"   score rows, best first
//   pk="nonce"         sk=<token nonce>                   consumed run tokens (TTL)
//   pk="rate"          sk=<ip>#<minute>                   per-IP submit counter (TTL)
//   pk="player#<pid>"  sk="meta"                          profile (secretHash never leaves the server)
//   pk="player#<pid>"  sk="run#<ts>#<id>"                 run history
import { createHmac, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const BOARD = 'board#v2';
export const MAX_SCORE = 50_000_000;
export const MAX_RUN_MS = 6 * 3600 * 1000;
export const SUBMITS_PER_MINUTE = 6;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SECRET_RE = /^[A-Za-z0-9_-]{32,128}$/;
const PUBLIC_META = ['name', 'bestScore', 'bestLevel', 'runs', 'kills', 'bosses', 'playSeconds', 'createdAt', 'updatedAt'];

export class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

export const json = (statusCode, body) => ({
    statusCode,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    body: JSON.stringify(body)
});

// Must match calculateLevelThreshold in game-utils.js.
export function xpToNextLevel(level) {
    return Math.round((60 * Math.pow(level, 1.35) + 30) / 10) * 10;
}
export function levelForXp(xp) {
    let level = 1;
    let total = xpToNextLevel(1);
    while (xp >= total && level < 1000) {
        level++;
        total += xpToNextLevel(level);
    }
    return level;
}

export function sanitizeName(name) {
    if (typeof name !== 'string') return '';
    return name.replace(/[\u0000-\u001F\u007F<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
}

export const sha256 = s => createHash('sha256').update(String(s)).digest('base64url');
const isInt = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
const pad = (n, w) => String(n).padStart(w, '0');

export function createApp({ send, tokenSecret, now = () => Date.now(), random = randomBytes }) {
    const sign = payload => createHmac('sha256', tokenSecret).update(payload).digest('base64url');

    function makeToken() {
        const payload = `${now()}.${random(9).toString('base64url')}`;
        return `${payload}.${sign(payload)}`;
    }

    function readToken(token) {
        if (typeof token !== 'string') return null;
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const payload = `${parts[0]}.${parts[1]}`;
        const expected = Buffer.from(sign(payload));
        const given = Buffer.from(parts[2]);
        if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
        const issuedAt = Number(parts[0]);
        if (!Number.isFinite(issuedAt)) return null;
        return { issuedAt, nonce: parts[1] };
    }

    async function topScores(board, limit) {
        const out = await send('Query', {
            KeyConditionExpression: 'pk = :pk',
            ExpressionAttributeValues: { ':pk': board },
            Limit: limit
        });
        return (out.Items || []).map(({ id, name, score, level, kills, combo, bosses, duration, ts, playerId, cls, skin }) =>
            ({ id, name, score, level, kills, combo, bosses, duration, ts, playerId, cls, skin }));
    }

    async function rankOf(board, sk) {
        let count = 0;
        let ExclusiveStartKey;
        do {
            const out = await send('Query', {
                KeyConditionExpression: 'pk = :pk AND sk < :sk',
                ExpressionAttributeValues: { ':pk': board, ':sk': sk },
                Select: 'COUNT',
                ExclusiveStartKey
            });
            count += out.Count || 0;
            ExclusiveStartKey = out.LastEvaluatedKey;
        } while (ExclusiveStartKey && count < 10000); // beyond 10k the exact rank doesn't matter
        return count + 1;
    }

    async function rateLimited(ip, bucket = 'submit', perMinute = SUBMITS_PER_MINUTE) {
        const minute = Math.floor(now() / 60000);
        const out = await send('Update', {
            Key: { pk: 'rate', sk: `${ip}#${bucket}#${minute}` },
            UpdateExpression: 'ADD hits :one SET #ttl = :ttl',
            ExpressionAttributeNames: { '#ttl': 'ttl' },
            ExpressionAttributeValues: { ':one': 1, ':ttl': Math.floor(now() / 1000) + 180 },
            ReturnValues: 'UPDATED_NEW'
        });
        return out.Attributes.hits > perMinute;
    }

    async function getMeta(pid) {
        const out = await send('Get', { Key: { pk: `player#${pid}`, sk: 'meta' }, ConsistentRead: true });
        return out.Item || null;
    }

    function publicMeta(pid, meta) {
        const out = { id: pid };
        for (const k of PUBLIC_META) if (meta[k] !== undefined) out[k] = meta[k];
        return out;
    }

    /** Verifies the caller owns `pid`. Returns the meta item (or null if unclaimed). */
    async function authorize(pid, secret) {
        if (!UUID.test(pid || '')) throw new HttpError(400, 'invalid player id');
        if (!SECRET_RE.test(secret || '')) throw new HttpError(400, 'invalid secret');
        const meta = await getMeta(pid);
        if (meta && meta.secretHash !== sha256(secret)) throw new HttpError(403, 'not your profile');
        return meta;
    }

    function parseRun(body) {
        const name = sanitizeName(body.name);
        const { score, level, kills, combo = 0, bosses = 0, duration } = body;
        if (!name) throw new HttpError(400, 'name required');
        if (!isInt(score, 1, MAX_SCORE) || !isInt(level, 1, 1000) || !isInt(kills, 0, 10_000_000) ||
            !isInt(combo, 0, 10_000_000) || !isInt(bosses, 0, 10_000) || !isInt(duration, 1, MAX_RUN_MS / 1000)) {
            throw new HttpError(400, 'invalid fields');
        }
        return { name, score, level, kills, combo, bosses, duration };
    }

    function checkPlausible(run) {
        const { score, level, kills, combo, duration } = run;
        // XP (which drives level) is at most 2× score (Double XP buff); score per second is bounded.
        if (level > levelForXp(score * 2) + 1) throw new HttpError(422, 'implausible level');
        if (score > 500 + duration * 4000 || kills > 60 + duration * 25 || combo > kills) {
            throw new HttpError(422, 'implausible score');
        }
    }

    async function submit(body, ip) {
        const run = parseRun(body);
        const token = readToken(body.token);
        if (!token) throw new HttpError(403, 'invalid run token');
        const elapsed = now() - token.issuedAt;
        // The claimed run length must fit in the real time since the run started (pause time only adds slack).
        if (elapsed > MAX_RUN_MS || run.duration * 1000 > elapsed + 15000) throw new HttpError(403, 'run timing mismatch');
        checkPlausible(run);

        const pid = body.playerId;
        let meta = null;
        if (pid !== undefined) meta = await authorize(pid, body.secret);

        if (await rateLimited(ip)) throw new HttpError(429, 'slow down');

        const ts = now();
        const id = random(6).toString('base64url');
        const board = BOARD;
        const sk = `${pad(MAX_SCORE - run.score, 9)}#${pad(ts, 14)}#${id}`;
        const nonceItem = { pk: 'nonce', sk: token.nonce, ttl: Math.floor(ts / 1000) + 8 * 3600 };
        const boardItem = { pk: board, sk, id, ...run, ts };
        if (pid) boardItem.playerId = pid;

        if (!pid) {
            try {
                await send('Put', { Item: nonceItem, ConditionExpression: 'attribute_not_exists(pk)' });
            } catch (e) {
                if (e.name === 'ConditionalCheckFailedException') throw new HttpError(409, 'run already submitted');
                throw e;
            }
            await send('Put', { Item: boardItem });
        } else {
            meta = await writeWithProfile({ pid, meta, secret: body.secret, run, ts, id, nonceItem, boardItem });
        }

        const [rank, scores] = await Promise.all([rankOf(board, sk), topScores(board, 10)]);
        const out = { id, rank, scores };
        if (meta) out.player = publicMeta(pid, meta);
        return out;
    }

    // Nonce + board row + run row + profile in one transaction; the profile update is guarded by
    // an optimistic lock on `version` so concurrent submits can't lose increments.
    async function writeWithProfile({ pid, meta, secret, run, ts, id, nonceItem, boardItem }) {
        const runItem = {
            pk: `player#${pid}`, sk: `run#${pad(ts, 14)}#${id}`,
            score: run.score, level: run.level, kills: run.kills, combo: run.combo, bosses: run.bosses, duration: run.duration, ts
        };
        for (let attempt = 0; attempt < 3; attempt++) {
            const next = {
                ...(meta || { pk: `player#${pid}`, sk: 'meta', secretHash: sha256(secret), createdAt: ts, runs: 0, kills: 0, bosses: 0, playSeconds: 0, bestScore: 0, bestLevel: 0, version: 0 }),
                name: run.name,
                updatedAt: ts
            };
            next.runs += 1;
            next.kills += run.kills;
            next.bosses += run.bosses;
            next.playSeconds += run.duration;
            next.bestScore = Math.max(next.bestScore || 0, run.score);
            next.bestLevel = Math.max(next.bestLevel || 0, run.level);
            next.version = (meta ? meta.version || 0 : 0) + 1;
            const metaPut = meta
                ? { Put: { Item: next, ConditionExpression: '#v = :v', ExpressionAttributeNames: { '#v': 'version' }, ExpressionAttributeValues: { ':v': meta.version || 0 } } }
                : { Put: { Item: next, ConditionExpression: 'attribute_not_exists(pk)' } };
            try {
                await send('TransactWrite', {
                    TransactItems: [
                        { Put: { Item: nonceItem, ConditionExpression: 'attribute_not_exists(pk)' } },
                        { Put: { Item: boardItem } },
                        { Put: { Item: runItem } },
                        metaPut
                    ]
                });
                return next;
            } catch (e) {
                if (e.name !== 'TransactionCanceledException') throw e;
                const reasons = (e.CancellationReasons || []).map(r => r && r.Code);
                if (reasons[0] === 'ConditionalCheckFailed') throw new HttpError(409, 'run already submitted');
                if (reasons[3] !== 'ConditionalCheckFailed') throw e;
                meta = await getMeta(pid); // someone else wrote the profile meanwhile: re-read and retry
                if (meta && meta.secretHash !== sha256(secret)) throw new HttpError(403, 'not your profile');
            }
        }
        throw new HttpError(409, 'profile busy, try again');
    }

    async function getPlayer(pid) {
        if (!UUID.test(pid || '')) throw new HttpError(400, 'invalid player id');
        const meta = await getMeta(pid);
        if (!meta) throw new HttpError(404, 'no such player');
        const out = await send('Query', {
            KeyConditionExpression: 'pk = :pk AND begins_with(sk, :run)',
            ExpressionAttributeValues: { ':pk': `player#${pid}`, ':run': 'run#' },
            ScanIndexForward: false,
            Limit: 20
        });
        const runs = (out.Items || []).map(({ score, level, kills, combo, bosses, duration, ts, cls }) => ({ score, level, kills, combo, bosses, duration, ts, cls }));
        return { player: publicMeta(pid, meta), runs };
    }

    async function rename(pid, body, ip) {
        const name = sanitizeName(body.name);
        if (!name) throw new HttpError(400, 'name required');
        const meta = await authorize(pid, body.secret);
        if (await rateLimited(ip, 'name', 10)) throw new HttpError(429, 'slow down');
        const ts = now();
        if (!meta) {
            const item = { pk: `player#${pid}`, sk: 'meta', secretHash: sha256(body.secret), name, createdAt: ts, updatedAt: ts, runs: 0, kills: 0, bosses: 0, playSeconds: 0, bestScore: 0, bestLevel: 0, version: 1 };
            try {
                await send('Put', { Item: item, ConditionExpression: 'attribute_not_exists(pk)' });
            } catch (e) {
                if (e.name === 'ConditionalCheckFailedException') throw new HttpError(409, 'try again');
                throw e;
            }
            return { player: publicMeta(pid, item) };
        }
        const out = await send('Update', {
            Key: { pk: `player#${pid}`, sk: 'meta' },
            UpdateExpression: 'SET #n = :n, updatedAt = :t ADD version :one',
            ConditionExpression: 'secretHash = :h',
            ExpressionAttributeNames: { '#n': 'name' },
            ExpressionAttributeValues: { ':n': name, ':t': ts, ':one': 1, ':h': sha256(body.secret) },
            ReturnValues: 'ALL_NEW'
        });
        return { player: publicMeta(pid, out.Attributes) };
    }

    function parseBody(event) {
        try {
            const body = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString() : event.body || '{}');
            if (!body || typeof body !== 'object') throw new Error('not an object');
            return body;
        } catch (e) {
            throw new HttpError(400, 'invalid json');
        }
    }

    return async function handle(event) {
        const method = event.requestContext?.http?.method || 'GET';
        const path = (event.rawPath || '/').replace(/\/+$/, '') || '/';
        const ip = event.requestContext?.http?.sourceIp || 'unknown';
        const query = event.queryStringParameters || {};
        try {
            if (method === 'GET' && path === '/scores') {
                const limit = Math.min(50, Math.max(1, Number(query.limit) || 10));
                return json(200, { scores: await topScores(BOARD, limit) });
            }
            if (method === 'POST' && path === '/run') return json(200, { token: makeToken() });
            if (method === 'POST' && path === '/scores') return json(200, await submit(parseBody(event), ip));
            const m = path.match(/^\/player\/([^/]+)(\/[a-z]+)?$/);
            if (m) {
                const [, pid, action] = m;
                if (method === 'GET' && !action) return json(200, await getPlayer(pid));
                if (method === 'POST' && action === '/name') return json(200, await rename(pid, parseBody(event), ip));
            }
            return json(404, { error: 'not found' });
        } catch (e) {
            if (e instanceof HttpError) return json(e.status, { error: e.message });
            console.error(e);
            return json(500, { error: 'server error' });
        }
    };
}
