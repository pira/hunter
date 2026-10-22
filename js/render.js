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

    floater(x, y, text, color, size) {
        if (this.floaters.length > 50) this.floaters.shift();
        const margin = Math.min(this.W / 2, text.length * size * 0.3 + 6);
        this.floaters.push({ x: U.clamp(x, margin, this.W - margin), y: U.clamp(y, size, this.H - size), text, color, size, life: 50, max: 50 });
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
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.drawBackground(ctx);
        ctx.setTransform(k, 0, 0, k, 0, 0);
        ctx.translate(this.shakeX, this.shakeY);

        if (this.state === 'menu') {
            this.attract.forEach(m => this.drawMonster(ctx, m));
            return;
        }

        this.drawEdgeWarnings(ctx);
        this.coinDrops.forEach(c => this.drawCoin(ctx, c));
        this.powerups.forEach(pu => this.drawPowerup(ctx, pu));
        this.explosions.forEach(e => this.drawExplosion(ctx, e));
        this.grenades.forEach(g => this.drawGrenade(ctx, g));
        this.monsters.forEach(m => this.drawShadow(ctx, m.x, m.y + m.size * 0.85, m.size));
        this.monsters.forEach(m => (m.boss ? this.drawBoss(ctx, m) : this.drawMonster(ctx, m)));
        if (this.weapon === 'sword' && this.state !== 'dying') this.drawBlades(ctx);
        if (this.state !== 'dying' && this.state !== 'gameover') this.drawPlayer(ctx);
        this.drawProjectiles(ctx);
        this.drawParticles(ctx);
        this.drawFloaters(ctx);
        this.drawScreenFx(ctx);
        this.drawStick(ctx);
    },

    drawBackground(ctx) {
        const key = `${this.canvas.width}x${this.canvas.height}:${this.level}`;
        if (this.bgKey !== key) {
            this.bgKey = key;
            const bg = this.bgCanvas || (this.bgCanvas = document.createElement('canvas'));
            bg.width = this.canvas.width;
            bg.height = this.canvas.height;
            const g = bg.getContext('2d');
            const k = this.dpr * this.scale;
            const hue = ARENA_HUES[(this.level - 1) % ARENA_HUES.length];
            const light = Math.max(32, 64 - (this.level - 1) * 0.9);
            g.fillStyle = `hsl(${hue}, 42%, ${light}%)`;
            g.fillRect(0, 0, bg.width, bg.height);
            const tile = 40 * k;
            g.fillStyle = `hsla(${hue}, 45%, ${light + 4}%, 0.55)`;
            for (let y = 0; y < bg.height; y += tile) {
                for (let x = ((y / tile) % 2) * tile; x < bg.width; x += tile * 2) g.fillRect(x, y, tile, tile);
            }
            const vg = g.createRadialGradient(bg.width / 2, bg.height / 2, Math.min(bg.width, bg.height) * 0.3, bg.width / 2, bg.height / 2, Math.hypot(bg.width, bg.height) * 0.6);
            vg.addColorStop(0, 'rgba(0,0,0,0)');
            vg.addColorStop(1, 'rgba(0,0,0,0.42)');
            g.fillStyle = vg;
            g.fillRect(0, 0, bg.width, bg.height);
        }
        ctx.drawImage(this.bgCanvas, 0, 0);
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
        if (c.life < 180 && Math.floor(c.life / 6) % 2 === 0) return;
        const r = c.value >= 5 ? 7 : 5;
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

    drawPowerup(ctx, pu) {
        const def = POWERUPS[pu.type];
        if (pu.life < 180 && Math.floor(pu.life / 8) % 2 === 0) return;
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
        ctx.font = `22px ${EMOJI_FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#000';
        ctx.fillText(def.emoji, pu.x, pu.y + bob + 1);
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
        this.drawShadow(ctx, g.x, g.y + 6, 5);
        ctx.save();
        ctx.translate(g.x, g.y);
        ctx.rotate(g.spin);
        ctx.fillStyle = '#2d6a4f';
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#95d5b2';
        ctx.fillRect(-2, -8, 4, 4);
        ctx.restore();
        const urgent = g.timer < 24;
        ctx.strokeStyle = urgent ? (Math.floor(g.timer / 3) % 2 ? '#ff3b30' : '#fff') : '#ffd60a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(g.x, g.y, 9, -Math.PI / 2, -Math.PI / 2 + TAU * (g.timer / 64));
        ctx.stroke();
    },

    drawMonster(ctx, m) {
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
        if (this.timers && this.timers.freeze > 0 && !m.boss) {
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

        if (def.pattern === 'charge') {
            ctx.fillStyle = def.accent;
            for (let i = 0; i < 10; i++) {
                const a = (i * TAU) / 10 + b.t * 0.01;
                ctx.beginPath();
                ctx.moveTo(Math.cos(a - 0.22) * s, Math.sin(a - 0.22) * s);
                ctx.lineTo(Math.cos(a) * (s + 14), Math.sin(a) * (s + 14));
                ctx.lineTo(Math.cos(a + 0.22) * s, Math.sin(a + 0.22) * s);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            }
            Game.drawShape(ctx, 'circle', s, fill);
        } else if (def.pattern === 'rings') {
            ctx.save();
            ctx.rotate(b.t * 0.02);
            Game.drawShape(ctx, 'hexagon', s, fill);
            ctx.restore();
            ctx.fillStyle = def.accent;
            for (let i = 0; i < 5; i++) {
                const a = (i * TAU) / 5 - b.t * 0.04;
                ctx.beginPath();
                ctx.arc(Math.cos(a) * (s + 16), Math.sin(a) * (s + 16), 5, 0, TAU);
                ctx.fill();
            }
            // Witch hat
            ctx.fillStyle = '#2c2c54';
            ctx.beginPath();
            ctx.moveTo(-s * 0.8, -s * 0.55);
            ctx.lineTo(s * 0.8, -s * 0.55);
            ctx.lineTo(s * 0.15, -s * 1.7);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        } else if (def.pattern === 'summon') {
            ctx.strokeStyle = '#0b3d20';
            ctx.lineWidth = 4;
            for (let i = 0; i < 8; i++) {
                const a = (i * TAU) / 8 + Math.sin(b.t * 0.15 + i) * 0.15;
                ctx.beginPath();
                ctx.moveTo(Math.cos(a) * s * 0.8, Math.sin(a) * s * 0.8);
                ctx.quadraticCurveTo(Math.cos(a + 0.3) * s * 1.5, Math.sin(a + 0.3) * s * 1.5, Math.cos(a) * s * 1.7, Math.sin(a) * s * 1.7);
                ctx.stroke();
            }
            Game.drawShape(ctx, 'circle', s, fill);
            ctx.fillStyle = def.accent;
            ctx.beginPath();
            ctx.ellipse(0, s * 0.35, s * 0.55, s * 0.3, 0, 0, TAU);
            ctx.fill();
        } else {
            for (let i = 0; i < 3; i++) {
                ctx.strokeStyle = `rgba(231,76,60,${0.6 - i * 0.15})`;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(0, 0, s + 6 + i * 7, b.t * 0.05 * (i + 1), b.t * 0.05 * (i + 1) + Math.PI * 1.2);
                ctx.stroke();
            }
            Game.drawShape(ctx, 'circle', s, fill);
            // Maw
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(0, s * 0.25, s * 0.55, 0, Math.PI);
            ctx.fill();
            ctx.fillStyle = '#fff';
            for (let i = 0; i < 6; i++) {
                const x = -s * 0.45 + i * s * 0.18;
                ctx.beginPath();
                ctx.moveTo(x, s * 0.25);
                ctx.lineTo(x + s * 0.09, s * 0.42);
                ctx.lineTo(x + s * 0.18, s * 0.25);
                ctx.fill();
            }
        }

        if (b.dying) {
            // Darkening body, glowing cracks spreading, X-ed out eyes
            ctx.globalAlpha = 0.6 * q;
            ctx.fillStyle = '#140800';
            ctx.beginPath();
            ctx.arc(0, 0, s * 1.02, 0, TAU);
            ctx.fill();
            ctx.globalAlpha = 1;
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
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 4;
            const ex = s * 0.36;
            const ey = -s * 0.18;
            const k = s * 0.13;
            ctx.beginPath();
            for (const x of [-ex, ex]) {
                ctx.moveTo(x - k, ey - k);
                ctx.lineTo(x + k, ey + k);
                ctx.moveTo(x + k, ey - k);
                ctx.lineTo(x - k, ey + k);
            }
            ctx.stroke();
            ctx.lineCap = 'butt';
            ctx.restore();
            return;
        }

        // Angry eyes
        const look = U.normalizeVector(this.player.x - b.x, this.player.y - b.y);
        const ex = s * 0.36;
        const ey = -s * 0.18;
        ctx.fillStyle = b.enraged ? '#ff3b30' : '#fff';
        ctx.beginPath();
        ctx.arc(-ex, ey, s * 0.17, 0, TAU);
        ctx.arc(ex, ey, s * 0.17, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(-ex + look.x * 3, ey + look.y * 3, s * 0.08, 0, TAU);
        ctx.arc(ex + look.x * 3, ey + look.y * 3, s * 0.08, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-ex - s * 0.2, ey - s * 0.3);
        ctx.lineTo(-ex + s * 0.15, ey - s * 0.15);
        ctx.moveTo(ex + s * 0.2, ey - s * 0.3);
        ctx.lineTo(ex - s * 0.15, ey - s * 0.15);
        ctx.stroke();
        ctx.restore();
    },

    drawBlades(ctx) {
        const p = this.player;
        const bl = this.blade;
        const heat = bl.heat || 0;
        const [r, g, b] = Game.bladeColor(heat);
        const reach = this.stabReach;
        const bladeLen = 38;
        const blades = [];
        if (bl.phase === 'out' || bl.phase === 'back') {
            const k = bl.phase === 'out' ? Math.min(1, bl.t / (bl.outF || 5)) : 1 - Math.min(1, bl.t / (bl.backF || 5));
            bl.stabs.forEach(st => blades.push({ angle: st.angle, ext: 24 + (reach - 12) * k, streak: bl.phase === 'out' }));
        } else {
            const target = this.nearestMonster(p.x, p.y);
            const angle = target ? Math.atan2(target.y - p.y, target.x - p.x) : (p.facing > 0 ? 0.35 : Math.PI - 0.35);
            blades.push({ angle, ext: 26 + Math.sin(this.frameNo * 0.12) * 2, streak: false });
        }
        for (const bd of blades) {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(bd.angle);
            if (bd.streak) {
                ctx.globalAlpha = 0.28;
                ctx.fillStyle = heat > 0.2 ? `rgb(${r},${g},${b})` : '#e3f2fd';
                ctx.beginPath();
                ctx.moveTo(10, -9);
                ctx.lineTo(bd.ext, -1.5);
                ctx.lineTo(bd.ext, 1.5);
                ctx.lineTo(10, 9);
                ctx.closePath();
                ctx.fill();
                ctx.globalAlpha = 1;
            }
            const tip = bd.ext;
            const base = Math.max(8, tip - bladeLen);
            if (heat > 0.2) {
                ctx.globalAlpha = 0.25 + 0.35 * heat;
                ctx.strokeStyle = `rgb(255,${Math.round(90 + 120 * heat)},40)`;
                ctx.lineWidth = 9;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(base, 0);
                ctx.lineTo(tip, 0);
                ctx.stroke();
                ctx.globalAlpha = 1;
                ctx.lineCap = 'butt';
            }
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.strokeStyle = heat > 0.5 ? '#fff3e0' : '#9aa5ad';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(base, -3.5);
            ctx.lineTo(tip - 7, -2.6);
            ctx.lineTo(tip, 0);
            ctx.lineTo(tip - 7, 2.6);
            ctx.lineTo(base, 3.5);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.strokeStyle = '#6d4c41';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(base, -8);
            ctx.lineTo(base, 8);
            ctx.stroke();
            ctx.fillStyle = '#4e342e';
            ctx.fillRect(base - 8, -2, 8, 4);
            ctx.restore();
        }
    },

    drawPlayer(ctx) {
        const p = this.player;
        if (p.iframes > 0 && Math.floor(p.iframes / 5) % 2 === 0) return;
        const giant = this.timers.invincible > 0;
        const size = p.r * 2.4 * (giant ? 1.8 : 1);
        const bob = p.moveT ? Math.abs(Math.sin(p.moveT * 0.25)) * -3 : Math.sin(this.frameNo * 0.06) * 1.2;
        this.drawShadow(ctx, p.x, p.y + size * 0.42, size * 0.4);
        if (giant) {
            ctx.globalAlpha = 0.3 + 0.15 * Math.sin(this.frameNo * 0.3);
            ctx.fillStyle = '#7CFC00';
            ctx.beginPath();
            ctx.arc(p.x, p.y, size * 0.6, 0, TAU);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        ctx.save();
        ctx.translate(p.x, p.y + bob);
        ctx.scale(-p.facing, 1); // the emoji faces left by default
        ctx.font = `${size}px ${EMOJI_FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#000'; // emoji glyphs inherit the fill alpha
        ctx.fillText('🧙‍♂️', 0, 0);
        ctx.restore();
        if (this.mouse.down && this.weapon !== 'missiles' && this.weapon !== 'sword') {
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

    drawProjectiles(ctx) {
        ctx.fillStyle = '#ffe066';
        ctx.strokeStyle = 'rgba(255,170,0,0.6)';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        for (const b of this.bullets) {
            ctx.beginPath();
            ctx.moveTo(b.x - b.vx * 1.2, b.y - b.vy * 1.2);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r, 0, TAU);
            ctx.fill();
        }
        ctx.lineCap = 'butt';

        for (const ms of this.missiles) {
            ms.trail.forEach((t, i) => {
                ctx.globalAlpha = (i / ms.trail.length) * 0.5;
                ctx.fillStyle = '#ffb385';
                ctx.beginPath();
                ctx.arc(t.x, t.y, 1.5 + i * 0.25, 0, TAU);
                ctx.fill();
            });
            ctx.globalAlpha = 1;
            ctx.save();
            ctx.translate(ms.x, ms.y);
            ctx.rotate(ms.angle);
            ctx.fillStyle = '#ff4500';
            ctx.beginPath();
            ctx.ellipse(0, 0, 7, 3, 0, 0, TAU);
            ctx.fill();
            ctx.fillStyle = '#ffd60a';
            ctx.beginPath();
            ctx.moveTo(-6, 0);
            ctx.lineTo(-11 - Math.random() * 4, -2);
            ctx.lineTo(-11 - Math.random() * 4, 2);
            ctx.fill();
            ctx.restore();
        }

        // Boss bullets: magenta orbs with a dark core, so they never read as your own (yellow) shots.
        const pulse = 1 + 0.15 * Math.sin(this.frameNo * 0.3);
        for (const s of this.enemyShots) {
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = '#ff2d78';
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r * 1.9 * pulse, 0, TAU);
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#ff2d78';
            ctx.strokeStyle = '#ffd1e3';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, TAU);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#2a0014';
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r * 0.5, 0, TAU);
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
            ctx.strokeText(f.text, f.x, f.y);
            ctx.fillStyle = f.color;
            ctx.fillText(f.text, f.x, f.y);
        }
        ctx.globalAlpha = 1;
    },

    drawScreenFx(ctx) {
        const pad = 40;
        if (this.timers.freeze > 0) {
            ctx.fillStyle = 'rgba(180,230,255,0.12)';
            ctx.fillRect(-pad, -pad, this.W + pad * 2, this.H + pad * 2);
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
    },

    // Steel goes from black to dark red, red, orange and white-hot as the hit chain grows.
    bladeColor(h) {
        const stops = [[0, [28, 31, 36]], [0.25, [110, 14, 14]], [0.55, [214, 40, 30]], [0.8, [255, 112, 40]], [1, [255, 236, 200]]];
        for (let i = 1; i < stops.length; i++) {
            if (h <= stops[i][0]) {
                const [h0, c0] = stops[i - 1];
                const [h1, c1] = stops[i];
                const t = (h - h0) / (h1 - h0);
                return c0.map((v, k) => Math.round(v + (c1[k] - v) * t));
            }
        }
        return stops[stops.length - 1][1];
    }
});
