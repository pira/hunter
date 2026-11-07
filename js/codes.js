/* Monster Hunter — the menu's code bar and the meme mode it unlocks. Extends Game (js/core.js).
 *
 * Codes are checked by the server (POST /player/{id}/redeem, CODES in leaderboard/lambda/app.mjs):
 *   gold  +5 gold to the profile    once per profile
 *   gems  +1 gem to the profile     once per profile
 *   meme  unlocks meme mode         as often as you like (works offline too)
 * Meme mode is cosmetic only (quips, shades, sounds), so scores stay comparable. */

const MEME_KILL = ['BONK', 'OOF', 'YEET', 'NOICE', 'BRUH', 'GG EZ', 'SHEESH', 'STONKS', 'POG', 'WOW', 'SUCH KILL', 'MUCH WOW', 'REKT', 'NO U', 'BIG BRAIN', 'SKILL ISSUE', 'L + RATIO', 'EMOTIONAL DAMAGE', 'TO THE MOON', 'IT\'S OVER 9000'];
const MEME_HURT = ['OOF', 'BRUH', 'NOT STONKS', 'F', 'SADGE', 'WHY ARE WE STILL HERE'];
const MEME_SUB = ['stonks 📈', 'much hunt, very wow', 'it\'s free real estate', 'this is fine 🔥', 'let\'s gooo', 'no cap', 'built different', 'ez clap', 'one does not simply walk this road', 'task failed successfully'];
const MEME_COLORS = ['#f87171', '#fbbf24', '#a3e635', '#22d3ee', '#a78bfa', '#f472b6'];
const MEME_FONT = '"Comic Sans MS", "Comic Sans", "Chalkboard SE", cursive';
// where the shades sit, relative to the hero's feet (rig units, before scale)
const MEME_SHADES_Y = { wizard: 34, barbarian: 34, goblin: 31 };
const MEME_SHADES_X = 1;
// Meme mode turns about a third of the regular monsters into emoji memes (by family).
// Only memes nobody owns: generic ideas and standard emoji (no owned characters, no real people).
const MEME_MOBS = {
    beasts: [{ e: '🐶', name: 'Doge' }, { e: '🦍', name: 'Return to Monke' }],
    bugs: [{ e: '🐸', name: 'Meme Frog' }, { e: '🦗', name: '*crickets*' }],
    undead: [{ e: '💀', name: 'I\'m Dead' }, { e: '👻', name: 'Ghosted' }],
    fantasy: [{ e: '🗿', name: 'Moai' }, { e: '🧢', name: 'Cap' }],
    bandits: [{ e: '🤡', name: 'Clown' }, { e: '📈', name: 'Stonks' }]
};
// the cucumber (the "cat scared of a cucumber" meme) can turn up in any family
const MEME_CUCUMBER = { e: '🥒', name: 'Cat\'s Worst Nightmare' };
const MEME_CUCUMBER_CHANCE = 0.25; // share of the small/medium/large meme monsters
// the heavy tiers (elite and up) get the big memes
const MEME_HEAVIES = {
    beasts: { e: '🐐', name: 'The GOAT' },
    bugs: { e: '🧠', name: 'Big Brain' },
    undead: { e: '🥶', name: 'Ice Cold' },
    fantasy: { e: '👽', name: 'Area 51 Raider' },
    bandits: { e: '💯', name: 'Hundred Percent' }
};
// meme bosses: same attacks, a meme name and a giant emoji face, no voice lines
const MEME_BOSSES = {
    Bonecrusher: { name: 'Ohio Final Boss', title: 'Only in Ohio', face: '🌽' },
    Hexweaver: { name: 'The Loading Circle', title: 'Buffering… 99%', face: '⏳' },
    Broodmother: { name: 'Reply Guy', title: 'Summons the comment section', face: '💬' },
    Voidmaw: { name: 'Error 404', title: 'Boss not found', face: '🚫' },
    Gravelord: { name: 'Giga Moai', title: 'Stone-faced sigma', face: '🗿' },
    Stormcaller: { name: 'Stonks Lord', title: 'Line goes up', face: '📈' },
    Hydra: { name: 'Triple Ratio', title: 'Three heads, zero rizz', face: '😬' },
    Lich: { name: 'Final Boss of the Internet', title: 'Touch grass or perish', face: '💀' }
};
const MEME_MOB_CHANCE = 0.35;
const RICK_LINES = ['GET ROLLED!', 'ROLL OUT!', 'YOU JUST GOT ROLLED', 'ROLLIN\' ROLLIN\''];
const CODE_LOCAL = new Set(['meme']); // codes that work without the server

