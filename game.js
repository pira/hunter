/* Monster Hunter v2 — survive, chain kills, pick upgrades, slay bosses. */
const GameMath = typeof GameUtils !== 'undefined' ? GameUtils : null;

if (!GameMath) {
    throw new Error('GameUtils must be loaded before game.js');
}

const U = GameMath;
const TAU = Math.PI * 2;
const STEP = 1 / 60;
const GAME_SPEED = 0.9; // whole simulation runs at 90% speed
const BURN_MS = 1500; // level-up burn transition length
const ARENA_HUES = [200, 265, 160, 330, 35, 225, 120, 290, 10, 185]; // one arena colour per level, cycling
const WORLD_AREA = 800 * 600; // Every screen shape gets the same play area, so scores stay comparable.
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const DISPLAY_FONT = '"Lilita One","Arial Rounded MT Bold",system-ui,sans-serif';

const WEAPONS = {
    bullets: { name: 'Blaster', icon: '🔫', unlock: 1 },
    sword: { name: 'Blades', icon: '⚔️', unlock: 1 },
    grenades: { name: 'Grenades', icon: '💣', unlock: 4 },
    missiles: { name: 'Missiles', icon: '🚀', unlock: 8 }
};
const WEAPON_ORDER = ['bullets', 'sword', 'grenades', 'missiles'];

const MONSTER_TYPES = {
    small: [
        { shape: 'circle', color: '#8B0000', size: 11, speed: 1.5, speedVariation: 0.5, health: 1, name: 'Imp', points: 10 },
        { shape: 'square', color: '#4B0082', size: 8, speed: 1.6, speedVariation: 0.4, health: 1, name: 'Shadow', points: 10 },
        { shape: 'triangle', color: '#006400', size: 9, speed: 1.6, speedVariation: 0.5, health: 1, name: 'Goblin', points: 10 },
        { shape: 'diamond', color: '#8B4513', size: 10, speed: 1.4, speedVariation: 0.4, health: 1, name: 'Kobold', points: 10 }
    ],
    medium: [
        { shape: 'star', color: '#DC143C', size: 14, speed: 1.2, speedVariation: 0.3, health: 2, name: 'Demon', points: 25 },
        { shape: 'hexagon', color: '#8A2BE2', size: 12, speed: 1.3, speedVariation: 0.4, health: 2, name: 'Wraith', points: 25 },
        { shape: 'cross', color: '#228B22', size: 13, speed: 1.1, speedVariation: 0.3, health: 3, name: 'Troll', points: 25 }
    ],
    large: [
        { shape: 'spiky', color: '#FF4500', size: 15, speed: 0.8, speedVariation: 0.2, health: 5, name: 'Dragon Lord', points: 100 },
        { shape: 'giant', color: '#800080', size: 19, speed: 1.0, speedVariation: 0.2, health: 4, name: 'Ancient One', points: 80 },
        { shape: 'behemoth', color: '#2F4F4F', size: 17, speed: 0.7, speedVariation: 0.2, health: 6, name: 'Behemoth', points: 120 }
    ],
    elite: [{ shape: 'aura', color: '#FFD700', size: 20, speed: 1.4, speedVariation: 0.5, health: 3, name: 'Elite Guard', points: 50 }],
    legendary: [{ shape: 'aura', color: '#FF1493', size: 24, speed: 1.5, speedVariation: 0.3, health: 10, name: 'Legendary Beast', points: 150 }],
    mythic: [{ shape: 'aura', color: '#00FFFF', size: 28, speed: 1.8, speedVariation: 0.4, health: 14, name: 'Mythic Titan', points: 250 }],
    ancient: [{ shape: 'aura', color: '#FF00FF', size: 34, speed: 2.2, speedVariation: 0.5, health: 20, name: 'Ancient Horror', points: 400 }],
    ultimate: [{ shape: 'aura', color: '#FFFFFF', size: 40, speed: 2.4, speedVariation: 0.4, health: 50, name: 'Ultimate Destroyer', points: 1000 }]
};
const TIER_UNLOCK = { elite: 6, legendary: 11, mythic: 16, ancient: 22, ultimate: 28 };
const DROP_CHANCE = { small: 0.006, medium: 0.015, large: 0.07, elite: 0.2, legendary: 0.35, mythic: 0.5, ancient: 0.7, ultimate: 1 };

const POWERUPS = {
    multiShot: { emoji: '🏹', name: 'Multi-Shot', color: '#FF69B4', timed: true },
    rapidFire: { emoji: '⚡', name: 'Rapid Fire', color: '#00CED1', timed: true },
    invincible: { emoji: '🛡️', name: 'Invincible', color: '#7CFC00', timed: true },
    freeze: { emoji: '❄️', name: 'Freeze', color: '#87CEEB', timed: true },
    heart: { emoji: '❤️', name: 'Extra Life', color: '#FF1493' },
    bomb: { emoji: '💣', name: 'Bomb', color: '#FF4500' }
};
const TIMED_POWERUPS = ['multiShot', 'rapidFire', 'invincible', 'freeze'];

const UPGRADES = [
    { id: 'power', icon: '💪', name: 'Power', max: 5, desc: '+20% damage with every weapon' },
    { id: 'haste', icon: '⏱️', name: 'Haste', max: 5, desc: '+15% attack speed' },
    { id: 'boots', icon: '👟', name: 'Swift Boots', max: 4, desc: '+10% move speed' },
    { id: 'vitality', icon: '❤️', name: 'Vitality', max: 3, desc: '+1 max heart and heal 1' },
    { id: 'crit', icon: '🎯', name: 'Keen Eye', max: 4, desc: '+8% chance to crit for 2.5× damage' },
    { id: 'streak', icon: '🔥', name: 'Hot Streak', max: 3, desc: 'Combo timer lasts 0.6s longer' },
    { id: 'luck', icon: '🍀', name: 'Lucky Charm', max: 3, desc: '+40% powerup drops' },
    { id: 'overtime', icon: '⌛', name: 'Overtime', max: 3, desc: 'Powerups last 30% longer' },
    { id: 'regen', icon: '🌿', name: 'Regeneration', max: 2, desc: 'Regrow a heart every 40s (25s at rank 2)' },
    { id: 'nova', icon: '💫', name: 'Static Nova', max: 2, desc: 'Taking a hit blasts nearby monsters' },
    { id: 'split', icon: '🔱', name: 'Split Shot', max: 3, weapon: 'bullets', desc: 'Blaster fires +1 bullet' },
    { id: 'pierce', icon: '🏹', name: 'Piercing Rounds', max: 3, weapon: 'bullets', desc: 'Bullets pierce +1 monster' },
    { id: 'blades', icon: '🌀', name: 'Whirlwind', max: 3, weapon: 'sword', desc: '+1 spinning blade' },
    { id: 'reach', icon: '🗡️', name: 'Long Blades', max: 3, weapon: 'sword', desc: '+20% blade reach' },
    { id: 'cluster', icon: '🧨', name: 'Cluster Bombs', max: 3, weapon: 'grenades', desc: '+1 grenade per throw' },
    { id: 'blast', icon: '💥', name: 'Big Bang', max: 3, weapon: 'grenades', desc: '+30% blast radius' },
    { id: 'swarm', icon: '🎇', name: 'Swarm', max: 3, weapon: 'missiles', desc: '+1 missile per salvo' }
];
const FALLBACK_CARDS = [
    { id: 'treasure', icon: '💰', name: 'Treasure', max: Infinity, desc: 'Gain 150 × level points' },
    { id: 'feast', icon: '🍖', name: 'Feast', max: Infinity, desc: 'Fully heal' }
];

const BOSSES = [
    { name: 'Bonecrusher', title: 'The Juggernaut', color: '#C0392B', accent: '#F5B041', size: 40, hp: 60, speed: 0.9, pattern: 'charge' },
    { name: 'Hexweaver', title: 'Witch of the Ninth Moon', color: '#7D3C98', accent: '#F4D03F', size: 36, hp: 85, speed: 1.1, pattern: 'rings' },
    { name: 'Broodmother', title: 'Queen of the Swarm', color: '#1E8449', accent: '#ABEBC6', size: 46, hp: 110, speed: 0.6, pattern: 'summon' },
    { name: 'Voidmaw', title: 'Devourer of Light', color: '#1B2631', accent: '#E74C3C', size: 44, hp: 145, speed: 1.0, pattern: 'chaos' }
];

