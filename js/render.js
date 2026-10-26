/* Monster Hunter — render: particles/effects and canvas drawing. Extends Game (js/core.js). */

extendGame({
    shake(amount) {
        this.shakeAmt = Math.min(30, Math.max(this.shakeAmt, amount));
    },

    updateShake() {
        if (this.shakeAmt > 0.2) {
            this.shakeX = (Math.random() - 0.5) * this.shakeAmt;
            this.shakeY = (Math.random() - 0.5) * this.shakeAmt;
            this.shakeAmt *= 0.86;
        } else {
            this.shakeAmt = this.shakeX = this.shakeY = 0;
        }
        if (this.flash.t > 0) this.flash.t--;
        if (this.hurtFlash > 0) this.hurtFlash = Math.max(0, this.hurtFlash - 0.03);
    },

    particle(p) {
        if (this.particles.length > 800 && p.kind !== 'ring') return;
        this.particles.push({ drag: 0.92, grow: 0, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 0.4, ...p, max: p.life });
    },

    burst(x, y, color, count, speed) {
        for (let i = 0; i < count; i++) {
            const a = Math.random() * TAU;
            const s = speed * (0.3 + Math.random() * 0.9);
            this.particle({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 22 + Math.random() * 22, size: 2 + Math.random() * 4, color, kind: Math.random() < 0.5 ? 'chunk' : 'spark' });
        }
    },

    spark(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            const a = Math.random() * TAU;
            this.particle({ x, y, vx: Math.cos(a) * 3, vy: Math.sin(a) * 3, life: 10 + Math.random() * 8, size: 2, color, kind: 'spark' });
        }
    },

    ring(x, y, radius, color, life) {
        this.particle({ x, y, vx: 0, vy: 0, life, size: radius, color, kind: 'ring', drag: 1 });
    },

    floater(x, y, text, color, size, small = false) {
        // damage numbers make way first, so level messages are never pushed out
        if (this.floaters.length > 90) {
            const i = this.floaters.findIndex(f => f.small);
            this.floaters.splice(i >= 0 ? i : 0, 1);
        }
        const margin = Math.min(this.W / 2, text.length * size * 0.3 + 6);
        this.floaters.push({ x: U.clamp(x, margin, this.W - margin), y: U.clamp(y, size, this.H - size), text, color, size, life: small ? 34 : 50, max: small ? 34 : 50, small });
    },

    updateParticles() {
        for (const p of this.particles) {
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= p.drag;
            p.vy *= p.drag;
            p.rot += p.vr;
            p.size = Math.max(0, p.size + p.grow);
            p.life--;
        }
        this.particles = this.particles.filter(p => p.life > 0);
        for (const f of this.floaters) {
            f.y -= 0.8 * (f.life / f.max) + 0.2;
            f.life--;
        }
        this.floaters = this.floaters.filter(f => f.life > 0);
        for (const e of this.explosions) e.t++;
        this.explosions = this.explosions.filter(e => e.t < e.max);
    },

    render() {
        const ctx = this.ctx;
        const k = this.dpr * this.scale;
        if (this.ctxDirty) {
            // after a failed draw: drop any leftover clip, alpha or saved states
            this.ctxDirty = false;
            if (ctx.reset) ctx.reset();
            else this.canvas.width = this.canvas.width; // eslint-disable-line no-self-assign
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.drawBackground(ctx);
        ctx.setTransform(k, 0, 0, k, 0, 0);
        ctx.translate(this.shakeX, this.shakeY);

        if (this.state === 'menu') {
            this.attract.forEach(m => this.drawMonster(ctx, m));
            return;
        }

        this.drawDecals(ctx);
        this.drawEdgeWarnings(ctx);
        this.coinDrops.forEach(c => this.drawCoin(ctx, c));
        this.powerups.forEach(pu => this.drawPowerup(ctx, pu));
        this.explosions.forEach(e => this.drawExplosion(ctx, e));
        this.drawHazards(ctx);
        this.grenades.forEach(g => this.drawGrenade(ctx, g));
        this.monsters.forEach(m => { if (!m.hidden && !m.gk && !m.boss) this.drawShadow(ctx, m.x, m.y + m.size * 0.85, m.size); });
        this.monsters.forEach(m => {
            if (m.hidden) return;
            // one monster failing to draw must not take the rest (and the hero) with it
            this.guardDraw(ctx, () => {
                if (m.boss) this.drawBoss(ctx, m);
                else if (m.gk) this.drawGatekeeper(ctx, m);
                else this.drawMonster(ctx, m);
            });
        });
        this.monsters.forEach(m => { if (m.boss && m.bubble) this.drawBubble(ctx, m); });
        const alive = this.state !== 'dying' && this.state !== 'gameover';
        this.drawKickWaves(ctx);
        if (alive) this.guardDraw(ctx, () => this.drawPets(ctx));
        if (alive) this.guardDraw(ctx, () => this.drawPlayer(ctx));
        if (alive) this.drawStormCloud(ctx);
        if (alive) this.drawCleaves(ctx);
        this.drawProjectiles(ctx);
        this.drawLightning(ctx);
        this.drawParticles(ctx);
        this.drawSackFlights(ctx);
        this.drawFloaters(ctx);
        this.drawScreenFx(ctx);
        this.drawStick(ctx);
    },


    /** Throws away every cached drawing (they are rebuilt on demand). After the tab was in the
     *  background the browser may have wiped offscreen canvases, which then draw as nothing. */
    dropArtCaches() {
        if (this.tiles) {
            this.tiles.forEach(t => freeCanvas(t.cv));
            this.tiles.clear();
        }
        freeCanvas(this.vignette);
        this.vignette = undefined;
        if (this.mobCache) this.mobCache.forEach(freeCanvas);
        this.mobCache = null;
        this.mobCacheK = null;
        if (this.spriteCache) this.spriteCache.forEach(freeCanvas);
        this.spriteCache = null;
        MobSprites.dropTints();
        BossSprites.dropTints();
        this.ctxDirty = true;
    },

    /** Runs a draw call; on an error restores the canvas state, reports it once and carries on. */
    guardDraw(ctx, fn) {
        ctx.save();
        try {
            fn();
        } catch (e) {
            this.ctxDirty = true; // a save() inside may never have been restored: reset before the next frame
            if (!this.drawErrors) this.drawErrors = new Set();
            if (!this.drawErrors.has(String(e))) {
                this.drawErrors.add(String(e));
                console.error('draw failed', e);
            }
        }
        ctx.restore();
    },

    drawShadow(ctx, x, y, size) {
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.beginPath();
        ctx.ellipse(x, y, size * 0.9, size * 0.35, 0, 0, TAU);
        ctx.fill();
    },

    drawEdgeWarnings(ctx) {
        if (!this.edgeWarn) return;
        const a = 0.35 * Math.abs(Math.sin(this.frameNo * 0.25));
        const g = { 0: [0, 0, this.W, 10], 1: [this.W - 10, 0, 10, this.H], 2: [0, this.H - 10, this.W, 10], 3: [0, 0, 10, this.H] }[this.edgeWarn.side];
        ctx.fillStyle = `rgba(255,80,80,${a})`;
        ctx.fillRect(...g);
    },

    drawCoin(ctx, c) {
        if (c.y > this.H - STICKY_STRIP && Math.floor(c.t / 6) % 2 === 0) return; // last chance: blink
        if (c.egg) {
            this.drawEggAt(ctx, c.x, c.y - c.z, 1.2, c.t, c.y, '#fb923c');
            return;
        }
        if (c.gem) {
            this.drawGem(ctx, c.x, c.y - c.z, 8, c.t, c.y);
            return;
        }
        if (c.value > 1) {
            this.drawPouch(ctx, c);
            return;
        }
        const r = 5;
        const sx = Math.max(0.2, Math.abs(Math.cos(c.spin)));
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.ellipse(c.x, c.y + r * 0.6, r * 0.9, r * 0.35, 0, 0, TAU);
        ctx.fill();
        const y = c.y - c.z;
        ctx.fillStyle = c.value >= 5 ? '#ffb300' : '#ffd60a';
        ctx.strokeStyle = '#a66a00';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(c.x, y, r * sx, r, 0, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath();
        ctx.ellipse(c.x - r * 0.3 * sx, y - r * 0.3, r * 0.3 * sx, r * 0.3, 0, 0, TAU);
        ctx.fill();
    },

    drawKickWaves(ctx) {
        for (const w of this.kickWaves || []) {
            const k = w.r / w.max;
            ctx.strokeStyle = `rgba(226,232,240,${0.7 * (1 - k)})`;
            ctx.lineWidth = 6 * (1 - k) + 1;
            ctx.beginPath();
            ctx.ellipse(w.x, w.y, w.r, w.r * 0.85, 0, 0, TAU);
            ctx.stroke();
        }
    },

    /** A little storm cloud over the hero while Storm is active (flickers before a strike). */
    drawStormCloud(ctx) {
        if (!(this.timers.storm > 0)) return;
        const p = this.player;
        const x = p.x + Math.sin(this.frameNo * 0.05) * 4;
        const y = p.y - 52;
        const charge = this.stormClock < 10;
        ctx.save();
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = charge ? '#cbd5e1' : '#94a3b8';
        for (const [dx, dy, r] of [[-10, 2, 8], [0, -3, 10], [11, 1, 8], [4, 5, 7], [-4, 5, 7]]) {
            ctx.beginPath();
            ctx.arc(x + dx, y + dy, r, 0, TAU);
            ctx.fill();
        }
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.arc(x - 3, y - 6, 5, 0, TAU);
        ctx.fill();
        if (charge || this.frameNo % 40 < 3) {
            ctx.strokeStyle = '#fde047';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x + 2, y + 9);
            ctx.lineTo(x - 2, y + 15);
            ctx.lineTo(x + 3, y + 15);
            ctx.lineTo(x - 1, y + 22);
            ctx.stroke();
        }
        ctx.restore();
    },

    /** A speckled pet egg with a soft glow (boss eggs glow orange). */
    drawEggAt(ctx, x, y, s, t = 0, groundY = null, glowColor = '#fde68a') {
        if (groundY !== null) this.drawShadow(ctx, x, groundY + 9 * s, 7 * s);
        const wob = Math.sin(t * 0.15) * 0.12;
        const glow = ctx.createRadialGradient(x, y, 2, x, y, 22 * s);
        glow.addColorStop(0, `${glowColor}aa`);
        glow.addColorStop(1, `${glowColor}00`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, 22 * s, 0, TAU);
        ctx.fill();
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(wob);
        ctx.scale(s, s);
        ctx.fillStyle = '#fef3c7';
        ctx.strokeStyle = '#92400e';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(0, 0, 7.5, 10, 0, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = glowColor;
        for (const [sx, sy, r] of [[-3, -4, 1.8], [3, -1, 2.2], [-2, 4, 1.6], [3.5, 5, 1.2], [0, -7, 1.2]]) {
            ctx.beginPath();
            ctx.arc(sx, sy, r, 0, TAU);
            ctx.fill();
        }
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath();
        ctx.ellipse(-3, -5, 1.6, 2.6, -0.4, 0, TAU);
        ctx.fill();
        ctx.restore();
    },

    /** A flat gold coin icon (HUD floaters, the Coins ×2/×3 pickups). */
    drawCoinAt(ctx, x, y, r) {
        ctx.fillStyle = '#ffd60a';
        ctx.strokeStyle = '#a66a00';
        ctx.lineWidth = Math.max(1, r * 0.18);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = '#e0a800';
        ctx.lineWidth = Math.max(0.8, r * 0.13);
        ctx.beginPath();
        ctx.arc(x, y, r * 0.65, 0, TAU);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,247,194,0.85)';
        ctx.beginPath();
        ctx.ellipse(x - r * 0.35, y - r * 0.4, r * 0.26, r * 0.17, 0, 0, TAU);
        ctx.fill();
    },

    /** A little coin pouch: brown sack, gold tie, its value on the front. */
    drawPouch(ctx, c) {
        const s = c.value >= 5 ? 1.25 : c.value >= 3 ? 1.1 : 1;
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.beginPath();
        ctx.ellipse(c.x, c.y + 6 * s, 7 * s, 2.6 * s, 0, 0, TAU);
        ctx.fill();
        this.drawPouchAt(ctx, c.x, c.y - c.z, s, String(c.value), Math.sin(c.spin) * 0.12);
    },

    /** The pouch itself; `label` is its value, or null for the plain icon (a gold coin on the front). */
    drawPouchAt(ctx, x, y, s, label, wob = 0) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(wob);
        ctx.scale(s, s);
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = '#5b3410';
        // sack body
        ctx.fillStyle = '#b7792f';
        ctx.beginPath();
        ctx.moveTo(-3.5, -4);
        ctx.bezierCurveTo(-9, -2, -9, 7, 0, 7);
        ctx.bezierCurveTo(9, 7, 9, -2, 3.5, -4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // ruffled top
        ctx.fillStyle = '#c98a3c';
        ctx.beginPath();
        ctx.moveTo(-3.5, -4);
        ctx.lineTo(-5.5, -8.5);
        ctx.lineTo(-2, -6.5);
        ctx.lineTo(0, -9);
        ctx.lineTo(2, -6.5);
        ctx.lineTo(5.5, -8.5);
        ctx.lineTo(3.5, -4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // gold tie
        ctx.strokeStyle = '#ffd60a';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(-3.8, -4);
        ctx.lineTo(3.8, -4);
        ctx.stroke();
        if (label) {
            ctx.font = `bold 9px ${DISPLAY_FONT}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.lineWidth = 2.5;
            ctx.strokeStyle = '#5b3410';
            ctx.strokeText(label, 0, 2);
            ctx.fillStyle = '#ffe066';
            ctx.fillText(label, 0, 2);
        } else {
            ctx.fillStyle = '#ffd60a';
            ctx.strokeStyle = '#a66a00';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.arc(0, 2, 2.5, 0, TAU);
            ctx.fill();
            ctx.stroke();
        }
        ctx.restore();
    },

    /** A faceted blue diamond with a soft glow and a twinkle. */
    drawGem(ctx, x, y, r, t = 0, groundY = y, shadow = true) {
        if (shadow) {
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.beginPath();
            ctx.ellipse(x, groundY + r * 0.9, r * 0.8, r * 0.3, 0, 0, TAU);
            ctx.fill();
        }
        const glow = ctx.createRadialGradient(x, y, 1, x, y, r * 2.6);
        glow.addColorStop(0, 'rgba(125,211,252,0.55)');
        glow.addColorStop(1, 'rgba(125,211,252,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, r * 2.6, 0, TAU);
        ctx.fill();
        const top = y - r * 0.55;
        ctx.lineJoin = 'round';
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = '#0c4a6e';
        // crown and pavilion
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.moveTo(x - r, top);
        ctx.lineTo(x - r * 0.5, y - r);
        ctx.lineTo(x + r * 0.5, y - r);
        ctx.lineTo(x + r, top);
        ctx.lineTo(x, y + r * 1.1);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#bae6fd';
        ctx.beginPath();
        ctx.moveTo(x - r * 0.5, y - r);
        ctx.lineTo(x + r * 0.5, y - r);
        ctx.lineTo(x + r * 0.3, top);
        ctx.lineTo(x - r * 0.3, top);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#0284c7';
        ctx.beginPath();
        ctx.moveTo(x + r * 0.3, top);
        ctx.lineTo(x + r, top);
        ctx.lineTo(x, y + r * 1.1);
        ctx.closePath();
        ctx.fill();
        const tw = Math.max(0, Math.sin(t * 0.12));
        if (tw > 0.6) {
            ctx.strokeStyle = `rgba(255,255,255,${(tw - 0.6) * 2.5})`;
            ctx.lineWidth = 1.5;
            const sx = x - r * 0.45;
            const sy = y - r * 0.75;
            ctx.beginPath();
            ctx.moveTo(sx - 4, sy); ctx.lineTo(sx + 4, sy);
            ctx.moveTo(sx, sy - 4); ctx.lineTo(sx, sy + 4);
            ctx.stroke();
        }
    },

    drawPowerup(ctx, pu) {
        const def = POWERUPS[pu.type];
        if ((pu.life < 180 || pu.y > this.H - STICKY_STRIP) && Math.floor(pu.t / 8) % 2 === 0) return;
        const bob = Math.sin(pu.t * 0.08) * 3 - (pu.z || 0);
        const pulse = 1 + Math.sin(pu.t * 0.15) * 0.1;
        this.drawShadow(ctx, pu.x, pu.y + 14, 10);
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = def.color;
        ctx.beginPath();
        ctx.arc(pu.x, pu.y + bob, 17 * pulse, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();
        if (def.pouch) {
            this.drawCoinAt(ctx, pu.x, pu.y + bob, 9);
        } else {
            ctx.font = `22px ${EMOJI_FONT}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#000';
            ctx.fillText(def.emoji, pu.x, pu.y + bob + 1);
        }
        if (def.tag) {
            ctx.font = `15px ${DISPLAY_FONT}`;
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#000';
            ctx.strokeText(def.tag, pu.x + 10, pu.y + bob + 9);
            ctx.fillStyle = '#fff';
            ctx.fillText(def.tag, pu.x + 10, pu.y + bob + 9);
        }
    },

    drawExplosion(ctx, e) {
        const t = e.t / e.max;
        const r = e.r * (0.4 + 0.6 * Math.sqrt(t));
        ctx.save();
        ctx.translate(e.x, e.y);
        for (let layer = 0; layer < 3; layer++) {
            const lr = r * (1 - layer * 0.22);
            ctx.fillStyle = `rgba(255,${80 + layer * 70},${layer * 30},${(1 - t) * (0.75 - layer * 0.15)})`;
            ctx.beginPath();
            for (let i = 0; i < 16; i++) {
                const a = (i * Math.PI) / 8 + layer * 0.2;
                const rr = i % 2 === 0 ? lr : lr * 0.55;
                ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
            }
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
    },

    drawGrenade(ctx, g) {
        this.drawShadow(ctx, g.x, g.y + 6, Math.max(2.5, 5 - (g.z || 0) * 0.05));
        ctx.save();
        ctx.translate(g.x, g.y - (g.z || 0));
        ctx.rotate(g.spin);
        ctx.fillStyle = '#2d6a4f';
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#95d5b2';
        ctx.fillRect(-2, -8, 4, 4);
        ctx.restore();
        if (g.rain) {
            // falling from the sky: a target mark where it will land
            ctx.strokeStyle = `rgba(255,80,60,${0.35 + 0.3 * Math.sin(g.z * 0.1)})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(g.x, g.y, Math.max(6, g.radius * (1 - g.z / 420)), 0, TAU);
            ctx.stroke();
            return;
        }
        const urgent = g.timer < 24;
        ctx.strokeStyle = urgent ? (Math.floor(g.timer / 3) % 2 ? '#ff3b30' : '#fff') : '#ffd60a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(g.x, g.y - (g.z || 0), 9, -Math.PI / 2, -Math.PI / 2 + TAU * (g.timer / (g.fuse || 64)));
        ctx.stroke();
    },

    drawMonster(ctx, m) {
        if (m.family) return this.drawFamilyMob(ctx, m);
        const squash = 1 + Math.sin(m.phase) * 0.06;
        const fill = m.flash > 0 ? '#ffffff' : m.color;
        ctx.save();
        ctx.translate(m.x, m.y);
        ctx.scale(1 / squash, squash);
        if (m.shape === 'aura') {
            const pulse = 1.35 + Math.sin(m.phase * 0.7) * 0.15;
            ctx.globalAlpha = 0.25;
            ctx.fillStyle = m.color;
            ctx.beginPath();
            ctx.arc(0, 0, m.size * pulse, 0, TAU);
            ctx.fill();
            ctx.globalAlpha = 0.9;
            ctx.strokeStyle = m.color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, m.size * 1.5, 0, TAU);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
        Game.drawShape(ctx, m.shape, m.size, fill);
        if (m.poison > 0) {
            ctx.globalAlpha = 0.45;
            ctx.fillStyle = '#84cc16';
            ctx.beginPath();
            ctx.arc(0, 0, m.size, 0, TAU);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        if (m.stun > 0) {
            ctx.fillStyle = '#fde047';
            for (let i = 0; i < 3; i++) {
                const a = this.frameNo * 0.15 + (i * TAU) / 3;
                ctx.beginPath();
                ctx.arc(Math.cos(a) * m.size * 0.9, -m.size - 4 + Math.sin(a) * 3, 2.5, 0, TAU);
                ctx.fill();
            }
        }
        if (this.timers && (m.iced || this.mobSpeedMult < 1) && !m.boss) {
            ctx.globalAlpha = 0.35;
            ctx.fillStyle = '#bfefff';
            ctx.beginPath();
            ctx.arc(0, 0, m.size, 0, TAU);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        this.drawEyes(ctx, m, m.size);
        ctx.restore();

        if (m.hp < m.maxHp && !m.dead) {
            const w = Math.min(m.size * 2.4, 6 * m.maxHp + 8);
            const y = m.y - m.size * 1.25 - 8;
            const pct = U.clamp(m.hp / m.maxHp, 0, 1);
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(m.x - w / 2 - 1, y - 1, w + 2, 6);
            ctx.fillStyle = pct > 0.5 ? '#4cd964' : pct > 0.25 ? '#ffcc00' : '#ff3b30';
            ctx.fillRect(m.x - w / 2, y, w * pct, 4);
        }
    },

    drawFamilyMob(ctx, m) {
        if (m.spawnT > 0) ctx.globalAlpha = 0.6; // just arrived: harmless for a moment
        this.drawMob(ctx, m);
        ctx.globalAlpha = 1;
        const tint = (color, a) => {
            if (this.tintMob(ctx, m, color, a + 0.1)) return;
            ctx.globalAlpha = a;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.ellipse(m.x, m.y, m.size * 0.9, m.size * 1.05, 0, 0, TAU);
            ctx.fill();
            ctx.globalAlpha = 1;
        };
        if (m.poison > 0) tint('#84cc16', 0.3);
        if (this.timers && (m.iced || this.mobSpeedMult < 1)) tint('#bfefff', 0.3);
        const top = this.mobTop(m);
        if (m.stun > 0) {
            ctx.fillStyle = '#fde047';
            for (let i = 0; i < 3; i++) {
                const a = this.frameNo * 0.15 + (i * TAU) / 3;
                ctx.beginPath();
                ctx.arc(m.x + Math.cos(a) * m.size * 0.9, top + 2 + Math.sin(a) * 3, 2.5, 0, TAU);
                ctx.fill();
            }
        }
        if (m.hp < m.maxHp && !m.dead) {
            const w = Math.min(m.size * 2.4, 6 * m.maxHp + 8);
            const y = top - 8;
            const pct = U.clamp(m.hp / m.maxHp, 0, 1);
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(m.x - w / 2 - 1, y - 1, w + 2, 6);
            ctx.fillStyle = pct > 0.5 ? '#4cd964' : pct > 0.25 ? '#ffcc00' : '#ff3b30';
            ctx.fillRect(m.x - w / 2, y, w * pct, 4);
        }
    },

    drawEyes(ctx, m, size) {
        const big = size > 16;
        const eyeSize = big ? Math.min(6, size * 0.2) : Math.max(2.5, size * 0.3);
        const off = big ? size * 0.38 : size * 0.45;
        const ey = -off * 0.7;
        if (m.spawnT > 0 && !m.boss) {
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-off - eyeSize, ey);
            ctx.lineTo(-off + eyeSize, ey);
            ctx.moveTo(off - eyeSize, ey);
            ctx.lineTo(off + eyeSize, ey);
            ctx.stroke();
            return;
        }
        const look = this.player && this.state !== 'menu'
            ? U.normalizeVector(this.player.x - m.x, this.player.y - m.y)
            : { x: Math.cos(m.dir || 0), y: Math.sin(m.dir || 0) };
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(-off, ey, eyeSize, 0, TAU);
        ctx.arc(off, ey, eyeSize, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(-off + look.x * eyeSize * 0.4, ey + look.y * eyeSize * 0.4, eyeSize * 0.55, 0, TAU);
        ctx.arc(off + look.x * eyeSize * 0.4, ey + look.y * eyeSize * 0.4, eyeSize * 0.55, 0, TAU);
        ctx.fill();
    },

    drawBoss(ctx, b) {
        if (b.boss.big) {
            this.drawBigBoss(ctx, b);
            return;
        }
        const def = b.boss;
        const fill = b.flash > 0 ? '#ffffff' : def.color;
        const s = b.size;
        const q = b.dying ? b.deathT / b.deathMax : 0;
        ctx.save();
        ctx.translate(b.x, b.y);
        if (b.dying) {
            const j = 1.5 + 6 * q;
            ctx.translate((Math.random() - 0.5) * j, (Math.random() - 0.5) * j);
            ctx.scale(1 - 0.35 * q, 1 - 0.35 * q);
        }
        if (b.mode === 'windup') {
            ctx.translate((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3);
            ctx.save();
            ctx.globalAlpha = 0.25 + 0.25 * Math.sin(b.modeT * 0.6);
            ctx.strokeStyle = '#ff3b30';
            ctx.lineWidth = s * 1.4;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(b.dashX * 340, b.dashY * 340);
            ctx.stroke();
            ctx.restore();
        }
        // Menacing aura
        ctx.globalAlpha = 0.22 + (b.enraged ? 0.15 * Math.sin(b.t * 0.3) : 0);
        ctx.fillStyle = b.enraged ? '#ff3b30' : def.accent;
        ctx.beginPath();
        ctx.arc(0, 0, s * 1.45, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.lineWidth = 3;

        // v3.8: the small bosses are characters (js/bossart.js); their orbs and void rings stay around them
        if (def.pattern === 'rings') {
            ctx.fillStyle = def.accent;
            for (let i = 0; i < 5; i++) {
                const a = (i * TAU) / 5 - b.t * 0.04;
                ctx.beginPath();
                ctx.arc(Math.cos(a) * (s + 22), Math.sin(a) * (s + 22) * 0.8, 5, 0, TAU);
                ctx.fill();
            }
        } else if (def.pattern === 'chaos') {
            for (let i = 0; i < 3; i++) {
                ctx.strokeStyle = `rgba(231,76,60,${0.6 - i * 0.15})`;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(0, 0, s + 12 + i * 7, b.t * 0.05 * (i + 1), b.t * 0.05 * (i + 1) + Math.PI * 1.2);
                ctx.stroke();
            }
        }
        if (!this.drawBossArt(ctx, b, def.voice)) Game.drawShape(ctx, 'circle', s, fill);

        if (b.dying) {
            // Darkening body (a sprite darkens itself), glowing cracks spreading
            if (!BossSprites.get(def.voice)) {
                ctx.globalAlpha = 0.6 * q;
                ctx.fillStyle = '#140800';
                ctx.beginPath();
                ctx.arc(0, 0, s * 1.02, 0, TAU);
                ctx.fill();
                ctx.globalAlpha = 1;
            }
            ctx.lineCap = 'round';
            for (const c of b.cracks || []) {
                const len = s * c.len * Math.min(1, q * 1.6);
                ctx.strokeStyle = `rgba(255,${Math.round(150 + 80 * q)},60,${0.5 + 0.5 * q})`;
                ctx.lineWidth = 2 + 2 * q;
                ctx.beginPath();
                ctx.moveTo(Math.cos(c.a) * s * 0.15, Math.sin(c.a) * s * 0.15);
                ctx.quadraticCurveTo(Math.cos(c.a + c.bend) * len * 0.6, Math.sin(c.a + c.bend) * len * 0.6, Math.cos(c.a) * len, Math.sin(c.a) * len);
                ctx.stroke();
            }
            ctx.lineCap = 'butt';
            ctx.restore();
            return;
        }

        ctx.restore();
    },


    drawPlayer(ctx) {
        const p = this.player;
        // blinking = can't be hurt (after a hit, and for the whole Invincible powerup)
        const giant = this.timers.invincible > 0;
        if (p.iframes > 0 && Math.floor(p.iframes / 5) % 2 === 0) return;
        if (giant && p.iframes <= 0 && Math.floor(this.frameNo / 5) % 2 === 0) return;
        const scale = giant ? 1.6 : 1;
        const feetY = p.y + 14 * scale;
        // v3.11.1: a soft pool of light under the hero (monsters get none) so it's easy to find
        const pool = ctx.createRadialGradient(p.x, feetY, 2, p.x, feetY, 30 * scale);
        pool.addColorStop(0, 'rgba(255,251,235,0.7)');
        pool.addColorStop(1, 'rgba(255,251,235,0)');
        ctx.fillStyle = pool;
        ctx.beginPath();
        ctx.ellipse(p.x, feetY, 30 * scale, 12 * scale, 0, 0, TAU);
        ctx.fill();
        this.drawShadow(ctx, p.x, feetY, 12 * scale);
        if (this.timers.freeze > 0) {
            // the ice cloud you carry around: monsters inside move slowly
            const r = this.iceRadius;
            const wob = Math.sin(this.frameNo * 0.04 + 1) * 4;
            const g = ctx.createRadialGradient(p.x, p.y, 8, p.x, p.y, r + wob);
            g.addColorStop(0, 'rgba(224,242,254,0.06)');
            g.addColorStop(0.7, 'rgba(125,211,252,0.22)');
            g.addColorStop(1, 'rgba(56,189,248,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, r + wob, (r + wob) * 0.85, 0, 0, TAU);
            ctx.fill();
            if (this.frameNo % 3 === 0) {
                const a = Math.random() * TAU;
                const rr = Math.random() * r;
                this.particle({ x: p.x + Math.cos(a) * rr, y: p.y + Math.sin(a) * rr * 0.8, vx: 0, vy: 0.2, life: 30, size: 1.6, color: '#e0f2fe', kind: 'spark' });
            }
        }
        if (this.timers.poison > 0) {
            // the poison cloud you carry around
            const r = POISON_RADIUS;
            const wob = Math.sin(this.frameNo * 0.05) * 4;
            const g = ctx.createRadialGradient(p.x, p.y, 8, p.x, p.y, r + wob);
            g.addColorStop(0, 'rgba(163,230,53,0.05)');
            g.addColorStop(0.7, 'rgba(132,204,22,0.2)');
            g.addColorStop(1, 'rgba(101,163,13,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, r + wob, (r + wob) * 0.85, 0, 0, TAU);
            ctx.fill();
        }
        const fx = this.skinExtras();
        if (fx.aura) {
            // mythic skins glow
            const pulse = 0.5 + 0.5 * Math.sin(this.frameNo * 0.08);
            const g = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, 34 * scale);
            g.addColorStop(0, `${fx.aura}88`);
            g.addColorStop(1, `${fx.aura}00`);
            ctx.globalAlpha = 0.5 + 0.3 * pulse;
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 34 * scale, 0, TAU);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        if (this.whirl > 0) {
            this.drawWhirlwind(ctx);
            return;
        }
        // v3.13: the vector rig picks its own pose (walk, cast/throw/swing, supers; js/sprites.js).
        // While swinging, the barbarian's axe is drawn separately along the arc (drawCleaves).
        this.drawHero(ctx, p.x, feetY, scale);
        if (this.superShielded && !(this.whirl > 0)) {
            // super running: a shimmering shield bubble (nothing can hurt you)
            const a = this.frameNo * 0.12;
            const r = 30 * scale + Math.sin(a) * 1.5;
            const col = CLASSES[this.cls].color;
            const fade = Math.min(1, this.superGuard / 30);
            ctx.save();
            ctx.globalAlpha = fade * 0.18;
            ctx.fillStyle = col;
            ctx.beginPath();
            ctx.arc(p.x, p.y - 4, r, 0, TAU);
            ctx.fill();
            ctx.globalAlpha = fade * (0.6 + 0.25 * Math.sin(a * 2));
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(p.x, p.y - 4, r, a, a + Math.PI * 1.3);
            ctx.stroke();
            ctx.strokeStyle = col;
            ctx.beginPath();
            ctx.arc(p.x, p.y - 4, r - 3, -a * 1.3, -a * 1.3 + Math.PI);
            ctx.stroke();
            ctx.restore();
        }
        if (this.superMeter >= 100) {
            // a little crackle around the hero when the super is ready
            const a = this.frameNo * 0.2;
            ctx.strokeStyle = `rgba(250,204,21,${0.5 + 0.3 * Math.sin(a * 2)})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(p.x, feetY - 1, 16 * scale, 5 * scale, 0, a, a + Math.PI * 1.2);
            ctx.stroke();
        }
        if (this.mouse.down && this.cls !== 'barbarian') {
            ctx.strokeStyle = 'rgba(255,255,255,0.6)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(this.mouse.x, this.mouse.y, 8, 0, TAU);
            ctx.moveTo(this.mouse.x - 12, this.mouse.y);
            ctx.lineTo(this.mouse.x + 12, this.mouse.y);
            ctx.moveTo(this.mouse.x, this.mouse.y - 12);
            ctx.lineTo(this.mouse.x, this.mouse.y + 12);
            ctx.stroke();
        }
    },

    drawCleaves(ctx) {
        const p = this.player;
        const pal = this.palette('barbarian', this.skin);
        for (const c of this.cleaves) {
            if (c.whirl) continue;
            const t = c.t / c.dur;
            const sweep = Math.min(1, c.t / (c.dur * 0.55));
            const a0 = c.angle - c.arc * c.dir;
            const a1 = c.angle + (-c.arc + 2 * c.arc * sweep) * c.dir;
            const fade = 1 - Math.max(0, (t - 0.55) / 0.45);
            // crescent swoosh
            ctx.save();
            ctx.globalAlpha = 0.85 * fade;
            const grad = ctx.createRadialGradient(p.x, p.y, c.reach * 0.35, p.x, p.y, c.reach);
            grad.addColorStop(0, 'rgba(255,255,255,0)');
            grad.addColorStop(0.75, 'rgba(255,237,213,0.55)');
            grad.addColorStop(1, 'rgba(255,255,255,0.95)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(p.x, p.y, c.reach, Math.min(a0, a1), Math.max(a0, a1));
            ctx.arc(p.x, p.y, c.reach * 0.45, Math.max(a0, a1), Math.min(a0, a1), true);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.9)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(p.x, p.y, c.reach, Math.min(a0, a1), Math.max(a0, a1));
            ctx.stroke();
            ctx.restore();
            // the axe itself, riding the leading edge
            if (sweep < 1 || t < 0.8) {
                const hx = p.x + Math.cos(a1) * 10;
                const hy = p.y - 4 + Math.sin(a1) * 10;
                Game.drawAxe(ctx, pal, hx, hy, a1 + Math.PI / 2, Math.min(1.25, this.impactMult * 1.1));
            }
        }
    },

    drawWhirlwind(ctx) {
        const p = this.player;
        const t = this.whirlT;
        const reach = this.cleaveReach;
        const pal = this.palette('barbarian', this.skin);
        const fade = Math.min(1, this.whirl / 30);
        // wind rings
        ctx.save();
        for (let i = 0; i < 3; i++) {
            ctx.globalAlpha = (0.35 - i * 0.1) * fade;
            ctx.strokeStyle = '#ffedd5';
            ctx.lineWidth = 6 - i * 1.5;
            const a = t * (0.35 + i * 0.07);
            ctx.beginPath();
            ctx.arc(p.x, p.y, reach * (0.55 + i * 0.2), a, a + Math.PI * 1.3);
            ctx.stroke();
        }
        ctx.restore();
        // spinning hero (squashed as it turns, for a blur feel), arms out to the two axes
        const spin = t * 0.45;
        const face = Math.cos(spin) >= 0 ? 1 : -1;
        this.drawHero(ctx, p.x, p.y + 14, 1, { face, sx: Math.max(0.35, Math.abs(Math.cos(spin))), act: { kind: 'spin' } });
        for (const off of [0, Math.PI]) {
            const a = spin + off;
            Game.drawAxe(ctx, pal, p.x + Math.cos(a) * 12, p.y - 6 + Math.sin(a) * 12, a + Math.PI / 2, Math.min(1.25, this.impactMult * 1.1));
        }
    },

    drawLightning(ctx) {
        for (const l of this.lightning) {
            if (!l.segs) continue;
            const fade = 1 - l.t / l.max;
            ctx.save();
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            const strokes = [[10, `rgba(56,189,248,${0.15 * fade})`], [4, `rgba(125,211,252,${0.5 * fade})`], [1.5, `rgba(255,255,255,${fade})`]];
            for (const [w, color] of strokes) {
                ctx.strokeStyle = color;
                ctx.lineWidth = w;
                ctx.beginPath();
                for (const seg of l.segs) {
                    seg.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
                }
                ctx.stroke();
            }
            ctx.restore();
        }
    },

    drawDecals(ctx) {
        for (const d of this.decals) {
            const a = Math.min(1, d.life / 120) * 0.45;
            ctx.save();
            ctx.translate(d.x, d.y);
            ctx.rotate(d.rot);
            if (d.kind === 'crack') {
                ctx.strokeStyle = `rgba(30,20,10,${a * 1.4})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                for (let i = 0; i < 5; i++) {
                    const ang = (i / 5) * TAU;
                    ctx.moveTo(0, 0);
                    ctx.lineTo(Math.cos(ang) * d.r * 0.5, Math.sin(ang) * d.r * 0.5 + 3);
                    ctx.lineTo(Math.cos(ang + 0.2) * d.r, Math.sin(ang + 0.2) * d.r);
                }
                ctx.stroke();
            } else {
                const g = ctx.createRadialGradient(0, 0, 0, 0, 0, d.r);
                g.addColorStop(0, `rgba(20,14,10,${a})`);
                g.addColorStop(0.6, `rgba(40,28,18,${a * 0.6})`);
                g.addColorStop(1, 'rgba(40,28,18,0)');
                ctx.fillStyle = g;
                ctx.scale(1, 0.6);
                ctx.beginPath();
                ctx.arc(0, 0, d.r, 0, TAU);
                ctx.fill();
            }
            ctx.restore();
        }
    },

    drawProjectiles(ctx) {
        // Magic bolts: glowing violet orbs with a fading trail (big super bolts are pink).
        ctx.lineCap = 'round';
        for (const b of this.bullets) {
            const core = b.big ? '#fdf4ff' : '#f5f3ff';
            const glow = b.big ? '236,72,153' : '139,92,246';
            for (let i = 0; i < b.trail.length; i += 2) {
                const k = (i + 2) / (b.trail.length + 2);
                ctx.fillStyle = `rgba(${glow},${0.35 * k})`;
                ctx.beginPath();
                ctx.arc(b.trail[i], b.trail[i + 1], b.r * (0.4 + 0.6 * k), 0, TAU);
                ctx.fill();
            }
            ctx.fillStyle = `rgba(${glow},0.35)`;
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r * 1.9, 0, TAU);
            ctx.fill();
            ctx.fillStyle = `rgb(${glow})`;
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r, 0, TAU);
            ctx.fill();
            ctx.fillStyle = core;
            ctx.beginPath();
            ctx.arc(b.x - b.r * 0.2, b.y - b.r * 0.2, b.r * 0.5, 0, TAU);
            ctx.fill();
        }
        ctx.lineCap = 'butt';

        // Enemy shots: magenta orbs by default (never confused with your own violet bolts), plus styles.
        const pulse = 1 + 0.15 * Math.sin(this.frameNo * 0.3);
        for (const s of this.enemyShots) {
            if (s.style === 'arrow') {
                ctx.save();
                ctx.translate(s.x, s.y);
                ctx.rotate(Math.atan2(s.vy, s.vx));
                ctx.strokeStyle = '#78350f';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.moveTo(-12, 0);
                ctx.lineTo(6, 0);
                ctx.stroke();
                ctx.fillStyle = '#e5e7eb';
                ctx.beginPath();
                ctx.moveTo(10, 0);
                ctx.lineTo(3, -4);
                ctx.lineTo(3, 4);
                ctx.fill();
                ctx.fillStyle = '#ef4444';
                ctx.fillRect(-13, -3, 5, 6);
                ctx.restore();
                continue;
            }
            const col = { fire: ['255,120,20', '#fde047', '#7c2d12'], acid: ['132,204,22', '#d9f99d', '#1a2e05'], spark: ['56,189,248', '#e0f2fe', '#0c4a6e'], skull: ['167,139,250', '#ede9fe', '#2e1065'] }[s.style] || ['255,45,120', '#ffd1e3', '#2a0014'];
            ctx.fillStyle = `rgba(${col[0]},0.3)`;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r * 1.9 * pulse, 0, TAU);
            ctx.fill();
            ctx.fillStyle = `rgb(${col[0]})`;
            ctx.strokeStyle = col[1];
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, TAU);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = col[2];
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r * 0.45, 0, TAU);
            ctx.fill();
        }
    },

    drawParticles(ctx) {
        for (const p of this.particles) {
            const t = p.life / p.max;
            ctx.globalAlpha = Math.min(1, t * 1.5);
            if (p.kind === 'ring') {
                ctx.strokeStyle = p.color;
                ctx.lineWidth = 3 * t + 1;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * (1 - t * t), 0, TAU);
                ctx.stroke();
            } else if (p.kind === 'chunk') {
                ctx.fillStyle = p.color;
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rot);
                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
                ctx.restore();
            } else if (p.kind === 'flash') {
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * t, 0, TAU);
                ctx.fill();
            } else {
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * (p.kind === 'spark' ? t : 1), 0, TAU);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1;
    },

    drawFloaters(ctx) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        for (const f of this.floaters) {
            const t = f.life / f.max;
            const pop = t > 0.85 ? 1 + (t - 0.85) * 3 : 1;
            ctx.globalAlpha = Math.min(1, t * 2.5);
            ctx.font = `${Math.round(f.size * pop)}px ${DISPLAY_FONT}`;
            ctx.strokeStyle = 'rgba(0,0,0,0.75)';
            ctx.lineWidth = 4;
            const icon = f.text.includes('🪙') ? 'coin' : f.text.includes('💎') ? 'gem' : null;
            if (icon) {
                // coins and gems read as the drawn icons, placed right after the text
                const txt = f.text.replace(/\s*(🪙|💎)\s*/g, ' ').trim();
                const fs = Math.round(f.size * pop);
                const w = txt ? ctx.measureText(txt).width : 0;
                const x0 = f.x - (fs * 0.9) / 2;
                if (txt) {
                    ctx.strokeText(txt, x0, f.y);
                    ctx.fillStyle = f.color;
                    ctx.fillText(txt, x0, f.y);
                }
                const ix = txt ? x0 + w / 2 + fs * 0.55 : f.x;
                if (icon === 'coin') this.drawCoinAt(ctx, ix, f.y, fs * 0.36);
                else this.drawGem(ctx, ix, f.y, fs * 0.36, this.frameNo, f.y, false);
                ctx.font = `${fs}px ${DISPLAY_FONT}`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.lineJoin = 'round';
                ctx.strokeStyle = 'rgba(0,0,0,0.75)';
                ctx.lineWidth = 4;
                continue;
            }
            ctx.strokeText(f.text, f.x, f.y);
            ctx.fillStyle = f.color;
            ctx.fillText(f.text, f.x, f.y);
        }
        ctx.globalAlpha = 1;
    },

    drawScreenFx(ctx) {
        const pad = 40;
        // gold boost (×2 / ×3 pickups, Triple Gold card): the screen edges glow gold
        if (this.goldBoost >= 2) {
            const a = 0.3 + 0.1 * Math.sin(this.frameNo * 0.12) + (this.goldBoost >= 3 ? 0.12 : 0);
            for (const [x0, x1] of [[-pad, 70], [this.W + pad, this.W - 70]]) {
                const g = ctx.createLinearGradient(x0, 0, x1, 0);
                g.addColorStop(0, `rgba(250,204,21,${a})`);
                g.addColorStop(1, 'rgba(250,204,21,0)');
                ctx.fillStyle = g;
                ctx.fillRect(Math.min(x0, x1), -pad, Math.abs(x1 - x0), this.H + pad * 2);
            }
        }
        if (this.flash.t > 0) {
            ctx.fillStyle = `rgba(${this.flash.color},${(this.flash.t / this.flash.max) * 0.35})`;
            ctx.fillRect(-pad, -pad, this.W + pad * 2, this.H + pad * 2);
        }
        const lowHp = this.player.hp === 1 && this.state === 'playing' ? 0.25 + 0.15 * Math.sin(this.frameNo * 0.1) : 0;
        const danger = Math.max(this.hurtFlash, lowHp, this.bossWarning > 0 ? 0.3 + 0.3 * Math.sin(this.frameNo * 0.2) : 0);
        if (danger > 0) {
            const g = ctx.createRadialGradient(this.W / 2, this.H / 2, Math.min(this.W, this.H) * 0.35, this.W / 2, this.H / 2, Math.hypot(this.W, this.H) * 0.55);
            g.addColorStop(0, 'rgba(255,0,0,0)');
            g.addColorStop(1, `rgba(220,0,0,${danger * 0.55})`);
            ctx.fillStyle = g;
            ctx.fillRect(-pad, -pad, this.W + pad * 2, this.H + pad * 2);
        }
    },

    drawStick(ctx) {
        if (this.stick.id === null) return;
        const rect = this.canvas.getBoundingClientRect();
        const ax = (this.stick.ax - rect.left) / this.scale - this.shakeX;
        const ay = (this.stick.ay - rect.top) / this.scale - this.shakeY;
        const r = 55 / this.scale;
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(ax, ay, r, 0, TAU);
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(ax + this.stick.dx * r, ay + this.stick.dy * r, r * 0.4, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
});

Object.assign(Game, {
    /** 0.7 → "0.7", 2 → "2", 13.4 → "13" */
    fmtDmg(d) {
        return d < 10 ? String(Math.round(d * 10) / 10) : String(Math.round(d));
    }
});

Object.assign(Game, {
    drawShape(ctx, shape, size, fill) {
        ctx.fillStyle = fill;
        ctx.strokeStyle = 'rgba(0,0,0,0.75)';
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        const poly = points => {
            ctx.beginPath();
            points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        };
        const circle = (r = size) => {
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, TAU);
            ctx.fill();
            ctx.stroke();
        };
        switch (shape) {
            case 'square':
                ctx.beginPath();
                ctx.roundRect ? ctx.roundRect(-size, -size, size * 2, size * 2, size * 0.3) : ctx.rect(-size, -size, size * 2, size * 2);
                ctx.fill();
                ctx.stroke();
                break;
            case 'triangle':
                poly([[0, -size * 1.1], [-size, size], [size, size]]);
                break;
            case 'diamond':
                poly([[0, -size * 1.15], [size, 0], [0, size * 1.15], [-size, 0]]);
                break;
            case 'star': {
                const pts = [];
                for (let i = 0; i < 10; i++) {
                    const a = (i * Math.PI) / 5 - Math.PI / 2;
                    const r = i % 2 === 0 ? size * 1.15 : size * 0.55;
                    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
                }
                poly(pts);
                break;
            }
            case 'hexagon':
                poly(Array.from({ length: 6 }, (_, i) => [Math.cos((i * Math.PI) / 3) * size, Math.sin((i * Math.PI) / 3) * size]));
                break;
            case 'cross': {
                const h = size * 0.55;
                poly([[-h, -size], [h, -size], [h, -h], [size, -h], [size, h], [h, h], [h, size], [-h, size], [-h, h], [-size, h], [-size, -h], [-h, -h]]);
                break;
            }
            case 'spiky':
                for (let i = 0; i < 8; i++) {
                    const a = (i * TAU) / 8;
                    poly([[Math.cos(a - 0.3) * size, Math.sin(a - 0.3) * size], [Math.cos(a) * (size + 9), Math.sin(a) * (size + 9)], [Math.cos(a + 0.3) * size, Math.sin(a + 0.3) * size]]);
                }
                circle();
                break;
            case 'giant':
                circle();
                ctx.strokeStyle = '#FFD700';
                for (let i = 0; i < 6; i++) {
                    const a = (i * TAU) / 6;
                    ctx.beginPath();
                    ctx.arc(Math.cos(a) * (size + 4), Math.sin(a) * (size + 4), 3, 0, TAU);
                    ctx.stroke();
                }
                break;
            case 'skull':
                circle();
                ctx.fillStyle = '#292524';
                ctx.beginPath();
                ctx.ellipse(-size * 0.38, -size * 0.1, size * 0.26, size * 0.3, 0, 0, TAU);
                ctx.ellipse(size * 0.38, -size * 0.1, size * 0.26, size * 0.3, 0, 0, TAU);
                ctx.fill();
                ctx.fillRect(-size * 0.4, size * 0.45, size * 0.8, size * 0.2);
                break;
            case 'behemoth':
                circle();
                ctx.fillStyle = 'rgba(0,0,0,0.25)';
                for (let i = 0; i < 4; i++) {
                    const a = (i * TAU) / 4 + Math.PI / 4;
                    ctx.beginPath();
                    ctx.arc(Math.cos(a) * size * 0.62, Math.sin(a) * size * 0.62, size * 0.28, 0, TAU);
                    ctx.fill();
                }
                break;
            default:
                circle();
        }
    }
});
