/* Monster Hunter — monsters: spawning, movement, kills. Extends Game (js/core.js). */

extendGame({
    pickTier() {
        const r = Math.random();
        const L = this.level;
        if (L >= TIER_UNLOCK.ultimate && r < 0.04) return 'ultimate';
        if (L >= TIER_UNLOCK.ancient && r < 0.07) return 'ancient';
        if (L >= TIER_UNLOCK.mythic && r < 0.1) return 'mythic';
        if (L >= TIER_UNLOCK.legendary && r < 0.12) return 'legendary';
        if (L >= TIER_UNLOCK.elite && r < 0.15) return 'elite';
        if (r < 0.65) return 'small';
        if (r < 0.9) return 'medium';
        return 'large';
    },

    pickType(tier) {
        const list = MONSTER_TYPES[tier];
        return { ...list[Math.floor(Math.random() * list.length)], tier };
    },

    edgePoint(side = Math.floor(Math.random() * 4), margin = 30) {
        switch (side) {
            case 0: return { x: Math.random() * this.W, y: -margin };
            case 1: return { x: this.W + margin, y: Math.random() * this.H };
            case 2: return { x: Math.random() * this.W, y: this.H + margin };
            default: return { x: -margin, y: Math.random() * this.H };
        }
    },

    makeMonster(type, x, y, behavior) {
        const levelSpeed = 1 + Math.min(0.45, (this.level - 1) * 0.012);
        const hpScale = 1 + Math.floor((this.level - 1) / 6) * 0.3;
        const hp = Math.max(1, Math.round(type.health * hpScale));
        return {
            x, y, kbx: 0, kby: 0,
            size: type.size + Math.random() * type.size * 0.25,
            speed: (type.speed + Math.random() * type.speedVariation) * levelSpeed,
            color: type.color, shape: type.shape, name: type.name, tier: type.tier,
            hp, maxHp: hp, points: type.points,
            behavior: behavior || (Math.random() < 0.3 + Math.min(0.3, this.level * 0.01) ? 'chase' : 'random'),
            dir: Math.atan2(this.H / 2 - y, this.W / 2 - x) + (Math.random() - 0.5) * 1.2,
            dirT: 0, dirRate: 100 + Math.random() * 100,
            healT: 0, spawnT: 75, flash: 0, contactCd: 0,
            phase: Math.random() * TAU, dead: false
        };
    },

    spawnMonster() {
        const pos = this.edgePoint();
        this.monsters.push(this.makeMonster(this.pickType(this.pickTier()), pos.x, pos.y));
    },

    spawnPack() {
        const side = Math.floor(Math.random() * 4);
        const count = 5 + Math.min(14, Math.floor(this.level / 2));
        const origin = this.edgePoint(side, 40);
        const type = this.pickType('small');
        for (let i = 0; i < count; i++) {
            const offset = (i - count / 2) * 22;
            const x = side % 2 === 0 ? U.clamp(origin.x + offset, 10, this.W - 10) : origin.x + (side === 1 ? i % 2 * 20 : -(i % 2) * 20);
            const y = side % 2 === 1 ? U.clamp(origin.y + offset, 10, this.H - 10) : origin.y + (side === 2 ? i % 2 * 20 : -(i % 2) * 20);
            const m = this.makeMonster(type, x, y, 'chase');
            m.speed *= 0.9;
            this.monsters.push(m);
        }
        this.edgeWarn = { side, t: 60 };
    },

    updateSpawning() {
        const alive = this.monsters.length;
        const cap = this.boss ? Math.min(30, 20 + this.level) : Math.min(110, 40 + this.level * 2);
        const interval = U.spawnInterval(this.level) * (this.boss ? 2.2 : 1);
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
            if (this.powerups.filter(pu => !pu.loot).length < MAX_FIELD_POWERUPS) {
                this.spawnPowerup(40 + Math.random() * (this.W - 80), 40 + Math.random() * (this.H - 80));
            }
            this.powerupClock = 12 + Math.random() * 8;
        }

        if (this.bossWarning > 0) {
            this.bossWarning--;
            if (this.bossWarning % 30 === 0) Sfx.tone(220, { duration: 0.25, type: 'sawtooth', volume: 0.08, slide: -80 });
            if (this.bossWarning === 0) this.spawnBoss();
        } else if (!this.boss && this.bossQueue > 0 && !this.pendingLevels) {
            this.bossQueue--;
            this.startBossWarning();
        }
        if (this.edgeWarn && --this.edgeWarn.t <= 0) this.edgeWarn = null;
    },

    updateMonsters(dying) {
        const p = this.player;
        const freeze = this.mobSpeedMult;
        for (const m of this.monsters) {
            if (m.dead) continue;
            if (m.spawnT > 0) m.spawnT--;
            if (m.flash > 0) m.flash--;
            if (m.contactCd > 0) m.contactCd--;
            m.phase += 0.12;

            if (m.dying) {
                this.updateBossDeath(m);
                continue;
            } else if (m.boss) {
                this.updateBoss(m, freeze);
            } else {
                if (m.hp < m.maxHp) {
                    if (++m.healT >= 240) {
                        m.hp = Math.min(m.maxHp, m.hp + 1);
                        m.healT = 0;
                    }
                }
                this.moveMonster(m, freeze);
            }

            m.x += m.kbx;
            m.y += m.kby;
            m.kbx *= 0.82;
            m.kby *= 0.82;

            if (dying || m.dying) continue;
            const touching = U.distanceSquared(p.x, p.y, m.x, m.y) < (p.r * (this.untouchable ? 1.8 : 1) + m.size) ** 2;
            if (touching && m.spawnT <= 0) {
                if (this.untouchable) {
                    if (m.contactCd <= 0) {
                        m.contactCd = 10;
                        const n = U.normalizeVector(m.x - p.x, m.y - p.y);
                        this.damageMonster(m, 2 * this.damageMult, { kx: n.x * 8, ky: n.y * 8 });
                    }
                } else {
                    this.hurtPlayer(m);
                }
            }

            if (!m.boss && (m.x < -60 - m.size || m.x > this.W + 60 + m.size || m.y < -60 - m.size || m.y > this.H + 60 + m.size)) {
                if (Math.random() < 0.75) {
                    m.dir = Math.atan2(this.H / 2 - m.y, this.W / 2 - m.x) + (Math.random() - 0.5) * Math.PI * 0.8;
                    m.dirT = 0;
                    m.x = U.clamp(m.x, -55 - m.size, this.W + 55 + m.size);
                    m.y = U.clamp(m.y, -55 - m.size, this.H + 55 + m.size);
                } else {
                    m.dead = true;
                    m.escaped = true;
                }
            }
        }
    },

    moveMonster(m, speedMult) {
        const s = m.speed * speedMult;
        if (m.behavior === 'chase' && this.state !== 'menu') {
            const n = U.normalizeVector(this.player.x - m.x, this.player.y - m.y);
            m.x += n.x * s;
            m.y += n.y * s;
        } else {
            if (++m.dirT >= m.dirRate) {
                m.dir = Math.random() * TAU;
                m.dirT = 0;
                m.dirRate = 60 + Math.random() * 120;
            }
            m.x += Math.cos(m.dir) * s;
            m.y += Math.sin(m.dir) * s;
        }
    },

    damageMonster(m, dmg, { kx = 0, ky = 0, crit = false, sound = 'thwack' } = {}) {
        if (m.dead || m.dying) return;
        m.hp -= dmg;
        m.healT = 0;
        m.flash = 5;
        if (!m.boss) {
            const weight = 1 / Math.max(1, m.size / 12);
            m.kbx += kx * weight;
            m.kby += ky * weight;
        }
        if (crit) this.floater(m.x, m.y - m.size - 6, `${Math.round(dmg)}!`, '#ffd60a', 20);
        else if (m.boss && this.frameNo - (m.lastNum || 0) > 6) {
            m.lastNum = this.frameNo;
            this.floater(m.x + (Math.random() - 0.5) * m.size, m.y - m.size - 4, `${Math.round(dmg * 10) / 10}`, '#ffffff', 14);
        }
        if (m.hp <= 0) {
            if (m.boss) this.startBossDeath(m);
            else this.killMonster(m);
        } else {
            if (sound) Sfx.hit(m.size, { volume: m.boss ? 0.3 : 0.22, flavor: sound });
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
        this.gainXp(m.points * (this.buffs.xp2 ? 2 : 1));
        this.addCharge(m.minion ? 1 : SUPER_CHARGE[m.boss ? 'boss' : m.tier] || 2);

        const big = m.size > 18 || m.boss;
        if (points > 0) this.floater(m.x, m.y - m.size, `+${points}`, mult > 1 ? ['#fff', '#fff', '#7CFC00', '#00e5ff', '#ff4dd2', '#ffd60a'][mult] : '#ffffff', big ? 22 : 16);
        this.burst(m.x, m.y, m.color, big ? 26 : 12, big ? 6 : 4);
        this.burst(m.x, m.y, '#ffffff', big ? 8 : 4, 3);
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
            // Every monster type has its own procedurally generated voice.
            const big = m.tier !== 'small' && m.tier !== 'medium';
            Sfx.creature(m.name, m.minion ? 'small' : m.tier, { volume: big ? 0.6 : 0.42, size: m.size });
            if (!big) Sfx.play('monsterDeath', { volume: 0.22, rate: 1.3 + Math.random() * 0.4 });
        }

        this.dropLoot(m);
    },

    sweepDead() {
        this.monsters = this.monsters.filter(m => !m.dead);
    }
});
