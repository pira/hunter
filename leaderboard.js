// Leaderboard + identity client: global scores and player profiles via the AWS Lambda API (config.js),
// with a device-local fallback board and history when the API is unreachable.
(function (root) {
    const LOCAL_KEY = 'hunter.localScores';
    const NAME_KEY = 'hunter.playerName';
    const ID_KEY = 'hunter.identity';
    const PENDING_KEY = 'hunter.pendingSubmit';
    const HISTORY_KEY = 'hunter.history';
    const TOKEN_MAX_AGE = 6 * 3600 * 1000;
    const TIMEOUT_MS = 6000;

    function apiUrl() {
        const url = (root.HUNTER_CONFIG && root.HUNTER_CONFIG.leaderboardUrl) || '';
        return url.replace(/\/+$/, '');
    }

    async function request(path, options = {}) {
        const base = apiUrl();
        if (!base) throw new Error('Leaderboard API not configured');
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        try {
            const response = await fetch(base + path, {
                ...options,
                headers: { 'content-type': 'application/json' },
                signal: controller.signal
            });
            const body = await response.json().catch(() => ({}));
            if (!response.ok) {
                const error = new Error(body.error || `HTTP ${response.status}`);
                error.status = response.status;
                throw error;
            }
            return body;
        } finally {
            clearTimeout(timer);
        }
    }

    function read(key, fallback) {
        try {
            const v = JSON.parse(localStorage.getItem(key));
            return v == null ? fallback : v;
        } catch (e) {
            return fallback;
        }
    }

    function write(key, value) {
        try {
            if (value == null) localStorage.removeItem(key);
            else localStorage.setItem(key, JSON.stringify(value));
        } catch (e) { /* storage unavailable */ }
    }

    function readLocal() {
        const list = read(LOCAL_KEY, []);
        return Array.isArray(list) ? list : [];
    }

    // crypto.getRandomValues works on plain-http LAN testing, where randomUUID doesn't.
    function randomBytes(n) {
        const a = new Uint8Array(n);
        (root.crypto || root.msCrypto).getRandomValues(a);
        return a;
    }

    function uuid4() {
        const b = randomBytes(16);
        b[6] = (b[6] & 0x0f) | 0x40;
        b[8] = (b[8] & 0x3f) | 0x80;
        const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
        return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
    }

    function base64url(bytes) {
        let s = '';
        bytes.forEach(b => { s += String.fromCharCode(b); });
        return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    const Leaderboard = {
        get enabled() {
            return Boolean(apiUrl());
        },

        // ---- identity

        /** { id, secret, name, createdAt } or null before the player picked a name. */
        identity() {
            const id = read(ID_KEY, null);
            return id && id.id && id.secret ? id : null;
        },

        getName() {
            const id = this.identity();
            if (id && id.name) return id.name;
            try {
                return localStorage.getItem(NAME_KEY) || '';
            } catch (e) {
                return '';
            }
        },

        /** Creates the identity on first use; later calls just rename (and tell the server). */
        setName(name) {
            let id = this.identity();
            if (!id) id = { id: uuid4(), secret: base64url(randomBytes(32)), name, createdAt: Date.now() };
            const renamed = id.name && id.name !== name;
            id.name = name;
            write(ID_KEY, id);
            try {
                localStorage.setItem(NAME_KEY, name);
            } catch (e) { /* storage unavailable */ }
            if (renamed && this.enabled) {
                request(`/player/${id.id}/name`, { method: 'POST', body: JSON.stringify({ secret: id.secret, name }) }).catch(() => {});
            }
            return id;
        },

        recoveryCode() {
            const id = this.identity();
            return id ? btoa(JSON.stringify({ i: id.id, s: id.secret, n: id.name })).replace(/=+$/, '') : '';
        },

        /** Restores an identity from a recovery code. Returns the identity or null if the code is bad. */
        restore(code) {
            try {
                const c = String(code || '').trim();
                const data = JSON.parse(atob(c + '==='.slice((c.length + 3) % 4)));
                if (!/^[0-9a-f-]{36}$/.test(data.i) || !/^[A-Za-z0-9_-]{32,128}$/.test(data.s)) return null;
                const id = { id: data.i, secret: data.s, name: String(data.n || 'Hunter').slice(0, 16), createdAt: Date.now() };
                write(ID_KEY, id);
                return id;
            } catch (e) {
                return null;
            }
        },

        // ---- runs

        /** Ask the server for a signed run token at game start. Resolves to null when offline. */
        async startRun() {
            try {
                const body = await request('/run', { method: 'POST', body: '{}' });
                return body.token || null;
            } catch (e) {
                return null;
            }
        },

        /** Top scores. Returns { scores, source: 'global' | 'local' }. */
        async top(limit = 10) {
            try {
                const body = await request(`/scores?limit=${limit}`);
                return { scores: body.scores || [], source: 'global' };
            } catch (e) {
                return { scores: readLocal().slice(0, limit), source: 'local' };
            }
        },

        recordLocal(entry) {
            const id = this.identity();
            const record = { ...entry, ts: Date.now(), playerId: id ? id.id : undefined };
            const local = readLocal();
            local.push(record);
            local.sort((a, b) => b.score - a.score);
            write(LOCAL_KEY, local.slice(0, 20));
            const history = read(HISTORY_KEY, []);
            history.unshift({ score: entry.score, level: entry.level, kills: entry.kills, combo: entry.combo, bosses: entry.bosses, duration: entry.duration, ts: record.ts, cls: entry.cls });
            write(HISTORY_KEY, history.slice(0, 20));
            return { record, rank: local.indexOf(record) + 1, scores: local.slice(0, 10) };
        },

        /** Save a finished run locally, then try the global board (queued for later if offline). */
        async submit(entry, token) {
            const local = this.recordLocal(entry);
            if (!this.enabled || !token) {
                return { source: 'local', rank: local.rank, scores: local.scores, error: this.enabled ? 'offline' : 'disabled' };
            }
            const id = this.identity();
            const body = { ...entry, token };
            if (id) Object.assign(body, { playerId: id.id, secret: id.secret, name: id.name });
            try {
                const res = await request('/scores', { method: 'POST', body: JSON.stringify(body) });
                if (res.player) this.cacheProfile(res.player);
                return { source: 'global', rank: res.rank, id: res.id, scores: res.scores || [], player: res.player };
            } catch (e) {
                const rejected = e.status >= 400 && e.status < 500;
                if (!rejected) write(PENDING_KEY, { body, at: Date.now() }); // network trouble: retry on next launch
                return { source: 'local', rank: local.rank, scores: local.scores, error: e.message, rejected, queued: !rejected };
            }
        },

        /** Retry a submission that failed for network reasons, while its run token is still valid. */
        async flushPending() {
            const pending = read(PENDING_KEY, null);
            if (!pending || !this.enabled) return null;
            const issued = Number(String(pending.body.token || '').split('.')[0]);
            if (!issued || Date.now() - issued > TOKEN_MAX_AGE - 60000) {
                write(PENDING_KEY, null);
                return null;
            }
            try {
                const res = await request('/scores', { method: 'POST', body: JSON.stringify(pending.body) });
                write(PENDING_KEY, null);
                if (res.player) this.cacheProfile(res.player);
                return res;
            } catch (e) {
                if (e.status >= 400 && e.status < 500) write(PENDING_KEY, null);
                return null;
            }
        },

        // ---- profiles

        cacheProfile(player) {
            const id = this.identity();
            if (id && player && player.id === id.id) write('hunter.profileCache', { ...read('hunter.profileCache', {}), ...player, at: Date.now() });
        },

        cachedProfile() {
            return read('hunter.profileCache', null);
        },

        localHistory() {
            return read(HISTORY_KEY, []);
        },

        /** Public profile { player, runs, source }. Own profile falls back to device history offline. */
        async profile(playerId) {
            const id = this.identity();
            const mine = id && id.id === playerId;
            try {
                const res = await request(`/player/${encodeURIComponent(playerId)}`);
                if (mine) this.cacheProfile(res.player);
                return { ...res, source: 'global', mine };
            } catch (e) {
                if (!mine) return { error: e.status === 404 ? 'This hunter has no saved runs yet.' : 'Profile unavailable offline.' };
                const runs = this.localHistory();
                const sum = k => runs.reduce((n, r) => n + (Number(r[k]) || 0), 0);
                const cache = this.cachedProfile() || {};
                return {
                    source: 'local', mine,
                    player: {
                        id: id.id, name: id.name, createdAt: id.createdAt,
                        bestScore: Math.max(cache.bestScore || 0, ...runs.map(r => r.score || 0), 0),
                        bestLevel: Math.max(cache.bestLevel || 0, ...runs.map(r => r.level || 0), 0),
                        runs: Math.max(cache.runs || 0, runs.length), kills: Math.max(cache.kills || 0, sum('kills')),
                        bosses: Math.max(cache.bosses || 0, sum('bosses')), playSeconds: Math.max(cache.playSeconds || 0, sum('duration'))
                    },
                    runs
                };
            }
        }
    };

    root.Leaderboard = Leaderboard;
})(window);
