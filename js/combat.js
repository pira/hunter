/* Monster Hunter — combat: class weapons, supers, Storm, projectiles, explosions. Extends Game (js/core.js). */

extendGame({
    aimPoint() {
        if (this.mouse.down) return { x: this.mouse.x, y: this.mouse.y };
        const p = this.player;
        const target = this.nearestMonster(p.x, p.y);
        // Boss fight: keep shooting the boss unless something is right on top of you.
        const b = this.boss;
        if (b && !b.dying && b.mode !== 'enter' && target && (target === b || Math.hypot(target.x - p.x, target.y - p.y) > 80)) {
            return { x: b.x, y: b.y };
        }
        return target ? { x: target.x, y: target.y } : null;
    },

    nearestMonster(x, y, exclude, maxDist = Infinity, bossBias = 0.2) {
        let best = null;
        let bestD = maxDist === Infinity ? Infinity : maxDist * maxDist;
        for (const m of this.monsters) {
            if (m.dead || m.dying || (exclude && exclude.has(m))) continue;
            if (m.x < -m.size || m.x > this.W + m.size || m.y < -m.size || m.y > this.H + m.size) continue;
            // Bosses count as closer than they are, so auto-aim focuses them.
            const d = U.distanceSquared(x, y, m.x, m.y) * (m.boss || m.gk ? bossBias : 1);
            if (d < bestD) {
                bestD = d;
                best = m;
            }
        }
        return best;
    },

    get impactMult() {
        return 1 + 0.15 * this.stack('impact');
    },

    get cleaveReach() {
        return PRIMARY.cleave.reach * (1 + 0.1 * this.stack('reach')) * this.impactMult;
    },

    get blastRadius() {
        return PRIMARY.grenade.radius * this.impactMult;
    },

    updateWeapons() {
        if (this.cooldown > 0) this.cooldown -= this.rateMult;
        this.updateSuper();
        this.updateCleaves();
        if (this.whirl > 0) return; // the whirlwind replaces the barbarian's normal swings
        if (this.cooldown > 0) return;
        const primary = CLASSES[this.cls].primary;
        if (primary === 'cleave') {
            this.tryCleave();
            return;
        }
        const aim = this.aimPoint();
        if (!aim) return;
        if (primary === 'bolt') this.fireBolts(aim);
        else this.throwGrenades(aim);
    },

    // ---- wizard: magic bolts

    fireBolts(aim) {
        const p = this.player;
        const def = PRIMARY.bolt;
        this.cooldown = def.cooldown;
        const base = Math.atan2(aim.y - p.y, aim.x - p.x);
        const count = 1 + this.stack('split');
        for (let i = 0; i < count; i++) {
            const a = base + (i - (count - 1) / 2) * 0.16;
            this.spawnBolt(p.x + Math.cos(a) * 14, p.y - 6 + Math.sin(a) * 14, a, def.speed, def.radius * this.impactMult, def.damage * this.powerMult, this.stack('pierce'));
        }
        this.particle({ x: p.x + Math.cos(base) * 18, y: p.y - 6 + Math.sin(base) * 18, vx: 0, vy: 0, life: 6, size: 10, color: '#d8b4fe', kind: 'flash' });
        Sfx.fx('zap', 0.16, (d, rate, len, k) => {
            k.osc(len, rate, 'sawtooth', 1400, 380, d, 0.5);
            k.osc(len, rate, 'square', 2100, 900, d, 0.25);
            for (let i = 0; i < len; i++) d[i] *= Math.pow(1 - i / len, 2.2);
            k.biquad(d, rate, 'bandpass', t => 2600 - 1800 * t, 1.2);
            k.normalize(d, 0.8);
        }, { volume: 0.2, poly: 3, rate: 0.92 + Math.random() * 0.16 });
    },

    spawnBolt(x, y, angle, speed, r, damage, pierce, big = false) {
        this.bullets.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r, damage, pierce, hits: new Set(), life: 130, big, trail: [] });
    },

    // ---- barbarian: cleave

    tryCleave() {
        const p = this.player;
        const reach = this.cleaveReach;
        const target = this.nearestMonster(p.x, p.y, null, Infinity, 1);
        if (!target || Math.hypot(target.x - p.x, target.y - p.y) - target.size > reach) return;
        const angle = Math.atan2(target.y - p.y, target.x - p.x);
        this.cooldown = PRIMARY.cleave.cooldown / (1 + 0.25 * this.stack('quick'));
        this.startCleave(angle, reach, PRIMARY.cleave.damage * this.powerMult, PRIMARY.cleave.arc);
        Sfx.play('swoosh', { volume: 0.32, rate: 1.5 + Math.random() * 0.2, duration: 0.3 });
    },

    startCleave(angle, reach, damage, arc, opts = {}) {
        const speed = (1 + 0.25 * this.stack('quick')) * (this.timers.rapidFire > 0 ? 1.5 : 1);
        const dur = Math.max(6, Math.round(PRIMARY.cleave.swing / speed));
        const dir = this.player.facing >= 0 ? 1 : -1;
        this.cleaves.push({ angle, reach, damage, arc, t: 0, dur, dir, hits: new Set(), full: Boolean(opts.full) });
    },

    updateCleaves() {
        const p = this.player;
        for (const c of this.cleaves) {
            c.t++;
            // Damage lands as the blade sweeps through: everything inside the swept part of the arc.
            const sweep = Math.min(1, c.t / (c.dur * 0.55));
            const from = c.full ? 0 : -c.arc;
            const to = c.full ? TAU : -c.arc + 2 * c.arc * sweep;
            let hit = false;
            for (const m of this.monsters) {
                if (m.dead || m.dying || c.hits.has(m)) continue;
                const dx = m.x - p.x;
                const dy = m.y - p.y;
                const dist = Math.hypot(dx, dy);
                if (dist - m.size > c.reach) continue;
                const rel = U.angleDelta(c.angle, Math.atan2(dy, dx)) * c.dir;
                const slack = Math.atan2(m.size, Math.max(1, dist));
                const inside = c.full ? true : rel >= from - slack && rel <= to + slack;
                if (!inside) continue;
                c.hits.add(m);
                hit = true;
                const n = U.normalizeVector(dx, dy);
                const { dmg, crit } = this.rollDamage(c.damage);
                this.damageMonster(m, dmg, { kx: n.x * 11, ky: n.y * 11, crit, sound: 'slash', src: p });
                this.spark(m.x - n.x * m.size, m.y - n.y * m.size, '#ffe0b2', 5);
            }
            if (hit && !c.shook) {
                c.shook = true;
                this.shake(3);
                this.hitStop = Math.max(this.hitStop, 2);
            }
        }
        this.cleaves = this.cleaves.filter(c => c.t < c.dur);
    },

    // ---- goblin: grenades

    throwGrenades(aim, { all = false, blastMult = 1 } = {}) {
        const p = this.player;
        const def = PRIMARY.grenade;
        this.cooldown = def.cooldown * Math.pow(0.9, this.stack('fuse'));
        const count = Math.min(5, 2 + this.stack('cluster')); // goblins always throw a pair
        const dirs = all ? 4 : 1;
        const base = aim ? Math.atan2(aim.y - p.y, aim.x - p.x) : -Math.PI / 2;
        const range = all ? def.range : Math.min(def.range, Math.hypot(aim.x - p.x, aim.y - p.y));
        const fuse = Math.round(def.fuse * Math.pow(0.8, this.stack('fuse')));
        for (let d = 0; d < dirs; d++) {
            for (let i = 0; i < count; i++) {
                const a = base + (d * TAU) / 4 + (i - (count - 1) / 2) * 0.32;
                // lob so the first bounce lands on the target, then hop up to `bounces` times
                const dist = Math.max(30, range * (all ? 0.7 + 0.3 * Math.random() : 1));
                const flight = dist / def.speed;
                this.grenades.push({
                    x: p.x, y: p.y, sx: p.x, sy: p.y, z: 6, vx: Math.cos(a) * def.speed, vy: Math.sin(a) * def.speed,
                    vz: GRENADE_G * flight / 2, bounces: 0, timer: fuse, fuse, spin: 0,
                    radius: this.blastRadius * blastMult, damage: def.damage * (all ? 1 : this.powerMult)
                });
            }
        }
        Sfx.play('grenade', { volume: 0.7, rate: 0.95 + Math.random() * 0.1 });
    },

    updateGrenades() {
        for (const g of this.grenades) {
            g.x += g.vx;
            g.y += g.vy;
            g.z += g.vz;
            g.vz -= GRENADE_G;
            g.spin += 0.05 * Math.hypot(g.vx, g.vy);
            const over = (g.vx || g.vy) && this.monsters.some(m => !m.dead && !m.dying && !m.hidden && U.distanceSquared(g.x, g.y, m.x, m.y) < (4 + m.size) ** 2);
            // flying over a monster: stop and drop straight onto it
            if (over && g.z > 0) {
                g.vx = 0;
                g.vy = 0;
                g.vz = Math.min(g.vz, -1);
            }
            if (g.z <= 0) {
                // touching the ground (or resting): right on a monster → boom now; otherwise bounce on
                g.z = 0;
                const hit = this.monsters.some(m => !m.dead && !m.dying && !m.hidden && U.distanceSquared(g.x, g.y, m.x, m.y) < (6 + m.size) ** 2);
                if (hit) {
                    g.timer = 0;
                } else if (g.bounces < PRIMARY.grenade.bounces) {
                    g.bounces++;
                    g.vz = Math.abs(g.vz) * 0.55;
                    g.vx *= 0.6;
                    g.vy *= 0.6;
                    if (g.bounces === 1) Sfx.hit(8, { volume: 0.08, flavor: 'thwack' });
                } else {
                    g.vx = g.vy = g.vz = 0; // resting; goes off on its fuse
                }
            }
            g.timer--;
            if (g.timer <= 0) this.explode(g.x, g.y, g.radius, g.damage);
        }
        this.grenades = this.grenades.filter(g => g.timer > 0);
    },

    explode(x, y, radius, baseDamage) {
        for (const m of this.monsters) {
            if (m.dead) continue;
            if (U.distanceSquared(x, y, m.x, m.y) <= (radius + m.size) ** 2) {
                const n = U.normalizeVector(m.x - x, m.y - y);
                const { dmg, crit } = this.rollDamage(baseDamage);
                this.damageMonster(m, dmg, { kx: n.x * 6, ky: n.y * 6, crit, sound: false, aoe: true });
            }
        }
        this.explosions.push({ x, y, r: radius, t: 0, max: 22 });
        this.burst(x, y, '#ff9f1c', 12, radius / 7);
        this.burst(x, y, '#ffe066', 8, radius / 10);
        for (let i = 0; i < 4; i++) {
            this.particle({ x, y, vx: (Math.random() - 0.5) * 1.5, vy: (Math.random() - 0.5) * 1.5, life: 36, size: radius * 0.25 + Math.random() * 5, grow: 0.3, color: 'rgba(70,60,60,0.2)', kind: 'smoke' });
        }
        this.decal(x, y, radius * 0.7, 'scorch');
        this.shake(5);
        Sfx.play('boom', { volume: 0.5, rate: 0.9 + Math.random() * 0.2 });
    },

    distToSegment(px, py, x1, y1, x2, y2) {
        const cx = x2 - x1;
        const cy = y2 - y1;
        const lenSq = cx * cx + cy * cy;
        const t = lenSq ? U.clamp(((px - x1) * cx + (py - y1) * cy) / lenSq, 0, 1) : 0;
        return Math.hypot(px - (x1 + t * cx), py - (y1 + t * cy));
    },

    updateBullets() {
        for (const b of this.bullets) {
            b.x += b.vx;
            b.y += b.vy;
            b.life--;
            if (this.frameNo % 2 === 0) {
                b.trail.push(b.x, b.y);
                if (b.trail.length > (b.big ? 12 : 8)) b.trail.splice(0, 2);
            }
            if (b.x < -20 || b.x > this.W + 20 || b.y < -20 || b.y > this.H + 20) b.life = 0;
            if (b.life <= 0) continue;
            for (const m of this.monsters) {
                if (m.dead || b.hits.has(m)) continue;
                if (U.distanceSquared(b.x, b.y, m.x, m.y) < (b.r + m.size) ** 2) {
                    b.hits.add(m);
                    const { dmg, crit } = this.rollDamage(b.damage);
                    this.damageMonster(m, dmg, { kx: b.vx * 0.25, ky: b.vy * 0.25, crit, sound: 'zap', src: { x: b.x - b.vx * 4, y: b.y - b.vy * 4 } });
                    this.spark(b.x, b.y, b.big ? '#f0abfc' : '#c4b5fd', b.big ? 6 : 3);
                    if (b.pierce-- <= 0) {
                        b.life = 0;
                        break;
                    }
                }
            }
        }
        this.bullets = this.bullets.filter(b => b.life > 0);
    },

    // ---- super meter + supers

    addCharge(amount) {
        if (this.whirl > 0 || amount <= 0) return;
        const before = this.superMeter;
        this.superMeter = U.superCharge(this.superMeter, amount, this.chargeMult || 1);
        if (before < 100 && this.superMeter >= 100) {
            this.floater(this.player.x, this.player.y - 46, 'SUPER READY!', '#facc15', 24);
            Sfx.arpeggio([784, 988, 1175, 1568], 0.06, { type: 'triangle', volume: 0.1 });
        }
    },

    activateSuper() {
        if (this.state !== 'playing' || this.superMeter < 100) return;
        this.superMeter = 0;
        const p = this.player;
        const cls = CLASSES[this.cls];
        this.banner(cls.superName.toUpperCase() + '!', '', 'super');
        this.flash = { color: cls.color === '#22c55e' ? '120,255,140' : cls.color === '#f97316' ? '255,170,80' : '200,160,255', t: 14, max: 14 };
        this.shake(10);
        this.ring(p.x, p.y, 120, cls.color, 24);
        this.burst(p.x, p.y, cls.color, 24, 6);
        this.superSting(this.cls);
        if (this.cls === 'wizard') {
            this.novaQueue = [0, 11, 22]; // three rings, 0.2 s apart
            this.novaT = 0;
        } else if (this.cls === 'barbarian') {
            this.whirl = WHIRLWIND_STEPS;
            this.whirlT = 0;
            this.whirlVoice = Sfx.loopFx('whirl', 1.2, (d, rate, len, k) => {
                const r = k.rng(5);
                for (let i = 0; i < len; i++) d[i] = (r() * 2 - 1) * (0.6 + 0.4 * Math.sin(TAU * 6.66 * i / rate));
                k.biquad(d, rate, 'bandpass', t => 700 + 500 * Math.sin(TAU * 3 * t), 1.6);
                k.normalize(d, 0.7);
            }, { volume: 0.4 });
        } else {
            this.throwGrenades(this.aimPoint(), { all: true, blastMult: 1.5 });
            this.cooldown = 30;
        }
    },

    updateSuper() {
        const p = this.player;
        if (this.novaQueue && this.novaQueue.length) {
            this.novaT++;
            while (this.novaQueue.length && this.novaT >= this.novaQueue[0]) {
                const ring = 3 - this.novaQueue.length;
                this.novaQueue.shift();
                for (let i = 0; i < 12; i++) {
                    const a = (i / 12) * TAU + ring * (TAU / 36);
                    this.spawnBolt(p.x, p.y - 6, a, 7, 9 * this.impactMult, 2, this.stack('pierce') + 2, true);
                }
                this.ring(p.x, p.y, 70, '#e9d5ff', 16);
                Sfx.tone(523 * (1 + ring * 0.26), { duration: 0.18, type: 'triangle', volume: 0.12, slide: 400, bus: 'sfx' });
            }
        }
        if (this.whirl > 0) {
            this.whirl--;
            this.whirlT++;
            if (this.whirlT % 8 === 0) {
                this.cleaves.push({ angle: 0, reach: this.cleaveReach, damage: PRIMARY.cleave.damage, arc: Math.PI, t: 0, dur: 6, dir: 1, hits: new Set(), full: true, whirl: true });
                if (this.whirlT % 16 === 0) Sfx.play('swoosh', { volume: 0.18, rate: 1.8 + Math.random() * 0.3, duration: 0.2 });
            }
            if (this.frameNo % 2 === 0) {
                const a = this.whirlT * 0.5;
                this.particle({ x: p.x + Math.cos(a) * 34, y: p.y + Math.sin(a) * 34, vx: -Math.sin(a) * 2, vy: Math.cos(a) * 2, life: 14, size: 3, color: 'rgba(255,237,213,0.8)', kind: 'spark' });
            }
            if (this.whirl === 0) {
                Sfx.fadeOut(this.whirlVoice, 0.4);
                this.whirlVoice = null;
                this.floater(p.x, p.y - 40, 'phew!', '#fed7aa', 16);
            }
        }
    },

    superSting(cls) {
        const notes = { wizard: [523, 659, 784, 1046, 1318], barbarian: [196, 247, 294, 392], goblin: [330, 415, 494, 659] }[cls];
        const type = { wizard: 'triangle', barbarian: 'sawtooth', goblin: 'square' }[cls];
        Sfx.arpeggio(notes, 0.055, { type, volume: 0.11 });
        Sfx.fx(`sting:${cls}`, 0.7, (d, rate, len, k) => {
            const r = k.rng(9);
            for (let i = 0; i < len; i++) d[i] = (r() * 2 - 1) * Math.pow(1 - i / len, 3);
            k.biquad(d, rate, 'lowpass', t => 4000 * (1 - t) + 200, 0.8);
            k.osc(len, rate, 'sine', cls === 'barbarian' ? 90 : 150, 50, d, 0.8);
            k.normalize(d, 0.8);
        }, { volume: 0.4, priority: 2 });
    },

    // ---- Storm: chain lightning every 3 s while the timer runs

    updateStorm() {
        if (!(this.timers.storm > 0) || this.lootFrozen) return;
        if (--this.stormClock <= 0) {
            this.stormClock = STORM.every;
            this.stormStrike();
        }
    },

    stormStrike() {
        const p = this.player;
        const first = this.nearestMonster(p.x, p.y, null, STORM.range, 1);
        if (!first) return;
        const hit = new Set();
        const chain = [first];
        hit.add(first);
        let cur = first;
        for (let j = 1; j <= STORM.jumps; j++) {
            const next = this.nearestMonster(cur.x, cur.y, hit, STORM.jump, 1);
            if (!next) break;
            hit.add(next);
            chain.push(next);
            cur = next;
        }
        const points = [{ x: first.x + (Math.random() - 0.5) * 60, y: Math.max(-20, first.y - 170) }];
        chain.forEach((m, j) => {
            points.push({ x: m.x, y: m.y });
            const dmg = U.stormDamage(this.level, j, STORM.damage, STORM.falloff, this.damageMult);
            this.damageMonster(m, dmg, { kx: (Math.random() - 0.5) * 4, ky: -2, sound: false, aoe: true });
            this.spark(m.x, m.y, '#e0f2fe', 8);
            this.spark(m.x, m.y, '#38bdf8', 6);
            this.decal(m.x, m.y + m.size * 0.6, 10 + m.size * 0.5, 'scorch');
        });
        this.lightning.push({ points, t: 0, max: 12, segs: null });
        this.flash = { color: '190,230,255', t: 3, max: 3 };
        this.shake(4);
        Sfx.fx('thunder', 1.1, (d, rate, len, k) => {
            const r = k.rng(77);
            const crack = Math.floor(rate * 0.06);
            for (let i = 0; i < len; i++) {
                const t = i / len;
                const n = r() * 2 - 1;
                d[i] = i < crack ? n * (1 - i / crack) : n * 0.55 * Math.pow(1 - t, 1.6) * (0.6 + 0.4 * Math.sin(TAU * 7 * t));
            }
            k.biquad(d, rate, 'lowpass', t => (t < 0.06 ? 7000 : 900 - 600 * t), 0.9);
            k.osc(Math.floor(rate * 0.25), rate, 'sine', 900, 120, d, 0.5);
            k.normalize(d, 0.85);
        }, { volume: 0.5, poly: 2, priority: 2 });
    },

    // Midpoint-displacement bolt between two points; ~30% chance of a short fork.
    static_lightningPath(x1, y1, x2, y2, depth = 4) {
        let pts = [[x1, y1], [x2, y2]];
        let disp = Math.hypot(x2 - x1, y2 - y1) * 0.22;
        const forks = [];
        for (let d = 0; d < depth; d++) {
            const next = [pts[0]];
            for (let i = 1; i < pts.length; i++) {
                const [ax, ay] = pts[i - 1];
                const [bx, by] = pts[i];
                const len = Math.hypot(bx - ax, by - ay) || 1;
                const off = (Math.random() - 0.5) * 2 * disp;
                const mx = (ax + bx) / 2 - ((by - ay) / len) * off;
                const my = (ay + by) / 2 + ((bx - ax) / len) * off;
                next.push([mx, my], [bx, by]);
                if (d === 1 && Math.random() < 0.3 / pts.length * 2) {
                    const a = Math.atan2(by - ay, bx - ax) + (Math.random() < 0.5 ? 0.6 : -0.6);
                    const fl = len * (0.5 + Math.random() * 0.4);
                    forks.push([[mx, my], [mx + Math.cos(a) * fl * 0.5 + (Math.random() - 0.5) * 8, my + Math.sin(a) * fl * 0.5], [mx + Math.cos(a) * fl, my + Math.sin(a) * fl]]);
                }
            }
            pts = next;
            disp *= 0.55;
        }
        return [pts, ...forks];
    },

    updateLightning() {
        for (const l of this.lightning) {
            if (l.t % 2 === 0) {
                // re-jitter every 2 steps
                l.segs = [];
                for (let i = 1; i < l.points.length; i++) {
                    const a = l.points[i - 1];
                    const b = l.points[i];
                    l.segs.push(...this.static_lightningPath(a.x, a.y, b.x, b.y, i === 1 ? 5 : 4));
                }
            }
            l.t++;
        }
        this.lightning = this.lightning.filter(l => l.t < l.max);
    },

    // Ground marks (scorch, cracks). Drawn under everything; they fade out.
    decal(x, y, r, kind) {
        if (this.decals.length > 60) this.decals.shift();
        this.decals.push({ x, y, r, kind, life: 600, max: 600, rot: Math.random() * TAU });
    },

    updateDecals() {
        for (const d of this.decals) d.life--;
        this.decals = this.decals.filter(d => d.life > 0);
    }
});
