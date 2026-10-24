/* Monster Hunter — monster looks (v3.5): five families drawn in a simple, chunky cartoon style with
   a dark outline and one main colour each, so the hero always stands out. Ranks add gear (helmets,
   weapons, capes, crowns); champions (rank 5+) get the tier's glow. Each look is drawn once per
   size/frame into a cached bitmap and reused. Extends Game (js/core.js). */

const MOB_OUTLINE = '#1c1917';
// champions (ranks 5–8) share their family's rank-4 look; each rank gets its own colour
const champ = (rank, list, base) => (rank >= 5 ? list[Math.min(rank, 8) - 5] : base);

const MobArt = {
    /** Thick limb with an outline: two strokes. */
    limb(g, x1, y1, x2, y2, w, color) {
        g.lineCap = 'round';
        g.strokeStyle = MOB_OUTLINE;
        g.lineWidth = w + g.ow * 2;
        g.beginPath();
        g.moveTo(x1, y1);
        g.lineTo(x2, y2);
        g.stroke();
        g.strokeStyle = color;
        g.lineWidth = w;
        g.beginPath();
        g.moveTo(x1, y1);
        g.lineTo(x2, y2);
        g.stroke();
    },
    shape(g, fill, path) {
        g.beginPath();
        path();
        g.fillStyle = fill;
        g.fill();
        g.strokeStyle = MOB_OUTLINE;
        g.lineWidth = g.ow;
        g.stroke();
    },
    circle(g, x, y, r, fill) {
        MobArt.shape(g, fill, () => g.arc(x, y, r, 0, TAU));
    },
    ellipse(g, x, y, rx, ry, fill, rot = 0) {
        MobArt.shape(g, fill, () => g.ellipse(x, y, rx, ry, rot, 0, TAU));
    },
    rrect(g, x, y, w, h, r, fill) {
        MobArt.shape(g, fill, () => g.roundRect(x, y, w, h, r));
    },
    poly(g, pts, fill) {
        MobArt.shape(g, fill, () => {
            g.moveTo(pts[0][0], pts[0][1]);
            for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
            g.closePath();
        });
    },
    dot(g, x, y, r, fill) {
        g.fillStyle = fill;
        g.beginPath();
        g.arc(x, y, r, 0, TAU);
        g.fill();
    },
    crown(g, x, y, w, color = '#facc15') {
        const h = w * 0.55;
        MobArt.poly(g, [[x - w / 2, y], [x - w / 2, y - h], [x - w / 4, y - h * 0.55], [x, y - h * 1.1], [x + w / 4, y - h * 0.55], [x + w / 2, y - h], [x + w / 2, y]], color);
        MobArt.dot(g, x, y - h * 0.35, w * 0.08, '#ef4444');
    },
    cape(g, s, color) {
        MobArt.poly(g, [[-s * 0.42, -s * 0.05], [s * 0.42, -s * 0.05], [s * 0.62, s * 0.92], [-s * 0.62, s * 0.92]], color);
    },
    sword(g, hx, hy, s, color = '#cbd5e1', len = 0.8) {
        MobArt.limb(g, hx, hy, hx + s * 0.12, hy - s * len, s * 0.12, color);
        MobArt.limb(g, hx - s * 0.16, hy - s * 0.08, hx + s * 0.18, hy - s * 0.12, s * 0.07, '#a16207');
    },

    // ---------------------------------------------------------------- Undead: skeletons
    undead(g, rank, s, f) {
        const bone = '#ece6da';
        const swing = f ? 1 : -1;
        if (rank >= 4) MobArt.cape(g, s, champ(rank, ['#7e22ce', '#b91c1c', '#111827', '#ca8a04'], '#4c1d95'));
        // legs and arms: thin bones
        MobArt.limb(g, -s * 0.18, s * 0.45, -s * 0.24 - swing * s * 0.12, s * 0.98, s * 0.13, bone);
        MobArt.limb(g, s * 0.18, s * 0.45, s * 0.24 + swing * s * 0.12, s * 0.98, s * 0.13, bone);
        MobArt.limb(g, -s * 0.36, s * 0.02, -s * 0.52 + swing * s * 0.1, s * 0.45, s * 0.12, bone);
        if (rank >= 2) MobArt.circle(g, -s * 0.6 + swing * s * 0.08, s * 0.32, s * 0.3, rank >= 4 ? '#475569' : '#92400e'); // shield
        MobArt.limb(g, s * 0.36, s * 0.02, s * 0.52 - swing * s * 0.1, s * 0.45, s * 0.12, bone);
        if (rank >= 3) MobArt.sword(g, s * 0.52 - swing * s * 0.1, s * 0.45, s, rank >= 5 ? '#fde68a' : '#cbd5e1');
        // ribcage
        MobArt.rrect(g, -s * 0.36, -s * 0.06, s * 0.72, s * 0.56, s * 0.18, bone);
        g.strokeStyle = '#78716c';
        g.lineWidth = g.ow * 0.8;
        g.beginPath();
        for (const y of [0.12, 0.28]) {
            g.moveTo(-s * 0.22, s * y);
            g.lineTo(s * 0.22, s * y);
        }
        g.moveTo(0, -s * 0.02);
        g.lineTo(0, s * 0.42);
        g.stroke();
        // skull
        MobArt.circle(g, 0, -s * 0.42, s * 0.42, bone);
        MobArt.rrect(g, -s * 0.2, -s * 0.16, s * 0.4, s * 0.2, s * 0.06, bone); // jaw
        MobArt.dot(g, -s * 0.16, -s * 0.46, s * 0.12, MOB_OUTLINE);
        MobArt.dot(g, s * 0.16, -s * 0.46, s * 0.12, MOB_OUTLINE);
        const glow = rank >= 4 ? '#22d3ee' : rank >= 3 ? '#facc15' : '#ef4444';
        MobArt.dot(g, -s * 0.16, -s * 0.46, s * 0.05, glow);
        MobArt.dot(g, s * 0.16, -s * 0.46, s * 0.05, glow);
        // headgear by rank
        if (rank >= 5) {
            MobArt.crown(g, 0, -s * 0.72, s * 0.6);
        } else if (rank >= 2) {
            MobArt.shape(g, rank >= 4 ? '#334155' : '#78716c', () => g.arc(0, -s * 0.5, s * 0.46, Math.PI * 1.02, Math.PI * 1.98));
            if (rank === 3) MobArt.poly(g, [[-s * 0.05, -s * 0.94], [s * 0.05, -s * 0.94], [s * 0.3, -s * 1.22], [-s * 0.12, -s * 1.14]], '#dc2626');
            if (rank === 4) {
                MobArt.poly(g, [[-s * 0.36, -s * 0.72], [-s * 0.62, -s * 1.12], [-s * 0.2, -s * 0.84]], '#e7e5e4');
                MobArt.poly(g, [[s * 0.36, -s * 0.72], [s * 0.62, -s * 1.12], [s * 0.2, -s * 0.84]], '#e7e5e4');
            }
        }
    },

    // ---------------------------------------------------------------- Beasts: wolves (side view)
    beasts(g, rank, s, f) {
        const fur = champ(rank, ['#fbbf24', '#93c5fd', '#3f3f46', '#18181b'], ['#a8a29e', '#57534e', '#7c4a2d', '#f1f5f9'][rank - 1]);
        const belly = champ(rank, ['#fde68a', '#e0f2fe', '#a1a1aa', '#52525b'], ['#d6d3d1', '#a8a29e', '#b07a4f', '#ffffff'][rank - 1]);
        const swing = f ? 1 : -1;
        // tail
        MobArt.limb(g, -s * 0.6, -s * 0.05, -s * 1.02, -s * 0.42 + swing * s * 0.06, s * 0.2, fur);
        // legs: front pair and back pair swing opposite
        for (const [x, k] of [[-s * 0.45, 1], [-s * 0.22, -1], [s * 0.25, -1], [s * 0.48, 1]]) {
            MobArt.limb(g, x, s * 0.2, x + swing * k * s * 0.12, s * 0.86, s * 0.17, fur);
        }
        // body
        MobArt.ellipse(g, 0, s * 0.05, s * 0.72, s * 0.42, fur);
        MobArt.ellipse(g, s * 0.05, s * 0.2, s * 0.45, s * 0.2, belly);
        if (rank === 2 || rank >= 4) {
            for (const x of [-0.35, -0.1, 0.15]) MobArt.poly(g, [[s * (x - 0.1), -s * 0.3], [s * x, -s * 0.58], [s * (x + 0.1), -s * 0.3]], rank >= 4 ? belly : '#292524');
        }
        // head
        MobArt.poly(g, [[s * 0.42, -s * 0.5], [s * 0.5, -s * 0.95], [s * 0.66, -s * 0.58]], fur); // ear
        MobArt.circle(g, s * 0.62, -s * 0.28, s * 0.36, fur);
        MobArt.ellipse(g, s * 0.95, -s * 0.18, s * 0.24, s * 0.15, belly);
        MobArt.dot(g, s * 1.16, -s * 0.22, s * 0.07, MOB_OUTLINE); // nose
        const big = rank === 1;
        MobArt.dot(g, s * 0.7, -s * 0.38, s * (big ? 0.12 : 0.08), '#fff');
        MobArt.dot(g, s * 0.73, -s * 0.38, s * (big ? 0.07 : 0.05), rank >= 3 ? '#dc2626' : MOB_OUTLINE);
        if (rank >= 2) {
            g.strokeStyle = MOB_OUTLINE;
            g.lineWidth = g.ow;
            g.beginPath();
            g.moveTo(s * 0.58, -s * 0.52);
            g.lineTo(s * 0.84, -s * 0.44);
            g.stroke();
            MobArt.poly(g, [[s * 0.92, -s * 0.06], [s * 0.98, s * 0.06], [s * 1.04, -s * 0.06]], '#fff'); // fang
        }
        if (rank >= 5) MobArt.crown(g, s * 0.58, -s * 0.6, s * 0.5);
    },

    // ---------------------------------------------------------------- Fantasy: trolls & ogres
    fantasy(g, rank, s, f) {
        const skin = champ(rank, ['#9a6b3f', '#78716c', '#9f1239', '#6d28d9'], ['#84cc16', '#4d7c0f', '#c08a4b', '#9a6b3f'][rank - 1]);
        const swing = f ? 1 : -1;
        MobArt.limb(g, -s * 0.26, s * 0.5, -s * 0.3 - swing * s * 0.08, s * 0.98, s * 0.24, skin);
        MobArt.limb(g, s * 0.26, s * 0.5, s * 0.3 + swing * s * 0.08, s * 0.98, s * 0.24, skin);
        MobArt.limb(g, -s * 0.55, -s * 0.05, -s * 0.78, s * 0.45 + swing * s * 0.05, s * 0.24, skin);
        // club (rank 2+) in the right hand
        if (rank >= 2) MobArt.limb(g, s * 0.8, s * 0.5, s * 0.95, -s * 0.45, s * (rank >= 3 ? 0.26 : 0.2), '#78350f');
        MobArt.limb(g, s * 0.55, -s * 0.05, s * 0.8, s * 0.45 - swing * s * 0.05, s * 0.24, skin);
        // belly
        MobArt.circle(g, 0, s * 0.18, s * 0.62, skin);
        MobArt.ellipse(g, 0, s * 0.3, s * 0.36, s * 0.3, 'rgba(255,255,255,0.18)');
        if (rank >= 2) MobArt.rrect(g, -s * 0.6, s * 0.38, s * 1.2, s * 0.16, s * 0.06, '#78350f'); // belt
        if (rank >= 4) {
            MobArt.circle(g, -s * 0.52, -s * 0.22, s * 0.22, '#64748b'); // shoulder plates
            MobArt.circle(g, s * 0.52, -s * 0.22, s * 0.22, '#64748b');
        }
        // head: small, low, with tusks
        MobArt.circle(g, 0, -s * 0.48, s * 0.32, skin);
        MobArt.dot(g, -s * 0.12, -s * 0.54, s * 0.07, '#fde047');
        MobArt.dot(g, s * 0.12, -s * 0.54, s * 0.07, '#fde047');
        MobArt.dot(g, -s * 0.12, -s * 0.54, s * 0.035, MOB_OUTLINE);
        MobArt.dot(g, s * 0.12, -s * 0.54, s * 0.035, MOB_OUTLINE);
        MobArt.poly(g, [[-s * 0.17, -s * 0.34], [-s * 0.12, -s * 0.5], [-s * 0.07, -s * 0.34]], '#fff');
        MobArt.poly(g, [[s * 0.07, -s * 0.34], [s * 0.12, -s * 0.5], [s * 0.17, -s * 0.34]], '#fff');
        if (rank >= 3) {
            g.strokeStyle = MOB_OUTLINE;
            g.lineWidth = g.ow * 1.2;
            g.beginPath();
            g.moveTo(-s * 0.22, -s * 0.66);
            g.lineTo(s * 0.22, -s * 0.66);
            g.stroke();
        }
        if (rank === 4) {
            MobArt.poly(g, [[-s * 0.22, -s * 0.7], [-s * 0.46, -s * 1.02], [-s * 0.06, -s * 0.78]], '#e7e5e4');
            MobArt.poly(g, [[s * 0.22, -s * 0.7], [s * 0.46, -s * 1.02], [s * 0.06, -s * 0.78]], '#e7e5e4');
        }
        if (rank >= 5) MobArt.crown(g, 0, -s * 0.74, s * 0.5);
    },

    // ---------------------------------------------------------------- Bandits: masked humans
    bandits(g, rank, s, f) {
        const cloth = champ(rank, ['#6b21a8', '#0f766e', '#111827', '#b45309'], ['#92400e', '#3f6212', '#1e3a8a', '#6b21a8'][rank - 1]);
        const skinC = '#e0ac69';
        const swing = f ? 1 : -1;
        if (rank >= 4) MobArt.cape(g, s, '#991b1b');
        MobArt.limb(g, -s * 0.16, s * 0.45, -s * 0.22 - swing * s * 0.12, s * 0.98, s * 0.17, '#292524');
        MobArt.limb(g, s * 0.16, s * 0.45, s * 0.22 + swing * s * 0.12, s * 0.98, s * 0.17, '#292524');
        if (rank === 2) MobArt.limb(g, -s * 0.5, -s * 0.5, s * 0.35, s * 0.4, s * 0.07, '#a16207'); // bow on the back
        MobArt.limb(g, -s * 0.36, 0, -s * 0.52 + swing * s * 0.1, s * 0.42, s * 0.15, cloth);
        // body (tunic / coat)
        MobArt.poly(g, [[-s * 0.34, -s * 0.12], [s * 0.34, -s * 0.12], [s * 0.42, s * 0.55], [-s * 0.42, s * 0.55]], cloth);
        MobArt.rrect(g, -s * 0.42, s * 0.28, s * 0.84, s * 0.1, s * 0.04, '#422006'); // belt
        if (rank >= 3) {
            MobArt.dot(g, 0, s * 0.05, s * 0.05, '#facc15');
            MobArt.dot(g, 0, s * 0.18, s * 0.05, '#facc15');
        }
        MobArt.limb(g, s * 0.36, 0, s * 0.52 - swing * s * 0.1, s * 0.42, s * 0.15, cloth);
        // weapon: dagger → cutlass → big sword
        const hx = s * 0.52 - swing * s * 0.1;
        const hy = s * 0.42;
        if (rank === 1 || rank === 2) MobArt.limb(g, hx, hy, hx + s * 0.1, hy - s * 0.32, s * 0.08, '#cbd5e1');
        else MobArt.sword(g, hx, hy, s, rank >= 4 ? '#fde68a' : '#e2e8f0', rank >= 4 ? 0.9 : 0.7);
        // head with a bandit mask
        MobArt.circle(g, 0, -s * 0.45, s * 0.36, skinC);
        MobArt.rrect(g, -s * 0.36, -s * 0.42, s * 0.72, s * 0.22, s * 0.08, '#1f2937'); // mask over the lower face
        MobArt.dot(g, -s * 0.13, -s * 0.52, s * 0.06, MOB_OUTLINE);
        MobArt.dot(g, s * 0.13, -s * 0.52, s * 0.06, MOB_OUTLINE);
        if (rank === 1) MobArt.shape(g, '#dc2626', () => g.arc(0, -s * 0.52, s * 0.37, Math.PI * 1.05, Math.PI * 1.95)); // bandana
        if (rank === 2) MobArt.shape(g, cloth, () => g.arc(0, -s * 0.46, s * 0.42, Math.PI * 0.95, Math.PI * 2.05)); // hood
        if (rank === 3 || rank === 4) {
            MobArt.poly(g, [[-s * 0.62, -s * 0.72], [s * 0.62, -s * 0.72], [s * 0.3, -s * 1.05], [-s * 0.3, -s * 1.05]], '#111827'); // hat
            if (rank === 4) MobArt.dot(g, 0, -s * 0.86, s * 0.08, '#facc15');
        }
        if (rank >= 5) MobArt.crown(g, 0, -s * 0.76, s * 0.55);
    },

    // ---------------------------------------------------------------- Bugs: seen from above, facing right
    bugs(g, rank, s, f) {
        const swing = f ? 1 : -1;
        const legs = (n, color, len) => {
            for (let i = 0; i < n; i++) {
                const x = s * (-0.3 + (0.6 * i) / Math.max(1, n - 1));
                const k = (i % 2 ? 1 : -1) * swing * s * 0.1;
                MobArt.limb(g, x, -s * 0.2, x + k, -s * len, s * 0.08, color);
                MobArt.limb(g, x, s * 0.2, x - k, s * len, s * 0.08, color);
            }
        };
        if (rank === 1) {
            legs(3, '#14532d', 0.62);
            MobArt.ellipse(g, -s * 0.05, 0, s * 0.62, s * 0.5, '#15803d');
            g.strokeStyle = MOB_OUTLINE;
            g.lineWidth = g.ow;
            g.beginPath();
            g.moveTo(-s * 0.62, 0);
            g.lineTo(s * 0.4, 0);
            g.stroke();
            MobArt.ellipse(g, -s * 0.2, -s * 0.22, s * 0.18, s * 0.08, 'rgba(255,255,255,0.35)');
            MobArt.circle(g, s * 0.6, 0, s * 0.22, '#14532d');
            MobArt.limb(g, s * 0.72, -s * 0.1, s * 0.98, -s * 0.3, s * 0.05, '#14532d');
            MobArt.limb(g, s * 0.72, s * 0.1, s * 0.98, s * 0.3, s * 0.05, '#14532d');
        } else if (rank === 2) {
            for (let i = 0; i < 4; i++) {
                const x = s * (-0.25 + 0.17 * i);
                const k = (i % 2 ? 1 : -1) * swing * s * 0.12;
                MobArt.limb(g, x, 0, x - s * 0.2 + k, -s * 0.85, s * 0.08, '#1c1917');
                MobArt.limb(g, x, 0, x - s * 0.2 - k, s * 0.85, s * 0.08, '#1c1917');
            }
            MobArt.circle(g, -s * 0.3, 0, s * 0.5, '#292524');
            MobArt.poly(g, [[-s * 0.42, -s * 0.14], [-s * 0.18, -s * 0.14], [-s * 0.3, 0], [-s * 0.18, s * 0.14], [-s * 0.42, s * 0.14], [-s * 0.3, 0]], '#dc2626');
            MobArt.circle(g, s * 0.32, 0, s * 0.3, '#292524');
            for (const y of [-0.1, 0.1]) MobArt.dot(g, s * 0.48, s * y, s * 0.06, '#ef4444');
        } else if (rank === 3) {
            // scorpion: pincers in front, tail arching back over the body
            MobArt.limb(g, s * 0.4, -s * 0.2, s * 0.85, -s * 0.45, s * 0.12, '#b45309');
            MobArt.limb(g, s * 0.4, s * 0.2, s * 0.85, s * 0.45, s * 0.12, '#b45309');
            MobArt.circle(g, s * 0.92, -s * 0.48, s * 0.16, '#d97706');
            MobArt.circle(g, s * 0.92, s * 0.48, s * 0.16, '#d97706');
            legs(4, '#92400e', 0.6);
            MobArt.ellipse(g, 0, 0, s * 0.55, s * 0.36, '#d97706');
            for (let i = 0; i < 4; i++) MobArt.circle(g, -s * (0.55 + i * 0.16), -swing * s * 0.04 * i, s * (0.17 - i * 0.02), '#b45309');
            MobArt.poly(g, [[-s * 1.12, 0], [-s * 1.3, -s * 0.14], [-s * 1.3, s * 0.14]], '#1c1917');
            for (const y of [-0.1, 0.1]) MobArt.dot(g, s * 0.42, s * y, s * 0.05, MOB_OUTLINE);
        } else {
            // mantis / queen: long abdomen, wings, big eyes
            const body = champ(rank, ['#7e22ce', '#0d9488', '#be123c', '#27272a'], '#4d7c0f');
            legs(3, MOB_OUTLINE, 0.7);
            MobArt.ellipse(g, -s * 0.15, -s * 0.42, s * 0.5, s * 0.2, 'rgba(224,242,254,0.55)', -0.3);
            MobArt.ellipse(g, -s * 0.15, s * 0.42, s * 0.5, s * 0.2, 'rgba(224,242,254,0.55)', 0.3);
            MobArt.ellipse(g, -s * 0.35, 0, s * 0.6, s * 0.34, body);
            g.strokeStyle = 'rgba(0,0,0,0.35)';
            g.lineWidth = g.ow;
            g.beginPath();
            for (const x of [-0.6, -0.4, -0.2]) {
                g.moveTo(s * x, -s * 0.28);
                g.lineTo(s * x, s * 0.28);
            }
            g.stroke();
            MobArt.ellipse(g, s * 0.32, 0, s * 0.26, s * 0.18, body);
            MobArt.circle(g, s * 0.66, 0, s * 0.2, body);
            for (const y of [-0.14, 0.14]) MobArt.dot(g, s * 0.74, s * y, s * 0.09, '#fde047');
            if (rank === 4) {
                MobArt.limb(g, s * 0.5, -s * 0.15, s * 0.95, -s * 0.4, s * 0.09, body); // raised claws
                MobArt.limb(g, s * 0.5, s * 0.15, s * 0.95, s * 0.4, s * 0.09, body);
            }
            if (rank >= 5) MobArt.crown(g, s * 0.66, -s * 0.16, s * 0.4);
        }
    }
};

