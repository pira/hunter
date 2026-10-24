/* Monster Hunter — sprites: vector player characters, drawn once per (class, skin, frame) into an
   offscreen cache, so they look the same on every OS and can be recoloured (skins). Extends Game. */

// Base palettes. Skins (P7) override any of these keys and may add extras.
const PALETTES = {
    wizard: {
        robe: '#5b3fd1', robeDark: '#3b2a8f', trim: '#facc15', hat: '#4c2fb8', hatBand: '#facc15', star: '#fde047',
        skin: '#f6c7a1', cheek: '#f29b8f', beard: '#f8fafc', beardShade: '#cbd5e1', shoe: '#2e1065', staff: '#8b5a2b', orb: '#67e8f9'
    },
    barbarian: {
        skin: '#e9b38a', skinShade: '#c98c64', hair: '#e8590c', hairDark: '#b94408', fur: '#8b5a2b', furLight: '#c08552',
        pants: '#475569', belt: '#3f2a1d', buckle: '#facc15', helmet: '#9ca3af', helmetDark: '#6b7280', horn: '#fef3c7',
        boot: '#4a2c17', axeHead: '#e2e8f0', axeEdge: '#94a3b8', axeHandle: '#7c3f12'
    },
    goblin: {
        skin: '#7cc423', skinShade: '#4d7c0f', ear: '#94d63a', eye: '#fde047', vest: '#9a3412', vestDark: '#7c2d12', cap: '#78350f',
        goggle: '#cbd5e1', lens: '#7dd3fc', pants: '#57534e', teeth: '#fffbeb', bomb: '#1f2937', fuse: '#fbbf24', satchel: '#a16207'
    }
};
const OUTLINE = '#1a1033';

// v3.10: illustrated hero sprites (img/heroes/<class>[_<skin>].webp, one crop per class so skins line
// up), feet at the bottom edge.
// h = height in world units; hand = where the barbarian's axe sits (fraction of the image, from top-left).
const HERO_SPRITES = {
    wizard: { h: 50 },
    barbarian: { h: 50, hand: [0.85, 0.655] },
    goblin: { h: 48 }
};
const HeroSprites = {
    list: {},
    ready: null,
    load(base = (typeof window !== 'undefined' && window.HERO_SPRITE_BASE) || 'img/heroes/') {
        if (typeof Image === 'undefined' || typeof document === 'undefined') return Promise.resolve();
        const keys = Object.keys(HERO_SPRITES);
        if (typeof SKINS !== 'undefined') for (const id of Object.keys(SKINS)) keys.push(`${SKINS[id].cls}_${id}`);
        this.ready = Promise.all(keys.map(key => new Promise(resolve => {
            loadImage(`${base}${key}.webp`, img => {
                if (img) this.list[key] = img; // else the vector hero stays
                resolve();
            });
        })));
        return this.ready;
    },
    /** The sprite for a class and skin, or null (a skin without its own sprite keeps the vector look). */
    get(cls, skin = '') {
        return this.list[skin ? `${cls}_${skin}` : cls] || null;
    },
    /** v3.11.1: a light rim around the hero's silhouette (made once per sprite) so it pops off the crowd. */
    halo(img) {
        if (img.halo) return img.halo;
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const pad = Math.max(2, Math.round(h * HERO_HALO.width));
        const sil = newCanvas(w, h);
        const out = sil && newCanvas(w + pad * 2, h + pad * 2);
        if (!out) {
            if (sil) freeCanvas(sil.cv);
            return null; // no canvas memory left: just no rim this frame
        }
        sil.g.drawImage(img, 0, 0);
        sil.g.globalCompositeOperation = 'source-in';
        sil.g.fillStyle = HERO_HALO.color;
        sil.g.fillRect(0, 0, w, h);
        for (let i = 0; i < 16; i++) {
            const a = (i / 16) * Math.PI * 2;
            out.g.drawImage(sil.cv, pad + Math.cos(a) * pad, pad + Math.sin(a) * pad);
        }
        freeCanvas(sil.cv);
        img.halo = { cv: out.cv, pad };
        return img.halo;
    }
};
const HERO_HALO = { color: '#fffbeb', width: 0.035, alpha: 1 };
HeroSprites.load();
const SPRITE_BOX = 72; // world units
const SPRITE_RES = 3; // cache pixels per world unit
const SPRITE_ORIGIN = { x: 36, y: 57 }; // character's ground-centre inside the box

