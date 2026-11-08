/* Monster Hunter — meme mode looks, drawn in the monsters' chunky cartoon style (MobArt helpers,
   dark outline) instead of emoji. Each look draws centred on (0, 0) in a box about 100 units wide;
   js/codes.js caches every look once as a bitmap and blits it. Only memes nobody owns. */

const MemeArt = (() => {
    const A = MobArt;
    const O = MOB_OUTLINE;
    const eye = (g, x, y, r, look = 0) => {
        A.circle(g, x, y, r, '#fff');
        A.dot(g, x + look * r * 0.45, y, r * 0.5, O);
    };
    const line = (g, w, pts, color = O, close = false) => {
        g.strokeStyle = color;
        g.lineWidth = w;
        g.lineCap = 'round';
        g.lineJoin = 'round';
        g.beginPath();
        g.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
        if (close) g.closePath();
        g.stroke();
    };
    const arc = (g, x, y, r, a0, a1, w = 3, color = O) => {
        g.strokeStyle = color;
        g.lineWidth = w;
        g.lineCap = 'round';
        g.beginPath();
        g.arc(x, y, r, a0, a1);
        g.stroke();
    };
    const PI = Math.PI;

    const skull = g => {
        A.shape(g, '#f5f5f4', () => {
            g.moveTo(-30, 8);
            g.bezierCurveTo(-40, -40, 40, -40, 30, 8);
            g.lineTo(22, 16);
            g.lineTo(22, 30);
            g.lineTo(-22, 30);
            g.lineTo(-22, 16);
            g.closePath();
        });
        A.ellipse(g, -13, -2, 9, 10, '#292524');
        A.ellipse(g, 13, -2, 9, 10, '#292524');
        A.poly(g, [[0, 8], [-5, 16], [5, 16]], '#292524');
        for (let x = -14; x <= 14; x += 7) line(g, 2.5, [[x, 21], [x, 29]]);
    };
    const moai = g => {
        A.shape(g, '#a8a29e', () => {
            g.moveTo(-24, -40);
            g.lineTo(24, -40);
            g.lineTo(28, 30);
            g.lineTo(18, 42);
            g.lineTo(-18, 42);
            g.lineTo(-28, 30);
            g.closePath();
        });
        A.rrect(g, -28, -22, 56, 9, 3, '#78716c'); // the heavy brow
        A.dot(g, -11, -9, 4, '#292524');
        A.dot(g, 11, -9, 4, '#292524');
        line(g, 4, [[2, -14], [8, 12], [-4, 14]], '#57534e');
        A.rrect(g, -12, 22, 24, 6, 2, '#57534e');
    };
    const stonks = g => {
        A.rrect(g, -38, -34, 76, 64, 6, '#f8fafc');
        g.strokeStyle = '#cbd5e1';
        g.lineWidth = 1.5;
        for (let i = -1; i <= 1; i++) {
            g.beginPath();
            g.moveTo(-34, i * 15 - 2);
            g.lineTo(34, i * 15 - 2);
            g.moveTo(i * 20, -30);
            g.lineTo(i * 20, 26);
            g.stroke();
        }
        line(g, 9, [[-30, 20], [-14, 4], [-4, 12], [12, -10], [26, -22]], O);
        line(g, 5, [[-30, 20], [-14, 4], [-4, 12], [12, -10], [26, -22]], '#22c55e');
        A.poly(g, [[32, -30], [16, -26], [28, -14]], '#22c55e');
    };

    return {
        // ------------------------------------------------------------ small / medium / large
        doge(g) {
            A.poly(g, [[-30, -14], [-26, -42], [-8, -26]], '#d97706');
            A.poly(g, [[30, -14], [26, -42], [8, -26]], '#d97706');
            A.ellipse(g, 0, 0, 34, 30, '#f59e0b');
            A.ellipse(g, 0, 14, 20, 15, '#fef3c7');
            eye(g, -13, -6, 6, 1);
            eye(g, 13, -6, 6, 1); // the side-eye
            line(g, 3, [[-20, -16], [-8, -18]]);
            line(g, 3, [[8, -19], [20, -15]]);
            A.ellipse(g, 0, 6, 6, 4, O);
            arc(g, -5, 14, 5, 0.1 * PI, 0.9 * PI);
            arc(g, 5, 14, 5, 0.1 * PI, 0.9 * PI);
        },
        monke(g) {
            A.circle(g, -32, -2, 9, '#44403c');
            A.circle(g, 32, -2, 9, '#44403c');
            A.ellipse(g, 0, 0, 32, 34, '#44403c');
            A.shape(g, '#a8a29e', () => {
                g.moveTo(0, -10);
                g.bezierCurveTo(-30, -30, -34, 26, 0, 30);
                g.bezierCurveTo(34, 26, 30, -30, 0, -10);
            });
            A.rrect(g, -22, -18, 44, 8, 4, '#292524');
            eye(g, -10, -4, 5);
            eye(g, 10, -4, 5);
            A.dot(g, -4, 8, 2.5, O);
            A.dot(g, 4, 8, 2.5, O);
            arc(g, 0, 14, 9, 0.15 * PI, 0.85 * PI);
        },
        frog(g) {
            A.circle(g, -16, -20, 13, '#4ade80');
            A.circle(g, 16, -20, 13, '#4ade80');
            A.ellipse(g, 0, 4, 38, 26, '#4ade80');
            eye(g, -16, -21, 8, 0.6);
            eye(g, 16, -21, 8, 0.6);
            A.shape(g, '#ef4444', () => {
                g.moveTo(-26, 6);
                g.quadraticCurveTo(0, 30, 26, 6);
                g.quadraticCurveTo(0, 14, -26, 6);
            });
            A.dot(g, -6, -4, 2, O);
            A.dot(g, 6, -4, 2, O);
        },
        cricket(g) {
            line(g, 3, [[-8, -18], [-20, -42]]);
            line(g, 3, [[8, -18], [22, -40]]);
            line(g, 4, [[-14, 10], [-34, -2], [-38, 26]]);
            line(g, 4, [[14, 10], [34, -2], [38, 26]]);
            A.ellipse(g, 0, 14, 16, 22, '#65a30d');
            A.circle(g, 0, -14, 14, '#84cc16');
            eye(g, -6, -16, 5);
            eye(g, 6, -16, 5);
            g.fillStyle = '#fff';
            g.font = `bold 16px ${DISPLAY_FONT}`;
            g.textAlign = 'center';
            g.fillText('. . .', 0, 44);
        },
        skull,
        ghost(g) {
            A.shape(g, '#f8fafc', () => {
                g.moveTo(-28, 34);
                g.lineTo(-28, -6);
                g.bezierCurveTo(-28, -46, 28, -46, 28, -6);
                g.lineTo(28, 34);
                for (let i = 0; i < 4; i++) g.quadraticCurveTo(21 - i * 14, 26, 14 - i * 14, 34);
                g.closePath();
            });
            line(g, 3.5, [[-16, -12], [-6, -8], [-16, -4]]); // >_<
            line(g, 3.5, [[16, -12], [6, -8], [16, -4]]);
            A.shape(g, '#f472b6', () => {
                g.moveTo(-6, 6);
                g.lineTo(8, 6);
                g.quadraticCurveTo(10, 22, 1, 20);
                g.quadraticCurveTo(-6, 18, -6, 6);
            });
        },
        moai,
        cap(g) {
            A.shape(g, '#2563eb', () => {
                g.moveTo(-30, 8);
                g.bezierCurveTo(-30, -36, 26, -36, 26, 8);
                g.closePath();
            });
            A.ellipse(g, 26, 8, 22, 7, '#1d4ed8', -0.08); // the brim
            line(g, 2.5, [[-2, -26], [-4, 6]], '#1e3a8a');
            A.circle(g, -2, -27, 4, '#1d4ed8');
            g.fillStyle = '#fff';
            g.font = `bold 14px ${DISPLAY_FONT}`;
            g.textAlign = 'center';
            g.textBaseline = 'middle';
            g.fillText('CAP', -14, -8);
        },
        clown(g) {
            ['#ef4444', '#facc15', '#22c55e', '#3b82f6'].forEach((c, i) => {
                A.circle(g, -34 + (i % 2) * 6, -14 + (i >> 1) * 16, 11, c);
                A.circle(g, 34 - (i % 2) * 6, -14 + (i >> 1) * 16, 11, c);
            });
            A.ellipse(g, 0, 0, 28, 32, '#fafaf9');
            eye(g, -10, -8, 5);
            eye(g, 10, -8, 5);
            line(g, 2.5, [[-10, -18], [-10, -24]], '#3b82f6');
            line(g, 2.5, [[10, -18], [10, -24]], '#3b82f6');
            A.shape(g, '#ef4444', () => {
                g.moveTo(-18, 12);
                g.quadraticCurveTo(0, 32, 18, 12);
                g.quadraticCurveTo(0, 20, -18, 12);
            });
            A.circle(g, 0, 4, 7, '#ef4444');
        },
        stonks,
        cucumber(g) {
            g.save();
            g.rotate(-0.5);
            A.rrect(g, -14, -42, 28, 84, 14, '#4d7c0f');
            g.fillStyle = '#65a30d';
            for (let y = -32; y <= 32; y += 16) g.fillRect(-4, y, 8, 10);
            g.fillStyle = '#365314';
            [[-8, -24], [7, -10], [-7, 8], [8, 22], [-6, 34]].forEach(([x, y]) => g.fillRect(x - 1.5, y - 1.5, 3, 3));
            g.restore();
            eye(g, -8, -6, 6, -0.4);
            eye(g, 8, -14, 6, -0.4);
            line(g, 3, [[-14, -16], [-3, -12]]);
            line(g, 3, [[2, -22], [13, -24]]);
            arc(g, 2, 8, 6, 1.15 * PI, 1.85 * PI);
        },
        // ------------------------------------------------------------ brain rot
        /** A background character with a quest marker over its blank face. */
        npc(g) {
            A.rrect(g, -26, -22, 52, 54, 12, '#d6d3d1');
            A.dot(g, -10, 0, 3.5, O);
            A.dot(g, 10, 0, 3.5, O);
            line(g, 3, [[-9, 16], [9, 16]]);
            A.rrect(g, -6, -50, 12, 18, 4, '#facc15');
            A.circle(g, 0, -27, 4.5, '#facc15');
        },
        /** Farming aura: smug, glowing, +1000. */
        aura(g) {
            for (let i = 3; i > 0; i--) {
                g.fillStyle = `rgba(250,204,21,${0.12 * i})`;
                g.beginPath();
                g.arc(0, 2, 30 + i * 6, 0, 2 * PI);
                g.fill();
            }
            A.circle(g, 0, 2, 30, '#fcd34d');
            arc(g, -11, -2, 6, 1.1 * PI, 1.9 * PI, 3); // smug closed eyes
            arc(g, 11, -2, 6, 1.1 * PI, 1.9 * PI, 3);
            arc(g, 4, 14, 9, 0.1 * PI, 0.6 * PI, 3); // smirk
            g.font = `bold 15px ${DISPLAY_FONT}`;
            g.textAlign = 'center';
            g.textBaseline = 'middle';
            g.lineWidth = 4;
            g.strokeStyle = O;
            g.strokeText('+1000', 0, -40);
            g.fillStyle = '#fef08a';
            g.fillText('+1000', 0, -40);
        },
        /** "6 7": the digits with eyes, hands weighing it up. */
        sixseven(g) {
            g.font = `52px ${DISPLAY_FONT}`;
            g.textAlign = 'center';
            g.textBaseline = 'middle';
            g.lineWidth = 7;
            g.lineJoin = 'round';
            g.strokeStyle = O;
            g.strokeText('67', 0, 4);
            g.fillStyle = '#c084fc';
            g.fillText('67', 0, 4);
            A.dot(g, -12, 6, 3, O);
            A.dot(g, 15, -8, 3, O);
            for (const [x, y] of [[-36, -16], [36, 10]]) {
                g.save();
                g.translate(x, y);
                g.scale(0.32, 0.32);
                g.rotate(x < 0 ? 0 : PI);
                MemeArt.hand(g);
                g.restore();
            }
        },
        /** Rizz: one eyebrow up, a wink and a grin. */
        rizz(g) {
            A.circle(g, 0, 0, 32, '#fdba74');
            line(g, 3.5, [[-20, -16], [-6, -22]]);
            line(g, 3.5, [[6, -16], [20, -13]]);
            eye(g, -12, -6, 6, 0.3);
            arc(g, 13, -4, 6, 0.1 * PI, 0.9 * PI, 3); // wink
            A.shape(g, '#fff', () => {
                g.moveTo(-14, 10);
                g.quadraticCurveTo(0, 26, 16, 8);
                g.closePath();
            });
            A.poly(g, [[22, -30], [26, -22], [34, -22], [28, -17], [30, -9], [22, -14], [14, -9], [16, -17], [10, -22], [18, -22]], '#fde047');
        },
        /** You're cooked: an egg in a frying pan, looking worried. */
        cooked(g) {
            line(g, 9, [[26, 10], [46, 30]], O);
            line(g, 5, [[26, 10], [46, 30]], '#78350f');
            A.circle(g, 0, 0, 32, '#374151');
            A.circle(g, 0, 0, 26, '#4b5563');
            A.shape(g, '#fafaf9', () => {
                g.moveTo(-20, -4);
                g.bezierCurveTo(-24, -24, 6, -28, 14, -16);
                g.bezierCurveTo(28, -6, 18, 20, 0, 18);
                g.bezierCurveTo(-18, 20, -16, 8, -20, -4);
            });
            A.circle(g, -1, -2, 9, '#f59e0b');
            A.dot(g, -4, -3, 1.8, O);
            A.dot(g, 3, -3, 1.8, O);
            arc(g, -0.5, 4, 3, 1.15 * PI, 1.85 * PI, 1.8);
            g.strokeStyle = 'rgba(255,255,255,0.6)';
            g.lineWidth = 2;
            for (const x of [-12, 0, 12]) {
                g.beginPath();
                g.moveTo(x, -34);
                g.bezierCurveTo(x - 5, -40, x + 5, -44, x, -50);
                g.stroke();
            }
        },
        // ------------------------------------------------------------ the heavy tiers
        goat(g) {
            line(g, 9, [[-12, -24], [-24, -42], [-36, -36]], O);
            line(g, 5, [[-12, -24], [-24, -42], [-36, -36]], '#d6d3d1');
            line(g, 9, [[12, -24], [24, -42], [36, -36]], O);
            line(g, 5, [[12, -24], [24, -42], [36, -36]], '#d6d3d1');
            A.ellipse(g, -26, -8, 12, 6, '#f5f5f4', 0.4);
            A.ellipse(g, 26, -8, 12, 6, '#f5f5f4', -0.4);
            A.shape(g, '#fafaf9', () => {
                g.moveTo(-20, -24);
                g.lineTo(20, -24);
                g.lineTo(14, 22);
                g.lineTo(-14, 22);
                g.closePath();
            });
            A.poly(g, [[-8, 20], [8, 20], [0, 42]], '#e7e5e4'); // the beard
            A.ellipse(g, -9, -8, 6, 4, '#facc15');
            A.ellipse(g, 9, -8, 6, 4, '#facc15');
            g.fillStyle = O;
            g.fillRect(-12, -9, 6, 2);
            g.fillRect(6, -9, 6, 2);
            A.ellipse(g, 0, 12, 6, 4, '#a8a29e');
        },
        brain(g) {
            A.shape(g, '#f9a8d4', () => {
                for (let i = 0; i < 9; i++) {
                    const a = (i / 9) * 2 * PI;
                    g.arc(Math.cos(a) * 24, Math.sin(a) * 18 - 4, 14, 0, 2 * PI);
                }
            });
            A.ellipse(g, 0, -4, 30, 24, '#f9a8d4');
            line(g, 3, [[0, -26], [0, 18]], '#db2777');
            arc(g, -14, -12, 8, 0.2 * PI, 1.4 * PI, 3, '#db2777');
            arc(g, 14, -12, 8, 1.6 * PI, 2.8 * PI, 3, '#db2777');
            eye(g, -10, 4, 6);
            eye(g, 10, 4, 6);
            arc(g, 0, 12, 7, 0.2 * PI, 0.8 * PI);
        },
        icecold(g) {
            A.circle(g, 0, 0, 34, '#7dd3fc');
            A.shape(g, '#e0f2fe', () => {
                g.moveTo(-34, -6);
                g.bezierCurveTo(-30, -40, 30, -40, 34, -6);
                for (let x = 34; x > -34; x -= 12) g.lineTo(x - 6, 6), g.lineTo(x - 12, -6);
                g.closePath();
            });
            eye(g, -12, 2, 6);
            eye(g, 12, 2, 6);
            A.rrect(g, -16, 14, 32, 12, 4, '#fff');
            for (let x = -10; x <= 10; x += 5) line(g, 1.5, [[x, 14], [x, 26]], '#64748b');
            line(g, 1.5, [[-16, 20], [16, 20]], '#64748b');
        },
        alien(g) {
            A.shape(g, '#86efac', () => {
                g.moveTo(0, 38);
                g.bezierCurveTo(-46, 6, -36, -40, 0, -40);
                g.bezierCurveTo(36, -40, 46, 6, 0, 38);
            });
            A.ellipse(g, -14, -2, 10, 16, '#0f172a', 0.5);
            A.ellipse(g, 14, -2, 10, 16, '#0f172a', -0.5);
            A.dot(g, -17, -8, 3, '#fff');
            A.dot(g, 11, -8, 3, '#fff');
            line(g, 2.5, [[-5, 24], [5, 24]]);
        },
        hundred(g) {
            g.save();
            g.rotate(-0.12);
            g.font = `48px ${DISPLAY_FONT}`;
            g.textAlign = 'center';
            g.textBaseline = 'middle';
            g.lineWidth = 7;
            g.strokeStyle = O;
            g.lineJoin = 'round';
            g.strokeText('100', 0, -6);
            g.fillStyle = '#ef4444';
            g.fillText('100', 0, -6);
            line(g, 9, [[-34, 20], [34, 18]], O);
            line(g, 5, [[-34, 20], [34, 18]], '#ef4444');
            line(g, 9, [[-28, 32], [30, 30]], O);
            line(g, 5, [[-28, 32], [30, 30]], '#ef4444');
            g.restore();
        },
        // ------------------------------------------------------------ Sigma Cat (meme mode's first boss)
        /** A cartoon hand with the index finger up: the "well, actually" finger (never the rude one). */
        hand(g) {
            const Y = '#facc15';
            A.rrect(g, -10, -44, 14, 40, 7, Y); // index finger
            A.rrect(g, -20, -12, 40, 36, 12, Y); // fist
            line(g, 2.5, [[-12, 4], [12, 4]], '#ca8a04'); // curled fingers
            line(g, 2.5, [[-12, 13], [12, 13]], '#ca8a04');
            A.ellipse(g, 20, 4, 8, 14, Y, -0.3); // thumb
            A.ellipse(g, -3, -38, 4, 3, '#fef9c3'); // fingernail
        },
        shush(g) {
            MemeArt.hand(g);
            g.font = `bold 20px ${DISPLAY_FONT}`;
            g.textAlign = 'center';
            g.textBaseline = 'middle';
            g.lineWidth = 4;
            g.strokeStyle = O;
            g.strokeText('shh', 0, 38);
            g.fillStyle = '#e0f2fe';
            g.fillText('shh', 0, 38);
        },
        sigma_think(g) {
            MemeArt.sigmaCat(g, false);
            g.save();
            g.translate(-22, 30);
            g.scale(0.55, 0.55);
            g.rotate(-0.25);
            MemeArt.hand(g);
            g.restore();
        },
        sigma_shush(g) {
            MemeArt.sigmaCat(g, true);
            g.save();
            g.translate(2, 40);
            g.scale(0.55, 0.55);
            MemeArt.hand(g);
            g.restore();
        },
        /** A grey tabby with huge eyes. `shush` looks straight at you; otherwise it side-eyes, thinking. */
        sigmaCat(g, shush) {
            const fur = '#9ca3af';
            A.poly(g, [[-36, -12], [-30, -46], [-10, -32]], fur);
            A.poly(g, [[36, -12], [30, -46], [10, -32]], fur);
            A.poly(g, [[-31, -18], [-28, -38], [-17, -30]], '#f9a8d4');
            A.poly(g, [[31, -18], [28, -38], [17, -30]], '#f9a8d4');
            A.ellipse(g, 0, 2, 40, 36, fur);
            // tabby stripes on the forehead
            line(g, 3, [[-12, -30], [-8, -20]], '#4b5563');
            line(g, 3, [[0, -33], [0, -21]], '#4b5563');
            line(g, 3, [[12, -30], [8, -20]], '#4b5563');
            line(g, 3, [[-38, 0], [-28, 2]], '#4b5563');
            line(g, 3, [[38, 0], [28, 2]], '#4b5563');
            A.ellipse(g, 0, 18, 20, 14, '#f3f4f6'); // muzzle
            const look = shush ? 0 : 0.5;
            for (const x of [-15, 15]) {
                A.circle(g, x, -6, 11, '#fefce8');
                A.dot(g, x + look * 4, -6 - (shush ? 0 : 2), 8, '#111827');
                A.dot(g, x + look * 4 - 3, -10, 2.6, '#fff');
            }
            A.poly(g, [[-5, 8], [5, 8], [0, 13]], '#f472b6'); // nose
            g.strokeStyle = 'rgba(255,255,255,0.85)';
            g.lineWidth = 1.5;
            for (const d of [-1, 1]) for (let i = 0; i < 3; i++) {
                g.beginPath();
                g.moveTo(d * 14, 16 + i * 3);
                g.lineTo(d * 40, 12 + i * 6);
                g.stroke();
            }
            if (!shush) arc(g, 0, 18, 5, 0.15 * PI, 0.85 * PI, 2.5);
        },
        // ------------------------------------------------------------ boss faces
        corn(g) {
            A.poly(g, [[-6, 40], [-30, 10], [-20, -10], [-4, 20]], '#16a34a');
            A.poly(g, [[6, 40], [30, 10], [20, -10], [4, 20]], '#15803d');
            A.ellipse(g, 0, -6, 18, 38, '#facc15');
            for (let y = -36; y <= 24; y += 9) for (let x = -10; x <= 10; x += 7) A.dot(g, x + ((y / 9) % 2 ? 3 : 0), y, 2.6, '#eab308');
            eye(g, -7, -10, 5);
            eye(g, 7, -10, 5);
            arc(g, 0, 2, 7, 0.15 * PI, 0.85 * PI);
        },
        hourglass(g) {
            A.rrect(g, -30, -42, 60, 9, 3, '#92400e');
            A.rrect(g, -30, 33, 60, 9, 3, '#92400e');
            A.shape(g, 'rgba(224,242,254,0.85)', () => {
                g.moveTo(-24, -33);
                g.lineTo(24, -33);
                g.lineTo(4, 0);
                g.lineTo(24, 33);
                g.lineTo(-24, 33);
                g.lineTo(-4, 0);
                g.closePath();
            });
            A.poly(g, [[-12, -14], [12, -14], [2, -2], [-2, -2]], '#fbbf24');
            A.poly(g, [[-20, 32], [20, 32], [0, 14]], '#fbbf24');
            line(g, 2, [[0, -2], [0, 14]], '#f59e0b');
        },
        reply(g) {
            A.shape(g, '#f8fafc', () => {
                g.roundRect(-40, -30, 80, 52, 18);
                g.moveTo(-14, 22);
                g.lineTo(-26, 40);
                g.lineTo(2, 22);
            });
            [-18, 0, 18].forEach(x => A.dot(g, x, -4, 6, '#475569'));
        },
        notfound(g) {
            A.circle(g, 0, 0, 38, '#f8fafc');
            arc(g, 0, 0, 33, 0, 2 * PI, 9, '#dc2626');
            line(g, 9, [[-23, -23], [23, 23]], '#dc2626');
            g.font = `26px ${DISPLAY_FONT}`;
            g.textAlign = 'center';
            g.textBaseline = 'middle';
            g.lineWidth = 5;
            g.strokeStyle = '#fff';
            g.strokeText('404', 0, 1);
            g.fillStyle = O;
            g.fillText('404', 0, 1);
        },
        grimace(g) {
            A.circle(g, 0, 0, 36, '#facc15');
            eye(g, -12, -10, 6);
            eye(g, 12, -10, 6);
            A.rrect(g, -22, 6, 44, 16, 6, '#fff');
            for (let x = -14; x <= 14; x += 7) line(g, 2, [[x, 6], [x, 22]], '#a8a29e');
            line(g, 2, [[-22, 14], [22, 14]], '#a8a29e');
            line(g, 3, [[-22, -22], [-8, -18]]);
            line(g, 3, [[22, -22], [8, -18]]);
        }
    };
})();