extendGame({
    bindCodes() {
        const $ = id => document.getElementById(id);
        Object.assign(this.el, { codeForm: $('codeForm'), codeInput: $('codeInput'), codeBtn: $('codeBtn'), codeMsg: $('codeMsg'), memeBtn: $('memeBtn') });
        this.el.codeForm.addEventListener('submit', e => {
            e.preventDefault();
            this.redeemCode(this.el.codeInput.value);
        });
        this.el.memeBtn.addEventListener('click', () => {
            this.storeSet('hunter.meme', this.memeMode ? '0' : '1');
            this.refreshMeme();
            if (this.memeMode) this.airhorn();
            else Sfx.tone(330, { duration: 0.12, type: 'triangle', volume: 0.08 });
        });
        this.refreshMeme();
        // a profile that redeemed "meme" on another device has it here too
        Leaderboard.refreshOwn().then(() => this.refreshMeme(), () => {});
    },

    codeMessage(text, kind = '') {
        this.el.codeMsg.textContent = text;
        this.el.codeMsg.className = `code-msg ${kind}`;
    },

    async redeemCode(raw) {
        const code = String(raw || '').trim().toLowerCase();
        if (!code) {
            this.nudge(this.el.codeInput);
            return;
        }
        if (code === 'meme') this.storeSet('hunter.memeUnlocked', '1');
        const local = CODE_LOCAL.has(code);
        if (!Leaderboard.identity()) {
            if (local) return this.codeRedeemed({ unlock: 'meme' });
            this.codeMessage('Pick a hunter name first.', 'bad');
            return;
        }
        this.el.codeBtn.disabled = true;
        this.codeMessage('Checking…');
        try {
            const res = await Leaderboard.redeem(code);
            this.codeRedeemed(res.redeemed || {});
        } catch (e) {
            if (local) return this.codeRedeemed({ unlock: 'meme' }); // offline: meme still works
            this.nudge(this.el.codeInput);
            this.codeMessage(e.status === 409 ? 'You already used that code.'
                : e.status === 400 ? 'That code doesn\'t exist.'
                    : e.status === 404 ? 'Finish a hunt first, then try again.'
                        : e.status === 429 ? 'Slow down a little and try again.'
                            : 'Codes need a connection. Try again later.', 'bad');
        } finally {
            this.el.codeBtn.disabled = false;
        }
    },

    codeRedeemed(r) {
        this.el.codeInput.value = '';
        this.el.codeInput.blur();
        if (r.unlock === 'meme') {
            this.storeSet('hunter.memeUnlocked', '1');
            this.storeSet('hunter.meme', '1');
            this.refreshMeme();
            this.codeMessage('🐸 Meme mode unlocked and on! Tap the button above to turn it off.', 'ok');
            this.airhorn();
            return;
        }
        const got = [r.gold ? `${r.gold} gold` : '', r.gems ? `${r.gems} gem${r.gems > 1 ? 's' : ''}` : ''].filter(Boolean).join(' and ');
        this.codeMessage(`✅ +${got} added to your profile!`, 'ok');
        Sfx.arpeggio([523, 659, 784, 1046], 0.06, { type: 'triangle', volume: 0.1 });
        if (this.refreshWho) this.refreshWho();
    },

    memeUnlocked() {
        if (this.storeGet('hunter.memeUnlocked') === '1') return true;
        const id = Leaderboard.identity();
        const cache = id && Leaderboard.cachedProfile();
        return Boolean(cache && cache.id === id.id && Array.isArray(cache.unlocks) && cache.unlocks.includes('meme'));
    },

    /** Shows the meme toggle once unlocked and reads whether meme mode is on. */
    refreshMeme() {
        const unlocked = this.memeUnlocked();
        this.memeMode = unlocked && this.storeGet('hunter.meme') !== '0';
        const btn = this.el.memeBtn;
        btn.hidden = !unlocked;
        btn.classList.toggle('on', this.memeMode);
        btn.textContent = this.memeMode ? '😎 Meme mode: ON' : '🐸 Meme mode: OFF';
    },

    // ------------------------------------------------------------------ meme mode effects

    memePick(list) {
        return list[Math.floor(Math.random() * list.length)];
    },

    /** A meme floater: Comic Sans, rainbow, a little wobble (see drawFloaters). */
    memeFloater(x, y, text, size = 20) {
        this.floater(x, y, text, this.memePick(MEME_COLORS), size);
        const f = this.floaters[this.floaters.length - 1];
        if (f) {
            f.meme = true;
            f.life = f.max = 64;
        }
    },

    memeKill(m) {
        if (m.ai === 'rickroll') {
            this.memeFloater(m.x, m.y - m.size - 60, 'YOU ROLLED THE ROLL', 30);
            this.spark(m.x, m.y, '#fbbf24', 12);
            this.airhorn();
        } else if (m.boss) {
            this.memeFloater(m.x, m.y - m.size - 60, 'GG EZ', 40);
            this.airhorn();
        } else if (m.meme === MEME_CUCUMBER.e) {
            this.memeFloater(m.x, m.y - m.size - 18, this.memePick(['*CAT SCREAMS*', 'PICKLED', 'NOT TODAY, CUCUMBER']), 18);
        } else if (Math.random() < (m.gk ? 1 : 0.18)) {
            this.memeFloater(m.x, m.y - m.size - 18, this.memePick(MEME_KILL), m.gk ? 26 : 18);
        }
    },

    memeHurt(source) {
        const p = this.player;
        this.memeFloater(p.x, p.y - 58, this.memePick(source && source.ai === 'rickroll' ? RICK_LINES : MEME_HURT), 24);
        // a sad trombone, more or less
        [392, 370, 349, 294].forEach((f, i) => Sfx.tone(f, { duration: i === 3 ? 0.45 : 0.18, delay: i * 0.18, type: 'sawtooth', volume: 0.05 }));
    },

    memeSub() {
        return this.memePick(MEME_SUB);
    },

    /** A synthesized air horn: three short blasts of a detuned saw chord. */
    airhorn() {
        for (let i = 0; i < 3; i++) {
            const delay = i * 0.16;
            const duration = i === 2 ? 0.5 : 0.12;
            [466, 470, 587].forEach(f => Sfx.tone(f, { duration, delay, type: 'sawtooth', volume: 0.05 }));
        }
    },

    // ------------------------------------------------------------------ meme monsters

    /** Extra fields for a new monster in meme mode: an emoji look and a meme name (or nothing). */
    memeLook(type) {
        if (!type || !type.family || Math.random() >= MEME_MOB_CHANCE) return {};
        const small = type.rank <= 3;
        const look = small && Math.random() < MEME_CUCUMBER_CHANCE ? MEME_CUCUMBER
            : small ? MEME_MOBS[type.family] && this.memePick(MEME_MOBS[type.family]) : MEME_HEAVIES[type.family];
        return look ? { meme: look.e, name: look.name } : {};
    },

    /** Emoji drawn once per kind into a small canvas, then blitted (fillText of emoji every frame is slow). */
    memeEmojiCanvas(e) {
        this.memeEmoji = this.memeEmoji || new Map();
        let cv = this.memeEmoji.get(e);
        if (!cv) {
            cv = document.createElement('canvas');
            cv.width = cv.height = 72;
            const g = cv.getContext('2d');
            g.font = '58px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
            g.textAlign = 'center';
            g.textBaseline = 'middle';
            g.fillText(e, 36, 40);
            this.memeEmoji.set(e, cv);
        }
        return cv;
    },

    drawMemeEmoji(ctx, e, x, y, size) {
        ctx.drawImage(this.memeEmojiCanvas(e), x - size / 2, y - size / 2, size, size);
    },

    drawMemeMob(ctx, m) {
        const s = m.size * 2.3;
        const bob = Math.sin(m.phase) * m.size * 0.08;
        const lean = Math.sin(m.phase * 0.5) * 0.12;
        ctx.save();
        ctx.translate(m.x, m.y + bob);
        ctx.rotate(lean);
        if (m.spawnT > 0) ctx.globalAlpha = U.clamp(1 - m.spawnT / 75, 0.2, 1);
        this.drawMemeEmoji(ctx, m.meme, 0, 0, s);
        if (m.flash > 0) {
            ctx.globalAlpha = 0.55;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(0, 0, m.size * 1.05, 0, TAU);
            ctx.fill();
        }
        ctx.restore();
        if (m.glow) {
            // the heavy tiers keep their glow ring
            ctx.globalAlpha = 0.5 + 0.2 * Math.sin(m.phase * 2);
            ctx.strokeStyle = m.glow;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(m.x, m.y + bob, m.size * 1.2, 0, TAU);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
        if (m.poison > 0 || m.stun > 0 || m.iced) {
            ctx.globalAlpha = 0.4;
            ctx.fillStyle = m.stun > 0 ? '#fde047' : m.iced ? '#7dd3fc' : '#84cc16';
            ctx.beginPath();
            ctx.arc(m.x, m.y, m.size, 0, TAU);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    },

    // ------------------------------------------------------------------ meme bosses

    /** The meme version of a boss def (a copy: the shared def stays as it is). */
    memeBoss(def) {
        const mm = def && MEME_BOSSES[def.name];
        return mm ? { ...def, name: mm.name, title: mm.title, memeFace: mm.face, mute: true } : def;
    },

    /** A giant emoji face over the boss's body; it shrinks away while the boss crumbles. */
    drawMemeBossFace(ctx, b) {
        const q = b.dying ? b.deathT / b.deathMax : 0;
        const s = b.size * (b.boss.big ? 1.9 : 1.7) * (1 - 0.5 * q);
        const wob = Math.sin((b.t || 0) * 0.12) * 0.12;
        ctx.save();
        ctx.globalAlpha = 1 - q;
        ctx.translate(b.x, b.y - b.size * (b.boss.big ? 0.55 : 0.2));
        ctx.rotate(wob);
        this.drawMemeEmoji(ctx, b.boss.memeFace, 0, 0, s);
        if (b.flash > 0) {
            ctx.globalAlpha = 0.45 * (1 - q);
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(0, 0, s * 0.42, 0, TAU);
            ctx.fill();
        }
        ctx.restore();
    },

    // ------------------------------------------------------------------ the Rick Roll (meme mode, end of level 1)

    startRickRoll() {
        const def = GATEKEEPERS.rickroll;
        this.banner(`⚠ ${def.name.toUpperCase()} ⚠`, def.title, 'danger meme');
        this.makeGatekeeper('rickroll', this.W / 2, -50, { mode: 'enter', t: 0, dir: Math.PI / 2, spin: 0 });
        this.airhorn();
    },

    /** After every roll it stops, dizzy, and sings: a ring of music notes. */
    rickNotes(m) {
        const n = 8;
        const off = Math.random() * TAU;
        for (let i = 0; i < n; i++) this.enemyShot(m.x, m.y, off + (i * TAU) / n, 2.2, 'note', 6);
        if (Math.random() < 0.6) this.memeFloater(m.x, m.y - m.size - 30, this.memePick(RICK_LINES), 20);
        [523, 659, 784].forEach((f, i) => Sfx.tone(f, { duration: 0.1, delay: i * 0.09, type: 'square', volume: 0.05 }));
    },

    /** A giant bread roll in shades with a microphone. Drawn at the origin (the caller translates). */
    drawRickRoll(ctx, m) {
        const s = m.size;
        const rolling = m.mode === 'charge';
        m.spin = (m.spin || 0) + (rolling ? 0.35 : 0);
        const dance = rolling ? 0 : Math.sin((m.t || 0) * 0.25) * 0.18;
        ctx.save();
        ctx.rotate(rolling ? m.spin : dance);
        ctx.lineJoin = 'round';
        // the roll: a fat golden loaf with a darker crust and three scores
        const g = ctx.createRadialGradient(-s * 0.3, -s * 0.4, s * 0.2, 0, 0, s * 1.2);
        g.addColorStop(0, m.flash > 0 ? '#ffffff' : '#fde68a');
        g.addColorStop(0.6, m.flash > 0 ? '#ffffff' : '#f59e0b');
        g.addColorStop(1, m.flash > 0 ? '#ffffff' : '#b45309');
        ctx.fillStyle = g;
        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(0, 0, s * 1.15, s * 0.85, 0, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = '#92400e';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        for (let i = -1; i <= 1; i++) {
            ctx.beginPath();
            ctx.moveTo(i * s * 0.42 - s * 0.12, -s * 0.72);
            ctx.quadraticCurveTo(i * s * 0.42 + s * 0.05, -s * 0.55, i * s * 0.42 + s * 0.12, -s * 0.38);
            ctx.stroke();
        }
        // shades
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.roundRect(-s * 0.72, -s * 0.2, s * 0.62, s * 0.34, s * 0.1);
        ctx.roundRect(s * 0.1, -s * 0.2, s * 0.62, s * 0.34, s * 0.1);
        ctx.fill();
        ctx.fillRect(-s * 0.12, -s * 0.15, s * 0.24, s * 0.08);
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillRect(-s * 0.6, -s * 0.14, s * 0.14, s * 0.07);
        ctx.fillRect(s * 0.22, -s * 0.14, s * 0.14, s * 0.07);
        // a big grin
        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, s * 0.28, s * 0.32, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
        // the microphone in a little hand
        ctx.translate(s * 1.05, s * 0.25);
        ctx.rotate(-0.5 + dance);
        ctx.fillStyle = '#334155';
        ctx.fillRect(-s * 0.07, -s * 0.05, s * 0.14, s * 0.5);
        ctx.fillStyle = '#cbd5e1';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, -s * 0.12, s * 0.17, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        // when it stops, notes float up from it
        if (!rolling && (m.t || 0) % 24 === 0 && this.particle && this.state === 'playing') {
            this.particle({ x: (m.x || 0) + (Math.random() - 0.5) * s, y: (m.y || 0) - s, vx: (Math.random() - 0.5) * 0.6, vy: -0.8, life: 40, size: 3, color: this.memePick(MEME_COLORS), kind: 'spark' });
        }
    },

    /** "Deal with it" pixel shades on the hero's face. */
    drawMemeShades(ctx, x, feetY, scale) {
        const p = this.player;
        const face = p.facing < 0 ? -1 : 1;
        const u = 2 * scale; // one shades pixel
        const y = feetY - (MEME_SHADES_Y[this.cls] || 34) * scale;
        const cx = x + MEME_SHADES_X * scale * face;
        // 12 × 3 pixel shades: a bar with two lenses, white glints
        const rows = ['############', '.####..####.', '..##....##..'];
        ctx.save();
        ctx.fillStyle = '#000';
        rows.forEach((row, r) => {
            for (let c = 0; c < row.length; c++) {
                if (row[c] !== '#') continue;
                const col = face < 0 ? row.length - 1 - c : c;
                ctx.fillRect(Math.round(cx + (col - row.length / 2) * u), Math.round(y + r * u), Math.ceil(u), Math.ceil(u));
            }
        });
        ctx.fillStyle = '#fff';
        const gx = face < 0 ? [8, 3] : [2, 7];
        gx.forEach(c => ctx.fillRect(Math.round(cx + (c - 6) * u), Math.round(y + u), Math.ceil(u), Math.ceil(u)));
        ctx.restore();
    }
});
