/* Monster Hunter — road: scrolling, biome tiles, scenery. Extends Game (js/core.js).
   The simulation stays in screen space; the road adds ROAD_SPEED to the y of everything that
   lies on the ground each step. The background is one pre-rendered, vertically seamless tile
   per biome (1.5 × screen height), so a frame costs two drawImage calls (four during a seam). */

const ROAD_SPEED = 0.8; // px per step at 1× (≈ 43 px/s, one screen in ~14 s)
const TRAVEL_SPEED = 4; // road multiplier while travelling to the next biome

// Each biome: ground palette, road surface and the scenery its generator scatters on the verges.
const BIOMES = [
    { id: 'meadow', name: 'Sunny Meadow', ground: ['#7cc56b', '#6bb55c', '#8fd27a'], road: ['#d9b77e', '#c9a46a', '#e7c992'], edge: '#a88757', surface: 'dirt',
        items: [['tree', 6], ['bush', 10], ['flowers', 16], ['tuft', 26], ['rock', 3]] },
    { id: 'pines', name: 'Pine Forest', ground: ['#3f7d4a', '#356d40', '#4a8c55'], road: ['#a07850', '#8d6743', '#b38a5e'], edge: '#6f5236', surface: 'needles',
        items: [['pine', 18], ['mushroom', 6], ['tuft', 16], ['log', 2], ['rock', 3]] },
    { id: 'lakes', name: 'Lakeside', ground: ['#86c97a', '#77ba6c', '#98d68c'], road: ['#cfcabb', '#bdb7a6', '#dedad0'], edge: '#9b958a', surface: 'gravel',
        items: [['pond', 3], ['reeds', 10], ['tuft', 20], ['bush', 6], ['flowers', 8]] },
    { id: 'hills', name: 'Rocky Hills', ground: ['#9fae7a', '#8f9e6c', '#b0bd8b'], road: ['#9a9a9a', '#8a8a8a', '#aaaaaa'], edge: '#6f6f6f', surface: 'cobble',
        items: [['boulder', 7], ['rock', 16], ['tuft', 14], ['bush', 4]] },
    { id: 'autumn', name: 'Autumn Woods', ground: ['#c8a050', '#b88f43', '#d6b060'], road: ['#9c6b3f', '#8b5d35', '#ad7a4a'], edge: '#6e4a2a', surface: 'leaves',
        items: [['autumnTree', 12], ['leaves', 24], ['bush', 6], ['mushroom', 4]] },
    { id: 'swamp', name: 'Gloomy Swamp', ground: ['#5b6e3c', '#4e6034', '#677b45'], road: ['#7a6a4a', '#6b5c40', '#8a7a58'], edge: '#4a3d28', surface: 'planks',
        items: [['puddle', 8], ['reeds', 12], ['deadTree', 5], ['lily', 8], ['tuft', 8]] },
    { id: 'snow', name: 'Frost Fields', ground: ['#eef4fb', '#dfe9f4', '#ffffff'], road: ['#b9c7d6', '#a9b8c9', '#c9d5e2'], edge: '#8a9bb0', surface: 'snow',
        items: [['snowPine', 14], ['snowRock', 8], ['ice', 4], ['drift', 10]] },
    { id: 'canyon', name: 'Red Canyon', ground: ['#e0a368', '#d39357', '#eab27a'], road: ['#e8c99a', '#dbb985', '#f2d6aa'], edge: '#b0814f', surface: 'sand',
        items: [['cactus', 9], ['redRock', 10], ['tuft', 6], ['skull', 2]] },
    { id: 'volcano', name: 'Volcanic Wastes', ground: ['#3b3036', '#33292e', '#463a41'], road: ['#5a4e52', '#4f4448', '#665a5e'], edge: '#2a2226', surface: 'basalt',
        items: [['lava', 6], ['ashRock', 12], ['vent', 4], ['ember', 14]] },
    { id: 'crystal', name: 'Crystal Caves', ground: ['#4a3a72', '#3f3164', '#56447f'], road: ['#5d5470', '#524a64', '#6a617d'], edge: '#3a3350', surface: 'veins',
        items: [['crystal', 14], ['gem', 10], ['rock', 6], ['glowShroom', 6]] },
    { id: 'night', name: 'Night Forest', ground: ['#1f3b3a', '#1a3332', '#264645'], road: ['#4b4a5c', '#424152', '#555467'], edge: '#2c2b3a', surface: 'dirt',
        items: [['nightTree', 14], ['glowShroom', 10], ['firefly', 18], ['tuft', 8]] }
];

