/* Monster Hunter — hud: DOM HUD, banners, game over + leaderboard. Extends Game (js/core.js). */

extendGame({
    banner(title, sub = '', cls = '') {
        const el = this.el.banner;
        el.className = '';
        el.innerHTML = `<div class="title">${title}</div>${sub ? `<div class="sub">${sub}</div>` : ''}`;
        void el.offsetWidth; // restart the CSS animation
        el.className = `show ${cls}`;
    },

    setText(key, el, value) {
        if (this.hud[key] !== value) {
            this.hud[key] = value;
            el.textContent = value;
        }
    },

    setHtml(key, el, value) {
        if (this.hud[key] !== value) {
            this.hud[key] = value;
            el.innerHTML = value;
        }
    },

    updateHud() {
        if (this.state === 'menu') return;
        const p = this.player;
        const green = p.greenMax ? Array.from({ length: p.greenMax }, (_, i) => `<span class="${i < p.greenHp ? 'full' : 'empty'}">${i < p.greenHp ? '💚' : '🤍'}</span>`).join('') : '';
        this.setHtml('hearts', this.el.hearts, (p.maxHp > 8
            ? `❤️ <b>${p.hp}</b>`
            : Array.from({ length: p.maxHp }, (_, i) => `<span class="${i < p.hp ? 'full' : 'empty'}">${i < p.hp ? '❤️' : '🖤'}</span>`).join('')) + green);
        const phaseTag = { clear: ' ✓', encounter: ' ⚔️', loot: ' 🎁', travel: ' 🚩' }[this.phase] || '';
        this.setText('level', this.el.level, `LV ${this.level}${phaseTag}`);
        this.el.xpFill.style.width = `${(this.levelProgress() * 100).toFixed(1)}%`;
        this.setText('score', this.el.score, this.score.toLocaleString());

        const mult = U.comboMultiplier(this.combo);
        this.el.combo.classList.toggle('show', this.combo >= 2);
        this.el.combo.dataset.tier = mult;
        this.setText('comboMult', this.el.comboMult, `×${mult}`);
        const next = U.nextComboTier(this.combo);
        this.setText('comboCount', this.el.comboCount, next ? `${this.combo} combo · ${next - this.combo} to ×${mult + 1}` : `${this.combo} combo · MAX`);
        this.el.comboFill.style.width = `${(this.comboTimer / this.comboWindow) * 100}%`;
        this.el.combo.style.transform = `translateX(-50%) scale(${1 + (this.comboPop || 0) * 0.25})`;

        // Super: the ring in the lower right fills with kills, then turns into a round SUPER button.
        const running = this.superRunning;
        const ready = this.superMeter >= 100 && !running && this.state === 'playing';
        let pct = this.superMeter;
        if (this.whirl > 0) pct = (this.whirl / WHIRLWIND_STEPS) * 100;
        else if (running) pct = this.barrage && this.barrage.left > 0 ? Math.min(100, this.barrage.left * 5) : Math.min(100, (this.bombRain.left / 50) * 100);
        const pr = Math.round(pct);
        if (this.hud.superPct !== pr) {
            this.hud.superPct = pr;
            this.el.superBtn.style.setProperty('--p', pr);
        }
        const superState = `${ready}:${running}:${this.cls}`;
        if (this.hud.super !== superState) {
            this.hud.super = superState;
            this.el.superBtn.classList.toggle('ready', ready);
            this.el.superBtn.classList.toggle('active', running);
            this.el.superBtn.title = CLASSES[this.cls].superName;
            this.el.superBtn.innerHTML = `<span>${CLASSES[this.cls].icon}</span><b>SUPER</b>${this.isTouch ? '' : '<small>SPACE</small>'}`;
        }
        // Top-right: timed effects (countdown) → this level's cards (dashed) → owned upgrades (rank).
        const active = TIMED_POWERUPS.filter(t => this.timers[t] > 0);
        const buffs = LEVEL_BUFFS.filter(bf => this.buffs[bf.id]);
        const owned = UPGRADES.filter(u => this.stack(u.id) > 0);
        const room = Math.max(0, 8 - active.length - buffs.length);
        const shown = owned.slice(0, owned.length > room ? Math.max(0, room - 1) : room);
        const hidden = owned.length - shown.length;
        this.setHtml('powerups', this.el.powerups,
            active.map(t => `<span class="pu" style="--c:${POWERUPS[t].color}">${POWERUPS[t].pouch ? COIN : POWERUPS[t].emoji}${POWERUPS[t].tag ? `<i>${POWERUPS[t].tag}</i>` : ''}` +
                `<b>${Math.ceil(this.timers[t] / (60 * GAME_SPEED))}</b></span>`).join('') +
            buffs.map(bf => `<span class="pu buff" title="${bf.name}">${bf.icon}<b>LV</b></span>`).join('') +
            shown.map(u => `<span class="up" title="${u.name}">${u.icon}<sup>${this.stack(u.id)}</sup></span>`).join('') +
            (hidden > 0 ? `<button class="up more" data-more="1" aria-label="All upgrades">+${hidden}</button>` : ''));
        this.setHtml('coins', this.el.coins, `${COIN} ${this.coins}`);
        const sack = this.roadSack || {};
        // the boss sack: a crowned pouch collecting what the road took (shown as soon as something flies in)
        const flying = this.sackFlights && this.sackFlights.length;
        const sackTxt = sack.coins || sack.gems || sack.eggs || flying
            ? `<span class="sack-i">${POUCH}<b>👑</b></span>${sack.coins || ''}${sack.gems ? ` ${GEM}${sack.gems}` : ''}${sack.eggs ? ` 🥚${sack.eggs}` : ''}` : '';
        if (this.hud.sack !== sackTxt) {
            this.hud.sack = sackTxt;
            this.el.sack.hidden = !sackTxt;
            this.el.sack.innerHTML = sackTxt;
        }
        if (this.sackBump > 0) {
            if (this.sackBump === 12) {
                this.el.sack.classList.remove('bump');
                void this.el.sack.offsetWidth;
                this.el.sack.classList.add('bump');
            }
            this.sackBump--;
        }
        if (this.gems > 0) {
            this.el.gems.hidden = false;
            this.setHtml('gems', this.el.gems, `${GEM} ${this.gems}`);
        } else if (!this.el.gems.hidden) this.el.gems.hidden = true;

        if (this.boss) {
            const pct = this.bossHealth();
            this.bossTrailPct = Math.max(pct, this.bossTrailPct - 0.004);
            this.el.bossFill.style.width = `${pct * 100}%`;
            this.el.bossTrail.style.width = `${this.bossTrailPct * 100}%`;
        }
    },

    // ?stats: per-level calibration log (duration, effective damage, coins, kills, hits) for tuning.
    makeStatsLog() {
        let el = document.getElementById('statsLog');
        if (!el) {
            el = document.createElement('pre');
            el.id = 'statsLog';
            el.style.cssText = 'position:fixed;left:6px;bottom:6px;z-index:50;margin:0;max-height:45vh;overflow:auto;font:10px/1.3 monospace;color:#d9f99d;background:rgba(0,0,0,.72);padding:5px 7px;border-radius:6px;pointer-events:none';
            document.body.appendChild(el);
        }
        const log = {
            rows: [],
            start: { t: 0, earned: 0, spent: 0, kills: 0, hits: 0 },
            endLevel: g => {
                const row = {
                    L: g.level - 1, cls: g.cls, secs: Math.round(g.time - log.start.t), dmg: Math.round(g.target),
                    earned: g.coinsEarned - log.start.earned, spent: (g.coinsSpent || 0) - log.start.spent,
                    kills: g.kills - log.start.kills, hits: (g.hits || 0) - log.start.hits, expected: g.expectedIncome(g.level - 1)
                };
                log.rows.push(row);
                log.start = { t: g.time, earned: g.coinsEarned, spent: g.coinsSpent || 0, kills: g.kills, hits: g.hits || 0 };
                window.huntStats = log.rows;
                el.textContent = 'L  cls        secs  dmg  earned/exp  spent kills hits\n' + log.rows.map(r =>
                    `${String(r.L).padEnd(3)}${r.cls.padEnd(11)}${String(r.secs).padStart(4)} ${String(r.dmg).padStart(5)} ${String(r.earned).padStart(6)}/${String(r.expected).padEnd(4)} ${String(r.spent).padStart(5)} ${String(r.kills).padStart(5)} ${String(r.hits).padStart(4)}`).join('\n');
                console.table(log.rows);
            }
        };
        el.textContent = 'stats: per-level rows appear here';
        return log;
    },

    showGameOver() {
        this.state = 'gameover';
        this.releaseWakeLock();
        Sfx.setActive(false);
        this.timeScale = 1;
        this.el.bossBar.hidden = true;
        Sfx.playMusic('gameOver', 0.45);

        const killer = this.killer || { name: 'something', shape: 'circle', color: '#888', size: 12 };
        const icon = this.el.killerIcon.getContext('2d');
        icon.setTransform(1, 0, 0, 1, 0, 0);
        icon.clearRect(0, 0, 96, 96);
        icon.translate(48, 50);
        const size = killer.boss ? killer.boss.size : killer.size;
        const k = Math.min(2.2, 30 / size);
        icon.scale(k, k);
        if (killer.boss) {
            const fake = { ...killer, x: 0, y: 0, mode: 'fight', flash: 0 };
            const save = this.player;
            this.player = { x: 0, y: 80 };
            this.drawBoss(icon, fake);
            this.player = save;
        } else {
            Game.drawShape(icon, killer.shape === 'aura' ? 'circle' : killer.shape, size, killer.color);
            this.drawEyes(icon, { ...killer, spawnT: 0, dir: Math.PI / 2 }, size);
        }
        this.el.killedBy.textContent = `Slain by ${killer.boss ? killer.boss.name : killer.name}`;

        const stats = [
            ['Score', this.score.toLocaleString()],
            ['Level', this.level],
            ['Kills', this.kills],
            ['Best combo', this.bestCombo],
            ['Bosses', this.bossesSlain],
            ['Time', U.formatTime(this.time)]
        ];
        if (this.gems > 0) stats.push(['Gems', `${GEM} ${this.gems}`]);
        if (this.eggCards + this.bossEggs > 0) stats.push(['Eggs', '🥚'.repeat(Math.min(6, this.eggCards + this.bossEggs))]);
        this.el.finalStats.innerHTML = stats.map(([k2, v]) => `<div><span>${k2}</span><b>${v}</b></div>`).join('');

        let best = 0;
        try {
            best = Number(localStorage.getItem('hunter.best') || 0);
            if (this.score > best) localStorage.setItem('hunter.best', String(this.score));
        } catch (e) { /* storage unavailable */ }
        this.el.newBest.hidden = !(this.score > best && this.score > 0);

        this.el.submitStatus.textContent = '';
        this.el.bankBox.hidden = true;
        this.pot = null;
        this.el.finalBoard.innerHTML = '';
        this.el.finalBoardTitle.hidden = true;
        this.gameOverAt = performance.now();
        this.setOverlay('gameover');
        if (this.score > 0) this.submitScore();
        else this.loadBoard(this.el.finalBoard, this.el.finalBoardTitle);
        setTimeout(() => {
            if (this.state === 'gameover') this.el.againBtn.focus();
        }, 300);
    },

    // Runs are submitted automatically under the player's stored identity.
    /** Snapshot of the run's counters: a boss summary shows the difference since the last one. */
    stageSnapshot() {
        return {
            level: this.level, time: this.time, coins: this.coinsEarned || 0, kills: this.kills || 0, hits: this.hits || 0,
            hearts: this.heartsLost || 0, green: this.greenLost || 0, gems: this.gems || 0, eggs: (this.eggCards || 0) + (this.bossEggs || 0), score: this.score
        };
    },

    showBossStats() {
        const now = this.stageSnapshot();
        const was = this.stageStart || { level: 1, time: 0, coins: 0, kills: 0, hits: 0, hearts: 0, green: 0, gems: 0, eggs: 0, score: 0 };
        const k = this.bossKill || { name: 'The boss', secs: 0 };
        const d = key => now[key] - was[key];
        this.state = 'bossStats';
        this.releaseStick();
        this.keys = {};
        const $ = id => document.getElementById(id);
        $('bsTitle').textContent = `👑 ${k.name.toUpperCase()} DEFEATED!`;
        $('bsSub').textContent = `Level ${this.level} · levels ${was.level}–${this.level} · fight ${U.formatTime(k.secs)}`;
        const r = this.lastSackReturn;
        $('bsTrophies').innerHTML = r && (r.coins || r.gems || r.eggs)
            ? `👑 Road trophies back: <b>${COIN} ${r.coins}</b>${r.gems ? ` · <b>${GEM} ${r.gems}</b>` : ''}${r.eggs ? ` · <b>🥚 ${r.eggs}</b>` : ''}`
            : '✨ The road kept nothing — perfect collecting!';
        const hearts = d('hearts');
        const green = d('green');
        const stats = [
            ['Coins earned', `${COIN} ${d('coins').toLocaleString()}`],
            ['Gems found', `${GEM} ${d('gems')}`],
            ['Kills', d('kills').toLocaleString()],
            ['Hearts lost', hearts || green ? `${hearts ? `❤️ ${hearts}` : ''}${green ? ` 💚 ${green}` : ''}` : 'none! 🏅'],
            ['Score', `+${d('score').toLocaleString()}`],
            ['Time', U.formatTime(d('time'))]
        ];
        if (d('eggs')) stats.splice(2, 0, ['Eggs', `🥚 ${d('eggs')}`]);
        $('bsGrid').innerHTML = stats.map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('');
        $('bsRun').innerHTML = `Whole run: ${COIN} ${now.coins.toLocaleString()} earned · ${now.kills.toLocaleString()} kills · ` +
            `${now.hearts + now.green ? `${now.hearts + now.green} ${now.hearts + now.green === 1 ? 'heart' : 'hearts'} lost` : 'no hearts lost'} · ${this.bossesSlain} ${this.bossesSlain === 1 ? 'boss' : 'bosses'}`;
        this.setOverlay('bossStats');
        Sfx.arpeggio([523, 659, 784, 1046, 1318], 0.07, { type: 'triangle', volume: 0.12 });
        this.bossStatsAt = performance.now();
        setTimeout(() => { if (this.state === 'bossStats') document.getElementById('bsContinue').focus(); }, 420);
    },

    closeBossStats() {
        if (this.state !== 'bossStats' || performance.now() - (this.bossStatsAt || 0) < 400) return;
        this.stageStart = this.stageSnapshot();
        this.stageStart.level = this.level + 1; // the next stage starts with the next level
        this.state = 'playing';
        this.setOverlay(null);
        this.lastTime = performance.now();
        this.startTravel();
    },

    async submitScore() {
        const id = Leaderboard.identity();
        const name = (id && id.name) || 'Hunter';
        this.el.submitStatus.textContent = 'Saving your hunt…';
        const entry = {
            name, cls: this.cls, skin: this.skin || undefined, coins: Math.max(0, Math.floor(this.coins)), gems: this.gems || 0, eggs: this.eggCards || undefined, bossEggs: this.bossEggs || undefined, score: this.score, level: this.level, kills: this.kills,
            combo: this.bestCombo, bosses: this.bossesSlain, duration: Math.max(1, Math.round(this.time))
        };
        const runId = this.runId;
        const result = await Leaderboard.submit(entry, this.runToken);
        if (runId !== this.runId || this.state !== 'gameover') return; // player already moved on
        if (result.source === 'global') {
            this.el.submitStatus.textContent = result.rank <= 10 ? `🏆 You placed #${result.rank} worldwide!` : `You placed #${result.rank} worldwide`;
        } else {
            this.el.submitStatus.textContent = result.error === 'disabled'
                ? `Saved on this device (#${result.rank})`
                : result.rejected
                    ? `Saved on this device (#${result.rank}) — global board refused it: ${result.error}`
                    : `Saved on this device (#${result.rank}) — will upload when you're back online`;
        }
        this.renderBoard(this.el.finalBoard, this.el.finalBoardTitle, result.scores, result.source, { id: result.id, name, score: this.score });
        if (result.pot) this.showPot(result.pot, result.player && result.player.gold);
    },

    showBoardTabs() {
        const sel = this.boardSel || { board: Leaderboard.board, cls: '' };
        document.querySelectorAll('#boardTabs button').forEach(b => b.classList.toggle('on', b.dataset.board === sel.board));
        document.querySelectorAll('#clsTabs button').forEach(b => b.classList.toggle('on', b.dataset.cls === sel.cls));
        document.getElementById('clsTabs').hidden = sel.board !== 'v3';
    },

    async loadBoard(listEl, titleEl, board = Leaderboard.board, cls = '') {
        listEl.innerHTML = '<li class="muted">Loading…</li>';
        const want = `${board}|${cls}`;
        listEl.dataset.want = want;
        const { scores, source } = await Leaderboard.top(10, board, board === 'v3' ? cls : '');
        if (listEl.dataset.want !== want) return; // a newer tab click won
        this.renderBoard(listEl, titleEl, scores, source, null, board, cls);
    },

    renderBoard(listEl, titleEl, scores, source, mine, board = Leaderboard.board, cls = '') {
        titleEl.hidden = false;
        titleEl.textContent = (board === 'v2' ? '🏆 Classic Hunters' : cls && CLASSES[cls] ? `🏆 Top ${CLASSES[cls].name}s` : '🏆 Top Hunters') + (source === 'global' ? '' : ' (this device)');
        if (!scores.length) {
            listEl.innerHTML = '<li class="muted">No scores yet — be the first!</li>';
            return;
        }
        let marked = false;
        listEl.innerHTML = scores.slice(0, 10).map((s, i) => {
            const isMine = mine && !marked && ((mine.id && s.id === mine.id) || (!mine.id && s.name === mine.name && s.score === mine.score));
            if (isMine) marked = true;
            const name = String(s.name).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
            const pid = typeof s.playerId === 'string' && /^[0-9a-f-]{36}$/.test(s.playerId) ? ` data-pid="${s.playerId}"` : '';
            return `<li class="${isMine ? 'mine' : ''}"${pid}><span class="rank">${i + 1}</span><span class="name${SKINS[s.skin] && SKINS[s.skin].rarity === 'mythic' ? ' glow' : ''}">${CLASSES[s.cls] ? `<span class="cls-i">${CLASSES[s.cls].icon}</span>` : ''}${name}</span>` +
                `<span class="lvl">Lv ${Number(s.level) || 1}</span><span class="pts">${(Number(s.score) || 0).toLocaleString()}</span></li>`;
        }).join('');
        listEl.querySelectorAll('li[data-pid]').forEach(li => li.addEventListener('click', () => this.openProfile(li.dataset.pid)));
    }
});
