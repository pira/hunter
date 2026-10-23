// Monster Hunter sound engine.
//
// Graph:  voice -> bus (sfx | ui | voice | music) -> master -> limiter -> destination
// - Voice manager: global cap, per-sound polyphony with oldest-voice stealing, priorities,
//   throttles, and nodes disconnected as soon as they end.
// - Synth sounds (tones, arpeggios, crackle, monster hits and deaths) are rendered into
//   AudioBuffers in plain JS once and cached, then played through the same voice manager.
// - Health watchdog: resumes interrupted contexts, detects a "zombie" context whose clock has
//   stopped (dead output device after an AirPods switch) and rebuilds it from cached bytes.
// Public API kept from v2: init, unlock, play, playMusic, stopMusic, tone, arpeggio, crackle, toggleMute.
(function (root) {
    const SAMPLES = {
        shoot: { src: 'sfx/gunshot.mp3', poly: 3, throttle: 70 },
        swoosh: { src: 'sfx/sword-slice.mp3', poly: 2, throttle: 110 },
        bossDeath: { src: 'sfx/monster-cry.mp3', poly: 2, throttle: 120 },
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
                // iOS 17+ audio session.
                // 'playback' = like a video: audible even with the iPhone's silent switch on.
                if (navigator.audioSession) navigator.audioSession.type = 'playback';
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
            // Older iOS only unlocks Web Audio after a sound starts inside a gesture, and a playing
            // <audio> element moves the page into the "playback" category (ignores the silent switch).
            if (!this.unlockedCtx || this.unlockedCtx !== this.ctx) {
                this.unlockedCtx = this.ctx;
                try {
                    const src = this.ctx.createBufferSource();
                    src.buffer = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
                    src.connect(this.ctx.destination);
                    src.start(0);
                } catch (e) { /* closed */ }
            }
            if (!this.keepAlive && root.Audio) {
                try {
                    const a = (this.keepAlive = new Audio(Sfx.silentWav()));
                    a.loop = true;
                    a.setAttribute('playsinline', '');
                    a.volume = 0.01;
                    a.play().catch(() => { this.keepAlive = null; });
                } catch (e) {
                    this.keepAlive = null;
                }
            }
        },

        /** A 0.5 s silent WAV as a data: URI (no download). */
        silentWav() {
            const n = 22050;
            const buf = new ArrayBuffer(44 + n);
            const v = new DataView(buf);
            const str = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
            str(0, 'RIFF'); v.setUint32(4, 36 + n, true); str(8, 'WAVE'); str(12, 'fmt ');
            v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
            v.setUint32(24, 44100, true); v.setUint32(28, 44100, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
            str(36, 'data'); v.setUint32(40, n, true);
            for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
            let bin = '';
            new Uint8Array(buf).forEach(b => { bin += String.fromCharCode(b); });
            return `data:audio/wav;base64,${btoa(bin)}`;
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
            // Zombie check: "running" but the audio clock barely moved over a second of wall time —
            // twice in a row, and at most one rebuild every 15 s (a rebuild needs a new tap on iOS).
            if (state === 'running' && this.clock && now - this.clock.wall > 900 && now - this.clock.wall < 3000) {
                const advanced = this.ctx.currentTime - this.clock.ctx;
                this.stalls = advanced < 0.5 * ((now - this.clock.wall) / 1000) ? (this.stalls || 0) + 1 : 0;
                if (this.stalls >= 2 && now - (this.lastRebuild || 0) > 15000) {
                    this.stalls = 0;
                    this.lastRebuild = now;
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
            if (v) {
                this.music = v;
                v.src.addEventListener('ended', () => {
                    if (this.music === v) this.music = null;
                });
            }
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

        // ---- monster families (v3.5): a quiet hit sound and a louder death per family, no voices.
        // Each is built from small pieces (clacks, thuds, rustles, clanks, squishes) and cached
        // in 3 seeded variants.

        mobBuffer(kind, family, variant) {
            const secs = kind === 'hit' ? 0.12 : 0.75;
            return this.render(`mob:${kind}:${family}:${variant}`, secs, (d, rate) => {
                const r = rng(hash(family + kind) + variant * 977);
                const at = t => Math.floor(t * rate);
                /** Add a piece: noise and/or a falling sine with an exponential decay, filtered. */
                const piece = (t0, { len, noise = 0, f0 = 0, f1 = f0, tone = 0, decay = 6, filter, q = 0.9, gain = 1 }) => {
                    const n = at(len);
                    const tmp = new Float32Array(n);
                    let ph = 0;
                    for (let i = 0; i < n; i++) {
                        const t = i / n;
                        const e = Math.exp(-decay * t) * Math.min(1, i / (rate * 0.002));
                        if (tone) {
                            ph += (f0 + (f1 - f0) * t) / rate;
                            tmp[i] += Math.sin(TAU * ph) * tone * e;
                        }
                        if (noise) tmp[i] += (r() * 2 - 1) * noise * e;
                    }
                    if (filter) biquad(tmp, rate, filter[0], filter[1], q);
                    const o = at(t0);
                    for (let i = 0; i < n && o + i < d.length; i++) d[o + i] += tmp[i] * gain;
                };
                const clack = (t0, g = 1, f = 2200) => {
                    piece(t0, { len: 0.03, noise: 0.6, tone: 0.8, f0: f * (0.9 + r() * 0.2), f1: f * 0.8, decay: 9, filter: ['bandpass', f, 3], gain: g });
                };
                const thud = (t0, g = 1, f = 120, len = 0.12) => {
                    piece(t0, { len, noise: 0.5, tone: 1, f0: f, f1: f * 0.55, decay: 7, filter: ['lowpass', 700], gain: g });
                };
                const rustle = (t0, len, g = 1, f = 1400) => {
                    piece(t0, { len, noise: 1, decay: 4, filter: ['bandpass', f, 0.7], gain: g });
                };
                if (kind === 'hit') {
                    if (family === 'undead') {
                        clack(0, 1, 2000 + r() * 500);
                        clack(0.028 + r() * 0.01, 0.5, 2600);
                    } else if (family === 'beasts') {
                        thud(0, 0.9, 200, 0.07);
                        rustle(0, 0.06, 0.4, 900);
                    } else if (family === 'fantasy') {
                        thud(0, 1, 130, 0.1);
                    } else if (family === 'bandits') {
                        rustle(0, 0.05, 0.9, 1600);
                        thud(0, 0.5, 220, 0.05);
                    } else {
                        piece(0, { len: 0.025, noise: 1, decay: 10, filter: ['highpass', 3000] });
                        clack(0.012, 0.5, 4200);
                    }
                } else if (family === 'undead') {
                    // bones rattle apart and clatter to the ground
                    let t = 0;
                    const n = 7 + Math.floor(r() * 4);
                    for (let i = 0; i < n; i++) {
                        clack(t, 1 - i / (n * 1.4), 2600 - i * 120 + r() * 500);
                        t += 0.03 + r() * 0.05 * (1 - i / n);
                    }
                    thud(t * 0.6, 0.5, 140);
                } else if (family === 'beasts') {
                    thud(0, 1, 110, 0.25);
                    rustle(0.02, 0.3, 0.5, 700);
                    thud(0.16 + r() * 0.04, 0.6, 85, 0.2);
                } else if (family === 'fantasy') {
                    thud(0, 1, 75, 0.4);
                    piece(0.05, { len: 0.55, noise: 1, decay: 3.5, filter: ['lowpass', 320], gain: 0.9 }); // rumble
                    for (let i = 0; i < 4; i++) clack(0.12 + r() * 0.3, 0.25, 700 + r() * 400); // pebbles
                } else if (family === 'bandits') {
                    // dropped weapon: a few inharmonic metal partials, then the body hits the ground
                    for (const [f, g] of [[1250, 0.6], [2950, 0.4], [4170, 0.3]]) {
                        piece(0, { len: 0.35, tone: g, f0: f * (0.97 + r() * 0.06), decay: 8 });
                    }
                    clack(0, 0.7, 3200);
                    thud(0.12 + r() * 0.04, 0.9, 120, 0.2);
                    rustle(0.12, 0.15, 0.3, 1000);
                } else {
                    // squish: wet sweep down plus a couple of pops
                    piece(0, { len: 0.22, noise: 1, decay: 5, filter: ['bandpass', 1400, 1.6] });
                    piece(0, { len: 0.18, tone: 0.8, f0: 520, f1: 140, decay: 6 });
                    clack(0.05 + r() * 0.03, 0.4, 900);
                    clack(0.1 + r() * 0.04, 0.3, 700);
                }
                normalize(d, 0.85);
            });
        },

        /** Quiet hit on a monster that survives: bone clack, thud, cloth slap or chitin tick. */
        mobHit(family, size = 12, { volume = 0.2 } = {}) {
            if (!this.ctx || this.muted) return;
            const now = performance.now();
            if (now - (this.lastPlayed.hit || 0) < 35) return;
            this.lastPlayed.hit = now;
            const buf = this.mobBuffer('hit', family, Math.floor(Math.random() * 3));
            const rate = Math.min(1.25, Math.max(0.75, 13 / Math.max(8, size))) * (0.94 + Math.random() * 0.12);
            this.startVoice(buf, { name: 'hit', volume, rate, poly: 5, priority: 0 });
        },

        /** Louder death: bones collapse, a heavy fall, a crumble, a dropped blade, a squish. */
        mobDeath(family, size = 12, { volume = 0.55, big = false } = {}) {
            if (!this.ctx || this.muted) return;
            const buf = this.mobBuffer('death', family, Math.floor(Math.random() * 3));
            const rate = Math.min(1.2, Math.max(0.65, 14 / Math.max(8, size) * 0.85 + 0.15)) * (0.95 + Math.random() * 0.1);
            this.startVoice(buf, { name: big ? 'die:big' : 'die', volume, rate, poly: big ? 2 : 4, priority: big ? 2 : 1 });
        },

        /** Hero takes a hit: a punchy thump and a low falling tone (no voice). */
        playerHurt(rate = 1) {
            if (!this.ctx || this.muted) return;
            const buf = this.render('playerHurt', 0.35, (d, sr) => {
                const r = rng(99);
                const n = Math.floor(sr * 0.3);
                let ph = 0;
                for (let i = 0; i < n; i++) {
                    const t = i / n;
                    ph += (330 - 200 * t) / sr;
                    const e = Math.exp(-5 * t) * Math.min(1, i / (sr * 0.002));
                    d[i] = (Math.sin(TAU * ph) * 0.7 + Math.sin(TAU * ph * 1.5) * 0.25) * e + (r() * 2 - 1) * Math.exp(-30 * t) * 0.9;
                }
                biquad(d, sr, 'lowpass', 1800, 0.9);
                normalize(d, 0.9);
            });
            this.startVoice(buf, { name: 'playerHurt', volume: 0.7, rate, poly: 1, priority: 3 });
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
