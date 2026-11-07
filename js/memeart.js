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