extendGame({
    biomeFor(level) {
        return BIOMES[(Math.max(1, level) - 1) % BIOMES.length];
    },

    get roadLeft() {
        return Math.max(70, this.W * 0.175);
    },

    get roadRight() {
        return this.W - this.roadLeft;
    },

    /** World y below which nothing important should sit: the HUD covers the top ~130 CSS px. */
    get topSafe() {
        return Math.min(this.H * 0.4, 130 / this.scale);
    },

    get floorY() {
        return this.H - 90;
    },

    get roadMult() {
        return (this.artefactMult ? this.artefactMult('road') : 1) * (this.buffs.brake ? 0.6 : 1) * (this.timers.roadBrake > 0 ? 0.5 : 1);
    },

    get roadSpeed() {
        if (this.phase === 'travel') return ROAD_SPEED * TRAVEL_SPEED;
        return ROAD_SPEED * this.roadMult * (this.state === 'dying' ? 0.5 : 1);
    },

    updateRoad() {
        const v = this.roadSpeed;
        this.roadY += v;
        for (const m of this.monsters) if (!m.anchored && !m.boss) m.y += v;
        for (const c of this.coinDrops) c.y += v;
        for (const pu of this.powerups) pu.y += v;
        for (const g of this.grenades) {
            g.y += v;
            g.sy += v;
        }
        for (const e of this.explosions) e.y += v;
        for (const d of this.decals) d.y += v;
        for (const h of this.hazards) if (h.grounded) h.y += v;
        for (const p of this.particles) if (p.kind === 'dust' || p.kind === 'smoke' || p.ground) p.y += v;
        if (this.seam) {
            this.seam.y += v;
            if (this.seam.y > this.H + 60) this.finishTravel();
        }
        // Loot that drifts off the bottom is gone.
        this.coinDrops = this.coinDrops.filter(c => c.y < this.H + 12);
        this.powerups = this.powerups.filter(pu => pu.y < this.H + 20);
        this.decals = this.decals.filter(d => d.y < this.H + 40);

        // Hiding at the very bottom only works for a moment.
        const p = this.player;
        if (p.y > this.floorY) p.belowT = (p.belowT || 0) + 1;
        else p.belowT = 0;
    },

    /** Soft floor: near the bottom mobs slow down so loot there stays pickable — unless you camp it. */
    get floorProtects() {
        return (this.player.belowT || 0) < 3 * 60 * GAME_SPEED;
    },

    // ------------------------------------------------------------------ background tiles

    biomeTile(biome) {
        const k = this.dpr * this.scale;
        const w = this.canvas.width;
        const h = Math.round(this.H * 1.5 * k);
        const key = `${biome.id}:${w}x${h}`;
        this.tiles = this.tiles || new Map();
        if (this.tiles.has(key)) return this.tiles.get(key);
        if (this.tiles.size > 3) this.tiles.delete(this.tiles.keys().next().value);
        const cv = document.createElement('canvas');
        cv.width = w;
        cv.height = h;
        const g = cv.getContext('2d');
        g.scale(k, k);
        Game.paintBiome(g, biome, this.W, this.H * 1.5, this.roadLeft, this.roadRight);
        const tile = { cv, h: this.H * 1.5 };
        this.tiles.set(key, tile);
        return tile;
    },

    drawRoadTile(ctx, tile, clipTop = -Infinity, clipBottom = Infinity) {
        const k = this.dpr * this.scale;
        const off = ((this.roadY % tile.h) + tile.h) % tile.h;
        const top = Math.max(0, clipTop);
        const bottom = Math.min(this.H, clipBottom);
        if (bottom <= top) return;
        // Two copies of the tile stacked; draw only the slice inside [top, bottom).
        for (const base of [off - tile.h, off]) {
            const y0 = Math.max(top, base);
            const y1 = Math.min(bottom, base + tile.h);
            if (y1 <= y0) continue;
            const sy = (y0 - base) * k;
            const sh = (y1 - y0) * k;
            ctx.drawImage(tile.cv, 0, sy, tile.cv.width, sh, 0, y0 * k, tile.cv.width, sh);
        }
    },

    drawBackground(ctx) {
        const biome = this.biome || this.biomeFor(this.level);
        const tile = this.biomeTile(biome);
        if (this.seam) {
            // next biome above the seam, current one below it, a gate/bridge on the seam itself
            const next = this.biomeTile(this.seam.biome);
            this.drawRoadTile(ctx, next, -Infinity, this.seam.y);
            this.drawRoadTile(ctx, tile, this.seam.y, Infinity);
        } else {
            this.drawRoadTile(ctx, tile);
        }
        const k = this.dpr * this.scale;
        // soft vignette
        if (!this.vignette || this.vignette.width !== this.canvas.width || this.vignette.height !== this.canvas.height) {
            const v = this.vignette = document.createElement('canvas');
            v.width = this.canvas.width;
            v.height = this.canvas.height;
            const g = v.getContext('2d');
            const vg = g.createRadialGradient(v.width / 2, v.height / 2, Math.min(v.width, v.height) * 0.35, v.width / 2, v.height / 2, Math.hypot(v.width, v.height) * 0.6);
            vg.addColorStop(0, 'rgba(0,0,0,0)');
            vg.addColorStop(1, 'rgba(0,0,0,0.32)');
            g.fillStyle = vg;
            g.fillRect(0, 0, v.width, v.height);
        }
        ctx.drawImage(this.vignette, 0, 0);
        if (this.seam) {
            ctx.save();
            ctx.setTransform(k, 0, 0, k, 0, 0);
            this.drawGate(ctx, this.seam.y, this.seam.biome);
            ctx.restore();
        }
    },

    drawGate(ctx, y, biome) {
        const L = this.roadLeft;
        const R = this.roadRight;
        // wooden bridge planks across the road + two stone pillars with a banner arch
        ctx.fillStyle = '#7c4a21';
        ctx.fillRect(L - 10, y - 14, R - L + 20, 28);
        ctx.fillStyle = '#a0632e';
        for (let x = L - 8; x < R + 8; x += 16) ctx.fillRect(x, y - 12, 13, 24);
        ctx.strokeStyle = '#4a2b12';
        ctx.lineWidth = 2;
        ctx.strokeRect(L - 10, y - 14, R - L + 20, 28);
        for (const x of [L - 14, R + 14]) {
            ctx.fillStyle = '#8d8d99';
            ctx.strokeStyle = '#3b3b46';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.roundRect(x - 13, y - 70, 26, 84, 5);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#facc15';
            ctx.beginPath();
            ctx.arc(x, y - 76, 7, 0, TAU);
            ctx.fill();
            ctx.stroke();
        }
        ctx.strokeStyle = '#3b3b46';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(L - 14, y - 62);
        ctx.quadraticCurveTo((L + R) / 2, y - 110, R + 14, y - 62);
        ctx.stroke();
        const label = `LEVEL ${this.level + 1} · ${biome.name.toUpperCase()}`;
        ctx.font = `20px ${DISPLAY_FONT}`;
        const tw = ctx.measureText(label).width + 28;
        const bx = (L + R) / 2;
        ctx.fillStyle = '#b91c1c';
        ctx.strokeStyle = '#450a0a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(bx - tw / 2, y - 106, tw, 30, 8);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fff7ed';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, bx, y - 90);
    }
});

