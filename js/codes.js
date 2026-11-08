/* Monster Hunter — the menu's code bar and the meme mode it unlocks. Extends Game (js/core.js).
 *
 * Codes are checked by the server (POST /player/{id}/redeem, CODES in leaderboard/lambda/app.mjs):
 *   gold  +5 gold to the profile    once per profile
 *   gems  +1 gem to the profile     once per profile
 *   meme  unlocks meme mode         as often as you like (works offline too)
 * Meme mode is cosmetic only (quips, shades, sounds), so scores stay comparable. */

const MEME_KILL = ['BONK', 'OOF', 'YEET', 'NOICE', 'BRUH', 'GG EZ', 'SHEESH', 'STONKS', 'POG', 'WOW', 'SUCH KILL', 'MUCH WOW', 'REKT', 'NO U', 'BIG BRAIN', 'SKILL ISSUE', 'L + RATIO', 'EMOTIONAL DAMAGE', 'TO THE MOON', 'IT\'S OVER 9000',
    // brain rot
    '+1000 AURA', '-1000 AURA', '6 7', 'RIZZ', 'NPC BEHAVIOR', 'MOGGED', 'BUSSIN', 'COOKED', 'LOCK IN', 'DELULU', 'IT\'S GIVING', 'NO SHOT', 'FR FR', 'GOATED'];
const MEME_HURT = ['OOF', 'BRUH', 'NOT STONKS', 'F', 'SADGE', 'WHY ARE WE STILL HERE', '-1000 AURA', 'I\'M COOKED', 'NPC MOMENT', 'LOCK IN'];
const MEME_SUB = ['stonks 📈', 'much hunt, very wow', 'it\'s free real estate', 'this is fine 🔥', 'let\'s gooo', 'no cap', 'built different', 'ez clap', 'one does not simply walk this road', 'task failed successfully',
    'aura farming', 'lock in', 'six seven', 'main character energy', 'no cap fr fr', 'we are so back'];
