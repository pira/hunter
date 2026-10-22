/* Monster Hunter — combat: weapons, projectiles, explosions, damage pipeline. Extends Game (js/core.js). */

extendGame({
    cycleWeapon(dir) {
        if (this.state !== 'playing') return;
        const available = WEAPON_ORDER.filter(w => this.isUnlocked(w));
        const idx = available.indexOf(this.weapon);
        this.selectWeapon(available[(idx + dir + available.length) % available.length]);
    },

    selectWeapon(weapon) {
        if (this.state !== 'playing' || !weapon || !this.isUnlocked(weapon) || weapon === this.weapon) return;
        this.weapon = weapon;
        this.blade.chain = 0;
        this.blade.stabs = [];
        this.blade.phase = 'idle';
        Sfx.tone(660, { duration: 0.06, type: 'triangle', volume: 0.08 });
    },

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

    nearestMonster(x, y, exclude) {
        let best = null;
        let bestD = Infinity;
        for (const m of this.monsters) {
            if (m.dead || m.dying || (exclude && exclude.has(m))) continue;
            if (m.x < -m.size || m.x > this.W + m.size || m.y < -m.size || m.y > this.H + m.size) continue;
            // Bosses count as closer than they are, so auto-aim focuses them.
            const d = U.distanceSquared(x, y, m.x, m.y) * (m.boss ? 0.2 : 1);
            if (d < bestD) {
                bestD = d;
                best = m;
            }
        }
        return best;
    },

    updateWeapons() {
        Object.keys(this.cooldowns).forEach(w => {
            if (this.cooldowns[w] > 0) this.cooldowns[w] -= this.rateMult;
        });

        if (this.weapon === 'sword') {
            this.updateBlades();
            return;
        }
        if (this.cooldowns[this.weapon] > 0) return;
        const aim = this.weapon === 'missiles' ? null : this.aimPoint();
        if (this.weapon !== 'missiles' && !aim) return;

        if (this.weapon === 'bullets') this.fireBullets(aim);
        else if (this.weapon === 'grenades') this.throwGrenades(aim);
        else if (this.weapon === 'missiles') this.fireMissiles();
    },

    fireBullets(aim) {
        const p = this.player;
        this.cooldowns.bullets = 32;
        const base = Math.atan2(aim.y - p.y, aim.x - p.x);
        const count = 1 + this.stack('split');
        const dirs = this.timers.multiShot > 0 ? 4 : 1; // multishot: the same volley in 4 directions
        const angles = [];
        for (let d = 0; d < dirs; d++) {
            for (let i = 0; i < count; i++) angles.push(base + (d * TAU) / 4 + (i - (count - 1) / 2) * 0.16);
        }
        angles.forEach(a => {
            this.bullets.push({
                x: p.x + Math.cos(a) * 12, y: p.y + Math.sin(a) * 12,
                vx: Math.cos(a) * 9, vy: Math.sin(a) * 9, r: 4.5,
                pierce: this.stack('pierce'), hits: new Set(), life: 120
            });
        });
        this.particle({ x: p.x + Math.cos(base) * 16, y: p.y + Math.sin(base) * 16, vx: 0, vy: 0, life: 5, size: 9, color: '#fff6a0', kind: 'flash' });
        Sfx.play('shoot', { volume: 0.25, rate: 0.95 + Math.random() * 0.15, duration: 0.35 });
    },

    throwGrenades(aim) {
        const p = this.player;
        this.cooldowns.grenades = 96;
        const count = Math.min(4, 1 + this.stack('cluster'));
        const dirs = this.timers.multiShot > 0 ? 4 : 1; // multishot quadruples: up to 16
        const base = Math.atan2(aim.y - p.y, aim.x - p.x);
        const range = Math.min(220, Math.hypot(aim.x - p.x, aim.y - p.y) + 10);
        for (let d = 0; d < dirs; d++) {
            for (let i = 0; i < count; i++) {
                const a = base + (d * TAU) / 4 + (i - (count - 1) / 2) * 0.32;
                this.grenades.push({ x: p.x, y: p.y, sx: p.x, sy: p.y, vx: Math.cos(a) * 6.5, vy: Math.sin(a) * 6.5, range, timer: 64, spin: 0 });
            }
        }
        Sfx.play('grenade', { volume: 0.8 });
    },

    fireMissiles() {
        if (!this.monsters.some(m => !m.dead)) return;
        this.cooldowns.missiles = 100;
        const p = this.player;
        const count = Math.min(3, 1 + this.stack('swarm')) * (this.timers.multiShot > 0 ? 4 : 1);
        const claimed = new Set();
        for (let i = 0; i < count; i++) {
            let target = this.nearestMonster(p.x, p.y, claimed) || this.nearestMonster(p.x, p.y);
            if (target) claimed.add(target);
            const a = -Math.PI / 2 + (i - (count - 1) / 2) * 0.5 + (Math.random() - 0.5) * 0.3;
            this.missiles.push({ x: p.x, y: p.y, angle: a, speed: 3, target, trail: [], life: 240 });
        }
        Sfx.play('missile', { volume: 0.6 });
    },

    get stabReach() {
        return STAB.reach * (1 + 0.25 * this.stack('reach'));
    },

    // Damage of the next stab: base doubles per Heavy Edge rank and per consecutive hit.
    get stabDamage() {
        return STAB.baseDamage * 2 ** this.stack('heavy') * 2 ** Math.min(this.blade.chain, STAB.maxDoublings);
    },

    updateBlades() {
        const p = this.player;
        const bl = this.blade;
        const speed = (1 + 0.25 * this.stack('quick')) * (1 + 0.15 * this.stack('haste')) * (this.timers.rapidFire > 0 ? 2 : 1);
        const outF = Math.max(2, Math.round(STAB.out / speed));
        const backF = Math.max(2, Math.round(STAB.back / speed));
        const reach = this.stabReach;

        if (bl.chain > 0 && --bl.chainT <= 0) {
            if (bl.chain >= 2) this.floater(p.x, p.y - 34, 'blade cooled', '#b0bec5', 13);
            bl.chain = 0;
        }
        bl.heat = U.lerp(bl.heat, Math.min(bl.chain, STAB.maxDoublings) / STAB.maxDoublings, 0.15);

        if (bl.phase === 'idle') {
            if (bl.cd > 0) {
                bl.cd--;
                return;
            }
            const taken = new Set();
            const max = this.timers.multiShot > 0 ? 4 : 1;
            bl.stabs = [];
            for (let i = 0; i < max; i++) {
                const m = this.nearestMonster(p.x, p.y, taken);
                if (!m || Math.hypot(m.x - p.x, m.y - p.y) - m.size > reach + 4) break;
                taken.add(m);
                bl.stabs.push({ angle: Math.atan2(m.y - p.y, m.x - p.x), hits: new Set() });
            }
            if (!bl.stabs.length) return;
            bl.phase = 'out';
            bl.t = 0;
            bl.anyHit = false;
            Sfx.play('swoosh', { volume: 0.28, rate: 2.6, duration: 0.25 });
        }

        bl.t++;
        if (bl.phase === 'out') {
            const ext = 12 + reach * Math.min(1, bl.t / outF);
            for (const st of bl.stabs) {
                const tx = p.x + Math.cos(st.angle) * ext;
                const ty = p.y + Math.sin(st.angle) * ext;
                for (const m of this.monsters) {
                    if (m.dead || m.dying || st.hits.has(m)) continue;
                    if (this.distToSegment(m.x, m.y, p.x, p.y, tx, ty) <= m.size + 3) {
                        st.hits.add(m);
                        bl.anyHit = true;
                        const crit = Math.random() < 0.08 * this.stack('crit');
                        const dmg = this.stabDamage * this.damageMult * (crit ? 2.5 : 1);
                        this.damageMonster(m, dmg, { kx: Math.cos(st.angle) * 10, ky: Math.sin(st.angle) * 10, crit: false });
                        const heat = Math.min(bl.chain, STAB.maxDoublings) / STAB.maxDoublings;
                        this.floater(m.x, m.y - m.size - 8, `${Math.round(dmg)}${crit ? '!' : ''}`, heat > 0.5 ? '#ff5a36' : heat > 0 ? '#ffb199' : '#ffffff', 16 + 12 * heat);
                        this.spark(m.x - Math.cos(st.angle) * m.size, m.y - Math.sin(st.angle) * m.size, heat > 0.3 ? '#ff7043' : '#eceff1', 6);
                    }
                }
            }
            if (bl.t >= outF) {
                if (bl.anyHit) {
                    bl.chain = Math.min(bl.chain + 1, STAB.maxDoublings + 1);
                    bl.chainT = STAB.chainFrames;
                    Sfx.tone(520 + 90 * Math.min(bl.chain, 9), { duration: 0.07, type: 'triangle', volume: 0.07 });
                }
                bl.phase = 'back';
                bl.t = 0;
            }
        } else if (bl.phase === 'back' && bl.t >= backF) {
            bl.phase = 'idle';
            bl.t = 0;
            bl.cd = Math.round(STAB.cooldown / speed);
        }
        bl.outF = outF;
        bl.backF = backF;
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
            if (b.x < -10 || b.x > this.W + 10 || b.y < -10 || b.y > this.H + 10) b.life = 0;
            if (b.life <= 0) continue;
            for (const m of this.monsters) {
                if (m.dead || b.hits.has(m)) continue;
                if (U.distanceSquared(b.x, b.y, m.x, m.y) < (b.r + m.size) ** 2) {
                    b.hits.add(m);
                    const { dmg, crit } = this.rollDamage(1);
                    this.damageMonster(m, dmg, { kx: b.vx * 0.25, ky: b.vy * 0.25, crit });
                    this.spark(b.x, b.y, '#ffe066', 3);
                    if (b.pierce-- <= 0) {
                        b.life = 0;
                        break;
                    }
                }
            }
        }
        this.bullets = this.bullets.filter(b => b.life > 0);
    },

    updateGrenades() {
        for (const g of this.grenades) {
            const travelled = Math.hypot(g.x - g.sx, g.y - g.sy);
            if (travelled < g.range) {
                g.x += g.vx;
                g.y += g.vy;
                g.spin += 0.3;
                for (const m of this.monsters) {
                    if (!m.dead && U.distanceSquared(g.x, g.y, m.x, m.y) < (5 + m.size) ** 2) {
                        g.range = 0; // stick to the first monster touched
                        break;
                    }
                }
            }
            g.timer--;
            if (g.timer <= 0) {
                const radius = 32 * (1 + 0.3 * this.stack('blast')); // 30% smaller than v2.1
                this.explode(g.x, g.y, radius, 8);
            }
        }
        this.grenades = this.grenades.filter(g => g.timer > 0);
    },

    explode(x, y, radius, baseDamage) {
        for (const m of this.monsters) {
            if (m.dead) continue;
            if (U.distanceSquared(x, y, m.x, m.y) <= (radius + m.size) ** 2) {
                const n = U.normalizeVector(m.x - x, m.y - y);
                const { dmg, crit } = this.rollDamage(baseDamage);
                this.damageMonster(m, dmg, { kx: n.x * 6, ky: n.y * 6, crit });
            }
        }
        this.explosions.push({ x, y, r: radius, t: 0, max: 22 });
        this.burst(x, y, '#ff9f1c', 12, radius / 7);
        this.burst(x, y, '#ffe066', 8, radius / 10);
        for (let i = 0; i < 4; i++) {
            this.particle({ x, y, vx: (Math.random() - 0.5) * 1.5, vy: (Math.random() - 0.5) * 1.5, life: 36, size: radius * 0.25 + Math.random() * 5, grow: 0.3, color: 'rgba(70,60,60,0.2)', kind: 'smoke' });
        }
        this.shake(5);
        Sfx.play('boom', { volume: 0.55, rate: 0.9 + Math.random() * 0.2 });
    },

    updateMissiles() {
        for (const ms of this.missiles) {
            if (!ms.target || ms.target.dead) ms.target = this.nearestMonster(ms.x, ms.y);
            ms.life--;
            ms.speed = Math.min(6.5, ms.speed + 0.12);
            if (ms.target) {
                const desired = Math.atan2(ms.target.y - ms.y, ms.target.x - ms.x);
                ms.angle += U.clamp(U.angleDelta(ms.angle, desired), -0.14, 0.14);
            }
            ms.x += Math.cos(ms.angle) * ms.speed;
            ms.y += Math.sin(ms.angle) * ms.speed;
            if (this.frameNo % 2 === 0) {
                ms.trail.push({ x: ms.x, y: ms.y });
                if (ms.trail.length > 14) ms.trail.shift();
            }
            const t = ms.target;
            if (t && !t.dead && U.distanceSquared(ms.x, ms.y, t.x, t.y) < (t.size + 4) ** 2) {
                const { dmg, crit } = this.rollDamage(3);
                this.damageMonster(t, dmg, { kx: Math.cos(ms.angle) * 4, ky: Math.sin(ms.angle) * 4, crit });
                this.burst(ms.x, ms.y, '#ff6b35', 8, 4);
                this.explosions.push({ x: ms.x, y: ms.y, r: 18, t: 0, max: 14 });
                this.shake(2);
                ms.life = 0;
            }
            if (ms.life <= 0 && !ms.exploded) ms.exploded = true;
        }
        this.missiles = this.missiles.filter(ms => ms.life > 0);
    }
});
