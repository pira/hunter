# Leaderboard API

Serverless backend for the global score table: one Lambda (Node.js 22) behind a public **function URL**, one on-demand DynamoDB table. Costs effectively nothing at hobby traffic.

| Route | Body | Returns |
|---|---|---|
| `GET /scores?limit=10` | – | `{ scores: [{ id, name, score, level, kills, combo, bosses, duration, ts }] }` |
| `POST /run` | `{}` | `{ token }` — signed, single-use run token, requested when a run starts |
| `POST /scores` | `{ name, score, level, kills, combo, bosses, duration, token }` | `{ id, rank, scores }` |

## Cheat resistance (lightweight)

The game runs in the browser, so scores can't be made tamper-proof; this only blocks the lazy stuff:

- the run token is HMAC-signed and single-use, and the claimed `duration` must fit in the real time since it was issued;
- `level` must be reachable with `score` (same XP curve as `game-utils.js`), score/kills per second are capped, `combo ≤ kills`;
- max 6 submissions per IP per minute; names are sanitized server-side.

If you change the level curve in `game-utils.js`, change `xpToNextLevel` in `lambda/index.mjs` too.

## Live deployment

- API: `https://76wwgfhngo2igizow7qpuxyhy40ofeom.lambda-url.ap-southeast-1.on.aws` (set in `config.js`)
- AWS account 318456756271, region `ap-southeast-1`: Lambda `monster-hunter-leaderboard` (Node.js 22, arm64, reserved concurrency 10, logs kept 30 days), DynamoDB table `monster-hunter-scores` (on-demand, TTL on `ttl`), IAM role `monster-hunter-leaderboard`. All tagged `project=monster-hunter`.
- `monster-hunter-deploy-318456756271` (private S3 bucket) holds the uploaded Lambda zip.
- `TOKEN_SECRET` is a random value set as a Lambda environment variable; it is not in the repo.

## Deploy

```bash
./leaderboard/deploy.sh ap-southeast-1
```

Creates/updates the table `monster-hunter-scores`, the role and the function `monster-hunter-leaderboard`, and prints the function URL. Put that URL in `config.js` → `leaderboardUrl`, commit and push. CORS is configured on the function URL for `oleg.manida.com`, `pira.github.io` and `localhost:8000`.

With `leaderboardUrl` empty (or the API down) the game keeps a per-device top list in `localStorage` and labels it "this device".
