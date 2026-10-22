/* Monster Hunter — loot: coins, drops, powerups. Extends Game (js/core.js). */

extendGame({
    dropLoot(m) {
        const luck = 1 + 0.3 * this.stack('luck');
        const [cChance, cMin, cMax] = m.minion ? [0.15, 1, 1] : COIN_DROPS[m.tier] || [0, 0, 0];
        if (Math.random() < cChance * luck) this.spawnCoins(m.x, m.y, cMin + Math.floor(Math.random() * (cMax - cMin + 1)), 2.2);
        if (m.minion) return;

        // Powerups are throttled: one per DROP_COOLDOWN and never more than a few on the floor.
        const onField = this.powerups.filter(pu => !pu.loot).length;
        if (this.dropCd <= 0 && onField < MAX_FIELD_POWERUPS && Math.random() < (DROP_CHANCE[m.tier] || 0) * luck) {
            this.spawnPowerup(m.x, m.y, null, { pop: true });
            this.dropCd = DROP_COOLDOWN;
            return;
        }
        // Hearts have their own, more generous roll while you're hurt.
        const p = this.player;
        if (p.hp < p.maxHp && this.heartCd <= 0 && Math.random() < (m.size > 14 ? 0.05 : 0.01) * luck) {
            this.spawnPowerup(m.x, m.y, 'heart', { pop: true });
            this.heartCd = 600;
        }
    },

    spawnCoins(x, y, amount, speed = 2.5, lift = 3) {
        let left = Math.round(amount);
        while (left > 0) {
            const value = left >= 10 ? 5 : 1;
            left -= value;
            const a = Math.random() * TAU;
            const v = speed * (0.35 + Math.random() * 0.75);
            this.coinDrops.push({
                x, y, z: 4, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: lift * (0.7 + Math.random() * 0.6),
                value, life: 780, t: 0, spin: Math.random() * TAU
            });
        }
    },

    updateCoins() {
        const p = this.player;
        const magnet = this.magnetRadius;
        for (const c of this.coinDrops) {
            c.t++;
            c.life--;
            c.spin += 0.18;
            c.x += c.vx;
            c.y += c.vy;
            c.vx *= 0.93;
            c.vy *= 0.93;
            c.z += c.vz;
            c.vz -= 0.32;
            if (c.z <= 0) {
                c.z = 0;
                c.vz = Math.abs(c.vz) > 1 ? -c.vz * 0.45 : 0;
            }
            c.x = U.clamp(c.x, 8, this.W - 8);
            c.y = U.clamp(c.y, 8, this.H - 8);
            const d = Math.hypot(p.x - c.x, p.y - c.y);
            if (c.t > 18 && d < p.r + 12) {
                c.life = 0;
                const gain = c.value * this.coinMult;
                this.coins += gain;
                this.coinsEarned += gain;
                this.coinFloat.n += gain;
                Sfx.coin(c.value >= 5);
            } else if (c.t > 18 && d < magnet) {
                const pull = 0.1 + 0.25 * (1 - d / magnet);
                c.x += (p.x - c.x) * pull;
                c.y += (p.y - c.y) * pull;
            }
        }
        this.coinDrops = this.coinDrops.filter(c => c.life > 0);
        if (this.coinFloat.n > 0 && ++this.coinFloat.t >= 14) {
            this.floater(p.x + 18, p.y - 28, `+${this.coinFloat.n} 🪙`, '#ffd60a', 15);
            this.coinFloat = { n: 0, t: 0 };
        }
    },

    spawnPowerup(x, y, type, { pop = false, loot = false, speed = 2.5 } = {}) {
        if (!type) type = U.pickWeighted(Object.entries(POWERUPS).map(([k, d]) => ({ k, weight: d.weight }))).k;
        const a = Math.random() * TAU;
        this.powerups.push({
            x: U.clamp(x, 20, this.W - 20), y: U.clamp(y, 20, this.H - 20), type, life: 720, t: 0, loot,
            vx: pop ? Math.cos(a) * speed : 0, vy: pop ? Math.sin(a) * speed : 0, z: pop ? 4 : 0, vz: pop ? 4.5 : 0
        });
    },

    updatePowerups() {
        const p = this.player;
        TIMED_POWERUPS.forEach(t => {
            if (this.timers[t] > 0) {
                this.timers[t]--;
                if (this.timers[t] === 0) this.floater(p.x, p.y - 36, `${POWERUPS[t].name} over`, '#cccccc', 14);
            }
        });
        const magnet = this.magnetRadius;
        for (const pu of this.powerups) {
            pu.t++;
            pu.life--;
            if (pu.vx || pu.vy || pu.z > 0 || pu.vz) {
                pu.x = U.clamp(pu.x + pu.vx, 20, this.W - 20);
                pu.y = U.clamp(pu.y + pu.vy, 20, this.H - 20);
                pu.vx *= 0.92;
                pu.vy *= 0.92;
                pu.z += pu.vz;
                pu.vz -= 0.3;
                if (pu.z <= 0) {
                    pu.z = 0;
                    pu.vz = Math.abs(pu.vz) > 1 ? -pu.vz * 0.4 : 0;
                }
                if (Math.abs(pu.vx) < 0.05 && Math.abs(pu.vy) < 0.05) pu.vx = pu.vy = 0;
            }
            const d2 = U.distanceSquared(p.x, p.y, pu.x, pu.y);
            if (pu.t > 15 && d2 < (p.r + 26) ** 2) {
                this.collectPowerup(pu);
                pu.life = 0;
            } else if (pu.t > 15 && d2 < magnet * magnet) {
                // Gentle pull once you're close, so pickups feel snappy.
                pu.x += (p.x - pu.x) * 0.08;
                pu.y += (p.y - pu.y) * 0.08;
            }
        }
        this.powerups = this.powerups.filter(pu => pu.life > 0);
    },

    collectPowerup(pu) {
        const def = POWERUPS[pu.type];
        const p = this.player;
        this.ring(pu.x, pu.y, 40, def.color, 18);
        this.burst(pu.x, pu.y, def.color, 14, 4);
        if (pu.type === 'storm') {
            // Storm runs a fixed 15 s and strikes immediately, then every 3 s.
            this.timers.storm = Math.min(TIMER_CAP, this.timers.storm + STORM.duration);
            this.stormClock = 1;
            this.floater(p.x, p.y - 36, 'STORM!', def.color, 24);
            Sfx.play('powerup', { volume: 0.32, rate: 0.9 });
        } else if (def.timed) {
            this.timers[pu.type] = Math.min(TIMER_CAP, this.timers[pu.type] + this.powerupDuration);
            this.floater(p.x, p.y - 36, def.name.toUpperCase(), def.color, 22);
            Sfx.play('powerup', { volume: 0.32 });
        } else if (pu.type === 'heart') {
            if (p.hp < p.maxHp) {
                p.hp++;
                this.floater(p.x, p.y - 36, '+❤️', '#ff6b8a', 22);
            } else {
                this.spawnCoins(p.x, p.y, 5, 1.5); // full health: hearts turn into coins
                this.floater(p.x, p.y - 36, 'Full health → 🪙', '#ffd60a', 16);
            }
            Sfx.play('powerup', { volume: 0.32, rate: 1.2 });
        } else if (pu.type === 'bomb') {
            this.activateBomb();
        } else if (pu.type === 'overcharge') {
            this.floater(p.x, p.y - 36, 'OVERCHARGE!', def.color, 22);
            this.superMeter = 99.9;
            this.addCharge(1);
            Sfx.play('powerup', { volume: 0.32, rate: 1.4 });
        }
    },

    activateBomb() {
        for (const m of this.monsters) {
            if (m.dead) continue;
            const n = U.normalizeVector(m.x - this.player.x, m.y - this.player.y);
            this.damageMonster(m, 8 * this.damageMult, { kx: n.x * 10, ky: n.y * 10 });
        }
        this.enemyShots = [];
        this.flash = { color: '255,60,30', t: 40, max: 40 };
        this.ring(this.player.x, this.player.y, Math.max(this.W, this.H), '#ff6b35', 36);
        this.shake(18);
        Sfx.play('boom', { volume: 0.9 });
    }
});
