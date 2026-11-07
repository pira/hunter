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
        if (m.boss) {
            this.memeFloater(m.x, m.y - m.size - 60, 'GG EZ', 40);
            this.airhorn();
        } else if (Math.random() < (m.gk ? 1 : 0.18)) {
            this.memeFloater(m.x, m.y - m.size - 18, this.memePick(MEME_KILL), m.gk ? 26 : 18);
        }
    },

    memeHurt() {
        const p = this.player;
        this.memeFloater(p.x, p.y - 58, this.memePick(MEME_HURT), 24);
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