const MEME_COLORS = ['#f87171', '#fbbf24', '#a3e635', '#22d3ee', '#a78bfa', '#f472b6'];
const MEME_FONT = '"Comic Sans MS", "Comic Sans", "Chalkboard SE", cursive';
// where the shades sit, relative to the hero's feet (rig units, before scale)
const MEME_SHADES_Y = { wizard: 34, barbarian: 34, goblin: 31 };
const MEME_SHADES_X = 1;
// Meme mode turns the regular monsters into drawn memes (by family; see MEME_KEEP for the exceptions).
// Only memes nobody owns: generic ideas, drawn in the game's style (no owned characters, no real people).
const MEME_MOBS = {
    // the third look of each family is brain rot
    beasts: [{ e: 'doge', name: 'Doge' }, { e: 'monke', name: 'Return to Monke' }, { e: 'rizz', name: 'Rizz Lord' }],
    bugs: [{ e: 'frog', name: 'Meme Frog' }, { e: 'cricket', name: '*crickets*' }, { e: 'sixseven', name: 'Six Seven' }],
    undead: [{ e: 'skull', name: 'I\'m Dead' }, { e: 'ghost', name: 'Ghosted' }, { e: 'cooked', name: 'Cooked' }],
    fantasy: [{ e: 'moai', name: 'Moai' }, { e: 'cap', name: 'Cap' }, { e: 'aura', name: 'Aura Farmer' }],
    bandits: [{ e: 'clown', name: 'Clown' }, { e: 'stonks', name: 'Stonks' }, { e: 'npc', name: 'NPC' }]
};
// the cucumber (the "cat scared of a cucumber" meme) can turn up in any family
const MEME_CUCUMBER = { e: 'cucumber', name: 'Cat\'s Worst Nightmare' };
const MEME_CUCUMBER_CHANCE = 0.25; // share of the small/medium/large meme monsters
// the heavy tiers (elite and up) get the big memes
const MEME_HEAVIES = {
    beasts: { e: 'goat', name: 'The GOAT' },
    bugs: { e: 'brain', name: 'Big Brain' },
    undead: { e: 'icecold', name: 'Ice Cold' },
    fantasy: { e: 'alien', name: 'Area 51 Raider' },
    bandits: { e: 'hundred', name: 'Hundred Percent' }
};
// meme bosses: same attacks, a meme name and a big drawn face, no voice lines
const MEME_BOSSES = {
    Bonecrusher: { name: 'Ohio Final Boss', title: 'Only in Ohio', face: 'corn' },
    Hexweaver: { name: 'The Loading Circle', title: 'Buffering… 99%', face: 'hourglass' },
    Broodmother: { name: 'Reply Guy', title: 'Summons the comment section', face: 'reply' },
    Voidmaw: { name: 'Error 404', title: 'Boss not found', face: 'notfound' },
    Gravelord: { name: 'Giga Moai', title: 'Stone-faced sigma', face: 'moai' },
    Stormcaller: { name: 'Stonks Lord', title: 'Line goes up', face: 'stonks' },
    Hydra: { name: 'Triple Ratio', title: 'Three heads, zero rizz', face: 'grimace' },
    Lich: { name: 'Final Boss of the Internet', title: 'Touch grass or perish', face: 'skull' }
};
const MEME_MOB_CHANCE = 1; // every monster is a meme…
const MEME_KEEP = { fantasy: 1 }; // …except these (family: rank) — the Trollkin stays itself
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
        // the menu's road behind the panel switches to (or from) the meme places right away
        if (this.state === 'menu' && this.biomeFor) this.biome = this.biomeFor(1);
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
        if (m.stalker) {
            this.memeFloater(m.x, m.y - m.size * 2.6, 'IT\'S GONE… for now', 24);
            this.stalker = null;
        } else if (m.ai === 'rickroll') {
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

    /** Extra fields for a new monster in meme mode: a drawn look and a meme name (or nothing). */
    memeLook(type) {
        if (!type || !type.family || MEME_KEEP[type.family] === type.rank || Math.random() >= MEME_MOB_CHANCE) return {};
        const small = type.rank <= 3;
        const look = small && Math.random() < MEME_CUCUMBER_CHANCE ? MEME_CUCUMBER
            : small ? MEME_MOBS[type.family] && this.memePick(MEME_MOBS[type.family]) : MEME_HEAVIES[type.family];
        return look ? { meme: look.e, name: look.name } : {};
    },

    /** Each meme look is drawn once into a small canvas (js/memeart.js), then blitted. */
    memeArtCanvas(key) {
        this.memeArt = this.memeArt || new Map();
        let cv = this.memeArt.get(key);
        if (!cv) {
            cv = document.createElement('canvas');
            cv.width = cv.height = 128;
            const g = cv.getContext('2d');
            if (g && MemeArt[key]) {
                g.translate(64, 64);
                g.scale(1.2, 1.2);
                g.lineJoin = 'round';
                g.ow = 3.5;
                MemeArt[key](g);
            }
            this.memeArt.set(key, cv);
        }
        return cv;
    },

    drawMemeArt(ctx, key, x, y, size) {
        ctx.drawImage(this.memeArtCanvas(key), x - size / 2, y - size / 2, size, size);
    },

    drawMemeMob(ctx, m) {
        const s = m.size * 2.9;
        const bob = Math.sin(m.phase) * m.size * 0.08;
        const lean = Math.sin(m.phase * 0.5) * 0.12;
        ctx.save();
        ctx.translate(m.x, m.y + bob);
        ctx.rotate(lean);
        if (m.spawnT > 0) ctx.globalAlpha = U.clamp(1 - m.spawnT / 75, 0.2, 1);
        this.drawMemeArt(ctx, m.meme, 0, 0, s);
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

    /** Sigma Cat, meme mode's level-1 mini boss: the ring-shooting boss's moves at half its HP, throwing
     *  "well, actually" and "shh" hands. Mini: gatekeeper loot, not counted as a boss (see bossDefeated). */
    sigmaBoss() {
        const base = BOSSES.find(d => d.pattern === 'rings') || BOSSES[0];
        return { ...base, name: 'Sigma Cat', title: 'Well, actually…', color: '#9ca3af', accent: '#facc15', shots: ['point', 'shush'], sigma: true, mute: true, mini: true, hp: Math.round(base.hp / 2) };
    },

    /** Sigma Cat's photos (img/meme), loaded on first use; the drawn cat stands in until they arrive. */
    sigmaPhoto(pose) {
        this.sigmaPhotos = this.sigmaPhotos || {};
        let img = this.sigmaPhotos[pose];
        if (!img) {
            img = this.sigmaPhotos[pose] = new Image();
            img.src = `img/meme/sigma-${pose}.webp`;
        }
        return img.complete && img.naturalWidth ? img : null;
    },

    /** Drawn at the boss's spot (the caller translates): it side-eyes after a fan of fingers, shushes
     *  otherwise. A special boss: its photo in a gold frame with a glow and orbiting sparkles. */
    drawSigmaCat(ctx, b) {
        const pose = b.volley % 3 === 0 ? 'think' : 'shush';
        this.sigmaPhoto(pose === 'think' ? 'shush' : 'think'); // have the other one ready too
        const photo = this.sigmaPhoto(pose);
        const t = b.t || 0;
        const y = Math.sin(t * 0.08) * 3 - b.size * 0.2;
        const r = b.size * 1.25;
        if (!photo) {
            this.drawMemeArt(ctx, pose === 'think' ? 'sigma_think' : 'sigma_shush', 0, y, b.size * 2.9);
        } else {
            ctx.save();
            const glow = ctx.createRadialGradient(0, y, r * 0.8, 0, y, r * 1.6);
            glow.addColorStop(0, 'rgba(250,204,21,0.55)');
            glow.addColorStop(1, 'rgba(250,204,21,0)');
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(0, y, r * 1.6, 0, TAU);
            ctx.fill();
            ctx.drawImage(photo, -r, y - r, r * 2, r * 2);
            ctx.lineWidth = 5;
            ctx.strokeStyle = MOB_OUTLINE;
            ctx.beginPath();
            ctx.arc(0, y, r, 0, TAU);
            ctx.stroke();
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#facc15';
            ctx.beginPath();
            ctx.arc(0, y, r - 1, 0, TAU);
            ctx.stroke();
            ctx.fillStyle = '#fef9c3';
            for (let i = 0; i < 5; i++) {
                const a = t * 0.04 + (i * TAU) / 5;
                const sx = Math.cos(a) * r * 1.3;
                const sy = y + Math.sin(a) * r * 1.3;
                const k = 3 + Math.sin(t * 0.2 + i) * 1.5;
                ctx.beginPath();
                ctx.moveTo(sx, sy - k * 2);
                ctx.lineTo(sx + k * 0.6, sy);
                ctx.lineTo(sx, sy + k * 2);
                ctx.lineTo(sx - k * 0.6, sy);
                ctx.closePath();
                ctx.fill();
            }
            ctx.restore();
        }
        if (b.flash > 0) {
            ctx.globalAlpha = 0.45;
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(0, y, r, 0, TAU);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    },

    /** A big drawn face over the boss's body; it shrinks away while the boss crumbles. */
    drawMemeBossFace(ctx, b) {
        const q = b.dying ? b.deathT / b.deathMax : 0;
        const s = b.size * (b.boss.big ? 2.4 : 2.1) * (1 - 0.5 * q);
        const wob = Math.sin((b.t || 0) * 0.12) * 0.12;
        ctx.save();
        ctx.globalAlpha = 1 - q;
        ctx.translate(b.x, b.y - b.size * (b.boss.big ? 0.55 : 0.2));
        ctx.rotate(wob);
        this.drawMemeArt(ctx, b.boss.memeFace, 0, 0, s);
        if (b.flash > 0) {
            ctx.globalAlpha = 0.45 * (1 - q);
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(0, 0, s * 0.42, 0, TAU);
            ctx.fill();
        }
        ctx.restore();
    },

    // ------------------------------------------------------------------ The Stalker (meme mode horror)

    /** At most one per level (from level 2, about 60% of levels), a third of the way through the fight. */
    maybeStalker() {
        if (this.level < 2 || this.stalkerLevel === this.level || this.progress < this.target * 0.35) return;
        this.stalkerLevel = this.level;
        if (Math.random() < 0.6) this.spawnStalker();
    },

    spawnStalker() {
        const p = this.player;
        const left = p.x > this.W / 2; // the far side of the road
        const x = left ? Math.max(30, this.roadLeft - 24) : Math.min(this.W - 30, this.roadRight + 24);
        const type = { name: 'The Stalker', shape: 'circle', color: '#0a0a0a', size: 22, speed: 0, speedVariation: 0, health: 8, points: 150, tier: 'large' };
        const m = this.makeMonster(type, x, this.H * (0.22 + Math.random() * 0.2), 'chase');
        Object.assign(m, { ai: 'stalker', stalker: true, mode: 'stare', t: 0, spawnT: 40, heavy: true, meme: undefined, name: 'The Stalker' });
        this.monsters.push(m);
        this.stalker = m;
        this.floater(m.x, m.y - 70, '. . .', '#e5e7eb', 22);
        Sfx.tone(55, { duration: 2.2, type: 'sine', volume: 0.08, bus: 'sfx' });
    },

    /** Stares, flickers with static, teleports closer; lunges once it's close. Gone when the fight ends. */
    updateStalker(m, freeze) {
        const p = this.player;
        m.t += freeze > 0 ? 1 : 0;
        if (this.phase !== 'fight' && this.phase !== 'clear') {
            // it slips away when the encounter starts: no loot, no kill
            m.dead = true;
            m.escaped = true;
            this.stalker = null;
            this.stalkerStatic(m, 18);
            return;
        }
        if (m.t % 130 === 0) Sfx.tone(52 + Math.random() * 6, { duration: 2, type: 'sine', volume: 0.06, bus: 'sfx' }); // the drone
        const d = Math.hypot(p.x - m.x, p.y - m.y);
        if (m.mode === 'stare') {
            m.y -= ROAD_SPEED * 0.9; // it doesn't ride the road: it stands where it chose to
            if (m.t > this.cd(150)) {
                m.mode = 'flicker';
                m.t = 0;
            }
        } else if (m.mode === 'flicker') {
            m.y -= ROAD_SPEED * 0.9;
            if (m.t % 3 === 0) this.stalkerStatic(m, 2);
            if (m.t % 4 === 0) Sfx.tone(800 + Math.random() * 2400, { duration: 0.03, type: 'square', volume: 0.025, bus: 'sfx' });
            if (m.t > 22) {
                // blink: a step closer, from a slightly different angle
                const a = Math.atan2(m.y - p.y, m.x - p.x) + (Math.random() - 0.5) * 1.2;
                const nd = Math.max(70, d * 0.6);
                m.x = U.clamp(p.x + Math.cos(a) * nd, 20, this.W - 20);
                m.y = U.clamp(p.y + Math.sin(a) * nd, this.topSafe * 0.7, this.H - 30);
                this.stalkerStatic(m, 10);
                m.mode = nd <= 110 ? 'lunge' : 'stare';
                m.t = 0;
                if (m.mode === 'lunge') {
                    const n = U.normalizeVector(p.x - m.x, p.y - m.y);
                    m.lx = n.x;
                    m.ly = n.y;
                    Sfx.tone(90, { duration: 0.4, type: 'sawtooth', volume: 0.09, slide: -40, bus: 'sfx' });
                }
            }
        } else if (m.mode === 'lunge') {
            if (m.t > 18 && m.t < 46) {
                m.x += m.lx * 6.5 * freeze;
                m.y += m.ly * 6.5 * freeze;
            }
            if (m.t > 70) {
                // back off into the dark and start over
                const left = p.x > this.W / 2;
                m.x = left ? Math.max(30, this.roadLeft - 24) : Math.min(this.W - 30, this.roadRight + 24);
                m.y = this.H * (0.2 + Math.random() * 0.25);
                this.stalkerStatic(m, 10);
                m.mode = 'stare';
                m.t = 0;
            }
        }
    },

    stalkerStatic(m, n) {
        for (let i = 0; i < n; i++) {
            this.particle({ x: m.x + (Math.random() - 0.5) * 30, y: m.y - 20 + (Math.random() - 0.5) * 60, vx: (Math.random() - 0.5) * 2, vy: 0, life: 10 + Math.random() * 8, size: 1.5 + Math.random() * 2.5, color: Math.random() < 0.5 ? '#e5e7eb' : '#111827', kind: 'spark' });
        }
    },

    /** The screen darkens around you while it's here (eases in and out). */
    get stalkerDark() {
        const want = this.stalker && !this.stalker.dead ? 1 : 0;
        this._stalkerDark = (this._stalkerDark || 0) + (want - (this._stalkerDark || 0)) * 0.03;
        return this._stalkerDark > 0.01 ? this._stalkerDark : 0;
    },

    drawStalkerDark(ctx) {
        const k = this._stalkerDark;
        const p = this.player;
        const g = ctx.createRadialGradient(p.x, p.y, 90, p.x, p.y, Math.max(this.W, this.H) * 0.8);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, `rgba(0,0,0,${0.72 * k})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, this.W, this.H);
    },

    /** A tall blocky shadow with long arms and glowing white square eyes, in its own fog. */
    drawStalker(ctx, m) {
        const u = m.size * 0.17;
        const flick = m.mode === 'flicker' || m.spawnT > 0;
        if (flick && Math.random() < 0.35) return; // it blinks in and out
        const x0 = m.x - 5 * u + (flick ? (Math.random() - 0.5) * 6 : 0);
        const y0 = m.y - 13 * u;
        // fog around its feet
        const fog = ctx.createRadialGradient(m.x, m.y + 6 * u, 4, m.x, m.y + 6 * u, 9 * u);
        fog.addColorStop(0, 'rgba(203,213,225,0.45)');
        fog.addColorStop(1, 'rgba(203,213,225,0)');
        ctx.fillStyle = fog;
        ctx.beginPath();
        ctx.ellipse(m.x, m.y + 6 * u, 9 * u, 4 * u, 0, 0, TAU);
        ctx.fill();
        const block = (c, r) => (r < 6 && c >= 2 && c <= 7) || (r >= 6 && r < 14 && c >= 2 && c <= 7) ||
            (r === 6 && (c === 1 || c === 8)) || ((c === 0 || c === 9) && r >= 7 && r < 17) || (r >= 14 && r < 20 && (c === 3 || c === 6));
        ctx.save();
        if (m.flash > 0) ctx.globalAlpha = 0.6;
        for (let r = 0; r < 20; r++) for (let c = 0; c < 10; c++) {
            if (!block(c, r)) continue;
            ctx.fillStyle = m.flash > 0 ? '#9ca3af' : c === 7 || c === 9 || c === 6 && r >= 14 ? '#1e1b2e' : '#050507';
            ctx.fillRect(Math.floor(x0 + c * u), Math.floor(y0 + r * u), Math.ceil(u) + 0.5, Math.ceil(u) + 0.5);
        }
        // the eyes
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x0 + 3 * u, y0 + 3 * u, u, u * 0.9);
        ctx.fillRect(x0 + 6 * u, y0 + 3 * u, u, u * 0.9);
        ctx.restore();
    },

    // ------------------------------------------------------------------ the Rick Roll (meme mode, end of level 2)

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
