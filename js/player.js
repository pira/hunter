/* Monster Hunter — player: derived stats, movement, damage. Extends Game (js/core.js). */

extendGame({
    stack(id) {
        return this.stacks[id] || 0;
    },

    get damageMult() {
        return (1 + 0.2 * this.stack('power')) * (this.buffs.dmg2 ? 2 : 1);
    },

    get coinMult() {
        const timed = this.timers.coins3 > 0 ? 3 : this.timers.coins2 > 0 ? 2 : 1;
        return timed * (this.buffs.gold2 ? 2 : 1);
    },

    get mobSpeedMult() {
        return (this.timers.freeze > 0 ? 0.5 : 1) * (this.buffs.slow ? 0.6 : 1);
    },

    get magnetRadius() {
        return 70 + 45 * this.stack('magnet');
    },

    get rateMult() {
        return (1 + 0.15 * this.stack('haste')) * (this.timers.rapidFire > 0 ? 3 : 1);
    },

    get comboWindow() {
        return 150 + 36 * this.stack('streak');
    },

    get powerupDuration() {
        return Math.round(600 * (1 + 0.3 * this.stack('overtime')));
    },

    /** True while nothing can hurt the player (Invincible powerup or the barbarian's Whirlwind). */
    get untouchable() {
        return this.timers.invincible > 0 || this.whirl > 0;
    },

    rollDamage(base) {
        const crit = Math.random() < 0.08 * this.stack('crit');
        return { dmg: base * this.damageMult * (crit ? 2.5 : 1), crit };
    },

    updatePlayer() {
        const p = this.player;
        let ix = 0;
        let iy = 0;
        if (this.keys.w || this.keys.arrowup) iy -= 1;
        if (this.keys.s || this.keys.arrowdown) iy += 1;
        if (this.keys.a || this.keys.arrowleft) ix -= 1;
        if (this.keys.d || this.keys.arrowright) ix += 1;
        if (ix || iy) {
            const n = U.normalizeVector(ix, iy);
            ix = n.x;
            iy = n.y;
        }
        if (this.stick.id !== null) {
            ix = this.stick.dx;
            iy = this.stick.dy;
        }

        const speed = p.baseSpeed * (1 + 0.1 * this.stack('boots')) * (this.whirl > 0 ? 1.3 : 1);
        p.vx = U.lerp(p.vx, ix * speed, 0.3);
        p.vy = U.lerp(p.vy, iy * speed, 0.3);
        p.x = U.clamp(p.x + p.vx, p.r, this.W - p.r);
        p.y = U.clamp(p.y + p.vy, p.r, this.H - p.r);
        if (Math.abs(p.vx) > 0.3) p.facing = p.vx > 0 ? 1 : -1;

        const moving = Math.hypot(p.vx, p.vy) > 0.5;
        p.moveT = moving ? p.moveT + 1 : 0;
        if (moving && this.frameNo % 6 === 0) {
            this.particle({ x: p.x - p.vx * 2, y: p.y + p.r * 0.8, vx: -p.vx * 0.1, vy: -0.2, life: 24, size: 3, color: 'rgba(255,255,255,0.5)', kind: 'dust' });
        }

        if (p.iframes > 0) p.iframes--;
        if (p.contactCd > 0) p.contactCd--;
        if (this.dropCd > 0) this.dropCd--;
        if (this.heartCd > 0) this.heartCd--;

        const regen = this.stack('regen');
        if (regen > 0 && p.hp < p.maxHp) {
            this.regenClock += STEP;
            if (this.regenClock >= (regen === 1 ? 40 : 25)) {
                this.regenClock = 0;
                p.hp++;
                this.floater(p.x, p.y - 30, '+❤️', '#ff6b8a', 18);
            }
        } else {
            this.regenClock = 0;
        }
    },

    hurtPlayer(source) {
        const p = this.player;
        if (this.state !== 'playing' || p.iframes > 0 || this.untouchable) return;
        p.hp--;
        p.iframes = 90;
        this.shake(14);
        this.hitStop = 5;
        this.hurtFlash = 1;
        if (this.combo >= 5) this.floater(p.x, p.y - 40, 'COMBO LOST', '#ff5252', 20);
        this.combo = 0;
        this.comboTimer = 0;

        const nova = this.stack('nova');
        const novaR = nova ? 90 + 40 * nova : 70;
        this.monsters.forEach(m => {
            if (m.dead) return;
            const d2 = U.distanceSquared(m.x, m.y, p.x, p.y);
            if (d2 < (novaR + m.size) ** 2) {
                const n = U.normalizeVector(m.x - p.x, m.y - p.y);
                if (!m.boss) {
                    m.kbx += n.x * 9;
                    m.kby += n.y * 9;
                }
                if (nova) this.damageMonster(m, 3 * nova * this.damageMult, { kx: 0, ky: 0 });
            }
        });
        if (nova) {
            this.ring(p.x, p.y, novaR, '#9be7ff', 22);
            this.burst(p.x, p.y, '#9be7ff', 18, 5);
        }

        if (source && source.boss && !source.dying) this.bossTaunt(source);
        if (p.hp <= 0) {
            this.die(source);
        } else {
            Sfx.play('playerHit', { volume: 0.9 });
        }
    },

    die(source) {
        this.killer = source;
        this.state = 'dying';
        this.deathTimer = 48;
        this.timeScale = 0.45;
        this.shake(24);
        const p = this.player;
        this.burst(p.x, p.y, '#ffffff', 40, 7);
        this.burst(p.x, p.y, '#b388ff', 30, 5);
        this.ring(p.x, p.y, 120, '#ffffff', 40);
        Sfx.play('playerHit', { volume: 0.9, rate: 0.8 });
    }
});
