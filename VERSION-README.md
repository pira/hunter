# Automatic versioning

The version and build date shown on the start screen (`v2.0.0 · 2026-10-21`) live in `game.js`:

```js
this.version = "2.0.0";
this.buildDate = "2026-10-21";
```

A versioned git hook in `.githooks/pre-commit` bumps them (and `package.json`) on every commit.

## Setup (once per clone)

```bash
git config core.hooksPath .githooks
```

## Choosing the bump

```bash
git commit -m "Fix spawn bug"                 # patch: 2.0.0 -> 2.0.1 (default)
BUMP=minor git commit -m "New boss"           # minor: 2.0.1 -> 2.1.0
BUMP=major git commit -m "Big rewrite"        # major: 2.1.0 -> 3.0.0
BUMP=none  git commit -m "Docs only"          # no bump
```

Manual bump without committing: `python3 update-version.py "[minor]"` (or `node update-version.js "[minor]"`).

## Why it changed (v2.0.0)

The old setup ran the same bump from two untracked hooks in `.git/hooks` (`pre-commit` and `prepare-commit-msg`):

- every commit bumped the version **twice** (1.2.6 → 1.2.8 → 1.2.10 …);
- the second bump ran after git had already built the commit, so it was left behind as a staged, uncommitted change in `game.js`;
- `[minor]` / `[major]` were read from `.git/COMMIT_EDITMSG`, i.e. the **previous** commit's message;
- the hooks weren't in the repo, so other clones (and PRs merged on GitHub) never bumped at all.

The single tracked `pre-commit` hook with a `BUMP` variable fixes all four. `version-config.json` still sets the default strategy.
