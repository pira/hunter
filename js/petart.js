/* Monster Hunter — pets as vector rigs in the heroes' style (v3.18): the same dark outline, cel shading,
   blinking eyes and light rim as js/sprites.js, drawn live, so they walk, hop, flap and kick. One look per
   rarity: basic plain, rare a blue trinket, legendary gear with gold trim, mythic gold, a crown, a glow and
   twinkles. (0, 0) = the ground under the pet, facing +x, about 24 units tall (flyers hover above it).
   Profile pictures are the same rigs rendered once into data URLs (petIconURL). Extends Game. */

const PET_GOLD = '#facc15';
const PET_RARE = '#3b82f6';
const PET_RIM = { color: '#fffbeb', rim: 1.1 };
// Per pet and tier: colours. Missing keys fall back to tier 1.
const PET_PAL = {
    turtle: {
        1: { shell: '#c99a5b', plate: '#9a6b35', skin: '#8fcf4f', belly: '#eadcae' },
        2: { shell: '#4f8ff7', plate: '#1e4fbf' },
        3: { shell: '#a8b3c4', plate: '#64748b', gem: '#22c55e' },
        4: { shell: '#34d399', plate: '#047857', skin: '#9be35f', gem: '#d1fae5' }
    },
    bees: {
        1: { body: '#facc15', band: '#2b2140', wing: '#e0f2fe', head: '#2b2140' },
        2: { wing: '#bfdbfe' },
        3: { body: '#f59e0b' },
        4: { body: '#fde047', band: '#92400e', wing: '#fbcfe8' }
    },
    eagle: {
        1: { body: '#7c4a21', wing: '#6b3d17', tip: '#4a2810', head: '#f8fafc', beak: '#fbbf24', claw: '#f59e0b' },
        2: { tip: '#2563eb' },
        3: { body: '#8a5426' },
        4: { body: '#ef4444', wing: '#f97316', tip: '#facc15', head: '#fde047', beak: '#fff7ed', claw: '#fde047' }
    },
    frog: {
        1: { skin: '#5fb32a', belly: '#d9f99d', spot: '#3f7f1a', mouth: '#7f1d1d' },
        2: { skin: '#4ca72a' },
        3: { skin: '#5fb32a' },
        4: { skin: '#6cc33a', belly: '#fef9c3' }
    },
    donkey: {
        1: { coat: '#9ca3af', belly: '#e5e7eb', muzzle: '#d6d3d1', mane: '#4b5563', hoof: '#3f3f46', ear: '#f9a8d4' },
        2: { coat: '#a1a1aa' },
        3: { coat: '#9ca3af' },
        4: { coat: '#c4b5fd', belly: '#f5f3ff', hoof: '#facc15' }
    },
    squirrel: {
        1: { fur: '#e3742a', belly: '#fde4c3', tail: '#c4561b', nut: '#8b5a2b', cap: '#5b3a1a' },
        2: { fur: '#e3742a' },
        3: { fur: '#dd6a22' },
        4: { fur: '#f59e0b', tail: '#fbbf24', belly: '#fff7ed' }
    },
    bunny: {
        1: { fur: '#f8fafc', shade: '#cbd5e1', ear: '#f9a8d4', nose: '#f472b6' },
        2: { fur: '#f8fafc' },
        3: { fur: '#f8fafc' },
        4: { fur: '#f5e8ff', shade: '#d8b4fe', ear: '#f0abfc' }
    }
};