// ---------------------------------------------------------------------- meme mode locations
// Six places the road runs through while meme mode is on (they replace the normal biomes; see
// biomeFor in js/codes.js). Same shape as BIOMES in js/road.js; `families` = the monsters living there.
// Items starting with "m_" are meme props painted by Game.paintMemeItem below.
const MEME_BIOMES = [
    { id: 'm_ohio', name: 'Ohio Cornfields', ground: ['#a3b545', '#93a53b', '#b5c556'], road: ['#c9a46a', '#b8935c', '#d9b77e'], edge: '#8a6a3d', surface: 'dirt',
        families: ['beasts', 'bandits'], items: [['m_corn', 30], ['m_sign_ohio', 2], ['tuft', 12]] },
    { id: 'm_stonks', name: 'Stonks Exchange', ground: ['#1e293b', '#172033', '#26344a'], road: ['#64748b', '#5a687e', '#718198'], edge: '#334155', surface: 'cobble',
        families: ['bandits', 'fantasy'], items: [['m_candles', 14], ['m_arrow', 5], ['m_coins', 6]] },
    { id: 'm_grass', name: 'Touch Grass Meadow', ground: ['#4ade80', '#3fcf73', '#6ee79a'], road: ['#d6d3c4', '#c6c2b2', '#e4e1d4'], edge: '#a8a596', surface: 'gravel',
        families: ['beasts', 'bugs'], items: [['m_tallgrass', 30], ['flowers', 14], ['m_sign_grass', 2]] },
    { id: 'm_comments', name: 'The Comment Section', ground: ['#cbd5e1', '#bfcad8', '#d8e0ea'], road: ['#f1f5f9', '#e2e8f0', '#f8fafc'], edge: '#94a3b8', surface: 'planks',
        families: ['bandits', 'undead'], items: [['m_bubble', 12], ['m_heart', 10], ['m_thumb', 6]] },
    { id: 'm_loading', name: 'Loading Screen', ground: ['#27272a', '#202023', '#323236'], road: ['#3f3f46', '#36363c', '#4a4a52'], edge: '#18181b', surface: 'basalt',
        families: ['fantasy', 'undead'], items: [['m_spinner', 18], ['m_bar', 9], ['ember', 10]] },
    { id: 'm_void', name: 'Error 404 Void', ground: ['#0b0b14', '#12101f', '#07070d'], road: ['#2e1065', '#261052', '#3b1580'], edge: '#1e0b45', surface: 'veins',
        families: ['undead', 'bugs'], items: [['m_glitch', 26], ['m_sign_404', 3]] }
];