extendGame({
    palette(cls, skin) {
        const skins = typeof SKINS !== 'undefined' ? SKINS : {};
        const s = skin && skins[skin] && skins[skin].cls === cls ? skins[skin] : null;
        return { ...PALETTES[cls], ...(s ? s.palette : {}), extras: s ? s.extras || {} : {} };
    },

    /** Cached sprite canvas for a class/skin/frame. frame 0 = idle, 1–4 = walk cycle. */
    sprite(cls, skin = '', frame = 0, variant = '') {
        const cache = this.spriteCache || (this.spriteCache = new Map());
        const key = `${cls}|${skin}|${frame}|${variant}`;
        let cv = cache.get(key);
        if (!cv) {
            const c = newCanvas(SPRITE_BOX * SPRITE_RES, SPRITE_BOX * SPRITE_RES);
            if (!c) return null;
            cv = c.cv;
            const g = c.g;
            g.scale(SPRITE_RES, SPRITE_RES);
            g.translate(SPRITE_ORIGIN.x, SPRITE_ORIGIN.y);
            Game.drawCharacter(g, cls, this.palette(cls, skin), frame, { noWeapon: variant === 'noweapon' });
            cache.set(key, cv);
        }
        return cv;
    },

    /** Draws the cached sprite centred on (x, y) = the character's feet-ish centre in world space. */
    blitSprite(ctx, cls, skin, frame, x, y, scale = 1, facing = 1, variant = '', halo = false) {
        if (this.blitHero(ctx, cls, skin, frame, x, y, scale, facing, variant, halo)) return;
        const cv = this.sprite(cls, skin, frame, variant);
        if (!cv) return;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scale * facing, scale);
        ctx.drawImage(cv, -SPRITE_ORIGIN.x, -SPRITE_ORIGIN.y, SPRITE_BOX, SPRITE_BOX);
        ctx.restore();
    },

    /**
     * Illustrated hero: one picture, brought to life in code — a hop and a sway while walking, a
     * gentle breath standing still, mirrored to face where it walks. Returns false without a sprite.
     */
    blitHero(ctx, cls, skin, frame, x, y, scale, facing, variant, halo = false) {
        const img = HeroSprites.get(cls, skin);
        if (!img) return false;
        const cfg = HERO_SPRITES[cls];
        const H = cfg.h;
        const W = (H * img.naturalWidth) / img.naturalHeight;
        const t = (this.frameNo || 0) * 0.26;
        const walking = frame > 0;
        const hop = walking ? Math.abs(Math.sin(t)) * 3 : 0;
        const sway = walking ? Math.sin(t) * 0.07 : 0;
        const squash = walking ? 1 - (1 - Math.abs(Math.sin(t))) * 0.05 : 1;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scale * facing, scale);
        ctx.translate(0, -hop);
        ctx.rotate(sway);
        ctx.scale(1 / Math.sqrt(squash), squash);
        const hl = halo && HeroSprites.halo(img);
        if (hl) {
            const k = H / img.naturalHeight;
            const a = ctx.globalAlpha;
            ctx.globalAlpha = a * HERO_HALO.alpha;
            ctx.drawImage(hl.cv, -W / 2 - hl.pad * k, -H - hl.pad * k, hl.cv.width * k, hl.cv.height * k);
            ctx.globalAlpha = a;
        }
        ctx.drawImage(img, -W / 2, -H, W, H);
        if (cfg.hand && variant !== 'noweapon') {
            // the axe is drawn on top, in the fist (it swings on its own while cleaving)
            Game.drawAxe(ctx, this.palette(cls, skin), (cfg.hand[0] - 0.5) * W, -(1 - cfg.hand[1]) * H, 0.32, 0.9);
        }
        ctx.restore();
        return true;
    },

    /** Menu / profile portrait on a square canvas. */
    drawPortrait(canvas, cls, skin = '') {
        const g = canvas.getContext('2d');
        const S = canvas.width;
        g.clearRect(0, 0, S, S);
        const img = HeroSprites.get(cls, skin);
        if (img) {
            const cfg = HERO_SPRITES[cls];
            const h = S * 0.9;
            const w = (h * img.naturalWidth) / img.naturalHeight;
            g.drawImage(img, (S - w) / 2, S * 0.96 - h, w, h);
            if (cfg.hand) {
                g.save();
                g.translate(S / 2, S * 0.96);
                const k = h / cfg.h;
                g.scale(k, k);
                Game.drawAxe(g, this.palette(cls, skin), (cfg.hand[0] - 0.5) * (cfg.h * img.naturalWidth) / img.naturalHeight, -(1 - cfg.hand[1]) * cfg.h, 0.32, 0.9);
                g.restore();
            }
            return;
        }
        const k = S / 64;
        g.save();
        g.scale(k, k);
        g.translate(32, 57);
        Game.drawCharacter(g, cls, this.palette(cls, skin), 0, {});
        g.restore();
    },

    /** Replaces an element's contents with a small portrait canvas. */
    drawAvatar(el, cls, skin = '') {
        if (!el) return;
        let cv = el.querySelector('canvas');
        if (!cv) {
            el.textContent = '';
            cv = document.createElement('canvas');
            cv.width = cv.height = 128;
            el.appendChild(cv);
        }
        this.drawPortrait(cv, cls, skin);
    }
});

