/* Monster Hunter — core: Game class (constructor, loop, states, resize, input, platform). */

class Game {
    constructor() {
        // Version system (bumped by the pre-commit hook, see VERSION-README.md)
        this.version = "3.2.0";
        this.buildDate = "2026-10-22";

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
        Sfx.prewarm(Object.entries(MONSTER_TYPES).flatMap(([tier, list]) => list.map(t => [t.name, tier])));
        this.bindDom();
        this.setupInput();
        this.setupPlatform();
        this.resize();
        window.addEventListener('resize', () => this.resize());
        window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 150));
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state === 'playing') this.pause();
        });

        this.resetRun();
        this.showMenu();
        // Deep link to a profile (?p=<id>) and a retry of any run that failed to upload last time.
        const deep = new URLSearchParams(window.location.search).get('p');
        if (deep) this.openProfile(deep);
        this.syncProfile();
        Leaderboard.flushPending().then(res => {
            if (res && this.state === 'menu') this.loadBoard(this.el.menuBoard, this.el.menuBoardTitle);
        });
        this.frame = this.frame.bind(this);
        requestAnimationFrame(this.frame);
    }

    bindDom() {
        const $ = id => document.getElementById(id);
        this.el = {
            hud: $('hud'), hearts: $('hearts'), level: $('levelLabel'), xpFill: $('xpFill'),
            score: $('score'), combo: $('combo'), comboMult: $('comboMult'), comboCount: $('comboCount'),
            comboFill: $('comboFill'), powerups: $('powerups'), superBar: $('superBar'), superFill: $('superFill'), superBtn: $('superBtn'),
            classPicker: $('classPicker'),
            bossBar: $('bossBar'), bossName: $('bossName'), bossFill: $('bossFill'), bossTrail: $('bossTrail'),
            banner: $('banner'), menu: $('menu'), menuBoard: $('menuBoard'), menuBoardTitle: $('menuBoardTitle'),
            playBtn: $('playBtn'), levelup: $('levelup'), levelupTitle: $('levelupTitle'), levelupSub: $('levelupSub'),
            cards: $('cards'), pauseOverlay: $('pause'), gameover: $('gameover'), killerIcon: $('killerIcon'),
            killedBy: $('killedBy'), finalStats: $('finalStats'),
            submitStatus: $('submitStatus'), finalBoard: $('finalBoard'), finalBoardTitle: $('finalBoardTitle'),
            againBtn: $('againBtn'), pauseBtn: $('pauseBtn'), muteBtn: $('muteBtn'),
            version: $('version'), newBest: $('newBest'), coins: $('coins'), gems: $('gems'), shopCoins: $('shopCoins'),
            continueBtn: $('continueBtn'), fsBtn: $('fsBtn'), menuFsBtn: $('menuFsBtn'), soundChip: $('soundChip'),
            iosHint: $('iosHint'), iosHintClose: $('iosHintClose'), bankBox: $('bankBox'), wheel: $('wheel'), potText: $('potText'),
            spinBtn: $('spinBtn'), keepBtn: $('keepBtn'), profileShop: $('profileShop')
        };
        this.el.continueBtn.addEventListener('click', () => this.closeShop());
        this.el.spinBtn.addEventListener('click', () => this.spinWheel());
        this.el.keepBtn.addEventListener('click', () => this.keepPot());

        this.el.version.textContent = `v${this.version} · ${this.buildDate}`;
        this.el.playBtn.addEventListener('click', () => this.startRun());
        this.el.againBtn.addEventListener('click', () => this.startRun());
        $('menuBtn').addEventListener('click', () => this.showMenu());
        $('resumeBtn').addEventListener('click', () => this.resume());
        $('restartBtn').addEventListener('click', () => this.startRun());
        $('quitBtn').addEventListener('click', () => this.showMenu());
        this.el.pauseBtn.addEventListener('click', e => {
            e.currentTarget.blur();
            if (this.state === 'paused') this.resume();
            else this.pause();
        });
        this.el.muteBtn.addEventListener('click', e => {
            e.currentTarget.blur();
            this.toggleMute();
        });
        // the "+n" chip in the upgrade strip opens the pause screen, which lists everything owned
        this.el.powerups.addEventListener('pointerdown', e => {
            if (e.target.closest('[data-more]')) {
                e.preventDefault();
                this.pause();
            }
        });
        this.el.superBtn.addEventListener('pointerdown', e => {
            e.preventDefault();
            e.stopPropagation();
            this.activateSuper();
        });
        this.bindIdentity();
        this.bindClassPicker();
        this.boardSel = { board: Leaderboard.board, cls: '' };
        document.getElementById('boardTabs').addEventListener('click', e => {
            const btn = e.target.closest('button[data-board]');
            if (!btn) return;
            this.boardSel.board = btn.dataset.board;
            this.showBoardTabs();
            this.loadBoard(this.el.menuBoard, this.el.menuBoardTitle, this.boardSel.board, this.boardSel.cls);
        });
        document.getElementById('clsTabs').addEventListener('click', e => {
            const btn = e.target.closest('button[data-cls]');
            if (!btn) return;
            this.boardSel.cls = btn.dataset.cls;
            this.showBoardTabs();
            this.loadBoard(this.el.menuBoard, this.el.menuBoardTitle, this.boardSel.board, this.boardSel.cls);
        });
        this.el.muteBtn.textContent = Sfx.muted ? '🔇' : '🔊';
        const musicBtns = [$('musicBtn'), $('menuMusicBtn')];
        const showMusic = () => musicBtns.forEach(b => b.classList.toggle('off', !Sfx.musicOn));
        musicBtns.forEach(b => b.addEventListener('click', e => {
            e.currentTarget.blur();
            Sfx.toggleMusic();
            showMusic();
        }));
        showMusic();
    }

    // Class picker on the menu: remembered between visits, changeable before every run.
    bindClassPicker() {
        const saved = this.storeGet('hunter.class');
        this.cls = CLASSES[saved] ? saved : 'wizard';
        this.el.classPicker.innerHTML = CLASS_ORDER.map(id => {
            const c = CLASSES[id];
            const pips = n => Array.from({ length: 5 }, (_, i) => `<em class="${i < n ? 'on' : ''}"></em>`).join('');
            const speed = U.clamp(Math.round((c.speed - 2) / 0.65), 1, 5);
            return `<button class="cls" data-cls="${id}" style="--c:${c.color}" aria-label="${c.name}">` +
                `<canvas width="120" height="120"></canvas><b>${c.name}</b><small>${'❤️'.repeat(c.hearts)}</small>` +
                `<span class="cstat" title="Power">💪<span>${pips(c.power)}</span></span><span class="cstat" title="Speed">👟<span>${pips(speed)}</span></span></button>`;
        }).join('');
        this.el.classInfo = document.getElementById('classInfo');
        this.el.classPicker.querySelectorAll('.cls').forEach(btn => {
            btn.addEventListener('click', () => this.pickClass(btn.dataset.cls));
            const cv = btn.querySelector('canvas');
            this.drawPortrait(cv, btn.dataset.cls);
        });
        this.pickClass(this.cls, true);
    }

    pickClass(id, quiet = false) {
        if (!CLASSES[id]) return;
        this.cls = id;
        this.storeSet('hunter.class', id);
        const c = CLASSES[id];
        this.el.classPicker.querySelectorAll('.cls').forEach(btn => btn.classList.toggle('on', btn.dataset.cls === id));
        this.el.classInfo.innerHTML = `<b style="color:${c.color}">${c.weapon}</b> — ${c.blurb}<br><b class="sup">⚡ ${c.superName}</b> — ${c.superBlurb}`;
        if (this.el.whoAvatar) this.drawAvatar(this.el.whoAvatar, id, this.equippedSkin ? this.equippedSkin(id) : '');
        this.drawPortrait(document.getElementById('logoHero'), id, this.equippedSkin ? this.equippedSkin(id) : '');
        if (!quiet) Sfx.tone({ wizard: 784, barbarian: 392, goblin: 587 }[id], { duration: 0.09, type: 'triangle', volume: 0.1 });
    }

    setupInput() {
        const gameKeys = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', ' '];
        window.addEventListener('keydown', e => {
            if (e.target && e.target.tagName === 'INPUT') return;
            const key = (e.key || '').toLowerCase();
            // A focused button inside an open menu handles Enter/Space via its click event.
            if (e.target && e.target.tagName === 'BUTTON' && (key === 'enter' || key === ' ') && e.target.closest('.overlay.show')) return;
            if (gameKeys.includes(key)) e.preventDefault();

            if (this.el.profile.classList.contains('show')) {
                if (key === 'escape') this.closeProfile();
                return;
            }
            if (this.state === 'menu' && (key === 'enter' || key === ' ')) {
                this.startRun();
                return;
            }
            if (this.state === 'gameover' && key === 'enter' && performance.now() - this.gameOverAt > 600) {
                this.startRun();
                return;
            }
            if (this.state === 'transition') return;
            if (this.state === 'levelup') {
                const idx = ['1', '2', '3', '4'].indexOf(key);
                if (idx >= 0) this.buyCard(idx);
                else if (key === 'enter' || key === ' ' || key === 'c') this.closeShop();
                return;
            }
            if (key === 'm') this.toggleMute();
            if (key === 'b') {
                Sfx.toggleMusic();
                document.querySelectorAll('.music-btn').forEach(b => b.classList.toggle('off', !Sfx.musicOn));
            }
            if (key === 'p' || key === 'escape') {
                if (this.state === 'playing') this.pause();
                else if (this.state === 'paused') this.resume();
                return;
            }
            if (this.state !== 'playing') return;
            if (key === ' ' || key === 'e' || key === 'shift') this.activateSuper();
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
    }

    setupPlatform() {
        const root = document.documentElement;
        this.fsSupported = Boolean(root.requestFullscreen || root.webkitRequestFullscreen);
        document.body.classList.toggle('no-fs', !this.fsSupported);
        const onFsChange = () => {
            const full = this.isFullscreen();
            if (full && this.runActive()) this.lockOrientation();
            // Whatever was held while the browser switched modes never gets its key-up / pointer-up.
            this.releaseInput();
            // The viewport settles over a few frames; measure again until it has.
            this.settleResize();
            if (!full) {
                // Left fullscreen (Esc, the browser's exit button, back gesture): pause, and don't
                // force it back on Resume — only the ⛶ button or the next run re-enters it.
                this.noAutoFs = true;
                if (this.state === 'playing') this.pause();
            }
            this.el.fsBtn.textContent = this.el.menuFsBtn.textContent = full ? '🗗' : '⛶';
        };
        window.addEventListener('focus', () => this.settleResize());
        document.addEventListener('fullscreenchange', onFsChange);
        document.addEventListener('webkitfullscreenchange', onFsChange);
        const toggle = e => {
            e.currentTarget.blur();
            if (this.isFullscreen()) {
                this.storeSet('hunter.fullscreen', '0'); // the player opted out: stop auto-entering
                this.exitFullscreen();
            } else {
                this.storeSet('hunter.fullscreen', '1');
                this.noAutoFs = false;
                this.enterFullscreen(true);
            }
        };
        this.el.fsBtn.addEventListener('click', toggle);
        this.el.menuFsBtn.addEventListener('click', toggle);

        // The page is a game, not a document: no pinch zoom, double-tap zoom, selection or long-press menus.
        const isInput = e => e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
        ['gesturestart', 'gesturechange', 'dblclick'].forEach(evt => document.addEventListener(evt, e => e.preventDefault(), { passive: false }));
        document.addEventListener('selectstart', e => { if (!isInput(e)) e.preventDefault(); });
        document.addEventListener('contextmenu', e => { if (!isInput(e)) e.preventDefault(); });
        document.addEventListener('touchmove', e => {
            if (e.touches.length > 1) e.preventDefault(); // pinch
        }, { passive: false });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) return;
            this.releaseInput();
            this.settleResize();
            if (this.runActive()) this.acquireWakeLock();
        });

        // Sound health: show a chip when the context stays silent (iOS interruption, dead output device).
        Sfx.onHealth = ok => {
            this.el.soundChip.hidden = ok || !this.runActive();
        };
        this.el.soundChip.addEventListener('click', e => {
            e.stopPropagation();
            Sfx.restore();
            this.el.soundChip.hidden = true;
        });

        // iPhone Safari has no element fullscreen: suggest installing to the home screen, once.
        const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        const standalone = navigator.standalone || window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
        if (ios && !standalone && !this.fsSupported && !this.storeGet('hunter.iosHint')) {
            this.el.iosHint.hidden = false;
            this.storeSet('hunter.iosHint', '1');
        }
        this.el.iosHintClose.addEventListener('click', () => {
            this.el.iosHint.hidden = true;
        });
    }

    storeGet(key) {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            return null;
        }
    }

    storeSet(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (e) { /* storage unavailable */ }
    }

    runActive() {
        return ['playing', 'paused', 'transition', 'levelup', 'dying'].includes(this.state);
    }

    isFullscreen() {
        return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
    }

    enterFullscreen(force = false) {
        if (!this.fsSupported || this.isFullscreen()) return;
        if (!force && this.storeGet('hunter.fullscreen') === '0') return;
        const root = document.documentElement;
        try {
            const p = root.requestFullscreen ? root.requestFullscreen({ navigationUI: 'hide' }) : root.webkitRequestFullscreen();
            if (p && p.catch) p.catch(() => {});
        } catch (e) { /* not allowed here */ }
    }

    exitFullscreen() {
        try {
            const p = document.exitFullscreen ? document.exitFullscreen() : document.webkitExitFullscreen && document.webkitExitFullscreen();
            if (p && p.catch) p.catch(() => {});
        } catch (e) { /* not in fullscreen */ }
    }

    lockOrientation() {
        try {
            const o = screen.orientation;
            if (o && o.lock) o.lock(o.type).catch(() => {}); // keep whatever way the device is held (Android)
        } catch (e) { /* unsupported */ }
    }

    unlockOrientation() {
        try {
            if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
        } catch (e) { /* unsupported */ }
    }

    async acquireWakeLock() {
        if (!('wakeLock' in navigator) || this.wakeLock || document.hidden) return;
        try {
            this.wakeLock = await navigator.wakeLock.request('screen');
            this.wakeLock.addEventListener('release', () => {
                this.wakeLock = null;
            });
        } catch (e) {
            this.wakeLock = null;
        }
    }

    releaseWakeLock() {
        if (this.wakeLock) {
            this.wakeLock.release().catch(() => {});
            this.wakeLock = null;
        }
    }

    // Run started or resumed: go fullscreen, keep the screen on, watch audio health.
    /** Drop held keys, mouse buttons and the touch stick (lost key-up / pointer-up events). */
    releaseInput() {
        this.keys = {};
        if (this.mouse) this.mouse.down = false;
        this.releaseStick();
        if (document.activeElement && document.activeElement !== document.body && document.activeElement.tagName !== 'INPUT') document.activeElement.blur();
    }

    settleResize() {
        clearTimeout(this.settleTimer);
        let n = 0;
        const again = () => {
            this.resize(); // no-op unless the viewport really changed
            if (++n < 4) this.settleTimer = setTimeout(again, [60, 250, 600][n - 1]);
        };
        again();
        this.lastTime = performance.now();
    }

    enterGameMode(fresh = false) {
        if (fresh) this.noAutoFs = false;
        if (!this.noAutoFs) this.enterFullscreen();
        if (this.isFullscreen()) this.lockOrientation();
        this.acquireWakeLock();
        Sfx.setActive(true);
    }

    leaveGameMode() {
        this.releaseWakeLock();
        this.unlockOrientation();
        Sfx.setActive(false);
        this.el.soundChip.hidden = true;
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

    resetRun() {
        if (!CLASSES[this.cls]) this.cls = 'wizard';
        const cls = CLASSES[this.cls];
        this.skin = this.equippedSkin ? this.equippedSkin(this.cls) : '';
        this.player = {
            x: this.W / 2, y: this.H / 2, r: 15, vx: 0, vy: 0, baseSpeed: cls.speed,
            hp: cls.hearts, maxHp: cls.hearts, iframes: 0, facing: 1, moveT: 0, contactCd: 0
        };
        this.score = 0;
        this.level = 1;
        this.kills = 0;
        this.time = 0;
        this.frameNo = 0;
        this.combo = 0;
        this.comboTimer = 0;
        this.bestCombo = 0;
        this.bossesSlain = 0;
        this.bossCount = 0;
        this.bossWarning = 0;
        this.pendingBoss = null;
        this.bossParts = [];
        this.smallCount = 0;
        this.bigCount = 0;
        this.regularCount = 0;
        this.decks = {};
        this.encounter = null;
        this.hazards = [];
        this.seam = null;
        this.roadY = 0;
        this.phase = 'fight';
        this.progress = 0;
        this.target = U.levelDamage(1);
        this.biome = this.biomeFor ? this.biomeFor(1) : null;
        this.boss = null;
        this.pendingLevels = 0;
        this.coins = 0;
        this.coinsEarned = 0;
        this.coinsSpent = 0;
        this.coinFrac = 0;
        this.gems = 0;
        this.artCards = [];
        this.hits = 0;
        this.levelCoinsStart = 0;
        this.incomeEMA = 0;
        this.buffs = {};
        this.dropCd = 0;
        this.heartCd = 0;
        this.coinFloat = { n: 0, t: 0 };

        this.monsters = [];
        this.bullets = [];
        this.enemyShots = [];
        this.cleaves = [];
        this.lightning = [];
        this.decals = [];
        this.grenades = [];
        this.explosions = [];
        this.particles = [];
        this.floaters = [];
        this.powerups = [];
        this.coinDrops = [];

        this.cooldown = 20;
        this.superMeter = 0;
        this.chargeMult = 1;
        this.whirl = 0;
        this.whirlT = 0;
        if (this.whirlVoice) Sfx.fadeOut(this.whirlVoice, 0.1);
        this.whirlVoice = null;
        this.novaQueue = null;
        this.stormClock = 0;
        this.timers = Object.fromEntries(TIMED_POWERUPS.map(t => [t, 0]));
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
        this.submitting = false;
        this.burn = null;
        if (this.el) this.el.levelup.classList.remove('intro');
    }

    showMenu() {
        Sfx.stopMusic();
        Sfx.setBgmLevel(0.22);
        this.leaveGameMode();
        this.state = 'menu';
        this.resetRun();
        this.setOverlay('menu');
        this.el.hud.classList.add('hidden');
        this.el.bossBar.hidden = true;
        this.attract = [];
        for (let i = 0; i < 9; i++) this.attract.push(this.makeMonster(this.pickType(['small', 'medium', 'large'][i % 3]), Math.random() * this.W, Math.random() * this.H, 'random'));
        this.showBoardTabs();
        this.loadBoard(this.el.menuBoard, this.el.menuBoardTitle, this.boardSel.board, this.boardSel.cls);
    }

    startRun() {
        if (!Leaderboard.identity()) {
            // Everyone gets a name before the first hunt (it's how scores and profiles are kept).
            if (this.state !== 'menu') this.showMenu();
            this.askName();
            return;
        }
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
        this.loadArtefacts();
        this.chargeMult = this.artefactMult('charge');
        this.statsLog = /[?&]stats\b/.test(window.location.search) ? this.makeStatsLog() : null;
        this.startLevel();
        Sfx.setBgmLevel(0.15);
        this.enterGameMode(true);
        this.banner('HUNT!', `${this.biome.name} · fill the bar to clear the level`);
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
        Sfx.setBgmLevel(0.09);
        const owned = UPGRADES.filter(u => this.stack(u.id) > 0);
        document.getElementById('pauseUps').innerHTML = owned.length
            ? owned.map(u => `<span class="up">${u.icon} ${u.name}<sup>${this.stack(u.id)}/${u.max}</sup></span>`).join('')
            : '';
    }

    resume() {
        if (this.state !== 'paused') return;
        Sfx.unlock();
        this.state = 'playing';
        this.setOverlay(null);
        this.lastTime = performance.now();
        Sfx.setBgmLevel(0.15);
        this.enterGameMode();
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
            this.updateRoad();
            this.updateParticles();
            this.updateLightning();
            if (this.deathTimer <= 0) this.showGameOver();
            return;
        }

        this.time += STEP / GAME_SPEED; // survival time in real seconds
        this.updatePlayer();
        this.updateWeapons();
        this.updateBullets();
        this.updateGrenades();
        this.updateStorm();
        this.updatePoisonCloud();
        this.updateLightning();
        this.updateDecals();
        this.updateMonsters(false);
        this.updateEnemyShots();
        this.updateHazards();
        this.updateRoad();
        this.updateBossWarning();
        this.updateLevelFlow();
        this.updatePowerups();
        this.updateCoins();
        this.updateCombo();
        this.updateParticles();
        this.updateSpawning();
        this.sweepDead();

        if (this.state === 'playing' && this.pendingLevels > 0) this.beginCards('level');
    }
}

/** Mixes a group of methods (incl. getters) into Game.prototype; each js/*.js file adds one group. */
function extendGame(methods) {
    Object.defineProperties(Game.prototype, Object.getOwnPropertyDescriptors(methods));
}


window.addEventListener('load', () => {
    window.game = new Game();
});
