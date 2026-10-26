/* Monster Hunter — shop: card pricing, burn transition, level-up shop. Extends Game (js/core.js). */

extendGame({
    updateCombo() {
        if (this.comboTimer > 0) {
            this.comboTimer--;
            if (this.comboTimer === 0) this.combo = 0;
        }
        if (this.comboPop > 0) this.comboPop = Math.max(0, this.comboPop - 0.06);
    },

    expectedIncome(level) {
        return U.expectedIncome(level);
    },

    levelBonus(level) {
        return 10 + 2 * level;
    },

    // Whole-run upgrades: base price doubling with every rank owned (no run buys them all).
    // One-level cards: base price × level/2 (U.cardPrice).
    cardPrice(card) {
        return U.cardPrice(card, this.stack(card.id), this.level);
    },

    availableCards() {
        const pets = Boolean(this.petList && this.petList.length);
        const core = CORE_CARDS[this.cls] || [];
        const permanent = UPGRADES.filter(u => this.stack(u.id) < u.max)
            .filter(u => !core.includes(u.id)) // those have their own row
            .filter(u => !u.needsPets || pets)
            .filter(u => !u.cls || u.cls === this.cls)
            .filter(u => !u.minLevel || this.level >= u.minLevel)
            .filter(u => u.id !== 'vitality' || this.player.maxHp < 6)
            .map(u => ({ ...u, weight: u.weight || (u.cls ? 1.6 : 1) }));
        const buffs = LEVEL_BUFFS.filter(b => (b.id !== 'feast' || this.player.hp < this.player.maxHp) && !this.buffs[b.id] && (!b.needsPets || pets));
        return { permanent, buffs };
    },

    cardHeader() {
        this.el.levelupTitle.textContent = `LEVEL ${this.level - this.pendingLevels + 1}!`;
        if (this.headerShown) return;
        this.headerShown = true;
        const bonus = this.levelBonus(this.level - this.pendingLevels + 1);
        this.coins += bonus;
        this.coinsEarned += bonus;
        this.el.levelupTitle.textContent = `LEVEL ${this.level - this.pendingLevels + 1}!`;
        this.el.levelupSub.innerHTML = `Spend coins on upgrades · <b class="gold">+${bonus} ${COIN}</b> level bonus`;
        Sfx.play('levelUp', { volume: 0.6 });
    },

    beginCards(mode) {
        // Back-to-back level-ups skip the transition; the first one already set the scene.
        if (performance.now() - (this.cardsClosedAt || 0) < 400) this.openCards(mode);
        else {
            try {
                this.startBurn(mode);
            } catch (e) {
                // no canvas memory for the effect: skip it
                this.releaseBurn(this.burn);
                this.burn = null;
                this.openCards(mode);
            }
        }
    },

    // ---- burning-film transition: the last frame burns away and reveals the new level underneath
    startBurn(mode) {
        const c = this.canvas;
        const k = Math.max(4, Math.ceil(c.width / 320));
        const mw = Math.ceil(c.width / k);
        const mh = Math.ceil(c.height / k);
        const mk = () => {
            const c = newCanvas(mw, mh);
            if (!c) throw new Error('no canvas memory');
            return { cv: c.cv, cx: c.g, img: c.g.createImageData(mw, mh) };
        };
        const b = this.burn = { mode, t0: performance.now(), mw, mh, k, mask: mk(), char: mk(), glow: mk(), embers: [], intro: false };
        for (let i = 0; i < mw * mh; i++) {
            b.char.img.data[i * 4] = 28;
            b.char.img.data[i * 4 + 1] = 10;
        }
        // Composite at <=1280px / ~0.75MP and upscale once per frame: cheap even on 4K / high-DPI screens.
        const rs = Math.min(1, 1280 / c.width, Math.sqrt(750000 / (c.width * c.height)));
        const rw = Math.round(c.width * rs);
        const rh = Math.round(c.height * rs);
        const snap = newCanvas(rw, rh);
        const film = snap && newCanvas(rw, rh);
        if (!film) throw new Error('no canvas memory');
        b.snap = snap.cv;
        snap.g.drawImage(c, 0, 0, rw, rh); // canvas still shows the last frame of the old level
        b.film = film.cv;
        b.field = Game.burnField(mw, mh);
        this.headerShown = false;
        this.state = 'transition';
        this.releaseStick();
        Sfx.crackle(BURN_MS / 1000);
        Sfx.tone(200, { duration: 0.7, type: 'sine', volume: 0.12, slide: -140 });
    },

    drawBurn(now, dt) {
        const b = this.burn;
        if (!b) return;
        const p = U.clamp((now - b.t0) / BURN_MS, 0, 1);
        const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        const t = -0.06 + 1.1 * e; // burn threshold sweeps through the field (done at ~80%, then a short hold)
        const A = b.mask.img.data;
        const C = b.char.img.data;
        const G = b.glow.img.data;
        const f = b.field;
        for (let i = 0, j = 3; i < f.length; i++, j += 4) {
            const d = f[i] - t;
            const alpha = d <= 0 ? 0 : d >= 0.02 ? 1 : d / 0.02;
            A[j] = alpha * 255;
            C[j] = d > 0 && d < 0.12 ? (1 - d / 0.12) * 230 * alpha : 0;
            const gd = Math.abs(d - 0.004);
            const g = gd < 0.032 ? 1 - gd / 0.032 : 0;
            G[j - 3] = 255;
            G[j - 2] = 70 + 185 * g * g;
            G[j - 1] = 20 + 160 * g * g * g;
            G[j] = g * 255;
        }
        b.mask.cx.putImageData(b.mask.img, 0, 0);
        b.char.cx.putImageData(b.char.img, 0, 0);
        b.glow.cx.putImageData(b.glow.img, 0, 0);

        const rw = b.film.width;
        const rh = b.film.height;
        const fc = b.film.getContext('2d');
        fc.globalCompositeOperation = 'copy';
        fc.drawImage(b.snap, 0, 0);
        fc.globalCompositeOperation = 'source-atop';
        fc.fillStyle = `rgba(255,150,60,${0.1 * e + Math.random() * 0.04})`; // film heats up and flickers
        fc.fillRect(0, 0, rw, rh);
        fc.drawImage(b.char.cv, 0, 0, rw, rh);
        fc.globalCompositeOperation = 'destination-in';
        fc.drawImage(b.mask.cv, 0, 0, rw, rh);
        fc.globalCompositeOperation = 'lighter'; // glowing edge straddles film and the holes
        fc.drawImage(b.glow.cv, 0, 0, rw, rh);
        fc.globalCompositeOperation = 'source-over';

        const ctx = this.ctx;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(b.film, 0, 0, this.canvas.width, this.canvas.height);
        ctx.globalCompositeOperation = 'lighter';

        // Embers flying off the burning edge
        for (let n = 0; n < 50 && p < 0.92; n++) {
            const i = Math.floor(Math.random() * f.length);
            if (Math.abs(f[i] - t) < 0.015) {
                b.embers.push({
                    x: ((i % b.mw) + Math.random()) * b.k, y: (Math.floor(i / b.mw) + Math.random()) * b.k,
                    vx: (Math.random() - 0.5) * 40 * this.dpr, vy: -(30 + Math.random() * 90) * this.dpr,
                    life: 0.4 + Math.random() * 0.6, max: 1, r: (1 + Math.random() * 2) * this.dpr
                });
            }
        }
        for (const em of b.embers) {
            em.x += em.vx * dt;
            em.y += em.vy * dt;
            em.vy -= 30 * dt * this.dpr;
            em.life -= dt;
            const a = U.clamp(em.life / 0.6, 0, 1);
            ctx.fillStyle = `rgba(255,${150 + Math.floor(Math.random() * 80)},60,${a})`;
            ctx.beginPath();
            ctx.arc(em.x, em.y, em.r, 0, TAU);
            ctx.fill();
        }
        b.embers = b.embers.filter(em => em.life > 0);
        ctx.restore();

        if (p >= 0.45 && !b.intro) {
            b.intro = true;
            this.el.levelup.classList.add('intro');
            this.prepareCards(b.mode);
            this.setOverlay('levelup');
        }
        if (p >= 1) this.finishBurn();
    },

    /** Frees the transition's five canvases (mobile Safari only gets the memory back this way). */
    releaseBurn(b) {
        if (!b) return;
        for (const c of [b.mask, b.char, b.glow]) if (c) freeCanvas(c.cv);
        freeCanvas(b.snap);
        freeCanvas(b.film);
    },

    finishBurn() {
        const b = this.burn;
        if (!b) return;
        this.burn = null;
        this.releaseBurn(b);
        if (!b.intro) this.prepareCards(b.mode);
        this.revealCards();
    },

    openCards(mode) {
        this.el.levelup.classList.remove('intro');
        this.prepareCards(mode);
        this.revealCards();
    },

    revealCards() {
        this.el.levelup.classList.remove('intro'); // cards deal in (CSS animation starts now)
        this.setOverlay('levelup');
        this.state = 'levelup';
        this.cardsReadyAt = performance.now() + 450;
        this.headerShown = false;
        this.saveRun();
    },

    /** Once the run has earned 1000 coins, the shop rarely (~6%) also offers a pet egg for the profile. */
    artefactCard() {
        const cap = 1 + Math.floor(this.level / 5); // the server accepts this many per run
        if (this.coinsEarned < EGG_PRICE) return null;
        if (!Leaderboard.enabled || !Leaderboard.identity() || this.eggCards >= cap || Math.random() > 0.06) return null;
        return {
            id: 'egg', egg: true, artefact: true, icon: '🥚', name: 'Pet Egg', desc: 'Keep forever: hatches into a pet in your profile overnight.',
            // Hard/Hell pay ×2/×3, so the egg costs that much more too (same share of a level's income)
            price: Math.max(60, Math.round(1.5 * this.expectedIncome(this.level) * this.diffK / 5) * 5)
        };
    },

    prepareCards(mode) {
        const { permanent, buffs } = this.availableCards();
        const cards = U.dealCards(permanent, buffs, 3).map(c => ({ ...c, price: this.cardPrice(c), sold: false }));
        // a pet egg, when it shows up, takes the place of the third card (never a fourth)
        const egg = this.artefactCard();
        if (egg) cards.splice(Math.min(2, cards.length), 1, { ...egg, sold: false });
        // the core row: always there (maxed ones stay, greyed out)
        const core = (CORE_CARDS[this.cls] || []).map(id => UPGRADES.find(u => u.id === id)).filter(Boolean)
            .map(u => ({ ...u, core: true, price: this.cardPrice(u), sold: false, maxed: this.stack(u.id) >= u.max }));
        this.cardChoices = [...cards, ...core];
        this.cardMode = mode;
        this.cardHeader();
        const card = (c, i) => {
            const rank = this.stack(c.id);
            const pips = Number.isFinite(c.max) && c.max > 1
                ? `<div class="pips">${Array.from({ length: c.max }, (_, k) => `<i class="${k < rank ? 'on' : k === rank ? 'next' : ''}"></i>`).join('')}</div>`
                : '';
            const kind = c.artefact ? 'art' : c.oneLevel ? 'lvl' : 'perm';
            const tag = c.core ? '' : c.artefact ? '<span class="tag art">✨ PERMANENT</span>'
                : c.oneLevel ? `<span class="tag lvl">${c.buff ? 'THIS LEVEL' : 'NOW'}</span>`
                    : `<span class="tag perm">WHOLE RUN${c.cls ? ` · ${CLASSES[c.cls].icon}` : ''}</span>`;
            return `<button class="card ${kind}${c.core ? ' core' : ''}" data-i="${i}" style="--d:${i * 70}ms"><span class="num">${i + 1}</span>` +
                `<span class="cicon">${c.icon}</span><span class="cname">${c.name}</span>${tag}` +
                `<span class="cdesc">${c.desc}</span>${pips}<span class="price">${COIN} ${c.price}</span></button>`;
        };
        this.el.coreCards.innerHTML = this.cardChoices.map((c, i) => (c.core ? card(c, i) : '')).join('');
        this.el.cards.innerHTML = this.cardChoices.map((c, i) => (c.core ? '' : card(c, i))).join('');
        this.el.levelup.querySelectorAll('.card').forEach(btn =>
            btn.addEventListener('click', () => this.buyCard(Number(btn.dataset.i))));
        this.refreshShop();
    },

    refreshShop() {
        this.el.shopCoins.innerHTML = `${COIN} ${this.coins}<span class="g">${GEM} ${this.gems || 0}</span>`;
        this.el.levelup.querySelectorAll('.card').forEach(btn => {
            const c = this.cardChoices[Number(btn.dataset.i)];
            const done = Boolean(c.sold || c.maxed);
            btn.classList.toggle('sold', done);
            btn.classList.toggle('afford', !done && c.price <= this.coins);
            btn.classList.toggle('poor', !done && c.price > this.coins);
            btn.querySelector('.price').innerHTML = c.maxed ? 'MAX' : c.sold ? '✓ BOUGHT' : `${COIN} ${c.price}`;
        });
    },

    buyCard(i) {
        if (this.state !== 'levelup' || performance.now() < this.cardsReadyAt) return;
        const card = this.cardChoices[i];
        const btn = this.el.levelup.querySelector(`.card[data-i="${i}"]`);
        if (!card || card.sold || card.maxed) return;
        if (card.price > this.coins) {
            Sfx.tone(160, { duration: 0.15, type: 'square', volume: 0.08 });
            if (btn) {
                btn.classList.remove('nope');
                void btn.offsetWidth;
                btn.classList.add('nope');
            }
            return;
        }
        this.coins -= card.price;
        this.coinsSpent = (this.coinsSpent || 0) + card.price;
        card.sold = true;
        if (card.artefact) {
            this.eggCards++;
            this.floater(this.player.x, this.player.y - 50, '🥚 egg saved to your profile!', '#f0abfc', 18);
            Sfx.arpeggio([784, 988, 1318, 1568, 2093], 0.06, { type: 'triangle', volume: 0.12 });
        } else {
            this.applyCard(card);
        }
        Sfx.arpeggio([659, 880, 1175], 0.05, { type: 'triangle', volume: 0.1 });
        this.refreshShop();
    },

    closeShop() {
        if (this.state !== 'levelup' || performance.now() < this.cardsReadyAt) return;
        const bought = this.cardChoices.filter(c => c.sold);
        this.pendingLevels--;
        this.state = 'playing';
        this.setOverlay(null);
        this.lastTime = performance.now();
        this.cardsClosedAt = performance.now();
        if (this.pendingLevels <= 0) this.startLevel();
        bought.forEach((c, i) => this.floater(this.player.x, this.player.y - 40 - i * 18, `${c.icon} ${c.name}`, '#ffffff', 18));
    },

    applyCard(card) {
        const p = this.player;
        if (card.id === 'feast') {
            p.hp = p.maxHp;
            return;
        }
        if (card.buff) {
            this.buffs[card.id] = true;
            return;
        }
        this.stacks[card.id] = this.stack(card.id) + 1;
        if (card.id === 'vitality') {
            p.maxHp++;
            p.hp = Math.min(p.maxHp, p.hp + 1);
        }
    }
});

