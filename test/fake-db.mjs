// In-memory stand-in for the DynamoDB DocumentClient calls app.mjs makes (no dependencies).
// Supports the expression subset the app uses: comparisons, attribute_(not_)exists, begins_with,
// AND/OR without parentheses; SET (=, +, -, if_not_exists), ADD, REMOVE; Select COUNT; transactions.

function err(name, extra = {}) {
    const e = new Error(name);
    e.name = name;
    Object.assign(e, extra);
    return e;
}

export function createFakeDb() {
    const items = new Map();
    const key = (pk, sk) => `${pk}\u0000${sk}`;
    const calls = [];
    const clone = v => (v === undefined ? v : structuredClone(v));

    function resolvePath(path, names) {
        return path.split('.').map(p => (p.startsWith('#') ? names[p] : p));
    }
    function getPath(item, path, names) {
        let v = item;
        for (const p of resolvePath(path, names)) v = v == null ? undefined : v[p];
        return v;
    }
    function setPath(item, path, names, value) {
        const parts = resolvePath(path, names);
        let o = item;
        for (const p of parts.slice(0, -1)) o = o[p] ??= {};
        if (value === undefined) delete o[parts.at(-1)];
        else o[parts.at(-1)] = value;
    }
    function operand(tok, item, names, values) {
        tok = tok.trim();
        if (tok.startsWith(':')) return values[tok];
        return getPath(item, tok, names);
    }
    function evalCond(expr, item, names = {}, values = {}) {
        if (!expr) return true;
        return expr.split(/\s+OR\s+/).some(orPart => orPart.split(/\s+AND\s+/).every(term => {
            term = term.trim();
            let m;
            if ((m = term.match(/^attribute_not_exists\((.+)\)$/))) return item == null || getPath(item, m[1], names) === undefined;
            if ((m = term.match(/^attribute_exists\((.+)\)$/))) return item != null && getPath(item, m[1], names) !== undefined;
            if ((m = term.match(/^begins_with\((.+),\s*(.+)\)$/))) return String(operand(m[1], item, names, values) ?? '').startsWith(operand(m[2], item, names, values));
            if ((m = term.match(/^(.+?)\s*(<=|>=|<>|=|<|>)\s*(.+)$/))) {
                if (item == null) return false;
                const a = operand(m[1], item, names, values);
                const b = operand(m[3], item, names, values);
                if (a === undefined) return false;
                switch (m[2]) {
                    case '=': return a === b;
                    case '<>': return a !== b;
                    case '<': return a < b;
                    case '>': return a > b;
                    case '<=': return a <= b;
                    case '>=': return a >= b;
                }
            }
            throw new Error(`fake-db: unsupported condition "${term}"`);
        }));
    }
    function applyUpdate(item, expr, names = {}, values = {}) {
        const sections = expr.split(/\b(SET|ADD|REMOVE)\b/).map(s => s.trim()).filter(Boolean);
        for (let i = 0; i < sections.length; i += 2) {
            const kind = sections[i];
            const body = sections[i + 1];
            for (const clause of body.split(/,(?![^(]*\))/).map(s => s.trim()).filter(Boolean)) {
                if (kind === 'SET') {
                    const [lhs, rhs] = clause.split(/\s*=\s*(.*)/s);
                    const val = rhs.trim();
                    let m;
                    let v;
                    if ((m = val.match(/^if_not_exists\((.+?),\s*(.+?)\)\s*([+-])\s*(.+)$/))) {
                        const base = getPath(item, m[1], names) ?? operand(m[2], item, names, values);
                        v = m[3] === '+' ? base + operand(m[4], item, names, values) : base - operand(m[4], item, names, values);
                    } else if ((m = val.match(/^if_not_exists\((.+?),\s*(.+?)\)$/))) {
                        v = getPath(item, m[1], names) ?? operand(m[2], item, names, values);
                    } else if ((m = val.match(/^(.+?)\s*([+-])\s*(.+)$/))) {
                        const a = operand(m[1], item, names, values);
                        const b = operand(m[3], item, names, values);
                        v = m[2] === '+' ? a + b : a - b;
                    } else {
                        v = operand(val, item, names, values);
                    }
                    setPath(item, lhs.trim(), names, clone(v));
                } else if (kind === 'ADD') {
                    const [path, val] = clause.split(/\s+/);
                    setPath(item, path, names, (getPath(item, path, names) || 0) + operand(val, item, names, values));
                } else if (kind === 'REMOVE') {
                    setPath(item, clause, names, undefined);
                }
            }
        }
        return item;
    }

    function checkPut(input) {
        const old = items.get(key(input.Item.pk, input.Item.sk));
        return evalCond(input.ConditionExpression, old, input.ExpressionAttributeNames, input.ExpressionAttributeValues);
    }
    function doPut(input) {
        items.set(key(input.Item.pk, input.Item.sk), clone(input.Item));
    }
    function checkUpdate(input) {
        const old = items.get(key(input.Key.pk, input.Key.sk));
        return evalCond(input.ConditionExpression, old, input.ExpressionAttributeNames, input.ExpressionAttributeValues);
    }
    function doUpdate(input) {
        const k = key(input.Key.pk, input.Key.sk);
        const before = clone(items.get(k));
        const item = clone(items.get(k)) || { ...input.Key };
        applyUpdate(item, input.UpdateExpression, input.ExpressionAttributeNames, input.ExpressionAttributeValues);
        items.set(k, item);
        return { before, after: item };
    }

    async function send(type, input) {
        calls.push({ type, input: clone(input) });
        switch (type) {
            case 'Get':
                return { Item: clone(items.get(key(input.Key.pk, input.Key.sk))) };
            case 'Put':
                if (!checkPut(input)) throw err('ConditionalCheckFailedException');
                doPut(input);
                return {};
            case 'Update': {
                if (!checkUpdate(input)) throw err('ConditionalCheckFailedException');
                const { after } = doUpdate(input);
                if (input.ReturnValues === 'ALL_NEW') return { Attributes: clone(after) };
                if (input.ReturnValues === 'UPDATED_NEW') return { Attributes: clone(after) };
                return {};
            }
            case 'Query': {
                const v = input.ExpressionAttributeValues;
                const pk = v[':pk'];
                const cond = input.KeyConditionExpression.replace(/^pk = :pk\s*(AND\s*)?/, '');
                let rows = [...items.values()].filter(it => it.pk === pk)
                    .filter(it => !cond || evalCond(cond, it, input.ExpressionAttributeNames, v))
                    .sort((a, b) => (a.sk < b.sk ? -1 : a.sk > b.sk ? 1 : 0));
                if (input.ScanIndexForward === false) rows.reverse();
                if (input.Limit) rows = rows.slice(0, input.Limit);
                if (input.Select === 'COUNT') return { Count: rows.length };
                return { Items: clone(rows), Count: rows.length };
            }
            case 'TransactWrite': {
                const reasons = input.TransactItems.map(t => {
                    const [op, body] = Object.entries(t)[0];
                    const ok = op === 'Put' ? checkPut(body)
                        : op === 'Update' ? checkUpdate(body)
                            : op === 'ConditionCheck' ? evalCond(body.ConditionExpression, items.get(key(body.Key.pk, body.Key.sk)), body.ExpressionAttributeNames, body.ExpressionAttributeValues)
                                : true;
                    return { Code: ok ? 'None' : 'ConditionalCheckFailed' };
                });
                if (reasons.some(r => r.Code !== 'None')) throw err('TransactionCanceledException', { CancellationReasons: reasons });
                for (const t of input.TransactItems) {
                    const [op, body] = Object.entries(t)[0];
                    if (op === 'Put') doPut(body);
                    else if (op === 'Update') doUpdate(body);
                    else if (op === 'Delete') items.delete(key(body.Key.pk, body.Key.sk));
                }
                return {};
            }
            default:
                throw new Error(`fake-db: unsupported ${type}`);
        }
    }

    return { send, items, calls, get: (pk, sk) => clone(items.get(key(pk, sk))) };
}
