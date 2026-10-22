#!/usr/bin/env python3
"""Renders the background music: J. S. Bach, Prelude in C major BWV 846 (public domain), played on a
synthesized harpsichord (Karplus-Strong plucks + a soft room), mono, loop-friendly.
Writes sfx/music-prelude.mp3 (needs numpy + ffmpeg). Usage: python3 tools/audio/music.py"""
import pathlib, subprocess, numpy as np

SR = 44100
ROOT = pathlib.Path(__file__).resolve().parents[2]
NOTE = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}

def midi(n):
    name, acc, octv = n[0], n[1:-1], int(n[-1])
    return 12 * (octv + 1) + NOTE[name] + (1 if acc == '#' else -1 if acc == 'b' else 0)

# Five notes per bar; each half bar plays n1 n2 n3 n4 n5 n3 n4 n5 (16ths), twice per bar.
BARS = """C4 E4 G4 C5 E5|C4 D4 A4 D5 F5|B3 D4 G4 D5 F5|C4 E4 G4 C5 E5|C4 E4 A4 E5 A5|C4 D4 F#4 A4 D5|B3 D4 G4 D5 G5|B3 C4 E4 G4 C5|
A3 C4 E4 G4 C5|D3 A3 D4 F#4 C5|G3 B3 D4 G4 B4|G3 Bb3 E4 G4 C#5|F3 A3 D4 A4 D5|F3 Ab3 D4 F4 B4|E3 G3 C4 G4 C5|E3 F3 A3 C4 F4|
D3 F3 A3 C4 F4|G2 D3 G3 B3 F4|C3 E3 G3 C4 E4|C3 G3 Bb3 C4 E4|F2 F3 A3 C4 E4|F#2 C3 A3 C4 Eb4|Ab2 F3 B3 C4 D4|G2 F3 G3 B3 D4|
G2 E3 G3 C4 E4|G2 D3 G3 C4 F4|G2 D3 G3 B3 F4|G2 Eb3 A3 C4 F#4|G2 E3 G3 C4 G4|G2 D3 G3 C4 F4|G2 D3 G3 B3 F4|C2 C3 G3 Bb3 E4"""
bars = [b.split() for b in BARS.replace('\n', '').split('|') if b.strip()]

SIXTEENTH = 60 / 70 / 4  # quarter = 70 bpm
rng = np.random.default_rng(846)

def pluck(freq, dur, vel):
    n = int(SR * dur)
    period = SR / freq - 0.5  # the averaging filter adds half a sample of delay
    p = int(period)
    frac = period - p
    buf = (rng.random(p + 1) * 2 - 1) * vel
    # soften the pluck: one-pole low-pass on the excitation noise
    for i in range(1, len(buf)):
        buf[i] = 0.55 * buf[i] + 0.45 * buf[i - 1]
    out = np.zeros(n)
    damp = 0.996 if freq < 300 else 0.993
    idx = 0
    for i in range(n):
        a = buf[idx % (p + 1)]
        b = buf[(idx + 1) % (p + 1)]
        s = (1 - frac) * a + frac * b
        out[i] = s
        buf[idx % (p + 1)] = damp * 0.5 * (a + b)
        idx += 1
    env = np.minimum(1, np.linspace(0, dur, n) / 0.004)
    return out * env

total_steps = len(bars) * 16 + 16  # + final chord bar
out = np.zeros(int(SR * (total_steps * SIXTEENTH + 3)))
cache = {}
for bi, bar in enumerate(bars):
    for half in range(2):
        pattern = [0, 1, 2, 3, 4, 2, 3, 4]
        for k, ni in enumerate(pattern):
            step = bi * 16 + half * 8 + k
            m = midi(bar[ni])
            # the two lowest notes ring on (they are held in the score)
            dur = SIXTEENTH * (8 - k) + 0.6 if ni < 2 and k < 2 else SIXTEENTH * 3
            vel = 0.55 if ni == 0 else 0.42
            key = (m, round(dur, 2))
            if key not in cache:
                cache[key] = pluck(440 * 2 ** ((m - 69) / 12), dur, 1)
            sig = cache[key] * vel
            t0 = int(step * SIXTEENTH * SR)
            out[t0:t0 + len(sig)] += sig[:len(out) - t0]
# final C major chord, arpeggiated
for j, n in enumerate(['C2', 'C3', 'E3', 'G3', 'C4', 'E4']):
    t0 = int((len(bars) * 16 * SIXTEENTH + j * 0.05) * SR)
    sig = pluck(440 * 2 ** ((midi(n) - 69) / 12), 3.0, 1) * 0.45
    out[t0:t0 + len(sig)] += sig[:len(out) - t0]

# small room: a few early reflections
room = out.copy()
for d, g in [(0.023, 0.35), (0.041, 0.25), (0.067, 0.18), (0.113, 0.12)]:
    k = int(d * SR)
    room[k:] += out[:-k] * g
room /= np.max(np.abs(room)) / 0.8
pcm = ROOT / 'tools' / 'audio' / 'prelude.wav'
import wave
with wave.open(str(pcm), 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((room * 32767).astype(np.int16).tobytes())
dst = ROOT / 'sfx' / 'music-prelude.mp3'
subprocess.run(['ffmpeg', '-nostdin', '-loglevel', 'error', '-y', '-i', str(pcm), '-af', 'lowpass=f=4200,highpass=f=60,loudnorm=I=-20:TP=-2', '-ac', '1', '-ar', '44100', '-b:a', '64k', str(dst)], check=True)
pcm.unlink()
print('wrote', dst, dst.stat().st_size, 'bytes,', round(len(room) / SR, 1), 's')
