/* Monster Hunter — pets on the hunt (v3.3): the pets in the profile's pet slots follow the hero and
   help. Turtle = green hearts, Bees sting, Eagle dives on the wounded, Frog swallows, Donkey kicks
   mobs away, Squirrel doubles drops, Bunny drops hearts. Extends Game (js/core.js). */

const PET_STEP = 60 * GAME_SPEED; // simulation steps per real second
const PET_SPOTS = [[-30, 20], [30, 20], [-50, -2], [50, -2]];

extendGame({
    /** Build the pets for this run from the cached profile (called from loadArtefacts at run start). */
    loadPets() {
        const cache = Leaderboard.cachedProfile() || {};
        const p = this.player;
        this.petList = this.activePets(cache).map((key, i) => {
            const { id, tier, def } = this.parsePet(key);
            const lv = Game.petLevel(cache, id);
            const pet = { id, tier, def, lv, v: Game.petValue(id, tier, lv), sting: 1 + PET_LEVEL_BONUS * lv, spot: PET_SPOTS[i], x: p.x + PET_SPOTS[i][0], y: p.y + PET_SPOTS[i][1], cd: PET_STEP * (1 + i * 0.4), t: 0, act: null };
            if (id === 'bees') pet.bees = Array.from({ length: pet.v }, (_, k) => ({ a: (k / pet.v) * TAU, cd: PET_STEP * (0.6 + (2 * k) / pet.v), fly: null }));
            return pet;
        });
        const turtle = this.pet('turtle');
        p.greenHp = p.greenMax = turtle ? turtle.v : 0;
        this.petIcons = this.petIcons || {};
    },

    /** Pet Treat powerup, Pet Party (this level) and Pack Leader (whole run) each double the pets. */
    get petMult() {
        return Math.min(4, (this.timers.petBoost > 0 ? 2 : 1) * (this.buffs.petParty ? 2 : 1) * (this.stack('packLeader') ? 2 : 1));
    },

    /** Turtle: green hearts follow the multiplier (extra ones come and go with a boost). */
    syncTurtle() {
        const t = this.pet('turtle');
        if (!t) return;
        const p = this.player;
        const want = t.v * this.petMult;
        if (want > p.greenMax) p.greenHp += want - p.greenMax;
        p.greenMax = want;
        p.greenHp = Math.min(p.greenHp, want);
    },

    pet(id) {
        return (this.petList || []).find(q => q.id === id) || null;
    },

    /** Monsters a pet may pick: alive, visible, already in play. */
    petTargets(x, y, range, extra = () => true) {
        return this.monsters.filter(m => !m.dead && !m.dying && !m.hidden && !m.invulnerable && m.spawnT <= 40 && !m.shielded
            && U.distanceSquared(x, y, m.x, m.y) < (range + m.size) ** 2 && extra(m));
    },

    updatePets() {
        const list = this.petList;
        if (!list || !list.length || this.state !== 'playing') return;
        const p = this.player;
        const busy = this.phase === 'shop' || this.phase === 'intro';
        this.syncTurtle();
        for (const pet of list) {
            pet.t++;
            // follow the hero, a little behind
            if (!pet.act) {
                const tx = p.x + pet.spot[0] * (p.facing < 0 ? -1 : 1);
                const ty = p.y + pet.spot[1];
                pet.x += (tx - pet.x) * 0.12;
                pet.y += (ty - pet.y) * 0.12;
            }
            if (busy) continue;
            if (pet.cd > 0) pet.cd -= pet.id === 'donkey' ? this.petMult : 1; // boosted donkeys kick more often
            if (pet.id === 'bees') this.updateBees(pet);
            else if (pet.id === 'eagle') this.updateEagle(pet);
            else if (pet.id === 'frog') this.updateFrog(pet);
            else if (pet.id === 'donkey') this.updateDonkey(pet);
        }
    },

    updateBees(pet) {
        const p = this.player;
        for (const b of pet.bees) {
            b.a += 0.09;
            if (b.fly) {
                const f = b.fly;
                f.t++;
                if (f.t === 12) {
                    if (!f.m.dead) this.damageMonster(f.m, pet.sting, { sound: false, aoe: true, numColor: '#facc15' }); // fed bees sting harder
                    if (Math.random() < 0.3) Sfx.tone(900 + Math.random() * 300, { duration: 0.05, type: 'sawtooth', volume: 0.025, bus: 'sfx' });
                }
                if (f.t >= 24) b.fly = null;
                continue;
            }
            if ((b.cd -= this.petMult) > 0) continue; // boosted bees sting more often
            const pool = this.petTargets(p.x, p.y, 230);
            if (!pool.length) {
                b.cd = 10;
                continue;
            }
            b.fly = { m: pool[Math.floor(Math.random() * pool.length)], t: 0 };
            b.cd = 2 * PET_STEP;
        }
    },

    updateEagle(pet) {
        const p = this.player;
        if (pet.act) {
            const a = pet.act;
            a.t++;
            const m = a.m;
            if (a.t <= 20) {
                // swoop: up and over, then down onto the target
                const k = a.t / 20;
                const tx = m.dead ? a.lx : m.x;
                const ty = m.dead ? a.ly : m.y;
                a.lx = tx;
                a.ly = ty;
                pet.x = a.sx + (tx - a.sx) * k;
                pet.y = a.sy + (ty - a.sy) * k - Math.sin(k * Math.PI) * 60;
                if (a.t === 20 && !m.dead) {
                    this.damageMonster(m, pet.v * this.petMult, { sound: 'thwack', aoe: true, numColor: '#fde68a' });
                    this.spark(m.x, m.y, '#fde68a', 6);
                }
            } else {
                pet.x += (p.x + pet.spot[0] - pet.x) * 0.15;
                pet.y += (p.y + pet.spot[1] - pet.y) * 0.15;
                if (a.t > 40) pet.act = null;
            }
            return;
        }
        if (pet.cd > 0) return;
        const pool = this.petTargets(p.x, p.y, 340, m => m.hp < m.maxHp);
        if (!pool.length) {
            pet.cd = 12;
            return;
        }
        pool.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
        pet.act = { m: pool[0], t: 0, sx: pet.x, sy: pet.y };
        pet.cd = 3 * PET_STEP;
        Sfx.tone(1400, { duration: 0.25, type: 'sine', volume: 0.04, slide: -600, bus: 'sfx' });
    },

    updateFrog(pet) {
        if (pet.act) {
            const a = pet.act;
            a.t++;
            if (a.t === 10 && !a.m.dead && !a.m.dying) {
                a.m.gulped = true;
                this.damageMonster(a.m, a.m.hp + 1, { sound: false, aoe: true, numColor: '#86efac' });
                this.floater(pet.x, pet.y - 26, 'GULP!', '#86efac', 16);
                Sfx.tone(320, { duration: 0.12, type: 'sine', volume: 0.08, slide: -180, bus: 'sfx' });
            }
            if (a.t >= 20) pet.act = null;
            return;
        }
        if (pet.cd > 0) return;
        const pool = this.petTargets(pet.x, pet.y, 170, m => !m.boss && !m.gk && m.hp <= pet.v * this.petMult);
        if (!pool.length) {
            pet.cd = 12;
            return;
        }
        pool.sort((a, b) => U.distanceSquared(pet.x, pet.y, a.x, a.y) - U.distanceSquared(pet.x, pet.y, b.x, b.y));
        pet.act = { m: pool[0], t: 0, lx: pool[0].x, ly: pool[0].y };
        pet.act.follow = true;
        pet.cd = 4 * PET_STEP;
    },

    updateDonkey(pet) {
        const p = this.player;
        if (pet.act && ++pet.act.t > 14) pet.act = null;
        if (pet.cd > 0) return;
        // the first monster about to reach you gets a kick (bosses are too big to kick)
        const pool = this.petTargets(p.x, p.y, p.r + 46, m => !m.boss && !m.harmless);
        if (!pool.length) return;
        pool.sort((a, b) => U.distanceSquared(p.x, p.y, a.x, a.y) - U.distanceSquared(p.x, p.y, b.x, b.y));
        const m = pool[0];
        const n = U.normalizeVector(m.x - p.x, m.y - p.y);
        const strength = m.gk || m.heavy ? 40 : 30;
        if (m.gk || m.heavy) {
            m.x += n.x * 40; // gatekeepers don't take knockback, so shove them
            m.y += n.y * 40;
        }
        this.damageMonster(m, 1, { kx: n.x * strength, ky: n.y * strength, sound: 'thwack', aoe: true, numColor: '#d6d3d1' });
        pet.act = { t: 0, x: m.x - n.x * m.size, y: m.y - n.y * m.size };
        pet.x = p.x + n.x * (p.r + 14);
        pet.y = p.y + n.y * (p.r + 14);
        this.burst(pet.act.x, pet.act.y, '#e7e5e4', 6, 3);
        pet.cd = pet.v * PET_STEP;
    },

    /** Squirrel: chance that a kill drops its loot twice. */
    get doubleDropChance() {
        const sq = this.pet('squirrel');
        return sq ? (sq.v * this.petMult) / 100 : 0;
    },

    /** Bunny: chance to drop a heart when you get hit. */
    bunnyOnHit() {
        const b = this.pet('bunny');
        if (!b || Math.random() >= (b.v * this.petMult) / 100) return;
        const p = this.player;
        this.spawnPowerup(b.x, b.y, 'heart', { pop: true });
        this.floater(b.x, b.y - 24, '❤️ hop!', '#fda4af', 16);
    },

    /** Turtle: green hearts take the hit before the red ones. Returns true if one was used. */
    turtleBlocks() {
        const p = this.player;
        if (!(p.greenHp > 0)) return false;
        p.greenHp--;
        const t = this.pet('turtle');
        if (t) this.floater(t.x, t.y - 24, p.greenHp ? 'SHELL!' : 'shell cracked…', '#86efac', 16);
        return true;
    },

    // ------------------------------------------------------------------ drawing

    petEmoji(def) {
        if (!def.alt) return def.icon;
        if (Game.emojiOk === undefined) Game.emojiOk = {};
        if (Game.emojiOk[def.icon] === undefined) Game.emojiOk[def.icon] = Game.supportsEmoji(def.icon);
        return Game.emojiOk[def.icon] ? def.icon : def.alt;
    },

    drawPets(ctx) {
        const list = this.petList;
        if (!list || !list.length) return;
        const p = this.player;
        ctx.globalAlpha = 1;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (const pet of list) {
            const hop = pet.act ? 0 : Math.abs(Math.sin(pet.t * 0.12)) * (p.moveT > 0 ? 4 : 1.5);
            if (this.petMult > 1) {
                // boosted: a warm golden glow
                const g = ctx.createRadialGradient(pet.x, pet.y - 6, 2, pet.x, pet.y - 6, 22);
                g.addColorStop(0, `rgba(253,224,71,${0.35 + 0.15 * Math.sin(pet.t * 0.2)})`);
                g.addColorStop(1, 'rgba(253,224,71,0)');
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.arc(pet.x, pet.y - 6, 22, 0, TAU);
                ctx.fill();
            }
            const flying = pet.id === 'eagle' || pet.id === 'bees';
            this.drawShadow(ctx, pet.x, pet.y + 10 + (flying ? 10 : 0), flying ? 6 : 9);
            // frog tongue
            if (pet.id === 'frog' && pet.act) {
                const a = pet.act;
                const k = a.t <= 10 ? a.t / 10 : 1 - (a.t - 10) / 10;
                if (!a.m.dead) {
                    a.lx = a.m.x;
                    a.ly = a.m.y;
                }
                ctx.strokeStyle = '#f472b6';
                ctx.lineWidth = 4;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(pet.x, pet.y);
                ctx.lineTo(pet.x + (a.lx - pet.x) * k, pet.y + (a.ly - pet.y) * k);
                ctx.stroke();
                ctx.lineCap = 'butt';
            }
            if (pet.id === 'donkey' && pet.act) {
                ctx.globalAlpha = 1 - pet.act.t / 14;
                ctx.font = `20px ${EMOJI_FONT}`;
                ctx.fillStyle = '#000';
                ctx.fillText('💥', pet.act.x, pet.act.y);
                ctx.globalAlpha = 1;
            }
            const size = pet.id === 'bees' ? 18 : 24;
            ctx.font = `${size}px ${EMOJI_FONT}`;
            ctx.fillStyle = '#000'; // emoji take the fill's alpha: keep it opaque
            const flip = pet.id !== 'eagle' && (p.facing < 0);
            ctx.save();
            ctx.translate(pet.x, pet.y - hop + (flying ? -8 : 0));
            if (flip) ctx.scale(-1, 1);
            if (pet.id === 'turtle' && !(p.greenHp > 0)) ctx.globalAlpha = 0.45; // hiding in its shell
            ctx.fillText(pet.id === 'bees' ? '🪺' : this.petEmoji(pet.def), 0, 0);
            ctx.restore();
            ctx.globalAlpha = 1;
            if (pet.id === 'bees') this.drawBees(ctx, pet);
            // rarity sparkle under rare and better pets
            if (pet.tier > 1 && pet.t % 30 < 15) {
                ctx.fillStyle = TIERS[pet.tier].color;
                ctx.beginPath();
                ctx.arc(pet.x + 10, pet.y - 12 - hop, 2, 0, TAU);
                ctx.fill();
            }
        }
    },

    drawBees(ctx, pet) {
        for (const b of pet.bees) {
            let x = pet.x + Math.cos(b.a) * 16;
            let y = pet.y - 14 + Math.sin(b.a * 1.3) * 8;
            if (b.fly) {
                const f = b.fly;
                const k = f.t <= 12 ? f.t / 12 : 1 - (f.t - 12) / 12;
                if (!f.m.dead) {
                    f.lx = f.m.x;
                    f.ly = f.m.y;
                }
                x += ((f.lx ?? x) - x) * k + Math.sin(f.t * 1.7) * 3;
                y += ((f.ly ?? y) - y) * k;
            }
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.beginPath();
            ctx.ellipse(x - 1, y - 3, 2.6, 1.6, -0.5, 0, TAU);
            ctx.ellipse(x + 2, y - 3, 2.6, 1.6, 0.5, 0, TAU);
            ctx.fill();
            ctx.fillStyle = '#facc15';
            ctx.beginPath();
            ctx.ellipse(x, y, 3.6, 2.6, 0, 0, TAU);
            ctx.fill();
            ctx.fillStyle = '#1c1917';
            ctx.fillRect(x - 0.8, y - 2.4, 1.6, 4.8);
        }
    }
});

