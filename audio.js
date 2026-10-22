// Monster Hunter sound engine.
//
// Graph:  voice -> bus (sfx | ui | voice | music) -> master -> limiter -> destination
// - Voice manager: global cap, per-sound polyphony with oldest-voice stealing, priorities,
//   throttles, and nodes disconnected as soon as they end.
// - Synth sounds (tones, arpeggios, crackle, creature voices, hit thwacks) are rendered into
//   AudioBuffers in plain JS once and cached, then played through the same voice manager.
// - Health watchdog: resumes interrupted contexts, detects a "zombie" context whose clock has
//   stopped (dead output device after an AirPods switch) and rebuilds it from cached bytes.
// Public API kept from v2: init, unlock, play, playMusic, stopMusic, tone, arpeggio, crackle, toggleMute.
(function (root) {
    const SAMPLES = {
        shoot: { src: 'sfx/gunshot.mp3', poly: 3, throttle: 70 },
        swoosh: { src: 'sfx/sword-slice.mp3', poly: 2, throttle: 110 },
        monsterDeath: { src: 'sfx/monster-death.mp3', poly: 4, throttle: 45 },
        bossDeath: { src: 'sfx/monster-cry.mp3', poly: 2, throttle: 120 },
        playerHit: { src: 'sfx/man-scream-ahh.mp3', poly: 1, priority: 3 },
        powerup: { src: 'sfx/powerup.mp3', poly: 2, priority: 2 },
        boom: { src: 'sfx/boom.mp3', poly: 3, throttle: 60 },
        grenade: { src: 'sfx/grenade.mp3', poly: 2, throttle: 90 },
        gameOver: { src: 'sfx/game-over.mp3', bus: 'music', poly: 1, priority: 3 },
        levelUp: { src: 'sfx/level-up.mp3', bus: 'ui', poly: 1, priority: 3 }
    };
    const MAX_VOICES = 24;
    const MASTER_GAIN = 0.8;
    const TAU = Math.PI * 2;

    // ------------------------------------------------------------------ tiny DSP kit (plain JS)

    function rng(seed) {
        let s = seed >>> 0 || 1;
        return () => {
            s ^= s << 13; s >>>= 0;
            s ^= s >> 17;
            s ^= s << 5; s >>>= 0;
            return s / 4294967296;
        };
    }

    function hash(str) {
        let h = 2166136261;
        for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
        return h >>> 0;
    }

    // RBJ biquad, processed in place. type: lowpass | highpass | bandpass. freq may be a function of t (0..1).
    function biquad(data, rate, type, freq, q = 0.707) {
        let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
        let b0, b1, b2, a1, a2;
        const n = data.length;
        const coeffs = f => {
            const w = TAU * Math.min(f, rate * 0.45) / rate;
            const cos = Math.cos(w);
            const alpha = Math.sin(w) / (2 * q);
            const a0 = 1 + alpha;
            if (type === 'lowpass') { b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = (1 - cos) / 2; }
            else if (type === 'highpass') { b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = (1 + cos) / 2; }
            else { b0 = alpha; b1 = 0; b2 = -alpha; }
            a1 = -2 * cos; a2 = 1 - alpha;
            b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
        };
        const dynamic = typeof freq === 'function';
        if (!dynamic) coeffs(freq);
        for (let i = 0; i < n; i++) {
            if (dynamic && i % 64 === 0) coeffs(freq(i / n));
            const x = data[i];
            const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
            x2 = x1; x1 = x; y2 = y1; y1 = y;
            data[i] = y;
        }
        return data;
    }

    // Cheap Schroeder reverb (4 combs + 2 allpasses), mixed in place.
    function reverb(data, rate, mix = 0.3, size = 1) {
        const out = new Float32Array(data.length);
        const combs = [1116, 1188, 1277, 1356].map(d => ({ buf: new Float32Array(Math.round(d * size * rate / 44100)), i: 0 }));
        for (let n = 0; n < data.length; n++) {
            let s = 0;
            for (const c of combs) {
                const y = c.buf[c.i];
                c.buf[c.i] = data[n] + y * 0.8;
                c.i = (c.i + 1) % c.buf.length;
                s += y;
            }
            out[n] = s * 0.25;
        }
        for (const d of [556, 441]) {
            const buf = new Float32Array(Math.round(d * rate / 44100));
            let i = 0;
            for (let n = 0; n < out.length; n++) {
                const b = buf[i];
                const y = -out[n] + b;
                buf[i] = out[n] + b * 0.5;
                i = (i + 1) % buf.length;
                out[n] = y;
            }
        }
        for (let n = 0; n < data.length; n++) data[n] = data[n] * (1 - mix) + out[n] * mix;
        return data;
    }

    function normalize(data, peak = 0.9) {
        let max = 0;
        for (let i = 0; i < data.length; i++) max = Math.max(max, Math.abs(data[i]));
        if (max > 0) for (let i = 0; i < data.length; i++) data[i] *= peak / max;
        return data;
    }

    // Band-limited oscillator with exponential pitch slide. Square/saw/triangle come from cached
    // single-cycle wavetables that only hold harmonics below Nyquist for the highest pitch played.
    const TABLES = {};
    const TABLE_SIZE = 2048;
    function wavetable(type, harmonics) {
        const key = `${type}:${harmonics}`;
        if (TABLES[key]) return TABLES[key];
        const t = new Float32Array(TABLE_SIZE + 1);
        for (let h = 1; h <= harmonics; h++) {
            let a = 0;
            if (type === 'square' && h % 2 === 1) a = 1 / h;
            else if (type === 'sawtooth') a = (h % 2 ? 1 : -1) / h;
            else if (type === 'triangle' && h % 2 === 1) a = ((h - 1) / 2 % 2 ? -1 : 1) / (h * h);
            if (!a) continue;
            for (let i = 0; i <= TABLE_SIZE; i++) t[i] += Math.sin(TAU * h * i / TABLE_SIZE) * a;
        }
        TABLES[key] = t;
        return t;
    }

    function osc(len, rate, type, f0, f1, out = new Float32Array(len), amp = 1) {
        const harmonics = Math.max(1, Math.min(64, Math.floor(rate / 2 / Math.max(f0, f1))));
        const tab = type === 'sine' ? wavetable('square', 1) : wavetable(type, harmonics); // 1-harmonic square = sine
        const k = Math.pow(f1 / f0, 1 / Math.max(1, len));
        let f = f0;
        let ph = 0;
        for (let i = 0; i < len; i++) {
            ph += f / rate;
            ph -= Math.floor(ph);
            f *= k;
            const x = ph * TABLE_SIZE;
            const j = x | 0;
            out[i] += (tab[j] + (tab[j + 1] - tab[j]) * (x - j)) * amp;
        }
        return out;
    }

    // ------------------------------------------------------------------ engine

    const Sfx = {
        ctx: null,
        master: null,
        limiter: null,
        buses: {},
        buffers: {},
        bytes: {},
        synth: {},
        voices: [],
        lastPlayed: {},
        music: null,
        muted: false,
        active: false,
        stats: { played: 0, dropped: 0, stolen: 0, rebuilt: 0, resumes: 0 },
        onHealth: null,
        healthy: true,

        init() {
            try {
                this.muted = localStorage.getItem('hunter.muted') === '1';
            } catch (e) { /* storage unavailable */ }
            this.AudioCtx = root.AudioContext || root.webkitAudioContext;
            if (!this.AudioCtx) return;
            try {
                // iOS 17+: mix with the player's own music and respect the silent switch.
                if (navigator.audioSession) navigator.audioSession.type = 'ambient';
            } catch (e) { /* not supported */ }
            this.build();
            Object.entries(SAMPLES).forEach(([name, def]) => this.load(name, def.src));

            // Browsers start audio suspended until a gesture; iOS also interrupts it on calls/notifications.
            const kick = () => this.unlock();
            ['touchstart', 'touchend', 'pointerdown', 'pointerup', 'click', 'keydown'].forEach(evt =>
                root.addEventListener(evt, kick, { passive: true, capture: true }));
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden) {
                    this.unlock();
                    this.wall = null; // don't count hidden time against the zombie check
                }
            });
            if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
                navigator.mediaDevices.addEventListener('devicechange', () => {
                    clearTimeout(this.deviceTimer);
                    this.deviceTimer = setTimeout(() => this.rebuild('devicechange'), 400);
                });
            }
            setInterval(() => this.watchdog(), 1000);
            if (/[?&]audiodebug\b/.test(root.location.search)) this.debugOverlay();
        },

        build() {
            const ctx = (this.ctx = new this.AudioCtx({ latencyHint: 'interactive' }));
            this.limiter = ctx.createDynamicsCompressor();
            this.limiter.threshold.value = -6;
            this.limiter.knee.value = 0;
            this.limiter.ratio.value = 20;
            this.limiter.attack.value = 0.002;
            this.limiter.release.value = 0.15;
            this.master = ctx.createGain();
            this.master.gain.value = this.muted ? 0 : MASTER_GAIN;
            this.master.connect(this.limiter).connect(ctx.destination);
            this.buses = {};
            for (const [name, level] of [['sfx', 0.9], ['ui', 0.8], ['voice', 1], ['music', 0.75]]) {
                const g = ctx.createGain();
                g.gain.value = level;
                g.connect(this.master);
                this.buses[name] = g;
            }
            this.busLevel = { sfx: 0.9 };
            this.voices = [];
            this.synth = {};
            ctx.onstatechange = () => this.checkHealth();
            this.clock = { ctx: ctx.currentTime, wall: performance.now() };
        },

        async rebuild(reason) {
            if (!this.ctx) return;
            const old = this.ctx;
            this.stats.rebuilt++;
            this.stats.lastRebuild = reason;
            this.music = null;
            try { old.onstatechange = null; old.close(); } catch (e) { /* already closed */ }
            this.build();
            this.buffers = {};
            await Promise.all(Object.keys(this.bytes).map(name => this.decode(name)));
            this.unlock();
        },

        unlock() {
            if (!this.ctx) return;
            if (this.ctx.state !== 'running' && this.ctx.state !== 'closed') {
                this.stats.resumes++;
                this.ctx.resume().catch(() => {});
            }
        },

        // The game tells us when a run is active so the watchdog only nags while it matters.
        setActive(active) {
            this.active = active;
            this.silentSince = null;
            if (!active) this.setHealthy(true);
        },

        watchdog() {
            if (!this.ctx || document.hidden) {
                this.clock = null;
                return;
            }
            const now = performance.now();
            const state = this.ctx.state;
            if (state !== 'running') this.unlock();
            // Zombie check: "running" but the audio clock barely moved over a second of wall time.
            if (state === 'running' && this.clock && now - this.clock.wall > 900) {
                const advanced = this.ctx.currentTime - this.clock.ctx;
                if (advanced < 0.5 * ((now - this.clock.wall) / 1000)) {
                    this.rebuild('zombie');
                    return;
                }
            }
            this.clock = { ctx: this.ctx.currentTime, wall: now };
            this.checkHealth();
        },

        checkHealth() {
            if (!this.ctx) return;
            const silent = this.active && !this.muted && this.ctx.state !== 'running';
            if (!silent) {
                this.silentSince = null;
                this.setHealthy(true);
            } else {
                if (!this.silentSince) this.silentSince = performance.now();
                if (performance.now() - this.silentSince > 2000) this.setHealthy(false);
            }
        },

        setHealthy(ok) {
            if (this.healthy === ok) return;
            this.healthy = ok;
            if (this.onHealth) this.onHealth(ok);
        },

        // Called from the "tap to restore sound" chip: the tap itself is the gesture.
        restore() {
            if (!this.ctx) return;
            if (this.ctx.state === 'running') {
                this.setHealthy(true);
                return;
            }
            this.ctx.resume().then(() => this.setHealthy(true)).catch(() => this.rebuild('restore'));
            setTimeout(() => {
                if (this.ctx.state !== 'running') this.rebuild('restore');
            }, 500);
        },

        async load(name, src) {
            try {
                const response = await fetch(src);
                this.bytes[name] = await response.arrayBuffer();
                await this.decode(name);
            } catch (e) {
                // Missing or undecodable sample: stay silent for that sound.
            }
        },

        decode(name) {
            const ctx = this.ctx;
            // decodeAudioData detaches its input, so always hand it a copy of the cached bytes.
            return new Promise(resolve => {
                try {
                    ctx.decodeAudioData(this.bytes[name].slice(0), buf => {
                        if (ctx === this.ctx) this.buffers[name] = buf;
                        resolve();
                    }, () => resolve());
                } catch (e) {
                    resolve();
                }
            });
        },

        /** Register a recorded sample under a name at runtime (e.g. boss voice lines). */
        loadSample(name, src, def = {}) {
            SAMPLES[name] = { poly: 1, ...def, src };
            if (this.ctx && !this.bytes[name]) return this.load(name, src);
            return Promise.resolve();
        },

        has(name) {
            return Boolean(this.buffers[name] || this.synth[name]);
        },

        // ---- voice manager

        startVoice(buffer, { name, volume = 1, rate = 1, duration, bus = 'sfx', poly = 4, priority = 1, filter, loop = false } = {}) {
            const ctx = this.ctx;
            if (!ctx || this.muted || !buffer || ctx.state === 'closed') return null;
            const t = ctx.currentTime;
            // Per-sound polyphony: steal the oldest voice of this sound.
            const same = this.voices.filter(v => v.name === name);
            if (same.length >= poly) {
                this.stopVoice(same[0]);
                this.stats.stolen++;
            }
            // Global cap: steal the oldest voice with priority <= ours, else drop the new sound.
            if (this.voices.length >= MAX_VOICES) {
                const victim = this.voices.filter(v => v.priority <= priority).sort((a, b) => a.priority - b.priority || a.start - b.start)[0];
                if (!victim) {
                    this.stats.dropped++;
                    return null;
                }
                this.stopVoice(victim);
                this.stats.stolen++;
            }
            const src = ctx.createBufferSource();
            src.buffer = buffer;
            src.playbackRate.value = rate;
            src.loop = loop;
            const gain = ctx.createGain();
            gain.gain.value = volume;
            let head = src;
            if (filter) {
                head.connect(filter);
                head = filter;
            }
            head.connect(gain).connect(this.buses[bus] || this.buses.sfx);
            const voice = { name, src, gain, filter, start: t, priority };
            src.onended = () => this.release(voice);
            if (duration) src.start(t, 0, duration);
            else src.start(t);
            this.voices.push(voice);
            this.stats.played++;
            return voice;
        },

        stopVoice(v) {
            try {
                const t = this.ctx.currentTime;
                v.gain.gain.cancelScheduledValues(t);
                v.gain.gain.setValueAtTime(v.gain.gain.value, t);
                v.gain.gain.linearRampToValueAtTime(0, t + 0.01);
                v.src.stop(t + 0.012);
            } catch (e) { /* already stopped */ }
            this.release(v);
        },

        release(v) {
            const i = this.voices.indexOf(v);
            if (i >= 0) this.voices.splice(i, 1);
            if (v.released) return;
            v.released = true;
            setTimeout(() => {
                try {
                    v.src.disconnect();
                    v.gain.disconnect();
                    if (v.filter) v.filter.disconnect();
                } catch (e) { /* gone */ }
            }, 40);
        },

        play(name, { volume = 1, rate = 1, duration, priority } = {}) {
            if (!this.ctx || this.muted) return null;
            const def = SAMPLES[name] || {};
            const buffer = this.buffers[name] || this.synth[name];
            if (!buffer) return null;
            const now = performance.now();
            if (def.throttle && this.lastPlayed[name] && now - this.lastPlayed[name] < def.throttle) return null;
            this.lastPlayed[name] = now;
            return this.startVoice(buffer, {
                name, volume, rate, duration, bus: def.bus || 'sfx', poly: def.poly || 2, priority: priority ?? def.priority ?? 1
            });
        },

        playMusic(name, volume = 0.6) {
            this.stopMusic();
            if (!this.ctx || this.muted || !this.buffers[name]) return;
            const v = this.startVoice(this.buffers[name], { name: `music:${name}`, volume, bus: 'music', poly: 1, priority: 3 });
            if (v) this.music = v;
        },

        stopMusic() {
            if (!this.music) return;
            const v = this.music;
            this.music = null;
            try {
                v.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
                v.src.stop(this.ctx.currentTime + 0.6);
            } catch (e) { /* already stopped */ }
        },

        /** Spoken lines: voice bus, ducks the sfx bus by 6 dB while talking. */
        speak(name, { volume = 1 } = {}) {
            const buffer = this.buffers[name];
            if (!buffer || this.muted) return false;
            const v = this.startVoice(buffer, { name: 'speech', volume, bus: 'voice', poly: 1, priority: 3 });
            if (!v) return false;
            const g = this.buses.sfx.gain;
            const t = this.ctx.currentTime;
            g.cancelScheduledValues(t);
            g.setTargetAtTime(this.busLevel.sfx * 0.5, t, 0.03);
            g.setTargetAtTime(this.busLevel.sfx, t + buffer.duration, 0.2);
            return true;
        },

        // ---- synthesized sounds (rendered once, cached as buffers)

        render(key, seconds, fill) {
            if (this.synth[key]) return this.synth[key];
            const rate = this.ctx.sampleRate;
            const len = Math.max(1, Math.floor(rate * seconds));
            const buf = this.ctx.createBuffer(1, len, rate);
            fill(buf.getChannelData(0), rate, len);
            this.synth[key] = buf;
            return buf;
        },

        toneBuffer(freq, duration, type, slide) {
            const key = `tone:${freq}:${duration}:${type}:${slide}`;
            return this.render(key, duration + 0.02, (d, rate, len) => {
                const n = Math.floor(rate * duration);
                osc(n, rate, type, freq, Math.max(30, freq + slide), d, type === 'square' || type === 'sawtooth' ? 0.6 : 1);
                const attack = Math.floor(rate * 0.003);
                for (let i = 0; i < len; i++) {
                    const env = i < attack ? i / attack : i < n ? Math.pow(0.0001, (i - attack) / Math.max(1, n - attack)) : 0;
                    d[i] *= env;
                }
            });
        },

        // Short tone for UI feedback (combo tiers, cards, warnings).
        tone(freq, { duration = 0.12, type = 'square', volume = 0.15, slide = 0, delay = 0, bus = 'ui' } = {}) {
            if (!this.ctx || this.muted) return;
            const buf = this.toneBuffer(Math.round(freq), duration, type, slide);
            const go = () => this.startVoice(buf, { name: `tone:${bus}`, volume: volume * 1.6, bus, poly: bus === 'ui' ? 6 : 2, priority: bus === 'ui' ? 2 : 0 });
            if (delay > 0) setTimeout(go, delay * 1000);
            else go();
        },

        arpeggio(freqs, step = 0.07, opts = {}) {
            freqs.forEach((f, i) => this.tone(f, { ...opts, delay: i * step }));
        },

        /** Coin pickup tick: cheap, hard-limited to 2 voices. */
        coin(big) {
            if (!this.ctx || this.muted) return;
            const now = performance.now();
            if (now - (this.lastPlayed.coin || 0) < 35) return;
            this.lastPlayed.coin = now;
            const buf = this.render(`coin:${big ? 1 : 0}`, 0.14, (d, rate) => {
                const f = big ? 1046 : 1568;
                const n1 = Math.floor(rate * 0.045);
                osc(n1, rate, 'square', f, f, d, 0.5);
                const part = new Float32Array(d.length - n1);
                osc(part.length, rate, 'square', f * 1.5, f * 1.5, part, 0.5);
                for (let i = 0; i < part.length; i++) d[n1 + i] = part[i] * Math.pow(0.001, i / part.length);
            });
            this.startVoice(buf, { name: 'coin', volume: 0.09, bus: 'ui', poly: 2, priority: 0 });
        },

        // Burning-film crackle: filtered hiss with random pops, swelling in and out.
        crackle(duration = 1.5, volume = 0.35) {
            if (!this.ctx || this.muted) return;
            const buf = this.render(`crackle:${duration}`, duration, (d, rate, len) => {
                const r = rng(7);
                for (let i = 0; i < len; i++) {
                    const env = Math.sin(Math.PI * (i / len)) ** 0.7;
                    const pop = r() < 0.0015 ? (r() * 2 - 1) * 0.9 : 0;
                    d[i] = ((r() * 2 - 1) * 0.12 + pop) * env;
                }
                biquad(d, rate, 'bandpass', 1800, 0.6);
            });
            this.startVoice(buf, { name: 'crackle', volume: volume * 2.2, bus: 'ui', poly: 1, priority: 2 });
        },

        // ---- creatures: one deterministic voice per monster type, 3 seeded variants each

        creatureBuffer(type, tier, variant) {
            const key = `cr:${type}:${variant}`;
            if (this.synth[key]) return this.synth[key];
            const r = rng(hash(type) + variant * 7919);
            const spec = {
                small: { len: 0.15 }, medium: { len: 0.25 }, large: { len: 0.5 }, elite: { len: 0.35 },
                legendary: { len: 0.6 }, mythic: { len: 0.7 }, ancient: { len: 0.8 }, ultimate: { len: 0.9 }, boss: { len: 0.9 }
            }[tier] || { len: 0.25 };
            const len = spec.len * (0.9 + r() * 0.2);
            return this.render(key, len + (['legendary', 'mythic', 'ancient', 'ultimate', 'boss'].includes(tier) ? 0.35 : 0.02), (d, rate) => {
                const n = Math.floor(rate * len);
                const env = (i, a = 0.01, curve = 1.5) => {
                    const t = i / n;
                    return t < a ? t / a : Math.pow(Math.max(0, 1 - (t - a) / (1 - a)), curve);
                };
                if (tier === 'small') {
                    // squeak / chirp: up-then-down sweep with vibrato
                    const f = 600 + r() * 300;
                    const up = 1.2 + r() * 0.4;
                    let ph = 0;
                    for (let i = 0; i < n; i++) {
                        const t = i / n;
                        const bend = t < 0.3 ? 1 + (up - 1) * (t / 0.3) : up - (up - 0.7) * ((t - 0.3) / 0.7);
                        ph += (f * bend * (1 + 0.04 * Math.sin(TAU * 38 * t))) / rate;
                        d[i] = (Math.sin(TAU * ph) + 0.35 * Math.sin(TAU * ph * 2) + 0.15 * Math.sin(TAU * ph * 3)) * env(i, 0.05, 1.2);
                    }
                } else if (tier === 'medium') {
                    // snarl: buzzy saw with 30 Hz amplitude modulation, falling pitch
                    const f = 250 + r() * 150;
                    osc(n, rate, 'sawtooth', f, f * 0.7, d);
                    for (let i = 0; i < n; i++) d[i] = (d[i] * 0.6 + (r() * 2 - 1) * 0.25) * (0.55 + 0.45 * Math.sin(TAU * (28 + r() * 0.1) * i / rate)) * env(i, 0.04, 1.3);
                    biquad(d, rate, 'lowpass', t => 2400 - 1400 * t, 1.4);
                } else if (tier === 'large') {
                    // roar: noise + low saw through a sweeping resonant low-pass
                    const f = 90 + r() * 60;
                    osc(n, rate, 'sawtooth', f * 1.15, f * 0.8, d, 0.5);
                    for (let i = 0; i < n; i++) d[i] = (d[i] + (r() * 2 - 1) * 0.8) * env(i, 0.12, 1.1);
                    const peak = 700 + r() * 400;
                    biquad(d, rate, 'lowpass', t => 300 + peak * Math.sin(Math.PI * Math.min(1, t * 1.4)), 3);
                } else if (tier === 'elite') {
                    // metallic: ring modulation with an inharmonic ratio
                    const fc = 300 + r() * 200;
                    const fm = fc * (1.37 + r() * 0.5);
                    for (let i = 0; i < n; i++) {
                        const t = i / rate;
                        d[i] = Math.sin(TAU * fc * t * (1 - 0.2 * i / n)) * Math.sin(TAU * fm * t) * env(i, 0.01, 2);
                    }
                } else {
                    // legendary and up: layered roar (two detuned saws + noise) with reverb
                    const f = 70 + r() * 50;
                    osc(n, rate, 'sawtooth', f * 1.2, f * 0.75, d, 0.4);
                    osc(n, rate, 'sawtooth', f * 1.21 * 1.5, f * 0.76 * 1.5, d, 0.25);
                    for (let i = 0; i < n; i++) d[i] = (d[i] + (r() * 2 - 1) * 0.7 * (1 - i / n)) * env(i, 0.15, 1);
                    biquad(d, rate, 'lowpass', t => 400 + 1200 * Math.sin(Math.PI * Math.min(1, t * 1.2)), 2.5);
                    reverb(d, rate, 0.35, 1.2);
                }
                normalize(d, 0.85);
            });
        },

        /** Render creature voices in the background, one buffer per tick, so first kills don't hitch. */
        prewarm(list) {
            if (!this.ctx) return;
            const jobs = [];
            list.forEach(([type, tier]) => { for (let v = 0; v < 3; v++) jobs.push([type, tier, v]); });
            const next = () => {
                const job = jobs.shift();
                if (!job || !this.ctx) return;
                this.creatureBuffer(...job);
                setTimeout(next, 30);
            };
            setTimeout(next, 200);
        },

        /** A monster voice (death cry). `size` nudges pitch: bigger mob, lower voice. */
        creature(type, tier, { volume = 0.5, size = 12 } = {}) {
            if (!this.ctx || this.muted) return;
            const variant = Math.floor(Math.random() * 3);
            const buf = this.creatureBuffer(type, tier, variant);
            const rate = (1 + (Math.random() - 0.5) * 0.12) * Math.min(1.25, Math.max(0.8, 14 / Math.max(8, size) * 0.9 + 0.1));
            const big = !['small', 'medium'].includes(tier);
            this.startVoice(buf, { name: big ? 'cry:big' : 'cry', volume, rate, poly: big ? 2 : 4, priority: big ? 2 : 1 });
        },

        /** Impact thwack: filtered noise burst + falling sine, pitched by target size. */
        hit(size = 12, { volume = 0.35, flavor = 'thwack' } = {}) {
            if (!this.ctx || this.muted) return;
            const now = performance.now();
            if (now - (this.lastPlayed.hit || 0) < 30) return;
            this.lastPlayed.hit = now;
            const bucket = size < 11 ? 0 : size < 16 ? 1 : size < 24 ? 2 : 3;
            const buf = this.render(`hit:${flavor}:${bucket}`, 0.09, (d, rate) => {
                const r = rng(31 + bucket);
                const n = Math.floor(rate * (0.04 + bucket * 0.012));
                const f = [900, 600, 380, 220][bucket] * (flavor === 'zap' ? 1.8 : flavor === 'slash' ? 1.2 : 1);
                let ph = 0;
                for (let i = 0; i < n; i++) {
                    const t = i / n;
                    ph += (f * (1 - 0.6 * t)) / rate;
                    const e = Math.pow(1 - t, 2);
                    d[i] = ((r() * 2 - 1) * (flavor === 'slash' ? 0.8 : 0.55) + Math.sin(TAU * ph) * 0.7) * e;
                }
                biquad(d, rate, flavor === 'zap' ? 'highpass' : 'lowpass', flavor === 'zap' ? 900 : 2600 - bucket * 400, 0.9);
                normalize(d, 0.8);
            });
            this.startVoice(buf, { name: 'hit', volume, rate: 0.94 + Math.random() * 0.12, poly: 6, priority: 0 });
        },

        /** Generic one-off synth effect registered by name (rendered on first use). */
        fx(name, seconds, fill, { volume = 0.5, bus = 'sfx', poly = 2, priority = 1, rate = 1 } = {}) {
            if (!this.ctx || this.muted) return null;
            const buf = this.render(`fx:${name}`, seconds, (d, sr, len) => {
                fill(d, sr, len, { osc, biquad, reverb, normalize, rng });
            });
            return this.startVoice(buf, { name: `fx:${name}`, volume, bus, poly, priority, rate });
        },

        /** A looping synth sound (e.g. the whirlwind); stop it with fadeOut(voice). */
        loopFx(name, seconds, fill, { volume = 0.5, bus = 'sfx' } = {}) {
            if (!this.ctx || this.muted) return null;
            const buf = this.render(`loop:${name}`, seconds, (d, sr, len) => {
                fill(d, sr, len, { osc, biquad, reverb, normalize, rng });
                const x = Math.floor(sr * 0.02); // crossfade the seam
                for (let i = 0; i < x; i++) {
                    const t = i / x;
                    d[i] = d[i] * t + d[len - x + i] * (1 - t);
                }
            });
            const v = this.startVoice(buf, { name: `loop:${name}`, volume: 0.0001, bus, poly: 1, priority: 2, loop: true });
            if (v) v.gain.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.08);
            return v;
        },

        fadeOut(voice, seconds = 0.3) {
            if (!voice || !this.ctx || voice.released) return;
            try {
                const t = this.ctx.currentTime;
                voice.gain.gain.cancelScheduledValues(t);
                voice.gain.gain.setTargetAtTime(0, t, seconds / 3);
                voice.src.stop(t + seconds + 0.05);
            } catch (e) { /* already stopped */ }
        },

        toggleMute() {
            this.muted = !this.muted;
            if (this.master) this.master.gain.value = this.muted ? 0 : MASTER_GAIN;
            if (this.muted) {
                this.stopMusic();
                this.voices.slice().forEach(v => this.stopVoice(v));
            }
            try {
                localStorage.setItem('hunter.muted', this.muted ? '1' : '0');
            } catch (e) { /* storage unavailable */ }
            this.checkHealth();
            return this.muted;
        },

        debugOverlay() {
            const el = document.createElement('div');
            el.style.cssText = 'position:fixed;left:6px;bottom:6px;z-index:99;font:11px/1.35 monospace;color:#9f9;background:rgba(0,0,0,.7);padding:4px 7px;border-radius:6px;pointer-events:none;white-space:pre';
            document.body.appendChild(el);
            setInterval(() => {
                const c = this.ctx;
                const s = this.stats;
                el.textContent = `audio ${c ? c.state : 'none'} t=${c ? c.currentTime.toFixed(1) : '-'} sr=${c ? c.sampleRate : '-'}\n` +
                    `voices ${this.voices.length}/${MAX_VOICES} played ${s.played} stolen ${s.stolen} dropped ${s.dropped}\n` +
                    `resumes ${s.resumes} rebuilt ${s.rebuilt}${s.lastRebuild ? ` (${s.lastRebuild})` : ''} healthy ${this.healthy}`;
            }, 250);
        }
    };

    root.Sfx = Sfx;
})(window);
