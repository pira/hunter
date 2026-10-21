// Monster Hunter global leaderboard — AWS Lambda (Node.js 22, function URL) + DynamoDB.
//
// Routes
//   GET  /scores?limit=10   top scores
//   POST /run               start a run, returns a signed single-use token
//   POST /scores            submit { name, score, level, kills, combo, bosses, duration, token }
//
// Table layout (single table, on-demand):
//   pk="board#v2"  sk="<inverted score>#<ts>#<id>"  -> score rows, sorted best-first
//   pk="nonce"     sk=<token nonce>                 -> consumed run tokens (TTL)
//   pk="rate"      sk=<ip>#<minute>                 -> per-IP submit counter (TTL)
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const TABLE = process.env.TABLE_NAME;
const SECRET = process.env.TOKEN_SECRET;
const BOARD = 'board#v2';
const MAX_SCORE = 50_000_000;
const MAX_RUN_MS = 6 * 3600 * 1000;
const SUBMITS_PER_MINUTE = 6;

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const json = (statusCode, body) => ({
    statusCode,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    body: JSON.stringify(body)
});

// Must match calculateLevelThreshold in game-utils.js.
function xpToNextLevel(level) {
    return Math.round((60 * Math.pow(level, 1.35) + 30) / 10) * 10;
}
function levelForXp(xp) {
    let level = 1;
    let total = xpToNextLevel(1);
    while (xp >= total && level < 1000) {
        level++;
        total += xpToNextLevel(level);
    }
    return level;
}

function sanitizeName(name) {
    if (typeof name !== 'string') return '';
    return name.replace(/[\u0000-\u001F\u007F<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
}

function sign(payload) {
    return createHmac('sha256', SECRET).update(payload).digest('base64url');
}

function makeToken() {
    const payload = `${Date.now()}.${randomBytes(9).toString('base64url')}`;
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

const isInt = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;

async function topScores(limit) {
    const out = await db.send(new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: { ':pk': BOARD },
        Limit: limit
    }));
    return (out.Items || []).map(({ id, name, score, level, kills, combo, bosses, duration, ts }) =>
        ({ id, name, score, level, kills, combo, bosses, duration, ts }));
}

async function rankOf(sk) {
    let count = 0;
    let ExclusiveStartKey;
    do {
        const out = await db.send(new QueryCommand({
            TableName: TABLE,
            KeyConditionExpression: 'pk = :pk AND sk < :sk',
            ExpressionAttributeValues: { ':pk': BOARD, ':sk': sk },
            Select: 'COUNT',
            ExclusiveStartKey
        }));
        count += out.Count || 0;
        ExclusiveStartKey = out.LastEvaluatedKey;
    } while (ExclusiveStartKey && count < 10000); // beyond 10k the exact rank doesn't matter
    return count + 1;
}

async function rateLimited(ip) {
    const minute = Math.floor(Date.now() / 60000);
    const out = await db.send(new UpdateCommand({
        TableName: TABLE,
        Key: { pk: 'rate', sk: `${ip}#${minute}` },
        UpdateExpression: 'ADD hits :one SET #ttl = :ttl',
        ExpressionAttributeNames: { '#ttl': 'ttl' },
        ExpressionAttributeValues: { ':one': 1, ':ttl': Math.floor(Date.now() / 1000) + 180 },
        ReturnValues: 'UPDATED_NEW'
    }));
    return out.Attributes.hits > SUBMITS_PER_MINUTE;
}

async function submit(body, ip) {
    const name = sanitizeName(body.name);
    const { score, level, kills, combo = 0, bosses = 0, duration } = body;
    if (!name) return json(400, { error: 'name required' });
    if (!isInt(score, 1, MAX_SCORE) || !isInt(level, 1, 1000) || !isInt(kills, 0, 10_000_000) ||
        !isInt(combo, 0, 10_000_000) || !isInt(bosses, 0, 10_000) || !isInt(duration, 1, MAX_RUN_MS / 1000)) {
        return json(400, { error: 'invalid fields' });
    }

    const token = readToken(body.token);
    if (!token) return json(403, { error: 'invalid run token' });
    const elapsed = Date.now() - token.issuedAt;
    // The claimed run length must fit in the real time since the run started (pause time only adds slack).
    if (elapsed > MAX_RUN_MS || duration * 1000 > elapsed + 15000) return json(403, { error: 'run timing mismatch' });

    // Plausibility: XP (which drives level) never exceeds score, and score per second is bounded.
    if (level > levelForXp(score)) return json(422, { error: 'implausible level' });
    if (score > 5000 + duration * 4000 || kills > 60 + duration * 25 || combo > kills) {
        return json(422, { error: 'implausible score' });
    }

    if (await rateLimited(ip)) return json(429, { error: 'slow down' });

    try {
        await db.send(new PutCommand({
            TableName: TABLE,
            Item: { pk: 'nonce', sk: token.nonce, ttl: Math.floor(Date.now() / 1000) + 8 * 3600 },
            ConditionExpression: 'attribute_not_exists(pk)'
        }));
    } catch (e) {
        if (e.name === 'ConditionalCheckFailedException') return json(409, { error: 'run already submitted' });
        throw e;
    }

    const ts = Date.now();
    const id = randomBytes(6).toString('base64url');
    const sk = `${String(MAX_SCORE - score).padStart(9, '0')}#${String(ts).padStart(14, '0')}#${id}`;
    await db.send(new PutCommand({
        TableName: TABLE,
        Item: { pk: BOARD, sk, id, name, score, level, kills, combo, bosses, duration, ts }
    }));

    const [rank, scores] = await Promise.all([rankOf(sk), topScores(10)]);
    return json(200, { id, rank, scores });
}

export const handler = async (event) => {
    const method = event.requestContext?.http?.method || 'GET';
    const path = (event.rawPath || '/').replace(/\/+$/, '') || '/';
    const ip = event.requestContext?.http?.sourceIp || 'unknown';

    try {
        if (method === 'GET' && path === '/scores') {
            const limit = Math.min(50, Math.max(1, Number(event.queryStringParameters?.limit) || 10));
            return json(200, { scores: await topScores(limit) });
        }
        if (method === 'POST' && path === '/run') {
            return json(200, { token: makeToken() });
        }
        if (method === 'POST' && path === '/scores') {
            let body;
            try {
                body = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString() : event.body || '{}');
            } catch (e) {
                return json(400, { error: 'invalid json' });
            }
            if (!body || typeof body !== 'object') return json(400, { error: 'invalid json' });
            return await submit(body, ip);
        }
        return json(404, { error: 'not found' });
    } catch (e) {
        console.error(e);
        return json(500, { error: 'server error' });
    }
};