Object.assign(Game, {
    petPalette(id, tier) {
        const set = PET_PAL[id] || {};
        return { ...(set[1] || {}), ...(set[tier] || {}) };
    },

    /**
     * Draws a pet. pose: { t (frames), walk (0–1), ph (walk phase), act: 'kick' | 'dive' | 'lick' | null,
     * k (0–1 through the act), hide (turtle in its shell), face }. With rim, a light silhouette is drawn first.
     */
    drawPetRig(g, id, tier, pose, rim = true) {
        const p = Game.petPalette(id, tier);
        const t = pose.t || 0;
        g.save();
        g.lineJoin = 'round';
        g.lineCap = 'round';
        if (tier >= 4 && !Ink.sil && !pose.noAura) Game.glow(g, 0, id === 'eagle' || id === 'bees' ? -18 : -11, 20, '#fde047', 0.35 + 0.1 * Math.sin(t * 0.08));
        const draw = () => {
            const fn = Game[`pet_${id}`];
            if (fn) fn(g, p, tier, pose);
        };
        if (rim) {
            Ink.sil = PET_RIM.color;
            Ink.rim = PET_RIM.rim;
            try {
                draw();
            } finally {
                Ink.sil = null;
            }
        }
        draw();
        if (tier >= 4 && !Ink.sil && !pose.noAura) {
            // mythic pets twinkle like mythic skins
            const top = id === 'eagle' || id === 'bees' ? -20 : -13;
            for (let i = 0; i < 3; i++) {
                const k = (t * 0.014 + i / 3) % 1;
                const a = i * 2.1 + Math.floor(t * 0.014 + i / 3) * 1.7;
                const r = Math.sin(k * Math.PI) * 2;
                Game.star(g, Math.cos(a) * 13, top + Math.sin(a) * 11, r, '#fde047');
                Game.star(g, Math.cos(a) * 13, top + Math.sin(a) * 11, r * 0.5, '#ffffff');
            }
        }
        g.restore();
    },

    /** A small crown sitting on (x, y), tilted. */
    petCrown(g, x, y, s = 0.75, rot = 0) {
        g.save();
        g.translate(x, y);
        g.rotate(rot);
        g.scale(s, s);
        Game.drawCrown(g, 0, 0, PET_GOLD);
        g.restore();
    },

    petEye(g, x, y, r, t, look = 0.6) {
        Game.eyes(g, [[x, y]], r, Game.blinking(t + Math.round(x * 13)), look);
    },

    /** Hop arc for hoppers: 0 on the ground, up to 1 at the top of a hop. */
    petHop(pose, rate = 0.16) {
        if (!(pose.walk > 0)) return 0;
        const s = Math.sin((pose.t || 0) * rate);
        return Math.max(0, s) * pose.walk;
    },

    // ---------------------------------------------------------------- turtle: shell, stubby legs, head on a neck

    pet_turtle(g, p, tier, pose) {
        const t = pose.t || 0;
        const hide = pose.hide;
        const w = pose.walk || 0;
        const step = Math.sin(t * 0.18) * w;
        // far legs (darker), then near legs
        const leg = (x, ph, far) => {
            const lift = Math.max(0, Math.sin(t * 0.18 + ph)) * 1.6 * w;
            const fx = x + Math.cos(t * 0.18 + ph) * 1.6 * w;
            Game.tube(g, [[x, -5], [fx, -1 - lift]], 3.6, far ? Game.darker(p.skin, 0.8) : p.skin, 1.3);
            Game.ellipse(g, fx + 0.6, -0.6 - lift, 2.4, 1.4, far ? Game.darker(p.skin, 0.8) : p.skin, OUTLINE, 1.2);
        };
        if (!hide) {
            leg(-6, Math.PI, true);
            leg(6, 0, true);
        }
        // tail
        g.beginPath();
        g.moveTo(-11, -5);
        g.lineTo(-15, -3.5 + step * 0.4);
        g.lineTo(-10.5, -3);
        g.closePath();
        Game.blob(g, p.skin, OUTLINE, 1.2);
        // head and neck (tucked in when hiding)
        const nod = Math.sin(t * 0.07) * 0.6;
        const hx = hide ? 10 : 15;
        const hy = (hide ? -6.5 : -9.5) + nod;
        if (!hide) Game.tube(g, [[8, -6.5], [12.5, -8.5 + nod]], 3.6, p.skin, 1.3);
        Game.ball(g, hx, hy, hide ? 2.6 : 4.2, hide ? 2.4 : 3.6, p.skin, 1.5);
        if (!hide) {
            Game.petEye(g, hx + 1.4, hy - 1, 1.15, t);
            Game.line(g, [[hx + 1.6, hy + 1.6], [hx + 3.6, hy + 1]], OUTLINE, 0.9);
            if (tier === 2) {
                // rare: a blue bandana round the neck
                g.beginPath();
                g.moveTo(10, -10.5 + nod);
                g.lineTo(13.4, -8.6 + nod);
                g.lineTo(11, -4.6 + nod);
                g.closePath();
                Game.blob(g, PET_RARE, OUTLINE, 1.1);
                Game.dot(g, 11.4, -7.4 + nod, 0.6, '#dbeafe');
            }
            if (tier >= 4) Game.petCrown(g, hx + 0.4, hy - 3.2, 0.6, 0.15);
            if (tier === 3) {
                // legendary: a little steel helmet
                g.beginPath();
                g.ellipse(hx, hy - 1.6, 3.9, 2.8, 0, Math.PI, 0);
                g.closePath();
                Game.blob(g, '#cbd5e1', OUTLINE, 1.2);
                Game.line(g, [[hx - 3.6, hy - 1.4], [hx + 3.6, hy - 1.4]], PET_GOLD, 1);
            }
        } else {
            Game.line(g, [[hx + 0.4, hy - 0.4], [hx + 1.8, hy - 0.4]], OUTLINE, 0.9);
        }
        // shell: a dome with a rim, plates on top
        const dome = () => {
            g.beginPath();
            g.moveTo(-12, -4.5);
            g.bezierCurveTo(-12, -19, 11, -19, 11, -4.5);
            g.closePath();
        };
        dome();
        Game.cel(g, p.shell, -1, -11, 11.5, 7.5, OUTLINE, 1.7);
        if (!Ink.sil) {
            g.save();
            dome();
            g.clip();
            g.strokeStyle = p.plate;
            g.lineWidth = 1.3;
            g.beginPath();
            g.moveTo(-5, -15.5);
            g.lineTo(-3, -10);
            g.lineTo(3, -10);
            g.lineTo(4.6, -15.5);
            g.moveTo(-3, -10);
            g.lineTo(-8, -6);
            g.moveTo(3, -10);
            g.lineTo(7.5, -6);
            g.stroke();
            g.restore();
            if (tier >= 3) {
                Game.ellipse(g, -0.3, -13, 2.6, 2, p.gem, OUTLINE, 1.1);
                Game.dot(g, -1, -13.7, 0.7, '#ffffff');
            }
        }
        // rim band along the bottom (gold on mythic, riveted steel on legendary)
        g.beginPath();
        g.moveTo(-12.6, -4.2);
        g.quadraticCurveTo(-0.5, -1.4, 11.6, -4.2);
        g.lineTo(11, -6.4);
        g.quadraticCurveTo(-0.5, -3.6, -12, -6.4);
        g.closePath();
        Game.blob(g, tier >= 4 ? PET_GOLD : tier === 3 ? '#cbd5e1' : p.plate, OUTLINE, 1.2);
        if (tier === 3) for (const x of [-8, -3, 2, 7]) Game.dot(g, x, -4.6, 0.6, '#475569');
        if (!hide) {
            leg(-7.5, 0, false);
            leg(5.5, Math.PI, false);
        }
    },

    // ---------------------------------------------------------------- bees: the queen hovers, wings buzzing

    pet_bees(g, p, tier, pose) {
        const t = pose.t || 0;
        const bob = Math.sin(t * 0.15) * 1.4;
        g.save();
        g.translate(0, -15 + bob);
        g.rotate(0.08 * Math.sin(t * 0.05));
        const flap = Math.abs(Math.sin(t * 0.9));
        // far wing
        const wing = (x, rot, sc, near) => {
            g.save();
            g.translate(x, -4.5);
            g.rotate(rot);
            g.scale(1, sc);
            g.beginPath();
            g.ellipse(-1, -4.6, 3.4, 5.2, -0.25, 0, Math.PI * 2);
            if (Ink.sil) Game.blob(g, p.wing, OUTLINE, 1.1);
            else {
                g.globalAlpha = 0.85;
                if (tier >= 4) {
                    const gr = g.createLinearGradient(0, -10, 0, 0);
                    gr.addColorStop(0, '#a5f3fc');
                    gr.addColorStop(1, '#fbcfe8');
                    g.fillStyle = gr;
                } else g.fillStyle = p.wing;
                g.fill();
                g.globalAlpha = 1;
                g.strokeStyle = OUTLINE;
                g.lineWidth = 1.1;
                g.stroke();
                if (near) Game.line(g, [[-1, -1], [-1.6, -7.5]], 'rgba(26,16,51,0.35)', 0.7);
            }
            g.restore();
        };
        wing(-1, -0.5, 0.45 + flap * 0.55, false);
        // stinger
        g.beginPath();
        g.moveTo(-7.4, -1);
        g.lineTo(-11.4, 0.4);
        g.lineTo(-7.2, 1.6);
        g.closePath();
        Game.blob(g, tier === 3 ? '#cbd5e1' : OUTLINE, OUTLINE, 1);
        // body with bands
        const body = () => {
            g.beginPath();
            g.ellipse(-1, 0, 7.4, 5.4, 0, 0, Math.PI * 2);
        };
        body();
        Game.cel(g, p.body, -1, 0, 7.4, 5.4, OUTLINE, 1.6);
        if (!Ink.sil) {
            g.save();
            body();
            g.clip();
            g.fillStyle = p.band;
            for (const x of [-5.6, -1.6]) g.fillRect(x, -6, 2.2, 12);
            g.restore();
            body();
            g.strokeStyle = OUTLINE;
            g.lineWidth = 1.6;
            g.stroke();
        }
        // legs
        Game.line(g, [[-2, 5], [-3, 7.4]], OUTLINE, 1);
        Game.line(g, [[1.4, 5], [1, 7.4]], OUTLINE, 1);
        // head, antennae
        Game.ball(g, 7, -1, 4, 3.8, p.head, 1.5);
        Game.line(g, [[7.5, -4.4], [8.6, -8.4], [10.6, -8.8]], OUTLINE, 1);
        Game.line(g, [[9, -4], [11, -7], [12.8, -6.8]], OUTLINE, 1);
        Game.dot(g, 10.6, -8.8, 0.9, p.body);
        Game.dot(g, 12.8, -6.8, 0.9, p.body);
        if (!Ink.sil) {
            // big shiny eye
            const bl = Game.blinking(t);
            if (bl) Game.line(g, [[7.8, -1.4], [10.2, -1.4]], '#ffffff', 1);
            else {
                Game.ellipse(g, 9, -1.4, 1.5, 1.8, '#ffffff', null);
                Game.dot(g, 9.4, -1.2, 0.9, '#1e1b4b');
            }
            Game.line(g, [[8.4, 1.4], [10.2, 1.2]], '#fef3c7', 0.8);
        }
        if (tier === 2) {
            // rare: a blue bow on the head
            const bx = 5.6;
            const by = -4.2;
            g.beginPath();
            g.moveTo(bx, by);
            g.lineTo(bx - 3, by - 2);
            g.lineTo(bx - 3, by + 1.6);
            g.closePath();
            g.moveTo(bx, by);
            g.lineTo(bx + 3, by - 2);
            g.lineTo(bx + 3, by + 1.6);
            g.closePath();
            Game.blob(g, PET_RARE, OUTLINE, 1);
            Game.ellipse(g, bx, by, 1, 1, '#93c5fd', OUTLINE, 0.9);
        }
        if (tier === 3) {
            // legendary: a knight's helmet with a gold crest
            g.beginPath();
            g.ellipse(7, -1.6, 4.3, 4, 0, Math.PI * 0.95, Math.PI * 2.05);
            g.closePath();
            Game.blob(g, '#cbd5e1', OUTLINE, 1.2);
            Game.line(g, [[3, -1.2], [11, -1.2]], '#64748b', 1);
            Game.tube(g, [[5, -5.4], [7, -6.6], [9, -5.6]], 1.4, PET_GOLD, 0.9);
        }
        if (tier >= 4) Game.petCrown(g, 6.6, -4.6, 0.55, 0.2);
        wing(1, 0.4, 0.45 + flap * 0.55, true);
        g.restore();
    },

    /** One worker bee of the swarm (in the field): a small outlined bee at (x, y). */
    drawWorkerBee(g, x, y, tier, t) {
        const p = Game.petPalette('bees', tier);
        g.save();
        g.translate(x, y);
        g.lineJoin = 'round';
        const flap = Math.abs(Math.sin(t * 1.1));
        g.globalAlpha = 0.85;
        g.fillStyle = p.wing;
        g.beginPath();
        g.ellipse(-0.8, -2.6, 1.6, 2.2 * (0.5 + flap * 0.5), -0.3, 0, Math.PI * 2);
        g.ellipse(1.2, -2.6, 1.6, 2.2 * (0.5 + flap * 0.5), 0.3, 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = 1;
        g.beginPath();
        g.ellipse(0, 0, 3.4, 2.5, 0, 0, Math.PI * 2);
        g.fillStyle = p.body;
        g.fill();
        g.save();
        g.clip();
        g.fillStyle = p.band;
        g.fillRect(-1.6, -3, 1.2, 6);
        g.fillRect(0.6, -3, 1.2, 6);
        g.restore();
        g.strokeStyle = OUTLINE;
        g.lineWidth = 1;
        g.stroke();
        g.restore();
    },

    // ---------------------------------------------------------------- eagle: hovers with big wingbeats, dives

    pet_eagle(g, p, tier, pose) {
        const t = pose.t || 0;
        const dive = pose.act === 'dive';
        const s = dive ? 0.6 : Math.sin(t * 0.2);
        const bob = dive ? 0 : s * 1.4;
        g.save();
        g.translate(0, -17 + bob);
        if (dive) g.rotate(0.4);
        // a wing: from the shoulder, pointing back; s = 1 raised high, -1 swept down
        const wing = near => {
            const col = near ? p.wing : Game.darker(p.wing, 0.75);
            const tip = near ? p.tip : Game.darker(p.tip, 0.8);
            g.save();
            g.translate(-1.5, -3);
            // (canvas angles turn clockwise: + lifts a wing that points back)
            g.rotate(0.8 + 0.9 * s + (near ? 0 : -0.3));
            const L = dive ? 10 : 15;
            const shape = () => {
                g.beginPath();
                g.moveTo(1, -1.6);
                g.quadraticCurveTo(-L * 0.45, -6, -L, -4.6);
                g.lineTo(-L - 2.4, -3.6);
                g.lineTo(-L + 0.2, -2.2);
                g.lineTo(-L - 2, -0.8);
                g.lineTo(-L + 0.6, 0.4);
                g.lineTo(-L - 1, 2);
                g.lineTo(-L * 0.62, 2.2);
                g.quadraticCurveTo(-L * 0.3, 3.4, 1, 2.6);
                g.closePath();
            };
            shape();
            Game.cel(g, col, -L * 0.5, -1, L * 0.55, 4, OUTLINE, 1.5);
            if (!Ink.sil) {
                g.save();
                shape();
                g.clip();
                g.fillStyle = tip;
                g.fillRect(-L - 4, -8, L * 0.42, 14);
                if (tier >= 4) {
                    g.fillStyle = 'rgba(253,224,71,0.6)';
                    g.fillRect(-L * 0.64, -8, L * 0.16, 14);
                }
                g.strokeStyle = 'rgba(26,16,51,0.35)';
                g.lineWidth = 0.7;
                g.beginPath();
                g.moveTo(-L * 0.55, -3.4);
                g.lineTo(-L * 0.62, 1.8);
                g.stroke();
                g.restore();
            }
            g.restore();
        };
        wing(false);
        // tail: a fan of three feathers
        for (const [a, c] of [[0.3, 0.86], [0, 1], [-0.3, 0.86]]) {
            g.save();
            g.translate(-5.6, 1);
            g.rotate(a + (dive ? -0.2 : 0));
            g.beginPath();
            g.ellipse(-4.4, 0, 4.6, 1.6, 0, 0, Math.PI * 2);
            Game.blob(g, tier >= 4 ? (c < 1 ? '#fb923c' : '#facc15') : c < 1 ? '#e2e8f0' : '#f8fafc', OUTLINE, 1.2);
            g.restore();
        }
        if (tier >= 4 && !Ink.sil) {
            // phoenix: a flickering flame tail
            for (let i = 0; i < 3; i++) {
                const f = Math.sin(t * 0.3 + i * 2) * 1.4;
                g.beginPath();
                g.moveTo(-11, 0 + i * 1.2);
                g.quadraticCurveTo(-16 - i, -1.6 + f + i * 1.4, -19.5 - i * 1.5, 0.6 + f + i * 1.8);
                g.quadraticCurveTo(-15, 1.8 + i * 1.2, -11, 1.4 + i * 1.2);
                g.fillStyle = ['#fde047', '#fb923c', '#ef4444'][i];
                g.fill();
            }
        }
        // talons hanging (tucked in a dive)
        if (!dive) {
            Game.tube(g, [[0.4, 3.6], [1, 7]], 1.4, p.claw, 0.9);
            Game.tube(g, [[3, 3.4], [3.8, 6.8]], 1.4, p.claw, 0.9);
            Game.line(g, [[0.2, 7.2], [2, 7.2]], OUTLINE, 0.9);
            Game.line(g, [[2.8, 7], [4.6, 7]], OUTLINE, 0.9);
        }
        // body: chest up and forward
        const body = () => {
            g.beginPath();
            g.ellipse(0, 0, 7.6, 4.8, -0.28, 0, Math.PI * 2);
        };
        body();
        Game.cel(g, p.body, 0, 0, 7.6, 4.8, OUTLINE, 1.6);
        if (!Ink.sil && tier < 4) {
            g.save();
            body();
            g.clip();
            g.strokeStyle = Game.darker(p.body, 0.72);
            g.lineWidth = 0.9;
            for (const [x, y] of [[-2.6, 2.4], [0.6, 1.4], [3.6, 0.4], [-0.6, 4]]) {
                g.beginPath();
                g.arc(x, y, 1.5, 0.2, Math.PI - 0.2);
                g.stroke();
            }
            g.restore();
        }
        if (tier === 3) {
            // legendary: a gold-trimmed breastplate
            g.beginPath();
            g.ellipse(3.6, -0.2, 3.6, 3.6, -0.3, -1.3, 2.1);
            g.closePath();
            Game.blob(g, '#cbd5e1', OUTLINE, 1.1);
            Game.line(g, [[3, -3.2], [5.6, 2.6]], PET_GOLD, 1);
        }
        // head: white, a little ruffle at the nape, hooked beak, fierce yellow eye
        const hx = 7.6;
        const hy = -5.4;
        g.beginPath();
        g.moveTo(hx - 3.8, hy + 1);
        g.lineTo(hx - 6, hy + 2.6);
        g.lineTo(hx - 3.6, hy + 2.8);
        g.lineTo(hx - 5, hy + 4.4);
        g.lineTo(hx - 2, hy + 3.6);
        g.closePath();
        Game.blob(g, p.head, OUTLINE, 1.1);
        g.beginPath();
        g.ellipse(hx, hy, 4.4, 3.6, -0.15, 0, Math.PI * 2);
        Game.cel(g, p.head, hx, hy, 4.4, 3.6, OUTLINE, 1.5);
        g.beginPath();
        g.moveTo(hx + 3, hy - 1.6);
        g.quadraticCurveTo(hx + 7.6, hy - 1.8, hx + 6.6, hy + 2.4);
        g.lineTo(hx + 5, hy + 0.8);
        g.lineTo(hx + 3, hy + 1.2);
        g.closePath();
        Game.blob(g, p.beak, OUTLINE, 1.2);
        if (!Ink.sil) {
            const bl = Game.blinking(t + 5);
            if (bl) Game.line(g, [[hx + 0.4, hy - 0.8], [hx + 2.6, hy - 0.8]], OUTLINE, 1);
            else {
                Game.ellipse(g, hx + 1.6, hy - 0.8, 1.3, 1.2, '#fbbf24', OUTLINE, 0.8);
                Game.dot(g, hx + 2, hy - 0.8, 0.6, '#1e1b4b');
            }
            Game.line(g, [[hx - 0.6, hy - 2.6], [hx + 3, hy - 2]], OUTLINE, 1.1); // a fierce brow
        }
        if (tier === 2) Game.tube(g, [[hx - 4.6, hy + 2.6], [hx - 2, hy + 4.4], [hx + 1.4, hy + 3.8]], 1.6, PET_RARE, 0.9); // rare: a blue band
        if (tier === 3) {
            // legendary: a crested helmet
            g.beginPath();
            g.ellipse(hx - 0.2, hy - 0.8, 4.6, 3.4, -0.15, Math.PI * 0.95, Math.PI * 2.05);
            g.closePath();
            Game.blob(g, '#cbd5e1', OUTLINE, 1.2);
            Game.tube(g, [[hx - 3.4, hy - 4], [hx - 0.6, hy - 5.4], [hx + 2.4, hy - 4.2]], 1.6, '#dc2626', 0.9);
        }
        if (tier >= 4 && !Ink.sil) {
            // phoenix crest of flames
            for (let i = 0; i < 3; i++) {
                const f = Math.sin(t * 0.25 + i) * 0.8;
                g.beginPath();
                g.moveTo(hx - 3 + i * 1.6, hy - 2.4);
                g.quadraticCurveTo(hx - 5.2 + i * 1.6 + f, hy - 6.4, hx - 6.6 + i * 1.8 + f, hy - 7.8 + i * 0.6);
                g.quadraticCurveTo(hx - 2.6 + i * 1.4, hy - 5.8, hx - 1.2 + i * 1.6, hy - 2.6);
                g.fillStyle = ['#ef4444', '#fb923c', '#fde047'][i];
                g.fill();
            }
        }
        wing(true);
        g.restore();
    },

    // ---------------------------------------------------------------- frog: sits, hops, licks

    pet_frog(g, p, tier, pose) {
        const t = pose.t || 0;
        const hop = Game.petHop(pose, 0.14);
        const lick = pose.act === 'lick';
        const y0 = -hop * 7;
        const squash = hop > 0 ? 1 + hop * 0.12 : 1 + Math.sin(t * 0.08) * 0.02;
        g.save();
        g.translate(0, y0);
        g.scale(1 / squash, squash);
        // mythic cape behind
        if (tier >= 4) {
            const wave = Math.sin(t * 0.1) * 1.2;
            g.beginPath();
            g.moveTo(-2, -15);
            g.quadraticCurveTo(-10 - wave, -10, -12 - wave, -1);
            g.lineTo(-3, -1);
            g.closePath();
            Game.cel(g, '#7e22ce', -7, -8, 6, 8, OUTLINE, 1.3);
            Game.line(g, [[-12 - wave, -1.2], [-3, -1.2]], PET_GOLD, 1.4);
        }
        // far back leg
        const legOut = hop * 4;
        Game.ellipse(g, -4.5 - legOut, -1.2 + hop * 1.6, 4.4, 1.6, Game.darker(p.skin, 0.8), OUTLINE, 1.2);
        // body
        g.beginPath();
        g.ellipse(0, -7.4, 9, 7.2, 0, 0, Math.PI * 2);
        Game.cel(g, p.skin, 0, -7.4, 9, 7.2, OUTLINE, 1.7);
        if (!Ink.sil) {
            g.save();
            g.beginPath();
            g.ellipse(0, -7.4, 9, 7.2, 0, 0, Math.PI * 2);
            g.clip();
            Game.ellipse(g, 4.6, -4, 5.4, 4.6, p.belly, null);
            for (const [x, y, r] of [[-4, -10, 1.4], [-6, -6, 1], [-1.6, -12.6, 0.9]]) Game.dot(g, x, y, r, p.spot);
            g.restore();
        }
        // near back leg (haunch + foot), front leg
        g.beginPath();
        g.ellipse(-3.6 - legOut * 0.5, -4, 4.2, 3.6, -0.4, 0, Math.PI * 2);
        Game.cel(g, p.skin, -3.6, -4, 4.2, 3.6, OUTLINE, 1.4);
        Game.ellipse(g, -1.6 - legOut, -0.9 + hop * 1.4, 4, 1.4, p.skin, OUTLINE, 1.2);
        Game.tube(g, [[5, -4], [6.4, -0.6 + hop]], 2.4, p.skin, 1.2);
        Game.ellipse(g, 7.6, -0.5 + hop, 2.2, 1, p.skin, OUTLINE, 1.1);
        // mouth
        if (lick) {
            g.beginPath();
            g.ellipse(7.4, -7.2, 2.4, 1.8, 0, 0, Math.PI * 2);
            Game.blob(g, p.mouth, OUTLINE, 1.1);
        } else {
            Game.line(g, [[3.6, -7.4], [6.2, -6.6], [8.6, -7.6]], OUTLINE, 1);
        }
        // eyes on top
        for (const [x, y] of [[0.6, -14.2], [5.6, -13.4]]) {
            g.beginPath();
            g.ellipse(x, y, 3.2, 3, 0, 0, Math.PI * 2);
            Game.cel(g, p.skin, x, y, 3.2, 3, OUTLINE, 1.4);
            if (!Ink.sil) {
                Game.ellipse(g, x + 0.4, y - 0.2, 2.1, 2, '#ffffff', null);
                Game.petEye(g, x + 0.9, y - 0.1, 1.1, t);
            }
        }
        // rarity gear on the head
        if (tier === 2) {
            // rare: a leaf cap
            g.beginPath();
            g.moveTo(-2.6, -16.6);
            g.quadraticCurveTo(2.6, -22, 8.8, -16.4);
            g.quadraticCurveTo(3, -15, -2.6, -16.6);
            Game.blob(g, '#22c55e', OUTLINE, 1.2);
            Game.line(g, [[-1.6, -16.6], [7.6, -16.6]], '#15803d', 0.8);
            Game.tube(g, [[3, -19.4], [3.6, -21.4]], 0.9, '#15803d', 0.7);
        }
        if (tier === 3) {
            // legendary: a red ninja headband, tails fluttering behind
            const fl = Math.sin(t * 0.3) * 1.4;
            Game.tube(g, [[-3, -12.4], [3, -11.4], [8.6, -12.2]], 1.8, '#dc2626', 1);
            Game.tube(g, [[-3, -12.4], [-7.6, -13.6 + fl], [-10.6, -11.6 + fl]], 1.4, '#dc2626', 0.9);
            Game.tube(g, [[-3, -12.2], [-7, -10.6 - fl * 0.6], [-9.6, -8.8 - fl]], 1.4, '#b91c1c', 0.9);
        }
        if (tier >= 4) Game.petCrown(g, 3.2, -16.4, 0.62, 0);
        g.restore();
    },

    // ---------------------------------------------------------------- donkey: four legs, long ears, kicks

    pet_donkey(g, p, tier, pose) {
        const t = pose.t || 0;
        const kick = pose.act === 'kick' ? Math.sin(Math.min(1, pose.k || 0) * Math.PI) : 0;
        const w = pose.walk || 0;
        const bob = -Math.abs(Math.sin(t * 0.2)) * 1 * w;
        // legs: hip, then a hoof following a walk cycle; back legs kick out backwards
        const leg = (hx, ph, far, back) => {
            const s = Math.sin(t * 0.2 + ph) * 3 * w;
            const lift = Math.max(0, Math.cos(t * 0.2 + ph)) * 1.6 * w;
            let foot = [hx + s, -lift];
            if (back && kick) foot = lerpPt(foot, [hx - 9, -6], kick);
            const col = far ? Game.darker(p.coat, 0.78) : p.coat;
            const { end } = Game.limb(g, [hx, -10 + bob], foot, 5.2, 5, back ? -1 : 1, 3.2, col);
            Game.ellipse(g, end[0] + 0.4, end[1] - 0.6, 1.7, 1.1, p.hoof, OUTLINE, 1);
        };
        leg(-6, Math.PI, true, true);
        leg(6, 0, true, false);
        // tail swish
        const sw = Math.sin(t * 0.09) * 2;
        Game.tube(g, [[-10, -13 + bob], [-13, -9 + sw * 0.4], [-13.4 + sw * 0.4, -5.4]], 1.3, p.coat, 1);
        if (tier >= 4 && !Ink.sil) {
            ['#f43f5e', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7'].forEach((c, i) => Game.line(g, [[-13.4 + sw * 0.4, -6.4], [-14.6 + sw * 0.6 - i * 0.5, -2 + i * 0.4]], c, 1.4));
        } else Game.ellipse(g, -13.6 + sw * 0.4, -4.6, 1.6, 2.2, p.mane, OUTLINE, 1);
        // body (everything above the legs sits 2 lower than it is drawn: a stockier donkey)
        g.save();
        g.translate(0, bob + 2);
        g.beginPath();
        g.ellipse(0, -15, 10.6, 5.8, 0, 0, Math.PI * 2);
        Game.cel(g, p.coat, 0, -15, 10.6, 5.8, OUTLINE, 1.7);
        if (!Ink.sil) {
            g.save();
            g.beginPath();
            g.ellipse(0, -15, 10.6, 5.8, 0, 0, Math.PI * 2);
            g.clip();
            Game.ellipse(g, 0, -10.4, 9, 2.6, p.belly, null);
            g.restore();
        }
        if (tier === 2) {
            // rare: a red saddle blanket with a gold edge
            g.beginPath();
            g.moveTo(-5, -20.2);
            g.quadraticCurveTo(0, -21.6, 5, -20.2);
            g.lineTo(5.6, -13);
            g.quadraticCurveTo(0, -12, -5.6, -13);
            g.closePath();
            Game.blob(g, '#dc2626', OUTLINE, 1.2);
            Game.line(g, [[-5.2, -13.8], [5.2, -13.8]], PET_GOLD, 1);
        }
        if (tier === 3) {
            // legendary: barding plates
            g.beginPath();
            g.moveTo(-8, -19.4);
            g.quadraticCurveTo(0, -22.4, 8, -19.4);
            g.lineTo(8.6, -12.6);
            g.quadraticCurveTo(0, -11, -8.6, -12.6);
            g.closePath();
            Game.cel(g, '#cbd5e1', 0, -16, 8, 4, OUTLINE, 1.2);
            Game.line(g, [[-8.4, -13.4], [8.4, -13.4]], PET_GOLD, 1.1);
            for (const x of [-5, 0, 5]) Game.dot(g, x, -17.4, 0.6, '#475569');
        }
        if (tier >= 4 && !Ink.sil) {
            // mythic: a gold saddle cloth with a gem
            g.beginPath();
            g.moveTo(-5, -20.2);
            g.quadraticCurveTo(0, -21.6, 5, -20.2);
            g.lineTo(5.4, -14);
            g.quadraticCurveTo(0, -13, -5.4, -14);
            g.closePath();
            Game.blob(g, PET_GOLD, OUTLINE, 1.1);
            Game.dot(g, 0, -17, 1.2, '#e879f9');
        }
        // neck, mane, head
        Game.tube(g, [[7, -17], [11, -22]], 5, p.coat, 1.4);
        if (tier >= 4 && !Ink.sil) {
            ['#f43f5e', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7'].forEach((c, i) => Game.line(g, [[6.4 + i * 1, -19 - i * 1.2], [8 + i * 1, -20.6 - i * 1.3]], c, 1.6));
        } else Game.tube(g, [[6.6, -19.4], [9.8, -24.4]], 1.6, p.mane, 0.9);
        const nod = Math.sin(t * 0.2) * 0.6 * w;
        g.save();
        g.translate(13, -23 + nod);
        g.rotate(0.45);
        // ears (flop a little)
        const flop = Math.sin(t * 0.07) * 0.12;
        for (const [x, r, far] of [[-2.4, -0.5 + flop, true], [-1, -0.25 - flop, false]]) {
            g.save();
            g.translate(x, -2.6);
            g.rotate(r);
            g.beginPath();
            g.ellipse(0, -4.4, 1.5, 4.4, 0, 0, Math.PI * 2);
            Game.blob(g, far ? Game.darker(p.coat, 0.8) : p.coat, OUTLINE, 1.1);
            if (!far && !Ink.sil) Game.ellipse(g, 0, -4.4, 0.6, 3, p.ear, null);
            g.restore();
        }
        g.beginPath();
        g.ellipse(1.6, 0, 5.4, 3.6, 0, 0, Math.PI * 2);
        Game.cel(g, p.coat, 1.6, 0, 5.4, 3.6, OUTLINE, 1.5);
        Game.ball(g, 5.4, 1, 2.8, 2.6, p.muzzle, 1.2);
        if (!Ink.sil) {
            Game.dot(g, 6.6, 0.4, 0.5, OUTLINE);
            Game.petEye(g, 1.2, -1, 1, t);
        }
        if (tier === 3) {
            // legendary: a chanfron and a red plume
            g.beginPath();
            g.moveTo(-1.4, -3);
            g.lineTo(4.6, -2.4);
            g.lineTo(6.4, 0.6);
            g.lineTo(0.6, 0.8);
            g.closePath();
            Game.blob(g, '#cbd5e1', OUTLINE, 1);
            Game.tube(g, [[-1, -3.4], [-3, -7], [-5.6, -8]], 2, '#dc2626', 0.9);
        }
        if (tier >= 4) Game.petCrown(g, -0.6, -3.6, 0.55, -0.35);
        g.restore();
        g.restore();
        leg(-7.5, 0, false, true);
        leg(7, Math.PI, false, false);
    },

    // ---------------------------------------------------------------- squirrel: sits up, big curled tail, hops

    pet_squirrel(g, p, tier, pose) {
        const t = pose.t || 0;
        const hop = Game.petHop(pose, 0.17);
        const y0 = -hop * 5;
        g.save();
        g.translate(0, y0);
        // tail: a fat S-curve up the back, curling at the top
        const sway = Math.sin(t * 0.07) * 1.2;
        const tail = () => {
            g.beginPath();
            g.moveTo(-3, -2);
            g.bezierCurveTo(-13, -1, -14 + sway, -12, -9 + sway, -19);
            g.bezierCurveTo(-6 + sway, -23, -1 + sway, -22, -2.6 + sway, -18);
            g.bezierCurveTo(-6 + sway, -17, -8, -11, -4, -6);
            g.closePath();
        };
        tail();
        if (tier >= 4 && !Ink.sil) {
            Game.cel(g, p.tail, -7, -11, 6, 10, OUTLINE, 1.6);
            g.save();
            tail();
            g.clip();
            const gr = g.createLinearGradient(-12, -20, -2, -2);
            gr.addColorStop(0, 'rgba(255,255,255,0.55)');
            gr.addColorStop(0.5, 'rgba(255,255,255,0)');
            g.fillStyle = gr;
            g.fillRect(-16, -24, 16, 24);
            g.restore();
        } else Game.cel(g, p.tail, -7, -11, 6, 10, OUTLINE, 1.6);
        if (!Ink.sil) Game.line(g, [[-9.6 + sway, -16.6], [-11 + sway, -11], [-8, -5]], Game.darker(p.tail, 0.8), 1);
        // back foot
        Game.ellipse(g, -0.4, -0.8, 3.8, 1.4, p.fur, OUTLINE, 1.2);
        // body
        g.beginPath();
        g.ellipse(1.6, -7.4, 5.4, 6.6, 0.12, 0, Math.PI * 2);
        Game.cel(g, p.fur, 1.6, -7.4, 5.4, 6.6, OUTLINE, 1.6);
        if (!Ink.sil) {
            g.save();
            g.beginPath();
            g.ellipse(1.6, -7.4, 5.4, 6.6, 0.12, 0, Math.PI * 2);
            g.clip();
            Game.ellipse(g, 4.6, -6.4, 3, 5, p.belly, null);
            g.restore();
        }
        if (tier === 2) {
            // rare: a green scarf
            Game.tube(g, [[-1.6, -12.4], [2.4, -11.2], [6, -12.6]], 2, '#16a34a', 1);
            Game.tube(g, [[0.4, -11.6], [-1, -8.4]], 1.6, '#16a34a', 0.9);
        }
        if (tier === 3) {
            // legendary: a satchel strap and bag
            Game.tube(g, [[5.6, -12.4], [-2, -4.4]], 1.1, '#78350f', 0.8);
            Game.ellipse(g, -2.4, -4, 2.4, 2, '#a16207', OUTLINE, 1.1);
        }
        // paws holding an acorn
        const nib = Math.sin(t * 0.3) > 0.6 ? 0.6 : 0;
        Game.ellipse(g, 6.6, -9.6 + nib, 1.8, 2.2, p.nut, OUTLINE, 1.1);
        g.beginPath();
        g.ellipse(6.6, -11.4 + nib, 2, 1, 0, Math.PI, 0);
        Game.blob(g, p.cap, OUTLINE, 1);
        Game.tube(g, [[3.6, -9.4], [5.6, -9.6]], 1.8, p.fur, 1);
        // head with ears
        const hy = -15.2;
        for (const [x, far] of [[1, true], [4.2, false]]) {
            g.beginPath();
            g.moveTo(x - 1.4, hy - 2.6);
            g.lineTo(x - 0.2, hy - 7);
            g.lineTo(x + 1.6, hy - 2.4);
            g.closePath();
            Game.blob(g, far ? Game.darker(p.fur, 0.8) : p.fur, OUTLINE, 1.1);
        }
        Game.ball(g, 4, hy, 4.6, 4.1, p.fur, 1.5);
        if (!Ink.sil) {
            Game.ellipse(g, 6.6, hy + 1.6, 2.2, 1.6, p.belly, null);
            Game.petEye(g, 5.4, hy - 0.8, 1.1, t);
            Game.dot(g, 8.4, hy + 1, 0.7, OUTLINE);
        }
        if (tier === 3) {
            // legendary: an explorer hat
            g.beginPath();
            g.ellipse(3.6, hy - 3.2, 6, 1.4, -0.1, 0, Math.PI * 2);
            Game.blob(g, '#78350f', OUTLINE, 1.1);
            g.beginPath();
            g.ellipse(3.4, hy - 4.2, 3.4, 2.6, -0.1, Math.PI, 0);
            g.closePath();
            Game.blob(g, '#92400e', OUTLINE, 1.1);
            Game.line(g, [[0.2, hy - 4], [6.6, hy - 4.6]], PET_GOLD, 0.9);
        }
        if (tier >= 4) Game.petCrown(g, 3.8, hy - 3.6, 0.6, 0.1);
        g.restore();
    },

    // ---------------------------------------------------------------- bunny: long ears, puffy tail, hops

    pet_bunny(g, p, tier, pose) {
        const t = pose.t || 0;
        const hop = Game.petHop(pose, 0.18);
        const y0 = -hop * 6;
        g.save();
        g.translate(0, y0);
        // legendary cape behind
        if (tier === 3) {
            const wave = Math.sin(t * 0.12) * 1.2 + hop * 2;
            g.beginPath();
            g.moveTo(0, -12.6);
            g.quadraticCurveTo(-8 - wave, -9, -10 - wave, -1.4);
            g.lineTo(-1, -1.4);
            g.closePath();
            Game.cel(g, '#dc2626', -5, -7, 5, 6, OUTLINE, 1.3);
            Game.line(g, [[-10 - wave, -1.6], [-1, -1.6]], PET_GOLD, 1.2);
        }
        // tail puff
        Game.ball(g, -6.8, -5.6, 2.6, 2.4, p.fur, 1.3);
        // hind foot
        Game.ellipse(g, -0.6 - hop * 2, -1 + hop, 4.6, 1.5, p.fur, OUTLINE, 1.2);
        // body
        g.beginPath();
        g.ellipse(0, -6.4, 6.8, 5.8, 0, 0, Math.PI * 2);
        Game.cel(g, p.fur, 0, -6.4, 6.8, 5.8, OUTLINE, 1.6);
        if (tier === 2 && !Ink.sil) {
            // rare: a little heart patch
            g.save();
            g.translate(-1.6, -6.4);
            g.beginPath();
            g.moveTo(0, 1.4);
            g.bezierCurveTo(-2.4, -0.4, -1.2, -2.4, 0, -1);
            g.bezierCurveTo(1.2, -2.4, 2.4, -0.4, 0, 1.4);
            g.fillStyle = '#f472b6';
            g.fill();
            g.restore();
        }
        // front paw
        Game.ellipse(g, 5, -1, 1.8, 1.2, p.fur, OUTLINE, 1.1);
        if (tier === 3) {
            // legendary: a golden carrot held up
            g.beginPath();
            g.moveTo(5.4, -2.4);
            g.lineTo(9.6, -9.4);
            g.lineTo(7.2, -2.2);
            g.closePath();
            Game.blob(g, PET_GOLD, OUTLINE, 1.1);
            Game.tube(g, [[9.4, -9.4], [10.6, -11.4]], 1, '#22c55e', 0.7);
        }
        // head and ears
        const hx = 4.6;
        const hy = -12.6;
        const twitch = Math.sin(t * 0.05) > 0.85 ? 0.18 : 0;
        for (const [x, r, far] of [[-1, -0.32 - twitch, true], [1.2, -0.12, false]]) {
            g.save();
            g.translate(hx + x, hy - 3);
            g.rotate(r - hop * 0.3);
            g.beginPath();
            g.ellipse(0, -5.4, 1.9, 5.6, 0, 0, Math.PI * 2);
            Game.blob(g, far ? p.shade : p.fur, OUTLINE, 1.2);
            if (!far && !Ink.sil) Game.ellipse(g, 0, -5, 0.8, 4, p.ear, null);
            if (!far && tier === 2) {
                // rare: a blue bow at the ear
                g.beginPath();
                g.moveTo(0, -1);
                g.lineTo(-2.6, -2.6);
                g.lineTo(-2.6, 0.6);
                g.closePath();
                g.moveTo(0, -1);
                g.lineTo(2.6, -2.6);
                g.lineTo(2.6, 0.6);
                g.closePath();
                Game.blob(g, PET_RARE, OUTLINE, 0.9);
            }
            g.restore();
        }
        Game.ball(g, hx, hy, 4.8, 4.2, p.fur, 1.5);
        if (!Ink.sil) {
            Game.petEye(g, hx + 1.6, hy - 0.8, 1.1, t);
            Game.dot(g, hx + 4.4, hy + 0.8, 0.8, p.nose);
            Game.ellipse(g, hx + 2.2, hy + 2, 1.2, 0.7, 'rgba(244,114,182,0.45)', null);
        }
        if (tier >= 4) Game.petCrown(g, hx - 0.6, hy - 3.6, 0.6, 0);
        g.restore();
    },

    // ---------------------------------------------------------------- profile pictures

    /** The pet's picture (a resting pose, fitted to 160 × 140) as a data URL, made once per pet and tier. */
    petIconURL(id, tier) {
        Game.petIcons = Game.petIcons || {};
        const key = `${id}_${tier}`;
        if (Game.petIcons[key] !== undefined) return Game.petIcons[key];
        let url = '';
        const big = typeof newCanvas === 'function' ? newCanvas(320, 320) : null;
        const out = big ? newCanvas(160, 140) : null;
        if (big && out) {
            try {
                // draw large, find what was drawn, then fit it into the icon with a little room
                // the bounds come from the pet alone (a mythic glow would shrink it), the picture keeps the glow
                const pose = { t: id === 'eagle' ? 3 : 40, walk: 0, ph: 0, face: 1 };
                const paint = noAura => {
                    big.g.clearRect(0, 0, 320, 320);
                    big.g.save();
                    big.g.translate(160, 250);
                    big.g.scale(5, 5);
                    Game.drawPetRig(big.g, id, tier, { ...pose, noAura }, false);
                    big.g.restore();
                };
                paint(true);
                const d = big.g.getImageData(0, 0, 320, 320).data;
                paint(false);
                let x0 = 320, y0 = 320, x1 = 0, y1 = 0;
                for (let y = 0; y < 320; y++) {
                    for (let x = 0; x < 320; x++) {
                        if (d[(y * 320 + x) * 4 + 3] > 8) {
                            if (x < x0) x0 = x;
                            if (x > x1) x1 = x;
                            if (y < y0) y0 = y;
                            if (y > y1) y1 = y;
                        }
                    }
                }
                if (x1 > x0 && y1 > y0) {
                    const w = x1 - x0 + 1;
                    const h = y1 - y0 + 1;
                    const k = Math.min(152 / w, 132 / h);
                    out.g.drawImage(big.cv, x0, y0, w, h, (160 - w * k) / 2, 136 - h * k, w * k, h * k);
                    url = out.cv.toDataURL('image/png');
                }
            } catch (e) { /* out of memory or blocked: no picture, the emoji stands in */ }
        }
        if (big) freeCanvas(big.cv);
        if (out) freeCanvas(out.cv);
        Game.petIcons[key] = url;
        return url;
    }
});
