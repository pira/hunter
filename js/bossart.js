/* Monster Hunter — boss and gatekeeper looks.
   v3.9: every boss and gatekeeper is an illustrated sprite (img/bosses/*.webp, generated once and
   trimmed), animated in code: a slow bob and breath, turning to face the hero, a white hit flash,
   a red pulse when enraged and darkening as it dies. Until a sprite has loaded (or if it fails),
   the v3.8 vector characters below stand in. Extends Game (js/core.js). */

// Display size of each sprite: height in boss sizes (s), vertical offset in s; flip = may mirror to face the hero.
// v3.12: poses = extra pictures (img/bosses/<key>_<pose>.webp) swapped in while it winds up or attacks;
// they are saved at the idle picture's scale and stand on the same feet (float: centred instead).
const BOSS_SPRITES = {
    bonecrusher: { h: 2.7, dy: -0.1, flip: true, poses: ['windup', 'attack'] },
    hexweaver: { h: 3.0, dy: -0.3, flip: true, poses: ['attack'] },
    broodmother: { h: 2.6, dy: -0.1, poses: ['attack'] },
    voidmaw: { h: 2.7, dy: 0, float: true, poses: ['windup', 'attack'] },
    gravelord: { h: 2.7, dy: -0.1, flip: true, poses: ['windup', 'attack'] },
    stormcaller: { h: 3.1, dy: -0.2, flip: true, poses: ['attack'] },
    hydra: { h: 2.3, dy: 0.05 },
    hydraHead: { h: 2.6, dy: 0, float: true, poses: ['attack'] },
    lich: { h: 3.1, dy: -0.2, flip: true, poses: ['attack'] },
    shield: { h: 2.6, dy: -0.1, flip: true },
    splitter: { h: 2.3, dy: 0 },
    bomber: { h: 2.3, dy: 0.1, float: true, poses: ['attack'] },
    charger: { h: 2.7, dy: -0.05, poses: ['windup', 'attack'] },
    totem: { h: 4.0, dy: -1.1, poses: ['attack'] },
    archers: { h: 2.8, dy: -0.15, flip: true, poses: ['attack'] }
};

/** Loads the sprites in the background and keeps a white, a red and a black silhouette of each. */
const BossSprites = {
    list: {},
    ready: null,
    load(base = (typeof window !== 'undefined' && window.BOSS_SPRITE_BASE) || 'img/bosses/') {
        if (typeof Image === 'undefined' || typeof document === 'undefined') return Promise.resolve();
        const keys = [];
        for (const [key, cfg] of Object.entries(BOSS_SPRITES)) {
            keys.push(key);
            for (const pose of cfg.poses || []) keys.push(`${key}_${pose}`);
        }
        const jobs = keys.map(key => new Promise(resolve => {
            loadImage(`${base}${key}.webp`, img => {
                if (img) this.list[key] = { img, w: img.naturalWidth, h: img.naturalHeight, tints: {} };
                resolve(); // without it the vector look (or the idle pose) stays
            });
        }));
        this.ready = Promise.all(jobs);
        return this.ready;
    },
    get(key) {
        return this.list[key] || null;
    },
    /** White (hit), red (enraged) or black (dying) silhouette, made on first use (null: no canvas memory). */
    tint(sp, color) {
        if (sp.tints[color]) return sp.tints[color];
        const c = newCanvas(sp.w, sp.h);
        if (!c) return null;
        c.g.drawImage(sp.img, 0, 0);
        c.g.globalCompositeOperation = 'source-in';
        c.g.fillStyle = color;
        c.g.fillRect(0, 0, sp.w, sp.h);
        sp.tints[color] = c.cv;
        return c.cv;
    },
    dropTints() {
        for (const sp of Object.values(this.list)) {
            for (const cv of Object.values(sp.tints)) freeCanvas(cv);
            sp.tints = {};
        }
    }
};
BossSprites.load();