Object.assign(Game, {
    // Normalized burn order per low-res cell: holes start at a few ignition points and spread with noise.
    burnField(w, h) {
        const smooth = t => t * t * (3 - 2 * t);
        const octave = cell => {
            const gw = Math.ceil(w / cell) + 2;
            const gh = Math.ceil(h / cell) + 2;
            const g = new Float32Array(gw * gh).map(() => Math.random());
            const out = new Float32Array(w * h);
            for (let y = 0; y < h; y++) {
                const fy = y / cell;
                const iy = Math.floor(fy);
                const ty = smooth(fy - iy);
                for (let x = 0; x < w; x++) {
                    const fx = x / cell;
                    const ix = Math.floor(fx);
                    const tx = smooth(fx - ix);
                    const i = iy * gw + ix;
                    const top = g[i] + (g[i + 1] - g[i]) * tx;
                    const bot = g[i + gw] + (g[i + gw + 1] - g[i + gw]) * tx;
                    out[y * w + x] = top + (bot - top) * ty;
                }
            }
            return out;
        };
        const octs = [[w / 3, 0.5], [w / 7, 0.28], [w / 16, 0.14], [w / 40, 0.08]].map(([cell, wt]) => [octave(Math.max(2, cell)), wt]);
        const sparks = Array.from({ length: 3 }, () => ({ x: w * (0.15 + Math.random() * 0.7), y: h * (0.15 + Math.random() * 0.7) }));
        const diag = Math.hypot(w, h);
        const field = new Float32Array(w * h);
        let min = Infinity;
        let max = -Infinity;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = y * w + x;
                let n = 0;
                for (const [o, wt] of octs) n += o[i] * wt;
                let d = Infinity;
                for (const s of sparks) d = Math.min(d, Math.hypot(x - s.x, y - s.y));
                const v = 0.55 * (d / diag) * 2 + 0.45 * n;
                field[i] = v;
                if (v < min) min = v;
                if (v > max) max = v;
            }
        }
        for (let i = 0; i < field.length; i++) field[i] = (field[i] - min) / (max - min);
        return field;
    }
});
