/* Monster Hunter — sprites: the heroes as vector rigs, drawn live every frame (v3.13).
   Legs walk, arms cast / throw / swing, gear grows with the run level (GEAR_LEVELS) and skins recolour
   every piece and add their own signature parts. A light rim is drawn first (the same rig, every shape
   grown and filled with one colour) so the hero pops off the crowd. Extends Game. */

// Base palettes. Skins override any of these keys; missing gear colours are derived from them (gearPalette).
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
const SHADE = 'rgba(26,16,51,0.24)';

// Gear: run levels that add a piece (tier 1–4), and what each piece is called when it arrives.
const GEAR_LEVELS = [5, 10, 20, 30];
const GEAR_NAMES = {
    wizard: ['Spellbook Sash', 'Rune-stitched Robe', 'Starlight Cape', 'Archmage Aura'],
    barbarian: ['Leather Bracers', 'Spiked Pauldron', 'Bear-fur Cloak', 'Rune Axe'],
    goblin: ['Bomb Bandolier', 'Brass Goggles', 'Rocket Pack', 'Golden Hoard']
};
function gearTier(level) {
    let t = 0;
    for (const l of GEAR_LEVELS) if ((level || 0) >= l) t++;
    return t;
}

const HERO_HALO = { color: '#fffbeb', rim: 1.6 };
// While `sil` is set the shape helpers draw a grown silhouette in that colour (details are skipped).
const Ink = { sil: null, rim: 0 };

extendGame({
    palette(cls, skin) {
        const skins = typeof SKINS !== 'undefined' ? SKINS : {};
        const s = skin && skins[skin] && skins[skin].cls === cls ? skins[skin] : null;
        const p = { ...PALETTES[cls], ...(s ? s.palette : {}) };
        return { ...Game.gearPalette(cls, p), ...(s ? s.gear || {} : {}), extras: s ? s.extras || {} : {}, rarity: s ? s.rarity : '' };
    },

    /** Records an attack for the hero's pose: 'cast' (wizard) or 'throw' (goblin), towards `ang`. */
    heroAct(kind, ang) {
        const steps = this.cooldown / Math.max(0.2, this.rateMult || 1);
        this.heroAnim = { kind, ang, t0: this.frameNo || 0, dur: Math.max(6, Math.min(kind === 'throw' ? 18 : 14, Math.round(steps * 0.6))) };
    },

    /** The hero's pose this frame, from the game state. */
    heroPose(scale = 1) {
        const p = this.player;
        const f = this.frameNo || 0;
        const tier = gearTier(this.level || 1);
        // a new piece of gear is shown off when the level starts (not under the shop)
        if (this.gearShown == null || tier < this.gearShown || tier > this.gearShown + 1) this.gearShown = tier;
        else if (tier === this.gearShown + 1 && (this.phase === 'intro' || this.phase === 'fight')) {
            this.gearShown = tier;
            this.gearFanfare(tier);
        }
        const pose = {
            t: f, ph: p.walkPh || 0, walk: p.moveT > 0 ? Math.min(1, p.moveT / 4) : 0,
            face: p.facing || 1, tier: this.gearShown, act: null
        };
        const A = this.heroAnim;
        if (this.cls === 'barbarian') {
            const c = this.cleaves && this.cleaves.find(c => !c.whirl);
            if (c) {
                // both fists on the handle of the axe that drawCleaves draws on the arc
                const sweep = Math.min(1, c.t / (c.dur * 0.55));
                const a1 = c.angle + (-c.arc + 2 * c.arc * sweep) * c.dir;
                const r = 14 * Math.min(1.25, this.impactMult * 1.1);
                pose.act = { kind: 'swing', hx: (Math.cos(a1) * r * pose.face) / scale, hy: (-18 + Math.sin(a1) * r) / scale, ux: Math.cos(a1) * pose.face, uy: Math.sin(a1) };
            }
        } else if (this.cls === 'wizard' && this.barrage && this.barrage.left > 0) pose.act = { kind: 'barrage' };
        else if (this.cls === 'goblin' && this.bombRain && this.bombRain.left > 0) pose.act = { kind: 'rain' };
        if (!pose.act && A && f - A.t0 < A.dur && this.cls !== 'barbarian') {
            pose.act = { kind: A.kind, k: (f - A.t0) / A.dur, ang: A.ang };
            if (Math.abs(Math.cos(A.ang)) > 0.15) pose.face = Math.cos(A.ang) >= 0 ? 1 : -1; // turn to the target
        } else if (!pose.act && this.cls !== 'barbarian' && this.cooldown > 0) {
            // wind-up just before the next shot
            const left = this.cooldown / Math.max(0.2, this.rateMult || 1);
            const W = this.cls === 'goblin' ? 12 : 9;
            if (left < W) pose.act = { kind: 'wind', k: 1 - left / W };
        }
        if (pose.act && pose.act.ang !== undefined) {
            let la = pose.face > 0 ? pose.act.ang : Math.PI - pose.act.ang;
            la = Math.atan2(Math.sin(la), Math.cos(la));
            pose.act.la = Math.max(-1.3, Math.min(1.1, la));
        }
        return pose;
    },

    gearFanfare(tier) {
        const p = this.player;
        const name = (GEAR_NAMES[this.cls] || [])[tier - 1];
        if (!p || !name) return;
        const col = this.palette(this.cls, this.skin).trim || '#fde047';
        if (this.ring) {
            this.ring(p.x, p.y, 46, '#fffbeb', 18);
            this.ring(p.x, p.y, 30, col, 14);
        }
        if (this.spark) this.spark(p.x, p.y - 10, '#fde047', 10);
        if (this.floater) this.floater(p.x, p.y - 44, `✨ ${name}`, '#fde047', 20);
        if (typeof Sfx !== 'undefined' && Sfx.arpeggio) Sfx.arpeggio([523, 659, 784, 1047], 0.06, { type: 'triangle', volume: 0.12 });
    },

    /**
     * The player's hero at (x, y) = feet. opts: { face, sx (horizontal squash), act, halo }.
     */
    drawHero(ctx, x, y, scale = 1, opts = {}) {
        const pose = this.heroPose(scale);
        if (opts.face) pose.face = opts.face;
        if (opts.act) pose.act = opts.act;
        const pal = this.palette(this.cls, this.skin);
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scale * pose.face * (opts.sx || 1), scale);
        if (opts.halo !== false) {
            Ink.sil = HERO_HALO.color;
            Ink.rim = HERO_HALO.rim;
            try {
                Game.drawRig(ctx, this.cls, pal, pose);
            } finally {
                Ink.sil = null;
            }
        }
        Game.drawRig(ctx, this.cls, pal, pose);
        ctx.restore();
    },

    /** Kept for older callers: draws a class/skin at rest (frame > 0 = walking). */
    blitSprite(ctx, cls, skin, frame, x, y, scale = 1, facing = 1) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scale * facing, scale);
        Game.drawCharacter(ctx, cls, this.palette(cls, skin), frame, {});
        ctx.restore();
    },

    /** Gear tier shown on a portrait of this device's hero: the best level reached with the class. */
    portraitTier(cls) {
        return gearTier(this.classBest ? this.classBest(cls) : 0);
    },

    /** Menu / profile portrait on a square canvas. */
    drawPortrait(canvas, cls, skin = '', tier) {
        if (!canvas) return;
        const g = canvas.getContext('2d');
        if (!g) return;
        const S = canvas.width;
        g.clearRect(0, 0, S, S);
        const k = S / 64;
        g.save();
        g.scale(k, k);
        g.translate(32, 59);
        Game.drawCharacter(g, cls, this.palette(cls, skin), 0, { tier: tier === undefined ? this.portraitTier(cls) : tier });
        g.restore();
    },

    /** Replaces an element's contents with a small portrait canvas. */
    drawAvatar(el, cls, skin = '', tier) {
        if (!el) return;
        let cv = el.querySelector('canvas');
        if (!cv) {
            el.textContent = '';
            cv = document.createElement('canvas');
            cv.width = cv.height = 128;
            el.appendChild(cv);
        }
        this.drawPortrait(cv, cls, skin, tier);
    }
});

