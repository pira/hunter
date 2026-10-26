/* Monster Hunter — monsters: spawning, movement, road interaction, damage, kills. Extends Game (js/core.js). */

extendGame({
    /** Tier of the next regular spawn: the heavy tiers ramp up after they unlock (TIER_RAMP). */
    pickTier() {
        const L = this.level;
        let r = Math.random() * 100;
        for (const tier of ['ultimate', 'ancient', 'mythic', 'legendary', 'elite']) {
            const u = TIER_UNLOCK[tier];
            if (L < u) continue;
            const ramp = TIER_RAMP[tier];
            const pct = ramp.from + (ramp.to - ramp.from) * Math.min(1, (L - u) / ramp.over);
            if ((r -= pct) < 0) return tier;
        }
        // the rest: small 65% of it early, 45% by level 40 (medium 25%; large 10% → 15%)
        const late = U.clamp((L - 10) / 30, 0, 1);
        const small = 65 - 20 * late;
        const large = 10 + 5 * late;
        const x = Math.random() * 100;
        if (x < small) return 'small';
        if (x < 100 - large) return 'medium';
        return 'large';
    },

    /**
     * The families of a level: [leader, guest], both from the biome's home pair. The leader alternates
     * between the two on each lap of the biomes and never repeats the previous level's (when it can),
     * so neighbouring levels look different. Fixed per level, so a resumed hunt gets the same ones.
     */
    levelFamilies(level = this.level) {
        const cache = this.famCache || (this.famCache = [null]);
        for (let L = cache.length; L <= level; L++) {
            const home = BIOME_FAMILIES[this.biomeFor(L).id] || MOB_FAMILY_ORDER.slice(0, 2);
            const lap = Math.floor((L - 1) / BIOMES.length);
            let pair = lap % 2 ? [home[1], home[0]] : [home[0], home[1]];
            if (cache[L - 1] && pair[0] === cache[L - 1][0]) pair = [pair[1], pair[0]];
            cache[L] = pair;
        }
        return cache[Math.max(1, level)];
    },

    /** A monster of this tier: mostly the level's leading family, its guest family in small groups. */
    pickType(tier) {
        const list = MONSTER_TYPES[tier];
        const [main, guest] = this.levelFamilies();
        const run = this.guestRun && this.guestRun.level === this.level ? this.guestRun : null;
        let family = main;
        if (run && run.left > 0) {
            run.left--;
            family = guest;
        } else if (Math.random() < MOB_MIX.guestStart) {
            this.guestRun = { level: this.level, left: MOB_MIX.guestRun - 1 };
            family = guest;
        } else if (Math.random() < MOB_MIX.stray) {
            family = MOB_FAMILY_ORDER[Math.floor(Math.random() * MOB_FAMILY_ORDER.length)];
        }
        const type = list.find(t => t.family === family) || list[Math.floor(Math.random() * list.length)];
        return { ...type, tier };
    },

    makeMonster(type, x, y, behavior) {
        const levelSpeed = 1 + Math.min(0.45, (this.level - 1) * 0.012);
        const hp = Math.max(1, Math.round(type.health * U.hpScale(this.level) * (this.diffK || 1))); // Hard ×2, Hell ×3
        return {
            x, y, kbx: 0, kby: 0, type,
            size: type.size + Math.random() * type.size * 0.25,
            speed: (type.speed + Math.random() * type.speedVariation) * levelSpeed,
            color: type.color, shape: type.shape, name: type.name, tier: type.tier, family: type.family, rank: type.rank, glow: type.glow,
            hp, maxHp: hp, points: type.points,
            behavior: behavior || (Math.random() < 0.3 + Math.min(0.3, this.level * 0.01) ? 'chase' : 'random'),
            dir: Math.PI / 2 + (Math.random() - 0.5) * 1.6,
            dirT: 0, dirRate: 100 + Math.random() * 100,
            healT: 0, spawnT: 75, flash: 0, contactCd: 0,
            phase: Math.random() * TAU, dead: false
        };
    },

    /** Somewhere a monster can come from: the top edge, or out of the scenery on either side. */
    spawnPoint() {
        if (Math.random() < 0.55) return { x: 20 + Math.random() * (this.W - 40), y: -30, from: 'top' };
        const left = Math.random() < 0.5;
        const x = left ? Math.random() * (this.roadLeft - 16) + 8 : this.roadRight + 8 + Math.random() * (this.W - this.roadRight - 16);
        return { x, y: this.H * (0.08 + Math.random() * 0.5), from: left ? 'left' : 'right' };
    },

    emerge(m, from) {
        if (from === 'top') return;
        // bursts out of the bushes / rocks with a rustle
        const biome = this.biome || this.biomeFor(this.level);
        for (let i = 0; i < 8; i++) {
            const a = Math.random() * TAU;
            this.particle({ x: m.x, y: m.y, vx: Math.cos(a) * 2, vy: Math.sin(a) * 1.5 - 1, life: 26, size: 3 + Math.random() * 3, color: biome.ground[Math.floor(Math.random() * 3)], kind: 'chunk', ground: true });
        }
        m.dir = from === 'left' ? 0 : Math.PI;
    },

    spawnMonster() {
        const pos = this.spawnPoint();
        const m = this.makeMonster(this.pickType(this.pickTier()), pos.x, pos.y);
        this.emerge(m, pos.from);
        this.monsters.push(m);
        this.pairUp(m);
    },

    /** Double Trouble card: every non-boss monster gets a twin right next to it. */
    pairUp(m, extra = {}) {
        if (!this.buffs.swarm || m.boss || m.gk || m.twin) return null;
        const t = this.makeMonster({ ...m.type }, m.x + (Math.random() < 0.5 ? -1 : 1) * (m.size * 2 + 6), m.y - m.size - 4, m.behavior);
        Object.assign(t, extra, { twin: true });
        if (m.enc) t.enc = m.enc;
        this.monsters.push(t);
        return t;
    },

    spawnPack() {
        const count = 5 + Math.min(9, Math.floor(this.level / 3)); // v3.6: smaller late packs
        const type = this.pickType('small');
        const fromSide = Math.random() < 0.4;
        const left = Math.random() < 0.5;
        for (let i = 0; i < count; i++) {
            let x;
            let y;
            if (fromSide) {
                x = left ? -20 - (i % 2) * 18 : this.W + 20 + (i % 2) * 18;
                y = this.H * 0.15 + i * 18;
            } else {
                x = U.clamp(this.W / 2 + (i - count / 2) * 22, 10, this.W - 10);
                y = -30 - (i % 2) * 20;
            }
            const m = this.makeMonster(type, x, y, 'chase');
            m.speed *= 0.9;
            this.monsters.push(m);
            const t = this.pairUp(m);
            if (t) t.speed = m.speed;
        }
        this.edgeWarn = { side: fromSide ? (left ? 3 : 1) : 0, t: 60 };
    },

    updateSpawning() {
        if (this.edgeWarn && --this.edgeWarn.t <= 0) this.edgeWarn = null;
        if (this.phase !== 'fight') return;
        const alive = this.monsters.length;
        const cap = Math.min(70, 40 + this.level);
        const interval = U.spawnInterval(this.level);
        this.spawnClock += STEP;
        if (alive < 3 || (this.spawnClock >= interval && alive < cap)) {
            this.spawnMonster();
            this.spawnClock = 0;
        }

        if (this.level >= 2) {
            this.packClock -= STEP;
            if (this.packClock <= 0) {
                this.spawnPack();
                this.packClock = Math.max(6, 12 - this.level * 0.2) + Math.random() * 6;
            }
        }

        this.powerupClock -= STEP;
        if (this.powerupClock <= 0) {
            // field pickups appear on the road ahead and drift down towards you
            if (this.powerups.filter(pu => !pu.loot).length < MAX_FIELD_POWERUPS) {
                this.spawnPowerup(this.roadLeft + 30 + Math.random() * (this.roadRight - this.roadLeft - 60), 30 + Math.random() * this.H * 0.35);
            }
            this.powerupClock = 18 + Math.random() * 8;
        }
    },

    updateMonsters(dying) {
        const p = this.player;
        for (const m of this.monsters) {
            if (m.dead) continue;
            if (m.spawnT > 0) m.spawnT--;
            if (m.flash > 0) m.flash--;
            if (m.contactCd > 0) m.contactCd--;
            if (m.stun > 0) m.stun--;
            m.phase += 0.12;

            const ice = this.iceMult(m.x, m.y, m.size);
            m.iced = ice < 1;
            const freeze = this.mobSpeedMult * ice;
            if (m.dying) {
                this.updateBossDeath(m);
                continue;
            } else if (m.stun > 0) {
                // frozen in place (Stun drop)
            } else if (m.boss) {
                this.updateBoss(m, freeze);
            } else if (m.ai) {
                this.updateAi(m, freeze);
            } else {
                if (m.hp < m.maxHp && ++m.healT >= 240) {
                    m.hp = Math.min(m.maxHp, m.hp + 1);
                    m.healT = 0;
                }
                this.moveMonster(m, freeze);
            }
            if (m.poison > 0) this.updatePoison(m);

            m.x += m.kbx;
            m.y += m.kby;
            m.kbx *= 0.82;
            m.kby *= 0.82;

            if (dying || m.dying) continue;
            const touching = !m.harmless && U.distanceSquared(p.x, p.y, m.x, m.y) < (p.r * (this.untouchable ? 1.8 : 1) + m.size * (m.hitScale || 1)) ** 2;
            if (touching && m.spawnT <= 0) {
                if (this.untouchable) {
                    if (m.contactCd <= 0) {
                        m.contactCd = 10;
                        const n = U.normalizeVector(m.x - p.x, m.y - p.y);
                        this.damageMonster(m, 2 * this.damageMult, { kx: n.x * 8, ky: n.y * 8, src: p });
                    }
                } else {
                    this.hurtPlayer(m);
                }
            }
            if (!m.boss && !m.anchored) this.keepOnField(m);
            // gatekeepers stand their ground: a kick or a blast can't shove them off screen (a soft-lock)
            else if (m.anchored && m.gk && !m.hidden && (m.entered || (m.entered = m.y > m.size && m.y < this.H - m.size))) {
                m.x = U.clamp(m.x, 0, this.W); // its centre stays on screen, so it can always be targeted
                m.y = U.clamp(m.y, 0, this.H);
            }
        }
    },

    /** A monster the running encounter waits for (wave, escort, boss add): it never gets away. */
    mustReturn(m) {
        const enc = this.encounter;
        return Boolean(m.enc && m.enc === enc && !enc.done && m.behavior !== 'flee');
    },

    /** Mobs leave for good through the bottom; elsewhere they turn back towards the road.
     *  v3.15.1: encounter mobs you dodged off the bottom turn round and come back instead (they used
     *  to stall just below the edge, out of reach, and the wave could never end). */
    keepOnField(m) {
        if (this.mustReturn(m)) {
            if (m.y > this.H - m.size) m.returning = true;
            else if (m.y < this.H * 0.8 - m.size) m.returning = false;
            if (m.returning) m.y = Math.min(m.y, this.H + 40 + m.size);
        } else m.returning = false;
        if (m.y > this.H + 40 + m.size) {
            m.dead = true;
            m.escaped = true;
            return;
        }
        if (m.x < -50 - m.size || m.x > this.W + 50 + m.size || m.y < -90 - m.size) {
            m.dir = Math.atan2(this.H * 0.4 - m.y, this.W / 2 - m.x) + (Math.random() - 0.5) * 0.8;
            m.dirT = 0;
            m.x = U.clamp(m.x, -48 - m.size, this.W + 48 + m.size);
            m.y = Math.max(m.y, -88 - m.size);
        }
    },

    moveMonster(m, speedMult) {
        let s = m.speed * speedMult;
        if (this.state === 'menu') {
            m.x += Math.cos(m.dir) * s;
            m.y += Math.sin(m.dir) * s;
            return;
        }
        // Soft floor near the bottom edge: slower going down, and wanderers turn back up.
        const nearFloor = m.y > this.floorY && this.floorProtects;
        if (m.behavior === 'flee') {
            m.y += Math.max(2.4, m.speed * 2);
            m.x += Math.cos(m.phase * 0.3) * 0.6;
            return;
        }
        if (m.behavior === 'chase') {
            const n = U.normalizeVector(this.player.x - m.x, this.player.y - m.y);
            // coming back from below the screen: straight at you, never slower than a jog
            if (m.returning) s = Math.max(m.speed, 1.2) * speedMult;
            else if (nearFloor && n.y > 0) s *= 0.5; // (going up it used to crawl too: slow mobs stalled at the edge)
            m.x += n.x * s;
            m.y += n.y * s;
        } else {
            if (nearFloor) s *= 0.5;
            if (++m.dirT >= m.dirRate) {
                m.dir = Math.random() * TAU;
                // a slight up-screen lean: down-turns flip up a little more often (WANDER_UP_BIAS)
                if (Math.sin(m.dir) > 0 && Math.random() < 2 * WANDER_UP_BIAS) m.dir = -m.dir;
                m.dirT = 0;
                m.dirRate = 60 + Math.random() * 120;
            }
            if (nearFloor && Math.sin(m.dir) > 0) m.dir = -m.dir;
            m.x += Math.cos(m.dir) * s;
            m.y += Math.sin(m.dir) * s;
        }
    },

    /**
     * The one damage pipeline. opts: kx/ky knockback, crit, sound flavour, src = where the hit came
     * from (for directional shields), aoe = explosions/lightning ignore shields.
     */
    damageMonster(m, dmg, { kx = 0, ky = 0, crit = false, sound = 'thwack', src = null, aoe = false, dot = false, numColor = null } = {}) {
        if (m.dead || m.dying || m.invulnerable) return;
        if (m.shielded) {
            if (this.frameNo - (m.lastClink || 0) > 10) {
                m.lastClink = this.frameNo;
                this.floater(m.x, m.y - m.size - 10, 'SHIELDED', '#c4b5fd', 14);
                Sfx.tone(1800, { duration: 0.05, type: 'triangle', volume: 0.05, bus: 'sfx' });
            }
            this.spark(m.x, m.y - m.size * 0.5, '#c4b5fd', 3);
            return;
        }
        if (m.frontShield && !aoe && src) {
            const towardSrc = Math.atan2(src.y - m.y, src.x - m.x);
            if (Math.abs(U.angleDelta(m.facing, towardSrc)) < Math.PI / 3) {
                dmg *= 0.1; // the shield soaks hits from the front
                if (this.frameNo - (m.lastClink || 0) > 6) {
                    m.lastClink = this.frameNo;
                    this.spark(m.x + Math.cos(m.facing) * m.size, m.y + Math.sin(m.facing) * m.size, '#e2e8f0', 6);
                    Sfx.tone(2400, { duration: 0.04, type: 'square', volume: 0.04, bus: 'sfx' });
                }
                sound = false;
            }
        }
        if (m.damageScale) dmg *= m.damageScale();
        const effective = Math.min(Math.max(0, m.hp), dmg);
        m.hp -= dmg;
        m.healT = 0;
        m.flash = 5;
        if (!m.boss && !m.heavy) {
            const weight = 1 / Math.max(1, m.size / 12);
            m.kbx += kx * weight;
            m.kby += ky * weight;
        }
        this.addProgress(effective);
        // damage numbers on every hit (v2 style); crits are big and gold
        if (crit) this.floater(m.x, m.y - m.size - 6, `${Game.fmtDmg(dmg)}!`, '#ffd60a', 20);
        else if (this.frameNo - (m.lastNum || 0) > 4) {
            m.lastNum = this.frameNo;
            const big = m.boss || m.gk;
            this.floater(m.x + (Math.random() - 0.5) * m.size, m.y - m.size - 4, Game.fmtDmg(dmg), numColor || (big ? '#ffffff' : '#ffe4b5'), big ? 14 : 12, true);
        }
        if (!dot) this.poisonHit(m);
        if (m.onHurt) m.onHurt(m);
        if (m.hp <= 0) {
            if (m.boss) this.startBossDeath(m);
            else this.killMonster(m);
        } else if (sound) {
            if (m.family) Sfx.mobHit(m.family, m.size);
            else Sfx.hit(m.size, { volume: m.boss ? 0.3 : 0.22, flavor: sound });
        }
    },

    killMonster(m) {
        m.dead = true;
        this.kills++;
        this.combo++;
        this.comboTimer = this.comboWindow;
        this.bestCombo = Math.max(this.bestCombo, this.combo);
        const prevMult = U.comboMultiplier(this.combo - 1);
        const mult = U.comboMultiplier(this.combo);
        const points = Math.round(m.points * mult);
        this.score += points;
        this.addCharge(m.minion ? 1 : SUPER_CHARGE[m.boss ? 'boss' : m.gk ? 'gatekeeper' : m.tier] || 2);

        const big = m.size > 18 || m.boss;
        if (points > 0) this.floater(m.x, m.y - m.size, `+${points}`, mult > 1 ? ['#fff', '#fff', '#7CFC00', '#00e5ff', '#ff4dd2', '#ffd60a'][mult] : '#ffffff', big ? 22 : 16);
        this.burst(m.x, m.y, m.color, big ? 26 : 12, big ? 6 : 4);
        this.burst(m.x, m.y, '#ffffff', big ? 8 : 4, 3);
        const kb = this.skinExtras().burst;
        if (kb) {
            this.ring(m.x, m.y, m.size * 2.2, kb, 14); // mythic skins: a signature kill burst
            this.spark(m.x, m.y, kb, 5);
        }
        if (big) {
            this.ring(m.x, m.y, m.size * 3, m.color, 20);
            this.shake(m.boss ? 0 : 5);
        }

        if (mult > prevMult) {
            this.floater(this.player.x, this.player.y - 44, `COMBO ×${mult}!`, '#ffd60a', 26);
            Sfx.arpeggio([523, 659, 784, 1046].slice(0, mult), 0.05, { type: 'square', volume: 0.07 });
            this.comboPop = 1;
        }

        if (m.boss) {
            this.bossDefeated(m);
        } else {
            // each family has its own death sound; gatekeepers and champions fall heavier
            const big = m.gk || (m.tier !== 'small' && m.tier !== 'medium');
            Sfx.mobDeath(m.family || (m.gk ? 'fantasy' : 'beasts'), m.size, { volume: big ? 0.7 : 0.55, big });
        }
        if (m.onDeath) m.onDeath(m);
        this.dropLoot(m);
    },

    sweepDead() {
        this.monsters = this.monsters.filter(m => !m.dead);
    }
});