class Game {
    constructor() {
        // Version system (bumped by the pre-commit hook, see VERSION-README.md)
        this.version = "2.1.0";
        this.buildDate = "2026-10-21";

        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.stage = document.getElementById('stage');
        this.isTouch = window.matchMedia('(pointer: coarse)').matches;
        document.body.classList.toggle('touch', this.isTouch);

        this.W = 800;
        this.H = 600;
        this.scale = 1;
        this.dpr = 1;
        this.keys = {};
        this.mouse = { x: 0, y: 0, down: false };
        this.stick = { id: null, ax: 0, ay: 0, x: 0, y: 0, dx: 0, dy: 0 };
        this.state = 'menu';
        this.lastTime = performance.now();
        this.acc = 0;
        this.hud = {};
        this.attract = [];

        Sfx.init();
        this.bindDom();
        this.setupInput();
        this.resize();
        window.addEventListener('resize', () => this.resize());
        window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 150));
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state === 'playing') this.pause();
        });

        this.resetRun();
        this.showMenu();
        this.frame = this.frame.bind(this);
        requestAnimationFrame(this.frame);
    }

    // ------------------------------------------------------------------ setup

    bindDom() {
        const $ = id => document.getElementById(id);
        this.el = {
            hud: $('hud'), hearts: $('hearts'), level: $('levelLabel'), xpFill: $('xpFill'),
            score: $('score'), combo: $('combo'), comboMult: $('comboMult'), comboCount: $('comboCount'),
            comboFill: $('comboFill'), weapons: $('weapons'), powerups: $('powerups'),
            bossBar: $('bossBar'), bossName: $('bossName'), bossFill: $('bossFill'), bossTrail: $('bossTrail'),
            banner: $('banner'), menu: $('menu'), menuBoard: $('menuBoard'), menuBoardTitle: $('menuBoardTitle'),
            playBtn: $('playBtn'), levelup: $('levelup'), levelupTitle: $('levelupTitle'), levelupSub: $('levelupSub'),
            cards: $('cards'), pauseOverlay: $('pause'), gameover: $('gameover'), killerIcon: $('killerIcon'),
            killedBy: $('killedBy'), finalStats: $('finalStats'), nameForm: $('nameForm'), nameInput: $('nameInput'),
            submitStatus: $('submitStatus'), finalBoard: $('finalBoard'), finalBoardTitle: $('finalBoardTitle'),
            againBtn: $('againBtn'), weaponBtn: $('weaponBtn'), pauseBtn: $('pauseBtn'), muteBtn: $('muteBtn'),
            version: $('version'), newBest: $('newBest')
        };

        this.el.version.textContent = `v${this.version} · ${this.buildDate}`;
        this.el.playBtn.addEventListener('click', () => this.startRun());
        this.el.againBtn.addEventListener('click', () => this.startRun());
        $('menuBtn').addEventListener('click', () => this.showMenu());
        $('resumeBtn').addEventListener('click', () => this.resume());
        $('restartBtn').addEventListener('click', () => this.startRun());
        $('quitBtn').addEventListener('click', () => this.showMenu());
        $('skipBtn').addEventListener('click', () => this.skipSubmit());
        this.el.pauseBtn.addEventListener('click', e => {
            e.currentTarget.blur();
            if (this.state === 'paused') this.resume();
            else this.pause();
        });
        this.el.muteBtn.addEventListener('click', e => {
            e.currentTarget.blur();
            this.toggleMute();
        });
        this.el.weaponBtn.addEventListener('pointerdown', e => {
            e.preventDefault();
            this.cycleWeapon(1);
        });
        this.el.nameForm.addEventListener('submit', e => {
            e.preventDefault();
            this.submitScore();
        });
        this.el.muteBtn.textContent = Sfx.muted ? '🔇' : '🔊';

        // Weapon slots in the HUD
        this.el.weapons.innerHTML = WEAPON_ORDER.map((w, i) =>
            `<div class="slot" data-w="${w}"><span class="icon">${WEAPONS[w].icon}</span>` +
            `<span class="key">${i + 1}</span><span class="lock">Lv${WEAPONS[w].unlock}</span></div>`).join('');
        this.el.weapons.querySelectorAll('.slot').forEach(slot =>
            slot.addEventListener('pointerdown', e => {
                e.preventDefault();
                this.selectWeapon(slot.dataset.w);
            }));
    }

    setupInput() {
        const gameKeys = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', ' '];
        window.addEventListener('keydown', e => {
            if (e.target && e.target.tagName === 'INPUT') return;
            const key = (e.key || '').toLowerCase();
            // A focused button inside an open menu handles Enter/Space via its click event.
            if (e.target && e.target.tagName === 'BUTTON' && (key === 'enter' || key === ' ') && e.target.closest('.overlay.show')) return;
            if (gameKeys.includes(key)) e.preventDefault();

            if (this.state === 'menu' && (key === 'enter' || key === ' ')) {
                this.startRun();
                return;
            }
            if (this.state === 'gameover' && key === 'enter' && this.submitted) {
                this.startRun();
                return;
            }
            if (this.state === 'transition') return;
            if (this.state === 'levelup') {
                const idx = ['1', '2', '3'].indexOf(key);
                if (idx >= 0) this.chooseCard(idx);
                return;
            }
            if (key === 'm') this.toggleMute();
            if (key === 'p' || key === 'escape') {
                if (this.state === 'playing') this.pause();
                else if (this.state === 'paused') this.resume();
                return;
            }
            if (this.state !== 'playing') return;
            if (key === ' ' || key === 'e') this.cycleWeapon(1);
            else if (key === 'q') this.cycleWeapon(-1);
            else if (['1', '2', '3', '4'].includes(key)) this.selectWeapon(WEAPON_ORDER[Number(key) - 1]);
            this.keys[key] = true;
        });
        window.addEventListener('keyup', e => {
            this.keys[(e.key || '').toLowerCase()] = false;
        });
        window.addEventListener('blur', () => {
            this.keys = {};
            this.mouse.down = false;
            this.releaseStick();
            if (this.state === 'playing') this.pause();
        });

        const toWorld = e => {
            const rect = this.canvas.getBoundingClientRect();
            return { x: (e.clientX - rect.left) / this.scale, y: (e.clientY - rect.top) / this.scale };
        };

        this.canvas.addEventListener('pointerdown', e => {
            e.preventDefault();
            if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
            Sfx.unlock();
            if (e.pointerType === 'mouse') {
                Object.assign(this.mouse, toWorld(e), { down: true });
            } else if (this.stick.id === null || e.isPrimary) {
                this.stick = { id: e.pointerId, ax: e.clientX, ay: e.clientY, x: e.clientX, y: e.clientY, dx: 0, dy: 0 };
            }
        });
        window.addEventListener('pointermove', e => {
            if (e.pointerType === 'mouse') {
                Object.assign(this.mouse, toWorld(e));
            } else if (e.pointerId === this.stick.id) {
                const max = 55;
                let dx = e.clientX - this.stick.ax;
                let dy = e.clientY - this.stick.ay;
                const dist = Math.hypot(dx, dy);
                if (dist > max) {
                    // Drag the anchor along so the stick never feels "stuck" at the rim.
                    this.stick.ax += dx * (1 - max / dist);
                    this.stick.ay += dy * (1 - max / dist);
                    dx = e.clientX - this.stick.ax;
                    dy = e.clientY - this.stick.ay;
                }
                const mag = Math.min(1, Math.hypot(dx, dy) / max);
                const n = U.normalizeVector(dx, dy);
                const live = mag > 0.12 ? mag : 0;
                Object.assign(this.stick, { x: e.clientX, y: e.clientY, dx: n.x * live, dy: n.y * live });
            }
        });
        const release = e => {
            if (e.pointerType === 'mouse') this.mouse.down = false;
            if (e.pointerId === this.stick.id) this.releaseStick();
        };
        window.addEventListener('pointerup', release);
        window.addEventListener('pointercancel', release);
        this.canvas.addEventListener('contextmenu', e => e.preventDefault());
        this.canvas.addEventListener('wheel', e => {
            if (this.state === 'playing') this.cycleWeapon(e.deltaY > 0 ? 1 : -1);
        }, { passive: true });
    }

    releaseStick() {
        this.stick = { id: null, ax: 0, ay: 0, x: 0, y: 0, dx: 0, dy: 0 };
    }

    resize() {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        if (vw < 1 || vh < 1) return; // transient zero-size viewport (webviews, split screen)
        const aspect = U.clamp(vw / vh, 0.5, 2.0);
        const W = Math.sqrt(WORLD_AREA * aspect);
        const H = WORLD_AREA / W;
        let cssW = vw;
        let cssH = vw / aspect;
        if (cssH > vh) {
            cssH = vh;
            cssW = vh * aspect;
        }
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const sizeKey = `${Math.round(cssW)}x${Math.round(cssH)}@${dpr}`;
        if (sizeKey === this.sizeKey) return; // spurious resize (mobile URL bar, screenshots)
        this.sizeKey = sizeKey;
        this.W = W;
        this.H = H;
        this.scale = cssW / W;
        this.dpr = dpr;
        this.canvas.width = Math.round(cssW * this.dpr);
        this.canvas.height = Math.round(cssH * this.dpr);
        this.canvas.style.width = `${cssW}px`;
        this.canvas.style.height = `${cssH}px`;
        this.stage.style.width = `${cssW}px`;
        this.stage.style.height = `${cssH}px`;
        this.stage.style.setProperty('--ui', Math.max(0.75, Math.min(1.25, cssW / 900)).toFixed(3));
        this.bgKey = null;
        if (this.burn) this.finishBurn();
        if (this.player) {
            this.player.x = U.clamp(this.player.x, this.player.r, W - this.player.r);
            this.player.y = U.clamp(this.player.y, this.player.r, H - this.player.r);
        }
    }

    // ------------------------------------------------------------------ run lifecycle

    resetRun() {
        this.player = {
            x: this.W / 2, y: this.H / 2, r: 15, vx: 0, vy: 0, baseSpeed: 4.4,
            hp: 3, maxHp: 3, iframes: 0, facing: 1, moveT: 0, contactCd: 0
        };
        this.score = 0;
        this.xp = 0;
        this.level = 1;
        this.kills = 0;
        this.time = 0;
        this.frameNo = 0;
        this.combo = 0;
        this.comboTimer = 0;
        this.bestCombo = 0;
        this.bossesSlain = 0;
        this.bossCount = 0;
        this.bossQueue = 0;
        this.bossWarning = 0;
        this.boss = null;
        this.pendingLevels = 0;
        this.pendingReward = false;

        this.monsters = [];
        this.bullets = [];
        this.enemyShots = [];
        this.missiles = [];
        this.grenades = [];
        this.explosions = [];
        this.particles = [];
        this.floaters = [];
        this.powerups = [];

        this.weapon = 'bullets';
        this.cooldowns = { bullets: 0, grenades: 30, missiles: 30 };
        this.blades = { angle: 0, lastSwoosh: 0 };
        this.timers = { multiShot: 0, rapidFire: 0, invincible: 0, freeze: 0 };
        this.stacks = {};
        this.spawnClock = 0;
        this.packClock = 12;
        this.powerupClock = 14;
        this.regenClock = 0;
        this.shakeAmt = 0;
        this.shakeX = 0;
        this.shakeY = 0;
        this.hitStop = 0;
        this.timeScale = 1;
        this.flash = { color: null, t: 0, max: 1 };
        this.hurtFlash = 0;
        this.deathTimer = 0;
        this.killer = null;
        this.runToken = null;
        this.submitted = false;
        this.bossTrailPct = 1;
        this.edgeWarn = null;
        this.comboPop = 0;
        this.unlockedNow = null;
        this.submitting = false;
        this.burn = null;
        if (this.el) this.el.levelup.classList.remove('intro');
    }

    showMenu() {
        Sfx.stopMusic();
        this.state = 'menu';
        this.resetRun();
        this.setOverlay('menu');
        this.el.hud.classList.add('hidden');
        this.el.bossBar.hidden = true;
        this.attract = [];
        for (let i = 0; i < 9; i++) this.attract.push(this.makeMonster(this.pickType(['small', 'medium', 'large'][i % 3]), Math.random() * this.W, Math.random() * this.H, 'random'));
        this.loadBoard(this.el.menuBoard, this.el.menuBoardTitle);
    }

    startRun() {
        Sfx.unlock();
        Sfx.stopMusic();
        this.resetRun();
        this.releaseStick();
        const runId = (this.runId = (this.runId || 0) + 1);
        this.attract = [];
        this.state = 'playing';
        this.setOverlay(null);
        this.el.hud.classList.remove('hidden');
        this.el.bossBar.hidden = true;
        this.lastTime = performance.now();
        this.acc = 0;
        this.banner('HUNT!', 'Chain kills for a combo multiplier');
        Sfx.arpeggio([392, 523, 659], 0.08, { type: 'triangle', volume: 0.12 });
        Leaderboard.startRun().then(token => {
            if (this.runId === runId) this.runToken = token;
        });
    }

    pause() {
        if (this.state !== 'playing') return;
        this.releaseStick();
        this.keys = {};
        this.state = 'paused';
        this.setOverlay('pause');
    }

    resume() {
        if (this.state !== 'paused') return;
        Sfx.unlock();
        this.state = 'playing';
        this.setOverlay(null);
        this.lastTime = performance.now();
    }

    toggleMute() {
        Sfx.unlock();
        const muted = Sfx.toggleMute();
        this.el.muteBtn.textContent = muted ? '🔇' : '🔊';
    }

    setOverlay(name) {
        ['menu', 'levelup', 'pauseOverlay', 'gameover'].forEach(key => {
            const id = key === 'pauseOverlay' ? 'pause' : key;
            this.el[key].classList.toggle('show', id === name);
        });
    }

    // ------------------------------------------------------------------ main loop

    frame(now) {
        requestAnimationFrame(this.frame); // schedule first so one bad frame can't stop the loop
        const dt = Math.min(0.1, Math.max(0, (now - this.lastTime) / 1000));
        this.lastTime = now;

        if (this.state === 'playing' || this.state === 'dying') {
            this.acc += dt * this.timeScale * GAME_SPEED;
            let steps = 0;
            while (this.acc >= STEP && steps < 6) {
                this.step();
                this.acc -= STEP;
                steps++;
                if (this.state !== 'playing' && this.state !== 'dying') break;
            }
            if (steps >= 6) this.acc = 0;
        } else if (this.state === 'menu') {
            this.acc += dt;
            while (this.acc >= STEP) {
                this.attractStep();
                this.acc -= STEP;
            }
        }

        this.render();
        if (this.state === 'transition') this.drawBurn(now, dt);
        this.updateHud();
    }

    attractStep() {
        this.frameNo++;
        this.attract.forEach(m => {
            m.spawnT = 0;
            this.moveMonster(m, 0.6);
            if (m.x < -40 || m.x > this.W + 40 || m.y < -40 || m.y > this.H + 40) {
                m.dir = Math.atan2(this.H / 2 - m.y, this.W / 2 - m.x);
            }
        });
    }

    step() {
        this.frameNo++;
        this.updateShake();
        if (this.hitStop > 0) {
            this.hitStop--;
            return;
        }

        if (this.state === 'dying') {
            this.deathTimer--;
            this.updateMonsters(true);
            this.updateParticles();
            if (this.deathTimer <= 0) this.showGameOver();
            return;
        }

        this.time += STEP / GAME_SPEED; // survival time in real seconds
        this.updatePlayer();
        this.updateWeapons();
        this.updateBullets();
        this.updateGrenades();
        this.updateMissiles();
        this.updateMonsters(false);
        this.updateEnemyShots();
        this.updatePowerups();
        this.updateCombo();
        this.updateParticles();
        this.updateSpawning();
        this.sweepDead();

        if (this.state === 'playing' && this.pendingLevels > 0) this.beginCards('level');
        else if (this.state === 'playing' && this.pendingReward) this.beginCards('reward');
    }

    // ------------------------------------------------------------------ derived stats

    stack(id) {
        return this.stacks[id] || 0;
    }

    get damageMult() {
        return 1 + 0.2 * this.stack('power');
    }

    get rateMult() {
        return (1 + 0.15 * this.stack('haste')) * (this.timers.rapidFire > 0 ? 3 : 1);
    }

    get comboWindow() {
        return 150 + 36 * this.stack('streak');
    }

    get powerupDuration() {
        return Math.round(600 * (1 + 0.3 * this.stack('overtime')));
    }

    isUnlocked(weapon) {
        return this.level >= WEAPONS[weapon].unlock;
    }

    rollDamage(base) {
        const crit = Math.random() < 0.08 * this.stack('crit');
        return { dmg: base * this.damageMult * (crit ? 2.5 : 1), crit };
    }

    // ------------------------------------------------------------------ player

    updatePlayer() {
        const p = this.player;
        let ix = 0;
        let iy = 0;
        if (this.keys.w || this.keys.arrowup) iy -= 1;
        if (this.keys.s || this.keys.arrowdown) iy += 1;
        if (this.keys.a || this.keys.arrowleft) ix -= 1;
        if (this.keys.d || this.keys.arrowright) ix += 1;
        if (ix || iy) {
            const n = U.normalizeVector(ix, iy);
            ix = n.x;
            iy = n.y;
        }
        if (this.stick.id !== null) {
            ix = this.stick.dx;
            iy = this.stick.dy;
        }

        const speed = p.baseSpeed * (1 + 0.1 * this.stack('boots'));
        p.vx = U.lerp(p.vx, ix * speed, 0.3);
        p.vy = U.lerp(p.vy, iy * speed, 0.3);
        p.x = U.clamp(p.x + p.vx, p.r, this.W - p.r);
        p.y = U.clamp(p.y + p.vy, p.r, this.H - p.r);
        if (Math.abs(p.vx) > 0.3) p.facing = p.vx > 0 ? 1 : -1;

        const moving = Math.hypot(p.vx, p.vy) > 0.5;
        p.moveT = moving ? p.moveT + 1 : 0;
        if (moving && this.frameNo % 6 === 0) {
            this.particle({ x: p.x - p.vx * 2, y: p.y + p.r * 0.8, vx: -p.vx * 0.1, vy: -0.2, life: 24, size: 3, color: 'rgba(255,255,255,0.5)', kind: 'dust' });
        }

        if (p.iframes > 0) p.iframes--;
        if (p.contactCd > 0) p.contactCd--;

        const regen = this.stack('regen');
        if (regen > 0 && p.hp < p.maxHp) {
            this.regenClock += STEP;
            if (this.regenClock >= (regen === 1 ? 40 : 25)) {
                this.regenClock = 0;
                p.hp++;
                this.floater(p.x, p.y - 30, '+❤️', '#ff6b8a', 18);
            }
        } else {
            this.regenClock = 0;
        }
    }

    hurtPlayer(source) {
        const p = this.player;
        if (this.state !== 'playing' || p.iframes > 0 || this.timers.invincible > 0) return;
        p.hp--;
        p.iframes = 90;
        this.shake(14);
        this.hitStop = 5;
        this.hurtFlash = 1;
        if (this.combo >= 5) this.floater(p.x, p.y - 40, 'COMBO LOST', '#ff5252', 20);
        this.combo = 0;
        this.comboTimer = 0;

        const nova = this.stack('nova');
        const novaR = nova ? 90 + 40 * nova : 70;
        this.monsters.forEach(m => {
            if (m.dead) return;
            const d2 = U.distanceSquared(m.x, m.y, p.x, p.y);
            if (d2 < (novaR + m.size) ** 2) {
                const n = U.normalizeVector(m.x - p.x, m.y - p.y);
                if (!m.boss) {
                    m.kbx += n.x * 9;
                    m.kby += n.y * 9;
                }
                if (nova) this.damageMonster(m, 3 * nova * this.damageMult, { kx: 0, ky: 0 });
            }
        });
        if (nova) {
            this.ring(p.x, p.y, novaR, '#9be7ff', 22);
            this.burst(p.x, p.y, '#9be7ff', 18, 5);
        }

        if (p.hp <= 0) {
            this.die(source);
        } else {
            Sfx.play('playerHit', { volume: 0.7 });
        }
    }

    die(source) {
        this.killer = source;
        this.state = 'dying';
        this.deathTimer = 48;
        this.timeScale = 0.45;
        this.shake(24);
        const p = this.player;
        this.burst(p.x, p.y, '#ffffff', 40, 7);
        this.burst(p.x, p.y, '#b388ff', 30, 5);
        this.ring(p.x, p.y, 120, '#ffffff', 40);
        Sfx.play('playerHit', { volume: 0.9, rate: 0.8 });
    }

    // ------------------------------------------------------------------ weapons

    cycleWeapon(dir) {
        if (this.state !== 'playing') return;
        const available = WEAPON_ORDER.filter(w => this.isUnlocked(w));
        const idx = available.indexOf(this.weapon);
        this.selectWeapon(available[(idx + dir + available.length) % available.length]);
    }

    selectWeapon(weapon) {
        if (this.state !== 'playing' || !weapon || !this.isUnlocked(weapon) || weapon === this.weapon) return;
        this.weapon = weapon;
        Sfx.tone(660, { duration: 0.06, type: 'triangle', volume: 0.08 });
    }

    aimPoint() {
        if (this.mouse.down) return { x: this.mouse.x, y: this.mouse.y };
        const target = this.nearestMonster(this.player.x, this.player.y);
        return target ? { x: target.x, y: target.y } : null;
    }

    nearestMonster(x, y, exclude) {
        let best = null;
        let bestD = Infinity;
        for (const m of this.monsters) {
            if (m.dead || (exclude && exclude.has(m))) continue;
            if (m.x < -m.size || m.x > this.W + m.size || m.y < -m.size || m.y > this.H + m.size) continue;
            // Bosses count as closer than they are, so auto-aim focuses them.
            const d = U.distanceSquared(x, y, m.x, m.y) * (m.boss ? 0.2 : 1);
            if (d < bestD) {
                bestD = d;
                best = m;
            }
        }
        return best;
    }

    updateWeapons() {
        Object.keys(this.cooldowns).forEach(w => {
            if (this.cooldowns[w] > 0) this.cooldowns[w] -= this.rateMult;
        });

        if (this.weapon === 'sword') {
            this.updateBlades();
            return;
        }
        if (this.cooldowns[this.weapon] > 0) return;
        const aim = this.weapon === 'missiles' ? null : this.aimPoint();
        if (this.weapon !== 'missiles' && !aim) return;

        if (this.weapon === 'bullets') this.fireBullets(aim);
        else if (this.weapon === 'grenades') this.throwGrenades(aim);
        else if (this.weapon === 'missiles') this.fireMissiles();
    }

    fireBullets(aim) {
        const p = this.player;
        this.cooldowns.bullets = 32;
        const base = Math.atan2(aim.y - p.y, aim.x - p.x);
        const count = 1 + this.stack('split');
        const angles = [];
        for (let i = 0; i < count; i++) angles.push(base + (i - (count - 1) / 2) * 0.16);
        if (this.timers.multiShot > 0) {
            for (let i = 0; i < 16; i++) angles.push(base + (i * TAU) / 16 + TAU / 32);
        }
        angles.forEach(a => {
            this.bullets.push({
                x: p.x + Math.cos(a) * 12, y: p.y + Math.sin(a) * 12,
                vx: Math.cos(a) * 9, vy: Math.sin(a) * 9, r: 4.5,
                pierce: this.stack('pierce'), hits: new Set(), life: 120
            });
        });
        this.particle({ x: p.x + Math.cos(base) * 16, y: p.y + Math.sin(base) * 16, vx: 0, vy: 0, life: 5, size: 9, color: '#fff6a0', kind: 'flash' });
        Sfx.play('shoot', { volume: 0.25, rate: 0.95 + Math.random() * 0.15, duration: 0.35 });
    }

    throwGrenades(aim) {
        const p = this.player;
        this.cooldowns.grenades = 96;
        const count = 1 + this.stack('cluster') + (this.timers.multiShot > 0 ? 3 : 0);
        const base = Math.atan2(aim.y - p.y, aim.x - p.x);
        const range = Math.min(220, Math.hypot(aim.x - p.x, aim.y - p.y) + 10);
        for (let i = 0; i < count; i++) {
            const a = base + (i - (count - 1) / 2) * 0.32;
            this.grenades.push({ x: p.x, y: p.y, sx: p.x, sy: p.y, vx: Math.cos(a) * 6.5, vy: Math.sin(a) * 6.5, range, timer: 64, spin: 0 });
        }
        Sfx.play('grenade', { volume: 0.55 });
    }

    fireMissiles() {
        if (!this.monsters.some(m => !m.dead)) return;
        this.cooldowns.missiles = 100;
        const p = this.player;
        const count = (1 + this.stack('swarm')) * (this.timers.multiShot > 0 ? 3 : 1);
        const claimed = new Set();
        for (let i = 0; i < count; i++) {
            let target = this.nearestMonster(p.x, p.y, claimed) || this.nearestMonster(p.x, p.y);
            if (target) claimed.add(target);
            const a = -Math.PI / 2 + (i - (count - 1) / 2) * 0.5 + (Math.random() - 0.5) * 0.3;
            this.missiles.push({ x: p.x, y: p.y, angle: a, speed: 3, target, trail: [], life: 240 });
        }
        Sfx.play('missile', { volume: 0.6 });
    }

    updateBlades() {
        const p = this.player;
        const count = 1 + this.stack('blades') + (this.timers.multiShot > 0 ? 2 : 0);
        const radius = 46 * (1 + 0.2 * this.stack('reach')) * (this.timers.multiShot > 0 ? 1.25 : 1);
        const spin = 0.075 * (this.timers.rapidFire > 0 ? 2.5 : 1) * (1 + 0.1 * this.stack('haste'));
        this.blades.angle += spin;
        this.blades.count = count;
        this.blades.radius = radius;
        if (this.blades.angle - this.blades.lastSwoosh > TAU) {
            this.blades.lastSwoosh = this.blades.angle;
            Sfx.play('swoosh', { volume: 0.3, rate: 2.4, duration: 0.4 });
        }

        for (const m of this.monsters) {
            if (m.dead || m.bladeCd > 0) continue;
            if (U.distanceSquared(m.x, m.y, p.x, p.y) > (radius + m.size + 4) ** 2) continue;
            for (let i = 0; i < count; i++) {
                const a = this.blades.angle + (i * TAU) / count;
                const x1 = p.x + Math.cos(a) * 8;
                const y1 = p.y + Math.sin(a) * 8;
                const x2 = p.x + Math.cos(a) * radius;
                const y2 = p.y + Math.sin(a) * radius;
                if (this.distToSegment(m.x, m.y, x1, y1, x2, y2) <= m.size + 3) {
                    const n = U.normalizeVector(m.x - p.x, m.y - p.y);
                    const { dmg, crit } = this.rollDamage(1);
                    m.bladeCd = 8;
                    this.damageMonster(m, dmg, { kx: n.x * 3, ky: n.y * 3, crit });
                    this.spark(m.x - n.x * m.size, m.y - n.y * m.size, '#dfe6e9', 4);
                    break;
                }
            }
        }
    }

    distToSegment(px, py, x1, y1, x2, y2) {
        const cx = x2 - x1;
        const cy = y2 - y1;
        const lenSq = cx * cx + cy * cy;
        const t = lenSq ? U.clamp(((px - x1) * cx + (py - y1) * cy) / lenSq, 0, 1) : 0;
        return Math.hypot(px - (x1 + t * cx), py - (y1 + t * cy));
    }

    updateBullets() {
        for (const b of this.bullets) {
            b.x += b.vx;
            b.y += b.vy;
            b.life--;
            if (b.x < -10 || b.x > this.W + 10 || b.y < -10 || b.y > this.H + 10) b.life = 0;
            if (b.life <= 0) continue;
            for (const m of this.monsters) {
                if (m.dead || b.hits.has(m)) continue;
                if (U.distanceSquared(b.x, b.y, m.x, m.y) < (b.r + m.size) ** 2) {
                    b.hits.add(m);
                    const { dmg, crit } = this.rollDamage(1);
                    this.damageMonster(m, dmg, { kx: b.vx * 0.25, ky: b.vy * 0.25, crit });
                    this.spark(b.x, b.y, '#ffe066', 3);
                    if (b.pierce-- <= 0) {
                        b.life = 0;
                        break;
                    }
                }
            }
        }
        this.bullets = this.bullets.filter(b => b.life > 0);
    }

    updateGrenades() {
        for (const g of this.grenades) {
            const travelled = Math.hypot(g.x - g.sx, g.y - g.sy);
            if (travelled < g.range) {
                g.x += g.vx;
                g.y += g.vy;
                g.spin += 0.3;
                for (const m of this.monsters) {
                    if (!m.dead && U.distanceSquared(g.x, g.y, m.x, m.y) < (5 + m.size) ** 2) {
                        g.range = 0; // stick to the first monster touched
                        break;
                    }
                }
            }
            g.timer--;
            if (g.timer <= 0) {
                const radius = 46 * (1 + 0.3 * this.stack('blast'));
                this.explode(g.x, g.y, radius, 8);
            }
        }
        this.grenades = this.grenades.filter(g => g.timer > 0);
    }

    explode(x, y, radius, baseDamage) {
        for (const m of this.monsters) {
            if (m.dead) continue;
            if (U.distanceSquared(x, y, m.x, m.y) <= (radius + m.size) ** 2) {
                const n = U.normalizeVector(m.x - x, m.y - y);
                const { dmg, crit } = this.rollDamage(baseDamage);
                this.damageMonster(m, dmg, { kx: n.x * 6, ky: n.y * 6, crit });
            }
        }
        this.explosions.push({ x, y, r: radius, t: 0, max: 24 });
        this.burst(x, y, '#ff9f1c', 16, 6);
        this.burst(x, y, '#ffe066', 10, 4);
        for (let i = 0; i < 5; i++) {
            this.particle({ x, y, vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2, life: 40, size: 10 + Math.random() * 8, grow: 0.4, color: 'rgba(70,60,60,0.2)', kind: 'smoke' });
        }
        this.shake(7);
        Sfx.play('boom', { volume: 0.55, rate: 0.9 + Math.random() * 0.2 });
    }

    updateMissiles() {
        for (const ms of this.missiles) {
            if (!ms.target || ms.target.dead) ms.target = this.nearestMonster(ms.x, ms.y);
            ms.life--;
            ms.speed = Math.min(6.5, ms.speed + 0.12);
            if (ms.target) {
                const desired = Math.atan2(ms.target.y - ms.y, ms.target.x - ms.x);
                ms.angle += U.clamp(U.angleDelta(ms.angle, desired), -0.14, 0.14);
            }
            ms.x += Math.cos(ms.angle) * ms.speed;
            ms.y += Math.sin(ms.angle) * ms.speed;
            if (this.frameNo % 2 === 0) {
                ms.trail.push({ x: ms.x, y: ms.y });
                if (ms.trail.length > 14) ms.trail.shift();
            }
            const t = ms.target;
            if (t && !t.dead && U.distanceSquared(ms.x, ms.y, t.x, t.y) < (t.size + 4) ** 2) {
                const { dmg, crit } = this.rollDamage(3);
                this.damageMonster(t, dmg, { kx: Math.cos(ms.angle) * 4, ky: Math.sin(ms.angle) * 4, crit });
                this.burst(ms.x, ms.y, '#ff6b35', 8, 4);
                this.explosions.push({ x: ms.x, y: ms.y, r: 18, t: 0, max: 14 });
                this.shake(2);
                ms.life = 0;
            }
            if (ms.life <= 0 && !ms.exploded) ms.exploded = true;
        }
        this.missiles = this.missiles.filter(ms => ms.life > 0);
    }

    // ------------------------------------------------------------------ monsters

    pickTier() {
        const r = Math.random();
        const L = this.level;
        if (L >= TIER_UNLOCK.ultimate && r < 0.04) return 'ultimate';
        if (L >= TIER_UNLOCK.ancient && r < 0.07) return 'ancient';
        if (L >= TIER_UNLOCK.mythic && r < 0.1) return 'mythic';
        if (L >= TIER_UNLOCK.legendary && r < 0.12) return 'legendary';
        if (L >= TIER_UNLOCK.elite && r < 0.15) return 'elite';
        if (r < 0.65) return 'small';
        if (r < 0.9) return 'medium';
        return 'large';
    }

    pickType(tier) {
        const list = MONSTER_TYPES[tier];
        return { ...list[Math.floor(Math.random() * list.length)], tier };
    }

    edgePoint(side = Math.floor(Math.random() * 4), margin = 30) {
        switch (side) {
            case 0: return { x: Math.random() * this.W, y: -margin };
            case 1: return { x: this.W + margin, y: Math.random() * this.H };
            case 2: return { x: Math.random() * this.W, y: this.H + margin };
            default: return { x: -margin, y: Math.random() * this.H };
        }
    }

    makeMonster(type, x, y, behavior) {
        const levelSpeed = 1 + Math.min(0.45, (this.level - 1) * 0.012);
        const hpScale = 1 + Math.floor((this.level - 1) / 6) * 0.3;
        const hp = Math.max(1, Math.round(type.health * hpScale));
        return {
            x, y, kbx: 0, kby: 0,
            size: type.size + Math.random() * type.size * 0.25,
            speed: (type.speed + Math.random() * type.speedVariation) * levelSpeed,
            color: type.color, shape: type.shape, name: type.name, tier: type.tier,
            hp, maxHp: hp, points: type.points,
            behavior: behavior || (Math.random() < 0.3 + Math.min(0.3, this.level * 0.01) ? 'chase' : 'random'),
            dir: Math.atan2(this.H / 2 - y, this.W / 2 - x) + (Math.random() - 0.5) * 1.2,
            dirT: 0, dirRate: 100 + Math.random() * 100,
            healT: 0, spawnT: 75, flash: 0, bladeCd: 0, contactCd: 0,
            phase: Math.random() * TAU, dead: false
        };
    }

    spawnMonster() {
        const pos = this.edgePoint();
        this.monsters.push(this.makeMonster(this.pickType(this.pickTier()), pos.x, pos.y));
    }

    spawnPack() {
        const side = Math.floor(Math.random() * 4);
        const count = 5 + Math.min(14, Math.floor(this.level / 2));
        const origin = this.edgePoint(side, 40);
        const type = this.pickType('small');
        for (let i = 0; i < count; i++) {
            const offset = (i - count / 2) * 22;
            const x = side % 2 === 0 ? U.clamp(origin.x + offset, 10, this.W - 10) : origin.x + (side === 1 ? i % 2 * 20 : -(i % 2) * 20);
            const y = side % 2 === 1 ? U.clamp(origin.y + offset, 10, this.H - 10) : origin.y + (side === 2 ? i % 2 * 20 : -(i % 2) * 20);
            const m = this.makeMonster(type, x, y, 'chase');
            m.speed *= 0.9;
            this.monsters.push(m);
        }
        this.edgeWarn = { side, t: 60 };
    }

    updateSpawning() {
        const alive = this.monsters.length;
        const cap = Math.min(110, 40 + this.level * 2);
        const interval = U.spawnInterval(this.level) * (this.boss ? 1.7 : 1);
        this.spawnClock += STEP;
        if (alive < 3 || (this.spawnClock >= interval && alive < cap)) {
            this.spawnMonster();
            this.spawnClock = 0;
        }

        if (this.level >= 2) {
            this.packClock -= STEP;
            if (this.packClock <= 0) {
                this.spawnPack();
                this.packClock = Math.max(6, 12 - this.level * 0.2) + Math.random() * 6;
            }
        }

        this.powerupClock -= STEP;
        if (this.powerupClock <= 0) {
            this.spawnPowerup(40 + Math.random() * (this.W - 80), 40 + Math.random() * (this.H - 80));
            this.powerupClock = 12 + Math.random() * 8;
        }

        if (this.bossWarning > 0) {
            this.bossWarning--;
            if (this.bossWarning % 30 === 0) Sfx.tone(220, { duration: 0.25, type: 'sawtooth', volume: 0.08, slide: -80 });
            if (this.bossWarning === 0) this.spawnBoss();
        } else if (!this.boss && this.bossQueue > 0 && !this.pendingLevels && !this.pendingReward) {
            this.bossQueue--;
            this.startBossWarning();
        }
        if (this.edgeWarn && --this.edgeWarn.t <= 0) this.edgeWarn = null;
    }

    updateMonsters(dying) {
        const p = this.player;
        const freeze = this.timers.freeze > 0 ? 0.5 : 1;
        for (const m of this.monsters) {
            if (m.dead) continue;
            if (m.spawnT > 0) m.spawnT--;
            if (m.flash > 0) m.flash--;
            if (m.bladeCd > 0) m.bladeCd--;
            if (m.contactCd > 0) m.contactCd--;
            m.phase += 0.12;

            if (m.boss) {
                this.updateBoss(m, freeze);
            } else {
                if (m.hp < m.maxHp) {
                    if (++m.healT >= 240) {
                        m.hp = Math.min(m.maxHp, m.hp + 1);
                        m.healT = 0;
                    }
                }
                this.moveMonster(m, freeze);
            }

            m.x += m.kbx;
            m.y += m.kby;
            m.kbx *= 0.82;
            m.kby *= 0.82;

            if (dying) continue;
            const touching = U.distanceSquared(p.x, p.y, m.x, m.y) < (p.r * (this.timers.invincible > 0 ? 1.8 : 1) + m.size) ** 2;
            if (touching && m.spawnT <= 0) {
                if (this.timers.invincible > 0) {
                    if (m.contactCd <= 0) {
                        m.contactCd = 10;
                        const n = U.normalizeVector(m.x - p.x, m.y - p.y);
                        this.damageMonster(m, 2 * this.damageMult, { kx: n.x * 8, ky: n.y * 8 });
                    }
                } else {
                    this.hurtPlayer(m);
                }
            }

            if (!m.boss && (m.x < -60 - m.size || m.x > this.W + 60 + m.size || m.y < -60 - m.size || m.y > this.H + 60 + m.size)) {
                if (Math.random() < 0.75) {
                    m.dir = Math.atan2(this.H / 2 - m.y, this.W / 2 - m.x) + (Math.random() - 0.5) * Math.PI * 0.8;
                    m.dirT = 0;
                    m.x = U.clamp(m.x, -55 - m.size, this.W + 55 + m.size);
                    m.y = U.clamp(m.y, -55 - m.size, this.H + 55 + m.size);
                } else {
                    m.dead = true;
                    m.escaped = true;
                }
            }
        }
    }

    moveMonster(m, speedMult) {
        const s = m.speed * speedMult;
        if (m.behavior === 'chase' && this.state !== 'menu') {
            const n = U.normalizeVector(this.player.x - m.x, this.player.y - m.y);
            m.x += n.x * s;
            m.y += n.y * s;
        } else {
            if (++m.dirT >= m.dirRate) {
                m.dir = Math.random() * TAU;
                m.dirT = 0;
                m.dirRate = 60 + Math.random() * 120;
            }
            m.x += Math.cos(m.dir) * s;
            m.y += Math.sin(m.dir) * s;
        }
    }

    damageMonster(m, dmg, { kx = 0, ky = 0, crit = false } = {}) {
        if (m.dead) return;
        m.hp -= dmg;
        m.healT = 0;
        m.flash = 5;
        if (!m.boss) {
            const weight = 1 / Math.max(1, m.size / 12);
            m.kbx += kx * weight;
            m.kby += ky * weight;
        }
        if (crit) this.floater(m.x, m.y - m.size - 6, `${Math.round(dmg)}!`, '#ffd60a', 20);
        else if (m.boss && this.frameNo - (m.lastNum || 0) > 6) {
            m.lastNum = this.frameNo;
            this.floater(m.x + (Math.random() - 0.5) * m.size, m.y - m.size - 4, `${Math.round(dmg * 10) / 10}`, '#ffffff', 14);
        }
        if (m.hp <= 0) this.killMonster(m);
    }

    killMonster(m) {
        m.dead = true;
        this.kills++;
        this.combo++;
        this.comboTimer = this.comboWindow;
        this.bestCombo = Math.max(this.bestCombo, this.combo);
        const prevMult = U.comboMultiplier(this.combo - 1);
        const mult = U.comboMultiplier(this.combo);
        const points = Math.round(m.points * mult);
        this.score += points;
        this.gainXp(m.points);

        const big = m.size > 18 || m.boss;
        this.floater(m.x, m.y - m.size, `+${points}`, mult > 1 ? ['#fff', '#fff', '#7CFC00', '#00e5ff', '#ff4dd2', '#ffd60a'][mult] : '#ffffff', big ? 22 : 16);
        this.burst(m.x, m.y, m.color, big ? 26 : 12, big ? 6 : 4);
        this.burst(m.x, m.y, '#ffffff', big ? 8 : 4, 3);
        if (big) {
            this.ring(m.x, m.y, m.size * 3, m.color, 20);
            this.shake(m.boss ? 0 : 5);
        }

        if (mult > prevMult) {
            this.floater(this.player.x, this.player.y - 44, `COMBO ×${mult}!`, '#ffd60a', 26);
            Sfx.arpeggio([523, 659, 784, 1046].slice(0, mult), 0.05, { type: 'square', volume: 0.07 });
            this.comboPop = 1;
        }

        if (m.boss) {
            this.bossDefeated(m);
        } else if (['large', 'elite', 'legendary', 'mythic', 'ancient', 'ultimate'].includes(m.tier)) {
            Sfx.play('bossDeath', { volume: 0.55, rate: 1 + Math.random() * 0.3 });
        } else {
            Sfx.play('monsterDeath', { volume: 0.5, rate: 1.3 + Math.random() * 0.4 });
        }

        const chance = (DROP_CHANCE[m.tier] || 0) * (1 + 0.4 * this.stack('luck'));
        if (!m.minion && Math.random() < chance) this.spawnPowerup(m.x, m.y);
    }

    sweepDead() {
        this.monsters = this.monsters.filter(m => !m.dead);
    }

    // ------------------------------------------------------------------ bosses

    startBossWarning() {
        this.bossCount++;
        const def = BOSSES[(this.bossCount - 1) % BOSSES.length];
        this.bossWarning = 150;
        this.banner(`⚠ ${def.name.toUpperCase()} ⚠`, def.title, 'danger');
    }

    spawnBoss() {
        const n = this.bossCount;
        const def = BOSSES[(n - 1) % BOSSES.length];
        const cycle = Math.floor((n - 1) / BOSSES.length);
        const hp = Math.round(def.hp * (1 + 0.5 * (n - 1)) * (1 + 0.5 * cycle));
        const b = {
            ...this.makeMonster({ ...def, shape: 'boss', speedVariation: 0, health: hp, points: 0, tier: 'boss' }, this.W / 2, -def.size * 2, 'boss'),
            boss: def, size: def.size, hp, maxHp: hp, speed: def.speed * (1 + 0.1 * cycle),
            mode: 'enter', modeT: 0, t: 0, volley: 0, cycle, spawnT: 0, dashX: 0, dashY: 0
        };
        b.name = def.name;
        this.monsters.push(b);
        this.boss = b;
        this.bossTrailPct = 1;
        this.el.bossName.innerHTML = `${def.name} <small>${def.title}</small>`;
        this.el.bossBar.hidden = false;
        Sfx.play('bossDeath', { volume: 0.8, rate: 0.6 });
        this.shake(10);
    }

    updateBoss(b, freeze) {
        const p = this.player;
        b.t++;
        b.modeT++;
        const enraged = b.hp < b.maxHp * 0.5;
        const pattern = b.boss.pattern === 'chaos' ? ['charge', 'rings', 'summon'][Math.floor(b.t / 420) % 3] : b.boss.pattern;
        if (b.lastPattern && b.lastPattern !== pattern && b.mode !== 'enter') {
            b.mode = 'fight';
            b.modeT = 0;
        }
        b.lastPattern = pattern;
        b.enraged = enraged;
        const chase = mult => {
            const n = U.normalizeVector(p.x - b.x, p.y - b.y);
            b.x += n.x * b.speed * mult * freeze;
            b.y += n.y * b.speed * mult * freeze;
        };

        if (b.mode === 'enter') {
            b.y += 1.6;
            b.spawnT = 2;
            if (b.y >= this.H * 0.22) {
                b.mode = 'fight';
                b.modeT = 0;
            }
            return;
        }

        if (pattern === 'charge') {
            if (b.mode === 'fight' || b.mode === 'recover') {
                chase(b.mode === 'recover' ? 0.3 : 1);
                if (b.modeT > (b.mode === 'recover' ? 40 : enraged ? 100 : 150)) {
                    b.mode = 'windup';
                    b.modeT = 0;
                }
            } else if (b.mode === 'windup') {
                const n = U.normalizeVector(p.x - b.x, p.y - b.y);
                b.dashX = n.x;
                b.dashY = n.y;
                b.x += (Math.random() - 0.5) * 3;
                if (b.modeT > (enraged ? 34 : b.cycle === 0 ? 58 : 48)) {
                    b.mode = 'dash';
                    b.modeT = 0;
                    Sfx.tone(140, { duration: 0.3, type: 'sawtooth', volume: 0.1, slide: 200 });
                }
            } else if (b.mode === 'dash') {
                b.x += b.dashX * 10 * freeze;
                b.y += b.dashY * 10 * freeze;
                if (this.frameNo % 2 === 0) this.particle({ x: b.x, y: b.y, vx: 0, vy: 0, life: 18, size: b.size * 0.8, grow: -0.6, color: b.boss.color, kind: 'smoke' });
                const hitWall = b.x < b.size || b.x > this.W - b.size || b.y < b.size || b.y > this.H - b.size;
                if (b.modeT > 34 || hitWall) {
                    b.mode = 'recover';
                    b.modeT = 0;
                    this.shake(8);
                    if (enraged || b.cycle > 0) this.radial(b, 10, 2.6, b.boss.accent);
                }
            } else {
                b.mode = 'fight';
            }
        } else if (pattern === 'rings') {
            if (!b.wp || b.modeT > 200 || U.distanceSquared(b.x, b.y, b.wp.x, b.wp.y) < 100) {
                b.wp = { x: this.W * (0.2 + Math.random() * 0.6), y: this.H * (0.15 + Math.random() * 0.5) };
                if (b.modeT > 200) b.modeT = 0;
            }
            const n = U.normalizeVector(b.wp.x - b.x, b.wp.y - b.y);
            b.x += n.x * b.speed * freeze;
            b.y += n.y * b.speed * freeze;
            const every = enraged ? 80 : 120;
            if (b.t % every === 0) {
                b.volley++;
                if (b.volley % 3 === 0) {
                    const a = Math.atan2(p.y - b.y, p.x - b.x);
                    for (let i = -2; i <= 2; i++) this.enemyShot(b.x, b.y, a + i * 0.18, 3.4, b.boss.accent);
                } else {
                    this.radial(b, enraged ? 18 : 14, 2.4, b.boss.accent, b.volley * 0.2);
                }
            }
            if (enraged && b.t % 9 === 0) this.enemyShot(b.x, b.y, b.t * 0.07, 2.2, '#d7bde2');
        } else {
            chase(enraged ? 0.9 : 0.6);
            const every = enraged ? 160 : 220;
            if (b.t % every === 0) {
                const count = enraged ? 6 : 4;
                for (let i = 0; i < count; i++) {
                    const a = (i / count) * TAU;
                    const m = this.makeMonster(this.pickType('small'), b.x + Math.cos(a) * (b.size + 14), b.y + Math.sin(a) * (b.size + 14), 'chase');
                    m.spawnT = 40;
                    m.minion = true;
                    m.points = 5;
                    this.monsters.push(m);
                }
                this.ring(b.x, b.y, b.size * 2, b.boss.accent, 20);
            }
            if (b.t % 300 === 150) {
                const a = Math.atan2(p.y - b.y, p.x - b.x);
                for (let i = -1; i <= 1; i++) this.enemyShot(b.x, b.y, a + i * 0.25, 2.8, b.boss.accent);
            }
        }

        b.x = U.clamp(b.x, b.size, this.W - b.size);
        b.y = U.clamp(b.y, b.size, this.H - b.size);
    }

    radial(b, count, speed, color, offset = 0) {
        for (let i = 0; i < count; i++) this.enemyShot(b.x, b.y, offset + (i / count) * TAU, speed, color);
    }

    enemyShot(x, y, angle, speed, color) {
        this.enemyShots.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: 6, life: 400, color });
    }

    updateEnemyShots() {
        const p = this.player;
        const freeze = this.timers.freeze > 0 ? 0.5 : 1;
        for (const s of this.enemyShots) {
            s.x += s.vx * freeze;
            s.y += s.vy * freeze;
            s.life--;
            if (s.x < -20 || s.x > this.W + 20 || s.y < -20 || s.y > this.H + 20) s.life = 0;
            if (s.life > 0 && U.distanceSquared(s.x, s.y, p.x, p.y) < (s.r + p.r * 0.7) ** 2) {
                if (this.timers.invincible > 0) {
                    this.spark(s.x, s.y, s.color, 5);
                } else {
                    this.hurtPlayer(this.boss || { name: 'a stray curse', shape: 'circle', color: s.color, size: 12 });
                }
                s.life = 0;
            }
        }
        this.enemyShots = this.enemyShots.filter(s => s.life > 0);
    }

    bossDefeated(b) {
        this.boss = null;
        this.bossesSlain++;
        this.el.bossBar.hidden = true;
        const bonus = 300 * this.bossCount;
        this.score += bonus;
        this.hitStop = 28;
        this.shake(26);
        this.flash = { color: '255,255,255', t: 20, max: 20 };
        for (let i = 0; i < 4; i++) this.burst(b.x, b.y, [b.boss.color, b.boss.accent, '#ffffff', '#ffd60a'][i], 30, 8);
        this.ring(b.x, b.y, 200, b.boss.accent, 40);
        this.floater(b.x, b.y - b.size - 10, `BOSS SLAIN +${bonus}`, '#ffd60a', 30);
        this.enemyShots = [];
        Sfx.play('bossDeath', { volume: 1, rate: 0.7 });
        Sfx.play('boom', { volume: 0.8, rate: 0.7 });
        Sfx.arpeggio([523, 659, 784, 1046, 1318], 0.09, { type: 'triangle', volume: 0.12 });
        this.spawnPowerup(b.x - 30, b.y, 'heart');
        const timed = TIMED_POWERUPS.slice().sort(() => Math.random() - 0.5);
        this.spawnPowerup(b.x + 30, b.y, timed[0]);
        this.spawnPowerup(b.x, b.y + 30, timed[1]);
        this.pendingReward = true;
    }

    // ------------------------------------------------------------------ powerups

    spawnPowerup(x, y, type) {
        if (!type) {
            const keys = Object.keys(POWERUPS);
            type = keys[Math.floor(Math.random() * keys.length)];
        }
        this.powerups.push({ x: U.clamp(x, 20, this.W - 20), y: U.clamp(y, 20, this.H - 20), type, life: 720, t: 0 });
    }

    updatePowerups() {
        const p = this.player;
        TIMED_POWERUPS.forEach(t => {
            if (this.timers[t] > 0) {
                this.timers[t]--;
                if (this.timers[t] === 0) this.floater(p.x, p.y - 36, `${POWERUPS[t].name} over`, '#cccccc', 14);
            }
        });
        for (const pu of this.powerups) {
            pu.t++;
            pu.life--;
            const d2 = U.distanceSquared(p.x, p.y, pu.x, pu.y);
            if (d2 < (p.r + 26) ** 2) {
                this.collectPowerup(pu);
                pu.life = 0;
            } else if (d2 < 70 * 70) {
                // Gentle pull once you're close, so pickups feel snappy.
                pu.x += (p.x - pu.x) * 0.08;
                pu.y += (p.y - pu.y) * 0.08;
            }
        }
        this.powerups = this.powerups.filter(pu => pu.life > 0);
    }

    collectPowerup(pu) {
        const def = POWERUPS[pu.type];
        const p = this.player;
        this.ring(pu.x, pu.y, 40, def.color, 18);
        this.burst(pu.x, pu.y, def.color, 14, 4);
        if (def.timed) {
            this.timers[pu.type] += this.powerupDuration;
            this.floater(p.x, p.y - 36, def.name.toUpperCase(), def.color, 22);
            Sfx.play('powerup', { volume: 0.5 });
        } else if (pu.type === 'heart') {
            if (p.hp < p.maxHp) {
                p.hp++;
                this.floater(p.x, p.y - 36, '+❤️', '#ff6b8a', 22);
            } else {
                const bonus = 50 * this.level;
                this.score += bonus;
                this.floater(p.x, p.y - 36, `+${bonus}`, '#ff6b8a', 20);
            }
            Sfx.play('powerup', { volume: 0.5, rate: 1.2 });
        } else if (pu.type === 'bomb') {
            this.activateBomb();
        }
    }

    activateBomb() {
        for (const m of this.monsters) {
            if (m.dead) continue;
            const n = U.normalizeVector(m.x - this.player.x, m.y - this.player.y);
            this.damageMonster(m, 8 * this.damageMult, { kx: n.x * 10, ky: n.y * 10 });
        }
        this.enemyShots = [];
        this.flash = { color: '255,60,30', t: 40, max: 40 };
        this.ring(this.player.x, this.player.y, Math.max(this.W, this.H), '#ff6b35', 36);
        this.shake(18);
        Sfx.play('boom', { volume: 0.9 });
    }

    // ------------------------------------------------------------------ combo / xp / levels

    updateCombo() {
        if (this.comboTimer > 0) {
            this.comboTimer--;
            if (this.comboTimer === 0) this.combo = 0;
        }
        if (this.comboPop > 0) this.comboPop = Math.max(0, this.comboPop - 0.06);
    }

    gainXp(amount) {
        this.xp += amount;
        while (this.xp >= U.calculateLevelThreshold(this.level)) {
            this.level++;
            this.pendingLevels++;
            this.bgKey = null;
            const unlocked = WEAPON_ORDER.find(w => WEAPONS[w].unlock === this.level);
            if (unlocked) {
                this.unlockedNow = unlocked;
            }
            if (U.isBossLevel(this.level)) this.bossQueue++;
        }
    }

    levelProgress() {
        const prev = this.level > 1 ? U.calculateLevelThreshold(this.level - 1) : 0;
        const next = U.calculateLevelThreshold(this.level);
        return U.clamp((this.xp - prev) / (next - prev), 0, 1);
    }

    availableCards() {
        const pool = UPGRADES.filter(u => this.stack(u.id) < u.max && (!u.weapon || this.isUnlocked(u.weapon)))
            .filter(u => u.id !== 'vitality' || this.player.maxHp < 6)
            .map(u => ({ ...u, weight: u.weapon === this.weapon ? 1.6 : 1 }));
        return pool;
    }

    cardHeader(mode) {
        if (this.headerShown) return;
        this.headerShown = true;
        if (mode === 'level') {
            this.el.levelupTitle.textContent = `LEVEL ${this.level - this.pendingLevels + 1}!`;
            const unlock = this.unlockedNow;
            this.el.levelupSub.innerHTML = unlock
                ? `New weapon unlocked: <b>${WEAPONS[unlock].icon} ${WEAPONS[unlock].name}</b> — ${this.isTouch ? 'tap its slot' : `press ${WEAPON_ORDER.indexOf(unlock) + 1} or Space`}`
                : 'Choose an upgrade';
            this.unlockedNow = null;
            Sfx.play('levelUp', { volume: 0.6 });
        } else {
            this.el.levelupTitle.textContent = 'BOSS TREASURE';
            this.el.levelupSub.textContent = 'Claim your reward';
            Sfx.arpeggio([523, 659, 784], 0.08, { type: 'triangle', volume: 0.1 });
        }
    }

    beginCards(mode) {
        // Back-to-back level-ups skip the transition; the first one already set the scene.
        if (performance.now() - (this.cardsClosedAt || 0) < 400) this.openCards(mode);
        else this.startBurn(mode);
    }

    // ---- burning-film transition: the last frame burns away and reveals the new level underneath

    startBurn(mode) {
        const c = this.canvas;
        const k = Math.max(4, Math.ceil(c.width / 320));
        const mw = Math.ceil(c.width / k);
        const mh = Math.ceil(c.height / k);
        const mk = () => {
            const cv = document.createElement('canvas');
            cv.width = mw;
            cv.height = mh;
            const cx = cv.getContext('2d');
            return { cv, cx, img: cx.createImageData(mw, mh) };
        };
        const b = this.burn = { mode, t0: performance.now(), mw, mh, k, mask: mk(), char: mk(), glow: mk(), embers: [], intro: false };
        for (let i = 0; i < mw * mh; i++) {
            b.char.img.data[i * 4] = 28;
            b.char.img.data[i * 4 + 1] = 10;
        }
        // Composite at <=1280px / ~0.75MP and upscale once per frame: cheap even on 4K / high-DPI screens.
        const rs = Math.min(1, 1280 / c.width, Math.sqrt(750000 / (c.width * c.height)));
        const rw = Math.round(c.width * rs);
        const rh = Math.round(c.height * rs);
        b.snap = document.createElement('canvas');
        b.snap.width = rw;
        b.snap.height = rh;
        b.snap.getContext('2d').drawImage(c, 0, 0, rw, rh); // canvas still shows the last frame of the old level
        b.film = document.createElement('canvas');
        b.film.width = rw;
        b.film.height = rh;
        b.field = Game.burnField(mw, mh);
        this.headerShown = false;
        this.state = 'transition';
        this.releaseStick();
        Sfx.crackle(BURN_MS / 1000);
        Sfx.tone(200, { duration: 0.7, type: 'sine', volume: 0.12, slide: -140 });
    }

    // Normalized burn order per low-res cell: holes start at a few ignition points and spread with noise.
    static burnField(w, h) {
        const smooth = t => t * t * (3 - 2 * t);
        const octave = cell => {
            const gw = Math.ceil(w / cell) + 2;
            const gh = Math.ceil(h / cell) + 2;
            const g = new Float32Array(gw * gh).map(() => Math.random());
            const out = new Float32Array(w * h);
            for (let y = 0; y < h; y++) {
                const fy = y / cell;
                const iy = Math.floor(fy);
                const ty = smooth(fy - iy);
                for (let x = 0; x < w; x++) {
                    const fx = x / cell;
                    const ix = Math.floor(fx);
                    const tx = smooth(fx - ix);
                    const i = iy * gw + ix;
                    const top = g[i] + (g[i + 1] - g[i]) * tx;
                    const bot = g[i + gw] + (g[i + gw + 1] - g[i + gw]) * tx;
                    out[y * w + x] = top + (bot - top) * ty;
                }
            }
            return out;
        };
        const octs = [[w / 3, 0.5], [w / 7, 0.28], [w / 16, 0.14], [w / 40, 0.08]].map(([cell, wt]) => [octave(Math.max(2, cell)), wt]);
        const sparks = Array.from({ length: 3 }, () => ({ x: w * (0.15 + Math.random() * 0.7), y: h * (0.15 + Math.random() * 0.7) }));
        const diag = Math.hypot(w, h);
        const field = new Float32Array(w * h);
        let min = Infinity;
        let max = -Infinity;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = y * w + x;
                let n = 0;
                for (const [o, wt] of octs) n += o[i] * wt;
                let d = Infinity;
                for (const s of sparks) d = Math.min(d, Math.hypot(x - s.x, y - s.y));
                const v = 0.55 * (d / diag) * 2 + 0.45 * n;
                field[i] = v;
                if (v < min) min = v;
                if (v > max) max = v;
            }
        }
        for (let i = 0; i < field.length; i++) field[i] = (field[i] - min) / (max - min);
        return field;
    }

    drawBurn(now, dt) {
        const b = this.burn;
        if (!b) return;
        const p = U.clamp((now - b.t0) / BURN_MS, 0, 1);
        const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        const t = -0.06 + 1.1 * e; // burn threshold sweeps through the field (done at ~80%, then a short hold)
        const A = b.mask.img.data;
        const C = b.char.img.data;
        const G = b.glow.img.data;
        const f = b.field;
        for (let i = 0, j = 3; i < f.length; i++, j += 4) {
            const d = f[i] - t;
            const alpha = d <= 0 ? 0 : d >= 0.02 ? 1 : d / 0.02;
            A[j] = alpha * 255;
            C[j] = d > 0 && d < 0.12 ? (1 - d / 0.12) * 230 * alpha : 0;
            const gd = Math.abs(d - 0.004);
            const g = gd < 0.032 ? 1 - gd / 0.032 : 0;
            G[j - 3] = 255;
            G[j - 2] = 70 + 185 * g * g;
            G[j - 1] = 20 + 160 * g * g * g;
            G[j] = g * 255;
        }
        b.mask.cx.putImageData(b.mask.img, 0, 0);
        b.char.cx.putImageData(b.char.img, 0, 0);
        b.glow.cx.putImageData(b.glow.img, 0, 0);

        const rw = b.film.width;
        const rh = b.film.height;
        const fc = b.film.getContext('2d');
        fc.globalCompositeOperation = 'copy';
        fc.drawImage(b.snap, 0, 0);
        fc.globalCompositeOperation = 'source-atop';
        fc.fillStyle = `rgba(255,150,60,${0.1 * e + Math.random() * 0.04})`; // film heats up and flickers
        fc.fillRect(0, 0, rw, rh);
        fc.drawImage(b.char.cv, 0, 0, rw, rh);
        fc.globalCompositeOperation = 'destination-in';
        fc.drawImage(b.mask.cv, 0, 0, rw, rh);
        fc.globalCompositeOperation = 'lighter'; // glowing edge straddles film and the holes
        fc.drawImage(b.glow.cv, 0, 0, rw, rh);
        fc.globalCompositeOperation = 'source-over';

        const ctx = this.ctx;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(b.film, 0, 0, this.canvas.width, this.canvas.height);
        ctx.globalCompositeOperation = 'lighter';

        // Embers flying off the burning edge
        for (let n = 0; n < 50 && p < 0.92; n++) {
            const i = Math.floor(Math.random() * f.length);
            if (Math.abs(f[i] - t) < 0.015) {
                b.embers.push({
                    x: ((i % b.mw) + Math.random()) * b.k, y: (Math.floor(i / b.mw) + Math.random()) * b.k,
                    vx: (Math.random() - 0.5) * 40 * this.dpr, vy: -(30 + Math.random() * 90) * this.dpr,
                    life: 0.4 + Math.random() * 0.6, max: 1, r: (1 + Math.random() * 2) * this.dpr
                });
            }
        }
        for (const em of b.embers) {
            em.x += em.vx * dt;
            em.y += em.vy * dt;
            em.vy -= 30 * dt * this.dpr;
            em.life -= dt;
            const a = U.clamp(em.life / 0.6, 0, 1);
            ctx.fillStyle = `rgba(255,${150 + Math.floor(Math.random() * 80)},60,${a})`;
            ctx.beginPath();
            ctx.arc(em.x, em.y, em.r, 0, TAU);
            ctx.fill();
        }
        b.embers = b.embers.filter(em => em.life > 0);
        ctx.restore();

        if (p >= 0.45 && !b.intro) {
            b.intro = true;
            this.el.levelup.classList.add('intro');
            this.prepareCards(b.mode);
            this.setOverlay('levelup');
        }
        if (p >= 1) this.finishBurn();
    }

    finishBurn() {
        const b = this.burn;
        if (!b) return;
        this.burn = null;
        if (!b.intro) this.prepareCards(b.mode);
        this.revealCards();
    }

    openCards(mode) {
        this.el.levelup.classList.remove('intro');
        this.prepareCards(mode);
        this.revealCards();
    }

    revealCards() {
        this.el.levelup.classList.remove('intro'); // cards deal in (CSS animation starts now)
        this.setOverlay('levelup');
        this.state = 'levelup';
        this.cardsReadyAt = performance.now() + 450;
        this.headerShown = false;
    }

    prepareCards(mode) {
        const pool = this.availableCards();
        let cards = U.pickWeightedUnique(pool, 3);
        while (cards.length < 3) cards.push(FALLBACK_CARDS[cards.length % 2 === 0 ? 0 : 1]);
        this.cardChoices = cards;
        this.cardMode = mode;
        this.cardHeader(mode);

        this.el.cards.innerHTML = cards.map((c, i) => {
            const rank = this.stack(c.id);
            const pips = Number.isFinite(c.max)
                ? `<div class="pips">${Array.from({ length: c.max }, (_, k) => `<i class="${k < rank ? 'on' : k === rank ? 'next' : ''}"></i>`).join('')}</div>`
                : '';
            const tag = c.weapon ? `<span class="tag">${WEAPONS[c.weapon].icon} ${WEAPONS[c.weapon].name}</span>` : '';
            return `<button class="card" data-i="${i}" style="--d:${i * 70}ms"><span class="num">${i + 1}</span>` +
                `<span class="cicon">${c.icon}</span><span class="cname">${c.name}</span>${tag}` +
                `<span class="cdesc">${c.desc}</span>${pips}</button>`;
        }).join('');
        this.el.cards.querySelectorAll('.card').forEach(btn =>
            btn.addEventListener('click', () => this.chooseCard(Number(btn.dataset.i))));
    }

    chooseCard(i) {
        if (this.state !== 'levelup' || performance.now() < this.cardsReadyAt) return;
        const card = this.cardChoices[i];
        if (!card) return;
        this.applyCard(card);
        Sfx.arpeggio([659, 880], 0.06, { type: 'triangle', volume: 0.1 });
        if (this.cardMode === 'level') this.pendingLevels--;
        else this.pendingReward = false;
        this.state = 'playing';
        this.setOverlay(null);
        this.lastTime = performance.now();
        this.cardsClosedAt = performance.now();
        this.floater(this.player.x, this.player.y - 40, `${card.icon} ${card.name}`, '#ffffff', 20);
    }

    applyCard(card) {
        const p = this.player;
        if (card.id === 'treasure') {
            this.score += 150 * this.level;
            return;
        }
        if (card.id === 'feast') {
            p.hp = p.maxHp;
            return;
        }
        this.stacks[card.id] = this.stack(card.id) + 1;
        if (card.id === 'vitality') {
            p.maxHp++;
            p.hp = Math.min(p.maxHp, p.hp + 1);
        }
    }

    // ------------------------------------------------------------------ effects

    shake(amount) {
        this.shakeAmt = Math.min(30, Math.max(this.shakeAmt, amount));
    }

    updateShake() {
        if (this.shakeAmt > 0.2) {
            this.shakeX = (Math.random() - 0.5) * this.shakeAmt;
            this.shakeY = (Math.random() - 0.5) * this.shakeAmt;
            this.shakeAmt *= 0.86;
        } else {
            this.shakeAmt = this.shakeX = this.shakeY = 0;
        }
        if (this.flash.t > 0) this.flash.t--;
        if (this.hurtFlash > 0) this.hurtFlash = Math.max(0, this.hurtFlash - 0.03);
    }

    particle(p) {
        if (this.particles.length > 800 && p.kind !== 'ring') return;
        this.particles.push({ drag: 0.92, grow: 0, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 0.4, ...p, max: p.life });
    }

    burst(x, y, color, count, speed) {
        for (let i = 0; i < count; i++) {
            const a = Math.random() * TAU;
            const s = speed * (0.3 + Math.random() * 0.9);
            this.particle({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 22 + Math.random() * 22, size: 2 + Math.random() * 4, color, kind: Math.random() < 0.5 ? 'chunk' : 'spark' });
        }
    }

    spark(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            const a = Math.random() * TAU;
            this.particle({ x, y, vx: Math.cos(a) * 3, vy: Math.sin(a) * 3, life: 10 + Math.random() * 8, size: 2, color, kind: 'spark' });
        }
    }

    ring(x, y, radius, color, life) {
        this.particle({ x, y, vx: 0, vy: 0, life, size: radius, color, kind: 'ring', drag: 1 });
    }

    floater(x, y, text, color, size) {
        if (this.floaters.length > 50) this.floaters.shift();
        const margin = Math.min(this.W / 2, text.length * size * 0.3 + 6);
        this.floaters.push({ x: U.clamp(x, margin, this.W - margin), y: U.clamp(y, size, this.H - size), text, color, size, life: 50, max: 50 });
    }

    banner(title, sub = '', cls = '') {
        const el = this.el.banner;
        el.className = '';
        el.innerHTML = `<div class="title">${title}</div>${sub ? `<div class="sub">${sub}</div>` : ''}`;
        void el.offsetWidth; // restart the CSS animation
        el.className = `show ${cls}`;
    }

    updateParticles() {
        for (const p of this.particles) {
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= p.drag;
            p.vy *= p.drag;
            p.rot += p.vr;
            p.size = Math.max(0, p.size + p.grow);
            p.life--;
        }
        this.particles = this.particles.filter(p => p.life > 0);
        for (const f of this.floaters) {
            f.y -= 0.8 * (f.life / f.max) + 0.2;
            f.life--;
        }
        this.floaters = this.floaters.filter(f => f.life > 0);
        for (const e of this.explosions) e.t++;
        this.explosions = this.explosions.filter(e => e.t < e.max);
    }

    // ------------------------------------------------------------------ rendering

    render() {
        const ctx = this.ctx;
        const k = this.dpr * this.scale;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.drawBackground(ctx);
        ctx.setTransform(k, 0, 0, k, 0, 0);
        ctx.translate(this.shakeX, this.shakeY);

        if (this.state === 'menu') {
            this.attract.forEach(m => this.drawMonster(ctx, m));
            return;
        }

        this.drawEdgeWarnings(ctx);
        this.powerups.forEach(pu => this.drawPowerup(ctx, pu));
        this.explosions.forEach(e => this.drawExplosion(ctx, e));
        this.grenades.forEach(g => this.drawGrenade(ctx, g));
        this.monsters.forEach(m => this.drawShadow(ctx, m.x, m.y + m.size * 0.85, m.size));
        this.monsters.forEach(m => (m.boss ? this.drawBoss(ctx, m) : this.drawMonster(ctx, m)));
        if (this.weapon === 'sword' && this.state !== 'dying') this.drawBlades(ctx);
        if (this.state !== 'dying' && this.state !== 'gameover') this.drawPlayer(ctx);
        this.drawProjectiles(ctx);
        this.drawParticles(ctx);
        this.drawFloaters(ctx);
        this.drawScreenFx(ctx);
        this.drawStick(ctx);
    }

    drawBackground(ctx) {
        const key = `${this.canvas.width}x${this.canvas.height}:${this.level}`;
        if (this.bgKey !== key) {
            this.bgKey = key;
            const bg = this.bgCanvas || (this.bgCanvas = document.createElement('canvas'));
            bg.width = this.canvas.width;
            bg.height = this.canvas.height;
            const g = bg.getContext('2d');
            const k = this.dpr * this.scale;
            const hue = ARENA_HUES[(this.level - 1) % ARENA_HUES.length];
            const light = Math.max(32, 64 - (this.level - 1) * 0.9);
            g.fillStyle = `hsl(${hue}, 42%, ${light}%)`;
            g.fillRect(0, 0, bg.width, bg.height);
            const tile = 40 * k;
            g.fillStyle = `hsla(${hue}, 45%, ${light + 4}%, 0.55)`;
            for (let y = 0; y < bg.height; y += tile) {
                for (let x = ((y / tile) % 2) * tile; x < bg.width; x += tile * 2) g.fillRect(x, y, tile, tile);
            }
            const vg = g.createRadialGradient(bg.width / 2, bg.height / 2, Math.min(bg.width, bg.height) * 0.3, bg.width / 2, bg.height / 2, Math.hypot(bg.width, bg.height) * 0.6);
            vg.addColorStop(0, 'rgba(0,0,0,0)');
            vg.addColorStop(1, 'rgba(0,0,0,0.42)');
            g.fillStyle = vg;
            g.fillRect(0, 0, bg.width, bg.height);
        }
        ctx.drawImage(this.bgCanvas, 0, 0);
    }

    drawShadow(ctx, x, y, size) {
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.beginPath();
        ctx.ellipse(x, y, size * 0.9, size * 0.35, 0, 0, TAU);
        ctx.fill();
    }

    drawEdgeWarnings(ctx) {
        if (!this.edgeWarn) return;
        const a = 0.35 * Math.abs(Math.sin(this.frameNo * 0.25));
        const g = { 0: [0, 0, this.W, 10], 1: [this.W - 10, 0, 10, this.H], 2: [0, this.H - 10, this.W, 10], 3: [0, 0, 10, this.H] }[this.edgeWarn.side];
        ctx.fillStyle = `rgba(255,80,80,${a})`;
        ctx.fillRect(...g);
    }

    drawPowerup(ctx, pu) {
        const def = POWERUPS[pu.type];
        if (pu.life < 180 && Math.floor(pu.life / 8) % 2 === 0) return;
        const bob = Math.sin(pu.t * 0.08) * 3;
        const pulse = 1 + Math.sin(pu.t * 0.15) * 0.1;
        this.drawShadow(ctx, pu.x, pu.y + 14, 10);
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = def.color;
        ctx.beginPath();
        ctx.arc(pu.x, pu.y + bob, 17 * pulse, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.font = `22px ${EMOJI_FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#000';
        ctx.fillText(def.emoji, pu.x, pu.y + bob + 1);
    }

    drawExplosion(ctx, e) {
        const t = e.t / e.max;
        const r = e.r * (0.4 + 0.6 * Math.sqrt(t));
        ctx.save();
        ctx.translate(e.x, e.y);
        for (let layer = 0; layer < 3; layer++) {
            const lr = r * (1 - layer * 0.22);
            ctx.fillStyle = `rgba(255,${80 + layer * 70},${layer * 30},${(1 - t) * (0.75 - layer * 0.15)})`;
            ctx.beginPath();
            for (let i = 0; i < 16; i++) {
                const a = (i * Math.PI) / 8 + layer * 0.2;
                const rr = i % 2 === 0 ? lr : lr * 0.55;
                ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
            }
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
    }

    drawGrenade(ctx, g) {
        this.drawShadow(ctx, g.x, g.y + 6, 5);
        ctx.save();
        ctx.translate(g.x, g.y);
        ctx.rotate(g.spin);
        ctx.fillStyle = '#2d6a4f';
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#95d5b2';
        ctx.fillRect(-2, -8, 4, 4);
        ctx.restore();
        const urgent = g.timer < 24;
        ctx.strokeStyle = urgent ? (Math.floor(g.timer / 3) % 2 ? '#ff3b30' : '#fff') : '#ffd60a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(g.x, g.y, 9, -Math.PI / 2, -Math.PI / 2 + TAU * (g.timer / 64));
        ctx.stroke();
    }

    drawMonster(ctx, m) {
        const squash = 1 + Math.sin(m.phase) * 0.06;
        const fill = m.flash > 0 ? '#ffffff' : m.color;
        ctx.save();
        ctx.translate(m.x, m.y);
        ctx.scale(1 / squash, squash);
        if (m.shape === 'aura') {
            const pulse = 1.35 + Math.sin(m.phase * 0.7) * 0.15;
            ctx.globalAlpha = 0.25;
            ctx.fillStyle = m.color;
            ctx.beginPath();
            ctx.arc(0, 0, m.size * pulse, 0, TAU);
            ctx.fill();
            ctx.globalAlpha = 0.9;
            ctx.strokeStyle = m.color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, m.size * 1.5, 0, TAU);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
        Game.drawShape(ctx, m.shape, m.size, fill);
        if (this.timers && this.timers.freeze > 0 && !m.boss) {
            ctx.globalAlpha = 0.35;
            ctx.fillStyle = '#bfefff';
            ctx.beginPath();
            ctx.arc(0, 0, m.size, 0, TAU);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        this.drawEyes(ctx, m, m.size);
        ctx.restore();

        if (m.hp < m.maxHp && !m.dead) {
            const w = Math.min(m.size * 2.4, 6 * m.maxHp + 8);
            const y = m.y - m.size * 1.25 - 8;
            const pct = U.clamp(m.hp / m.maxHp, 0, 1);
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(m.x - w / 2 - 1, y - 1, w + 2, 6);
            ctx.fillStyle = pct > 0.5 ? '#4cd964' : pct > 0.25 ? '#ffcc00' : '#ff3b30';
            ctx.fillRect(m.x - w / 2, y, w * pct, 4);
        }
    }

    drawEyes(ctx, m, size) {
        const big = size > 16;
        const eyeSize = big ? Math.min(6, size * 0.2) : Math.max(2.5, size * 0.3);
        const off = big ? size * 0.38 : size * 0.45;
        const ey = -off * 0.7;
        if (m.spawnT > 0 && !m.boss) {
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-off - eyeSize, ey);
            ctx.lineTo(-off + eyeSize, ey);
            ctx.moveTo(off - eyeSize, ey);
            ctx.lineTo(off + eyeSize, ey);
            ctx.stroke();
            return;
        }
        const look = this.player && this.state !== 'menu'
            ? U.normalizeVector(this.player.x - m.x, this.player.y - m.y)
            : { x: Math.cos(m.dir || 0), y: Math.sin(m.dir || 0) };
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(-off, ey, eyeSize, 0, TAU);
        ctx.arc(off, ey, eyeSize, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(-off + look.x * eyeSize * 0.4, ey + look.y * eyeSize * 0.4, eyeSize * 0.55, 0, TAU);
        ctx.arc(off + look.x * eyeSize * 0.4, ey + look.y * eyeSize * 0.4, eyeSize * 0.55, 0, TAU);
        ctx.fill();
    }

    static drawShape(ctx, shape, size, fill) {
        ctx.fillStyle = fill;
        ctx.strokeStyle = 'rgba(0,0,0,0.75)';
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        const poly = points => {
            ctx.beginPath();
            points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        };
        const circle = (r = size) => {
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, TAU);
            ctx.fill();
            ctx.stroke();
        };
        switch (shape) {
            case 'square':
                ctx.beginPath();
                ctx.roundRect ? ctx.roundRect(-size, -size, size * 2, size * 2, size * 0.3) : ctx.rect(-size, -size, size * 2, size * 2);
                ctx.fill();
                ctx.stroke();
                break;
            case 'triangle':
                poly([[0, -size * 1.1], [-size, size], [size, size]]);
                break;
            case 'diamond':
                poly([[0, -size * 1.15], [size, 0], [0, size * 1.15], [-size, 0]]);
                break;
            case 'star': {
                const pts = [];
                for (let i = 0; i < 10; i++) {
                    const a = (i * Math.PI) / 5 - Math.PI / 2;
                    const r = i % 2 === 0 ? size * 1.15 : size * 0.55;
                    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
                }
                poly(pts);
                break;
            }
            case 'hexagon':
                poly(Array.from({ length: 6 }, (_, i) => [Math.cos((i * Math.PI) / 3) * size, Math.sin((i * Math.PI) / 3) * size]));
                break;
            case 'cross': {
                const h = size * 0.55;
                poly([[-h, -size], [h, -size], [h, -h], [size, -h], [size, h], [h, h], [h, size], [-h, size], [-h, h], [-size, h], [-size, -h], [-h, -h]]);
                break;
            }
            case 'spiky':
                for (let i = 0; i < 8; i++) {
                    const a = (i * TAU) / 8;
                    poly([[Math.cos(a - 0.3) * size, Math.sin(a - 0.3) * size], [Math.cos(a) * (size + 9), Math.sin(a) * (size + 9)], [Math.cos(a + 0.3) * size, Math.sin(a + 0.3) * size]]);
                }
                circle();
                break;
            case 'giant':
                circle();
                ctx.strokeStyle = '#FFD700';
                for (let i = 0; i < 6; i++) {
                    const a = (i * TAU) / 6;
                    ctx.beginPath();
                    ctx.arc(Math.cos(a) * (size + 4), Math.sin(a) * (size + 4), 3, 0, TAU);
                    ctx.stroke();
                }
                break;
            case 'behemoth':
                circle();
                ctx.fillStyle = 'rgba(0,0,0,0.25)';
                for (let i = 0; i < 4; i++) {
                    const a = (i * TAU) / 4 + Math.PI / 4;
                    ctx.beginPath();
                    ctx.arc(Math.cos(a) * size * 0.62, Math.sin(a) * size * 0.62, size * 0.28, 0, TAU);
                    ctx.fill();
                }
                break;
            default:
                circle();
        }
    }

    drawBoss(ctx, b) {
        const def = b.boss;
        const fill = b.flash > 0 ? '#ffffff' : def.color;
        const s = b.size;
        ctx.save();
        ctx.translate(b.x, b.y);
        if (b.mode === 'windup') {
            ctx.translate((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3);
            ctx.save();
            ctx.globalAlpha = 0.25 + 0.25 * Math.sin(b.modeT * 0.6);
            ctx.strokeStyle = '#ff3b30';
            ctx.lineWidth = s * 1.4;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(b.dashX * 340, b.dashY * 340);
            ctx.stroke();
            ctx.restore();
        }
        // Menacing aura
        ctx.globalAlpha = 0.22 + (b.enraged ? 0.15 * Math.sin(b.t * 0.3) : 0);
        ctx.fillStyle = b.enraged ? '#ff3b30' : def.accent;
        ctx.beginPath();
        ctx.arc(0, 0, s * 1.45, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.lineWidth = 3;

        if (def.pattern === 'charge') {
            ctx.fillStyle = def.accent;
            for (let i = 0; i < 10; i++) {
                const a = (i * TAU) / 10 + b.t * 0.01;
                ctx.beginPath();
                ctx.moveTo(Math.cos(a - 0.22) * s, Math.sin(a - 0.22) * s);
                ctx.lineTo(Math.cos(a) * (s + 14), Math.sin(a) * (s + 14));
                ctx.lineTo(Math.cos(a + 0.22) * s, Math.sin(a + 0.22) * s);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            }
            Game.drawShape(ctx, 'circle', s, fill);
        } else if (def.pattern === 'rings') {
            ctx.save();
            ctx.rotate(b.t * 0.02);
            Game.drawShape(ctx, 'hexagon', s, fill);
            ctx.restore();
            ctx.fillStyle = def.accent;
            for (let i = 0; i < 5; i++) {
                const a = (i * TAU) / 5 - b.t * 0.04;
                ctx.beginPath();
                ctx.arc(Math.cos(a) * (s + 16), Math.sin(a) * (s + 16), 5, 0, TAU);
                ctx.fill();
            }
            // Witch hat
            ctx.fillStyle = '#2c2c54';
            ctx.beginPath();
            ctx.moveTo(-s * 0.8, -s * 0.55);
            ctx.lineTo(s * 0.8, -s * 0.55);
            ctx.lineTo(s * 0.15, -s * 1.7);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        } else if (def.pattern === 'summon') {
            ctx.strokeStyle = '#0b3d20';
            ctx.lineWidth = 4;
            for (let i = 0; i < 8; i++) {
                const a = (i * TAU) / 8 + Math.sin(b.t * 0.15 + i) * 0.15;
                ctx.beginPath();
                ctx.moveTo(Math.cos(a) * s * 0.8, Math.sin(a) * s * 0.8);
                ctx.quadraticCurveTo(Math.cos(a + 0.3) * s * 1.5, Math.sin(a + 0.3) * s * 1.5, Math.cos(a) * s * 1.7, Math.sin(a) * s * 1.7);
                ctx.stroke();
            }
            Game.drawShape(ctx, 'circle', s, fill);
            ctx.fillStyle = def.accent;
            ctx.beginPath();
            ctx.ellipse(0, s * 0.35, s * 0.55, s * 0.3, 0, 0, TAU);
            ctx.fill();
        } else {
            for (let i = 0; i < 3; i++) {
                ctx.strokeStyle = `rgba(231,76,60,${0.6 - i * 0.15})`;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(0, 0, s + 6 + i * 7, b.t * 0.05 * (i + 1), b.t * 0.05 * (i + 1) + Math.PI * 1.2);
                ctx.stroke();
            }
            Game.drawShape(ctx, 'circle', s, fill);
            // Maw
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(0, s * 0.25, s * 0.55, 0, Math.PI);
            ctx.fill();
            ctx.fillStyle = '#fff';
            for (let i = 0; i < 6; i++) {
                const x = -s * 0.45 + i * s * 0.18;
                ctx.beginPath();
                ctx.moveTo(x, s * 0.25);
                ctx.lineTo(x + s * 0.09, s * 0.42);
                ctx.lineTo(x + s * 0.18, s * 0.25);
                ctx.fill();
            }
        }

        // Angry eyes
        const look = U.normalizeVector(this.player.x - b.x, this.player.y - b.y);
        const ex = s * 0.36;
        const ey = -s * 0.18;
        ctx.fillStyle = b.enraged ? '#ff3b30' : '#fff';
        ctx.beginPath();
        ctx.arc(-ex, ey, s * 0.17, 0, TAU);
        ctx.arc(ex, ey, s * 0.17, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(-ex + look.x * 3, ey + look.y * 3, s * 0.08, 0, TAU);
        ctx.arc(ex + look.x * 3, ey + look.y * 3, s * 0.08, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-ex - s * 0.2, ey - s * 0.3);
        ctx.lineTo(-ex + s * 0.15, ey - s * 0.15);
        ctx.moveTo(ex + s * 0.2, ey - s * 0.3);
        ctx.lineTo(ex - s * 0.15, ey - s * 0.15);
        ctx.stroke();
        ctx.restore();
    }

    drawBlades(ctx) {
        const p = this.player;
        const count = this.blades.count || 1;
        const radius = this.blades.radius || 46;
        // Motion trail
        ctx.globalAlpha = 0.18;
        ctx.strokeStyle = '#e8f4ff';
        ctx.lineWidth = radius * 0.5;
        for (let i = 0; i < count; i++) {
            const a = this.blades.angle + (i * TAU) / count;
            ctx.beginPath();
            ctx.arc(p.x, p.y, radius * 0.72, a - 0.6, a);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
        for (let i = 0; i < count; i++) {
            const a = this.blades.angle + (i * TAU) / count;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(a);
            ctx.fillStyle = '#cfd8dc';
            ctx.strokeStyle = '#607d8b';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(10, -3.5);
            ctx.lineTo(radius - 4, -2.5);
            ctx.lineTo(radius + 4, 0);
            ctx.lineTo(radius - 4, 2.5);
            ctx.lineTo(10, 3.5);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.strokeStyle = '#8d6e63';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(10, -7);
            ctx.lineTo(10, 7);
            ctx.stroke();
            ctx.restore();
        }
    }

    drawPlayer(ctx) {
        const p = this.player;
        if (p.iframes > 0 && Math.floor(p.iframes / 5) % 2 === 0) return;
        const giant = this.timers.invincible > 0;
        const size = p.r * 2.4 * (giant ? 1.8 : 1);
        const bob = p.moveT ? Math.abs(Math.sin(p.moveT * 0.25)) * -3 : Math.sin(this.frameNo * 0.06) * 1.2;
        this.drawShadow(ctx, p.x, p.y + size * 0.42, size * 0.4);
        if (giant) {
            ctx.globalAlpha = 0.3 + 0.15 * Math.sin(this.frameNo * 0.3);
            ctx.fillStyle = '#7CFC00';
            ctx.beginPath();
            ctx.arc(p.x, p.y, size * 0.6, 0, TAU);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        ctx.save();
        ctx.translate(p.x, p.y + bob);
        ctx.scale(-p.facing, 1); // the emoji faces left by default
        ctx.font = `${size}px ${EMOJI_FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#000'; // emoji glyphs inherit the fill alpha
        ctx.fillText('🧙‍♂️', 0, 0);
        ctx.restore();
        if (this.mouse.down && this.weapon !== 'missiles' && this.weapon !== 'sword') {
            ctx.strokeStyle = 'rgba(255,255,255,0.6)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(this.mouse.x, this.mouse.y, 8, 0, TAU);
            ctx.moveTo(this.mouse.x - 12, this.mouse.y);
            ctx.lineTo(this.mouse.x + 12, this.mouse.y);
            ctx.moveTo(this.mouse.x, this.mouse.y - 12);
            ctx.lineTo(this.mouse.x, this.mouse.y + 12);
            ctx.stroke();
        }
    }

    drawProjectiles(ctx) {
        ctx.fillStyle = '#ffe066';
        ctx.strokeStyle = 'rgba(255,170,0,0.6)';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        for (const b of this.bullets) {
            ctx.beginPath();
            ctx.moveTo(b.x - b.vx * 1.2, b.y - b.vy * 1.2);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r, 0, TAU);
            ctx.fill();
        }
        ctx.lineCap = 'butt';

        for (const ms of this.missiles) {
            ms.trail.forEach((t, i) => {
                ctx.globalAlpha = (i / ms.trail.length) * 0.5;
                ctx.fillStyle = '#ffb385';
                ctx.beginPath();
                ctx.arc(t.x, t.y, 1.5 + i * 0.25, 0, TAU);
                ctx.fill();
            });
            ctx.globalAlpha = 1;
            ctx.save();
            ctx.translate(ms.x, ms.y);
            ctx.rotate(ms.angle);
            ctx.fillStyle = '#ff4500';
            ctx.beginPath();
            ctx.ellipse(0, 0, 7, 3, 0, 0, TAU);
            ctx.fill();
            ctx.fillStyle = '#ffd60a';
            ctx.beginPath();
            ctx.moveTo(-6, 0);
            ctx.lineTo(-11 - Math.random() * 4, -2);
            ctx.lineTo(-11 - Math.random() * 4, 2);
            ctx.fill();
            ctx.restore();
        }

        for (const s of this.enemyShots) {
            ctx.globalAlpha = 0.35;
            ctx.fillStyle = s.color;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r * 1.8, 0, TAU);
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, TAU);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r * 0.45, 0, TAU);
            ctx.fill();
        }
    }

    drawParticles(ctx) {
        for (const p of this.particles) {
            const t = p.life / p.max;
            ctx.globalAlpha = Math.min(1, t * 1.5);
            if (p.kind === 'ring') {
                ctx.strokeStyle = p.color;
                ctx.lineWidth = 3 * t + 1;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * (1 - t * t), 0, TAU);
                ctx.stroke();
            } else if (p.kind === 'chunk') {
                ctx.fillStyle = p.color;
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rot);
                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
                ctx.restore();
            } else if (p.kind === 'flash') {
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * t, 0, TAU);
                ctx.fill();
            } else {
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * (p.kind === 'spark' ? t : 1), 0, TAU);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1;
    }

    drawFloaters(ctx) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        for (const f of this.floaters) {
            const t = f.life / f.max;
            const pop = t > 0.85 ? 1 + (t - 0.85) * 3 : 1;
            ctx.globalAlpha = Math.min(1, t * 2.5);
            ctx.font = `${Math.round(f.size * pop)}px ${DISPLAY_FONT}`;
            ctx.strokeStyle = 'rgba(0,0,0,0.75)';
            ctx.lineWidth = 4;
            ctx.strokeText(f.text, f.x, f.y);
            ctx.fillStyle = f.color;
            ctx.fillText(f.text, f.x, f.y);
        }
        ctx.globalAlpha = 1;
    }

    drawScreenFx(ctx) {
        const pad = 40;
        if (this.timers.freeze > 0) {
            ctx.fillStyle = 'rgba(180,230,255,0.12)';
            ctx.fillRect(-pad, -pad, this.W + pad * 2, this.H + pad * 2);
        }
        if (this.flash.t > 0) {
            ctx.fillStyle = `rgba(${this.flash.color},${(this.flash.t / this.flash.max) * 0.35})`;
            ctx.fillRect(-pad, -pad, this.W + pad * 2, this.H + pad * 2);
        }
        const lowHp = this.player.hp === 1 && this.state === 'playing' ? 0.25 + 0.15 * Math.sin(this.frameNo * 0.1) : 0;
        const danger = Math.max(this.hurtFlash, lowHp, this.bossWarning > 0 ? 0.3 + 0.3 * Math.sin(this.frameNo * 0.2) : 0);
        if (danger > 0) {
            const g = ctx.createRadialGradient(this.W / 2, this.H / 2, Math.min(this.W, this.H) * 0.35, this.W / 2, this.H / 2, Math.hypot(this.W, this.H) * 0.55);
            g.addColorStop(0, 'rgba(255,0,0,0)');
            g.addColorStop(1, `rgba(220,0,0,${danger * 0.55})`);
            ctx.fillStyle = g;
            ctx.fillRect(-pad, -pad, this.W + pad * 2, this.H + pad * 2);
        }
    }

    drawStick(ctx) {
        if (this.stick.id === null) return;
        const rect = this.canvas.getBoundingClientRect();
        const ax = (this.stick.ax - rect.left) / this.scale - this.shakeX;
        const ay = (this.stick.ay - rect.top) / this.scale - this.shakeY;
        const r = 55 / this.scale;
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(ax, ay, r, 0, TAU);
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(ax + this.stick.dx * r, ay + this.stick.dy * r, r * 0.4, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    // ------------------------------------------------------------------ HUD

    setText(key, el, value) {
        if (this.hud[key] !== value) {
            this.hud[key] = value;
            el.textContent = value;
        }
    }

    setHtml(key, el, value) {
        if (this.hud[key] !== value) {
            this.hud[key] = value;
            el.innerHTML = value;
        }
    }

    updateHud() {
        if (this.state === 'menu') return;
        const p = this.player;
        this.setHtml('hearts', this.el.hearts, p.maxHp > 8
            ? `❤️ <b>${p.hp}</b>`
            : Array.from({ length: p.maxHp }, (_, i) => `<span class="${i < p.hp ? 'full' : 'empty'}">${i < p.hp ? '❤️' : '🖤'}</span>`).join(''));
        this.setText('level', this.el.level, `LV ${this.level}`);
        this.el.xpFill.style.width = `${(this.levelProgress() * 100).toFixed(1)}%`;
        this.setText('score', this.el.score, this.score.toLocaleString());

        const mult = U.comboMultiplier(this.combo);
        this.el.combo.classList.toggle('show', this.combo >= 2);
        this.el.combo.dataset.tier = mult;
        this.setText('comboMult', this.el.comboMult, `×${mult}`);
        const next = U.nextComboTier(this.combo);
        this.setText('comboCount', this.el.comboCount, next ? `${this.combo} combo · ${next - this.combo} to ×${mult + 1}` : `${this.combo} combo · MAX`);
        this.el.comboFill.style.width = `${(this.comboTimer / this.comboWindow) * 100}%`;
        this.el.combo.style.transform = `translateX(-50%) scale(${1 + (this.comboPop || 0) * 0.25})`;

        const weaponState = WEAPON_ORDER.map(w => `${w}:${this.isUnlocked(w)}:${this.weapon === w}`).join('|');
        if (this.hud.weapons !== weaponState) {
            this.hud.weapons = weaponState;
            this.el.weapons.querySelectorAll('.slot').forEach(slot => {
                slot.classList.toggle('active', slot.dataset.w === this.weapon);
                slot.classList.toggle('locked', !this.isUnlocked(slot.dataset.w));
            });
            this.el.weaponBtn.textContent = WEAPONS[this.weapon].icon;
        }

        const active = TIMED_POWERUPS.filter(t => this.timers[t] > 0);
        this.setHtml('powerups', this.el.powerups, active.map(t =>
            `<span class="pu" style="--c:${POWERUPS[t].color}">${POWERUPS[t].emoji}<b>${Math.ceil(this.timers[t] / 60)}</b></span>`).join(''));

        if (this.boss) {
            const pct = U.clamp(this.boss.hp / this.boss.maxHp, 0, 1);
            this.bossTrailPct = Math.max(pct, this.bossTrailPct - 0.004);
            this.el.bossFill.style.width = `${pct * 100}%`;
            this.el.bossTrail.style.width = `${this.bossTrailPct * 100}%`;
        }
    }

    // ------------------------------------------------------------------ game over + leaderboard

    showGameOver() {
        this.state = 'gameover';
        this.timeScale = 1;
        this.el.bossBar.hidden = true;
        Sfx.playMusic('gameOver', 0.45);

        const killer = this.killer || { name: 'something', shape: 'circle', color: '#888', size: 12 };
        const icon = this.el.killerIcon.getContext('2d');
        icon.setTransform(1, 0, 0, 1, 0, 0);
        icon.clearRect(0, 0, 96, 96);
        icon.translate(48, 50);
        const size = killer.boss ? killer.boss.size : killer.size;
        const k = Math.min(2.2, 30 / size);
        icon.scale(k, k);
        if (killer.boss) {
            const fake = { ...killer, x: 0, y: 0, mode: 'fight', flash: 0 };
            const save = this.player;
            this.player = { x: 0, y: 80 };
            this.drawBoss(icon, fake);
            this.player = save;
        } else {
            Game.drawShape(icon, killer.shape === 'aura' ? 'circle' : killer.shape, size, killer.color);
            this.drawEyes(icon, { ...killer, spawnT: 0, dir: Math.PI / 2 }, size);
        }
        this.el.killedBy.textContent = `Slain by ${killer.boss ? killer.boss.name : killer.name}`;

        const stats = [
            ['Score', this.score.toLocaleString()],
            ['Level', this.level],
            ['Kills', this.kills],
            ['Best combo', this.bestCombo],
            ['Bosses', this.bossesSlain],
            ['Time', U.formatTime(this.time)]
        ];
        this.el.finalStats.innerHTML = stats.map(([k2, v]) => `<div><span>${k2}</span><b>${v}</b></div>`).join('');

        let best = 0;
        try {
            best = Number(localStorage.getItem('hunter.best') || 0);
            if (this.score > best) localStorage.setItem('hunter.best', String(this.score));
        } catch (e) { /* storage unavailable */ }
        this.el.newBest.hidden = !(this.score > best && this.score > 0);

        this.submitted = false;
        this.el.nameForm.hidden = this.score <= 0;
        this.el.submitStatus.textContent = '';
        this.el.finalBoard.innerHTML = '';
        this.el.finalBoardTitle.hidden = true;
        this.el.againBtn.hidden = this.score > 0;
        this.el.nameInput.value = Leaderboard.getName();
        this.setOverlay('gameover');
        if (this.score <= 0) {
            this.submitted = true;
            this.loadBoard(this.el.finalBoard, this.el.finalBoardTitle);
        } else if (!this.isTouch) {
            setTimeout(() => this.el.nameInput.focus(), 300);
        }
    }

    async submitScore() {
        if (this.submitted || this.submitting) return;
        const name = U.sanitizeName(this.el.nameInput.value);
        if (!name) {
            this.el.submitStatus.textContent = 'Enter a name first';
            this.el.nameInput.focus();
            return;
        }
        this.submitting = true;
        Leaderboard.setName(name);
        this.el.nameInput.blur();
        this.el.submitStatus.textContent = 'Saving…';
        const entry = {
            name, score: this.score, level: this.level, kills: this.kills,
            combo: this.bestCombo, bosses: this.bossesSlain, duration: Math.max(1, Math.round(this.time))
        };
        const runId = this.runId;
        const result = await Leaderboard.submit(entry, this.runToken);
        this.submitting = false;
        if (runId !== this.runId || this.state !== 'gameover') return; // player already moved on
        this.submitted = true;
        this.el.nameForm.hidden = true;
        this.el.againBtn.hidden = false;
        if (result.source === 'global') {
            this.el.submitStatus.textContent = `You placed #${result.rank} worldwide!`;
        } else {
            this.el.submitStatus.textContent = result.error === 'disabled'
                ? `Saved on this device (#${result.rank})`
                : result.rejected
                    ? `Saved on this device (#${result.rank}) — global board refused it: ${result.error}`
                    : `Saved on this device (#${result.rank}) — global board unreachable`;
        }
        this.renderBoard(this.el.finalBoard, this.el.finalBoardTitle, result.scores, result.source, { id: result.id, name, score: this.score });
        this.el.againBtn.focus();
    }

    skipSubmit() {
        this.submitted = true;
        this.el.nameForm.hidden = true;
        this.el.againBtn.hidden = false;
        this.loadBoard(this.el.finalBoard, this.el.finalBoardTitle);
        this.el.againBtn.focus();
    }

    async loadBoard(listEl, titleEl) {
        listEl.innerHTML = '<li class="muted">Loading…</li>';
        const { scores, source } = await Leaderboard.top(10);
        this.renderBoard(listEl, titleEl, scores, source);
    }

    renderBoard(listEl, titleEl, scores, source, mine) {
        titleEl.hidden = false;
        titleEl.textContent = source === 'global' ? '🏆 Top Hunters' : '🏆 Top Hunters (this device)';
        if (!scores.length) {
            listEl.innerHTML = '<li class="muted">No scores yet — be the first!</li>';
            return;
        }
        let marked = false;
        listEl.innerHTML = scores.slice(0, 10).map((s, i) => {
            const isMine = mine && !marked && ((mine.id && s.id === mine.id) || (!mine.id && s.name === mine.name && s.score === mine.score));
            if (isMine) marked = true;
            const name = String(s.name).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
            return `<li class="${isMine ? 'mine' : ''}"><span class="rank">${i + 1}</span><span class="name">${name}</span>` +
                `<span class="lvl">Lv ${Number(s.level) || 1}</span><span class="pts">${(Number(s.score) || 0).toLocaleString()}</span></li>`;
        }).join('');
    }
}

window.addEventListener('load', () => {
    window.game = new Game();
});
