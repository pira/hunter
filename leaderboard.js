// Leaderboard client: global scores via the AWS Lambda API (config.js), with a local fallback.
(function (root) {
    const LOCAL_KEY = 'hunter.localScores';
    const NAME_KEY = 'hunter.playerName';
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

    function readLocal() {
        try {
            const list = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
            return Array.isArray(list) ? list : [];
        } catch (e) {
            return [];
        }
    }

    function writeLocal(list) {
        try {
            localStorage.setItem(LOCAL_KEY, JSON.stringify(list.slice(0, 20)));
        } catch (e) { /* storage unavailable */ }
    }

    const Leaderboard = {
        get enabled() {
            return Boolean(apiUrl());
        },

        getName() {
            try {
                return localStorage.getItem(NAME_KEY) || '';
            } catch (e) {
                return '';
            }
        },

        setName(name) {
            try {
                localStorage.setItem(NAME_KEY, name);
            } catch (e) { /* storage unavailable */ }
        },

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

        /** Save a finished run locally, then try the global board. */
        async submit(entry, token) {
            const record = { ...entry, ts: Date.now() };
            const local = readLocal();
            local.push(record);
            local.sort((a, b) => b.score - a.score);
            writeLocal(local);
            const localRank = local.indexOf(record) + 1;

            if (!this.enabled || !token) {
                return { source: 'local', rank: localRank, scores: local.slice(0, 10), error: this.enabled ? 'offline' : 'disabled' };
            }
            try {
                const body = await request('/scores', {
                    method: 'POST',
                    body: JSON.stringify({ ...entry, token })
                });
                return { source: 'global', rank: body.rank, id: body.id, scores: body.scores || [] };
            } catch (e) {
                const rejected = e.status >= 400 && e.status < 500;
                return { source: 'local', rank: localRank, scores: local.slice(0, 10), error: e.message, rejected };
            }
        }
    };

    root.Leaderboard = Leaderboard;
})(window);