Object.assign(Game, {
    /** Meme props on the verges, drawn into the biome tile (so they cost nothing per frame). */
    paintMemeItem(g, kind, x, y, s, seed) {
        const O = MOB_OUTLINE;
        const box = (bx, by, w, h, fill, r = 2) => {
            g.beginPath();
            g.roundRect(bx, by, w, h, r);
            g.fillStyle = fill;
            g.fill();
            g.strokeStyle = O;
            g.lineWidth = 1.5;
            g.stroke();
        };
        const text = (t, tx, ty, size, fill) => {
            g.font = `${Math.round(size)}px ${DISPLAY_FONT}`;
            g.textAlign = 'center';
            g.textBaseline = 'middle';
            g.fillStyle = fill;
            g.fillText(t, tx, ty);
        };
        const shadow = (rx, ry = rx * 0.4) => {
            g.fillStyle = 'rgba(0,0,0,0.18)';
            g.beginPath();
            g.ellipse(x + 2, y + 2, rx, ry, 0, 0, TAU);
            g.fill();
        };
        const sign = (lines, board, ink) => {
            shadow(16 * s, 5 * s);
            g.fillStyle = '#6b4423';
            g.fillRect(x - 2 * s, y - 22 * s, 4 * s, 24 * s);
            box(x - 22 * s, y - 40 * s, 44 * s, 22 * s, board, 3 * s);
            lines.forEach((t, i) => text(t, x, y - (lines.length === 1 ? 29 : 34 - i * 10) * s, (lines.length === 1 ? 10 : 8) * s, ink));
        };
        g.save();
        switch (kind) {
            case 'm_corn': {
                // a corn stalk: leaves and a cob
                g.strokeStyle = '#4d7c0f';
                g.lineWidth = 3 * s;
                g.lineCap = 'round';
                g.beginPath();
                g.moveTo(x, y);
                g.lineTo(x + (seed - 0.5) * 4 * s, y - 34 * s);
                g.stroke();
                g.strokeStyle = '#65a30d';
                g.lineWidth = 2.5 * s;
                for (let i = 0; i < 3; i++) {
                    const ly = y - (8 + i * 9) * s;
                    const d = i % 2 ? 1 : -1;
                    g.beginPath();
                    g.moveTo(x, ly);
                    g.quadraticCurveTo(x + d * 10 * s, ly - 8 * s, x + d * 15 * s, ly - 2 * s);
                    g.stroke();
                }
                if (seed > 0.35) {
                    g.fillStyle = '#facc15';
                    g.strokeStyle = O;
                    g.lineWidth = 1.2;
                    g.beginPath();
                    g.ellipse(x + 4 * s, y - 22 * s, 3 * s, 7 * s, 0.3, 0, TAU);
                    g.fill();
                    g.stroke();
                }
                break;
            }
            case 'm_sign_ohio':
                sign(['ONLY IN', 'OHIO'], '#fef3c7', '#b91c1c');
                break;
            case 'm_sign_grass':
                sign(['TOUCH', 'GRASS'], '#f0fdf4', '#15803d');
                break;
            case 'm_sign_404':
                sign(['404'], '#18181b', '#f0abfc');
                break;
            case 'm_candles':
                // a little candlestick chart standing in the dark
                for (let i = 0; i < 4; i++) {
                    const up = (seed * 10 + i) % 3 > 0.9;
                    const h = (6 + ((seed * 37 + i * 13) % 1) * 14) * s;
                    const cx = x + (i - 1.5) * 7 * s;
                    const top = y - (i * 4 + 6) * s - h;
                    g.fillStyle = up ? '#22c55e' : '#ef4444';
                    g.fillRect(cx - 0.6 * s, top - 4 * s, 1.2 * s, h + 8 * s);
                    g.fillRect(cx - 2.5 * s, top, 5 * s, h);
                }
                break;
            case 'm_arrow':
                g.fillStyle = 'rgba(34,197,94,0.25)';
                g.beginPath();
                g.ellipse(x, y - 14 * s, 16 * s, 16 * s, 0, 0, TAU);
                g.fill();
                g.fillStyle = '#22c55e';
                g.strokeStyle = O;
                g.lineWidth = 1.5;
                g.beginPath();
                g.moveTo(x, y - 30 * s);
                g.lineTo(x + 11 * s, y - 16 * s);
                g.lineTo(x + 4 * s, y - 16 * s);
                g.lineTo(x + 4 * s, y);
                g.lineTo(x - 4 * s, y);
                g.lineTo(x - 4 * s, y - 16 * s);
                g.lineTo(x - 11 * s, y - 16 * s);
                g.closePath();
                g.fill();
                g.stroke();
                break;
            case 'm_coins':
                shadow(10 * s, 4 * s);
                for (let i = 0; i < 4; i++) {
                    g.fillStyle = '#facc15';
                    g.strokeStyle = '#a16207';
                    g.lineWidth = 1.2;
                    g.beginPath();
                    g.ellipse(x + (i % 2 ? 4 : -3) * s, y - i * 3.5 * s, 7 * s, 3 * s, 0, 0, TAU);
                    g.fill();
                    g.stroke();
                }
                break;
            case 'm_tallgrass': {
                g.strokeStyle = ['#15803d', '#16a34a', '#22c55e'][Math.floor(seed * 3)];
                g.lineWidth = 2 * s;
                g.lineCap = 'round';
                for (let i = 0; i < 6; i++) {
                    const a = (i - 2.5) * 0.22;
                    g.beginPath();
                    g.moveTo(x + (i - 2.5) * 2 * s, y);
                    g.quadraticCurveTo(x + Math.sin(a) * 10 * s, y - 12 * s, x + Math.sin(a) * 16 * s, y - (18 + (i % 2) * 6) * s);
                    g.stroke();
                }
                break;
            }
            case 'm_bubble': {
                shadow(14 * s, 4 * s);
                g.fillStyle = '#ffffff';
                g.strokeStyle = '#64748b';
                g.lineWidth = 1.5;
                g.beginPath();
                g.roundRect(x - 16 * s, y - 26 * s, 32 * s, 18 * s, 6 * s);
                g.moveTo(x - 6 * s, y - 8 * s);
                g.lineTo(x - 10 * s, y);
                g.lineTo(x, y - 8 * s);
                g.fill();
                g.stroke();
                const t = ['first!', 'ratio', 'L', 'W', 'lol', 'based', '+1', 'source?'][Math.floor(seed * 8)];
                text(t, x, y - 17 * s, 8 * s, '#334155');
                break;
            }
            case 'm_heart':
                g.fillStyle = '#f43f5e';
                g.strokeStyle = O;
                g.lineWidth = 1.2;
                g.beginPath();
                g.moveTo(x, y - 4 * s);
                g.bezierCurveTo(x - 12 * s, y - 12 * s, x - 6 * s, y - 22 * s, x, y - 15 * s);
                g.bezierCurveTo(x + 6 * s, y - 22 * s, x + 12 * s, y - 12 * s, x, y - 4 * s);
                g.fill();
                g.stroke();
                break;
            case 'm_thumb':
                box(x - 9 * s, y - 14 * s, 6 * s, 12 * s, '#3b82f6', 1.5);
                box(x - 3 * s, y - 15 * s, 12 * s, 13 * s, '#fcd34d', 3 * s);
                box(x - 2 * s, y - 25 * s, 6 * s, 12 * s, '#fcd34d', 3 * s);
                break;
            case 'm_spinner': {
                const r = 9 * s;
                for (let i = 0; i < 8; i++) {
                    const a = (i / 8) * TAU;
                    g.fillStyle = `rgba(255,255,255,${0.15 + (i / 8) * 0.8})`;
                    g.beginPath();
                    g.arc(x + Math.cos(a) * r, y - 12 * s + Math.sin(a) * r, 2.2 * s, 0, TAU);
                    g.fill();
                }
                break;
            }
            case 'm_bar':
                box(x - 18 * s, y - 12 * s, 36 * s, 8 * s, '#18181b', 2);
                g.fillStyle = '#22d3ee';
                g.fillRect(x - 17 * s, y - 11 * s, 33 * s, 6 * s);
                text('99%', x, y - 20 * s, 8 * s, '#e4e4e7');
                break;
            case 'm_glitch': {
                const cols = ['#f0abfc', '#22d3ee', '#a3e635', '#f43f5e'];
                for (let i = 0; i < 3; i++) {
                    g.globalAlpha = 0.5 + ((seed * 7 + i) % 1) * 0.4;
                    g.fillStyle = cols[Math.floor((seed * 10 + i) % 4)];
                    g.fillRect(x + (((seed * 13 + i * 5) % 1) - 0.5) * 20 * s, y - i * 5 * s, (6 + ((seed * 29 + i) % 1) * 16) * s, 2.5 * s);
                }
                g.globalAlpha = 1;
                break;
            }
        }
        g.restore();
    }
});
