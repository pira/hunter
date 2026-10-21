// Minimal Web Audio sound engine: sample playback with throttling + a few synthesized UI blips.
(function (root) {
    const SAMPLES = {
        shoot: 'sfx/gunshot.mp3',
        swoosh: 'sfx/sword-slice.mp3',
        monsterDeath: 'sfx/monster-death.mp3',
        bossDeath: 'sfx/monster-cry.mp3',
        playerHit: 'sfx/man-scream-ahh.mp3',
        powerup: 'sfx/powerup.mp3',
        boom: 'sfx/boom.mp3',
        grenade: 'sfx/grenade.mp3',
        missile: 'sfx/missile.mp3',
        gameOver: 'sfx/game-over.mp3',
        levelUp: 'sfx/level-up.mp3'
    };

    // Minimum ms between two plays of the same sample, so rapid fire doesn't turn into noise.
    const THROTTLE = { shoot: 70, monsterDeath: 45, swoosh: 120, boom: 60, missile: 90, grenade: 90 };

    const Sfx = {
        ctx: null,
        master: null,
        buffers: {},
        lastPlayed: {},
        music: null,
        muted: false,

        init() {
            try {
                this.muted = localStorage.getItem('hunter.muted') === '1';
            } catch (e) { /* storage unavailable */ }
            const AudioCtx = root.AudioContext || root.webkitAudioContext;
            if (!AudioCtx) return;
            this.ctx = new AudioCtx();
            this.master = this.ctx.createGain();
            this.master.gain.value = this.muted ? 0 : 0.8;
            this.master.connect(this.ctx.destination);
            Object.entries(SAMPLES).forEach(([name, src]) => this.load(name, src));

            // Browsers start audio suspended until a user gesture; iOS also "interrupts" it on app switch/lock.
            const unlock = () => this.unlock();
            ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'].forEach(evt =>
                root.addEventListener(evt, unlock, { passive: true, capture: true }));
            document.addEventListener('visibilitychange', unlock);
        },

        unlock() {
            if (this.ctx && this.ctx.state !== 'running') {
                this.ctx.resume().catch(() => {});
            }
        },

        async load(name, src) {
            try {
                const response = await fetch(src);
                const data = await response.arrayBuffer();
                this.buffers[name] = await new Promise((resolve, reject) =>
                    this.ctx.decodeAudioData(data, resolve, reject));
            } catch (e) {
                // Missing or undecodable sample: stay silent for that sound.
            }
        },

        play(name, { volume = 1, rate = 1, duration } = {}) {
            if (!this.ctx || this.muted) return;
            const buffer = this.buffers[name];
            if (!buffer) return;
            const now = performance.now();
            const gap = THROTTLE[name] || 0;
            if (gap && this.lastPlayed[name] && now - this.lastPlayed[name] < gap) return;
            this.lastPlayed[name] = now;

            const source = this.ctx.createBufferSource();
            source.buffer = buffer;
            source.playbackRate.value = rate;
            const gain = this.ctx.createGain();
            gain.gain.value = volume;
            source.connect(gain).connect(this.master);
            source.start(0, 0, duration);
            return source;
        },

        playMusic(name, volume = 0.6) {
            this.stopMusic();
            if (!this.ctx || !this.buffers[name]) return;
            const source = this.ctx.createBufferSource();
            source.buffer = this.buffers[name];
            const gain = this.ctx.createGain();
            gain.gain.value = volume;
            source.connect(gain).connect(this.master);
            source.start();
            this.music = { source, gain };
        },

        stopMusic() {
            if (!this.music) return;
            const { source, gain } = this.music;
            this.music = null;
            try {
                gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
                source.stop(this.ctx.currentTime + 0.6);
            } catch (e) { /* already stopped */ }
        },

        // Short synthesized tone, used for UI feedback (combo tiers, cards, warnings).
        tone(freq, { duration = 0.12, type = 'square', volume = 0.15, slide = 0, delay = 0 } = {}) {
            if (!this.ctx || this.muted) return;
            const t = this.ctx.currentTime + delay;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, t);
            if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + duration);
            gain.gain.setValueAtTime(volume, t);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
            osc.connect(gain).connect(this.master);
            osc.start(t);
            osc.stop(t + duration + 0.02);
        },

        arpeggio(freqs, step = 0.07, opts = {}) {
            freqs.forEach((f, i) => this.tone(f, { ...opts, delay: i * step }));
        },

        toggleMute() {
            this.muted = !this.muted;
            if (this.master) this.master.gain.value = this.muted ? 0 : 0.8;
            if (this.muted) this.stopMusic();
            try {
                localStorage.setItem('hunter.muted', this.muted ? '1' : '0');
            } catch (e) { /* storage unavailable */ }
            return this.muted;
        }
    };

    root.Sfx = Sfx;
})(window);
