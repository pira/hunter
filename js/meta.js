/* Monster Hunter — meta progression (P7): banked gold, the double-or-nothing wheel, artefacts and
   skins bought in the profile shop. The server owns every number; the client caches the profile
   (hunter.profileCache) so artefacts and skins also apply offline. Extends Game (js/core.js). */

extendGame({
    /** Artefact bonuses from the cached profile, applied at the start of every run. */
    loadArtefacts() {
        const cache = Leaderboard.cachedProfile() || {};
        const tiers = cache.artefacts || {};
        const bonus = {};
        for (const [id, tier] of Object.entries(tiers)) {
            const def = ARTEFACTS[id];
            if (def && tier > 0) bonus[def.stat] = (bonus[def.stat] || 0) + def.values[Math.min(4, tier)] / 100;
        }
        this.artefacts = { tiers, mult: key => 1 + (bonus[key] || 0) };
    },

    equippedSkin(cls) {
        const cache = Leaderboard.cachedProfile() || {};
        const skin = (cache.equipped || {})[cls];
        return skin && SKINS[skin] && (cache.skins || {})[skin] ? skin : '';
    },

    skinExtras() {
        return (this.skin && SKINS[this.skin] && SKINS[this.skin].extras) || {};
    },

    /** Startup: pull the latest profile so the menu shows the right skin and gold. */
    async syncProfile() {
        await Leaderboard.refreshOwn();
        if (this.state === 'menu') this.pickClass(this.cls, true);
        this.loadArtefacts();
    },

    // ------------------------------------------------------------------ game over: bank + wheel

    showPot(pot, gold) {
        const box = this.el.bankBox;
        this.pot = pot && pot.amount > 0 ? { ...pot } : null;
        if (!this.pot) {
            box.hidden = true;
            return;
        }
        box.hidden = false;
        this.wheelAngle = this.wheelAngle || 0;
        this.drawWheel(this.wheelAngle);
        this.updatePotText(`🏦 <b>+${pot.amount}</b> gold banked to your profile${gold !== undefined ? ` · you have <b>${gold.toLocaleString()}</b>` : ''}`);
        this.el.spinBtn.disabled = false;
        this.el.keepBtn.disabled = false;
        this.el.spinBtn.hidden = false;
        this.el.keepBtn.hidden = false;
    },

    updatePotText(html) {
        this.el.potText.innerHTML = html;
    },

    async spinWheel() {
        if (!this.pot || this.spinning || this.pot.status !== 'open') return;
        this.spinning = true;
        this.el.spinBtn.disabled = true;
        this.el.keepBtn.disabled = true;
        Sfx.unlock();
        const start = performance.now();
        const from = this.wheelAngle || 0;
        let result = null;
        let error = null;
        Leaderboard.spin(this.pot.id, this.pot.spins).then(r => { result = r; }, e => { error = e; });
        // spin freely until the server answers, then land on the matching half within 1.2 s
        let tick = 0;
        await new Promise(resolve => {
            const loop = now => {
                const t = now - start;
                if (!result && !error) {
                    this.wheelAngle = from + t * 0.02;
                    this.drawWheel(this.wheelAngle);
                    if (Math.floor(this.wheelAngle / (Math.PI / 4)) !== tick) {
                        tick = Math.floor(this.wheelAngle / (Math.PI / 4));
                        Sfx.tone(1200, { duration: 0.025, type: 'square', volume: 0.05 });
                    }
                    requestAnimationFrame(loop);
                    return;
                }
                if (error) {
                    resolve();
                    return;
                }
                if (!this.landing) {
                    // 8 segments; even = WIN (gold), odd = LOSE. Pointer at the top (−π/2).
                    const seg = Math.PI / 4;
                    const want = result.win ? 0 : 1;
                    const base = this.wheelAngle + Math.PI * 4;
                    let target = base - (base % TAU);
                    // choose a segment of the right colour: angle so that segment centre sits under the pointer
                    const k = (want + 2 * Math.floor(Math.random() * 4)) * seg + seg / 2;
                    target += TAU - k - Math.PI / 2;
                    this.landing = { from: this.wheelAngle, to: target, t0: now };
                }
                const q = Math.min(1, (now - this.landing.t0) / 1200);
                const e = 1 - Math.pow(1 - q, 3);
                this.wheelAngle = this.landing.from + (this.landing.to - this.landing.from) * e;
                this.drawWheel(this.wheelAngle);
                const cur = Math.floor(this.wheelAngle / (Math.PI / 4));
                if (cur !== tick) {
                    tick = cur;
                    Sfx.tone(1200, { duration: 0.025, type: 'square', volume: 0.05 });
                }
                if (q < 1) requestAnimationFrame(loop);
                else {
                    this.landing = null;
                    resolve();
                }
            };
            requestAnimationFrame(loop);
        });
        this.spinning = false;
        if (error) {
            this.updatePotText(`Couldn't reach the wheel (${error.message}). Your gold is safe.`);
            this.el.spinBtn.hidden = true;
            this.el.keepBtn.hidden = true;
            return;
        }
        this.pot = result.pot;
        if (result.win) {
            Sfx.arpeggio([523, 659, 784, 1046, 1318], 0.07, { type: 'triangle', volume: 0.13 });
            this.updatePotText(`🎉 <b>DOUBLED!</b> Pot <b>${result.pot.amount.toLocaleString()}</b> · you have <b>${result.gold.toLocaleString()}</b> gold`);
            this.el.spinBtn.disabled = result.gold < result.pot.amount;
            this.el.keepBtn.disabled = false;
            this.burstConfetti();
        } else {
            Sfx.tone(220, { duration: 0.6, type: 'sawtooth', volume: 0.1, slide: -150 });
            this.updatePotText(`😱 <b>Lost it all!</b> You have <b>${result.gold.toLocaleString()}</b> gold`);
            this.el.spinBtn.hidden = true;
            this.el.keepBtn.hidden = true;
        }
    },

    async keepPot() {
        if (!this.pot || this.spinning) return;
        const pot = this.pot;
        this.el.spinBtn.hidden = true;
        this.el.keepBtn.hidden = true;
        try {
            const res = await Leaderboard.bank(pot.id);
            this.updatePotText(`🏦 Banked <b>${pot.amount.toLocaleString()}</b> · you have <b>${res.gold.toLocaleString()}</b> gold`);
        } catch (e) {
            this.updatePotText(`🏦 Banked <b>${pot.amount.toLocaleString()}</b>`);
        }
        Sfx.coin(true);
        this.pot = null;
    },

    drawWheel(angle) {
        const cv = this.el.wheel;
        const g = cv.getContext('2d');
        const S = cv.width;
        const r = S / 2 - 6;
        g.clearRect(0, 0, S, S);
        g.save();
        g.translate(S / 2, S / 2);
        g.rotate(angle);
        for (let i = 0; i < 8; i++) {
            const a0 = (i * Math.PI) / 4;
            g.beginPath();
            g.moveTo(0, 0);
            g.arc(0, 0, r, a0, a0 + Math.PI / 4);
            g.closePath();
            g.fillStyle = i % 2 === 0 ? (i % 4 === 0 ? '#facc15' : '#f59e0b') : (i % 4 === 1 ? '#334155' : '#1e293b');
            g.fill();
            g.strokeStyle = '#0f172a';
            g.lineWidth = 2;
            g.stroke();
            g.save();
            g.rotate(a0 + Math.PI / 8);
            g.textAlign = 'center';
            g.textBaseline = 'middle';
            g.font = `${Math.round(S * 0.1)}px ${DISPLAY_FONT}`;
            g.fillStyle = i % 2 === 0 ? '#3b1d00' : '#94a3b8';
            g.fillText(i % 2 === 0 ? '×2' : '✕', r * 0.66, 0);
            g.restore();
        }
        g.restore();
        g.beginPath();
        g.arc(S / 2, S / 2, r, 0, TAU);
        g.strokeStyle = '#fde68a';
        g.lineWidth = 4;
        g.stroke();
        g.beginPath();
        g.arc(S / 2, S / 2, S * 0.08, 0, TAU);
        g.fillStyle = '#fde68a';
        g.fill();
        // pointer
        g.beginPath();
        g.moveTo(S / 2 - 9, 2);
        g.lineTo(S / 2 + 9, 2);
        g.lineTo(S / 2, 20);
        g.closePath();
        g.fillStyle = '#ef4444';
        g.fill();
        g.strokeStyle = '#fff';
        g.lineWidth = 2;
        g.stroke();
    },

    burstConfetti() {
        const box = this.el.bankBox;
        for (let i = 0; i < 24; i++) {
            const c = document.createElement('i');
            c.className = 'confetti';
            c.style.setProperty('--x', `${(Math.random() - 0.5) * 260}px`);
            c.style.setProperty('--y', `${-80 - Math.random() * 120}px`);
            c.style.setProperty('--c', ['#facc15', '#f472b6', '#38bdf8', '#4ade80'][i % 4]);
            box.appendChild(c);
            setTimeout(() => c.remove(), 1100);
        }
    },

    // ------------------------------------------------------------------ profile shop

    renderShop(player, mine) {
        const el = this.el.profileShop;
        if (!mine && !player) {
            el.innerHTML = '';
            return;
        }
        const gold = player.gold || 0;
        const arts = player.artefacts || {};
        const skins = player.skins || {};
        const equipped = player.equipped || {};
        const best = player.bestLevel || 0;
        const online = Leaderboard.enabled;
        const artRows = Object.entries(ARTEFACTS).map(([id, a]) => {
            const tier = arts[id] || 0;
            if (!mine && !tier) return '';
            const next = tier < 4 ? TIERS[tier + 1] : null;
            const val = v => `${v > 0 ? '+' : ''}${v}%`;
            const now = tier ? `<span class="tier" style="--t:${TIERS[tier].color}">${TIERS[tier].label} ${val(a.values[tier])}</span>` : '<span class="tier none">not owned</span>';
            let action = '';
            if (mine && next) {
                const locked = best < next.gate;
                const poor = gold < next.price;
                action = `<button class="buy" data-buy="artefact" data-id="${id}" data-tier="${tier + 1}" ${locked || poor || !online ? 'disabled' : ''}>` +
                    (locked ? `🔒 Lv ${next.gate}` : `${tier ? '⬆' : 'Buy'} ${val(a.values[tier + 1])} · 🪙${next.price.toLocaleString()}`) + '</button>';
            } else if (mine) {
                action = '<span class="maxed">MAX</span>';
            }
            return `<li><span class="ai">${a.icon}</span><span class="an"><b>${a.name}</b><small>${a.what}</small></span>${now}${action}</li>`;
        }).join('');
        const skinCards = CLASS_ORDER.map(cls => {
            const list = Object.entries(SKINS).filter(([, s]) => s.cls === cls);
            const cards = list.map(([id, s]) => {
                const owned = Boolean(skins[id]);
                if (!mine && !owned) return '';
                const on = equipped[cls] === id;
                const price = SKIN_PRICES[s.rarity];
                let btn = '';
                if (mine) {
                    btn = on ? `<button class="buy on" data-equip="${cls}" data-skin="">Wearing ✓</button>`
                        : owned ? `<button class="buy" data-equip="${cls}" data-skin="${id}" ${online ? '' : 'disabled'}>Wear</button>`
                            : `<button class="buy" data-buy="skin" data-id="${id}" ${gold < price || !online ? 'disabled' : ''}>🪙${price.toLocaleString()}</button>`;
                }
                return `<div class="skin ${s.rarity} ${on ? 'on' : ''}"><canvas data-cls="${cls}" data-skin="${id}" width="96" height="96"></canvas>` +
                    `<b>${s.name}</b><small style="color:${TIERS[RARITY[s.rarity]].color}">${TIERS[RARITY[s.rarity]].label}</small>${btn}</div>`;
            }).join('');
            return cards ? `<div class="skin-row"><span class="skin-cls">${CLASSES[cls].icon}</span>${cards}</div>` : '';
        }).join('');
        el.innerHTML =
            `<div class="gold-line">💰 <b>${gold.toLocaleString()}</b> gold${mine ? '<small>Unspent coins are banked when a hunt ends.</small>' : ''}</div>` +
            (artRows ? `<h3>✨ Artefacts</h3><ul class="arts">${artRows}</ul>` : '') +
            (skinCards ? `<h3>🎨 Skins</h3>${skinCards}` : (mine ? '' : '')) +
            (mine && !online ? '<p class="since">The shop needs the online leaderboard.</p>' : '');
        el.querySelectorAll('canvas[data-skin]').forEach(cv => this.drawPortrait(cv, cv.dataset.cls, cv.dataset.skin));
        el.querySelectorAll('button[data-buy]').forEach(btn => btn.addEventListener('click', () => this.shopBuy(btn)));
        el.querySelectorAll('button[data-equip]').forEach(btn => btn.addEventListener('click', () => this.shopEquip(btn)));
    },

    async shopBuy(btn) {
        btn.disabled = true;
        try {
            const res = await Leaderboard.buy(btn.dataset.buy, btn.dataset.id, btn.dataset.tier ? Number(btn.dataset.tier) : undefined);
            Sfx.arpeggio([659, 880, 1175, 1568], 0.06, { type: 'triangle', volume: 0.12 });
            this.loadArtefacts();
            this.renderShop(res.player, true);
            this.el.profileStats.querySelector('[data-gold]')?.replaceChildren(String(res.player.gold));
        } catch (e) {
            btn.textContent = e.message || 'Error';
            Sfx.tone(160, { duration: 0.15, type: 'square', volume: 0.08 });
        }
    },

    async shopEquip(btn) {
        btn.disabled = true;
        try {
            const res = await Leaderboard.equip(btn.dataset.equip, btn.dataset.skin);
            Sfx.tone(988, { duration: 0.08, type: 'triangle', volume: 0.1 });
            this.renderShop(res.player, true);
            if (btn.dataset.equip === this.cls) this.pickClass(this.cls, true);
            this.drawAvatar(this.el.profileAvatar, this.cls, this.equippedSkin(this.cls));
        } catch (e) {
            btn.textContent = e.message || 'Error';
        }
    }
});
