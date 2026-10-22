/* Monster Hunter — level flow and encounters: progress bar → CLEAR! → gatekeeper / wave / boss →
   loot → travel through the gate to the next biome → shop. Extends Game (js/core.js). */

const GATEKEEPERS = {
    shield: { name: 'Shieldbearer', title: 'Hit it from the sides!', color: '#64748b', size: 28, hp: 34 },
    splitter: { name: 'Splitter', title: 'It splits when it dies', color: '#22c55e', size: 30, hp: 24 },
    bomber: { name: 'Bomber', title: 'Watch out for the mines!', color: '#9a3412', size: 26, hp: 26 },
    charger: { name: 'Charger', title: 'Dodge the red lane!', color: '#b91c1c', size: 30, hp: 30 },
    totem: { name: 'Totem', title: 'Smash it before it heals them all', color: '#a16207', size: 26, hp: 42 },
    archers: { name: 'Archers', title: 'Snipers in the bushes!', color: '#047857', size: 18, hp: 18 }
};
const WAVES = {
    vee: { name: 'V-Formation', title: 'Incoming from above!' },
    pincer: { name: 'Pincer', title: 'They come from both sides!' },
    ring: { name: 'Closing Ring', title: 'Get out of the circle!' },
    stampede: { name: 'Stampede', title: 'Stay out of the red lane!' },
    conga: { name: 'Conga Snake', title: 'A very long monster!' },
    rain: { name: 'Monster Rain', title: 'Watch the columns!' }
};