Object.assign(Game, {
    drawCharacter(g, cls, pal, frame, opts = {}) {
        g.lineJoin = 'round';
        g.lineCap = 'round';
        // walk cycle: feet swing, body bobs on the passing frames
        const step = [0, 1, 0, -1, 0][frame] || 0;
        const bob = frame === 1 || frame === 3 ? -1.2 : 0;
        if (cls === 'wizard') Game.drawWizard(g, pal, step, bob, opts);
        else if (cls === 'barbarian') Game.drawBarbarian(g, pal, step, bob, opts);
        else Game.drawGoblin(g, pal, step, bob, opts);
    },

    blob(g, fill, stroke = OUTLINE, width = 2) {
        g.fillStyle = fill;
        g.fill();
        if (stroke) {
            g.strokeStyle = stroke;
            g.lineWidth = width;
            g.stroke();
        }
    },

    ellipse(g, x, y, rx, ry, fill, stroke, width, rot = 0) {
        g.beginPath();
        g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
        Game.blob(g, fill, stroke, width);
    },

    star(g, x, y, r, fill) {
        g.beginPath();
        for (let i = 0; i < 10; i++) {
            const a = (i * Math.PI) / 5 - Math.PI / 2;
            const rr = i % 2 ? r * 0.45 : r;
            g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        g.closePath();
        g.fillStyle = fill;
        g.fill();
    },

    eyes(g, x1, x2, y, r = 1.9, look = 0.6) {
        for (const x of [x1, x2]) {
            Game.ellipse(g, x, y, r * 0.85, r * 1.1, '#1e1b4b', null);
            g.fillStyle = '#fff';
            g.beginPath();
            g.arc(x + look * 0.5 - 0.3, y - r * 0.45, r * 0.38, 0, Math.PI * 2);
            g.fill();
        }
    },

    drawWizard(g, p, step, bob, opts) {
        const ex = p.extras || {};
        // shoes
        Game.ellipse(g, -5 + step * 3, 0, 4.2, 2.6, p.shoe, OUTLINE, 1.6);
        Game.ellipse(g, 5 - step * 3, 0, 4.2, 2.6, p.shoe, OUTLINE, 1.6);
        g.save();
        g.translate(0, bob);
        // staff (behind the far arm)
        if (!opts.noWeapon) {
            g.strokeStyle = OUTLINE;
            g.lineWidth = 4.6;
            g.beginPath();
            g.moveTo(13, -1);
            g.lineTo(15, -33);
            g.stroke();
            g.strokeStyle = p.staff;
            g.lineWidth = 2.6;
            g.stroke();
            const glow = g.createRadialGradient(15, -36, 0, 15, -36, 9);
            glow.addColorStop(0, p.orb);
            glow.addColorStop(1, 'rgba(103,232,249,0)');
            g.fillStyle = glow;
            g.beginPath();
            g.arc(15, -36, 9, 0, Math.PI * 2);
            g.fill();
            Game.ellipse(g, 15, -36, 4.2, 4.2, p.orb, OUTLINE, 1.6);
            g.fillStyle = 'rgba(255,255,255,.85)';
            g.beginPath();
            g.arc(13.8, -37.3, 1.4, 0, Math.PI * 2);
            g.fill();
        }
        // robe
        g.beginPath();
        g.moveTo(-8, -15);
        g.quadraticCurveTo(-12, -2, -14, -1);
        g.quadraticCurveTo(0, 3, 14, -1);
        g.quadraticCurveTo(12, -2, 8, -15);
        g.closePath();
        Game.blob(g, p.robe);
        // robe shading + trim
        g.save();
        g.clip();
        g.fillStyle = p.robeDark;
        g.fillRect(-16, -16, 7, 20);
        g.fillStyle = p.trim;
        g.fillRect(-16, -4.2, 32, 2.4);
        Game.star(g, 4, -9, 2.6, p.trim);
        Game.star(g, -4, -5.5, 1.8, p.trim);
        g.restore();
        // sleeve + hand holding the staff
        g.beginPath();
        g.moveTo(5, -14);
        g.quadraticCurveTo(13, -12, 13, -6);
        g.lineTo(8, -6);
        g.closePath();
        Game.blob(g, p.robeDark);
        Game.ellipse(g, 13, -5.5, 2.6, 2.6, p.skin, OUTLINE, 1.6);
        // head
        Game.ellipse(g, 0, -21, 8, 7.6, p.skin, OUTLINE, 2);
        Game.ellipse(g, 4.5, -18.5, 1.6, 1.1, p.cheek, null);
        // beard
        g.beginPath();
        g.moveTo(-7, -20);
        g.quadraticCurveTo(-6, -8, 1, -4);
        g.quadraticCurveTo(7, -8, 8, -19);
        g.quadraticCurveTo(3, -15, -7, -20);
        Game.blob(g, p.beard, OUTLINE, 1.8);
        g.strokeStyle = p.beardShade;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(0, -14);
        g.lineTo(1, -7);
        g.moveTo(3.5, -14);
        g.lineTo(3.5, -9);
        g.stroke();
        // moustache + nose
        Game.ellipse(g, 2.5, -17, 4, 1.7, p.beard, OUTLINE, 1.2);
        Game.ellipse(g, 4.2, -19.2, 1.7, 1.5, p.skin, OUTLINE, 1.2);
        Game.eyes(g, -0.5, 5, -22);
        // hat: brim + bent cone
        if (!ex.noHat) {
            g.beginPath();
            g.moveTo(-8, -27);
            g.quadraticCurveTo(-4, -40, 2, -45);
            g.quadraticCurveTo(10, -50, 14, -44);
            g.quadraticCurveTo(7, -43, 7, -38);
            g.quadraticCurveTo(8, -32, 9, -27);
            g.closePath();
            Game.blob(g, p.hat);
            g.fillStyle = p.hatBand;
            g.beginPath();
            g.moveTo(-8.2, -29.5);
            g.quadraticCurveTo(0, -32, 9.2, -29.5);
            g.lineTo(9, -26.8);
            g.quadraticCurveTo(0, -29.4, -8, -26.8);
            g.closePath();
            g.fill();
            Game.ellipse(g, 0.5, -26.5, 13, 3.4, p.hat, OUTLINE, 2);
            Game.star(g, 1.5, -36, 2.8, p.star);
        }
        if (ex.crown) Game.drawCrown(g, 0.5, -29, ex.crown);
        g.restore();
    },

    drawBarbarian(g, p, step, bob, opts) {
        const ex = p.extras || {};
        // boots
        Game.ellipse(g, -5.5 + step * 3, 0, 4.4, 2.8, p.boot, OUTLINE, 1.6);
        Game.ellipse(g, 5.5 - step * 3, 0, 4.4, 2.8, p.boot, OUTLINE, 1.6);
        g.save();
        g.translate(0, bob);
        // legs
        g.fillStyle = p.pants;
        g.strokeStyle = OUTLINE;
        g.lineWidth = 1.6;
        for (const x of [-5.5 + step * 2, 5.5 - step * 2]) {
            g.beginPath();
            g.roundRect(x - 3.2, -8, 6.4, 7.5, 2);
            g.fill();
            g.stroke();
        }
        // torso (bare chest + fur vest)
        g.beginPath();
        g.moveTo(-11, -22);
        g.quadraticCurveTo(-13, -12, -9, -7);
        g.lineTo(9, -7);
        g.quadraticCurveTo(13, -12, 11, -22);
        g.closePath();
        Game.blob(g, p.skin);
        g.save();
        g.clip();
        g.fillStyle = p.fur;
        g.fillRect(-14, -24, 8, 20);
        g.fillRect(6, -24, 8, 20);
        g.fillStyle = p.furLight;
        for (let i = 0; i < 4; i++) {
            g.beginPath();
            g.arc(-8, -21 + i * 4, 1.6, 0, Math.PI * 2);
            g.arc(8, -21 + i * 4, 1.6, 0, Math.PI * 2);
            g.fill();
        }
        g.strokeStyle = p.skinShade;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(-3, -17);
        g.quadraticCurveTo(0, -15, 3, -17);
        g.stroke();
        g.restore();
        // belt
        g.fillStyle = p.belt;
        g.fillRect(-10, -9.5, 20, 3.2);
        g.fillStyle = p.buckle;
        g.fillRect(-2, -10, 4, 4.2);
        // arms
        Game.ellipse(g, -12.5, -15, 3.6, 6, p.skin, OUTLINE, 1.8, 0.25);
        Game.ellipse(g, 12.5, -15, 3.6, 6, p.skin, OUTLINE, 1.8, -0.25);
        // axe held up in the front hand
        if (!opts.noWeapon) Game.drawAxe(g, p, 14, -8, 0.32, 0.8);
        Game.ellipse(g, 13.5, -9.5, 3, 2.8, p.skin, OUTLINE, 1.6);
        // head
        Game.ellipse(g, 0, -28, 7.6, 7.4, p.skin, OUTLINE, 2);
        // beard + hair
        g.beginPath();
        g.moveTo(-7.4, -28);
        g.quadraticCurveTo(-7, -18, 0, -16.5);
        g.quadraticCurveTo(7, -18, 7.6, -28);
        g.quadraticCurveTo(4, -23, 0, -24);
        g.quadraticCurveTo(-4, -23, -7.4, -28);
        Game.blob(g, p.hair, OUTLINE, 1.8);
        Game.ellipse(g, -8.5, -26, 2.6, 5, p.hair, OUTLINE, 1.4);
        Game.ellipse(g, 2.5, -24.6, 3.6, 1.4, p.hairDark, null);
        Game.eyes(g, -1, 4.5, -29, 1.7, 0.8);
        // angry brows
        g.strokeStyle = OUTLINE;
        g.lineWidth = 1.6;
        g.beginPath();
        g.moveTo(-3, -32.2);
        g.lineTo(1, -31);
        g.moveTo(7, -32.2);
        g.lineTo(3, -31);
        g.stroke();
        // horned helmet
        if (!ex.noHelmet) {
            for (const s of [-1, 1]) {
                g.beginPath();
                g.moveTo(s * 6, -34);
                g.quadraticCurveTo(s * 15, -35, s * 15, -45);
                g.quadraticCurveTo(s * 12, -39, s * 5, -37.5);
                g.closePath();
                Game.blob(g, p.horn, OUTLINE, 1.6);
            }
            g.beginPath();
            g.moveTo(-8.4, -31);
            g.quadraticCurveTo(-8, -41, 0, -41.5);
            g.quadraticCurveTo(8, -41, 8.4, -31);
            g.closePath();
            Game.blob(g, p.helmet);
            g.fillStyle = p.helmetDark;
            g.fillRect(-8.4, -33.6, 16.8, 2.6);
            g.fillStyle = 'rgba(255,255,255,.6)';
            g.beginPath();
            g.ellipse(-3, -38.5, 2.4, 1.2, -0.4, 0, Math.PI * 2);
            g.fill();
        }
        if (ex.crown) Game.drawCrown(g, 0, -40, ex.crown);
        g.restore();
    },

    /** Two-headed axe; (x, y) is the hand, `rot` tilts it, `s` scales. */
    drawAxe(g, p, x, y, rot, s, handle = 1) {
        g.save();
        g.translate(x, y);
        g.rotate(rot);
        g.scale(s, s);
        const top = -28 * handle; // Longer Handle card stretches the shaft, not the blades
        g.strokeStyle = OUTLINE;
        g.lineWidth = 4.4;
        g.beginPath();
        g.moveTo(0, 6);
        g.lineTo(0, top);
        g.stroke();
        g.strokeStyle = p.axeHandle;
        g.lineWidth = 2.6;
        g.stroke();
        g.translate(0, top + 28);
        for (const side of [-1, 1]) {
            g.beginPath();
            g.moveTo(0, -27);
            g.quadraticCurveTo(side * 6, -30, side * 11, -34);
            g.quadraticCurveTo(side * 9, -25, side * 11, -16);
            g.quadraticCurveTo(side * 6, -20, 0, -21);
            g.closePath();
            Game.blob(g, p.axeHead, OUTLINE, 1.6);
            g.strokeStyle = p.axeEdge;
            g.lineWidth = 1;
            g.beginPath();
            g.moveTo(side * 9.5, -31);
            g.quadraticCurveTo(side * 8, -25, side * 9.5, -19);
            g.stroke();
        }
        g.restore();
    },

    drawGoblin(g, p, step, bob, opts) {
        const ex = p.extras || {};
        // big bare feet
        Game.ellipse(g, -5.5 + step * 3, 0, 4.8, 2.6, p.skin, OUTLINE, 1.6);
        Game.ellipse(g, 5.5 - step * 3, 0, 4.8, 2.6, p.skin, OUTLINE, 1.6);
        g.save();
        g.translate(0, bob);
        // legs
        g.fillStyle = p.pants;
        g.strokeStyle = OUTLINE;
        g.lineWidth = 1.6;
        for (const x of [-4.5 + step * 2, 4.5 - step * 2]) {
            g.beginPath();
            g.roundRect(x - 2.8, -7, 5.6, 6.5, 2);
            g.fill();
            g.stroke();
        }
        // body + vest
        Game.ellipse(g, 0, -12, 8.5, 7.5, p.skin, OUTLINE, 2);
        g.beginPath();
        g.moveTo(-8, -15);
        g.quadraticCurveTo(-9, -6, -5, -5);
        g.lineTo(-1.5, -5);
        g.lineTo(-1, -18);
        g.closePath();
        Game.blob(g, p.vest, OUTLINE, 1.4);
        g.beginPath();
        g.moveTo(8, -15);
        g.quadraticCurveTo(9, -6, 5, -5);
        g.lineTo(1.5, -5);
        g.lineTo(1, -18);
        g.closePath();
        Game.blob(g, p.vest, OUTLINE, 1.4);
        // satchel strap with spare bombs
        g.strokeStyle = p.vestDark;
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(-6, -17);
        g.lineTo(6, -6);
        g.stroke();
        Game.ellipse(g, -8.5, -6.5, 3, 2.6, p.satchel, OUTLINE, 1.2);
        // ears (behind head)
        for (const s of [-1, 1]) {
            g.beginPath();
            g.moveTo(s * 7, -27);
            g.quadraticCurveTo(s * 18, -32, s * 22, -28);
            g.quadraticCurveTo(s * 16, -23, s * 7, -21);
            g.closePath();
            Game.blob(g, p.ear, OUTLINE, 1.8);
            g.strokeStyle = p.skinShade;
            g.lineWidth = 1;
            g.beginPath();
            g.moveTo(s * 9, -25);
            g.quadraticCurveTo(s * 15, -27, s * 18, -27.5);
            g.stroke();
        }
        // head
        Game.ellipse(g, 0, -25, 9.5, 8.6, p.skin, OUTLINE, 2);
        // big eyes
        Game.ellipse(g, -2.5, -27, 3.1, 3.4, p.eye, OUTLINE, 1.4);
        Game.ellipse(g, 4.5, -27, 3.1, 3.4, p.eye, OUTLINE, 1.4);
        Game.ellipse(g, -1.7, -26.6, 1.3, 1.9, '#111827', null);
        Game.ellipse(g, 5.3, -26.6, 1.3, 1.9, '#111827', null);
        // nose
        Game.ellipse(g, 2.8, -23.2, 2.6, 1.7, p.skinShade, OUTLINE, 1.2);
        // grin with teeth
        g.beginPath();
        g.moveTo(-4, -20.5);
        g.quadraticCurveTo(1.5, -16, 7, -20.5);
        g.quadraticCurveTo(1.5, -18.6, -4, -20.5);
        Game.blob(g, '#3f1d1d', OUTLINE, 1.2);
        g.fillStyle = p.teeth;
        g.fillRect(-1.2, -20, 1.6, 1.6);
        g.fillRect(3, -20, 1.6, 1.6);
        // leather cap + goggles
        if (!ex.noCap) {
            g.beginPath();
            g.moveTo(-9, -28);
            g.quadraticCurveTo(-8, -36.5, 0.5, -36.5);
            g.quadraticCurveTo(9, -36.5, 9.6, -28);
            g.closePath();
            Game.blob(g, p.cap);
            Game.ellipse(g, -3, -32, 2.8, 2.3, p.goggle, OUTLINE, 1.2);
            Game.ellipse(g, 3.6, -32, 2.8, 2.3, p.goggle, OUTLINE, 1.2);
            Game.ellipse(g, -3, -32, 1.6, 1.3, p.lens, null);
            Game.ellipse(g, 3.6, -32, 1.6, 1.3, p.lens, null);
        }
        if (ex.pirate) {
            // tricorn hat with a tiny skull
            g.beginPath();
            g.moveTo(-14, -30);
            g.quadraticCurveTo(-8, -33, -6, -40);
            g.quadraticCurveTo(0.5, -36, 7, -40);
            g.quadraticCurveTo(9, -33, 15, -30);
            g.quadraticCurveTo(0.5, -27, -14, -30);
            g.closePath();
            Game.blob(g, '#111827', OUTLINE, 1.6);
            Game.ellipse(g, 0.5, -34, 2.2, 2, '#f8fafc', null);
            g.fillStyle = '#facc15';
            g.fillRect(-12, -30.8, 25, 1.4);
        }
        if (ex.crown) Game.drawCrown(g, 0.5, -34, ex.crown);
        // hand holding a lit bomb
        Game.ellipse(g, 10, -11, 2.6, 2.4, p.skin, OUTLINE, 1.4);
        if (!opts.noWeapon) {
            Game.ellipse(g, 13.5, -15, 4.6, 4.6, p.bomb, OUTLINE, 1.4);
            g.fillStyle = 'rgba(255,255,255,.35)';
            g.beginPath();
            g.arc(12, -16.5, 1.4, 0, Math.PI * 2);
            g.fill();
            g.strokeStyle = '#a8a29e';
            g.lineWidth = 1.4;
            g.beginPath();
            g.moveTo(15, -19);
            g.quadraticCurveTo(17, -23, 19.5, -22);
            g.stroke();
            Game.star(g, 19.8, -22.2, 2.6, p.fuse);
        }
        g.restore();
    },

    drawCrown(g, x, y, color) {
        g.beginPath();
        g.moveTo(x - 6, y);
        g.lineTo(x - 6, y - 5);
        g.lineTo(x - 3, y - 2.5);
        g.lineTo(x, y - 6.5);
        g.lineTo(x + 3, y - 2.5);
        g.lineTo(x + 6, y - 5);
        g.lineTo(x + 6, y);
        g.closePath();
        Game.blob(g, color, OUTLINE, 1.4);
    }
});