const BossArt = {
    /** An eye that looks at the hero, turns red when enraged and becomes an X when the boss dies. */
    eye(g, x, y, r, { look, enraged, dying, color = '#fff', pupil = MOB_OUTLINE, glow = null }) {
        if (dying) {
            g.strokeStyle = MOB_OUTLINE;
            g.lineWidth = Math.max(2, r * 0.45);
            g.beginPath();
            g.moveTo(x - r, y - r);
            g.lineTo(x + r, y + r);
            g.moveTo(x + r, y - r);
            g.lineTo(x - r, y + r);
            g.stroke();
            return;
        }
        if (glow) {
            g.save();
            g.shadowColor = enraged ? '#ef4444' : glow;
            g.shadowBlur = r * 2.5;
            MobArt.dot(g, x, y, r, enraged ? '#ef4444' : glow);
            g.restore();
            return;
        }
        MobArt.circle(g, x, y, r, enraged ? '#fca5a5' : color);
        MobArt.dot(g, x + look.x * r * 0.35, y + look.y * r * 0.35, r * 0.5, enraged ? '#7f1d1d' : pupil);
    },

    /** Angry brows over a pair of eyes. */
    brows(g, x, y, w, k) {
        g.strokeStyle = MOB_OUTLINE;
        g.lineWidth = Math.max(2, k);
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(-x - w, y - w * 0.45);
        g.lineTo(-x + w * 0.7, y);
        g.moveTo(x + w, y - w * 0.45);
        g.lineTo(x - w * 0.7, y);
        g.stroke();
    },

    // ------------------------------------------------------------ small bosses

    /** Bonecrusher, the Juggernaut: an armoured ogre with spiked pauldrons and a horned helm. */
    bonecrusher(g, s, b, o) {
        const { c, def } = o;
        const step = Math.sin(b.t * 0.15) * s * 0.06;
        const skin = c('#b07a4f');
        const armor = c(def.color);
        const gold = c(def.accent);
        for (const side of [-1, 1]) MobArt.limb(g, side * s * 0.38, s * 0.55, side * s * 0.48, s * 1.02 + side * step, s * 0.34, c('#4b1d16'));
        // arms with spiked fists
        for (const side of [-1, 1]) {
            const fx = side * s * 1.12;
            const fy = s * 0.5 - side * step;
            MobArt.limb(g, side * s * 0.7, -s * 0.1, fx, fy, s * 0.3, skin);
            MobArt.circle(g, fx, fy, s * 0.24, c('#57534e'));
            for (let i = 0; i < 3; i++) {
                const a = -Math.PI / 2 + (i - 1) * 0.7;
                MobArt.poly(g, [[fx + Math.cos(a - 0.25) * s * 0.2, fy + Math.sin(a - 0.25) * s * 0.2], [fx + Math.cos(a) * s * 0.38, fy + Math.sin(a) * s * 0.38], [fx + Math.cos(a + 0.25) * s * 0.2, fy + Math.sin(a + 0.25) * s * 0.2]], c('#e7e5e4'));
            }
        }
        // body: armour with a gold belly plate and belt
        MobArt.circle(g, 0, s * 0.15, s * 0.78, armor);
        MobArt.ellipse(g, 0, s * 0.28, s * 0.42, s * 0.38, gold);
        MobArt.rrect(g, -s * 0.72, s * 0.5, s * 1.44, s * 0.18, s * 0.08, c('#422006'));
        MobArt.dot(g, 0, s * 0.59, s * 0.09, gold);
        // spiked pauldrons
        for (const side of [-1, 1]) {
            MobArt.shape(g, armor, () => g.arc(side * s * 0.66, -s * 0.18, s * 0.34, Math.PI, 0));
            for (let i = 0; i < 3; i++) {
                const x = side * s * 0.66 + (i - 1) * s * 0.2;
                MobArt.poly(g, [[x - s * 0.08, -s * 0.2], [x, -s * 0.52], [x + s * 0.08, -s * 0.2]], gold);
            }
        }
        // head: small, low, tusks, horned helmet
        MobArt.circle(g, 0, -s * 0.5, s * 0.38, skin);
        MobArt.shape(g, c('#7f1d1d'), () => g.arc(0, -s * 0.56, s * 0.42, Math.PI * 1.05, Math.PI * 1.95));
        for (const side of [-1, 1]) {
            MobArt.poly(g, [[side * s * 0.3, -s * 0.78], [side * s * 0.78, -s * 1.22], [side * s * 0.62, -s * 0.84], [side * s * 0.4, -s * 0.66]], c('#f5f5f4'));
            MobArt.poly(g, [[side * s * 0.18, -s * 0.28], [side * s * 0.24, -s * 0.5], [side * s * 0.1, -s * 0.3]], c('#fffbeb'));
        }
        for (const side of [-1, 1]) BossArt.eye(g, side * s * 0.15, -s * 0.55, s * 0.09, { ...o, color: '#fde047' });
        if (!o.dying) BossArt.brows(g, s * 0.15, -s * 0.66, s * 0.12, s * 0.06);
    },

    /** Hexweaver, Witch of the Ninth Moon: a floating witch with a moon staff. */
    hexweaver(g, s, b, o) {
        const { c, def } = o;
        const bob = Math.sin(b.t * 0.06) * s * 0.06;
        g.translate(0, bob);
        const robe = c(def.color);
        const gold = c(def.accent);
        // robe with a ragged hem
        const hem = [];
        for (let i = 0; i <= 8; i++) hem.push([-s * 0.95 + (i / 8) * s * 1.9, s * (1.0 + (i % 2 ? 0.18 : 0) + Math.sin(b.t * 0.1 + i) * 0.04)]);
        MobArt.poly(g, [[-s * 0.4, -s * 0.25], [s * 0.4, -s * 0.25], ...hem.reverse()], robe);
        MobArt.rrect(g, -s * 0.5, s * 0.15, s * 1.0, s * 0.13, s * 0.06, gold);
        // sleeves and the staff
        MobArt.limb(g, -s * 0.35, -s * 0.1, -s * 0.85, s * 0.35, s * 0.28, robe);
        MobArt.limb(g, s * 1.05, s * 1.05, s * 1.05, -s * 1.0, s * 0.11, c('#57534e'));
        MobArt.limb(g, s * 0.35, -s * 0.1, s * 1.0, s * 0.15, s * 0.28, robe);
        g.save();
        g.shadowColor = def.accent;
        g.shadowBlur = s * 0.5;
        MobArt.circle(g, s * 1.05, -s * 1.12, s * 0.2, gold);
        g.restore();
        MobArt.shape(g, c('#1e1b4b'), () => g.arc(s * 1.1, -s * 1.16, s * 0.15, 0, TAU)); // crescent cut
        // face: pale green, long nose
        const skin = c('#a7d38a');
        MobArt.circle(g, 0, -s * 0.48, s * 0.34, skin);
        MobArt.poly(g, [[-s * 0.05, -s * 0.48], [s * 0.05, -s * 0.48], [s * 0.02, -s * 0.24]], skin);
        for (const side of [-1, 1]) BossArt.eye(g, side * s * 0.13, -s * 0.52, s * 0.07, { ...o, glow: '#fde047' });
        // hair and the big hat
        MobArt.shape(g, c('#312e81'), () => g.arc(0, -s * 0.5, s * 0.38, Math.PI * 0.9, Math.PI * 2.1));
        MobArt.ellipse(g, 0, -s * 0.78, s * 0.75, s * 0.16, c('#2c2c54'));
        MobArt.poly(g, [[-s * 0.42, -s * 0.8], [s * 0.42, -s * 0.8], [s * 0.2, -s * 1.45], [s * 0.55, -s * 1.75], [-s * 0.05, -s * 1.5]], c('#2c2c54'));
        MobArt.rrect(g, -s * 0.4, -s * 0.94, s * 0.8, s * 0.12, s * 0.04, gold);
    },

    /** Broodmother, Queen of the Swarm: a crowned spider queen. */
    broodmother(g, s, b, o) {
        const { c, def } = o;
        const leg = c('#14532d');
        // eight legs, two joints each, rippling
        for (const side of [-1, 1]) {
            for (let i = 0; i < 4; i++) {
                const wig = Math.sin(b.t * 0.18 + i * 1.3 + (side > 0 ? 1 : 0)) * s * 0.08;
                const y0 = s * (0.05 + i * 0.16);
                const kx = side * s * (1.05 + (i % 2) * 0.1);
                const ky = y0 - s * (0.55 - i * 0.1) + wig;
                const fx = side * s * (1.45 - i * 0.05);
                const fy = y0 + s * (0.45 + i * 0.12) - wig;
                MobArt.limb(g, side * s * 0.35, y0, kx, ky, s * 0.11, leg);
                MobArt.limb(g, kx, ky, fx, fy, s * 0.09, leg);
            }
        }
        // abdomen behind, with an hourglass mark
        MobArt.circle(g, 0, -s * 0.38, s * 0.78, c(def.color));
        MobArt.poly(g, [[-s * 0.22, -s * 0.72], [s * 0.22, -s * 0.72], [0, -s * 0.4], [s * 0.22, -s * 0.08], [-s * 0.22, -s * 0.08], [0, -s * 0.4]], c('#dc2626'));
        // head with a crown, six eyes and fangs
        MobArt.circle(g, 0, s * 0.35, s * 0.5, c('#166534'));
        MobArt.crown(g, 0, 0, s * 0.5, c('#facc15'));
        for (const [x, y, r] of [[-0.2, 0.25, 0.08], [0.2, 0.25, 0.08], [-0.1, 0.12, 0.055], [0.1, 0.12, 0.055], [-0.32, 0.18, 0.05], [0.32, 0.18, 0.05]]) {
            BossArt.eye(g, x * s, y * s, r * s, { ...o, glow: '#f87171' });
        }
        for (const side of [-1, 1]) MobArt.poly(g, [[side * s * 0.08, s * 0.55], [side * s * 0.22, s * 0.55], [side * s * 0.12, s * 0.85]], c('#f5f5f4'));
    },

    /** Voidmaw, Devourer of Light: a floating shadow beast that is mostly mouth. */
    voidmaw(g, s, b, o) {
        const { c, def } = o;
        const bob = Math.sin(b.t * 0.07) * s * 0.05;
        g.translate(0, bob);
        // shadowy body with wisps
        const pts = [];
        for (let i = 0; i < 18; i++) {
            const a = (i / 18) * TAU;
            const r = s * (i % 2 ? 0.92 : 1.1 + 0.08 * Math.sin(b.t * 0.15 + i));
            pts.push([Math.cos(a) * r, Math.sin(a) * r * 0.95]);
        }
        MobArt.poly(g, pts, c(def.color));
        for (const side of [-1, 1]) {
            MobArt.poly(g, [[side * s * 0.35, -s * 0.7], [side * s * 0.95, -s * 1.35], [side * s * 0.62, -s * 0.62]], c('#334155'));
        }
        // the maw
        const open = 0.45 + 0.12 * Math.sin(b.t * 0.12) + (b.enraged ? 0.12 : 0);
        MobArt.ellipse(g, 0, s * 0.3, s * 0.72, s * open, '#0b0b10');
        g.save();
        g.beginPath();
        g.ellipse(0, s * 0.3, s * 0.68, s * open * 0.93, 0, 0, TAU);
        g.clip();
        MobArt.dot(g, 0, s * (0.3 + open * 0.5), s * 0.45, c('#7f1d1d'));
        for (let i = 0; i < 7; i++) {
            const x = -s * 0.6 + i * s * 0.2;
            MobArt.poly(g, [[x - s * 0.08, s * 0.3 - s * open], [x + s * 0.08, s * 0.3 - s * open], [x, s * 0.3 - s * open * 0.45]], c('#f5f5f4'));
            MobArt.poly(g, [[x + s * 0.02, s * 0.3 + s * open], [x + s * 0.18, s * 0.3 + s * open], [x + s * 0.1, s * 0.3 + s * open * 0.45]], c('#f5f5f4'));
        }
        g.restore();
        // three burning eyes
        for (const [x, y, r] of [[-0.35, -0.35, 0.13], [0.35, -0.35, 0.13], [0, -0.55, 0.1]]) BossArt.eye(g, x * s, y * s, r * s, { ...o, glow: def.accent });
    },

    // ------------------------------------------------------------ gatekeepers

    /** Shieldbearer: an armoured knight; the tower shield turns with `facing`. */
    shield(g, s, m, o) {
        const { c } = o;
        const plate = c('#94a3b8');
        for (const side of [-1, 1]) MobArt.limb(g, side * s * 0.3, s * 0.5, side * s * 0.36, s * 1.0, s * 0.26, c('#475569'));
        MobArt.rrect(g, -s * 0.62, -s * 0.2, s * 1.24, s * 0.85, s * 0.25, plate);
        MobArt.rrect(g, -s * 0.12, -s * 0.15, s * 0.24, s * 0.75, s * 0.06, c('#facc15'));
        MobArt.circle(g, 0, -s * 0.52, s * 0.42, plate);
        MobArt.rrect(g, -s * 0.3, -s * 0.6, s * 0.6, s * 0.1, s * 0.04, MOB_OUTLINE); // visor slit
        if (!o.dying) for (const side of [-1, 1]) MobArt.dot(g, side * s * 0.13, -s * 0.55, s * 0.05, o.enraged ? '#ef4444' : '#fde047');
        MobArt.poly(g, [[-s * 0.06, -s * 0.94], [s * 0.06, -s * 0.94], [s * 0.18, -s * 1.3], [-s * 0.1, -s * 1.22]], c('#dc2626')); // plume
        // the tower shield in front, wherever it faces
        BossArt.towerShield(g, s, m, c);
    },

    towerShield(g, s, m, c) {
        g.save();
        g.rotate(m.facing);
        MobArt.shape(g, c('#cbd5e1'), () => {
            g.arc(0, 0, s * 1.28, -Math.PI / 3, Math.PI / 3);
            g.arc(0, 0, s * 0.88, Math.PI / 3, -Math.PI / 3, true);
            g.closePath();
        });
        MobArt.shape(g, c('#1e3a8a'), () => {
            g.arc(0, 0, s * 1.16, -Math.PI / 5, Math.PI / 5);
            g.arc(0, 0, s * 1.0, Math.PI / 5, -Math.PI / 5, true);
            g.closePath();
        });
        MobArt.dot(g, s * 1.08, 0, s * 0.13, c('#facc15'));
        g.restore();
    },

    /** Splitter: a big slime with a crack down the middle. */
    splitter(g, s, m, o) {
        const { c } = o;
        const sq = 1 + (m.squash || 0) * 0.15;
        g.scale(sq, 1 / sq);
        const col = c(m.gen ? '#4ade80' : '#22c55e');
        g.beginPath();
        g.moveTo(-s, s * 0.55);
        g.bezierCurveTo(-s * 1.15, -s * 0.4, -s * 0.55, -s * 1.05, 0, -s);
        g.bezierCurveTo(s * 0.55, -s * 1.05, s * 1.15, -s * 0.4, s, s * 0.55);
        g.quadraticCurveTo(s * 0.5, s * 0.95, 0, s * 0.85);
        g.quadraticCurveTo(-s * 0.5, s * 0.95, -s, s * 0.55);
        g.fillStyle = col;
        g.fill();
        g.strokeStyle = MOB_OUTLINE;
        g.lineWidth = g.ow;
        g.stroke();
        MobArt.ellipse(g, -s * 0.4, -s * 0.48, s * 0.22, s * 0.13, 'rgba(255,255,255,0.45)', -0.5);
        g.strokeStyle = 'rgba(0,0,0,0.4)';
        g.lineWidth = g.ow * 0.8;
        g.beginPath();
        g.moveTo(0, -s);
        g.lineTo(s * 0.08, -s * 0.6);
        g.lineTo(-s * 0.06, -s * 0.3);
        g.lineTo(s * 0.05, 0);
        g.stroke();
        for (const side of [-1, 1]) BossArt.eye(g, side * s * 0.35, -s * 0.1, s * 0.17, o);
        if (!o.dying) BossArt.brows(g, s * 0.35, -s * 0.33, s * 0.15, s * 0.07);
        MobArt.shape(g, '#14532d', () => g.arc(0, s * 0.3, s * 0.22, 0, Math.PI)); // grin
        // drips
        for (const x of [-0.6, 0.45]) MobArt.ellipse(g, x * s, s * (0.82 + 0.05 * Math.sin(m.t * 0.2 + x * 5)), s * 0.08, s * 0.12, col);
    },

    /** Bomber: a bat-winged imp carrying a bomb with a lit fuse. */
    bomber(g, s, m, o) {
        const { c } = o;
        const flap = Math.sin(m.t * 0.3) * 0.4;
        for (const side of [-1, 1]) {
            MobArt.shape(g, c('#44403c'), () => {
                g.moveTo(side * s * 0.45, -s * 0.1);
                g.quadraticCurveTo(side * s * 1.6, -s * (1.0 + flap), side * s * 2.0, s * 0.1);
                g.lineTo(side * s * 1.6, -s * 0.05);
                g.lineTo(side * s * 1.35, s * 0.25);
                g.lineTo(side * s * 1.05, s * 0.05);
                g.quadraticCurveTo(side * s * 0.8, s * 0.35, side * s * 0.45, s * 0.3);
            });
        }
        // the bomb it carries
        MobArt.circle(g, 0, s * 0.95, s * 0.36, c('#1f2937'));
        MobArt.ellipse(g, -s * 0.12, s * 0.85, s * 0.08, s * 0.05, 'rgba(255,255,255,0.5)');
        MobArt.limb(g, 0, s * 0.6, s * 0.1, s * 0.42, s * 0.06, c('#a16207'));
        if (m.t % 8 < 4) MobArt.dot(g, s * 0.12, s * 0.38, s * 0.09, '#fde047');
        MobArt.limb(g, -s * 0.3, s * 0.35, -s * 0.15, s * 0.7, s * 0.14, c(m.color));
        MobArt.limb(g, s * 0.3, s * 0.35, s * 0.15, s * 0.7, s * 0.14, c(m.color));
        // body and head
        MobArt.ellipse(g, 0, s * 0.1, s * 0.5, s * 0.45, c(m.color));
        MobArt.circle(g, 0, -s * 0.42, s * 0.42, c('#c2410c'));
        for (const side of [-1, 1]) MobArt.poly(g, [[side * s * 0.2, -s * 0.75], [side * s * 0.42, -s * 1.12], [side * s * 0.38, -s * 0.66]], c('#292524'));
        for (const side of [-1, 1]) BossArt.eye(g, side * s * 0.15, -s * 0.45, s * 0.11, { ...o, color: '#fde047' });
        MobArt.shape(g, MOB_OUTLINE, () => g.arc(0, -s * 0.28, s * 0.14, 0.15, Math.PI - 0.15));
    },

    /** Charger: a horned boar-bull seen from above, head first along its charge (drawn facing +y). */
    charger(g, s, m, o) {
        const { c } = o;
        const run = m.mode === 'charge' ? 0.35 : 0.12;
        const k = Math.sin(m.t * (m.mode === 'charge' ? 0.6 : 0.2)) * s * run;
        for (const [x, y, d] of [[-0.55, -0.45, 1], [0.55, -0.45, -1], [-0.55, 0.35, -1], [0.55, 0.35, 1]]) {
            MobArt.limb(g, x * s, y * s, x * s * 1.25, y * s + d * k, s * 0.24, c('#7f1d1d'));
        }
        MobArt.ellipse(g, 0, -s * 0.1, s * 0.72, s * 0.95, c(m.color));
        MobArt.ellipse(g, 0, -s * 0.35, s * 0.5, s * 0.45, c('#991b1b')); // hump / mane
        // head, horns and tusks pointing the way it charges
        MobArt.ellipse(g, 0, s * 0.8, s * 0.45, s * 0.4, c('#991b1b'));
        for (const side of [-1, 1]) {
            MobArt.poly(g, [[side * s * 0.3, s * 0.7], [side * s * 0.95, s * 0.75], [side * s * 0.75, s * 1.2], [side * s * 0.62, s * 0.9]], c('#fef3c7'));
            MobArt.poly(g, [[side * s * 0.1, s * 1.05], [side * s * 0.22, s * 1.05], [side * s * 0.14, s * 1.4]], c('#fffbeb'));
            BossArt.eye(g, side * s * 0.2, s * 0.72, s * 0.08, { ...o, glow: '#fde047' });
        }
        MobArt.ellipse(g, 0, s * 1.05, s * 0.22, s * 0.12, c('#fca5a5')); // snout
    },

    /** Archers: a hooded sniper; the bow follows the hero. */
    archers(g, s, m, o) {
        const { c } = o;
        const cloak = c(m.color);
        MobArt.poly(g, [[-s * 0.45, -s * 0.3], [s * 0.45, -s * 0.3], [s * 0.7, s * 0.95], [-s * 0.7, s * 0.95]], cloak);
        MobArt.rrect(g, -s * 0.5, s * 0.25, s * 1.0, s * 0.12, s * 0.05, c('#422006'));
        // quiver on the back
        MobArt.rrect(g, -s * 0.75, -s * 0.5, s * 0.25, s * 0.8, s * 0.08, c('#78350f'));
        for (const dx of [-0.68, -0.58]) MobArt.limb(g, dx * s, -s * 0.5, dx * s, -s * 0.72, s * 0.04, c('#e5e7eb'));
        // hood with a shadowed face and two glowing eyes
        MobArt.shape(g, c('#14532d'), () => {
            g.moveTo(-s * 0.55, -s * 0.15);
            g.quadraticCurveTo(-s * 0.6, -s * 1.0, 0, -s * 1.35);
            g.quadraticCurveTo(s * 0.6, -s * 1.0, s * 0.55, -s * 0.15);
            g.closePath();
        });
        MobArt.ellipse(g, 0, -s * 0.5, s * 0.3, s * 0.3, '#0b1a10');
        for (const side of [-1, 1]) BossArt.eye(g, side * s * 0.11, -s * 0.52, s * 0.07, { ...o, glow: '#a3e635' });
        // the bow, aimed at the hero
        const a = Math.atan2(o.look.y, o.look.x);
        g.save();
        g.rotate(a);
        g.strokeStyle = MOB_OUTLINE;
        g.lineWidth = s * 0.16;
        g.beginPath();
        g.arc(s * 0.55, 0, s * 0.85, -1.1, 1.1);
        g.stroke();
        g.strokeStyle = c('#a16207');
        g.lineWidth = s * 0.09;
        g.stroke();
        g.strokeStyle = '#e5e7eb';
        g.lineWidth = 1.2;
        const pull = m.drawT > 0 ? 0 : s * 0.45;
        g.beginPath();
        g.moveTo(s * 0.55 + Math.cos(-1.1) * s * 0.85, Math.sin(-1.1) * s * 0.85);
        g.lineTo(s * 0.55 - pull, 0);
        g.lineTo(s * 0.55 + Math.cos(1.1) * s * 0.85, Math.sin(1.1) * s * 0.85);
        g.stroke();
        if (pull) MobArt.limb(g, s * 0.55 - pull, 0, s * 1.3, 0, s * 0.04, c('#e5e7eb'));
        g.restore();
    }
};

