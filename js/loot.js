/* Monster Hunter — loot: coins, drops, powerups. Extends Game (js/core.js). */

extendGame({
    dropLoot(m) {
        const luck = this.luckMult;
        const [chance, base] = m.minion ? [0.15, 1] : COIN_DROPS[m.tier] || [0, 0];
        // Coins scale with monster HP (unlike v2), so late levels pay more.
        if (Math.random() < chance) this.spawnCoins(m.x, m.y, U.coinDrop(base, this.level, 0.8 + Math.random() * 0.4), 2.2);
        if (m.minion) return;
        if (!m.boss && Math.random() < (GEM_CHANCE[m.gk ? 'gatekeeper' : m.tier] || 0) * Math.sqrt(luck)) this.spawnGems(m.x, m.y, 1);

        // Powerups are throttled: one per DROP_COOLDOWN and never more than a few on the floor.
        const onField = this.powerups.filter(pu => !pu.loot).length;
        if (this.dropCd <= 0 && onField < MAX_FIELD_POWERUPS && Math.random() < (DROP_CHANCE[m.tier] || (m.gk ? 0.5 : 0)) * luck) {
            this.spawnPowerup(m.x, m.y, null, { pop: true });
            this.dropCd = DROP_COOLDOWN;
            return;
        }
        if (m.gk && (m.gen || 0) === 0) this.spawnCoins(m.x, m.y, 6 + this.level, 3.5, 5);
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

    /** Gems ride the coin physics but are worth a gem each, glow blue and live longer. */
    spawnGems(x, y, n) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * TAU;
            const v = 1.5 + Math.random() * 1.5;
            this.coinDrops.push({ x, y, z: 6, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: 5 + Math.random() * 2, gem: true, value: 1, life: 1500, t: 0, spin: Math.random() * TAU });
        }
        this.floater(x, y - 30, n > 1 ? `💎 ×${n}` : '💎', '#7dd3fc', 20);
    },

    updateCoins() {
        const p = this.player;
        const magnet = this.magnetRadius;
        const frozen = this.lootFrozen;
        for (const c of this.coinDrops) {
            c.t++;
            if (!frozen) c.life--;
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
            // sides and top keep coins on screen; the bottom edge lets them go (the road carries them off)
            c.x = U.clamp(c.x, 8, this.W - 8);
            c.y = Math.max(8, c.y);
            const d = Math.hypot(p.x - c.x, p.y - c.y);
            if (c.t > 18 && d < p.r + 12 && c.gem) {
                c.life = 0;
                this.gems++;
                this.floater(p.x, p.y - 34, '+1 💎', '#7dd3fc', 18);
                Sfx.arpeggio([1318, 1760, 2093], 0.05, { type: 'triangle', volume: 0.1 });
            } else if (c.t > 18 && d < p.r + 12) {
                c.life = 0;
                // fractional multipliers (Gold Rush, Greed Ring) accumulate until they make a whole coin
                this.coinFrac = (this.coinFrac || 0) + c.value * this.coinMult;
                const gain = Math.floor(this.coinFrac);
                this.coinFrac -= gain;
                this.coins += gain;
                this.coinsEarned += gain;
                this.coinFloat.n += gain;
                Sfx.coin(c.value >= 5);
            } else if (c.t > 18 && d < magnet) {
                this.glideTo(c, p, d);
            } else {
                c.mv = 0;
            }
        }
        this.coinDrops = this.coinDrops.filter(c => c.life > 0);
        if (this.coinFloat.n > 0 && ++this.coinFloat.t >= 14) {
            this.floater(p.x + 18, p.y - 28, `+${this.coinFloat.n} 🪙`, '#ffd60a', 15);
            this.coinFloat = { n: 0, t: 0 };
        }
    },

    /** Pickups drift towards you, speeding up to ~8 px/step: about 2–3 s across the whole map. */
    glideTo(o, p, d) {
        o.mv = Math.min(8, (o.mv || 1.2) + 0.15);
        const k = Math.min(1, o.mv / Math.max(1, d));
        o.x += (p.x - o.x) * k;
        o.y += (p.y - o.y) * k;
    },

    /** Loot timers (pickup lifetimes, active effects) pause between levels. */
    get lootFrozen() {
        return this.phase === 'loot' || this.phase === 'travel' || this.phase === 'shop' || this.phase === 'intro';
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
        // Timers stand still from the end of an encounter until the next level's fight begins,
        // so boss loot isn't wasted on the shop and the travel.
        const frozen = this.lootFrozen;
        TIMED_POWERUPS.forEach(t => {
            if (this.timers[t] > 0 && !frozen) {
                this.timers[t]--;
                if (this.timers[t] === 0) this.floater(p.x, p.y - 36, `${POWERUPS[t].name} over`, '#cccccc', 14);
            }
        });
        const magnet = this.magnetRadius;
        for (const pu of this.powerups) {
            pu.t++;
            if (!frozen) pu.life--;
            if (pu.vx || pu.vy || pu.z > 0 || pu.vz) {
                pu.x = U.clamp(pu.x + pu.vx, 20, this.W - 20);
                pu.y = Math.max(20, pu.y + pu.vy);
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
                this.glideTo(pu, p, Math.sqrt(d2));
            } else {
                pu.mv = 0;
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
            this.timers.storm = Math.min(TIMER_CAP, this.timers.storm + this.powerupDuration('storm'));
            this.stormClock = 1;
            this.floater(p.x, p.y - 36, 'STORM!', def.color, 24);
            Sfx.play('powerup', { volume: 0.32, rate: 0.9 });
        } else if (def.timed) {
            this.timers[pu.type] = Math.min(TIMER_CAP, this.timers[pu.type] + this.powerupDuration(pu.type));
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
        } else if (pu.type === 'quake') {
            this.activateQuake();
        } else if (pu.type === 'stun') {
            this.activateStun();
        } else if (pu.type === 'overcharge') {
            this.floater(p.x, p.y - 36, 'OVERCHARGE!', def.color, 22);
            this.superMeter = 99.9;
            this.addCharge(1);
            Sfx.play('powerup', { volume: 0.32, rate: 1.4 });
        }
    },

    // Earthquake (the old Bomb): everything on screen takes a hit; the ground cracks.
    activateQuake() {
        const p = this.player;
        for (const m of this.monsters) {
            if (m.dead) continue;
            const n = U.normalizeVector(m.x - p.x, m.y - p.y);
            this.damageMonster(m, 8 * this.damageMult, { kx: n.x * 10, ky: n.y * 10, aoe: true, sound: false });
        }
        this.enemyShots = [];
        for (let i = 0; i < 7; i++) this.decal(p.x + (Math.random() - 0.5) * this.W * 0.8, p.y + (Math.random() - 0.5) * this.H * 0.8, 50 + Math.random() * 40, 'crack');
        this.decal(p.x, p.y + 10, 90, 'crack');
        this.flash = { color: '255,60,30', t: 40, max: 40 };
        this.ring(p.x, p.y, Math.max(this.W, this.H), '#ff6b35', 36);
        this.shake(22);
        Sfx.play('boom', { volume: 0.9, rate: 0.7 });
    },

    // Stun: every monster on screen freezes solid for 3 s (bosses 1 s).
    activateStun() {
        for (const m of this.monsters) {
            if (m.dead || m.dying) continue;
            if (m.x < -m.size || m.x > this.W + m.size || m.y < -m.size || m.y > this.H + m.size) continue;
            m.stun = Math.round((m.boss ? 1 : 3) * 60 * GAME_SPEED);
            this.spark(m.x, m.y - m.size, '#fde047', 4);
        }
        this.flash = { color: '255,240,120', t: 18, max: 18 };
        this.floater(this.player.x, this.player.y - 36, 'STUNNED THEM ALL!', '#fde047', 22);
        Sfx.arpeggio([1568, 1318, 1568, 1318], 0.05, { type: 'triangle', volume: 0.08 });
    },

    // Poison Cloud: a cloud of green smoke around you; every half second it takes 1 HP off every
    // monster inside it.
    poisonHit() {},

    updatePoisonCloud() {
        if (!(this.timers.poison > 0) || this.lootFrozen) return;
        const p = this.player;
        this.poisonT = (this.poisonT || 0) + 1;
        if (this.poisonT % 3 === 0) {
            const a = Math.random() * TAU;
            const r = Math.random() * POISON_RADIUS;
            this.particle({ x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r * 0.7, vx: (Math.random() - 0.5) * 0.4, vy: -0.25, life: 40, size: 6 + Math.random() * 8, grow: 0.25, color: 'rgba(132,204,22,0.16)', kind: 'smoke' });
        }
        if (this.poisonT % 27 !== 0) return;
        for (const m of this.monsters) {
            if (m.dead || m.dying) continue;
            if (U.distanceSquared(m.x, m.y, p.x, p.y) < (POISON_RADIUS + m.size * 0.5) ** 2) {
                m.poison = 30;
                this.damageMonster(m, 1, { sound: false, aoe: true, dot: true, numColor: '#bef264' });
            }
        }
    },

    updatePoison(m) {
        m.poison--; // only tints the monster while it sits in the cloud
    }
});