/* v3.11: illustrated monsters (img/mobs/<family>_<rank>.webp). Rank 1 is a two-colour blob with an
   outline; every rank adds size, gear and detail; champions (5–8) get crowns. They glide: a hop for
   walkers, a gallop for wolves, a scuttle for bugs, and lean into their steps. MobArt stays as the
   fallback while the images load (and in tests). */
const MobSprites = {
    list: {},
    ready: null,
    load(base = (typeof window !== 'undefined' && window.MOB_SPRITE_BASE) || 'img/mobs/') {
        if (typeof Image === 'undefined' || typeof document === 'undefined') return Promise.resolve();
        const jobs = [];
        for (const fam of MOB_FAMILY_ORDER) {
            for (let r = 1; r <= 8; r++) {
                jobs.push(new Promise(resolve => {
                    loadImage(`${base}${fam}_${r}.webp`, img => {
                        if (img) this.list[`${fam}_${r}`] = { img, w: img.naturalWidth, h: img.naturalHeight, tints: {} };
                        resolve();
                    });
                }));
            }
        }
        this.ready = Promise.all(jobs);
        return this.ready;
    },
    get(family, rank) {
        return this.list[`${family}_${U.clamp(rank || 1, 1, 8)}`] || null;
    },
    /** The sprite's silhouette in one colour (made on first use; null if there's no canvas memory). */
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
    /** Drop the made-on-demand tints (after the GPU lost the canvases they can come back blank). */
    dropTints() {
        for (const sp of Object.values(this.list)) {
            for (const cv of Object.values(sp.tints)) freeCanvas(cv);
            sp.tints = {};
        }
    }
};
MobSprites.load();