extendGame({
    /** Common setup for a boss/gatekeeper drawing: outline width, flash colouring, eyes on the hero. */
    artOpts(m, s) {
        const flash = m.flash > 0;
        const p = this.player || { x: m.x, y: m.y + 100 };
        return {
            def: m.boss || GATEKEEPERS[m.ai] || {},
            c: col => (flash ? '#ffffff' : col),
            look: U.normalizeVector(p.x - m.x, p.y - m.y),
            enraged: Boolean(m.enraged),
            dying: Boolean(m.dying)
        };
    },

    /**
     * Draws a boss sprite centred on the current origin. Returns false when it isn't loaded.
     * `opts.noFlip` keeps it unmirrored; `opts.t` is the animation clock (defaults to m.t).
     */
    /** Which pose a boss or gatekeeper strikes right now: 'windup', 'attack' or null (idle). */
    bossPoseOf(m) {
        if (m.dying) return null;
        if (m.mode === 'windup' || m.slamT > 0 || (m.ai === 'charger' && m.mode === 'aim' && m.lane)) return 'windup';
        if (m.mode === 'dash' || (m.ai === 'charger' && m.mode === 'charge') || m.lunge > 0 || m.mouth > 0 || m.vortex > 0 || m.drawT > 0 || (m.beamT > 0 && m.beams && m.beams.length)) return 'attack';
        if ((m.poseUntil || 0) > (this.frameNo || 0)) return 'attack';
        return null;
    },

    /** Strike the attack pose for a moment (a volley, a summon, a slam…). */
    bossPose(m, steps = 30) {
        m.poseUntil = Math.max(m.poseUntil || 0, (this.frameNo || 0) + steps);
    },

    drawBossSprite(ctx, m, key, opts = {}) {
        const idle = BossSprites.get(key);
        const cfg = BOSS_SPRITES[key];
        if (!idle || !cfg) return false;
        const pose = opts.pose !== undefined ? opts.pose : this.bossPoseOf(m);
        const posed = pose && cfg.poses && cfg.poses.includes(pose) ? BossSprites.get(`${key}_${pose}`) : null;
        const sp = posed || idle;
        const s = m.size;
        const t = opts.t ?? m.t ?? this.frameNo ?? 0;
        const H0 = s * cfg.h;
        const H = (H0 * sp.h) / idle.h; // poses are saved at the idle picture's scale
        const W = (H * sp.w) / sp.h;
        const top = cfg.float ? -H / 2 : H0 / 2 - H; // same feet (or the same middle for floaters)
        // a quick pop when the pose changes sells the motion
        const shown = posed ? pose : '';
        if (m.poseShown !== shown) {
            m.poseShown = shown;
            m.poseAt = this.frameNo || 0;
        }
        const pop = 1 + 0.08 * Math.max(0, 1 - ((this.frameNo || 0) - (m.poseAt || 0)) / 7);
        const p = this.player;
        const breathe = 1 + Math.sin(t * 0.08) * 0.025;
        ctx.save();
        ctx.translate(0, s * cfg.dy + Math.sin(t * 0.05) * s * 0.04);
        if (cfg.flip && !opts.noFlip && p && p.x < m.x - 4) ctx.scale(-1, 1);
        ctx.translate(0, H0 / 2);
        ctx.scale(pop / Math.sqrt(breathe), pop * breathe);
        ctx.translate(0, -H0 / 2);
        const draw = (img, alpha) => {
            if (!img) return;
            ctx.globalAlpha = alpha;
            ctx.drawImage(img, -W / 2, top, W, H);
        };
        const base = ctx.globalAlpha;
        draw(sp.img, base);
        if (m.flash > 0) draw(BossSprites.tint(sp, '#ffffff'), base * 0.8);
        else if (m.enraged && !m.dying) draw(BossSprites.tint(sp, '#ff2a2a'), base * (0.14 + 0.1 * Math.sin(t * 0.3)));
        if (m.dying) draw(BossSprites.tint(sp, '#140800'), base * 0.6 * U.clamp((m.deathT || 0) / (m.deathMax || 1), 0, 1));
        ctx.restore();
        return true;
    },

    /** Draws a small boss (by voice) or a gatekeeper (by ai) at the current origin: sprite, else the vector look. */
    drawBossArt(ctx, m, kind) {
        ctx.save();
        if (kind === 'splitter') {
            const sq = 1 + (m.squash || 0) * 0.15;
            ctx.scale(sq, 1 / sq);
        }
        const drawn = this.drawBossSprite(ctx, m, kind);
        ctx.restore();
        if (drawn) {
            if (kind === 'shield') this.drawTowerShield(ctx, m);
            return true;
        }
        const fn = BossArt[kind];
        if (!fn) return false;
        const s = m.size;
        ctx.save();
        ctx.lineJoin = 'round';
        ctx.ow = Math.max(2, s * 0.07);
        fn(ctx, s, m, this.artOpts(m, s));
        ctx.restore();
        return true;
    },

    /** The Shieldbearer's tower shield over its sprite (it turns with `facing`). */
    drawTowerShield(ctx, m) {
        ctx.save();
        ctx.lineJoin = 'round';
        ctx.ow = Math.max(2, m.size * 0.07);
        BossArt.towerShield(ctx, m.size, m, col => (m.flash > 0 ? '#ffffff' : col));
        ctx.restore();
    }
});