// ---------------------------------------------------------------------- biome painting (pure)

Object.assign(Game, {
    rng(seed) {
        let s = seed >>> 0 || 1;
        return () => {
            s ^= s << 13; s >>>= 0;
            s ^= s >> 17;
            s ^= s << 5; s >>>= 0;
            return s / 4294967296;
        };
    },

    paintBiome(g, biome, W, H, L, R) {
        const r = Game.rng(biome.id.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
        const [g0, g1, g2] = biome.ground;
        g.fillStyle = g0;
        g.fillRect(0, 0, W, H);
        // ground mottling (wrapped vertically so the tile is seamless)
        const wrap = (y, draw) => {
            draw(y);
            if (y < 60) draw(y + H);
            if (y > H - 60) draw(y - H);
        };
        for (let i = 0; i < W * H / 900; i++) {
            const x = r() * W;
            const y = r() * H;
            const rad = 6 + r() * 22;
            g.fillStyle = r() < 0.5 ? g1 : g2;
            g.globalAlpha = 0.35 + r() * 0.3;
            wrap(y, yy => {
                g.beginPath();
                g.ellipse(x, yy, rad, rad * 0.6, 0, 0, TAU);
                g.fill();
            });
        }
        g.globalAlpha = 1;
        Game.paintRoad(g, biome, W, H, L, R, r, wrap);
        // scenery on the verges (never on the road)
        const items = [];
        for (const [kind, density] of biome.items) {
            const n = Math.round(density * (H / 600) * Math.max(0.6, (L / 140)));
            for (let i = 0; i < n; i++) {
                const left = r() < 0.5;
                const x = left ? 6 + r() * (L - 18) : R + 12 + r() * (W - R - 18);
                items.push({ kind, x, y: r() * H, s: 0.75 + r() * 0.5, seed: r() });
            }
        }
        items.sort((a, b) => a.y - b.y);
        for (const it of items) wrap(it.y, yy => Game.paintItem(g, it.kind, it.x, yy, it.s, it.seed, biome));
    },

    paintRoad(g, biome, W, H, L, R, r, wrap) {
        const [r0, r1, r2] = biome.road;
        g.fillStyle = 'rgba(0,0,0,0.18)';
        g.fillRect(L - 8, 0, R - L + 16, H);
        g.fillStyle = r0;
        g.fillRect(L, 0, R - L, H);
        // surface texture
        for (let i = 0; i < (R - L) * H / 500; i++) {
            const x = L + r() * (R - L);
            const y = r() * H;
            g.fillStyle = r() < 0.5 ? r1 : r2;
            g.globalAlpha = 0.5;
            const s = 2 + r() * 5;
            wrap(y, yy => g.fillRect(x, yy, s, s * 0.7));
        }
        g.globalAlpha = 1;
        const surf = biome.surface;
        if (surf === 'cobble' || surf === 'basalt') {
            g.strokeStyle = 'rgba(0,0,0,0.18)';
            g.lineWidth = 1.5;
            for (let y = 0; y < H; y += 22) {
                for (let x = L + ((y / 22) % 2) * 15; x < R; x += 30) {
                    g.beginPath();
                    g.roundRect(x + 1, y + 1, 28, 20, 5);
                    g.stroke();
                }
            }
        } else if (surf === 'planks') {
            g.strokeStyle = 'rgba(40,25,10,0.35)';
            g.lineWidth = 2;
            for (let y = 0; y < H; y += 18) {
                g.beginPath();
                g.moveTo(L, y);
                g.lineTo(R, y);
                g.stroke();
            }
        } else if (surf === 'veins') {
            g.strokeStyle = 'rgba(167,139,250,0.45)';
            g.lineWidth = 2;
            for (let i = 0; i < H / 60; i++) {
                let x = L + r() * (R - L);
                let y = r() * H;
                g.beginPath();
                g.moveTo(x, y);
                for (let j = 0; j < 6; j++) {
                    x = Math.min(R, Math.max(L, x + (r() - 0.5) * 40));
                    y += 12 + r() * 14;
                    g.lineTo(x, y);
                }
                g.stroke();
            }
        } else if (surf === 'leaves' || surf === 'needles') {
            for (let i = 0; i < (R - L) * H / 1400; i++) {
                const x = L + r() * (R - L);
                const y = r() * H;
                g.fillStyle = surf === 'leaves' ? ['#d9480f', '#f59f00', '#c92a2a'][Math.floor(r() * 3)] : '#5c4a2e';
                wrap(y, yy => {
                    g.save();
                    g.translate(x, yy);
                    g.rotate(r() * TAU);
                    g.fillRect(-3, -1, surf === 'leaves' ? 6 : 8, surf === 'leaves' ? 3 : 1.2);
                    g.restore();
                });
            }
        } else {
            // wheel ruts
            g.fillStyle = 'rgba(0,0,0,0.07)';
            const m = (L + R) / 2;
            g.fillRect(m - (R - L) * 0.22 - 6, 0, 12, H);
            g.fillRect(m + (R - L) * 0.22 - 6, 0, 12, H);
        }
        // edges
        g.fillStyle = biome.edge;
        g.fillRect(L - 3, 0, 4, H);
        g.fillRect(R - 1, 0, 4, H);
        for (let y = 8; y < H; y += 26 + r() * 10) {
            for (const x of [L - 2, R + 1]) {
                g.fillStyle = r() < 0.5 ? biome.edge : biome.road[1];
                g.beginPath();
                g.ellipse(x, y, 4 + r() * 3, 3, 0, 0, TAU);
                g.fill();
            }
        }
    },

    paintItem(g, kind, x, y, s, seed, biome) {
        const O = 'rgba(20,30,20,0.55)';
        const ell = (cx, cy, rx, ry, fill, stroke) => {
            g.beginPath();
            g.ellipse(cx, cy, rx, ry, 0, 0, TAU);
            g.fillStyle = fill;
            g.fill();
            if (stroke) {
                g.strokeStyle = stroke;
                g.lineWidth = 1.5;
                g.stroke();
            }
        };
        const shadow = (rx, ry = rx * 0.4) => ell(x + 2, y + 2, rx, ry, 'rgba(0,0,0,0.18)');
        g.save();
        switch (kind) {
            case 'tree':
            case 'autumnTree':
            case 'nightTree': {
                const leaf = kind === 'tree' ? ['#3f9142', '#55a84f', '#2f7a35'] : kind === 'autumnTree'
                    ? [['#e8590c', '#f08c00', '#c92a2a'][Math.floor(seed * 3)], '#ffa94d', '#a61e1e'] : ['#1e4d4a', '#2c6360', '#163b39'];
                shadow(16 * s, 7 * s);
                g.fillStyle = '#6b4423';
                g.fillRect(x - 3 * s, y - 6 * s, 6 * s, 10 * s);
                ell(x, y - 16 * s, 16 * s, 14 * s, leaf[2], O);
                ell(x - 6 * s, y - 20 * s, 10 * s, 9 * s, leaf[0]);
                ell(x + 6 * s, y - 18 * s, 9 * s, 8 * s, leaf[0]);
                ell(x - 3 * s, y - 24 * s, 6 * s, 5 * s, leaf[1]);
                break;
            }
            case 'pine':
            case 'snowPine': {
                shadow(12 * s, 5 * s);
                g.fillStyle = '#5b3a1e';
                g.fillRect(x - 2.5 * s, y - 6 * s, 5 * s, 8 * s);
                const tiers = [[0, 14], [-9, 11], [-17, 8]];
                for (const [dy, w] of tiers) {
                    g.beginPath();
                    g.moveTo(x - w * s, y - 4 * s + dy * s);
                    g.lineTo(x, y - 18 * s + dy * s);
                    g.lineTo(x + w * s, y - 4 * s + dy * s);
                    g.closePath();
                    g.fillStyle = kind === 'pine' ? '#1f5f3a' : '#2f6e55';
                    g.fill();
                    g.strokeStyle = O;
                    g.lineWidth = 1.2;
                    g.stroke();
                    if (kind === 'snowPine') {
                        g.fillStyle = '#ffffff';
                        g.beginPath();
                        g.moveTo(x - w * 0.55 * s, y - 10 * s + dy * s);
                        g.lineTo(x, y - 18 * s + dy * s);
                        g.lineTo(x + w * 0.55 * s, y - 10 * s + dy * s);
                        g.closePath();
                        g.fill();
                    }
                }
                break;
            }
            case 'bush':
                shadow(11 * s, 4 * s);
                ell(x, y - 4 * s, 11 * s, 8 * s, '#3e8e3e', O);
                ell(x - 4 * s, y - 7 * s, 5 * s, 4 * s, '#5bb35b');
                if (seed > 0.6) {
                    for (let i = 0; i < 3; i++) ell(x - 5 * s + i * 5 * s, y - 4 * s + (i % 2) * 3 * s, 1.6 * s, 1.6 * s, '#e03131');
                }
                break;
            case 'flowers': {
                const c = ['#ff6b9a', '#ffd43b', '#ffffff', '#b197fc'][Math.floor(seed * 4)];
                for (let i = 0; i < 4; i++) {
                    const fx = x + (i - 1.5) * 5 * s;
                    const fy = y + ((i * 7) % 5) * s;
                    g.strokeStyle = '#2f7a35';
                    g.lineWidth = 1;
                    g.beginPath();
                    g.moveTo(fx, fy);
                    g.lineTo(fx, fy - 5 * s);
                    g.stroke();
                    for (let p = 0; p < 5; p++) ell(fx + Math.cos(p * 1.26) * 2 * s, fy - 6 * s + Math.sin(p * 1.26) * 2 * s, 1.6 * s, 1.6 * s, c);
                    ell(fx, fy - 6 * s, 1.1 * s, 1.1 * s, '#f08c00');
                }
                break;
            }
            case 'tuft':
            case 'reeds':
            case 'drift': {
                if (kind === 'drift') {
                    ell(x, y, 14 * s, 5 * s, '#ffffff', 'rgba(150,170,200,0.5)');
                    break;
                }
                g.strokeStyle = kind === 'reeds' ? '#6b8e23' : 'rgba(30,90,30,0.7)';
                g.lineWidth = 1.4;
                const n = kind === 'reeds' ? 5 : 4;
                for (let i = 0; i < n; i++) {
                    const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.28;
                    const len = (kind === 'reeds' ? 16 : 7) * s;
                    g.beginPath();
                    g.moveTo(x, y);
                    g.quadraticCurveTo(x + Math.cos(a) * len * 0.5, y + Math.sin(a) * len * 0.6, x + Math.cos(a) * len, y + Math.sin(a) * len);
                    g.stroke();
                }
                if (kind === 'reeds') ell(x + 1, y - 15 * s, 1.8 * s, 4 * s, '#7c4a21');
                break;
            }
            case 'rock':
            case 'snowRock':
            case 'ashRock':
            case 'redRock':
            case 'boulder': {
                const big = kind === 'boulder' ? 2 : 1;
                const col = kind === 'redRock' ? '#b5562e' : kind === 'ashRock' ? '#2b2428' : '#8a8f98';
                shadow(9 * s * big, 4 * s * big);
                g.beginPath();
                g.moveTo(x - 9 * s * big, y);
                g.lineTo(x - 6 * s * big, y - 8 * s * big);
                g.lineTo(x + 3 * s * big, y - 10 * s * big);
                g.lineTo(x + 9 * s * big, y - 3 * s * big);
                g.lineTo(x + 7 * s * big, y + 2 * s * big);
                g.closePath();
                g.fillStyle = col;
                g.fill();
                g.strokeStyle = 'rgba(0,0,0,0.45)';
                g.lineWidth = 1.5;
                g.stroke();
                g.fillStyle = kind === 'snowRock' ? '#ffffff' : 'rgba(255,255,255,0.22)';
                g.beginPath();
                g.moveTo(x - 5 * s * big, y - 7 * s * big);
                g.lineTo(x + 3 * s * big, y - 9.5 * s * big);
                g.lineTo(x + 1 * s * big, y - 5 * s * big);
                g.closePath();
                g.fill();
                break;
            }
            case 'pond':
            case 'puddle':
            case 'ice': {
                const w = (kind === 'pond' ? 30 : 16) * s;
                const col = kind === 'puddle' ? '#4b5d3a' : kind === 'ice' ? '#cfeaff' : '#4aa3df';
                ell(x, y, w, w * 0.55, col, 'rgba(0,0,0,0.25)');
                ell(x - w * 0.3, y - w * 0.15, w * 0.35, w * 0.12, 'rgba(255,255,255,0.45)');
                break;
            }
            case 'lily':
                ell(x, y, 6 * s, 4 * s, '#3c8d3c', 'rgba(0,0,0,0.3)');
                if (seed > 0.5) ell(x + 2, y - 1, 2 * s, 2 * s, '#ff8fab');
                break;
            case 'mushroom':
            case 'glowShroom': {
                const glow = kind === 'glowShroom';
                if (glow) ell(x, y - 5 * s, 10 * s, 8 * s, 'rgba(120,255,220,0.18)');
                g.fillStyle = '#f1e3c8';
                g.fillRect(x - 1.8 * s, y - 5 * s, 3.6 * s, 5 * s);
                g.beginPath();
                g.ellipse(x, y - 5 * s, 6 * s, 4.5 * s, 0, Math.PI, 0);
                g.fillStyle = glow ? '#5eead4' : '#e03131';
                g.fill();
                g.strokeStyle = 'rgba(0,0,0,0.4)';
                g.lineWidth = 1;
                g.stroke();
                if (!glow) {
                    ell(x - 2 * s, y - 7 * s, 1.2 * s, 1.2 * s, '#ffffff');
                    ell(x + 2.5 * s, y - 6 * s, 1 * s, 1 * s, '#ffffff');
                }
                break;
            }
            case 'log':
                g.fillStyle = '#7c4a21';
                g.beginPath();
                g.roundRect(x - 14 * s, y - 4 * s, 28 * s, 8 * s, 4 * s);
                g.fill();
                ell(x + 14 * s, y, 3 * s, 4 * s, '#c08552', 'rgba(0,0,0,0.4)');
                break;
            case 'leaves':
                for (let i = 0; i < 3; i++) ell(x + (i - 1) * 4, y + (i % 2) * 3, 3 * s, 1.6 * s, ['#e8590c', '#f59f00', '#c92a2a'][i]);
                break;
            case 'deadTree':
                g.strokeStyle = '#4a3b2a';
                g.lineWidth = 3.5 * s;
                g.lineCap = 'round';
                g.beginPath();
                g.moveTo(x, y);
                g.lineTo(x, y - 24 * s);
                g.moveTo(x, y - 14 * s);
                g.lineTo(x - 9 * s, y - 22 * s);
                g.moveTo(x, y - 18 * s);
                g.lineTo(x + 8 * s, y - 27 * s);
                g.stroke();
                break;
            case 'cactus':
                shadow(8 * s, 3 * s);
                g.fillStyle = '#3f9142';
                g.strokeStyle = 'rgba(0,0,0,0.4)';
                g.lineWidth = 1.5;
                g.beginPath();
                g.roundRect(x - 4 * s, y - 24 * s, 8 * s, 24 * s, 4 * s);
                g.roundRect(x - 12 * s, y - 16 * s, 6 * s, 10 * s, 3 * s);
                g.roundRect(x + 6 * s, y - 20 * s, 6 * s, 9 * s, 3 * s);
                g.fill();
                g.stroke();
                break;
            case 'skull':
                ell(x, y, 5 * s, 4.4 * s, '#f5f0e6', 'rgba(0,0,0,0.4)');
                ell(x - 1.8 * s, y - 0.5 * s, 1.2 * s, 1.2 * s, '#3b2f2f');
                ell(x + 1.8 * s, y - 0.5 * s, 1.2 * s, 1.2 * s, '#3b2f2f');
                break;
            case 'lava': {
                g.strokeStyle = '#ff6b00';
                g.lineWidth = 3 * s;
                g.shadowColor = '#ff8c00';
                g.shadowBlur = 8;
                g.beginPath();
                g.moveTo(x - 12 * s, y);
                g.lineTo(x - 4 * s, y - 4 * s);
                g.lineTo(x + 3 * s, y + 2 * s);
                g.lineTo(x + 12 * s, y - 3 * s);
                g.stroke();
                break;
            }
            case 'vent':
                ell(x, y, 8 * s, 4 * s, '#1a1416', 'rgba(255,120,0,0.6)');
                ell(x, y - 6 * s, 6 * s, 5 * s, 'rgba(120,110,110,0.35)');
                break;
            case 'ember':
            case 'firefly':
                ell(x, y, 5 * s, 5 * s, kind === 'ember' ? 'rgba(255,120,0,0.25)' : 'rgba(250,255,140,0.22)');
                ell(x, y, 1.6 * s, 1.6 * s, kind === 'ember' ? '#ffb347' : '#fbff8a');
                break;
            case 'crystal':
            case 'gem': {
                const col = ['#a78bfa', '#67e8f9', '#f472b6'][Math.floor(seed * 3)];
                const h = (kind === 'crystal' ? 20 : 8) * s;
                g.shadowColor = col;
                g.shadowBlur = 10;
                g.fillStyle = col;
                g.strokeStyle = 'rgba(255,255,255,0.7)';
                g.lineWidth = 1.2;
                for (let i = -1; i <= (kind === 'crystal' ? 1 : 0); i++) {
                    g.beginPath();
                    g.moveTo(x + i * 6 * s - 3 * s, y);
                    g.lineTo(x + i * 6 * s, y - h * (i === 0 ? 1 : 0.7));
                    g.lineTo(x + i * 6 * s + 3 * s, y);
                    g.closePath();
                    g.fill();
                    g.stroke();
                }
                break;
            }
        }
        g.restore();
    }
});