extendGame({
    // ------------------------------------------------------------------ level flow

    startLevel() {
        this.phase = 'fight';
        this.progress = 0;
        this.target = U.levelDamage(this.level);
        this.biome = this.biomeFor(this.level);
        this.encounter = null;
        this.clearT = 0;
        const kind = U.encounterKind(this.level);
        if (kind !== 'regular') this.preloadBossVoice(this.nextBossDef(kind));
    },

    addProgress(amount) {
        if (this.phase !== 'fight' || amount <= 0) return;
        this.progress += amount * (this.buffs.xp2 ? 2 : 1);
        if (this.progress >= this.target) this.clearLevel();
    },

    levelProgress() {
        return this.phase === 'fight' ? U.clamp(this.progress / this.target, 0, 1) : 1;
    },

    clearLevel() {
        this.phase = 'clear';
        this.clearT = 0;
        this.banner('CLEAR!', 'Finish off the stragglers');
        Sfx.arpeggio([523, 784, 1046], 0.07, { type: 'triangle', volume: 0.12 });
    },

    updateLevelFlow() {
        if (this.phase === 'clear') {
            this.clearT++;
            const left = this.monsters.filter(m => !m.dead && !m.dying);
            if (this.clearT === Math.round(10 * 60 * GAME_SPEED)) left.forEach(m => { m.behavior = 'flee'; m.ai = null; });
            if (!left.length && this.clearT > 40) this.startEncounter();
        } else if (this.phase === 'encounter') {
            this.updateEncounter();
        } else if (this.phase === 'loot') {
            if (--this.lootT <= 0) this.startTravel();
        } else if (this.phase === 'travel') {
            // the road rushes on; leftover loot flies to you
            const p = this.player;
            for (const c of this.coinDrops) {
                c.x += (p.x - c.x) * 0.12;
                c.y += (p.y - c.y) * 0.12;
                c.t = Math.max(c.t, 19);
            }
            for (const pu of this.powerups) {
                pu.x += (p.x - pu.x) * 0.1;
                pu.y += (p.y - pu.y) * 0.1;
                pu.t = Math.max(pu.t, 16);
            }
        }
    },

    startTravel() {
        this.phase = 'travel';
        this.seam = { y: -130, biome: this.biomeFor(this.level + 1) };
        this.biomeTile(this.seam.biome); // render the next tile now, before it scrolls in
        Sfx.fx('whoosh', 0.9, (d, rate, len, k) => {
            const r = k.rng(3);
            for (let i = 0; i < len; i++) d[i] = (r() * 2 - 1) * Math.sin(Math.PI * i / len);
            k.biquad(d, rate, 'bandpass', t => 300 + 1600 * t, 1.2);
            k.normalize(d, 0.7);
        }, { volume: 0.35, priority: 2 });
    },

    finishTravel() {
        this.seam = null;
        this.level++;
        this.biome = this.biomeFor(this.level);
        this.buffs = {}; // one-level cards end with the level
        const earned = this.coinsEarned - this.levelCoinsStart;
        this.incomeEMA = this.incomeEMA ? 0.5 * this.incomeEMA + 0.5 * earned : earned;
        this.levelCoinsStart = this.coinsEarned;
        if (this.statsLog) this.statsLog.endLevel(this);
        this.pendingLevels = 1;
        this.phase = 'shop';
    },

    // ------------------------------------------------------------------ encounter selection

    nextBossDef(kind) {
        if (kind === 'bigBoss') return BIG_BOSSES[this.bigCount % BIG_BOSSES.length];
        return BOSSES[this.smallCount % BOSSES.length];
    },

    /** Deck of encounters: all easy variants shuffled, then all hard ones — no repeats for a long time. */
    drawFromDeck(key, ids) {
        this.decks = this.decks || {};
        if (!this.decks[key] || !this.decks[key].length) {
            const shuffle = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(v => v[1]);
            this.decks[key] = [...shuffle(ids.map(id => [id, 'A'])), ...shuffle(ids.map(id => [id, 'B']))];
        }
        return this.decks[key].shift();
    },

    startEncounter() {
        const kind = U.encounterKind(this.level);
        this.phase = 'encounter';
        const enc = this.encounter = { kind, t: 0, done: false, queue: [], spawned: 0 };
        if (kind === 'bigBoss' || kind === 'smallBoss') {
            // L100 would bring the super boss; until it exists it falls back to a big boss.
            enc.def = this.nextBossDef(kind);
            if (kind === 'bigBoss') this.bigCount++;
            else this.smallCount++;
            this.startBossWarning(enc.def);
            return;
        }
        const gk = this.regularCount++ % 2 === 0;
        if (gk) {
            const [id, variant] = this.drawFromDeck('gk', Object.keys(GATEKEEPERS));
            Object.assign(enc, { kind: 'gatekeeper', id, variant });
            const def = GATEKEEPERS[id];
            this.banner(`${variant === 'B' ? 'TWIN ' : ''}${def.name.toUpperCase()}`, def.title, 'danger');
            this.spawnGatekeeper(id, variant);
        } else {
            const [id, variant] = this.drawFromDeck('wave', Object.keys(WAVES));
            Object.assign(enc, { kind: 'wave', id, variant });
            const def = WAVES[id];
            this.banner(def.name.toUpperCase(), def.title, 'danger');
            this.startWave(id, variant);
        }
        Sfx.tone(220, { duration: 0.35, type: 'sawtooth', volume: 0.09, slide: -80 });
    },

    updateEncounter() {
        const enc = this.encounter;
        if (!enc) return;
        enc.t++;
        if (enc.kind === 'gatekeeper' || enc.kind === 'wave') {
            if (enc.kind === 'wave') this.updateWave(enc);
            const alive = this.monsters.some(m => m.enc === enc && !m.dead);
            if (!alive && !enc.queue.length && enc.t > 30) this.encounterWon();
        }
        // bosses call encounterWon() from bossDefeated()
    },

    encounterWon() {
        const enc = this.encounter;
        if (!enc || enc.done) return;
        enc.done = true;
        this.phase = 'loot';
        this.lootT = Math.round(4.5 * 60 * GAME_SPEED);
        this.hazards = this.hazards.filter(h => h.type === 'scorch');
        if (enc.kind === 'gatekeeper' || enc.kind === 'wave') {
            // reward: a shower of coins on the road ahead and a pickup
            const n = 8 + 2 * this.level;
            for (let i = 0; i < 5; i++) this.spawnCoins(this.roadLeft + 40 + Math.random() * (this.roadRight - this.roadLeft - 80), this.H * (0.15 + Math.random() * 0.3), n / 5, 2.5, 5);
            this.spawnPowerup(this.W / 2, this.H * 0.25, null, { pop: true, loot: true });
            this.banner(enc.kind === 'wave' ? 'WAVE BEATEN!' : 'GATE OPEN!', '+ loot ahead');
            Sfx.arpeggio([523, 659, 784, 1046], 0.08, { type: 'triangle', volume: 0.12 });
        }
    },

    // ------------------------------------------------------------------ gatekeepers

    gkHp(base) {
        return Math.round(base * U.hpScale(this.level) * (1 + 0.12 * (this.level - 1)));
    },

    makeGatekeeper(id, x, y, extra = {}) {
        const def = GATEKEEPERS[id];
        const hp = this.gkHp(def.hp) * (extra.hpMult || 1);
        const m = this.makeMonster({ ...def, shape: 'circle', speed: 0.9, speedVariation: 0, health: 1, points: 150, tier: 'elite' }, x, y, 'chase');
        Object.assign(m, {
            ai: id, gk: true, enc: this.encounter, anchored: true, heavy: true, hp, maxHp: hp, size: def.size * (extra.sizeMult || 1),
            spawnT: 30, facing: Math.PI / 2, t: Math.floor(Math.random() * 40), gkName: def.name
        }, extra);
        this.monsters.push(m);
        return m;
    },

    spawnGatekeeper(id, variant) {
        const twin = variant === 'B';
        const cx = this.W / 2;
        const L = this.roadLeft;
        const R = this.roadRight;
        if (id === 'shield') {
            this.makeGatekeeper('shield', cx - (twin ? 70 : 0), -40, { frontShield: true });
            if (twin) this.makeGatekeeper('shield', cx + 70, -60, { frontShield: true });
            for (let i = 0; i < (twin ? 4 : 2); i++) this.escort('small', L + Math.random() * (R - L), -80 - i * 20);
        } else if (id === 'splitter') {
            const mk = x => this.makeGatekeeper('splitter', x, -40, { gen: 0, onDeath: mm => this.split(mm) });
            mk(cx - (twin ? 60 : 0));
            if (twin) mk(cx + 60);
        } else if (id === 'bomber') {
            this.makeGatekeeper('bomber', cx, -40, { homeY: Math.max(this.H * 0.17, this.topSafe + 10), every: twin ? 70 : 95, mines: twin ? 2 : 1, harmless: false });
        } else if (id === 'charger') {
            this.makeGatekeeper('charger', cx, -50, { mode: 'aim', t: 0 });
            if (twin) this.makeGatekeeper('charger', cx, -50, { mode: 'aim', t: -90 });
        } else if (id === 'totem') {
            this.makeGatekeeper('totem', twin ? L + (R - L) * 0.3 : cx, this.H * 0.3, { spawnT: 0 });
            if (twin) this.makeGatekeeper('totem', L + (R - L) * 0.7, this.H * 0.36, { spawnT: 0 });
        } else if (id === 'archers') {
            // in the bushes right at the roadside, within reach of every class
            this.makeGatekeeper('archers', Math.max(24, L - 26), this.H * 0.3, { side: -1, t: 0 });
            this.makeGatekeeper('archers', Math.min(this.W - 24, R + 26), this.H * 0.4, { side: 1, t: 50 });
            if (twin) this.encounter.queue = Array.from({ length: 6 }, (_, i) => ({ at: 120 + i * 40, fn: () => this.escort('small', L + Math.random() * (R - L), -30) }));
        }
    },

    escort(tier, x, y) {
        const m = this.makeMonster(this.pickType(tier), x, y, 'chase');
        m.enc = this.encounter;
        this.monsters.push(m);
        return m;
    },

    split(m) {
        if (m.gen >= 2) return;
        for (let i = 0; i < 2; i++) {
            const a = (i ? 0 : Math.PI) + (Math.random() - 0.5);
            const child = this.makeGatekeeper('splitter', m.x + Math.cos(a) * 10, m.y + Math.sin(a) * 10, {
                gen: m.gen + 1, sizeMult: m.gen === 0 ? 0.7 : 0.48, hpMult: m.gen === 0 ? 0.45 : 0.2, spawnT: 10,
                onDeath: mm => this.split(mm), heavy: false
            });
            child.kbx = Math.cos(a) * 7;
            child.kby = Math.sin(a) * 7;
            child.points = m.gen === 0 ? 60 : 30;
        }
        this.ring(m.x, m.y, m.size * 2, '#86efac', 16);
    },

    /** Per-step behaviour of gatekeepers and wave members. */
    updateAi(m, freeze) {
        const p = this.player;
        m.t = (m.t || 0) + 1;
        const toP = Math.atan2(p.y - m.y, p.x - m.x);
        const s = m.speed * freeze;
        switch (m.ai) {
            case 'shield': {
                m.facing += U.clamp(U.angleDelta(m.facing, toP), -0.025, 0.025);
                if (m.y < 60) m.y += 1.5;
                m.x += Math.cos(toP) * s * 0.8;
                m.y += Math.sin(toP) * s * 0.8;
                break;
            }
            case 'splitter': {
                const hop = Math.max(0, Math.sin(m.t * 0.15));
                m.x += Math.cos(toP) * s * (0.6 + hop);
                m.y += Math.sin(toP) * s * (0.6 + hop) + (m.y < 50 ? 1 : 0);
                m.squash = hop;
                break;
            }
            case 'bomber': {
                if (m.y < m.homeY) m.y += 1.5;
                m.x = this.W / 2 + Math.sin(m.t * 0.012) * (this.roadRight - this.roadLeft) * 0.42;
                if (m.t % m.every === 0 && m.y >= m.homeY - 5) {
                    for (let i = 0; i < m.mines; i++) {
                        this.hazards.push({ type: 'mine', x: m.x + (i - (m.mines - 1) / 2) * 30, y: m.y + 10, r: 9, arm: 40, life: 520, grounded: true, t: 0 });
                    }
                    Sfx.tone(330, { duration: 0.08, type: 'square', volume: 0.06, bus: 'sfx' });
                }
                break;
            }
            case 'charger': {
                if (m.mode === 'aim') {
                    if (m.t < 0) break;
                    m.y += (Math.max(70, this.topSafe) - m.y) * 0.08;
                    m.x += U.clamp(p.x - m.x, -2.2, 2.2) * freeze;
                    m.lane = m.t > 20;
                    if (m.t > 75) {
                        m.mode = 'charge';
                        m.t = 0;
                        Sfx.tone(140, { duration: 0.3, type: 'sawtooth', volume: 0.1, slide: 200, bus: 'sfx' });
                    }
                } else {
                    m.lane = false;
                    m.y += 9 * freeze;
                    if (m.t % 2 === 0) this.particle({ x: m.x, y: m.y - m.size, vx: 0, vy: -1, life: 16, size: m.size * 0.7, grow: -0.5, color: 'rgba(185,28,28,0.5)', kind: 'smoke' });
                    if (m.y > this.H + 60) {
                        m.y = -50;
                        m.mode = 'aim';
                        m.t = 0;
                    }
                }
                break;
            }
            case 'totem': {
                if (m.t % 150 === 0) {
                    const kids = this.monsters.filter(o => o.totemKid === m && !o.dead).length;
                    for (let i = 0; i < 2 && kids + i < 8; i++) {
                        const k = this.escort('small', m.x + (i ? 24 : -24), m.y + 10);
                        k.totemKid = m;
                        k.spawnT = 20;
                    }
                    this.ring(m.x, m.y, 50, '#fde047', 18);
                }
                if (m.t % 60 === 0) {
                    m.beams = [];
                    for (const o of this.monsters) {
                        if (o === m || o.dead || o.enc !== m.enc || o.hp >= o.maxHp) continue;
                        if (U.distanceSquared(o.x, o.y, m.x, m.y) < 170 * 170) {
                            o.hp = Math.min(o.maxHp, o.hp + Math.max(1, o.maxHp * 0.06));
                            m.beams.push(o);
                        }
                    }
                    m.beamT = 20;
                }
                if (m.beamT > 0) m.beamT--;
                break;
            }
            case 'archers': {
                const top = Math.max(this.H * 0.12, this.topSafe);
                const span = this.H * 0.45;
                m.y = top + span * (0.5 + 0.5 * Math.sin(m.t * 0.01 + (m.side > 0 ? 2 : 0)));
                if (m.t % 100 === 0) {
                    const lead = 18;
                    const a = Math.atan2(p.y + p.vy * lead - m.y, p.x + p.vx * lead - m.x);
                    this.enemyShot(m.x, m.y, a, 4.2, 'arrow');
                    m.drawT = 12;
                }
                if (m.drawT > 0) m.drawT--;
                break;
            }
            case 'wave':
                this.moveWaveMob(m, freeze);
                if (m.y > this.H + 40 + m.size) {
                    m.dead = true; // ran off the bottom: this one got away
                    m.escaped = true;
                }
                break;
            case 'hydraHead':
                this.updateHydraHead(m, freeze);
                break;
        }
    },

    // ------------------------------------------------------------------ coordinated waves

    waveMob(tier, x, y, extra = {}) {
        const m = this.makeMonster(this.pickType(tier), x, y, 'chase');
        Object.assign(m, { ai: 'wave', enc: this.encounter, anchored: true, spawnT: 0, ignoreFloor: true }, extra);
        this.monsters.push(m);
        return m;
    },

    breakFormation(m) {
        m.ai = null;
        m.anchored = false;
        m.behavior = 'chase';
    },

    startWave(id, variant) {
        const enc = this.encounter;
        const hard = variant === 'B';
        const tier = hard ? 'medium' : 'small';
        const L = this.roadLeft;
        const R = this.roadRight;
        const cx = (L + R) / 2;
        if (id === 'vee') {
            const n = hard ? 13 : 9;
            const x0 = L + (R - L) * (0.3 + Math.random() * 0.4);
            for (let i = 0; i < n; i++) {
                const k = Math.ceil(i / 2) * (i % 2 ? -1 : 1);
                this.waveMob(tier, x0 + k * 28, -40 - Math.abs(k) * 24, { kind: 'vee', vy: 1.6 });
            }
        } else if (id === 'pincer') {
            const n = hard ? 8 : 6;
            for (const side of [-1, 1]) {
                for (let i = 0; i < n; i++) {
                    const x = side < 0 ? -20 - (i % 2) * 22 : this.W + 20 + (i % 2) * 22;
                    this.waveMob(tier, x, this.H * 0.15 + i * (this.H * 0.4 / n), { kind: 'pincer', vx: -side * 2.1 });
                }
            }
        } else if (id === 'ring') {
            const p = this.player;
            const n = hard ? 20 : 14;
            const r = Math.min(230, Math.min(this.W, this.H) * 0.42);
            this.hazards.push({ type: 'ringWarn', x: p.x, y: p.y, r, n, t: 0, life: 75 });
            enc.queue.push({ at: 75, fn: () => {
                for (let i = 0; i < n; i++) {
                    const a = (i / n) * TAU;
                    this.waveMob(tier, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, { kind: 'ring', cx: p.x, cy: p.y, life: 110, spawnT: 12 });
                }
            } });
        } else if (id === 'stampede') {
            const lanes = hard ? 3 : 2;
            const w = (R - L) / 3;
            for (let k = 0; k < lanes; k++) {
                enc.queue.push({ at: 10 + k * 150, fn: () => {
                    const lane = k === 0 ? Math.floor(Math.random() * 3) : U.clamp(Math.floor((this.player.x - L) / w), 0, 2);
                    const x0 = L + w * lane;
                    this.hazards.push({ type: 'laneWarn', x: x0, w, t: 0, life: 60 });
                    enc.queue.push({ at: enc.t + 60, fn: () => {
                        const n = hard ? 14 : 10;
                        for (let i = 0; i < n; i++) this.waveMob(tier, x0 + w * (0.2 + 0.6 * ((i % 3) / 2)), -30 - Math.floor(i / 3) * 34, { kind: 'stampede', vy: 4.5 });
                        Sfx.play('boom', { volume: 0.25, rate: 0.6 });
                    } });
                } });
            }
        } else if (id === 'conga') {
            const n = hard ? 24 : 16;
            const head = this.waveMob(hard ? 'large' : 'medium', cx, -30, { kind: 'congaHead', trail: [] });
            for (let i = 1; i <= n; i++) this.waveMob(tier, cx, -30 - i * 14, { kind: 'conga', leader: head, slot: i * 8 });
        } else if (id === 'rain') {
            const cols = 6;
            const w = (R - L) / cols;
            const drops = hard ? 18 : 12;
            for (let i = 0; i < drops; i++) {
                const col = (i * 7 + Math.floor(Math.random() * 2)) % cols;
                enc.queue.push({ at: 20 + i * 26, fn: () => {
                    const x = L + w * (col + 0.5);
                    this.hazards.push({ type: 'laneWarn', x: x - w / 2, w, t: 0, life: 30, thin: true });
                    enc.queue.push({ at: enc.t + 30, fn: () => {
                        for (let j = 0; j < 3; j++) this.waveMob(tier, x + (j - 1) * 10, -30 - j * 26, { kind: 'rain', vy: 3 });
                    } });
                } });
            }
        }
    },

    updateWave(enc) {
        enc.queue.sort((a, b) => a.at - b.at);
        while (enc.queue.length && enc.t >= enc.queue[0].at) enc.queue.shift().fn();
    },

    moveWaveMob(m, freeze) {
        const p = this.player;
        const s = freeze;
        switch (m.kind) {
            case 'vee':
                m.y += m.vy * s;
                if (m.y > this.H * 0.4) this.breakFormation(m);
                break;
            case 'pincer':
                m.x += m.vx * s;
                // close in from the sides, then break off and chase
                if (Math.abs(m.x - p.x) < 120 || (m.vx > 0 && m.x > this.W * 0.75) || (m.vx < 0 && m.x < this.W * 0.25)) this.breakFormation(m);
                break;
            case 'ring': {
                const n = U.normalizeVector(m.cx - m.x, m.cy - m.y);
                m.x += n.x * 1.3 * s;
                m.y += n.y * 1.3 * s;
                if (--m.life <= 0) this.breakFormation(m);
                break;
            }
            case 'stampede':
            case 'rain':
                m.y += m.vy * s;
                break;
            case 'congaHead': {
                m.t2 = (m.t2 || 0) + s;
                const amp = (this.roadRight - this.roadLeft) * 0.35;
                m.x = this.W / 2 + Math.sin(m.t2 * 0.03) * amp;
                m.y += 1.4 * s;
                m.trail.unshift([m.x, m.y]);
                if (m.trail.length > 400) m.trail.pop();
                if (m.y > this.H * 0.72) {
                    this.monsters.forEach(o => { if (o.leader === m || o === m) this.breakFormation(o); });
                }
                break;
            }
            case 'conga': {
                const lead = m.leader;
                if (!lead || lead.dead || lead.ai !== 'wave') {
                    this.breakFormation(m);
                    break;
                }
                const pt = lead.trail[Math.min(lead.trail.length - 1, m.slot)];
                if (pt) {
                    m.x = pt[0];
                    m.y = pt[1];
                } else {
                    m.y += 1.4 * s;
                }
                break;
            }
            default:
                this.breakFormation(m);
        }
    },

    // ------------------------------------------------------------------ hazards (mines, warnings, boss attacks)

    updateHazards() {
        const p = this.player;
        for (const h of this.hazards) {
            h.t++;
            if (h.type === 'mine') {
                const armed = h.t > h.arm;
                const near = U.distanceSquared(h.x, h.y, p.x, p.y) < 34 * 34;
                if ((armed && near) || h.t > h.life) {
                    h.dead = true;
                    this.explosions.push({ x: h.x, y: h.y, r: 40, t: 0, max: 20 });
                    this.burst(h.x, h.y, '#fb923c', 12, 5);
                    Sfx.play('boom', { volume: 0.4, rate: 1.2 });
                    this.shake(5);
                    if (U.distanceSquared(h.x, h.y, p.x, p.y) < 44 * 44) this.hurtPlayer({ name: 'a mine', shape: 'circle', color: '#1f2937', size: 10 });
                }
                if (h.y > this.H + 20) h.dead = true;
            } else if (h.type === 'ringWarn' || h.type === 'laneWarn') {
                if (h.t >= h.life) h.dead = true;
            } else if (h.update) {
                h.update(h);
            }
        }
        this.hazards = this.hazards.filter(h => !h.dead);
    },

    drawHazards(ctx) {
        for (const h of this.hazards) {
            if (h.type === 'mine') {
                const blink = h.t > h.arm && Math.floor(h.t / 8) % 2 === 0;
                this.drawShadow(ctx, h.x, h.y + 6, 9);
                ctx.fillStyle = '#1f2937';
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(h.x, h.y, h.r, 0, TAU);
                ctx.fill();
                ctx.stroke();
                for (let i = 0; i < 6; i++) {
                    const a = (i / 6) * TAU;
                    ctx.beginPath();
                    ctx.moveTo(h.x + Math.cos(a) * h.r, h.y + Math.sin(a) * h.r);
                    ctx.lineTo(h.x + Math.cos(a) * (h.r + 4), h.y + Math.sin(a) * (h.r + 4));
                    ctx.stroke();
                }
                ctx.fillStyle = blink ? '#ef4444' : '#7f1d1d';
                ctx.beginPath();
                ctx.arc(h.x, h.y, 3.5, 0, TAU);
                ctx.fill();
                if (blink) {
                    ctx.strokeStyle = 'rgba(239,68,68,0.35)';
                    ctx.beginPath();
                    ctx.arc(h.x, h.y, 34, 0, TAU);
                    ctx.stroke();
                }
            } else if (h.type === 'ringWarn') {
                const a = 0.4 + 0.4 * Math.sin(h.t * 0.4);
                ctx.strokeStyle = `rgba(255,60,60,${a})`;
                ctx.lineWidth = 3;
                ctx.setLineDash([10, 8]);
                ctx.beginPath();
                ctx.arc(h.x, h.y, h.r, 0, TAU);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.fillStyle = `rgba(255,60,60,${a})`;
                for (let i = 0; i < h.n; i++) {
                    const ang = (i / h.n) * TAU;
                    ctx.beginPath();
                    ctx.arc(h.x + Math.cos(ang) * h.r, h.y + Math.sin(ang) * h.r, 5, 0, TAU);
                    ctx.fill();
                }
            } else if (h.type === 'laneWarn') {
                const a = (h.thin ? 0.18 : 0.25) + 0.15 * Math.sin(h.t * 0.5);
                ctx.fillStyle = `rgba(255,40,40,${a})`;
                ctx.fillRect(h.x, -20, h.w, this.H + 40);
                ctx.fillStyle = `rgba(255,255,255,${a * 1.6})`;
                ctx.font = `22px ${DISPLAY_FONT}`;
                ctx.textAlign = 'center';
                if (!h.thin) for (let y = 60; y < this.H; y += 90) ctx.fillText('▼', h.x + h.w / 2, y + (h.t * 3) % 90);
            } else if (h.draw) {
                h.draw(ctx, h);
            }
        }
    },

    // ------------------------------------------------------------------ gatekeeper looks

    drawGatekeeper(ctx, m) {
        const def = GATEKEEPERS[m.ai];
        const fill = m.flash > 0 ? '#ffffff' : m.color;
        const s = m.size;
        if (m.ai === 'charger' && m.lane) {
            ctx.fillStyle = `rgba(255,40,40,${0.18 + 0.12 * Math.sin(m.t * 0.6)})`;
            ctx.fillRect(m.x - s, m.y, s * 2, this.H);
        }
        if (m.ai === 'totem' && m.beamT > 0 && m.beams) {
            ctx.strokeStyle = `rgba(74,222,128,${m.beamT / 20})`;
            ctx.lineWidth = 3;
            for (const o of m.beams) {
                ctx.beginPath();
                ctx.moveTo(m.x, m.y - s);
                ctx.lineTo(o.x, o.y);
                ctx.stroke();
            }
        }
        this.drawShadow(ctx, m.x, m.y + s * 0.9, s);
        ctx.save();
        ctx.translate(m.x, m.y);
        // gatekeepers wear a gold crown-ring so kids know "this is the big one"
        ctx.globalAlpha = 0.35 + 0.15 * Math.sin(m.phase * 0.6);
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, s * 1.35, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = 1;
        if (m.ai === 'shield') {
            Game.drawShape(ctx, 'circle', s, fill);
            this.drawEyes(ctx, m, s);
            ctx.fillStyle = '#475569';
            ctx.beginPath();
            ctx.ellipse(0, -s * 0.55, s * 0.8, s * 0.45, 0, Math.PI, 0);
            ctx.fill();
            ctx.rotate(m.facing);
            ctx.fillStyle = '#cbd5e1';
            ctx.strokeStyle = '#1e293b';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, s * 1.15, -Math.PI / 3, Math.PI / 3);
            ctx.arc(0, 0, s * 0.85, Math.PI / 3, -Math.PI / 3, true);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#facc15';
            ctx.beginPath();
            ctx.arc(s, 0, s * 0.12, 0, TAU);
            ctx.fill();
        } else if (m.ai === 'splitter') {
            const sq = 1 + (m.squash || 0) * 0.15;
            ctx.scale(sq, 1 / sq);
            Game.drawShape(ctx, 'circle', s, fill);
            ctx.fillStyle = 'rgba(255,255,255,0.35)';
            ctx.beginPath();
            ctx.ellipse(-s * 0.35, -s * 0.4, s * 0.3, s * 0.18, -0.5, 0, TAU);
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.35)';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(0, -s);
            ctx.lineTo(0, s);
            ctx.stroke();
            ctx.setLineDash([]);
            this.drawEyes(ctx, m, s);
        } else if (m.ai === 'bomber') {
            // bat-winged bomb carrier
            const flap = Math.sin(m.t * 0.3) * 0.4;
            ctx.fillStyle = '#44403c';
            for (const side of [-1, 1]) {
                ctx.beginPath();
                ctx.moveTo(side * s * 0.6, 0);
                ctx.quadraticCurveTo(side * s * 1.8, -s * (0.9 + flap), side * s * 2.1, s * 0.2);
                ctx.quadraticCurveTo(side * s * 1.4, 0, side * s * 0.6, s * 0.4);
                ctx.fill();
            }
            Game.drawShape(ctx, 'circle', s, fill);
            this.drawEyes(ctx, m, s);
            ctx.fillStyle = '#1f2937';
            ctx.beginPath();
            ctx.arc(0, s * 0.9, s * 0.4, 0, TAU);
            ctx.fill();
        } else if (m.ai === 'charger') {
            ctx.rotate(m.mode === 'charge' ? 0 : Math.sin(m.t * 0.5) * 0.08);
            Game.drawShape(ctx, 'circle', s, fill);
            ctx.fillStyle = '#fef3c7';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            for (const side of [-1, 1]) {
                ctx.beginPath();
                ctx.moveTo(side * s * 0.5, s * 0.5);
                ctx.quadraticCurveTo(side * s * 1.2, s * 0.9, side * s * 0.9, s * 1.5);
                ctx.lineTo(side * s * 0.4, s * 0.8);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            }
            this.drawEyes(ctx, m, s);
        } else if (m.ai === 'totem') {
            const h = s * 2.2;
            for (let i = 0; i < 3; i++) {
                const y = -h + i * s * 0.95;
                ctx.fillStyle = m.flash > 0 ? '#fff' : ['#b45309', '#92400e', '#78350f'][i];
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.roundRect(-s * 0.8, y, s * 1.6, s * 0.95, 6);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = '#fde047';
                ctx.fillRect(-s * 0.45, y + s * 0.3, s * 0.25, s * 0.2);
                ctx.fillRect(s * 0.2, y + s * 0.3, s * 0.25, s * 0.2);
                ctx.fillStyle = '#000';
                ctx.fillRect(-s * 0.35, y + s * 0.62, s * 0.7, s * 0.12);
            }
            ctx.fillStyle = '#16a34a';
            ctx.beginPath();
            ctx.moveTo(-s, -h);
            ctx.lineTo(0, -h - s * 0.9);
            ctx.lineTo(s, -h);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        } else if (m.ai === 'archers') {
            Game.drawShape(ctx, 'triangle', s, fill);
            ctx.fillStyle = '#14532d';
            ctx.beginPath();
            ctx.moveTo(-s * 0.9, -s * 0.5);
            ctx.lineTo(0, -s * 1.6);
            ctx.lineTo(s * 0.9, -s * 0.5);
            ctx.closePath();
            ctx.fill();
            this.drawEyes(ctx, m, s);
            const a = Math.atan2(this.player.y - m.y, this.player.x - m.x);
            ctx.rotate(a);
            ctx.strokeStyle = '#78350f';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(s * 0.6, 0, s * 0.9, -1.1, 1.1);
            ctx.stroke();
            ctx.strokeStyle = '#e5e7eb';
            ctx.lineWidth = 1;
            const pull = m.drawT > 0 ? 0 : s * 0.5;
            ctx.beginPath();
            ctx.moveTo(s * 0.6 + Math.cos(-1.1) * s * 0.9, Math.sin(-1.1) * s * 0.9);
            ctx.lineTo(s * 0.6 - pull, 0);
            ctx.lineTo(s * 0.6 + Math.cos(1.1) * s * 0.9, Math.sin(1.1) * s * 0.9);
            ctx.stroke();
        }
        ctx.restore();
        // health bar + name tag
        const w = s * 2.4;
        const y = m.y - s * (m.ai === 'totem' ? 3.4 : 1.6) - 10;
        const pct = U.clamp(m.hp / m.maxHp, 0, 1);
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(m.x - w / 2 - 1, y - 1, w + 2, 7);
        ctx.fillStyle = pct > 0.5 ? '#facc15' : pct > 0.25 ? '#fb923c' : '#ef4444';
        ctx.fillRect(m.x - w / 2, y, w * pct, 5);
        if (def && (m.gen || 0) === 0) {
            ctx.font = `12px ${DISPLAY_FONT}`;
            ctx.textAlign = 'center';
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(0,0,0,0.7)';
            ctx.strokeText(def.name, m.x, y - 8);
            ctx.fillStyle = '#fde68a';
            ctx.fillText(def.name, m.x, y - 8);
        }
    }
});
