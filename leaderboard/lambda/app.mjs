// Monster Hunter API — request handling, independent of the AWS SDK so it can be unit-tested.
//
// `send(type, input)` performs one DynamoDB DocumentClient call; type is one of
// Get | Put | Update | Query | TransactWrite. index.mjs wires it to the real SDK, tests to a fake.
//
// Routes
//   GET  /scores?limit=10&board=v3&cls=wizard   top scores (cls filters the v3 board by class)
//   POST /run                        start a run, returns a signed single-use token
//   POST /scores                     submit a finished run (optionally with playerId + secret)
//   GET  /player/{id}                public profile + last 20 runs
//   POST /player/{id}/name           rename { secret, name }
//   POST /player/{id}/spin           double-or-nothing on the run's pot { secret, pot, spins }
//   POST /player/{id}/bank           close the pot { secret, pot }
//   POST /player/{id}/buy            pet egg (gold) or skin (gold/gems) { secret, item: 'egg'|'skin', id? }
//   POST /player/{id}/warm           put an egg in a free nest { secret, type: 'gold'|'boss' }
//   POST /player/{id}/hatch          hatch a ready egg { secret, nest } → { hatched: { id, tier } }
//   POST /player/{id}/hurry          hatch a warming egg now for gems { secret, nest }
//   POST /player/{id}/merge          3 pets × tier-1 → 1 × tier (gems) { secret, id, tier }
//   POST /player/{id}/slots          pets taken on hunts { secret, slots: ['bees_2', …] } (≤ unlocked, distinct)
//   POST /player/{id}/unlock         unlock the next pet slot { secret }
//   POST /player/{id}/icon           public profile icon { secret, cls, skin ('' = class default) }
//   POST /player/{id}/equip          wear an owned skin { secret, cls, skin ('' = none) }
//
// Items (single table):
//   pk="board#v2"      sk="<inverted score>#<ts>#<id>"   Classic score rows, best first
//   pk="board#v3"      sk=…                               v3 score rows (classes, the road)
//   pk="nonce"         sk=<token nonce>                   consumed run tokens (TTL)
//   pk="rate"          sk=<ip>#<minute>                   per-IP submit counter (TTL)
//   pk="player#<pid>"  sk="meta"                          profile (secretHash never leaves the server)
//   pk="player#<pid>"  sk="run#<ts>#<id>"                 run history
//   pk="pot#<nonce>"   sk="pot"                           the run's banked gold on the wheel (TTL 24 h)
import { createHmac, createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import {
    PETS, MERGE_GEMS, MAX_SLOTS, SLOT_UNLOCK, petKey, EGG_PRICE, NESTS, HATCH_MS, HURRY_GEMS_PER_HOUR, EGG_ODDS,
    ART_REFUND_GOLD, ART_REFUND_GEMS, SKINS, SKIN_PRICES, WHEEL_WIN
} from './catalog.mjs';

export const BOARD = 'board#v2';
export const BOARD_V3 = 'board#v3';
export const CLASSES = ['wizard', 'barbarian', 'goblin'];
export const MIN_LEVEL_SECONDS = 12; // no level (fight + encounter + travel) is faster than this
export const MAX_SCORE = 50_000_000;
export const MAX_RUN_MS = 6 * 3600 * 1000;
export const SUBMITS_PER_MINUTE = 6;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SECRET_RE = /^[A-Za-z0-9_-]{32,128}$/;
const PUBLIC_META = ['name', 'bestScore', 'bestLevel', 'runs', 'kills', 'bosses', 'playSeconds', 'createdAt', 'updatedAt', 'gold', 'gems', 'pets', 'petSlots', 'petSlotCount', 'eggs', 'nests', 'artRefund', 'icon', 'skins', 'equipped'];
const POT_RE = /^[A-Za-z0-9_-]{6,40}$/;
const POT_TTL = 24 * 3600;

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

// Upper bound on unspent gold a run can plausibly end with (coins scale with monster HP, +30%/6 levels).
export function coinCap(kills, bosses, level) {
    const hpScale = 1 + Math.floor((Math.max(1, level) - 1) / 6) * 0.3;
    return Math.round(200 + kills * 12 * hpScale + bosses * 600 + level * 120);
}

// Upper bound on gems one run can find (rare drops, bosses drop a few).
export function gemCap(kills, bosses, level) {
    return 2 + bosses * 6 + Math.floor(kills / 100) + level;
}

/** Brings any stored profile to the current shape: gems, pets, pet slots, eggs, nests, icon.
 *  Artefacts (P7 `artefacts` tier map, v3.2 `arts` collection) are turned back into gold and gems. */
export function upgradeMeta(meta) {
    const m = { ...meta };
    m.gold = m.gold || 0;
    m.gems = m.gems || 0;
    m.skins = { ...(m.skins || {}) };
    m.equipped = { ...(m.equipped || {}) };
    if (m.arts || m.artefacts) {
        let gold = 0;
        let gems = 0;
        const add = (tier, n) => {
            if (!(tier >= 1 && tier <= 4) || !(n > 0)) return;
            gold += ART_REFUND_GOLD[tier] * n;
            gems += ART_REFUND_GEMS[tier] * n;
        };
        if (m.arts) for (const [k, n] of Object.entries(m.arts)) add(Number(k.split('_')[1]), n);
        else for (const tier of Object.values(m.artefacts)) add(tier, 1);
        m.gold += gold;
        m.gems += gems;
        if (gold || gems) m.artRefund = { gold, gems };
        delete m.arts;
        delete m.artefacts;
        delete m.slots;
    }
    m.pets = { ...(m.pets || {}) };
    m.petSlots = Array.isArray(m.petSlots) ? [...m.petSlots] : [];
    m.petSlotCount = m.petSlotCount || 1;
    m.eggs = { gold: 0, boss: 0, ...(m.eggs || {}) };
    m.nests = Array.isArray(m.nests) ? m.nests.map(n => ({ ...n })) : [];
    if (m.icon === undefined) m.icon = null;
    m.version = m.version || 0;
    return m;
}

export const parsePet = key => {
    const m = /^([a-z]+)_([1-4])$/.exec(typeof key === 'string' ? key : '');
    return m && PETS.includes(m[1]) ? { id: m[1], tier: Number(m[2]) } : null;
};

/** Adds a pet; it takes a free slot if that kind isn't out with you yet. */
function grantPet(m, id, tier) {
    const k = petKey(id, tier);
    m.pets[k] = (m.pets[k] || 0) + 1;
    const i = m.petSlots.findIndex(s => parsePet(s)?.id === id);
    if (i >= 0 && parsePet(m.petSlots[i]).tier < tier) m.petSlots[i] = k;
    else if (i < 0 && m.petSlots.length < m.petSlotCount) m.petSlots.push(k);
}

/** Pick a tier (1..4) from percentage odds with r in [0, 1). */
export function rollTier(odds, r) {
    let acc = 0;
    for (let t = 0; t < odds.length; t++) {
        acc += odds[t] / 100;
        if (r < acc) return t + 1;
    }
    return 1;
}

export function sanitizeName(name) {
    if (typeof name !== 'string') return '';
    return name.replace(/[\u0000-\u001F\u007F<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
}

export const sha256 = s => createHash('sha256').update(String(s)).digest('base64url');
const isInt = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
const pad = (n, w) => String(n).padStart(w, '0');

export function createApp({ send, tokenSecret, now = () => Date.now(), random = randomBytes, wheel = () => randomInt(0, 1_000_000) < WHEEL_WIN * 1_000_000, rng = () => randomInt(0, 1_000_000) / 1_000_000 }) {
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

    async function topScores(board, limit, cls) {
        let items;
        if (!cls) {
            items = (await send('Query', { KeyConditionExpression: 'pk = :pk', ExpressionAttributeValues: { ':pk': board }, Limit: limit })).Items || [];
        } else {
            // per-class view of the v3 board: filtered pages, best first, until enough rows
            items = [];
            let ExclusiveStartKey;
            let pages = 0;
            do {
                const out = await send('Query', {
                    KeyConditionExpression: 'pk = :pk', FilterExpression: 'cls = :c',
                    ExpressionAttributeValues: { ':pk': board, ':c': cls }, Limit: 300, ExclusiveStartKey
                });
                items.push(...(out.Items || []));
                ExclusiveStartKey = out.LastEvaluatedKey;
            } while (ExclusiveStartKey && items.length < limit && ++pages < 10);
            items = items.slice(0, limit);
        }
        return items.map(({ id, name, score, level, kills, combo, bosses, duration, ts, playerId, cls, skin }) =>
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
        meta = upgradeMeta(meta);
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
        const out = { name, score, level, kills, combo, bosses, duration };
        if (body.board === 'v3') {
            if (!CLASSES.includes(body.cls)) throw new HttpError(400, 'invalid class');
            out.cls = body.cls;
            if (body.skin !== undefined) {
                if (typeof body.skin !== 'string' || !/^[a-z0-9_-]{1,32}$/.test(body.skin)) throw new HttpError(400, 'invalid skin');
                out.skin = body.skin;
            }
            if (body.coins !== undefined) {
                if (!isInt(body.coins, 0, 100_000_000)) throw new HttpError(400, 'invalid coins');
                out.coins = body.coins;
            }
            if (body.gems !== undefined) {
                if (!isInt(body.gems, 0, 100_000)) throw new HttpError(400, 'invalid gems');
                out.gems = body.gems;
            }
            // eggs bought from the in-run egg card, and eggs dropped by bosses
            // (3.2 clients still send artCards: each counts as an egg card)
            const cards = body.eggs !== undefined ? body.eggs : Array.isArray(body.artCards) ? body.artCards.length : undefined;
            if (cards !== undefined) {
                if (!isInt(cards, 0, 200)) throw new HttpError(400, 'invalid eggs');
                out.eggCards = cards;
            }
            if (body.bossEggs !== undefined) {
                if (!isInt(body.bossEggs, 0, 10_000)) throw new HttpError(400, 'invalid eggs');
                out.bossEggs = body.bossEggs;
            }
        }
        return out;
    }

    /** v3: levels are earned by damage over time, so the level is bounded by the run length. */
    function checkPlausibleV3(run) {
        const { score, level, kills, combo, duration, bosses, coins, gems, eggCards, bossEggs } = run;
        if (level > 2 + Math.floor(duration / MIN_LEVEL_SECONDS)) throw new HttpError(422, 'implausible level');
        if (score > 1000 + duration * 4000 || kills > 60 + duration * 25 || combo > kills) throw new HttpError(422, 'implausible score');
        if (coins !== undefined && coins > coinCap(kills, bosses, level)) throw new HttpError(422, 'implausible coins');
        if (gems !== undefined && gems > gemCap(kills, bosses, level)) throw new HttpError(422, 'implausible gems');
        if (eggCards && eggCards > 1 + Math.floor(level / 5)) throw new HttpError(422, 'implausible eggs');
        if (bossEggs && bossEggs > bosses) throw new HttpError(422, 'implausible eggs');
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
        const v3 = body.board === 'v3';
        if (v3) checkPlausibleV3(run);
        else checkPlausible(run);

        const pid = body.playerId;
        let meta = null;
        if (pid !== undefined) meta = await authorize(pid, body.secret);

        if (await rateLimited(ip)) throw new HttpError(429, 'slow down');

        const ts = now();
        const id = random(6).toString('base64url');
        const board = v3 ? BOARD_V3 : BOARD;
        const sk = `${pad(MAX_SCORE - run.score, 9)}#${pad(ts, 14)}#${id}`;
        const nonceItem = { pk: 'nonce', sk: token.nonce, ttl: Math.floor(ts / 1000) + 8 * 3600 };
        const { coins: unspent, gems: _gems, eggCards: _cards, bossEggs: _boss, ...shown } = run;
        const boardItem = { pk: board, sk, id, ...shown, ts };
        if (pid) boardItem.playerId = pid;
        // The skin shown on the board is whatever the profile has equipped — never the client's word.
        delete boardItem.skin;
        if (meta && meta.equipped && run.cls && meta.equipped[run.cls]) boardItem.skin = meta.equipped[run.cls];

        if (!pid) {
            try {
                await send('Put', { Item: nonceItem, ConditionExpression: 'attribute_not_exists(pk)' });
            } catch (e) {
                if (e.name === 'ConditionalCheckFailedException') throw new HttpError(409, 'run already submitted');
                throw e;
            }
            await send('Put', { Item: boardItem });
        } else {
            meta = await writeWithProfile({ pid, meta, secret: body.secret, run, ts, id, nonceItem, boardItem, unspent: v3 ? unspent || 0 : 0, nonce: token.nonce });
        }

        const [rank, scores] = await Promise.all([rankOf(board, sk), topScores(board, 10)]);
        const out = { id, rank, scores };
        if (meta) out.player = publicMeta(pid, meta);
        if (meta && meta.potCredited > 0) out.pot = { id: token.nonce, amount: meta.potCredited, spins: 0, status: 'open' };
        return out;
    }

    // Nonce + board row + run row + profile in one transaction; the profile update is guarded by
    // an optimistic lock on `version` so concurrent submits can't lose increments.
    async function writeWithProfile({ pid, meta, secret, run, ts, id, nonceItem, boardItem, unspent = 0, nonce }) {
        const runItem = {
            pk: `player#${pid}`, sk: `run#${pad(ts, 14)}#${id}`,
            score: run.score, level: run.level, kills: run.kills, combo: run.combo, bosses: run.bosses, duration: run.duration, ts,
            ...(run.cls ? { cls: run.cls, board: 'v3' } : {}),
            ...(unspent > 0 ? { gold: unspent } : {}),
            ...(run.gems > 0 ? { gems: run.gems } : {})
        };
        for (let attempt = 0; attempt < 3; attempt++) {
            const next = {
                ...upgradeMeta(meta || newMeta(pid, secret, ts)),
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
            // Unspent gold is banked 100% at death (D5); the pot lets it ride on the wheel.
            next.gold += unspent;
            next.gems += run.gems || 0;
            next.eggs.gold += run.eggCards || 0;
            next.eggs.boss += run.bossEggs || 0;
            const metaPut = meta
                ? { Put: { Item: next, ConditionExpression: '#v = :v', ExpressionAttributeNames: { '#v': 'version' }, ExpressionAttributeValues: { ':v': meta.version || 0 } } }
                : { Put: { Item: next, ConditionExpression: 'attribute_not_exists(pk)' } };
            try {
                await send('TransactWrite', {
                    TransactItems: [
                        { Put: { Item: nonceItem, ConditionExpression: 'attribute_not_exists(pk)' } },
                        { Put: { Item: boardItem } },
                        { Put: { Item: runItem } },
                        metaPut,
                        ...(unspent > 0 ? [{ Put: { Item: { pk: `pot#${nonce}`, sk: 'pot', playerId: pid, amount: unspent, spins: 0, status: 'open', ttl: Math.floor(ts / 1000) + POT_TTL } } }] : [])
                    ]
                });
                return { ...next, potCredited: unspent };
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

    function newMeta(pid, secret, ts) {
        return {
            pk: `player#${pid}`, sk: 'meta', secretHash: sha256(secret), createdAt: ts, runs: 0, kills: 0, bosses: 0, playSeconds: 0,
            bestScore: 0, bestLevel: 0, gold: 0, gems: 0, pets: {}, petSlots: [], petSlotCount: 1, eggs: { gold: 0, boss: 0 }, nests: [], icon: null, skins: {}, equipped: {}, version: 0
        };
    }

    /** Profiles created before the meta shop lack its maps; add them so nested updates work. */
    async function ensureMaps(pid, meta) {
        if (meta.skins && meta.equipped && meta.gold !== undefined && meta.version !== undefined) return meta;
        const out = await send('Update', {
            Key: { pk: `player#${pid}`, sk: 'meta' },
            UpdateExpression: 'SET skins = if_not_exists(skins, :m), equipped = if_not_exists(equipped, :m), gold = if_not_exists(gold, :z), version = if_not_exists(version, :z)',
            ExpressionAttributeValues: { ':m': {}, ':z': 0 },
            ReturnValues: 'ALL_NEW'
        });
        return out.Attributes;
    }

    /** Read-modify-write of the own profile under the version lock (spins bump it too). */
    async function mutateMeta(pid, body, change) {
        let meta = await ownProfile(pid, body);
        const h = sha256(body.secret);
        for (let attempt = 0; attempt < 4; attempt++) {
            const next = upgradeMeta(meta);
            const extra = change(next); // throws HttpError when the action isn't allowed
            next.version = (meta.version || 0) + 1;
            next.updatedAt = now();
            try {
                await send('Put', {
                    Item: next,
                    ConditionExpression: '#v = :v AND secretHash = :h',
                    ExpressionAttributeNames: { '#v': 'version' },
                    ExpressionAttributeValues: { ':v': meta.version || 0, ':h': h }
                });
                return { ...(extra || {}), player: publicMeta(pid, next) };
            } catch (e) {
                if (e.name !== 'ConditionalCheckFailedException') throw e;
                meta = await ownProfile(pid, body);
            }
        }
        throw new HttpError(409, 'profile busy, try again');
    }

    async function ownProfile(pid, body) {
        const meta = await authorize(pid, body.secret);
        if (!meta) throw new HttpError(404, 'no such player');
        return ensureMaps(pid, meta);
    }

    // ---- banking + wheel (D5): the server rolls, the client only animates the result

    async function getPot(pid, potId) {
        if (!POT_RE.test(potId || '')) throw new HttpError(400, 'invalid pot');
        const out = await send('Get', { Key: { pk: `pot#${potId}`, sk: 'pot' }, ConsistentRead: true });
        const pot = out.Item;
        if (!pot || pot.playerId !== pid) throw new HttpError(404, 'no such pot');
        return pot;
    }

    async function spin(pid, body, ip) {
        const meta = await ownProfile(pid, body);
        if (await rateLimited(ip, 'spin', 40)) throw new HttpError(429, 'slow down');
        const pot = await getPot(pid, body.pot);
        if (pot.status !== 'open' || !(pot.amount > 0)) throw new HttpError(409, 'pot is closed');
        if (!isInt(body.spins, 0, 1000) || body.spins !== pot.spins) throw new HttpError(409, 'stale spin');
        if ((meta.gold || 0) < pot.amount) throw new HttpError(409, 'not enough gold');
        const win = Boolean(wheel());
        const amount = pot.amount;
        const next = { amount: win ? amount * 2 : 0, spins: pot.spins + 1, status: win ? 'open' : 'lost' };
        try {
            await send('TransactWrite', {
                TransactItems: [
                    { Update: {
                        Key: { pk: `pot#${body.pot}`, sk: 'pot' },
                        UpdateExpression: 'SET amount = :na, spins = :n1, #st = :st',
                        ConditionExpression: 'spins = :n AND #st = :open',
                        ExpressionAttributeNames: { '#st': 'status' },
                        ExpressionAttributeValues: { ':na': next.amount, ':n1': next.spins, ':st': next.status, ':n': pot.spins, ':open': 'open' }
                    } },
                    { Update: {
                        Key: { pk: `player#${pid}`, sk: 'meta' },
                        UpdateExpression: win ? 'SET gold = gold + :a ADD version :one' : 'SET gold = gold - :a ADD version :one',
                        ConditionExpression: 'secretHash = :h AND gold >= :a',
                        ExpressionAttributeValues: { ':a': amount, ':one': 1, ':h': sha256(body.secret) }
                    } }
                ]
            });
        } catch (e) {
            if (e.name === 'TransactionCanceledException') throw new HttpError(409, 'try again');
            throw e;
        }
        return { win, pot: { id: body.pot, ...next }, gold: (meta.gold || 0) + (win ? amount : -amount) };
    }

    async function bank(pid, body) {
        const meta = await ownProfile(pid, body);
        const pot = await getPot(pid, body.pot);
        if (pot.status === 'open') {
            try {
                await send('Update', {
                    Key: { pk: `pot#${body.pot}`, sk: 'pot' },
                    UpdateExpression: 'SET #st = :b',
                    ConditionExpression: '#st = :open',
                    ExpressionAttributeNames: { '#st': 'status' },
                    ExpressionAttributeValues: { ':b': 'banked', ':open': 'open' }
                });
            } catch (e) {
                if (e.name !== 'ConditionalCheckFailedException') throw e;
            }
        }
        return { gold: meta.gold || 0, pot: { id: body.pot, amount: pot.amount, spins: pot.spins, status: pot.status === 'open' ? 'banked' : pot.status } };
    }

    // ---- meta shop: eggs and skins, hatching, merging pets, pet slots, icon

    function buy(pid, body) {
        return mutateMeta(pid, body, m => {
            if (body.item === 'egg') {
                if (m.gold < EGG_PRICE) throw new HttpError(409, 'not enough gold');
                m.gold -= EGG_PRICE;
                m.eggs.gold++;
            } else if (body.item === 'skin') {
                const skin = SKINS[body.id];
                if (!skin) throw new HttpError(400, 'invalid skin');
                if (m.skins[body.id]) throw new HttpError(409, 'already owned');
                const price = SKIN_PRICES[skin.rarity];
                if (price.gold) {
                    if (m.gold < price.gold) throw new HttpError(409, 'not enough gold');
                    m.gold -= price.gold;
                } else {
                    if (m.gems < price.gems) throw new HttpError(409, 'not enough gems');
                    m.gems -= price.gems;
                }
                m.skins[body.id] = true;
            } else {
                throw new HttpError(400, 'invalid item');
            }
        });
    }

    /** Put an egg into a free nest; it hatches HATCH_MS later. */
    function warm(pid, body) {
        return mutateMeta(pid, body, m => {
            const type = body.type;
            if (!EGG_ODDS[type]) throw new HttpError(400, 'invalid egg');
            if (!(m.eggs[type] > 0)) throw new HttpError(409, 'no such egg');
            if (m.nests.length >= NESTS) throw new HttpError(409, 'the nests are full');
            m.eggs[type]--;
            m.nests.push({ id: random(6).toString('base64url'), type, start: now() });
        });
    }

    /** Hatch a ready egg (or, with hurry, a warming one for gems). The server rolls the pet. */
    function hatch(pid, body, hurry) {
        return mutateMeta(pid, body, m => {
            const i = m.nests.findIndex(n => n.id === body.nest);
            if (i < 0) throw new HttpError(404, 'no such nest');
            const nest = m.nests[i];
            const left = nest.start + HATCH_MS - now();
            if (left > 0) {
                if (!hurry) throw new HttpError(409, 'not ready yet');
                const cost = Math.max(1, Math.ceil(left / 3_600_000) * HURRY_GEMS_PER_HOUR);
                if (m.gems < cost) throw new HttpError(409, 'not enough gems');
                m.gems -= cost;
            }
            m.nests.splice(i, 1);
            const id = PETS[Math.min(PETS.length - 1, Math.floor(rng() * PETS.length))];
            const tier = rollTier(EGG_ODDS[nest.type], rng());
            grantPet(m, id, tier);
            return { hatched: { id, tier, egg: nest.type } };
        });
    }

    function merge(pid, body) {
        return mutateMeta(pid, body, m => {
            const { id, tier } = body;
            if (!PETS.includes(id) || !isInt(tier, 2, 4)) throw new HttpError(400, 'invalid merge');
            const lower = petKey(id, tier - 1);
            const upper = petKey(id, tier);
            if ((m.pets[lower] || 0) < 3) throw new HttpError(409, 'need three to merge');
            if (m.gems < MERGE_GEMS[tier]) throw new HttpError(409, 'not enough gems');
            m.gems -= MERGE_GEMS[tier];
            m.pets[lower] -= 3;
            if (!m.pets[lower]) delete m.pets[lower];
            m.pets[upper] = (m.pets[upper] || 0) + 1;
            // the stronger pet replaces a weaker one of the same kind in the slots
            const i = m.petSlots.findIndex(s => parsePet(s)?.id === id);
            if (i >= 0 && (parsePet(m.petSlots[i]).tier < tier || !(m.pets[m.petSlots[i]] > 0))) m.petSlots[i] = upper;
        });
    }

    function setSlots(pid, body) {
        return mutateMeta(pid, body, m => {
            const slots = body.slots;
            if (!Array.isArray(slots) || slots.length > m.petSlotCount) throw new HttpError(400, 'invalid slots');
            const ids = new Set();
            for (const k of slots) {
                const a = parsePet(k);
                if (!a || ids.has(a.id)) throw new HttpError(400, 'invalid slots');
                if (!(m.pets[k] > 0)) throw new HttpError(403, 'you do not own that pet');
                ids.add(a.id);
            }
            m.petSlots = [...slots];
        });
    }

    /** Unlock the next pet slot (2nd: gold, 3rd and 4th: gems). */
    function unlockSlot(pid, body) {
        return mutateMeta(pid, body, m => {
            const n = m.petSlotCount + 1;
            if (n > MAX_SLOTS) throw new HttpError(409, 'all slots unlocked');
            const price = SLOT_UNLOCK[n];
            if (price.gold) {
                if (m.gold < price.gold) throw new HttpError(409, 'not enough gold');
                m.gold -= price.gold;
            } else {
                if (m.gems < price.gems) throw new HttpError(409, 'not enough gems');
                m.gems -= price.gems;
            }
            m.petSlotCount = n;
        });
    }

    function setIcon(pid, body) {
        return mutateMeta(pid, body, m => {
            const { cls } = body;
            const skin = body.skin || '';
            if (!CLASSES.includes(cls)) throw new HttpError(400, 'invalid class');
            if (skin && (!SKINS[skin] || SKINS[skin].cls !== cls)) throw new HttpError(400, 'invalid skin');
            if (skin && !m.skins[skin]) throw new HttpError(403, 'you do not own that skin');
            m.icon = { cls, skin };
        });
    }

    function equip(pid, body) {
        return mutateMeta(pid, body, m => {
            const { cls } = body;
            const skin = body.skin || '';
            if (!CLASSES.includes(cls)) throw new HttpError(400, 'invalid class');
            if (skin && (!SKINS[skin] || SKINS[skin].cls !== cls)) throw new HttpError(400, 'invalid skin');
            if (skin && !m.skins[skin]) throw new HttpError(403, 'you do not own that skin');
            m.equipped[cls] = skin;
        });
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
        const runs = (out.Items || []).map(({ score, level, kills, combo, bosses, duration, ts, cls, gold, gems }) => ({ score, level, kills, combo, bosses, duration, ts, cls, gold, gems }));
        return { player: publicMeta(pid, meta), runs };
    }

    async function rename(pid, body, ip) {
        const name = sanitizeName(body.name);
        if (!name) throw new HttpError(400, 'name required');
        const meta = await authorize(pid, body.secret);
        if (await rateLimited(ip, 'name', 10)) throw new HttpError(429, 'slow down');
        const ts = now();
        if (!meta) {
            const item = { ...newMeta(pid, body.secret, ts), name, updatedAt: ts, version: 1 };
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
                const v3 = query.board === 'v3';
                const cls = v3 && CLASSES.includes(query.cls) ? query.cls : undefined;
                return json(200, { scores: await topScores(v3 ? BOARD_V3 : BOARD, limit, cls) });
            }
            if (method === 'POST' && path === '/run') return json(200, { token: makeToken() });
            if (method === 'POST' && path === '/scores') return json(200, await submit(parseBody(event), ip));
            const m = path.match(/^\/player\/([^/]+)(\/[a-z]+)?$/);
            if (m) {
                const [, pid, action] = m;
                if (method === 'GET' && !action) return json(200, await getPlayer(pid));
                if (method === 'POST' && action === '/name') return json(200, await rename(pid, parseBody(event), ip));
                if (method === 'POST' && action === '/spin') return json(200, await spin(pid, parseBody(event), ip));
                if (method === 'POST' && action === '/bank') return json(200, await bank(pid, parseBody(event)));
                if (method === 'POST' && action === '/buy') return json(200, await buy(pid, parseBody(event)));
                if (method === 'POST' && action === '/equip') return json(200, await equip(pid, parseBody(event)));
                if (method === 'POST' && action === '/merge') return json(200, await merge(pid, parseBody(event)));
                if (method === 'POST' && action === '/warm') return json(200, await warm(pid, parseBody(event)));
                if (method === 'POST' && action === '/hatch') return json(200, await hatch(pid, parseBody(event), false));
                if (method === 'POST' && action === '/hurry') return json(200, await hatch(pid, parseBody(event), true));
                if (method === 'POST' && action === '/unlock') return json(200, await unlockSlot(pid, parseBody(event)));
                if (method === 'POST' && action === '/slots') return json(200, await setSlots(pid, parseBody(event)));
                if (method === 'POST' && action === '/icon') return json(200, await setIcon(pid, parseBody(event)));
            }
            return json(404, { error: 'not found' });
        } catch (e) {
            if (e instanceof HttpError) return json(e.status, { error: e.message });
            console.error(e);
            return json(500, { error: 'server error' });
        }
    };
}
