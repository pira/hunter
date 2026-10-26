# Leaderboard API

Serverless backend for the global score table: one Lambda (Node.js 22) behind a public **function URL**, one on-demand DynamoDB table. Costs effectively nothing at hobby traffic.

| Route | Body | Returns |
|---|---|---|
| `GET /scores?limit=10` | – | `{ scores: [{ id, name, score, level, kills, combo, bosses, duration, ts }] }` |
| `POST /run` | `{}` | `{ token }` — signed, single-use run token, requested when a run starts |
| `POST /scores` | `{ name, score, level, kills, combo, bosses, duration, token, playerId?, secret? }` | `{ id, rank, scores, player? }` |
| `GET /player/{id}` | – | `{ player, runs }` — public profile + last 20 runs (never the secret hash) |
| `POST /player/{id}/name` | `{ secret, name }` | `{ player }` |
| `POST /player/{id}/spin` | `{ secret, pot, spins }` | `{ win, pot, gold }` — double or nothing, rolled server-side (`WHEEL_WIN` 0.5) |
| `POST /player/{id}/bank` | `{ secret, pot }` | `{ gold, pot }` — closes the pot |
| `POST /player/{id}/buy` | `{ secret, item: 'artefact'\|'skin', id, tier? }` | `{ player }` — conditional on gold, previous tier and best-level gate |
| `POST /player/{id}/equip` | `{ secret, cls, skin }` | `{ player }` — must own the skin (`''` takes it off) |

v3 runs send `board: 'v3', cls, coins` (unspent gold) and, on Hard/Hell, `diff: 2 | 3`. They land on `board#v3`
(`board#v3#hard` / `board#v3#hell` when the class's mastery unlocks that difficulty, else the run counts as Normal);
`GET /scores?board=v3[&diff=2|3]` reads them. Hard/Hell runs get ×2/×4 coin and gem caps (`DIFF_K`); the submit response says
which board the run landed on (`diff`). `GET /scores?board=v3` reads the Normal board
(default stays the Classic `board#v2`). v3 plausibility: `level ≤ 2 + duration/12`, score ≤ 1000 + 4000/s,
kills ≤ 60 + 25/s, `coins ≤ coinCap(kills, bosses, level)`. The submit transaction credits the unspent gold to the
profile and opens a pot (`pk=pot#<nonce>`, TTL 24 h) the wheel can ride on; every spin is one transaction
conditioned on the pot's spin count and the profile's gold, so double taps and client-side gold edits do nothing.
The board row's skin comes from the profile's equipped skin, never from the client. Catalog prices and gates live
in `lambda/catalog.mjs` (mirrored in `js/config-data.js`; `test/catalog.test.mjs` keeps them in sync).

## Identity

Each browser creates `hunter.identity = { id (uuid v4), secret (32 random bytes), name }` on first launch. The first
submit with a `playerId` claims it by storing `sha256(secret)`; later writes must present the same secret, so a uuid read
off the public board can't be used to write to someone's profile. A submit writes the nonce, the board row, the run row and
the profile in one `TransactWriteItems`, with an optimistic lock on the profile's `version`. The profile's recovery code
(base64 of id + secret) moves a hunter to another browser.

Code layout: `lambda/app.mjs` holds all request handling and talks to DynamoDB through an injected `send(type, input)`;
`lambda/index.mjs` wires it to the AWS SDK. `test/lambda.test.mjs` runs the app against `test/fake-db.mjs`, and
`node tools/dev-api.mjs` serves the same app on an in-memory table for local QA.

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
- IAM: `Query`, `GetItem`, `PutItem`, `UpdateItem`, `ConditionCheckItem` on the table (transactions are authorised per contained action).
- `TOKEN_SECRET` is a random value set as a Lambda environment variable; it is not in the repo.

## Deploy

```bash
./leaderboard/deploy.sh ap-southeast-1   # first deploy / infrastructure (admin rights)
./leaderboard/update.sh ap-southeast-1   # code + table permissions only (iam:PutRolePolicy, lambda:UpdateFunctionCode)
```

Creates/updates the table `monster-hunter-scores`, the role and the function `monster-hunter-leaderboard`, and prints the function URL. Put that URL in `config.js` → `leaderboardUrl`, commit and push. CORS is configured on the function URL for `oleg.manida.com`, `pira.github.io` and `localhost:8000`.

With `leaderboardUrl` empty (or the API down) the game keeps a per-device top list in `localStorage` and labels it "this device".