// how each family moves: hop height, lean and squash (all × size)
const MOB_GAIT = {
    undead: { hop: 0.14, lean: 0.1, squash: 0.05 },
    beasts: { hop: 0.1, lean: 0.07, squash: 0.04, pitch: true },
    fantasy: { hop: 0.1, lean: 0.12, squash: 0.07 },
    bandits: { hop: 0.13, lean: 0.09, squash: 0.05 },
    bugs: { hop: 0.03, lean: 0.04, squash: 0.06 }
};
const MOB_BOX = { h: 2.4, w: 2.8, foot: 0.95 }; // sprite fits 2.4×2.8 size; feet a little under the centre
const MOB_ART_SCALE = [1, 1, 1, 1, 1, 0.8, 0.8, 0.8, 0.8]; // by rank: champions' detailed art is drawn 20% smaller

extendGame({
    /** Cached bitmap of a monster look: one per family/rank/size/frame/flash, at screen resolution. */
    mobSprite(family, rank, size, frame, flash) {
        const k = this.dpr * this.scale;
        if (this.mobCacheK !== k) {
            if (this.mobCache) this.mobCache.forEach(freeCanvas);
            this.mobCache = new Map();
            this.mobCacheK = k;
        }
        const s = Math.round(size);
        const key = `${family}${rank}:${s}:${frame}:${flash ? 1 : 0}`;
        let cv = this.mobCache.get(key);
        if (cv) return cv;
        const box = s * 3.4;
        const c = newCanvas(Math.max(8, Math.ceil(box * k)), Math.max(8, Math.ceil(box * k)));
        if (!c) return null;
        cv = c.cv;
        const g = c.g;
        g.scale(k, k);
        g.translate(box / 2, box / 2);
        g.lineJoin = 'round';
        g.ow = Math.max(1, s * 0.1);
        (MobArt[family] || MobArt.undead)(g, rank, s, frame);
        if (flash) {
            g.setTransform(1, 0, 0, 1, 0, 0);
            g.globalCompositeOperation = 'source-atop';
            g.fillStyle = 'rgba(255,255,255,0.85)';
            g.fillRect(0, 0, cv.width, cv.height);
        }
        this.mobCache.set(key, cv);
        return cv;
    },

    /** The sprite's size at this monster size: fits the box, keeps the aspect. */
    mobSpriteBox(sp, s, rank = 1) {
        const k = Math.min((MOB_BOX.h * s) / sp.h, (MOB_BOX.w * s) / sp.w) * (MOB_ART_SCALE[rank] || 1);
        return { W: sp.w * k, H: sp.h * k };
    },

    /** Draw a family monster at (m.x, m.y): faces where it walks (bugs turn towards it). */
    drawMob(ctx, m) {
        const dx = m.x - (m.lastX ?? m.x);
        const dy = m.y - (m.lastY ?? m.y);
        m.lastX = m.x;
        m.lastY = m.y;
        if (Math.abs(dx) > 0.08) m.face = dx < 0 ? -1 : 1;
        if (Math.hypot(dx, dy) > 0.15) {
            const want = Math.atan2(dy, dx);
            m.heading = m.heading === undefined ? want : m.heading + U.angleDelta(m.heading, want) * 0.15;
        }
        const s = m.size;
        // v3.11.1: no glow on monsters — only the hero gets effects, so it stands out
        const sp = MobSprites.get(m.family, m.rank);
        if (sp) return this.drawMobSprite(ctx, m, sp);
        m.art = null;
        const frame = Math.floor(m.phase * 0.55) % 2;
        const cv = this.mobSprite(m.family, m.rank, s, frame, m.flash > 0);
        if (!cv) return;
        const box = Math.round(s) * 3.4;
        const bob = Math.abs(Math.sin(m.phase * 0.55 * Math.PI)) * s * 0.06;
        ctx.save();
        ctx.translate(m.x, m.y - bob);
        if (m.family === 'bugs') ctx.rotate(m.heading || Math.PI / 2);
        else if ((m.face || 1) < 0) ctx.scale(-1, 1);
        ctx.drawImage(cv, -box / 2, -box / 2, box, box);
        ctx.restore();
    }
,

    drawMobSprite(ctx, m, sp) {
        const s = m.size;
        const gait = MOB_GAIT[m.family] || MOB_GAIT.undead;
        const { W, H } = this.mobSpriteBox(sp, s, m.rank);
        const step = m.phase * 0.55 * Math.PI; // the old two-frame walk cycle
        const up = Math.abs(Math.sin(step));
        const face = (m.face || 1) < 0 ? -1 : 1;
        const lift = up * s * gait.hop;
        const tilt = gait.pitch ? -Math.cos(step * 2) * gait.lean * 0.6 : Math.sin(step) * gait.lean;
        const sq = 1 + (1 - up) * gait.squash; // a little squash on landing
        const art = (m.art = { x: m.x, y: m.y + s * MOB_BOX.foot - lift, tilt, face, W, H, sq, sp });
        this.blitMob(ctx, art, sp.img, ctx.globalAlpha);
        const white = m.flash > 0 && MobSprites.tint(sp, '#ffffff');
        if (white) this.blitMob(ctx, art, white, ctx.globalAlpha * 0.85);
    },

    /** One image at the monster's current pose (feet at art.y). */
    blitMob(ctx, art, img, alpha) {
        const a = ctx.globalAlpha;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(art.x, art.y);
        ctx.rotate(art.tilt);
        ctx.scale(art.face * art.sq, 1 / art.sq);
        ctx.drawImage(img, -art.W / 2, -art.H, art.W, art.H);
        ctx.restore();
        ctx.globalAlpha = a;
    },

    /** Poison / ice colour over the sprite's own shape (false: no sprite, use the old blob). */
    tintMob(ctx, m, color, alpha) {
        if (!m.art) return false;
        const cv = MobSprites.tint(m.art.sp, color);
        if (cv) this.blitMob(ctx, m.art, cv, alpha);
        return true;
    },

    /** Top of the drawn monster (for the HP bar and stun stars). */
    mobTop(m) {
        return m.art ? m.art.y - m.art.H / m.art.sq : m.y - m.size * 1.35;
    }
});
