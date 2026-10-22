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
        this.setHtml('hearts', this.el.hearts, p.maxHp > 8
            ? `❤️ <b>${p.hp}</b>`
            : Array.from({ length: p.maxHp }, (_, i) => `<span class="${i < p.hp ? 'full' : 'empty'}">${i < p.hp ? '❤️' : '🖤'}</span>`).join(''));
        this.setText('level', this.el.level, `LV ${this.level}`);
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

        // Super meter: bar fills with kills; the button lights up when it's ready (or counts down a Whirlwind).
        const ready = this.superMeter >= 100 && this.whirl <= 0;
        const pct = this.whirl > 0 ? (this.whirl / WHIRLWIND_STEPS) * 100 : this.superMeter;
        this.el.superFill.style.width = `${pct.toFixed(1)}%`;
        const superState = `${ready}:${this.whirl > 0}:${this.cls}`;
        if (this.hud.super !== superState) {
            this.hud.super = superState;
            this.el.superBar.classList.toggle('ready', ready);
            this.el.superBar.classList.toggle('active', this.whirl > 0);
            this.el.superBtn.classList.toggle('ready', ready);
            this.el.superBtn.dataset.cls = this.cls;
            this.el.superBtn.innerHTML = `<span>${CLASSES[this.cls].icon}</span><b>${ready ? 'SUPER!' : 'SUPER'}</b>`;
        }

        const active = TIMED_POWERUPS.filter(t => this.timers[t] > 0);
        const buffs = LEVEL_BUFFS.filter(bf => this.buffs[bf.id]);
        this.setHtml('powerups', this.el.powerups,
            active.map(t => `<span class="pu" style="--c:${POWERUPS[t].color}">${POWERUPS[t].emoji}${POWERUPS[t].tag ? `<i>${POWERUPS[t].tag}</i>` : ''}` +
                `<b>${Math.ceil(this.timers[t] / (60 * GAME_SPEED))}</b></span>`).join('') +
            buffs.map(bf => `<span class="pu buff" title="${bf.name}">${bf.icon}<b>LV</b></span>`).join(''));
        this.setText('coins', this.el.coins, `🪙 ${this.coins}`);

        if (this.boss) {
            const pct = U.clamp(this.boss.hp / this.boss.maxHp, 0, 1);
            this.bossTrailPct = Math.max(pct, this.bossTrailPct - 0.004);
            this.el.bossFill.style.width = `${pct * 100}%`;
            this.el.bossTrail.style.width = `${this.bossTrailPct * 100}%`;
        }
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
        this.el.finalStats.innerHTML = stats.map(([k2, v]) => `<div><span>${k2}</span><b>${v}</b></div>`).join('');

        let best = 0;
        try {
            best = Number(localStorage.getItem('hunter.best') || 0);
            if (this.score > best) localStorage.setItem('hunter.best', String(this.score));
        } catch (e) { /* storage unavailable */ }
        this.el.newBest.hidden = !(this.score > best && this.score > 0);

        this.el.submitStatus.textContent = '';
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
    async submitScore() {
        const id = Leaderboard.identity();
        const name = (id && id.name) || 'Hunter';
        this.el.submitStatus.textContent = 'Saving your hunt…';
        const entry = {
            name, cls: this.cls, score: this.score, level: this.level, kills: this.kills,
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
    },

    async loadBoard(listEl, titleEl) {
        listEl.innerHTML = '<li class="muted">Loading…</li>';
        const { scores, source } = await Leaderboard.top(10);
        this.renderBoard(listEl, titleEl, scores, source);
    },

    renderBoard(listEl, titleEl, scores, source, mine) {
        titleEl.hidden = false;
        titleEl.textContent = source === 'global' ? '🏆 Top Hunters' : '🏆 Top Hunters (this device)';
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
            return `<li class="${isMine ? 'mine' : ''}"${pid}><span class="rank">${i + 1}</span><span class="name">${name}</span>` +
                `<span class="lvl">Lv ${Number(s.level) || 1}</span><span class="pts">${(Number(s.score) || 0).toLocaleString()}</span></li>`;
        }).join('');
        listEl.querySelectorAll('li[data-pid]').forEach(li => li.addEventListener('click', () => this.openProfile(li.dataset.pid)));
    }
});
