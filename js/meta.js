/* Monster Hunter — meta progression (P7): banked gold, the double-or-nothing wheel, artefacts and
   skins bought in the profile shop. The server owns every number; the client caches the profile
   (hunter.profileCache) so artefacts and skins also apply offline. Extends Game (js/core.js). */

extendGame({
    /** Bonuses for this run: the worn skin's perk (rare and better skins). */
    loadArtefacts() {
        const bonus = {};
        const perk = this.skin && SKIN_PERKS[this.skin];
        if (perk) bonus[perk.stat] = (bonus[perk.stat] || 0) + perk.pct / 100;
        this.artefacts = { mult: key => 1 + (bonus[key] || 0) };
        if (this.loadPets) this.loadPets();
    },

    parsePet(key) {
        const m = /^([a-z]+)_([1-4])$/.exec(key || '');
        return m && PETS[m[1]] ? { id: m[1], tier: Number(m[2]), def: PETS[m[1]] } : null;
    },

    /** The pets out with you: slotted and still owned, never more than the unlocked slots. */
    activePets(cache) {
        const slots = Array.isArray(cache.petSlots) ? cache.petSlots : [];
        return slots.filter(k => (cache.pets || {})[k] > 0 && this.parsePet(k)).slice(0, cache.petSlotCount || 1);
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
        this.refreshWho();
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
        const gems = player.gems || 0;
        const pets = player.pets || {};
        const slotCount = player.petSlotCount || 1;
        const slots = this.activePets(player);
        const eggs = typeof player.eggs === 'number' ? player.eggs : ((player.eggs && player.eggs.gold) || 0) + ((player.eggs && player.eggs.boss) || 0);
        const nests = player.nests || [];
        const skins = player.skins || {};
        const equipped = player.equipped || {};
        const icon = player.icon || null;
        const online = Leaderboard.enabled;
        const off = online ? '' : 'disabled';
        const pct = v => `${v > 0 ? '+' : ''}${v}%`;
        const price = pr => (pr.gold ? `${COIN}${pr.gold.toLocaleString()}` : `${GEM}${pr.gems.toLocaleString()}`);
        const afford = pr => (pr.gold ? gold >= pr.gold : gems >= pr.gems);

        // pets out on the hunt: unlocked slots, then locked ones with their price
        const slotBoxes = Array.from({ length: MAX_SLOTS }, (_, i) => {
            if (i >= slotCount) {
                if (!mine) return '';
                const pr = SLOT_UNLOCK[i + 1];
                const next = i === slotCount;
                return `<div class="slot locked">🔒${next ? `<button class="buy ${pr.gems ? 'gem' : ''}" data-unlock="1" ${afford(pr) && online ? '' : 'disabled'}>Unlock · ${price(pr)}</button>` : `<small>${price(pr)}</small>`}</div>`;
            }
            const a = this.parsePet(slots[i]);
            if (!a) return `<div class="slot empty">${mine ? 'empty<small>pick a pet below</small>' : '—'}</div>`;
            return `<div class="slot pet" style="--t:${TIERS[a.tier].color}"><span class="si">${this.petEmoji(a.def)}</span><b>${a.def.name}</b><small>${a.def.label(a.def.values[a.tier])}</small>` +
                (mine ? `<button class="x" data-unslot="${a.id}" ${off} aria-label="Leave at home">✕</button>` : '') + '</div>';
        }).join('');

        // nests: warming eggs with a countdown; empty nests take an egg
        // the hatchery (eggs already warming in an old second nest still show and hatch)
        const nestBoxes = !mine ? '' : Array.from({ length: Math.max(NESTS, nests.length) }, (_, i) => {
            const n = nests[i];
            if (!n) {
                const opts = eggs > 0 ? `<button class="buy" data-warm="1" ${off}>Warm an egg</button>` : '';
                return `<div class="nest empty"><span class="ni">🪹</span>${opts || '<small>no eggs yet</small>'}</div>`;
            }
            const left = n.start + HATCH_MS - Date.now();
            if (left <= 0) return `<div class="nest ready" style="--e:#fde68a"><span class="ni wobble">🥚</span><button class="buy hatch" data-hatch="${n.id}" ${off}>Hatch!</button></div>`;
            const cost = Math.max(1, Math.ceil(left / 3600000) * HURRY_GEMS_PER_HOUR);
            return `<div class="nest warming" style="--e:#fde68a"><span class="ni">🥚</span><small>warming…</small>` +
                `<b data-left="${n.start + HATCH_MS}">${Game.fmtLeft(left)}</b><button class="buy gem" data-hurry="${n.id}" ${gems >= cost && online ? '' : 'disabled'}>Now · ${GEM}${cost}</button></div>`;
        }).join('');
        const eggLine = !mine ? '' : `<div class="egg-line"><span>🥚 Eggs <b>×${eggs}</b> <small>· buy them or beat bosses</small></span>` +
            `<button class="buy" data-buy="egg" ${gold >= EGG_PRICE && online ? '' : 'disabled'}>Buy egg · ${COIN}${EGG_PRICE.toLocaleString()}</button></div>`;

        const chip = (def, tier, n) => `<span class="tier" style="--t:${TIERS[tier].color}">${TIERS[tier].label}${n > 1 ? ` ×${n}` : ''} <i>${def.label(def.values[tier])}</i></span>`;
        const petRows = Object.entries(PETS).map(([id, def]) => {
            const owned = [1, 2, 3, 4].map(t => pets[`${id}_${t}`] || 0);
            const best = owned.reduce((b, n, i) => (n > 0 ? i + 1 : b), 0);
            if (!mine && !best) return '';
            const chips = best ? owned.map((n, i) => (n ? chip(def, i + 1, n) : '')).join('') : '<span class="tier none">not hatched yet</span>';
            let actions = '';
            if (mine && best) {
                const slotted = this.parsePet(slots.find(k => k.startsWith(`${id}_`)));
                if (!slotted || slotted.tier < best) {
                    const full = !slotted && slots.length >= slotCount;
                    actions += `<button class="buy equip" data-slot="${id}_${best}" ${full || !online ? 'disabled' : ''}>${full ? 'Slots full' : slotted ? `Take ${TIERS[best].label}` : 'Take along'}</button>`;
                } else {
                    actions += '<span class="maxed">ON THE HUNT</span>';
                }
                const mergeTier = [1, 2, 3].find(t => owned[t - 1] >= 3);
                if (mergeTier) {
                    const cost = MERGE_GEMS[mergeTier + 1];
                    actions += `<button class="buy merge" data-merge="${id}" data-tier="${mergeTier + 1}" ${gems < cost || !online ? 'disabled' : ''}>3→1 ${TIERS[mergeTier + 1].label} · ${GEM}${cost}</button>`;
                }
            }
            return `<li class="${best ? '' : 'unhatched'}"><span class="ai">${this.petEmoji(def)}</span><span class="an"><b>${def.name}</b><small>${def.what}</small><span class="chips">${chips}</span></span><span class="acts">${actions}</span></li>`;
        }).join('');

        let refund = '';
        if (mine && player.artRefund) {
            let seen = false;
            try {
                seen = localStorage.getItem('hunter.refundSeen') === '1';
                localStorage.setItem('hunter.refundSeen', '1');
            } catch (e) { /* storage unavailable */ }
            if (!seen) refund = `<p class="refund">✨ Artefacts became pets! Yours were turned back into <b>${COIN}${player.artRefund.gold.toLocaleString()}</b>${player.artRefund.gems ? ` and <b>${GEM}${player.artRefund.gems}</b>` : ''}.</p>`;
        }

        const skinCards = CLASS_ORDER.map(cls => {
            const list = Object.entries(SKINS).filter(([, s]) => s.cls === cls);
            const cards = list.map(([id, s]) => {
                const owned = Boolean(skins[id]);
                if (!mine && !owned) return '';
                const on = equipped[cls] === id;
                const isIcon = icon && icon.skin === id;
                const price = SKIN_PRICES[s.rarity];
                const perk = SKIN_PERKS[id];
                let btn = '';
                if (mine) {
                    btn = on ? `<button class="buy on" data-equip="${cls}" data-skin="">Wearing ✓</button>`
                        : owned ? `<button class="buy" data-equip="${cls}" data-skin="${id}" ${off}>Wear</button>`
                            : price.gold ? `<button class="buy" data-buy="skin" data-id="${id}" ${gold < price.gold || !online ? 'disabled' : ''}>${COIN}${price.gold.toLocaleString()}</button>`
                                : `<button class="buy gem" data-buy="skin" data-id="${id}" ${gems < price.gems || !online ? 'disabled' : ''}>${GEM}${price.gems}</button>`;
                    if (owned) btn += `<button class="icon-pick ${isIcon ? 'on' : ''}" data-icon="${cls}" data-skin="${id}" ${off} title="Use as profile icon">${isIcon ? '⭐ icon' : '☆ icon'}</button>`;
                }
                return `<div class="skin ${s.rarity} ${on ? 'on' : ''}"><canvas data-cls="${cls}" data-skin="${id}" width="96" height="96"></canvas>` +
                    `<b>${s.name}</b><small style="color:${TIERS[RARITY[s.rarity]].color}">${TIERS[RARITY[s.rarity]].label}</small>` +
                    (perk ? `<small class="perk">${pct(perk.pct)} ${STAT_NAMES[perk.stat]}</small>` : '') + `${btn}</div>`;
            }).join('');
            return cards ? `<div class="skin-row"><span class="skin-cls">${CLASSES[cls].icon}</span>${cards}</div>` : '';
        }).join('');

        el.innerHTML =
            `<div class="gold-line">${POUCH} <b>${gold.toLocaleString()}</b> gold <span class="gem-count">${GEM} <b>${gems.toLocaleString()}</b> gems</span>` +
            (mine ? '<small>Unspent coins are banked when a hunt ends. Gems drop rarely — bosses always drop some.</small>' : '') + '</div>' + refund +
            `<h3>🐾 Pets on the hunt <small>${slots.length}/${slotCount}${mine ? ' · they follow you and help' : ''}</small></h3><div class="slots">${slotBoxes}</div>` +
            (mine ? `<h3>🥚 Hatchery <small>an egg hatches in ${HATCH_MS / 3600000} hours — leave it overnight</small></h3><div class="nests">${nestBoxes}</div>${eggLine}` : '') +
            (petRows ? `<h3>📖 Pet collection${mine ? ' <small>merge 3 of a kind into the next tier</small>' : ''}</h3><ul class="arts">${petRows}</ul>` : '') +
            (skinCards ? `<h3>🎨 Skins${mine ? ' <small>rare and better skins give a small bonus</small>' : ''}</h3>${skinCards}` : '') +
            (mine && !online ? '<p class="since">The shop needs the online leaderboard.</p>' : '');
        el.querySelectorAll('canvas[data-skin]').forEach(cv => this.drawPortrait(cv, cv.dataset.cls, cv.dataset.skin));
        const act = (sel, fn) => el.querySelectorAll(sel).forEach(btn => btn.addEventListener('click', () => this.shopAction(btn, fn)));
        act('button[data-buy]', b => Leaderboard.buy(b.dataset.buy, b.dataset.id));
        act('button[data-equip]', b => Leaderboard.equip(b.dataset.equip, b.dataset.skin));
        act('button[data-icon]', b => Leaderboard.meta('icon', { cls: b.dataset.icon, skin: b.dataset.skin }));
        act('button[data-merge]', b => Leaderboard.meta('merge', { id: b.dataset.merge, tier: Number(b.dataset.tier) }));
        act('button[data-unlock]', () => Leaderboard.meta('unlock', {}));
        act('button[data-warm]', () => Leaderboard.meta('warm', {}));
        act('button[data-hatch]', b => Leaderboard.meta('hatch', { nest: b.dataset.hatch }));
        act('button[data-hurry]', b => Leaderboard.meta('hurry', { nest: b.dataset.hurry }));
        act('button[data-slot]', b => {
            const id = b.dataset.slot.split('_')[0];
            const next = slots.filter(k => !k.startsWith(`${id}_`));
            const i = slots.findIndex(k => k.startsWith(`${id}_`));
            next.splice(i < 0 ? next.length : i, 0, b.dataset.slot);
            return Leaderboard.meta('slots', { slots: next.slice(0, slotCount) });
        });
        act('button[data-unslot]', b => Leaderboard.meta('slots', { slots: slots.filter(k => !k.startsWith(`${b.dataset.unslot}_`)) }));
        // nest countdowns tick while the profile is open; a finished one re-renders into "Hatch!"
        clearInterval(this.nestClock);
        if (mine && nests.length) {
            this.nestClock = setInterval(() => {
                if (!el.isConnected || !this.el.profile.classList.contains('show')) return clearInterval(this.nestClock);
                let done = false;
                el.querySelectorAll('[data-left]').forEach(span => {
                    const left = Number(span.dataset.left) - Date.now();
                    if (left <= 0) done = true;
                    else span.textContent = Game.fmtLeft(left);
                });
                if (done) this.renderShop(Leaderboard.cachedProfile() || player, true);
            }, 1000);
        }
    },

    /** The big "you hatched…" moment. */
    showHatch(h) {
        const def = PETS[h.id];
        if (!def) return;
        const t = TIERS[h.tier];
        const box = document.createElement('div');
        box.className = 'hatch-reveal';
        box.style.setProperty('--t', t.color);
        box.innerHTML = `<div class="hr-card"><span class="hr-pet">${this.petEmoji(def)}</span><small style="color:${t.color}">${t.label.toUpperCase()}</small>` +
            `<b>${def.name}!</b><p>${def.what}<br><i>${def.label(def.values[h.tier])}</i></p><button class="btn primary">Yay!</button></div>`;
        this.el.profile.appendChild(box);
        const close = () => box.remove();
        box.addEventListener('click', close);
        Sfx.arpeggio(h.tier >= 3 ? [523, 659, 784, 1046, 1318, 1568, 2093] : [523, 659, 784, 1046], 0.08, { type: 'triangle', volume: 0.14 });
        for (let i = 0; i < 26; i++) {
            const c = document.createElement('i');
            c.className = 'confetti';
            c.style.setProperty('--x', `${(Math.random() - 0.5) * 320}px`);
            c.style.setProperty('--y', `${-60 - Math.random() * 200}px`);
            c.style.setProperty('--c', [t.color, '#facc15', '#f472b6', '#38bdf8'][i % 4]);
            box.querySelector('.hr-card').appendChild(c);
            setTimeout(() => c.remove(), 1100);
        }
    },

    async shopAction(btn, fn) {
        btn.disabled = true;
        try {
            const res = await fn(btn);
            if (btn.dataset.hatch || btn.dataset.hurry) {
                Sfx.tone(700, { duration: 0.12, type: 'square', volume: 0.06, slide: 300 }); // crack!
            } else if (btn.dataset.merge) {
                Sfx.arpeggio([523, 784, 1046, 1568, 2093], 0.07, { type: 'triangle', volume: 0.13 });
            } else if (btn.dataset.buy) {
                Sfx.arpeggio([659, 880, 1175, 1568], 0.06, { type: 'triangle', volume: 0.12 });
            } else {
                Sfx.tone(988, { duration: 0.08, type: 'triangle', volume: 0.1 });
            }
            this.loadArtefacts();
            this.renderShop(res.player, true);
            this.refreshWho();
            if (btn.dataset.equip === this.cls) this.pickClass(this.cls, true);
            this.drawAvatar(this.el.profileAvatar, ...this.profileLook(res.player, true));
            if (btn.dataset.merge) this.el.profileShop.querySelector('.arts')?.classList.add('flash');
            if (res.hatched) this.showHatch(res.hatched);
        } catch (e) {
            btn.textContent = e.message || 'Error';
            Sfx.tone(160, { duration: 0.15, type: 'square', volume: 0.08 });
        }
    },

    /** [cls, skin] for a profile's avatar: the chosen icon, else the class they play. */
    profileLook(p, mine, fallbackCls) {
        if (p && p.icon && CLASSES[p.icon.cls]) return [p.icon.cls, p.icon.skin && (p.skins || {})[p.icon.skin] ? p.icon.skin : ''];
        const cls = CLASSES[fallbackCls] ? fallbackCls : mine && CLASSES[this.cls] ? this.cls : 'wizard';
        return [cls, mine ? this.equippedSkin(cls) : ((p && p.equipped) || {})[cls] || ''];
    }
});
