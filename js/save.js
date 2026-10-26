/* Monster Hunter — saving the run in progress (v3.4): a snapshot goes to localStorage whenever you
   pause, switch away, close the page, open the shop, and every few seconds while playing. After a
   reload (or a frozen tab) the menu offers to resume it. A resumed run restarts the level it was in
   (keeping the level bar), or opens the shop if you were between levels. Extends Game (js/core.js). */

const RUN_SAVE_KEY = 'hunter.savedRun';
const RUN_SAVE_MAX_AGE = 7 * 24 * 3600 * 1000; // the server accepts run tokens for a week

extendGame({
    /** Counters an encounter changes when it starts: kept from the start of the level for a clean restart. */
    markLevelStart() {
        if (this.stageSnapshot) this.levelSnap = this.stageSnapshot();
        this.levelStartState = {
            regularCount: this.regularCount, smallCount: this.smallCount, bigCount: this.bigCount, bossCount: this.bossCount,
            decks: JSON.parse(JSON.stringify(this.decks || {}))
        };
    },

    saveRun() {
        if (!this.runActive() || this.state === 'dying' || this.state === 'gameover' || !this.player) return;
        const id = Leaderboard.identity();
        if (!id) return;
        let where = 'fight';
        if (this.state === 'levelup' || this.phase === 'shop') where = 'shop';
        else if (this.state === 'bossStats' || this.phase === 'loot' || this.phase === 'travel') where = 'next';
        else if (this.phase === 'clear' || this.phase === 'encounter') where = 'encounter';
        // an encounter restarts from scratch, so its counters come from the start of the level
        const counters = where === 'fight' || where === 'encounter' ? this.levelStartState || {} : {
            regularCount: this.regularCount, smallCount: this.smallCount, bigCount: this.bigCount, bossCount: this.bossCount, decks: this.decks
        };
        const sack = { ...(this.roadSack || { coins: 0, gems: 0, eggs: 0 }) };
        for (const f of this.sackFlights || []) {
            if (f.kind === 'egg') sack.eggs++;
            else if (f.kind === 'gem') sack.gems++;
            else sack.coins += f.value;
        }
        const p = this.player;
        const snap = {
            v: 1, at: Date.now(), game: this.version, pid: id.id, where, cls: this.cls, diff: this.diff || 1, level: this.level,
            progress: where === 'fight' ? Math.min(this.progress, this.target * 0.95) : 0,
            score: this.score, kills: this.kills, time: this.time, bestCombo: this.bestCombo, bossesSlain: this.bossesSlain,
            regularCount: counters.regularCount || 0, smallCount: counters.smallCount || 0, bigCount: counters.bigCount || 0,
            bossCount: counters.bossCount || 0, decks: counters.decks || {},
            coins: this.coins, coinsEarned: this.coinsEarned, coinsSpent: this.coinsSpent, coinFrac: this.coinFrac, gems: this.gems,
            roadSack: sack, heartsLost: this.heartsLost, greenLost: this.greenLost, stageStart: this.stageStart,
            eggCards: this.eggCards, bossEggs: this.bossEggs, hits: this.hits, levelCoinsStart: this.levelCoinsStart, incomeEMA: this.incomeEMA,
            buffs: this.buffs, stacks: this.stacks, superMeter: this.superMeter, timers: this.timers,
            hp: p.hp, maxHp: p.maxHp, greenHp: p.greenHp, headerShown: this.state === 'levelup',
            token: this.runToken
        };
        try {
            localStorage.setItem(RUN_SAVE_KEY, JSON.stringify(snap));
        } catch (e) { /* storage full or blocked: nothing to do */ }
    },

    clearSavedRun() {
        try {
            localStorage.removeItem(RUN_SAVE_KEY);
        } catch (e) { /* storage unavailable */ }
        this.showResume();
    },

    /** The saved run for this hunter, if it is recent enough to still count. */
    savedRun() {
        try {
            const snap = JSON.parse(localStorage.getItem(RUN_SAVE_KEY));
            const id = Leaderboard.identity();
            if (!snap || snap.v !== 1 || !id || snap.pid !== id.id || !CLASSES[snap.cls]) return null;
            if (Date.now() - snap.at > RUN_SAVE_MAX_AGE) return null;
            return snap;
        } catch (e) {
            return null;
        }
    },

    /** The menu's "Resume" button. */
    showResume() {
        const btn = document.getElementById('resumeBtn');
        if (!btn) return;
        const snap = this.state === 'menu' ? this.savedRun() : null;
        btn.hidden = !snap;
        if (snap) btn.innerHTML = `⏯ RESUME <small>${CLASSES[snap.cls].icon}${snap.diff > 1 && DIFFICULTIES[snap.diff] ? DIFFICULTIES[snap.diff].icon : ''} level ${snap.level} · ${snap.score.toLocaleString()} pts</small>`;
    },

    resumeRun() {
        const snap = this.savedRun();
        if (!snap) return this.startRun();
        Sfx.unlock();
        Sfx.stopMusic();
        this.cls = snap.cls;
        this.resetRun();
        this.diff = DIFFICULTIES[snap.diff] ? snap.diff : 1; // a resumed hunt keeps its difficulty
        this.releaseStick();
        this.runId = (this.runId || 0) + 1;
        this.attract = [];
        const keys = ['level', 'score', 'kills', 'time', 'bestCombo', 'bossesSlain', 'regularCount', 'smallCount', 'bigCount', 'bossCount',
            'coins', 'coinsEarned', 'coinsSpent', 'coinFrac', 'gems', 'heartsLost', 'greenLost', 'eggCards', 'bossEggs', 'hits',
            'levelCoinsStart', 'incomeEMA', 'superMeter'];
        for (const k of keys) if (typeof snap[k] === 'number') this[k] = snap[k];
        this.decks = snap.decks || {};
        this.roadSack = snap.roadSack || { coins: 0, gems: 0, eggs: 0 };
        this.stageStart = snap.stageStart || null;
        this.buffs = snap.buffs || {};
        this.stacks = snap.stacks || {};
        this.timers = { ...this.timers, ...(snap.timers || {}) };
        this.runToken = snap.token || null;
        this.state = 'playing';
        this.setOverlay(null);
        this.el.hud.classList.remove('hidden');
        this.el.bossBar.hidden = true;
        this.lastTime = performance.now();
        this.acc = 0;
        this.loadArtefacts();
        this.chargeMult = this.artefactMult('charge');
        const p = this.player;
        p.maxHp = snap.maxHp || p.maxHp;
        p.hp = Math.max(1, Math.min(p.maxHp, snap.hp || p.hp));
        this.syncTurtle();
        if (typeof snap.greenHp === 'number') p.greenHp = Math.min(p.greenMax, snap.greenHp);
        this.enterGameMode(true);
        if (snap.where === 'shop' || snap.where === 'next') {
            if (snap.where === 'next') {
                this.level++; // the level was won: carry on with the shop for the next one
                this.buffs = {};
                this.levelCoinsStart = this.coinsEarned;
            }
            this.biome = this.biomeFor(this.level);
            this.phase = 'shop';
            this.pendingLevels = 1;
            this.markLevelStart();
            this.headerShown = Boolean(snap.headerShown); // the level bonus was already paid when the shop opened
            this.openCards('level');
        } else {
            this.startLevel();
            if (snap.where === 'fight' && snap.progress > 0) this.progress = snap.progress;
        }
        const d = DIFFICULTIES[this.diff];
        this.banner('WELCOME BACK!', `${d.k > 1 ? `${d.icon} ${d.name} · ` : ''}Level ${this.level} · ${this.biome.name}`);
        Sfx.arpeggio([392, 523, 659], 0.08, { type: 'triangle', volume: 0.12 });
        this.saveRun();
    }
});
