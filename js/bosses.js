/* Monster Hunter — bosses: small bosses (L5/15/25…), big bosses (L10/20/30…), their attack
   library, spoken lines with speech bubbles, and the crumbling death sequence. Extends Game. */

extendGame({
    // ------------------------------------------------------------------ voices

    /** Fetches the voice index once and pre-loads the clips of the boss coming up this level. */
    async preloadBossVoice(def) {
        if (!def || !def.voice) return;
        try {
            if (!this.voiceIndex) this.voiceIndex = fetch('sfx/voice/index.json').then(r => r.json()).catch(() => ({}));
            const index = await this.voiceIndex;
            const lines = index[def.voice] || {};
            for (const [event, clips] of Object.entries(lines)) {
                clips.forEach((c, i) => Sfx.loadSample(`voice:${def.voice}:${event}:${i}`, c.file, { bus: 'voice', priority: 3 }));
            }
        } catch (e) { /* voices are optional */ }
    },

    /** A boss says something: speech bubble (works muted) + the recorded clip when loaded. */
    async bossSay(b, event) {
        if (!b || !b.boss || !b.boss.voice || b.dead) return;
        const index = this.voiceIndex ? await this.voiceIndex : {};
        const clips = ((index[b.boss.voice] || {})[event]) || [];
        if (!clips.length) return;
        const i = Math.floor(Math.random() * clips.length);
        const name = `voice:${b.boss.voice}:${event}:${i}`;
        Sfx.speak(name, { volume: 1 });
        b.bubble = { text: clips[i].text, t: Math.round(((clips[i].duration || 1.5) + 1.2) * 60 * GAME_SPEED), max: 0 };
        b.bubble.max = b.bubble.t;
    },

    /** Called when a boss lands a hit on the player. */
    bossTaunt(b) {
        if (!b || !b.boss || this.frameNo - (b.lastTaunt || -9999) < 8 * 60 * GAME_SPEED) return;
        b.lastTaunt = this.frameNo;
        this.bossSay(b, 'taunt');
    },

    // ------------------------------------------------------------------ spawn

    startBossWarning(def) {
        this.bossCount++;
        this.pendingBoss = def;
        this.bossWarning = 150;
        this.banner(`⚠ ${def.name.toUpperCase()} ⚠`, def.title, 'danger');
    },

    updateBossWarning() {
        if (this.bossWarning <= 0) return;
        this.bossWarning--;
        if (this.bossWarning % 30 === 0) Sfx.tone(220, { duration: 0.25, type: 'sawtooth', volume: 0.08, slide: -80 });
        if (this.bossWarning === 0) this.spawnBoss(this.pendingBoss);
    },

    spawnBoss(def) {
        const big = Boolean(def.big);
        const n = big ? this.bigCount : this.smallCount; // how many of this size we have met, incl. this one
        const cycle = Math.floor((n - 1) / 4);
        const hp = Math.round(def.hp * (1 + (big ? 0.5 : 0.4) * (n - 1)) * (1 + 0.4 * cycle));
        const b = this.makeBossBody(def, hp, cycle, this.W / 2, -def.size * 2);
        this.boss = b;
        this.bossParts = [b];
        this.bossTrailPct = 1;
        this.el.bossName.innerHTML = `${def.name} <small>${def.title}</small>`;
        this.el.bossBar.hidden = false;
        Sfx.play('bossDeath', { volume: 0.8, rate: 0.6 });
        this.shake(10);
        this.bossSay(b, 'intro');
        if (def.pattern === 'hydra') this.growHeads(b);
        if (def.pattern === 'lich') b.summonT = 40;
    },

    makeBossBody(def, hp, cycle, x, y) {
        const b = {
            ...this.makeMonster({ ...def, shape: 'boss', speedVariation: 0, health: hp, points: 0, tier: 'boss' }, x, y, 'boss'),
            boss: def, size: def.size, hp, maxHp: hp, speed: def.speed * (1 + 0.1 * cycle),
            mode: 'enter', modeT: 0, t: 0, volley: 0, cycle, spawnT: 0, dashX: 0, dashY: 0, atkT: 0, enc: this.encounter
        };
        b.name = def.name;
        this.monsters.push(b);
        return b;
    },

    updateBoss(b, freeze) {
        if (b.bubble && --b.bubble.t <= 0) b.bubble = null;
        const wasEnraged = b.enraged;
        b.enraged = b.hp < b.maxHp * 0.5;
        if (b.enraged && !wasEnraged && b.mode !== 'enter') {
            this.bossSay(b, 'enrage');
            this.floater(b.x, b.y - b.size - 20, 'ENRAGED!', '#ff6b6b', 24);
            this.shake(8);
        }
        if (b.mode === 'enter') {
            b.y += 1.6;
            b.spawnT = 2;
            b.t++;
            if (b.y >= this.H * 0.22) {
                b.mode = 'fight';
                b.modeT = 0;
            }
            return;
        }
        if (b.boss.big) this.updateBigBoss(b, freeze);
        else this.updateSmallBoss(b, freeze);
        b.x = U.clamp(b.x, b.size, this.W - b.size);
        b.y = U.clamp(b.y, b.size, this.H - b.size);
    },

    // ------------------------------------------------------------------ small bosses (v2 patterns)

    updateSmallBoss(b, freeze) {
        const p = this.player;
        b.t++;
        b.modeT++;
        const enraged = b.hp < b.maxHp * 0.5;
        const pattern = b.boss.pattern === 'chaos' ? ['charge', 'rings', 'summon'][Math.floor(b.t / 420) % 3] : b.boss.pattern;
        if (b.lastPattern && b.lastPattern !== pattern && b.mode !== 'enter') {
            b.mode = 'fight';
            b.modeT = 0;
        }
        b.lastPattern = pattern;
        const chase = mult => {
            const n = U.normalizeVector(p.x - b.x, p.y - b.y);
            b.x += n.x * b.speed * mult * freeze;
            b.y += n.y * b.speed * mult * freeze;
        };

        if (pattern === 'charge') {
            if (b.mode === 'fight' || b.mode === 'recover') {
                chase(b.mode === 'recover' ? 0.3 : 1);
                if (b.modeT > (b.mode === 'recover' ? 40 : enraged ? 100 : 150)) {
                    b.mode = 'windup';
                    b.modeT = 0;
                }
            } else if (b.mode === 'windup') {
                const n = U.normalizeVector(p.x - b.x, p.y - b.y);
                b.dashX = n.x;
                b.dashY = n.y;
                b.x += (Math.random() - 0.5) * 3;
                if (b.modeT > (enraged ? 34 : b.cycle === 0 ? 58 : 48)) {
                    b.mode = 'dash';
                    b.modeT = 0;
                    Sfx.tone(140, { duration: 0.3, type: 'sawtooth', volume: 0.1, slide: 200 });
                }
            } else if (b.mode === 'dash') {
                b.x += b.dashX * 10 * freeze;
                b.y += b.dashY * 10 * freeze;
                if (this.frameNo % 2 === 0) this.particle({ x: b.x, y: b.y, vx: 0, vy: 0, life: 18, size: b.size * 0.8, grow: -0.6, color: b.boss.color, kind: 'smoke' });
                const hitWall = b.x < b.size || b.x > this.W - b.size || b.y < b.size || b.y > this.H - b.size;
                if (b.modeT > 34 || hitWall) {
                    b.mode = 'recover';
                    b.modeT = 0;
                    this.shake(8);
                    if (enraged || b.cycle > 0) this.radial(b, 10, 2.6, b.boss.accent);
                }
            } else {
                b.mode = 'fight';
            }
        } else if (pattern === 'rings') {
            if (!b.wp || b.modeT > 200 || U.distanceSquared(b.x, b.y, b.wp.x, b.wp.y) < 100) {
                b.wp = { x: this.W * (0.2 + Math.random() * 0.6), y: this.H * (0.15 + Math.random() * 0.5) };
                if (b.modeT > 200) b.modeT = 0;
            }
            const n = U.normalizeVector(b.wp.x - b.x, b.wp.y - b.y);
            b.x += n.x * b.speed * freeze;
            b.y += n.y * b.speed * freeze;
            const every = enraged ? 80 : 120;
            if (b.t % every === 0) {
                b.volley++;
                if (b.volley % 3 === 0) {
                    const a = Math.atan2(p.y - b.y, p.x - b.x);
                    for (let i = -2; i <= 2; i++) this.enemyShot(b.x, b.y, a + i * 0.18, 3.4, b.boss.accent);
                } else {
                    this.radial(b, enraged ? 18 : 14, 2.4, b.boss.accent, b.volley * 0.2);
                }
            }
            if (enraged && b.t % 9 === 0) this.enemyShot(b.x, b.y, b.t * 0.07, 2.2, '#d7bde2');
        } else {
            chase(enraged ? 0.9 : 0.6);
            const every = enraged ? 160 : 220;
            if (b.t % every === 0) {
                const count = enraged ? 6 : 4;
                for (let i = 0; i < count; i++) {
                    const a = (i / count) * TAU;
                    const m = this.makeMonster(this.pickType('small'), b.x + Math.cos(a) * (b.size + 14), b.y + Math.sin(a) * (b.size + 14), 'chase');
                    m.enc = b.enc;
                    m.spawnT = 40;
                    m.minion = true;
                    m.points = 5;
                    this.monsters.push(m);
                }
                this.ring(b.x, b.y, b.size * 2, b.boss.accent, 20);
            }
            if (b.t % 300 === 150) {
                const a = Math.atan2(p.y - b.y, p.x - b.x);
                for (let i = -1; i <= 1; i++) this.enemyShot(b.x, b.y, a + i * 0.25, 2.8, b.boss.accent);
            }
        }

    },


    // ------------------------------------------------------------------ big bosses

    updateBigBoss(b, freeze) {
        b.t++;
        b.modeT++;
        b.atkT++;
        const p = this.player;
        const drift = (tx, ty, speed) => {
            const n = U.normalizeVector(tx - b.x, ty - b.y);
            const d = Math.hypot(tx - b.x, ty - b.y);
            b.x += n.x * Math.min(d, speed * freeze);
            b.y += n.y * Math.min(d, speed * freeze);
        };
        if (!b.wp || U.distanceSquared(b.x, b.y, b.wp.x, b.wp.y) < 64) {
            b.wp = { x: this.roadLeft + (this.roadRight - this.roadLeft) * (0.2 + Math.random() * 0.6), y: this.H * (0.14 + Math.random() * 0.16) };
        }
        const pat = b.boss.pattern;
        if (pat === 'gravelord') {
            drift(b.wp.x, b.wp.y, b.speed * (b.slamT > 0 ? 0 : 1));
            if (b.slamT > 0) {
                if (--b.slamT === 0) {
                    this.shockwave(b, b.enraged ? 0.32 : 0.48);
                    if (b.enraged) this.later(32, () => this.shockwave(b, 0.32));
                }
            } else if (b.atkT > (b.enraged ? 150 : 210)) {
                b.atkT = 0;
                b.volley++;
                if (b.volley % 2) {
                    b.slamT = 50;
                    this.floater(b.x, b.y - b.size - 14, 'SLAM!', '#fb923c', 20);
                } else {
                    this.boulders(b.enraged ? 3 : 2);
                }
            }
        } else if (pat === 'stormcaller') {
            if (b.tele) {
                b.tele.t++;
                b.alpha = b.tele.t < 24 ? 1 - b.tele.t / 24 : (b.tele.t - 24) / 24;
                if (b.tele.t === 24) {
                    b.x = this.roadLeft + (this.roadRight - this.roadLeft) * (0.15 + Math.random() * 0.7);
                    b.y = this.H * (0.12 + Math.random() * 0.2);
                    b.wp = null;
                }
                if (b.tele.t >= 48) {
                    b.tele = null;
                    b.alpha = 1;
                    b.invulnerable = false;
                }
                return;
            }
            drift(b.wp ? b.wp.x : b.x, b.wp ? b.wp.y : b.y, b.speed);
            if (b.modeT > 380 && !this.hazards.some(h => h.type === 'laser')) {
                b.modeT = 0;
                b.tele = { t: 0 };
                b.invulnerable = true;
                Sfx.tone(880, { duration: 0.3, type: 'sine', volume: 0.08, slide: -600, bus: 'sfx' });
                return;
            }
            if (b.atkT > (b.enraged ? 130 : 190)) {
                b.atkT = 0;
                b.volley++;
                if (b.volley % 2) this.laser(b);
                else {
                    this.bulletWall(b);
                    if (b.enraged) this.later(70, () => this.bulletWall(b));
                }
            }
        } else if (pat === 'hydra') {
            b.x += (this.W / 2 + Math.sin(b.t * 0.008) * 40 - b.x) * 0.05;
            b.y += (this.H * 0.18 - b.y) * 0.05;
            for (const r of b.regrow || []) {
                if (--r.t <= 0 && !b.dying) {
                    this.growHead(b, r.idx, 0.5);
                    this.floater(b.x + (r.idx - 1) * 70, b.y + 40, 'REGROWN!', '#a3e635', 20);
                }
            }
            b.regrow = (b.regrow || []).filter(r => r.t > 0);
        } else if (pat === 'lich') {
            drift(b.wp.x, b.wp.y, b.speed);
            const adds = this.monsters.filter(m => m.lichAdd && !m.dead);
            b.shielded = adds.length > 0;
            if (!adds.length && --b.summonT <= 0) {
                this.lichAdds(b, b.enraged ? 6 : 4);
                b.summonT = Math.round((b.enraged ? 8 : 12) * 60 * GAME_SPEED);
            }
            if (b.vortex > 0) {
                b.vortex--;
                const n = U.normalizeVector(b.x - p.x, b.y - p.y);
                p.x = U.clamp(p.x + n.x * 1.25, p.r, this.W - p.r);
                p.y = U.clamp(p.y + n.y * 1.25, p.r, this.H - p.r);
                if (this.frameNo % 2 === 0) {
                    const a = Math.random() * TAU;
                    const r = 140 + Math.random() * 60;
                    this.particle({ x: b.x + Math.cos(a) * r, y: b.y + Math.sin(a) * r, vx: -Math.cos(a - 0.6) * 4, vy: -Math.sin(a - 0.6) * 4, life: 30, size: 3, color: '#c4b5fd', kind: 'spark', drag: 0.98 });
                }
            } else if (b.modeT > 9 * 60 * GAME_SPEED) {
                b.modeT = 0;
                b.vortex = 110;
                this.floater(b.x, b.y - b.size - 14, 'VORTEX!', '#c4b5fd', 20);
                Sfx.fx('vortex', 1.8, (d, rate, len, k) => {
                    const r = k.rng(11);
                    for (let i = 0; i < len; i++) d[i] = (r() * 2 - 1) * Math.sin(Math.PI * i / len);
                    k.biquad(d, rate, 'bandpass', t => 300 + 900 * (1 - t), 4);
                    k.normalize(d, 0.7);
                }, { volume: 0.4 });
            }
            if (b.atkT > (b.enraged ? 80 : 110)) {
                b.atkT = 0;
                const a = Math.atan2(p.y - b.y, p.x - b.x);
                for (let i = -2; i <= 2; i++) this.enemyShot(b.x, b.y, a + i * 0.2, 3, 'skull');
            }
            // split in two at half health
            if (!b.split && !b.twin && b.hp < b.maxHp * 0.5) {
                b.split = true;
                const half = Math.round(b.maxHp / 2);
                b.maxHp = half;
                b.hp = Math.min(b.hp, half);
                b.size *= 0.82;
                const twin = this.makeBossBody(b.boss, b.hp, b.cycle, b.x, b.y);
                Object.assign(twin, { twin: true, split: true, size: b.size, mode: 'fight', maxHp: half, enraged: true, summonT: 200 });
                twin.kbx = 6;
                b.kbx = -6;
                this.bossParts.push(twin);
                this.ring(b.x, b.y, 120, '#a78bfa', 26);
                this.banner('THE LICH SPLITS!', 'Two of them now', 'danger');
            }
        }
    },

    /** Run a callback after `steps` simulation steps (encounter-scoped helper). */
    later(steps, fn) {
        this.hazards.push({ type: 'timer', t: 0, update: h => { if (h.t >= steps) { h.dead = true; if (this.state === 'playing' && this.boss) fn(); } } });
    },

    // Gravelord: ground slam → expanding shockwave ring with gaps to slip through.
    shockwave(b, gapW) {
        const gaps = [];
        const toP = Math.atan2(this.player.y - b.y, this.player.x - b.x);
        gaps.push(toP + (Math.random() < 0.5 ? 1 : -1) * (0.6 + Math.random() * 0.8));
        gaps.push(gaps[0] + Math.PI * (0.8 + Math.random() * 0.4));
        this.hazards.push({
            type: 'shock', x: b.x, y: b.y + b.size * 0.6, r: b.size, gaps, gapW, t: 0, owner: b,
            update: h => {
                h.r += 3.2;
                if (h.r > Math.hypot(this.W, this.H)) h.dead = true;
                const p = this.player;
                const d = Math.hypot(p.x - h.x, p.y - h.y);
                if (Math.abs(d - h.r) < 9 + p.r * 0.5) {
                    const a = Math.atan2(p.y - h.y, p.x - h.x);
                    if (!h.gaps.some(g => Math.abs(U.angleDelta(g, a)) < h.gapW / 2)) this.hurtPlayer(h.owner);
                }
            },
            draw: (ctx, h) => {
                const fade = Math.max(0, 1 - h.r / Math.hypot(this.W, this.H));
                ctx.strokeStyle = `rgba(251,146,60,${0.85 * fade})`;
                ctx.lineWidth = 10;
                ctx.lineCap = 'round';
                const g = h.gaps.map(x => ((x % TAU) + TAU) % TAU).sort((a, c) => a - c);
                for (let i = 0; i < g.length; i++) {
                    const from = g[i] + h.gapW / 2;
                    const to = (i + 1 < g.length ? g[i + 1] : g[0] + TAU) - h.gapW / 2;
                    ctx.beginPath();
                    ctx.arc(h.x, h.y, h.r, from, to);
                    ctx.stroke();
                }
                ctx.strokeStyle = `rgba(255,237,213,${0.9 * fade})`;
                ctx.lineWidth = 3;
                for (let i = 0; i < g.length; i++) {
                    const from = g[i] + h.gapW / 2;
                    const to = (i + 1 < g.length ? g[i + 1] : g[0] + TAU) - h.gapW / 2;
                    ctx.beginPath();
                    ctx.arc(h.x, h.y, h.r, from, to);
                    ctx.stroke();
                }
                ctx.lineCap = 'butt';
            }
        });
        this.decal(b.x, b.y + b.size, b.size * 1.6, 'crack');
        this.shake(14);
        Sfx.play('boom', { volume: 0.8, rate: 0.55 });
    },

    // Gravelord: telegraphed lanes, then boulders roll down them.
    boulders(count) {
        const L = this.roadLeft;
        const R = this.roadRight;
        const w = 60;
        const lanes = [U.clamp(this.player.x - w / 2, L, R - w)];
        while (lanes.length < count) {
            const x = L + Math.random() * (R - L - w);
            if (lanes.every(o => Math.abs(o - x) > w * 1.3)) lanes.push(x);
        }
        for (const x of lanes) {
            this.hazards.push({ type: 'laneWarn', x, w, t: 0, life: 55 });
            this.later(55, () => this.hazards.push({
                type: 'boulder', x: x + w / 2, y: -30, r: 22, rot: 0, t: 0,
                update: h => {
                    h.y += 4.4 * this.mobSpeedMult;
                    h.rot += 0.12;
                    if (h.y > this.H + 40) h.dead = true;
                    const p = this.player;
                    if (U.distanceSquared(h.x, h.y, p.x, p.y) < (h.r + p.r * 0.7) ** 2) this.hurtPlayer(this.boss || { name: 'a boulder', shape: 'circle', color: '#78716c', size: 20 });
                    if (h.t % 6 === 0) this.particle({ x: h.x + (Math.random() - 0.5) * h.r, y: h.y - h.r, vx: 0, vy: -0.5, life: 22, size: 6, grow: 0.3, color: 'rgba(120,113,108,0.35)', kind: 'smoke' });
                },
                draw: (ctx, h) => {
                    this.drawShadow(ctx, h.x, h.y + h.r * 0.8, h.r);
                    ctx.save();
                    ctx.translate(h.x, h.y);
                    ctx.rotate(h.rot);
                    ctx.fillStyle = '#8b8178';
                    ctx.strokeStyle = '#292524';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    for (let i = 0; i < 9; i++) {
                        const a = (i / 9) * TAU;
                        const rr = h.r * (0.86 + ((i * 37) % 10) / 70);
                        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
                    }
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();
                    ctx.strokeStyle = 'rgba(41,37,36,0.6)';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(-h.r * 0.4, -h.r * 0.2);
                    ctx.lineTo(h.r * 0.1, h.r * 0.1);
                    ctx.lineTo(h.r * 0.3, h.r * 0.5);
                    ctx.stroke();
                    ctx.restore();
                }
            }));
        }
        Sfx.tone(110, { duration: 0.5, type: 'sawtooth', volume: 0.08, slide: -40, bus: 'sfx' });
    },

    // Stormcaller: telegraphed beam that then sweeps slowly.
    laser(b) {
        const p = this.player;
        const spin = (Math.random() < 0.5 ? 1 : -1) * (b.enraged ? 0.016 : 0.011);
        this.hazards.push({
            type: 'laser', owner: b, angle: Math.atan2(p.y - b.y, p.x - b.x) - spin * 40, spin, t: 0, warn: 60, active: 150,
            update: h => {
                if (b.dead || b.dying || b.tele) {
                    h.dead = true;
                    return;
                }
                if (h.t > h.warn) {
                    h.angle += h.spin * this.mobSpeedMult;
                    const q = this.player;
                    const dx = q.x - b.x;
                    const dy = q.y - b.y;
                    const along = dx * Math.cos(h.angle) + dy * Math.sin(h.angle);
                    const off = Math.abs(-dx * Math.sin(h.angle) + dy * Math.cos(h.angle));
                    if (along > 0 && off < 10 + q.r * 0.5) this.hurtPlayer(b);
                    if (h.t === h.warn + 1) Sfx.fx('beam', 0.6, (d, rate, len, k) => {
                        k.osc(len, rate, 'sawtooth', 110, 90, d, 0.6);
                        k.osc(len, rate, 'square', 220, 180, d, 0.3);
                        for (let i = 0; i < len; i++) d[i] *= Math.min(1, i / 400) * Math.min(1, (len - i) / 2000);
                        k.biquad(d, rate, 'lowpass', 1800, 2);
                        k.normalize(d, 0.6);
                    }, { volume: 0.35 });
                }
                if (h.t > h.warn + h.active) h.dead = true;
            },
            draw: (ctx, h) => {
                const len = Math.hypot(this.W, this.H) * 1.2;
                const ex = b.x + Math.cos(h.angle) * len;
                const ey = b.y + Math.sin(h.angle) * len;
                ctx.lineCap = 'round';
                if (h.t <= h.warn) {
                    ctx.strokeStyle = `rgba(125,211,252,${0.25 + 0.35 * Math.sin(h.t * 0.5) ** 2})`;
                    ctx.lineWidth = 2;
                    ctx.setLineDash([12, 8]);
                    ctx.beginPath();
                    ctx.moveTo(b.x, b.y);
                    ctx.lineTo(ex, ey);
                    ctx.stroke();
                    ctx.setLineDash([]);
                } else {
                    for (const [w, c] of [[26, 'rgba(56,189,248,0.25)'], [12, 'rgba(125,211,252,0.7)'], [4, '#ffffff']]) {
                        ctx.strokeStyle = c;
                        ctx.lineWidth = w + Math.sin(h.t * 0.8) * 2;
                        ctx.beginPath();
                        ctx.moveTo(b.x, b.y);
                        ctx.lineTo(ex, ey);
                        ctx.stroke();
                    }
                }
                ctx.lineCap = 'butt';
            }
        });
    },

    // Stormcaller: a row of bullets falling down the screen with one gap to slip through.
    bulletWall(b) {
        const gapW = 110;
        const gapX = this.roadLeft + 30 + Math.random() * (this.roadRight - this.roadLeft - gapW - 60);
        for (let x = 10; x < this.W; x += 28) {
            if (x > gapX && x < gapX + gapW) continue;
            this.enemyShot(x, b.y + 20, Math.PI / 2, 2.3, 'spark');
        }
        Sfx.tone(660, { duration: 0.15, type: 'square', volume: 0.06, slide: -300, bus: 'sfx' });
    },

    // Hydra: three heads, each its own monster with its own HP and attack.
    growHeads(b) {
        b.heads = [];
        b.regrow = [];
        for (let i = 0; i < 3; i++) this.growHead(b, i, 1);
    },

    growHead(b, idx, frac) {
        const hp = Math.round(b.maxHp * 0.28 * frac) || 10;
        const head = this.makeMonster({ name: 'Hydra Head', shape: 'circle', color: b.boss.color, size: 17, speed: 0, speedVariation: 0, health: 1, points: 80, tier: 'elite' }, b.x, b.y + 40, 'boss');
        Object.assign(head, {
            ai: 'hydraHead', body: b, idx, hp, maxHp: hp, anchored: true, heavy: true, gk: true, spawnT: 10, enc: b.enc, hidden: true,
            t: idx * 50, lunge: 0, mouth: 0, onDeath: m => {
                b.regrow.push({ idx: m.idx, t: Math.round(8 * 60 * GAME_SPEED) });
                b.heads[m.idx] = null;
                this.floater(m.x, m.y - 30, 'HEAD OFF!', '#a3e635', 20);
            }
        });
        b.heads[idx] = head;
        b.damageScale = () => (b.heads.some(h => h && !h.dead) ? 0.3 : 1);
        this.monsters.push(head);
    },

    updateHydraHead(m, freeze) {
        const b = m.body;
        if (!b || b.dead || b.dying) {
            m.dead = true;
            return;
        }
        m.t++;
        const p = this.player;
        const restX = b.x + (m.idx - 1) * 92 + Math.sin(m.t * 0.04 + m.idx) * 10;
        const restY = b.y + 78 - Math.abs(m.idx - 1) * 14 + Math.cos(m.t * 0.05 + m.idx) * 8;
        if (m.mouth > 0) m.mouth--;
        const period = b.enraged ? 120 : 165;
        if (m.idx === 2 && m.lunge > 0) {
            // bite: dart towards where the player was, then pull back
            m.lunge--;
            const k = m.lunge > 30 ? (60 - m.lunge) / 30 : m.lunge / 30;
            m.x = restX + (m.lx - restX) * k;
            m.y = restY + (m.ly - restY) * k;
            return;
        }
        m.x += (restX - m.x) * 0.2;
        m.y += (restY - m.y) * 0.2;
        if (m.t % period === 0) {
            const a = Math.atan2(p.y - m.y, p.x - m.x);
            m.mouth = 24;
            if (m.idx === 0) {
                for (let i = -3; i <= 3; i++) this.enemyShot(m.x, m.y, a + i * 0.09, 3.2 + Math.random() * 0.4, 'fire');
                Sfx.fx('fire', 0.5, (d, rate, len, k) => {
                    const r = k.rng(21);
                    for (let i = 0; i < len; i++) d[i] = (r() * 2 - 1) * Math.pow(1 - i / len, 1.5);
                    k.biquad(d, rate, 'lowpass', 1400, 0.8);
                    k.normalize(d, 0.7);
                }, { volume: 0.35 });
            } else if (m.idx === 1) {
                for (let i = -1; i <= 1; i++) this.enemyShot(m.x, m.y, a + i * 0.3, 2.2, 'acid', 9);
            } else {
                const reach = Math.min(190, Math.hypot(p.x - m.x, p.y - m.y));
                m.lx = m.x + Math.cos(a) * reach;
                m.ly = m.y + Math.sin(a) * reach;
                m.lunge = 60;
                Sfx.tone(180, { duration: 0.2, type: 'sawtooth', volume: 0.08, slide: 120, bus: 'sfx' });
            }
        }
    },

    // Lich: skeleton guards keep a shield up while they live.
    lichAdds(b, n) {
        for (let i = 0; i < n; i++) {
            const a = (i / n) * TAU;
            const m = this.makeMonster({ name: 'Skeleton', shape: 'skull', color: '#e7e5e4', size: 12, speed: 1.1, speedVariation: 0.3, health: 3, points: 20, tier: 'medium' }, b.x + Math.cos(a) * 70, b.y + Math.sin(a) * 70, 'chase');
            Object.assign(m, { lichAdd: b, minion: true, spawnT: 30, enc: b.enc, hp: Math.round(3 * U.hpScale(this.level)), maxHp: Math.round(3 * U.hpScale(this.level)) });
            this.monsters.push(m);
        }
        this.ring(b.x, b.y, 90, '#a78bfa', 22);
        Sfx.tone(300, { duration: 0.4, type: 'triangle', volume: 0.08, slide: -150, bus: 'sfx' });
    },

    // ------------------------------------------------------------------ shots

    radial(b, count, speed, color, offset = 0) {
        for (let i = 0; i < count; i++) this.enemyShot(b.x, b.y, offset + (i / count) * TAU, speed);
    },

    /** Enemy projectile. style: orb (default) | arrow | fire | acid | spark | skull. */
    enemyShot(x, y, angle, speed, style = 'orb', r = 6) {
        this.enemyShots.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r, life: 420, color: '#ff2d78', style });
    },

    updateEnemyShots() {
        const p = this.player;
        const freeze = this.mobSpeedMult;
        for (const s of this.enemyShots) {
            s.x += s.vx * freeze;
            s.y += s.vy * freeze;
            s.life--;
            if (s.x < -30 || s.x > this.W + 30 || s.y < -40 || s.y > this.H + 30) s.life = 0;
            if (s.life > 0 && U.distanceSquared(s.x, s.y, p.x, p.y) < (s.r + p.r * 0.7) ** 2) {
                if (this.untouchable) {
                    this.spark(s.x, s.y, s.color, 5);
                } else {
                    const shooter = this.boss || (this.encounter && this.encounter.kind === 'gatekeeper' ? { name: GATEKEEPERS[this.encounter.id].name, shape: 'triangle', color: GATEKEEPERS[this.encounter.id].color, size: 16 } : null);
                    this.hurtPlayer(shooter || { name: 'a stray curse', shape: 'circle', color: s.color, size: 12 });
                }
                s.life = 0;
            }
        }
        this.enemyShots = this.enemyShots.filter(s => s.life > 0);
    },

    // ------------------------------------------------------------------ death

    startBossDeath(b) {
        b.hp = 0;
        b.dying = true;
        b.deathT = 0;
        b.deathMax = 210; // ~3.9s of falling apart
        b.coinsTotal = Math.round((25 + 15 * this.bossCount) * (b.boss.big ? 2 : 1) / Math.max(1, (this.bossParts || [b]).length));
        b.coinsOut = 0;
        b.lootOut = 0;
        b.cracks = Array.from({ length: 7 }, () => ({ a: Math.random() * TAU, len: 0.5 + Math.random() * 0.5, bend: (Math.random() - 0.5) * 0.8 }));
        this.enemyShots = [];
        b.bubble = null;
        this.bossSay(b, 'death');
        if (b.heads) b.heads.forEach(h => { if (h && !h.dead) this.killMonster(h); });
        this.hazards = this.hazards.filter(h => h.owner !== b && h.type !== 'laser' && h.type !== 'shock');
        this.el.bossName.innerHTML = `${b.boss.name} <small>DEFEATED</small>`;
        this.floater(b.x, b.y - b.size - 14, 'DEFEATED!', '#ffd60a', 30);
        this.hitStop = 10;
        this.shake(14);
        Sfx.play('bossDeath', { volume: 0.9, rate: 0.55 });
    },

    updateBossDeath(b) {
        b.deathT++;
        const q = b.deathT / b.deathMax;
        b.flash = b.deathT % 9 < 2 ? 2 : 0;
        // Chunks break off, faster and faster
        const every = Math.max(3, Math.round(16 - 13 * q));
        if (b.deathT % every === 0) {
            const a = Math.random() * TAU;
            const ex = b.x + Math.cos(a) * b.size * 0.8;
            const ey = b.y + Math.sin(a) * b.size * 0.8;
            for (let i = 0; i < 3; i++) {
                const v = 0.8 + Math.random() * 2.2;
                this.particle({ x: ex, y: ey, vx: Math.cos(a + (Math.random() - 0.5)) * v, vy: Math.sin(a + (Math.random() - 0.5)) * v, life: 70 + Math.random() * 40, size: 5 + Math.random() * 7, color: Math.random() < 0.6 ? b.boss.color : b.boss.accent, kind: 'chunk', drag: 0.965 });
            }
            this.particle({ x: ex, y: ey, vx: 0, vy: -0.3, life: 40, size: 10, grow: 0.5, color: 'rgba(60,40,30,0.25)', kind: 'smoke' });
            this.explosions.push({ x: ex, y: ey, r: 12 + 10 * q, t: 0, max: 14 });
            this.shake(2 + 4 * q);
            Sfx.play('boom', { volume: 0.2 + 0.3 * q, rate: 1.4 - 0.5 * q + Math.random() * 0.2 });
        }
        // Gold pours out over the whole sequence
        const due = Math.floor(b.coinsTotal * Math.min(1, q * 1.1));
        if (due > b.coinsOut) {
            this.spawnCoins(b.x, b.y, due - b.coinsOut, 4.5, 6);
            b.coinsOut = due;
        }
        // Powerups pop out at fixed beats: a heart first, then two random ones
        const beats = [0.3, 0.6, 0.85];
        while (b.lootOut < beats.length && q >= beats[b.lootOut]) {
            this.spawnPowerup(b.x, b.y, b.lootOut === 0 ? 'heart' : null, { pop: true, loot: true, speed: 3.5 });
            b.lootOut++;
        }
        if (q >= 1) {
            this.explosions.push({ x: b.x, y: b.y, r: b.size * 2.4, t: 0, max: 30 });
            for (let i = 0; i < 4; i++) this.burst(b.x, b.y, [b.boss.color, b.boss.accent, '#ffffff', '#ffd60a'][i], 30, 8);
            this.ring(b.x, b.y, 220, b.boss.accent, 40);
            this.flash = { color: '255,255,255', t: 20, max: 20 };
            this.hitStop = 16;
            this.shake(26);
            Sfx.play('boom', { volume: 0.9, rate: 0.6 });
            this.killMonster(b);
        }
    },


    bossDefeated(b) {
        this.bossParts = (this.bossParts || []).filter(o => o !== b && !o.dead);
        if (this.bossParts.length) {
            this.boss = this.bossParts[0];
            return; // the other half of the lich is still up
        }
        this.boss = null;
        this.bossesSlain++;
        this.el.bossBar.hidden = true;
        const bonus = 300 * this.bossCount * (b.boss.big ? 2 : 1);
        this.score += bonus;
        this.floater(b.x, b.y - b.size - 10, `BOSS SLAIN +${bonus}`, '#ffd60a', 30);
        Sfx.arpeggio([523, 659, 784, 1046, 1318], 0.09, { type: 'triangle', volume: 0.12 });
        this.monsters.forEach(m => { if (m.minion || m.lichAdd || m.body === b) m.behavior = 'flee'; });
        this.encounterWon();
    },

    /** Boss bar: combined HP of all boss bodies (both lich halves; the hydra's body). */
    bossHealth() {
        const parts = (this.bossParts || []).filter(o => !o.dead);
        const max = parts.reduce((n, o) => n + o.maxHp, 0) || 1;
        const hp = parts.reduce((n, o) => n + Math.max(0, o.hp), 0);
        return U.clamp(hp / max, 0, 1);
    },

    // ------------------------------------------------------------------ big boss looks

    drawBubble(ctx, b) {
        const bb = b.bubble;
        const k = Math.min(1, (bb.max - bb.t) / 6, bb.t / 10);
        ctx.save();
        ctx.font = `15px ${DISPLAY_FONT}`;
        const words = bb.text.split(' ');
        const lines = [];
        let line = '';
        for (const w of words) {
            const test = line ? `${line} ${w}` : w;
            if (ctx.measureText(test).width > 190 && line) {
                lines.push(line);
                line = w;
            } else line = test;
        }
        lines.push(line);
        const w = Math.max(...lines.map(l => ctx.measureText(l).width)) + 22;
        const h = lines.length * 18 + 14;
        const x = U.clamp(b.x, w / 2 + 6, this.W - w / 2 - 6);
        // above the boss, unless that would sit under the boss bar — then below it
        const above = b.y - b.size * 1.5 - 18;
        const below = above - h < 130 * (this.H / 600);
        const y = below ? b.y + b.size * 1.6 + h + 18 : above;
        ctx.globalAlpha = k;
        ctx.translate(x, y);
        ctx.scale(0.8 + 0.2 * k, 0.8 + 0.2 * k);
        ctx.fillStyle = '#fff7ed';
        ctx.strokeStyle = '#1c1917';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(-w / 2, -h, w, h, 12);
        if (below) {
            ctx.moveTo(b.x - x - 8, -h + 1);
            ctx.lineTo(b.x - x, -h - 14);
            ctx.lineTo(b.x - x + 8, -h + 1);
        } else {
            ctx.moveTo(b.x - x - 8, -1);
            ctx.lineTo(b.x - x, 14);
            ctx.lineTo(b.x - x + 8, -1);
        }
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fff7ed';
        ctx.fillRect(b.x - x - 7, below ? -h : -4, 14, 4);
        ctx.fillStyle = '#7f1d1d';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        lines.forEach((l, i) => ctx.fillText(l, 0, -h + 16 + i * 18));
        ctx.restore();
    },

    drawBigBoss(ctx, b) {
        const def = b.boss;
        const s = b.size;
        const fill = b.flash > 0 ? '#ffffff' : def.color;
        const q = b.dying ? b.deathT / b.deathMax : 0;
        const look = U.normalizeVector(this.player.x - b.x, this.player.y - b.y);
        this.drawShadow(ctx, b.x, b.y + s * 0.95, s * 1.1);
        if (def.pattern === 'hydra') this.drawHydraNecks(ctx, b);
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.globalAlpha = b.alpha ?? 1;
        if (b.dying) {
            const j = 1.5 + 6 * q;
            ctx.translate((Math.random() - 0.5) * j, (Math.random() - 0.5) * j);
            ctx.scale(1 - 0.35 * q, 1 - 0.35 * q);
        }
        // aura
        ctx.save();
        ctx.globalAlpha *= 0.22 + (b.enraged ? 0.15 * Math.sin(b.t * 0.3) : 0);
        ctx.fillStyle = b.enraged ? '#ff3b30' : def.accent;
        ctx.beginPath();
        ctx.arc(0, 0, s * 1.5, 0, TAU);
        ctx.fill();
        ctx.restore();
        const O = '#111827';
        ctx.lineJoin = 'round';
        if (def.pattern === 'gravelord') {
            const lift = b.slamT > 0 ? -Math.sin((1 - b.slamT / 50) * Math.PI) * 10 : 0;
            ctx.translate(0, lift);
            for (const side of [-1, 1]) {
                ctx.fillStyle = fill;
                ctx.strokeStyle = O;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(side * s * 1.05, s * 0.25 + (b.slamT > 0 ? -12 : Math.sin(b.t * 0.05 + side) * 3), s * 0.42, 0, TAU);
                ctx.fill();
                ctx.stroke();
            }
            ctx.fillStyle = fill;
            ctx.strokeStyle = O;
            ctx.lineWidth = 4;
            ctx.beginPath();
            for (let i = 0; i < 10; i++) {
                const a = (i / 10) * TAU - Math.PI / 2;
                const rr = s * (0.9 + ((i * 7) % 5) / 25);
                ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.strokeStyle = `rgba(251,146,60,${0.6 + 0.4 * Math.sin(b.t * 0.1)})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(-s * 0.5, s * 0.5);
            ctx.lineTo(-s * 0.2, s * 0.2);
            ctx.lineTo(-s * 0.3, -s * 0.1);
            ctx.moveTo(s * 0.4, s * 0.6);
            ctx.lineTo(s * 0.15, s * 0.3);
            ctx.stroke();
            // glowing eyes + mossy brow
            ctx.fillStyle = '#4d7c0f';
            ctx.fillRect(-s * 0.7, -s * 0.62, s * 1.4, s * 0.16);
            for (const x of [-0.32, 0.32]) {
                ctx.fillStyle = '#fb923c';
                ctx.shadowColor = '#fb923c';
                ctx.shadowBlur = 12;
                ctx.beginPath();
                ctx.ellipse(x * s + look.x * 3, -s * 0.28 + look.y * 3, s * 0.12, s * 0.08, 0, 0, TAU);
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        } else if (def.pattern === 'stormcaller') {
            const bob = Math.sin(b.t * 0.06) * 4;
            ctx.translate(0, bob);
            for (let i = 0; i < 3; i++) {
                const a = b.t * 0.05 + (i / 3) * TAU;
                ctx.fillStyle = '#e0f2fe';
                ctx.shadowColor = '#38bdf8';
                ctx.shadowBlur = 14;
                ctx.beginPath();
                ctx.arc(Math.cos(a) * s * 1.4, Math.sin(a) * s * 0.5 - s * 0.2, 5, 0, TAU);
                ctx.fill();
            }
            ctx.shadowBlur = 0;
            // robe
            ctx.fillStyle = fill;
            ctx.strokeStyle = O;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(-s * 0.55, -s * 0.5);
            ctx.quadraticCurveTo(-s * 1.1, s * 0.6, -s * 0.9, s * 1.1);
            ctx.lineTo(s * 0.9, s * 1.1);
            ctx.quadraticCurveTo(s * 1.1, s * 0.6, s * 0.55, -s * 0.5);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = def.accent;
            for (let i = -2; i <= 2; i++) ctx.fillRect(i * s * 0.3 - 3, s * 0.95, 6, 6);
            // hood
            ctx.fillStyle = '#172554';
            ctx.beginPath();
            ctx.arc(0, -s * 0.45, s * 0.62, Math.PI, 0);
            ctx.lineTo(s * 0.5, -s * 0.1);
            ctx.lineTo(-s * 0.5, -s * 0.1);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#020617';
            ctx.beginPath();
            ctx.ellipse(0, -s * 0.35, s * 0.36, s * 0.3, 0, 0, TAU);
            ctx.fill();
            for (const x of [-0.14, 0.14]) {
                ctx.fillStyle = '#7dd3fc';
                ctx.shadowColor = '#7dd3fc';
                ctx.shadowBlur = 10;
                ctx.beginPath();
                ctx.arc(x * s + look.x * 2, -s * 0.38 + look.y * 2, s * 0.07, 0, TAU);
                ctx.fill();
            }
            ctx.shadowBlur = 0;
            // staff with a lightning crown
            ctx.strokeStyle = '#78350f';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(s * 0.9, s * 1.0);
            ctx.lineTo(s * 1.1, -s * 0.9);
            ctx.stroke();
            ctx.strokeStyle = '#fde047';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(s * 1.1, -s * 0.9);
            ctx.lineTo(s * 1.0, -s * 1.15);
            ctx.lineTo(s * 1.2, -s * 1.1);
            ctx.lineTo(s * 1.08, -s * 1.4);
            ctx.stroke();
        } else if (def.pattern === 'hydra') {
            ctx.fillStyle = fill;
            ctx.strokeStyle = O;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.ellipse(0, 0, s * 1.15, s * 0.85, 0, 0, TAU);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#d9f99d';
            ctx.beginPath();
            ctx.ellipse(0, s * 0.25, s * 0.7, s * 0.45, 0, 0, TAU);
            ctx.fill();
            ctx.strokeStyle = 'rgba(77,124,15,0.6)';
            ctx.lineWidth = 2;
            for (let i = -2; i <= 2; i++) {
                ctx.beginPath();
                ctx.moveTo(i * s * 0.22 - s * 0.1, s * 0.0);
                ctx.lineTo(i * s * 0.22 + s * 0.1, s * 0.6);
                ctx.stroke();
            }
            ctx.fillStyle = def.accent;
            for (let i = 0; i < 6; i++) {
                const a = -Math.PI * 0.9 + (i / 5) * Math.PI * 0.8;
                ctx.beginPath();
                ctx.moveTo(Math.cos(a) * s, Math.sin(a) * s * 0.75);
                ctx.lineTo(Math.cos(a) * s * 1.3, Math.sin(a) * s * 1.05);
                ctx.lineTo(Math.cos(a + 0.18) * s, Math.sin(a + 0.18) * s * 0.75);
                ctx.fill();
            }
            if (b.damageScale && b.damageScale() < 1) {
                ctx.strokeStyle = 'rgba(163,230,53,0.55)';
                ctx.lineWidth = 3;
                ctx.setLineDash([6, 6]);
                ctx.beginPath();
                ctx.ellipse(0, 0, s * 1.3, s, 0, 0, TAU);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        } else if (def.pattern === 'lich') {
            const bob = Math.sin(b.t * 0.05) * 4;
            ctx.translate(0, bob);
            ctx.fillStyle = fill;
            ctx.strokeStyle = O;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(-s * 0.6, -s * 0.2);
            ctx.lineTo(-s * 1.0, s * 1.1);
            for (let i = 0; i <= 6; i++) ctx.lineTo(-s + (i / 6) * s * 2, s * (1.1 + (i % 2) * 0.2));
            ctx.lineTo(s * 0.6, -s * 0.2);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            // skull
            ctx.fillStyle = b.flash > 0 ? '#fff' : '#f5f5f4';
            ctx.beginPath();
            ctx.arc(0, -s * 0.45, s * 0.55, 0, TAU);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#1c1917';
            for (const x of [-0.22, 0.22]) {
                ctx.beginPath();
                ctx.ellipse(x * s, -s * 0.5, s * 0.15, s * 0.18, 0, 0, TAU);
                ctx.fill();
                ctx.fillStyle = '#a78bfa';
                ctx.shadowColor = '#a78bfa';
                ctx.shadowBlur = 12;
                ctx.beginPath();
                ctx.arc(x * s + look.x * 2, -s * 0.5 + look.y * 2, s * 0.06, 0, TAU);
                ctx.fill();
                ctx.shadowBlur = 0;
                ctx.fillStyle = '#1c1917';
            }
            ctx.fillRect(-s * 0.25, -s * 0.18, s * 0.5, s * 0.08);
            // crown
            ctx.fillStyle = '#facc15';
            ctx.beginPath();
            ctx.moveTo(-s * 0.45, -s * 0.85);
            for (let i = 0; i <= 4; i++) ctx.lineTo(-s * 0.45 + i * s * 0.225, -s * (i % 2 ? 0.95 : 1.2));
            ctx.lineTo(s * 0.45, -s * 0.85);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            if (b.shielded) {
                ctx.strokeStyle = `rgba(196,181,253,${0.6 + 0.3 * Math.sin(b.t * 0.2)})`;
                ctx.fillStyle = 'rgba(167,139,250,0.15)';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(0, 0, s * 1.55, 0, TAU);
                ctx.fill();
                ctx.stroke();
            }
            if (b.vortex > 0) {
                ctx.strokeStyle = 'rgba(196,181,253,0.5)';
                ctx.lineWidth = 2;
                for (let i = 0; i < 3; i++) {
                    ctx.beginPath();
                    ctx.arc(0, 0, s * (2 + i), b.t * 0.15 + i, b.t * 0.15 + i + 2);
                    ctx.stroke();
                }
            }
        }
        if (b.dying) {
            ctx.globalAlpha = 0.6 * q;
            ctx.fillStyle = '#140800';
            ctx.beginPath();
            ctx.arc(0, 0, s * 1.02, 0, TAU);
            ctx.fill();
            ctx.globalAlpha = 1;
            for (const c of b.cracks || []) {
                const len = s * c.len * Math.min(1, q * 1.6);
                ctx.strokeStyle = `rgba(255,${Math.round(150 + 80 * q)},60,${0.5 + 0.5 * q})`;
                ctx.lineWidth = 2 + 2 * q;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(Math.cos(c.a) * len, Math.sin(c.a) * len);
                ctx.stroke();
            }
        }
        ctx.restore();
        if (def.pattern === 'hydra') this.drawHydraHeads(ctx, b);
    },

    drawHydraNecks(ctx, b) {
        for (const h of b.heads || []) {
            if (!h || h.dead) continue;
            ctx.strokeStyle = '#111827';
            ctx.lineWidth = 15;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(b.x + (h.idx - 1) * b.size * 0.5, b.y);
            ctx.quadraticCurveTo(b.x + (h.idx - 1) * b.size * 1.1, b.y + 20, h.x, h.y);
            ctx.stroke();
            ctx.strokeStyle = h.flash > 0 ? '#fff' : b.boss.color;
            ctx.lineWidth = 10;
            ctx.stroke();
            ctx.lineCap = 'butt';
        }
    },

    drawHydraHeads(ctx, b) {
        const p = this.player;
        for (const h of b.heads || []) {
            if (!h || h.dead) continue;
            const a = Math.atan2(p.y - h.y, p.x - h.x);
            ctx.save();
            ctx.translate(h.x, h.y);
            ctx.rotate(a);
            const open = h.mouth > 0 || h.lunge > 0 ? 0.5 : 0.12;
            const col = h.flash > 0 ? '#ffffff' : ['#15803d', '#0f766e', '#4d7c0f'][h.idx];
            ctx.fillStyle = col;
            ctx.strokeStyle = '#111827';
            ctx.lineWidth = 2.5;
            for (const side of [-1, 1]) {
                ctx.beginPath();
                ctx.moveTo(-h.size * 0.6, 0);
                ctx.quadraticCurveTo(h.size * 0.5, side * h.size * 0.9, h.size * 1.4, side * h.size * open);
                ctx.lineTo(-h.size * 0.2, side * 2);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            }
            ctx.beginPath();
            ctx.arc(-h.size * 0.2, 0, h.size * 0.75, 0, TAU);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#fde047';
            for (const side of [-1, 1]) {
                ctx.beginPath();
                ctx.ellipse(0, side * h.size * 0.38, h.size * 0.18, h.size * 0.12, 0, 0, TAU);
                ctx.fill();
            }
            if (h.idx === 0 && h.mouth > 0) {
                ctx.fillStyle = 'rgba(255,140,0,0.6)';
                ctx.beginPath();
                ctx.arc(h.size * 1.4, 0, 6 + Math.random() * 4, 0, TAU);
                ctx.fill();
            }
            ctx.restore();
            const w = 34;
            const pct = U.clamp(h.hp / h.maxHp, 0, 1);
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(h.x - w / 2 - 1, h.y - h.size - 12, w + 2, 6);
            ctx.fillStyle = '#a3e635';
            ctx.fillRect(h.x - w / 2, h.y - h.size - 11, w * pct, 4);
        }
    }
});
