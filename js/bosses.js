/* Monster Hunter — bosses: patterns, death sequence. Extends Game (js/core.js). */

extendGame({
    startBossDeath(b) {
        b.hp = 0;
        b.dying = true;
        b.deathT = 0;
        b.deathMax = 210; // ~3.9s of falling apart
        b.coinsTotal = 25 + 15 * this.bossCount;
        b.coinsOut = 0;
        b.lootOut = 0;
        b.cracks = Array.from({ length: 7 }, () => ({ a: Math.random() * TAU, len: 0.5 + Math.random() * 0.5, bend: (Math.random() - 0.5) * 0.8 }));
        this.enemyShots = [];
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

    startBossWarning() {
        this.bossCount++;
        const def = BOSSES[(this.bossCount - 1) % BOSSES.length];
        this.bossWarning = 150;
        this.banner(`⚠ ${def.name.toUpperCase()} ⚠`, def.title, 'danger');
    },

    spawnBoss() {
        const n = this.bossCount;
        const def = BOSSES[(n - 1) % BOSSES.length];
        const cycle = Math.floor((n - 1) / BOSSES.length);
        const hp = Math.round(def.hp * (1 + 0.4 * (n - 1)) * (1 + 0.4 * cycle));
        const b = {
            ...this.makeMonster({ ...def, shape: 'boss', speedVariation: 0, health: hp, points: 0, tier: 'boss' }, this.W / 2, -def.size * 2, 'boss'),
            boss: def, size: def.size, hp, maxHp: hp, speed: def.speed * (1 + 0.1 * cycle),
            mode: 'enter', modeT: 0, t: 0, volley: 0, cycle, spawnT: 0, dashX: 0, dashY: 0
        };
        b.name = def.name;
        this.monsters.push(b);
        this.boss = b;
        this.bossTrailPct = 1;
        this.el.bossName.innerHTML = `${def.name} <small>${def.title}</small>`;
        this.el.bossBar.hidden = false;
        Sfx.play('bossDeath', { volume: 0.8, rate: 0.6 });
        this.shake(10);
    },

    updateBoss(b, freeze) {
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
        b.enraged = enraged;
        const chase = mult => {
            const n = U.normalizeVector(p.x - b.x, p.y - b.y);
            b.x += n.x * b.speed * mult * freeze;
            b.y += n.y * b.speed * mult * freeze;
        };

        if (b.mode === 'enter') {
            b.y += 1.6;
            b.spawnT = 2;
            if (b.y >= this.H * 0.22) {
                b.mode = 'fight';
                b.modeT = 0;
            }
            return;
        }

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

        b.x = U.clamp(b.x, b.size, this.W - b.size);
        b.y = U.clamp(b.y, b.size, this.H - b.size);
    },

    radial(b, count, speed, color, offset = 0) {
        for (let i = 0; i < count; i++) this.enemyShot(b.x, b.y, offset + (i / count) * TAU, speed, color);
    },

    enemyShot(x, y, angle, speed) {
        this.enemyShots.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: 6, life: 400, color: '#ff2d78' });
    },

    updateEnemyShots() {
        const p = this.player;
        const freeze = this.mobSpeedMult;
        for (const s of this.enemyShots) {
            s.x += s.vx * freeze;
            s.y += s.vy * freeze;
            s.life--;
            if (s.x < -20 || s.x > this.W + 20 || s.y < -20 || s.y > this.H + 20) s.life = 0;
            if (s.life > 0 && U.distanceSquared(s.x, s.y, p.x, p.y) < (s.r + p.r * 0.7) ** 2) {
                if (this.timers.invincible > 0) {
                    this.spark(s.x, s.y, s.color, 5);
                } else {
                    this.hurtPlayer(this.boss || { name: 'a stray curse', shape: 'circle', color: s.color, size: 12 });
                }
                s.life = 0;
            }
        }
        this.enemyShots = this.enemyShots.filter(s => s.life > 0);
    },

    bossDefeated(b) {
        this.boss = null;
        this.bossesSlain++;
        this.el.bossBar.hidden = true;
        const bonus = 300 * this.bossCount;
        this.score += bonus;
        this.floater(b.x, b.y - b.size - 10, `BOSS SLAIN +${bonus}`, '#ffd60a', 30);
        Sfx.arpeggio([523, 659, 784, 1046, 1318], 0.09, { type: 'triangle', volume: 0.12 });
    }
});