// ---------------------------------------------------------------- shape helpers
const lerp = (a, b, k) => a + (b - a) * k;
const lerpPt = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];

Object.assign(Game, {
    /** Gear colours a skin doesn't set are taken from its main colours, so every skin stays coherent. */
    gearPalette(cls, p) {
        const gold = '#facc15';
        if (cls === 'wizard') {
            return { cape: p.robeDark, lining: p.trim, mantle: p.hat, gem: p.orb, rune: p.orb, prong: gold, ...p };
        }
        if (cls === 'barbarian') {
            return { metal: p.helmet, metalDark: p.helmetDark, strap: p.belt, stud: p.buckle, paint: '#dc2626', cloak: p.fur, cloakLight: p.furLight, rune: '#38bdf8', hornTip: gold, ...p };
        }
        return { brass: '#d97706', brassLight: '#fbbf24', metal: '#94a3b8', pack: p.satchel, packBand: p.vestDark, gold, flame: '#fb923c', ...p };
    },

    blob(g, fill, stroke = OUTLINE, width = 2) {
        if (Ink.sil) {
            g.fillStyle = Ink.sil;
            g.fill();
            g.strokeStyle = Ink.sil;
            g.lineWidth = (stroke ? width : 0) + Ink.rim * 2;
            g.stroke();
            return;
        }
        g.fillStyle = fill;
        g.fill();
        if (stroke) {
            g.strokeStyle = stroke;
            g.lineWidth = width;
            g.stroke();
        }
    },

    /**
     * Fills the current path with a cel-shaded colour: the part away from the light (front-top)
     * darker. (cx, cy, rx, ry) is roughly the shape's ellipse.
     */
    cel(g, fill, cx, cy, rx, ry, stroke = OUTLINE, width = 2) {
        if (Ink.sil) return Game.blob(g, fill, stroke, width);
        g.fillStyle = fill;
        g.fill();
        g.save();
        g.clip();
        const sh = new Path2D();
        sh.rect(cx - rx * 2, cy - ry * 2, rx * 4, ry * 4);
        sh.ellipse(cx + rx * 0.32, cy - ry * 0.28, rx * 1.02, ry * 1.04, 0, 0, Math.PI * 2);
        g.fillStyle = SHADE;
        g.fill(sh, 'evenodd');
        g.restore();
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

    /** A shaded ball (heads, bellies, orbs). */
    ball(g, x, y, rx, ry, fill, width = 2) {
        g.beginPath();
        g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
        Game.cel(g, fill, x, y, rx, ry, OUTLINE, width);
    },

    /** An outlined tube through `pts` (limbs, straps, handles). */
    tube(g, pts, w, fill, outline = 1.6) {
        g.beginPath();
        pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        if (Ink.sil) {
            g.strokeStyle = Ink.sil;
            g.lineWidth = w + outline * 2 + Ink.rim * 2;
            g.stroke();
            return;
        }
        g.strokeStyle = OUTLINE;
        g.lineWidth = w + outline * 2;
        g.stroke();
        g.strokeStyle = fill;
        g.lineWidth = w;
        g.stroke();
    },

    /** Detail fill of the current path (skipped on the rim pass). */
    paint(g, fill) {
        if (Ink.sil) return;
        g.fillStyle = fill;
        g.fill();
    },

    dot(g, x, y, r, fill) {
        if (Ink.sil) return;
        g.fillStyle = fill;
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
    },

    line(g, pts, color, w = 1) {
        if (Ink.sil) return;
        g.strokeStyle = color;
        g.lineWidth = w;
        g.beginPath();
        pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.stroke();
    },

    glow(g, x, y, r, color, alpha = 1) {
        if (Ink.sil || r <= 0) return;
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, color);
        gr.addColorStop(1, `${color.slice(0, 7)}00`);
        const a = g.globalAlpha;
        g.globalAlpha = a * alpha;
        g.fillStyle = gr;
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = a;
    },

    star(g, x, y, r, fill, spin = 0) {
        if (Ink.sil) return;
        g.beginPath();
        for (let i = 0; i < 10; i++) {
            const a = (i * Math.PI) / 5 - Math.PI / 2 + spin;
            const rr = i % 2 ? r * 0.45 : r;
            g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        g.closePath();
        g.fillStyle = fill;
        g.fill();
    },

    /** Two-bone IK: the joint between `a` and the reach towards `b`; bend ±1 picks the side. */
    ik(a, b, l1, l2, bend) {
        let dx = b[0] - a[0];
        let dy = b[1] - a[1];
        let d = Math.hypot(dx, dy) || 0.001;
        const max = (l1 + l2) * 0.999;
        if (d > max) {
            dx *= max / d;
            dy *= max / d;
            d = max;
        }
        const end = [a[0] + dx, a[1] + dy];
        const c = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
        const ang = Math.atan2(dy, dx) + bend * Math.acos(Math.max(-1, Math.min(1, c)));
        return { joint: [a[0] + Math.cos(ang) * l1, a[1] + Math.sin(ang) * l1], end };
    },

    /** A limb from `a` reaching for `b`; returns where the hand / foot ends up. */
    limb(g, a, b, l1, l2, bend, w, fill) {
        const { joint, end } = Game.ik(a, b, l1, l2, bend);
        Game.tube(g, [a, joint, end], w, fill);
        return { joint, end };
    },

    /** Walk cycle: per leg the hip and where the foot is (back leg first). */
    legs(pose, hipY, spread, stride, lift) {
        const w = pose.walk;
        return [[-spread, pose.ph + Math.PI], [spread, pose.ph]].map(([hx, ph]) => ({
            hip: [hx, hipY],
            foot: [hx * 0.6 + Math.sin(ph) * stride * w, -Math.max(0, Math.cos(ph)) * lift * w],
            ph
        }));
    },

    eyes(g, pts, r, blink, look = 0.6) {
        for (const [x, y] of pts) {
            if (blink) {
                Game.line(g, [[x - r, y], [x + r, y]], OUTLINE, 1.3);
                continue;
            }
            Game.ellipse(g, x, y, r * 0.85, r * 1.1, '#1e1b4b', null);
            Game.dot(g, x + look * 0.5 - 0.3, y - r * 0.45, r * 0.38, '#fff');
        }
    },

    blinking(t) {
        return t % 220 < 7;
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
        Game.dot(g, x, y - 2, 1, '#f43f5e');
    },

    /** Orbiting motes (wizard's top gear): `front` picks the half in front of the body. */
    motes(g, cx, cy, t, color, front) {
        for (let i = 0; i < 3; i++) {
            const a = t * 0.05 + (i * Math.PI * 2) / 3;
            const z = Math.sin(a);
            if ((z > 0) !== front) continue;
            const x = cx + Math.cos(a) * 17;
            const y = cy + z * 5;
            const r = 2 + z * 0.6;
            Game.glow(g, x, y, r * 3, color, 0.7);
            if (Ink.sil) continue;
            g.beginPath();
            g.moveTo(x, y - r * 1.4);
            g.lineTo(x + r, y);
            g.lineTo(x, y + r * 1.4);
            g.lineTo(x - r, y);
            g.closePath();
            Game.blob(g, '#ffffff', color, 1);
        }
    },

    // ---------------------------------------------------------------- rigs

    /** Draws a class in a pose; (0, 0) = between the feet, facing +x. */
    drawRig(g, cls, pal, pose) {
        g.lineJoin = 'round';
        g.lineCap = 'round';
        if (cls === 'wizard') Game.rigWizard(g, pal, pose);
        else if (cls === 'barbarian') Game.rigBarbarian(g, pal, pose);
        else Game.rigGoblin(g, pal, pose);
        if (pal.rarity === 'mythic' && !Ink.sil) {
            // mythic skins twinkle
            const col = (pal.extras && pal.extras.aura) || '#fde047';
            for (let i = 0; i < 3; i++) {
                const k = ((pose.t * 0.012 + i / 3) % 1);
                const a = i * 2.1 + Math.floor(pose.t * 0.012 + i / 3) * 1.7;
                const r = Math.sin(k * Math.PI) * 2.2;
                Game.star(g, Math.cos(a) * 15, -24 + Math.sin(a) * 16, r, col, 0);
                Game.star(g, Math.cos(a) * 15, -24 + Math.sin(a) * 16, r * 0.5, '#ffffff', 0);
            }
        }
    },

    /** A still pose (frame > 0 = mid-stride); used by portraits and tools. */
    drawCharacter(g, cls, pal, frame = 0, opts = {}) {
        pal = { ...Game.gearPalette(cls, pal), extras: pal.extras || {} }; // a bare PALETTES entry works too
        const pose = { t: 0, ph: frame ? (frame * Math.PI) / 2 : 0, walk: frame ? 1 : 0, face: 1, tier: opts.tier || 0, act: opts.noWeapon ? { kind: 'noweapon' } : null };
        Game.drawRig(g, cls, pal, pose);
    },

    /** Body bob, idle breath and lean shared by the rigs. */
    bodyMotion(pose, hop = 1) {
        const w = pose.walk;
        const bob = -Math.abs(Math.sin(pose.ph)) * 1.8 * w * hop;
        const breath = w ? 0 : Math.sin(pose.t * 0.06) * 0.5 - 0.5;
        return { bob: bob + breath, lean: 0.07 * w, swing: Math.sin(pose.ph) * w };
    },

    // ---- wizard: robe, pointy hat, staff with an orb

    rigWizard(g, p, pose) {
        const ex = p.extras || {};
        const T = pose.tier;
        const act = pose.act || {};
        const t = pose.t;
        const { bob, lean, swing } = Game.bodyMotion(pose, 0.8);
        const legs = Game.legs(pose, -6, 2.5, 5, 2.4);
        // charge = the orb gathering power before a bolt; thrust = the bolt leaving
        const charge = act.kind === 'wind' ? act.k : 0;
        const thrust = act.kind === 'cast' ? (act.k < 0.25 ? act.k / 0.25 : 1 - (act.k - 0.25) / 0.75) : 0;
        const barrage = act.kind === 'barrage';
        // shoes peek out under the robe
        for (const l of legs) Game.ellipse(g, l.foot[0] + 1, l.foot[1] - 0.6, 4, 2.4, p.shoe, OUTLINE, 1.6);
        g.save();
        g.translate(0, bob);
        g.translate(0, -6);
        g.rotate(lean);
        g.translate(0, 6);
        // tier 3: starlight cape, streaming back while walking
        if (T >= 3) {
            const wave = Math.sin(t * 0.09 + pose.ph) * 1.5 + pose.walk * 3;
            g.beginPath();
            g.moveTo(-3, -18);
            g.quadraticCurveTo(-11 - wave, -12, -15 - wave * 1.4, -1);
            g.quadraticCurveTo(-11 - wave, 0.5, -8, -1);
            g.quadraticCurveTo(-6, 0.5, -3, -1.5);
            g.lineTo(4, -16);
            g.closePath();
            Game.cel(g, p.cape, -8, -9, 8, 10);
            g.save();
            if (!Ink.sil) {
                g.clip();
                Game.line(g, [[-3, -1.5], [-15 - wave * 1.4, -1]], p.lining, 2.4);
                Game.star(g, -9 - wave * 0.6, -8, 1.5, p.lining);
                Game.star(g, -12 - wave, -4, 1.1, p.lining);
            }
            g.restore();
        }
        if (T >= 4) Game.motes(g, 0, -14, t, p.rune, false);
        // back arm: swings with the walk; raised with an open palm while casting
        const sB = [-4, -15];
        let hB = [-7 - swing * 3, -7.5];
        if (thrust || charge) hB = lerpPt(hB, [-9, -19], Math.max(thrust, charge));
        if (barrage) hB = [-11.5, -20];
        // robe: its hem follows the feet
        const fB = legs[0].foot;
        const fF = legs[1].foot;
        const hemB = Math.min(-10.5, fB[0] - 5);
        const hemF = Math.max(10.5, fF[0] + 5);
        const robe = () => {
            g.beginPath();
            g.moveTo(-6, -17.5);
            g.quadraticCurveTo(-9, -8, hemB, -0.8);
            g.quadraticCurveTo(0, 2.2, hemF, -0.8);
            g.quadraticCurveTo(9, -8, 6.5, -17.5);
            g.closePath();
        };
        Game.limb(g, sB, hB, 4.8, 4.8, 1, 4.6, p.robeDark);
        Game.ellipse(g, hB[0], hB[1], 2.2, 2.2, p.skin, OUTLINE, 1.4);
        robe();
        Game.cel(g, p.robe, 0, -9, 11, 9);
        if (!Ink.sil) {
            g.save();
            robe();
            g.clip();
            // open front with a trim strip, trim band along the hem
            Game.line(g, [[2.5, -17], [3.5, 2]], p.robeDark, 2.6);
            Game.line(g, [[3.6, -17], [4.6, 2]], p.trim, 1);
            g.strokeStyle = p.trim;
            g.lineWidth = 2.6;
            g.beginPath();
            g.moveTo(hemB, 0.6);
            g.quadraticCurveTo(0, 3.6, hemF, 0.6);
            g.stroke();
            Game.star(g, -2.5, -9, 2.2, p.trim);
            Game.star(g, 7, -5, 1.6, p.trim);
            if (T >= 2) {
                // rune-stitched hem: little glowing glyphs above the trim
                const pulse = 0.6 + 0.4 * Math.sin(t * 0.08);
                g.globalAlpha = pulse;
                for (const [x, y] of [[-6, -2.2], [-1, -1.6], [6, -2]]) {
                    Game.line(g, [[x - 1, y + 1.2], [x, y - 1.2], [x + 1, y + 1.2]], p.rune, 1);
                    Game.dot(g, x, y + 0.2, 0.5, p.rune);
                }
                g.globalAlpha = 1;
            }
            g.restore();
        }
        // tier 1: a sash with a spellbook on the hip
        if (T >= 1) {
            g.beginPath();
            g.moveTo(-8.6, -11.5);
            g.quadraticCurveTo(0, -9.2, 9, -12);
            g.lineTo(9.6, -9.2);
            g.quadraticCurveTo(0, -6.4, -9.4, -8.6);
            g.closePath();
            Game.cel(g, p.trim, 0, -10, 9, 2, OUTLINE, 1.4);
            Game.tube(g, [[6.2, -9.8], [7.4, -5.4]], 1.6, p.trim, 1);
            g.save();
            g.translate(-8.5, -7.5);
            g.rotate(-0.2 + pose.walk * Math.sin(pose.ph) * 0.15);
            g.beginPath();
            g.roundRect(-3.2, -0.5, 6.4, 7, 1);
            Game.cel(g, p.mantle, 0, 3, 3.2, 3.5, OUTLINE, 1.4);
            Game.line(g, [[-3.2, 1.2], [3.2, 1.2]], p.trim, 0.9);
            Game.star(g, 0, 4, 1.3, p.trim);
            g.restore();
            Game.ellipse(g, 0.5, -9.6, 1.5, 1.5, p.gem, OUTLINE, 1);
        }
        // head, beard, face
        const hx = 1.5;
        const hy = -24;
        Game.ball(g, hx, hy, 8, 7.6, p.skin);
        Game.ellipse(g, hx + 5.4, hy + 2.4, 1.6, 1.1, p.cheek, null);
        const sway = Math.sin(t * 0.08) * 0.5 + swing * 0.8;
        g.beginPath();
        g.moveTo(hx - 6.5, hy + 0.5);
        g.quadraticCurveTo(hx - 5.5, hy + 11, hx + 2 + sway, hy + 15);
        g.quadraticCurveTo(hx + 8.5, hy + 10, hx + 8.2, hy + 2);
        g.quadraticCurveTo(hx + 3, hy + 6, hx - 6.5, hy + 0.5);
        Game.cel(g, p.beard, hx + 1, hy + 7, 7, 7, OUTLINE, 1.8);
        Game.line(g, [[hx + 1.5, hy + 7], [hx + 2 + sway * 0.6, hy + 12]], p.beardShade, 1);
        Game.line(g, [[hx + 4.5, hy + 6.5], [hx + 4.8 + sway * 0.4, hy + 10]], p.beardShade, 1);
        Game.ellipse(g, hx + 4.5, hy + 4.2, 4, 1.6, p.beard, OUTLINE, 1.2);
        Game.ellipse(g, hx + 6.6, hy + 2.2, 1.8, 1.6, p.skin, OUTLINE, 1.2);
        const glowEyes = T >= 4 || barrage;
        if (glowEyes && !Game.blinking(t)) {
            Game.glow(g, hx + 1.5, hy - 1, 3, p.rune, 0.8);
            Game.glow(g, hx + 5.6, hy - 1, 3, p.rune, 0.8);
        }
        Game.eyes(g, [[hx + 1.5, hy - 1], [hx + 5.6, hy - 1]], 1.8, Game.blinking(t));
        // bushy brows
        Game.ellipse(g, hx + 1.2, hy - 4, 2.2, 1, p.beard, OUTLINE, 0.9, -0.15);
        Game.ellipse(g, hx + 6, hy - 4, 2, 1, p.beard, OUTLINE, 0.9, 0.15);
        // hat: the tip flops and trails while walking
        if (!ex.noHat) {
            const flop = Math.sin(t * 0.07) * 1.2 - pose.walk * (1.5 + Math.abs(Math.sin(pose.ph)) * 1.5) + (barrage ? -2 : 0);
            g.beginPath();
            g.moveTo(hx - 8, hy - 5.5);
            g.quadraticCurveTo(hx - 6, hy - 18, hx - 3, hy - 21);
            g.quadraticCurveTo(hx - 5 + flop * 0.5, hy - 26, hx - 11 + flop, hy - 26);
            g.quadraticCurveTo(hx - 3, hy - 29 + Math.abs(flop) * 0.3, hx + 2, hy - 22);
            g.quadraticCurveTo(hx + 6, hy - 14, hx + 8.5, hy - 5.5);
            g.closePath();
            Game.cel(g, p.hat, hx, hy - 14, 8, 10);
            g.save();
            if (!Ink.sil) {
                g.clip();
                g.fillStyle = p.hatBand;
                g.fillRect(hx - 10, hy - 9.4, 20, 2.6);
            }
            g.restore();
            Game.ellipse(g, hx + 0.5, hy - 5.6, 13, 3.2, p.hat, OUTLINE, 2, -0.04);
            Game.star(g, hx + 1, hy - 13.5, 2.6, p.star, Math.sin(t * 0.04) * 0.3);
            if (T >= 4) {
                Game.glow(g, hx + 1, hy - 8.2, 5, p.gem, 0.8);
                Game.ellipse(g, hx + 1, hy - 8.1, 1.6, 1.4, p.gem, OUTLINE, 1);
            }
        }
        if (ex.crown) Game.drawCrown(g, hx + 0.5, hy - 5, ex.crown);
        // staff in the front hand
        const sF = [4.5, -15];
        let hF = [10.5 + swing * 1.2, -8];
        let tilt = 0.06 + swing * 0.05;
        if (charge) {
            hF = lerpPt(hF, [9.5, -9.5], charge);
            tilt -= 0.1 * charge;
        }
        if (thrust) {
            const la = act.la || 0;
            hF = lerpPt(hF, [sF[0] + Math.cos(la) * 9.5, sF[1] + Math.sin(la) * 9.5], thrust);
            tilt = lerp(tilt, la + Math.PI / 2, thrust * 0.85);
        }
        if (barrage) {
            hF = [11, -22];
            tilt = 0.1 + Math.sin(t * 0.3) * 0.08;
        }
        const noStaff = act.kind === 'noweapon';
        if (!noStaff) {
            const dir = [Math.sin(tilt), -Math.cos(tilt)];
            const top = [hF[0] + dir[0] * 23, hF[1] + dir[1] * 23];
            const bot = [hF[0] - dir[0] * 10, hF[1] - dir[1] * 10];
            Game.tube(g, [bot, top], 2.4, p.staff);
            const orb = [top[0] + dir[0] * 3.5, top[1] + dir[1] * 3.5];
            const power = Math.max(charge, thrust * 1.3, barrage ? 1.2 + Math.sin(t * 0.4) * 0.3 : 0);
            Game.glow(g, orb[0], orb[1], 9 + power * 9, p.orb, 0.9);
            if (T >= 2) {
                // crescent prongs cradle the orb
                const n = [dir[1], -dir[0]];
                for (const s of [-1, 1]) {
                    const tip = [orb[0] + n[0] * s * 4.6 + dir[0] * 3, orb[1] + n[1] * s * 4.6 + dir[1] * 3];
                    const mid = [top[0] + n[0] * s * 4.2, top[1] + n[1] * s * 4.2];
                    Game.tube(g, [top, mid, tip], 1.4, p.prong, 1.2);
                }
            }
            Game.ellipse(g, orb[0], orb[1], 4.2 + power * 0.8, 4.2 + power * 0.8, p.orb, OUTLINE, 1.6);
            Game.dot(g, orb[0] - 1.3, orb[1] - 1.4, 1.4, 'rgba(255,255,255,.85)');
        }
        Game.limb(g, sF, hF, 4.8, 4.8, 1, 4.6, p.robe);
        Game.ellipse(g, hF[0], hF[1], 2.4, 2.4, p.skin, OUTLINE, 1.5);
        if (T >= 4) Game.motes(g, 0, -14, t, p.rune, true);
        g.restore();
    },

    // ---- barbarian: bare chest, fur, horned helmet, two-headed axe

    rigBarbarian(g, p, pose) {
        const ex = p.extras || {};
        const T = pose.tier;
        const act = pose.act || {};
        const t = pose.t;
        const { bob, lean, swing } = Game.bodyMotion(pose, 1);
        const legs = Game.legs(pose, -9, 3, 5.5, 3.2);
        const swingAct = act.kind === 'swing';
        const spin = act.kind === 'spin';
        let tilt = lean;
        if (swingAct) tilt += Math.max(-0.25, Math.min(0.25, act.hx * 0.02));
        // legs and boots (the back one a shade darker)
        legs.forEach((l, i) => {
            const hip = [l.hip[0], l.hip[1] + bob * 0.6];
            const knee = Game.limb(g, hip, l.foot, 5, 5, -1, 5.6, i ? p.pants : Game.darker(p.pants));
            Game.ellipse(g, knee.end[0] + 1.5, knee.end[1] - 0.6, 4.6, 2.9, p.boot, OUTLINE, 1.6);
            if (!Ink.sil) Game.line(g, [[knee.end[0] - 1.5, knee.end[1] - 2.6], [knee.end[0] + 3.5, knee.end[1] - 2.8]], p.furLight, 1.3);
        });
        g.save();
        g.translate(0, bob);
        g.translate(0, -9);
        g.rotate(tilt);
        g.translate(0, 9);
        // tier 3: bear-fur cloak behind the shoulders
        if (T >= 3) {
            const wave = Math.sin(t * 0.08 + pose.ph) * 1.2 + pose.walk * 2.5;
            g.beginPath();
            g.moveTo(-8, -25);
            g.quadraticCurveTo(-18 - wave, -16, -19 - wave * 1.4, -2.5);
            for (let i = 0; i < 6; i++) g.lineTo(-19 - wave * 1.4 + i * 2.8, -2.5 + (i % 2 ? -2.2 : 0.8));
            g.lineTo(-3, -6);
            g.lineTo(2, -24);
            g.closePath();
            Game.cel(g, p.cloak, -10, -13, 9, 11);
            Game.line(g, [[-12, -18], [-15 - wave, -6]], p.cloakLight, 1.2);
        }
        // back arm
        const sB = [-8, -19];
        let hB = [-11 - swing * 3, -9.5];
        if (swingAct) hB = [act.hx - (act.ux || 0) * 4, act.hy - (act.uy || 0) * 4];
        if (spin) hB = [-13, -19];
        const backArm = Game.limb(g, sB, hB, 5.5, 5.5, 1, 6.2, Game.darker(p.skin));
        if (T >= 1) Game.bracer(g, backArm, p);
        Game.ellipse(g, backArm.end[0], backArm.end[1], 3, 2.8, Game.darker(p.skin), OUTLINE, 1.6);
        if (T >= 4) Game.pauldron(g, -8.5, -21.5, p, false);
        // torso: bare chest in a fur vest
        const torso = () => {
            g.beginPath();
            g.moveTo(-10, -24);
            g.quadraticCurveTo(-13, -14, -8.5, -7.5);
            g.lineTo(8.5, -7.5);
            g.quadraticCurveTo(13, -14, 10, -24);
            g.quadraticCurveTo(0, -27, -10, -24);
            g.closePath();
        };
        torso();
        Game.cel(g, p.skin, 0, -16, 11, 9);
        if (!Ink.sil) {
            g.save();
            torso();
            g.clip();
            g.fillStyle = p.fur;
            g.fillRect(-14, -28, 8, 22);
            g.fillRect(7.5, -28, 7, 22);
            for (let i = 0; i < 5; i++) {
                Game.dot(g, -6.5, -24 + i * 4, 1.7, p.furLight);
                Game.dot(g, 7.8, -24 + i * 4, 1.5, p.furLight);
            }
            Game.line(g, [[-3, -18], [0, -16.5], [3, -18]], p.skinShade, 1);
            Game.line(g, [[0, -15], [0, -11]], p.skinShade, 0.9);
            g.restore();
        }
        // tier 3: the cloak's fur collar across the shoulders
        if (T >= 3) {
            for (const [x, y, r] of [[-10, -23.5, 3.4], [-6.5, -25.5, 3.6], [-2.5, -26.2, 3.4], [1.5, -26, 3]]) {
                Game.ellipse(g, x, y, r, r * 0.85, p.cloakLight, OUTLINE, 1.4);
            }
        }
        // tier 1: leather strap across the chest
        if (T >= 1) {
            Game.tube(g, [[-8, -23.5], [7.5, -9]], 2.2, p.strap, 1.1);
            for (const k of [0.25, 0.5, 0.75]) Game.dot(g, lerp(-8, 7.5, k), lerp(-23.5, -9, k), 0.8, p.stud);
        }
        // belt
        g.beginPath();
        g.rect(-9.5, -10, 19, 3.4);
        Game.blob(g, p.belt, OUTLINE, 1.2);
        g.beginPath();
        g.rect(-2, -10.6, 4.4, 4.6);
        Game.blob(g, p.buckle, OUTLINE, 1);
        if (T >= 3) {
            // a trophy skull on the belt
            Game.ellipse(g, -6, -7.2, 2.4, 2.2, '#f5f5f4', OUTLINE, 1);
            Game.dot(g, -6.8, -7.4, 0.6, OUTLINE);
            Game.dot(g, -5.2, -7.4, 0.6, OUTLINE);
        }
        // front arm with the axe
        const sF = [9.5, -19.5];
        let hF = [14.5 + swing * 1.5, -9.5];
        if (swingAct) hF = [act.hx, act.hy];
        if (spin) hF = [13, -19];
        const noAxe = swingAct || spin || act.kind === 'noweapon';
        const armsUp = swingAct && hF[1] < -23;
        const drawFront = () => {
            if (!noAxe) Game.drawAxe(g, p, hF[0] + 0.5, hF[1] + 1.5, 0.32 + swing * 0.08, 0.8, 1, T >= 4 ? t : null);
            const frontArm = Game.limb(g, sF, hF, 5.5, 5.5, 1, 6.2, p.skin);
            if (T >= 1) Game.bracer(g, frontArm, p);
            Game.ellipse(g, frontArm.end[0], frontArm.end[1], 3.1, 2.9, p.skin, OUTLINE, 1.6);
            if (T >= 2) Game.pauldron(g, 9.8, -22, p, true);
        };
        if (armsUp) drawFront();
        // head: beard, hair, angry face
        const hx = 1.5;
        const hy = -29;
        Game.ball(g, hx, hy, 7.6, 7.4, p.skin);
        if (T >= 2 && !Ink.sil) {
            // war paint
            Game.line(g, [[hx + 2, hy + 1.6], [hx + 5.5, hy + 0.6]], p.paint, 1.2);
            Game.line(g, [[hx + 2.4, hy + 3.2], [hx + 5.8, hy + 2.2]], p.paint, 1.2);
        }
        g.beginPath();
        g.moveTo(hx - 7.4, hy);
        g.quadraticCurveTo(hx - 7, hy + 10, hx + 1, hy + 12 + Math.sin(t * 0.07) * 0.4);
        g.quadraticCurveTo(hx + 7.5, hy + 10, hx + 7.6, hy + 1);
        g.quadraticCurveTo(hx + 4, hy + 5, hx + 1, hy + 4);
        g.quadraticCurveTo(hx - 3, hy + 5, hx - 7.4, hy);
        Game.cel(g, p.hair, hx, hy + 6, 7, 6, OUTLINE, 1.8);
        Game.ellipse(g, hx - 8, hy + 2, 2.6, 5, p.hair, OUTLINE, 1.4);
        Game.ellipse(g, hx + 3.2, hy + 4.4, 3.6, 1.4, p.hairDark, null);
        const glowEyes = T >= 4 || spin;
        if (glowEyes && !Game.blinking(t)) {
            Game.glow(g, hx + 1, hy - 1, 3, p.rune, 0.8);
            Game.glow(g, hx + 5.2, hy - 1, 3, p.rune, 0.8);
        }
        Game.eyes(g, [[hx + 1, hy - 0.8], [hx + 5.2, hy - 0.8]], 1.7, Game.blinking(t) && !swingAct, 0.8);
        Game.line(g, [[hx - 1.4, hy - 4.4], [hx + 2.4, hy - 2.8]], OUTLINE, 1.6);
        Game.line(g, [[hx + 7.2, hy - 4.4], [hx + 4, hy - 2.8]], OUTLINE, 1.6);
        if (swingAct || spin) {
            // battle roar
            Game.ellipse(g, hx + 3.4, hy + 4.6, 1.8, 1.4, '#3f1d1d', OUTLINE, 1);
        }
        // horned helmet
        if (!ex.noHelmet) {
            for (const s of [-1, 1]) {
                g.beginPath();
                g.moveTo(hx + s * 6, hy - 5);
                g.quadraticCurveTo(hx + s * 15, hy - 6, hx + s * 15, hy - 16);
                g.quadraticCurveTo(hx + s * 12, hy - 10, hx + s * 5, hy - 8.5);
                g.closePath();
                Game.blob(g, p.horn, OUTLINE, 1.6);
                if (T >= 4 && !Ink.sil) {
                    g.save();
                    g.clip();
                    Game.dot(g, hx + s * 15, hy - 15.5, 3.4, p.hornTip);
                    g.restore();
                }
            }
            g.beginPath();
            g.moveTo(hx - 8.4, hy - 2);
            g.quadraticCurveTo(hx - 8, hy - 12, hx, hy - 12.5);
            g.quadraticCurveTo(hx + 8, hy - 12, hx + 8.4, hy - 2);
            g.closePath();
            Game.cel(g, p.helmet, hx, hy - 6, 8, 6);
            g.beginPath();
            g.rect(hx - 8.4, hy - 4.6, 16.8, 2.6);
            Game.blob(g, p.helmetDark, null);
            for (const x of [-5, 0, 5]) Game.dot(g, hx + x, hy - 3.3, 0.6, p.helmet);
            Game.dot(g, hx + 2.6, hy - 9.4, 1.4, 'rgba(255,255,255,.6)');
        }
        if (ex.crown) Game.drawCrown(g, hx, hy - 11, ex.crown);
        if (!armsUp) drawFront();
        g.restore();
    },

    darker(hex, k = 0.82) {
        const n = parseInt(hex.slice(1, 7), 16);
        const c = s => Math.round(((n >> s) & 255) * k);
        return `rgb(${c(16)},${c(8)},${c(0)})`;
    },

    /** Leather bracer on a forearm. */
    bracer(g, arm, p) {
        const a = lerpPt(arm.joint, arm.end, 0.45);
        const b = lerpPt(arm.joint, arm.end, 0.85);
        Game.tube(g, [a, b], 6.4, p.strap, 1.2);
        Game.line(g, [lerpPt(a, b, 0.5), lerpPt(a, b, 0.52)], p.stud, 1.4);
    },

    /** Spiked iron pauldron on a shoulder. */
    pauldron(g, x, y, p, front) {
        for (const s of front ? [-1, 1] : [0]) {
            g.beginPath();
            g.moveTo(x + s * 2.5 - 1.4, y - 3);
            g.lineTo(x + s * 3.5, y - 8);
            g.lineTo(x + s * 2.5 + 1.4, y - 3);
            g.closePath();
            Game.blob(g, p.horn, OUTLINE, 1.2);
        }
        g.beginPath();
        g.ellipse(x, y, 5.6, 4.2, 0, Math.PI * 1.02, Math.PI * 1.98);
        g.quadraticCurveTo(x, y + 3, x - 5.6, y);
        g.closePath();
        Game.cel(g, p.metal, x, y - 1, 5.6, 4, OUTLINE, 1.6);
        Game.line(g, [[x - 4, y + 0.6], [x + 4, y + 0.6]], p.metalDark, 1);
    },

    /** Two-headed axe; (x, y) is the hand, `rot` tilts it, `s` scales. `runes` = time for glowing runes. */
    drawAxe(g, p, x, y, rot, s, handle = 1, runes = null) {
        g.save();
        g.translate(x, y);
        g.rotate(rot);
        g.scale(s, s);
        const top = -28 * handle; // Longer Handle card stretches the shaft, not the blades
        g.lineCap = 'round';
        g.lineJoin = 'round';
        Game.tube(g, [[0, 6], [0, top]], 2.6, p.axeHandle, 1);
        g.translate(0, top + 28);
        for (const side of [-1, 1]) {
            g.beginPath();
            g.moveTo(0, -27);
            g.quadraticCurveTo(side * 6, -30, side * 11, -34);
            g.quadraticCurveTo(side * 9, -25, side * 11, -16);
            g.quadraticCurveTo(side * 6, -20, 0, -21);
            g.closePath();
            Game.blob(g, p.axeHead, OUTLINE, 1.6);
            Game.line(g, [[side * 9.5, -31], [side * 8, -25], [side * 9.5, -19]], p.axeEdge, 1);
            if (runes !== null && p.rune) {
                Game.glow(g, side * 6, -25, 6, p.rune, 0.5 + 0.3 * Math.sin(runes * 0.12 + side));
                Game.line(g, [[side * 4.5, -27], [side * 6.5, -25], [side * 4.5, -23]], p.rune, 1.2);
            }
        }
        Game.ellipse(g, 0, -24, 2.2, 2.2, p.axeEdge, OUTLINE, 1.2);
        g.restore();
    },

    // ---- goblin: big ears, goggles, a lit bomb

    rigGoblin(g, p, pose) {
        const ex = p.extras || {};
        const T = pose.tier;
        const act = pose.act || {};
        const t = pose.t;
        const { bob, lean, swing } = Game.bodyMotion(pose, 1.3);
        const legs = Game.legs(pose, -6.5, 2.4, 5, 3);
        const rain = act.kind === 'rain';
        // throw: the arm whips from behind the head through to the front
        let throwK = -1;
        if (act.kind === 'throw') throwK = act.k;
        const wind = act.kind === 'wind' ? act.k : 0;
        // tier 3: rocket pack (behind everything)
        g.save();
        g.translate(0, bob);
        g.translate(0, -7);
        g.rotate(lean * 1.4);
        g.translate(0, 7);
        if (T >= 3) {
            if (pose.walk > 0 && !Ink.sil) {
                for (let i = 0; i < 3; i++) {
                    const k = ((t * 0.04 + i / 3) % 1);
                    g.globalAlpha = (1 - k) * 0.5 * pose.walk;
                    Game.dot(g, -12 - k * 10, -4 + k * 2 - Math.sin(k * 6) * 1.5, 1.5 + k * 3, '#e7e5e4');
                }
                g.globalAlpha = 1;
                if (T >= 4) {
                    const fl = 3 + Math.sin(t * 0.9) * 1.2;
                    Game.glow(g, -11.5, -4 + fl * 0.5, 5, p.flame, 0.9);
                    g.beginPath();
                    g.moveTo(-13.4, -5.6);
                    g.quadraticCurveTo(-11.5, -5.6 + fl * 2.2, -9.6, -5.6);
                    g.closePath();
                    Game.paint(g, p.brassLight);
                }
            }
            g.save();
            g.translate(-10, -11.5);
            g.rotate(-0.18);
            for (const s of [-1, 1]) {
                g.beginPath();
                g.moveTo(s * 3, 2);
                g.lineTo(s * 6, 6);
                g.lineTo(s * 3, 5);
                g.closePath();
                Game.blob(g, p.metal, OUTLINE, 1);
            }
            g.beginPath();
            g.roundRect(-3.6, -6.5, 7.2, 12, 3);
            Game.cel(g, p.pack, 0, 0, 3.6, 6, OUTLINE, 1.6);
            for (const y of [-3, 2]) {
                g.beginPath();
                g.rect(-3.8, y, 7.6, 1.4);
                Game.blob(g, p.packBand, null);
            }
            g.beginPath();
            g.moveTo(-2, 5.5);
            g.lineTo(2, 5.5);
            g.lineTo(2.6, 8);
            g.lineTo(-2.6, 8);
            g.closePath();
            Game.blob(g, p.metal, OUTLINE, 1.2);
            g.restore();
        }
        g.restore();
        // legs: short trousers, skinny shins, big bare feet
        legs.forEach((l, i) => {
            const hip = [l.hip[0], l.hip[1] + bob * 0.6];
            const { joint, end } = Game.ik(hip, l.foot, 3.6, 3.6, -1);
            Game.tube(g, [joint, end], 2.8, i ? p.skin : Game.darker(p.skin));
            Game.tube(g, [hip, joint], 4.4, i ? p.pants : Game.darker(p.pants));
            Game.ellipse(g, end[0] + 2, end[1] - 0.4, 4.6, 2.3, i ? p.skin : Game.darker(p.skin), OUTLINE, 1.5);
        });
        g.save();
        g.translate(0, bob);
        g.translate(0, -7);
        g.rotate(lean * 1.4);
        g.translate(0, 7);
        const hx = 1.5;
        const hy = -25;
        // ears flop with every step
        const flopB = Math.sin(pose.ph + 0.6) * 2 * pose.walk + Math.sin(t * 0.05) * 0.4;
        const flopF = Math.sin(pose.ph + 2) * 2 * pose.walk + (t % 300 < 10 ? -2 : 0);
        Game.ear(g, hx - 6, hy - 1, -1, flopB, p, false);
        // back arm
        const sB = [-4, -16];
        let hB = [-7.5 - swing * 3, -9];
        if (rain) hB = [-11, -23 + Math.sin(t * 0.4) * 1.5];
        if (wind) hB = lerpPt(hB, [4, -13], wind); // reaching forward to aim
        const backArm = Game.limb(g, sB, hB, 4.4, 4.4, 1, 3.2, Game.darker(p.skin));
        Game.ellipse(g, backArm.end[0], backArm.end[1], 2.2, 2.1, Game.darker(p.skin), OUTLINE, 1.3);
        // pot belly in a vest
        Game.ball(g, 0.5, -12, 8, 7, p.skin);
        for (const s of [-1, 1]) {
            g.beginPath();
            g.moveTo(s * 7.5 + 0.5, -15);
            g.quadraticCurveTo(s * 8.8 + 0.5, -7, s * 5 + 0.5, -5.4);
            g.lineTo(s * 1.6 + 0.5, -5.4);
            g.lineTo(s * 1.2 + 0.5, -18.4);
            g.closePath();
            Game.blob(g, s < 0 ? Game.darker(p.vest) : p.vest, OUTLINE, 1.4);
        }
        // satchel strap, or (tier 1) a bandolier of little bombs
        if (T >= 1) {
            Game.tube(g, [[-6, -17.5], [7, -6.5]], 2.2, p.vestDark, 1);
            for (const k of [0.22, 0.5, 0.78]) {
                const x = lerp(-6, 7, k);
                const y = lerp(-17.5, -6.5, k);
                Game.ellipse(g, x, y - 0.4, 1.9, 1.9, p.bomb, OUTLINE, 0.9);
                Game.dot(g, x + 0.6, y - 2.5, 0.6, p.fuse);
            }
        } else Game.line(g, [[-6, -17], [6, -6]], p.vestDark, 2);
        Game.ellipse(g, -8.5, -6.5, 3, 2.6, p.satchel, OUTLINE, 1.2);
        // front arm with a bomb
        let sF = [5, -16];
        let hF = [10 + swing * 1.5, -11];
        let bomb = 1;
        const cocked = [-9.5, -20.5];
        if (wind) {
            sF = lerpPt(sF, [-0.5, -17], wind);
            hF = lerpPt(hF, cocked, wind);
        }
        if (throwK >= 0) {
            const la = act.la || 0;
            const release = [sF[0] + Math.cos(la - 0.5) * 9, sF[1] + Math.sin(la - 0.5) * 9];
            if (throwK < 0.3) {
                sF = lerpPt([-0.5, -17], sF, throwK / 0.3);
                hF = lerpPt(cocked, release, throwK / 0.3);
            }
            else if (throwK < 0.65) hF = lerpPt(release, [11, -6], (throwK - 0.3) / 0.35);
            else hF = lerpPt([11, -6], hF, (throwK - 0.65) / 0.35);
            bomb = throwK < 0.12 ? 1 : throwK < 0.7 ? 0 : (throwK - 0.7) / 0.3;
        }
        if (rain) {
            hF = [13, -24 + Math.sin(t * 0.4 + 2) * 1.5];
            bomb = 0;
        }
        if (act.kind === 'noweapon') bomb = 0;
        const armBehind = wind > 0.35 || (throwK >= 0 && throwK < 0.14);
        const drawFront = () => {
            const frontArm = Game.limb(g, sF, hF, 5, 5, wind || throwK >= 0 ? -1 : 1, 3.2, p.skin);
            const hand = frontArm.end;
            if (bomb > 0) Game.bomb(g, p, hand[0] + (armBehind ? -1.5 : 2.4), hand[1] - 3.4, 4.4 * bomb, t, T >= 4);
            Game.ellipse(g, hand[0], hand[1], 2.4, 2.2, p.skin, OUTLINE, 1.3);
        };
        if (armBehind) drawFront();
        // the front ear (hoop earring at tier 4) also sits behind the head
        Game.ear(g, hx + 6, hy - 1.5, 1, flopF, p, T >= 4);
        // head
        Game.ball(g, hx, hy, 9.5, 8.6, p.skin);
        // big eyes (goggles over them at tier 2), long nose, grin
        const blink = Game.blinking(t + 50);
        for (const [x, r] of [[hx + 0.5, 3], [hx + 6.2, 3.2]]) {
            if (blink) {
                Game.line(g, [[x - r, hy - 2], [x + r, hy - 2]], OUTLINE, 1.3);
                continue;
            }
            Game.ellipse(g, x, hy - 2, r, r * 1.1, p.eye, OUTLINE, 1.4);
            Game.ellipse(g, x + 0.9, hy - 1.6, r * 0.42, r * 0.62, '#111827', null);
            Game.dot(g, x + 0.4, hy - 2.6, 0.5, '#fff');
        }
        g.beginPath();
        g.moveTo(hx + 3.8, hy + 1.6);
        g.quadraticCurveTo(hx + 12.5, hy + 1.4, hx + 10.8, hy + 4);
        g.quadraticCurveTo(hx + 7, hy + 4.8, hx + 3.6, hy + 3.8);
        g.closePath();
        Game.blob(g, p.skinShade, OUTLINE, 1.2);
        const open = rain || throwK >= 0 ? 1 : 0;
        g.beginPath();
        g.moveTo(hx - 3, hy + 5);
        g.quadraticCurveTo(hx + 2, hy + 9.5 + open * 1.5, hx + 6.5, hy + 5.8);
        g.quadraticCurveTo(hx + 2, hy + 7 - open, hx - 3, hy + 5);
        Game.blob(g, '#3f1d1d', OUTLINE, 1.2);
        if (!Ink.sil) {
            g.fillStyle = p.teeth;
            g.fillRect(hx - 0.6, hy + 5.6, 1.6, 1.5);
            g.fillStyle = T >= 4 ? p.gold : p.teeth;
            g.fillRect(hx + 3.2, hy + 5.9, 1.6, 1.5);
        }
        // cap + goggles
        if (!ex.noCap) {
            g.beginPath();
            g.moveTo(hx - 9, hy - 3);
            g.quadraticCurveTo(hx - 8, hy - 11.5, hx + 0.5, hy - 11.5);
            g.quadraticCurveTo(hx + 9, hy - 11.5, hx + 9.6, hy - 3);
            g.closePath();
            Game.cel(g, p.cap, hx, hy - 7, 9, 5);
        }
        if (T >= 2) {
            // brass goggles: strap round the head, big lenses with a glint
            Game.tube(g, [[hx - 9, hy - 6.2], [hx + 9.4, hy - 6.6]], 1.6, '#292524', 0.8);
            for (const x of [hx - 1, hx + 5.6]) {
                Game.ellipse(g, x, hy - 7, 3.4, 3, p.brass, OUTLINE, 1.3);
                Game.ellipse(g, x, hy - 7, 2.3, 2, p.lens, null);
                Game.dot(g, x - 0.8, hy - 7.8, 0.7, '#fff');
            }
        } else if (!ex.noCap) {
            Game.ellipse(g, hx - 1, hy - 7, 2.8, 2.3, p.goggle, OUTLINE, 1.2);
            Game.ellipse(g, hx + 5, hy - 7, 2.8, 2.3, p.goggle, OUTLINE, 1.2);
            Game.ellipse(g, hx - 1, hy - 7, 1.6, 1.3, p.lens, null);
            Game.ellipse(g, hx + 5, hy - 7, 1.6, 1.3, p.lens, null);
        }
        if (ex.pirate) {
            // tricorn hat with a tiny skull
            g.beginPath();
            g.moveTo(hx - 14, hy - 5);
            g.quadraticCurveTo(hx - 8, hy - 8, hx - 6, hy - 15);
            g.quadraticCurveTo(hx + 0.5, hy - 11, hx + 7, hy - 15);
            g.quadraticCurveTo(hx + 9, hy - 8, hx + 15, hy - 5);
            g.quadraticCurveTo(hx + 0.5, hy - 2, hx - 14, hy - 5);
            g.closePath();
            Game.cel(g, '#111827', hx, hy - 8, 12, 5, OUTLINE, 1.6);
            Game.ellipse(g, hx + 0.5, hy - 9, 2.2, 2, '#f8fafc', null);
            if (!Ink.sil) {
                g.fillStyle = '#facc15';
                g.fillRect(hx - 12, hy - 5.8, 25, 1.4);
            }
        }
        if (ex.crown) Game.drawCrown(g, hx + 0.5, hy - 9, ex.crown);
        if (!armBehind) drawFront();
        if (T >= 2) {
            // a scrap-metal shoulder pad
            g.beginPath();
            g.ellipse(5, -16.5, 3.6, 2.6, 0, Math.PI, Math.PI * 2);
            g.closePath();
            Game.blob(g, p.metal, OUTLINE, 1.2);
            Game.dot(g, 5, -17.5, 0.6, '#475569');
        }
        g.restore();
    },

    /** A goblin ear from the side of the head (`s` = -1 back, +1 front). */
    ear(g, x, y, s, flop, p, ring) {
        const tip = [x + s * 13, y - 5 + flop];
        g.beginPath();
        g.moveTo(x, y - 3.5);
        g.quadraticCurveTo(x + s * 7, y - 6 + flop * 0.5, tip[0], tip[1]);
        g.quadraticCurveTo(x + s * 8, y + 3 + flop * 0.3, x, y + 3.5);
        g.closePath();
        Game.cel(g, p.ear, x + s * 5, y, 6, 4, OUTLINE, 1.7);
        Game.line(g, [[x + s * 2, y - 0.5], [x + s * 7, y - 2 + flop * 0.4], [x + s * 10.5, y - 3.8 + flop * 0.8]], p.skinShade, 1);
        if (ring && !Ink.sil) {
            g.strokeStyle = p.gold;
            g.lineWidth = 1.2;
            g.beginPath();
            g.arc(x + s * 5, y + 4.2 + flop * 0.4, 1.8, 0, Math.PI * 2);
            g.stroke();
        }
    },

    /** A lit bomb centred at (x, y). */
    bomb(g, p, x, y, r, t, hot) {
        if (hot) Game.glow(g, x, y, r * 2.4, p.flame, 0.35 + 0.15 * Math.sin(t * 0.5));
        Game.ellipse(g, x, y, r, r, p.bomb, OUTLINE, 1.4);
        Game.dot(g, x - r * 0.35, y - r * 0.35, r * 0.3, 'rgba(255,255,255,.35)');
        Game.line(g, [[x + r * 0.35, y - r * 0.9], [x + r * 0.6, y - r * 1.5], [x + r * 1.15, y - r * 1.4]], '#a8a29e', 1.4);
        const fl = 0.8 + 0.3 * Math.sin(t * 0.9);
        Game.glow(g, x + r * 1.2, y - r * 1.45, r * 1.3 * fl, p.fuse, 0.7);
        Game.star(g, x + r * 1.2, y - r * 1.45, r * 0.6 * fl, p.fuse, t * 0.3);
    }
});
