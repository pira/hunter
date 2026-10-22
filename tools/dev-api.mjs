// Local API for development/QA: the real Lambda handler (app.mjs) on an in-memory table.
// Usage: node tools/dev-api.mjs [port]   then point config.js leaderboardUrl at http://localhost:<port>
import http from 'node:http';
import { createApp } from '../leaderboard/lambda/app.mjs';
import { createFakeDb } from '../test/fake-db.mjs';

const port = Number(process.argv[2] || 8787);
const db = createFakeDb();
const app = createApp({ send: db.send, tokenSecret: 'dev-secret' });

http.createServer(async (req, res) => {
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET,POST' };
    if (req.method === 'OPTIONS') return res.writeHead(204, cors).end();
    let body = '';
    for await (const chunk of req) body += chunk;
    const url = new URL(req.url, 'http://x');
    // QA helper: POST /dev/seed { pid, ...fields } merges fields into an existing profile (dev only)
    if (req.method === 'POST' && url.pathname === '/dev/seed') {
        const { pid, ...fields } = JSON.parse(body || '{}');
        const meta = db.get(`player#${pid}`, 'meta');
        if (!meta) return res.writeHead(404, cors).end('{}');
        await db.send('Put', { Item: { ...meta, ...fields, version: (meta.version || 0) + 1 } });
        return res.writeHead(200, cors).end('{}');
    }
    const out = await app({
        requestContext: { http: { method: req.method, sourceIp: req.socket.remoteAddress } },
        rawPath: url.pathname,
        queryStringParameters: Object.fromEntries(url.searchParams),
        body
    });
    res.writeHead(out.statusCode, { ...out.headers, ...cors }).end(out.body);
}).listen(port, () => console.log(`dev API on http://localhost:${port}`));
