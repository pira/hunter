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
    const out = await app({
        requestContext: { http: { method: req.method, sourceIp: req.socket.remoteAddress } },
        rawPath: url.pathname,
        queryStringParameters: Object.fromEntries(url.searchParams),
        body
    });
    res.writeHead(out.statusCode, { ...out.headers, ...cors }).end(out.body);
}).listen(port, () => console.log(`dev API on http://localhost:${port}`));
