/* Monster Hunter — profile: identity, menu greeting, profile overlay. Extends Game (js/core.js). */

extendGame({
    bindIdentity() {
        const $ = id => document.getElementById(id);
        Object.assign(this.el, {
            whoForm: $('whoForm'), whoInput: $('whoInput'), whoHello: $('whoHello'), whoName: $('whoName'),
            whoNameText: $('whoNameText'), whoEdit: $('whoEdit'), whoAvatar: $('whoAvatar'), restoreRow: $('restoreRow'),
            restoreInput: $('restoreInput'), profile: $('profile'), profileName: $('profileName'), profileSince: $('profileSince'),
            profileStats: $('profileStats'), profileRuns: $('profileRuns'), profileOwn: $('profileOwn'), profileCode: $('profileCode'),
            profileCodeText: $('profileCodeText'), profileAvatar: $('profileAvatar')
        });
        this.el.whoForm.addEventListener('submit', e => {
            e.preventDefault();
            const name = U.sanitizeName(this.el.whoInput.value);
            if (!name) {
                this.nudge(this.el.whoInput);
                this.el.whoInput.focus();
                return;
            }
            const first = !Leaderboard.identity();
            Leaderboard.setName(name);
            this.el.whoInput.blur();
            this.refreshWho();
            if (first) Sfx.arpeggio([523, 659, 784], 0.06, { type: 'triangle', volume: 0.1 });
            if (this.el.profile.classList.contains('show')) this.openProfile(Leaderboard.identity().id);
        });
        $('restoreLink').addEventListener('click', () => {
            this.el.restoreRow.hidden = !this.el.restoreRow.hidden;
            if (!this.el.restoreRow.hidden) this.el.restoreInput.focus();
        });
        $('restoreBtn').addEventListener('click', () => {
            const id = Leaderboard.restore(this.el.restoreInput.value);
            if (!id) {
                this.nudge(this.el.restoreInput);
                return;
            }
            this.el.restoreInput.value = '';
            this.el.restoreRow.hidden = true;
            this.refreshWho();
            this.banner('WELCOME BACK!', id.name);
        });
        this.el.whoName.addEventListener('click', () => {
            const id = Leaderboard.identity();
            if (id) this.openProfile(id.id);
        });
        this.el.whoEdit.addEventListener('click', () => this.askName(true));
        $('profileClose').addEventListener('click', () => this.closeProfile());
        this.el.profile.addEventListener('click', e => {
            if (e.target === this.el.profile) this.closeProfile();
        });
        $('profileRename').addEventListener('click', () => {
            this.closeProfile();
            if (this.state === 'menu') this.askName(true);
        });
        $('profileCodeBtn').addEventListener('click', () => {
            this.el.profileCode.hidden = !this.el.profileCode.hidden;
            this.el.profileCodeText.textContent = Leaderboard.recoveryCode();
        });
        $('profileCopy').addEventListener('click', e => {
            const btn = e.currentTarget;
            const text = Leaderboard.recoveryCode();
            const done = () => { btn.textContent = 'Copied ✓'; };
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => {});
        });
        this.refreshWho();
    },

    nudge(el) {
        el.classList.remove('shake');
        void el.offsetWidth;
        el.classList.add('shake');
    },

    refreshWho() {
        const id = Leaderboard.identity();
        this.el.whoForm.hidden = Boolean(id);
        this.el.whoHello.hidden = !id;
        if (id) this.el.whoNameText.textContent = id.name;
        const cache = id && Leaderboard.cachedProfile();
        document.getElementById('whoPurse').innerHTML = cache && cache.id === id.id
            ? `${POUCH} ${(cache.gold || 0).toLocaleString()}<span class="g">${GEM} ${(cache.gems || 0).toLocaleString()}</span>` : '';
    },

    askName(rename = false) {
        this.el.whoForm.hidden = false;
        this.el.whoHello.hidden = true;
        this.el.whoInput.value = Leaderboard.getName();
        this.el.whoForm.querySelector('label').textContent = rename ? 'New name, hunter?' : 'What should we call you, hunter?';
        this.nudge(this.el.whoForm);
        setTimeout(() => {
            this.el.whoInput.focus();
            this.el.whoInput.select();
        }, 50);
    },

    async openProfile(playerId) {
        const el = this.el;
        el.profile.classList.add('show');
        el.profileName.textContent = '…';
        el.profileSince.textContent = '';
        el.profileStats.innerHTML = '';
        el.profileRuns.innerHTML = '<li class="muted">Loading…</li>';
        el.profileOwn.hidden = true;
        el.profileCode.hidden = true;
        el.profileShop.innerHTML = '';
        this.profileFor = playerId;
        const res = await Leaderboard.profile(playerId);
        if (this.profileFor !== playerId || !el.profile.classList.contains('show')) return;
        if (res.error) {
            el.profileName.textContent = 'Hunter';
            el.profileRuns.innerHTML = `<li class="muted">${res.error}</li>`;
            return;
        }
        const p = res.player;
        const esc = v => String(v ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
        el.profileName.textContent = p.name || 'Hunter';
        const cls = (res.mine && this.cls) || (res.runs && res.runs[0] && res.runs[0].cls) || p.cls || 'wizard';
        this.drawAvatar(el.profileAvatar, ...this.profileLook(p, res.mine, cls));
        el.profileSince.textContent = `${p.createdAt ? `Hunting since ${new Date(p.createdAt).toLocaleDateString()}` : ''}${res.source === 'local' ? ' · offline (this device)' : ''}`;
        const stats = [
            ['Best score', (p.bestScore || 0).toLocaleString(), 'hero'],
            ['Best level', p.bestLevel || 0], ['Hunts', p.runs || 0], ['Kills', (p.kills || 0).toLocaleString()],
            ['Bosses', p.bosses || 0], ['Play time', U.formatTime(p.playSeconds || 0)], ['Avg score', p.runs ? Math.round((res.runs || []).reduce((n, r) => n + r.score, 0) / Math.max(1, (res.runs || []).length)).toLocaleString() : 0]
        ];
        el.profileStats.innerHTML = stats.map(([k, v, cls]) => `<div class="${cls || ''}"><span>${k}</span><b>${esc(v)}</b></div>`).join('');
        // class mastery: one badge per class that has beaten a tenth-level boss
        // one row per difficulty with any mastery (v3.17 keeps them apart)
        for (let d = 1; d <= 3; d++) {
            const cb = p[MASTERY_KEYS[d][0]] || {};
            const ranks = CLASS_ORDER.map(c => [c, U.masteryTier(Number(cb[c]) || 0)]).filter(([, t]) => t > 0);
            const D = DIFFICULTIES[d];
            if (ranks.length) el.profileStats.innerHTML += `<div class="mastery-row"><span>${d > 1 ? `${D.icon} ${D.name} mastery` : 'Mastery'}</span><b>${ranks.map(([c, t]) => `${CLASSES[c].icon}${this.masteryBadge(t)}`).join(' ')}</b></div>`;
        }
        const runs = res.runs || [];
        el.profileRuns.innerHTML = runs.length
            ? runs.map((r, i) => `<li><span class="rank">${i + 1}</span><span>${CLASSES[r.cls] ? `<span class="cls-i" title="${CLASSES[r.cls].name}">${CLASSES[r.cls].icon}</span>${Number.isInteger(r.diff) ? this.diffTag(r.diff) : ''} ` : ''}<span class="pts">${(r.score || 0).toLocaleString()}</span> <span class="meta">Lv ${r.level} · ${r.kills} kills${r.bosses ? ` · ${r.bosses} 👑` : ''}</span>` +
                `${r.gold || r.gems ? `<span class="earn">${r.gold ? `${POUCH} +${r.gold.toLocaleString()}` : ''}${r.gems ? ` ${GEM} +${r.gems}` : ''}</span>` : ''}</span>` +
                `<span class="meta">${U.formatTime(r.duration || 0)}</span><span class="when">${Game.timeAgo(r.ts)}</span></li>`).join('')
            : '<li class="muted">No hunts yet — go get them!</li>';
        el.profileOwn.hidden = !res.mine;
        this.renderShop(p, res.mine);
    },

    closeProfile() {
        this.el.profile.classList.remove('show');
        this.profileFor = null;
        if (window.location.search.includes('p=')) history.replaceState(null, '', window.location.pathname);
    }
});

Object.assign(Game, {
    timeAgo(ts) {
        const s = Math.max(0, (Date.now() - Number(ts)) / 1000);
        if (s < 60) return 'just now';
        if (s < 3600) return `${Math.floor(s / 60)}m ago`;
        if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
        if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
        return new Date(Number(ts)).toLocaleDateString();
    }
});