Object.assign(Game, {
    /** 4h 12m · 12m 05s · 40s */
    fmtLeft(ms) {
        const s = Math.max(0, Math.ceil(ms / 1000));
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        return h ? `${h}h ${String(m).padStart(2, '0')}m` : m ? `${m}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`;
    },

    /** Does this device draw the emoji (newer ones like 🫏 show as tofu on older systems)? */
    supportsEmoji(ch) {
        try {
            const cv = document.createElement('canvas');
            cv.width = cv.height = 24;
            const g = cv.getContext('2d', { willReadFrequently: true });
            g.font = `20px ${EMOJI_FONT}`;
            g.textBaseline = 'middle';
            g.fillText(ch, 2, 12);
            const a = g.getImageData(0, 0, 24, 24).data;
            g.clearRect(0, 0, 24, 24);
            g.fillText('￿', 2, 12);
            const b = g.getImageData(0, 0, 24, 24).data;
            let colour = false;
            let same = true;
            for (let i = 0; i < a.length; i += 4) {
                if (a[i + 3] && (Math.abs(a[i] - a[i + 1]) > 20 || Math.abs(a[i + 1] - a[i + 2]) > 20)) colour = true;
                if (a[i + 3] !== b[i + 3]) same = false;
            }
            return colour && !same;
        } catch (e) {
            return true;
        }
    }
});

Object.assign(Game, {
    /** A pet kind's level (fed with gold in the profile), 0–PET_LEVEL_MAX. */
    petLevel(profile, id) {
        const lv = Number(((profile && profile.petLevels) || {})[id]) || 0;
        return U.clamp(Math.floor(lv), 0, PET_LEVEL_MAX);
    },

    /** The pet's number at a tier and level: +5% a level (the donkey kicks that much more often);
     *  the turtle's hearts are whole, so it gets one more at levels 5 and 10; bees sting harder instead. */
    petValue(id, tier, lv = 0) {
        const base = PETS[id].values[tier];
        const k = 1 + PET_LEVEL_BONUS * lv;
        if (id === 'turtle') return base + Math.floor(lv / 5);
        if (id === 'bees') return base;
        if (id === 'donkey') return Math.round((base / k) * 100) / 100;
        return Math.round(base * k * 100) / 100;
    }
});
