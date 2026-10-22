#!/usr/bin/env python3
"""Boss voice builder: lines.json -> sfx/voice/<boss>-<event>-<n>.mp3 + sfx/voice/index.json.

Called by make-voices.sh (which installs Piper / downloads the model first).
Usage: build_voices.py <repo_root> <tts_engine: piper|espeak> [piper_model.onnx]
"""
import concurrent.futures as cf
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import wave

TARGET_LUFS = -16.0
LIMIT_DB = -1.0          # limiter ceiling (dBFS)
SHORT_CLIP_S = 0.4       # below this EBU R128 integrated loudness is unreliable -> RMS
EVENTS = ("intro", "taunt", "enrage", "death")


def st(semitones):
    """Semitones -> rubberband pitch ratio."""
    return f"{2 ** (semitones / 12):.5f}"


def rb(semi, tempo=1.0):
    return f"rubberband=pitch={st(semi)}:tempo={tempo}"


def dark_echo(lab, d1, g1, d2, g2, lp):
    """Echo tail of two low-passed delayed copies: sounds like a big space but keeps the
    consonants (and so the words) clear, unlike a full-band aecho."""
    return (f"asplit=3[{lab}d][{lab}e1][{lab}e2];"
            f"[{lab}e1]lowpass=f={lp},adelay={d1}:all=1,volume={g1}[{lab}x1];"
            f"[{lab}e2]lowpass=f={int(lp * 0.7)},adelay={d2}:all=1,volume={g2}[{lab}x2];"
            f"[{lab}d][{lab}x1][{lab}x2]amix=inputs=3:normalize=0:duration=longest")


def duck_echo(lab, delay, decays, lp, gain):
    """Big echo that is sidechain-ducked by the dry voice: it blooms in the pauses and after
    the line instead of smearing over the words."""
    return (f"asplit=3[{lab}d][{lab}s][{lab}w];"
            f"[{lab}w]lowpass=f={lp},adelay={delay}:all=1,"
            f"aecho=0.8:1:{delay}|{2 * delay}:{decays},volume={gain}[{lab}we];"
            f"[{lab}s]apad=pad_dur=3[{lab}sc];"
            f"[{lab}we][{lab}sc]sidechaincompress=threshold=0.015:ratio=10:attack=5:release=300[{lab}wd];"
            f"[{lab}d][{lab}wd]amix=inputs=2:normalize=0:duration=longest")


# Per-style settings: TTS speed (length_scale >1 = slower) and an ffmpeg filter graph from
# [in] to [out]. Graphs run on mono float 44.1 kHz, silence already trimmed and RMS-normalised
# to PRE_RMS_DB (so overdrive amounts are consistent); loudness + limiter come afterwards.
# Tuned against a Whisper (base.en) transcription check - pitch drops past about -7 st and
# full-band echoes were what hurt intelligibility most. Avoid ffmpeg 6.1's `vibrato` (NaNs).
FX = {
    # deep, gravelly: -6 st, chest boost, 28 Hz tremolo "rattle", mild tanh overdrive, small room
    "brute": dict(length_scale=1.05, graph=(
        f"[in]{rb(-6)},equalizer=f=110:t=q:w=1:g=5,equalizer=f=2200:t=q:w=1.5:g=3,"
        "tremolo=f=28:d=0.3,volume=5dB,asoftclip=type=tanh,volume=-5dB,"
        "aecho=0.8:0.5:35|60:0.2|0.12[out]")),
    # higher + cackly: +2 st, flanger sweep, fast 7 Hz pitch wobble (dry-less chorus), bright
    "witch": dict(length_scale=1.0, graph=(
        f"[in]{rb(2)},flanger=delay=2:depth=4:regen=25:width=70:speed=0.6,"
        "chorus=0:1:6:1:7:1.5,equalizer=f=3000:t=q:w=1.5:g=3,"
        "aecho=0.8:0.6:60|120:0.25|0.15[out]")),
    # layered swarm: three pitched copies (-5/-8/-2 st, offset) + 3-voice chorus + hissy treble
    "swarm": dict(length_scale=1.0, graph=(
        "[in]asplit=3[a][b][c];"
        f"[a]{rb(-5)}[a1];"
        f"[b]{rb(-8)},adelay=12:all=1,volume=0.5[b1];"
        f"[c]{rb(-2)},adelay=24:all=1,highpass=f=2500,volume=0.6[c1];"
        "[a1][b1][c1]amix=inputs=3:normalize=0,"
        "chorus=0.7:0.9:45|55|35:0.25|0.2|0.2:0.3|0.45|0.6:2|2.5|1.5,"
        "treble=g=6:f=5000,aecho=0.8:0.8:40|80:0.15|0.1[out]")),
    # very deep + big echo: -6.5 st, subtle chorus, 300/600 ms echo ducked under the voice
    "void": dict(length_scale=1.05, graph=(
        f"[in]{rb(-6.5)},lowpass=f=7000,equalizer=f=90:t=q:w=1:g=4,"
        "equalizer=f=2000:t=q:w=1.5:g=3,chorus=0.8:0.9:9|13:0.2|0.15:0.4|0.6:1|1.2,"
        f"{duck_echo('v', 300, '0.5|0.25', 2500, 0.6)}[out]")),
    # deepest, slow, rumbly: slower TTS, -7 st, big low end, slight 6 Hz wobble, saturation
    "giant": dict(length_scale=1.15, graph=(
        f"[in]{rb(-7)},lowpass=f=6500,equalizer=f=70:t=q:w=1:g=6,"
        "equalizer=f=2000:t=q:w=1.5:g=4,tremolo=f=6:d=0.08,"
        "volume=3dB,asoftclip=type=atan,volume=-3dB,"
        "aecho=0.8:0.9:80|160:0.15|0.08[out]")),
    # deep + crackly: -6 st, hard clip, bit/sample-crusher crackle, bright, echo
    "storm": dict(length_scale=1.0, graph=(
        f"[in]{rb(-6)},volume=6dB,asoftclip=type=hard:threshold=0.7,volume=-4dB,"
        "acrusher=bits=8:mode=log:aa=0.5:samples=2:mix=0.25,"
        "treble=g=3:f=4000,aecho=0.8:0.8:50|200:0.2|0.12[out]")),
    # three heads talking at once: copies at -5/-6.5/-3.5 st, staggered 0/20/40 ms
    "hydra": dict(length_scale=1.0, graph=(
        "[in]asplit=3[a][b][c];"
        f"[a]{rb(-5)}[a1];"
        f"[b]{rb(-6.5)},adelay=20:all=1[b1];"
        f"[c]{rb(-3.5)},adelay=40:all=1[c1];"
        "[a1][b1][c1]amix=inputs=3:weights=1 0.6 0.6:normalize=0,"
        "equalizer=f=2200:t=q:w=1.5:g=3,volume=3dB,asoftclip=type=tanh,volume=-3dB,"
        "aecho=0.8:0.8:40|70:0.15|0.1[out]")),
    # hollow & ghostly: -5 st, band-limited, 7/13 ms comb (tube), chorus, dark 240/480 ms echo
    "lich": dict(length_scale=1.05, graph=(
        f"[in]{rb(-5)},highpass=f=150,lowpass=f=6500,aecho=0.9:0.9:7|13:0.3|0.2,"
        "chorus=0.6:0.9:40|55:0.3|0.25:0.3|0.5:2|1.7,equalizer=f=2500:t=q:w=1.5:g=3,"
        f"{dark_echo('l', 240, 0.22, 480, 0.1, 2000)}[out]")),
}

PRE_RMS_DB = -20.0      # level speech is brought to before the fx graph
# start_duration ignores short clicks/blips Piper sometimes emits before the speech
TRIM_START = "silenceremove=start_periods=1:start_threshold=-45dB:start_duration=0.02:start_silence=0.02"
TRIM_TAIL = ("areverse,silenceremove=start_periods=1:start_threshold={thr}:start_duration=0.02:"
             "start_silence=0.05,areverse")


def run(cmd):
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode != 0:
        raise RuntimeError(f"command failed: {' '.join(cmd)}\n{p.stderr[-2000:]}")
    return p.stderr


def ff(*args):
    return run(["ffmpeg", "-hide_banner", "-nostdin", "-y", *args])


def duration(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                          "-of", "csv=p=0", path], capture_output=True, text=True).stdout
    return float(out.strip())


def astats(path):
    err = ff("-i", path, "-af", "astats=measure_perchannel=none", "-f", "null", "-")
    def get(key):
        v = re.findall(key + r":\s*(\S+)", err)[-1]
        return float(v) if v not in ("-inf", "inf", "nan") else float(v.replace("nan", "inf"))
    return {"rms": get("RMS level dB"), "peak": get("Peak level dB"),
            "nan": get("Number of NaNs"), "inf": get("Number of Infs")}


def loudness(path):
    """Integrated loudness (LUFS) and true peak (dBTP); RMS fallback for very short clips."""
    err = ff("-nostats", "-i", path, "-filter_complex", "ebur128=peak=true", "-f", "null", "-")
    i = float(re.findall(r"I:\s+(-?[\d.]+) LUFS", err)[-1])
    tp = float(re.findall(r"Peak:\s+(-?[\d.]+|-inf) dBFS", err)[-1])
    if duration(path) < SHORT_CLIP_S or i <= -69.0:
        err = ff("-i", path, "-af", "astats=measure_perchannel=none:measure_overall=RMS_level",
                 "-f", "null", "-")
        i = float(re.findall(r"RMS level dB:\s*(-?[\d.]+)", err)[-1])
    return i, tp


def tts_text(text):
    """Text as fed to the TTS (index.json keeps the original).
    - shouted ALL-CAPS words can get spelled out letter by letter -> feed them as normal words
    - a mid-line "..." is dropped by the phonemiser; a comma keeps the dramatic pause"""
    text = re.sub(r"\b([A-Z]{2,})\b", lambda m: m.group(1).capitalize(), text)
    return re.sub(r"\s*(\.\.\.|…)\s*(?=\w)", ", ", text)


class Synth:
    def __init__(self, engine, model=None):
        self.engine = engine
        if engine == "piper":
            from piper import PiperVoice, SynthesisConfig
            self.voice = PiperVoice.load(model)
            self.cfg = SynthesisConfig

    def __call__(self, text, length_scale, out_wav):
        if self.engine == "piper":
            with wave.open(out_wav, "wb") as w:
                self.voice.synthesize_wav(tts_text(text), w,
                                          syn_config=self.cfg(length_scale=length_scale))
        else:
            speed = int(165 / length_scale)
            run(["espeak-ng", "-v", "en-us+m3", "-s", str(speed), "-w", out_wav, tts_text(text)])


def process(raw_wav, style, out_mp3, tmp):
    base = os.path.splitext(os.path.basename(out_mp3))[0]
    # 1) resample + trim silence, then RMS-normalise
    trim_wav = os.path.join(tmp, base + ".trim.wav")
    ff("-i", raw_wav, "-af", f"aresample=44100,aformat=sample_fmts=flt:channel_layouts=mono,"
       f"{TRIM_START},{TRIM_TAIL.format(thr='-45dB')}", "-c:a", "pcm_f32le", trim_wav)
    pre_gain = PRE_RMS_DB - astats(trim_wav)["rms"]
    # 2) style graph, trim the fx tail, de-click fades
    post = (f"{TRIM_TAIL.format(thr='-55dB')},afade=t=in:d=0.005,"
            "areverse,afade=t=in:d=0.04,areverse")
    graph = (f"[0:a]volume={pre_gain:.2f}dB[in];{FX[style]['graph'].replace('[out]', '[fx]')};"
             f"[fx]{post}[out]")
    fx_wav = os.path.join(tmp, base + ".fx.wav")
    ff("-i", trim_wav, "-filter_complex", graph, "-map", "[out]", "-c:a", "pcm_f32le", fx_wav)
    st_fx = astats(fx_wav)
    if st_fx["nan"] or st_fx["inf"]:
        raise RuntimeError(f"{base}: fx graph '{style}' produced NaN/Inf samples")

    # 3) measure -> linear gain + limiter -> mp3; correction passes if the limiter ate loudness
    i, _ = loudness(fx_wav)
    gain = TARGET_LUFS - i
    for _ in range(3):
        ff("-i", fx_wav, "-af",
           f"volume={gain:.2f}dB,apad=pad_dur=0.02,"
           f"alimiter=limit={10 ** (LIMIT_DB / 20):.4f}:attack=3:release=40:level=false:latency=true",
           "-ac", "1", "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "64k",
           "-map_metadata", "-1", out_mp3)
        i2, _ = loudness(out_mp3)
        if abs(i2 - TARGET_LUFS) <= 0.7:
            break
        gain += min(TARGET_LUFS - i2, 6.0)
    return duration(out_mp3)


def main():
    root, engine = sys.argv[1], sys.argv[2]
    model = sys.argv[3] if len(sys.argv) > 3 else None
    lines = json.load(open(os.path.join(root, "tools/voices/lines.json")))["bosses"]
    out_dir = os.path.join(root, "sfx/voice")
    os.makedirs(out_dir, exist_ok=True)
    index_path = os.path.join(out_dir, "index.json")

    # files from a previous run (so removed lines don't leave stale mp3s behind)
    old_files = set()
    if os.path.exists(index_path):
        try:
            for ev in json.load(open(index_path)).values():
                for clips in ev.values():
                    old_files.update(c["file"] for c in clips)
        except Exception:
            pass

    synth = Synth(engine, model)
    tmp = tempfile.mkdtemp(prefix="voices-")
    jobs, index = [], {}
    try:
        for boss, spec in lines.items():
            style = spec["fx"]
            if style not in FX:
                sys.exit(f"unknown fx style '{style}' for boss '{boss}'")
            index[boss] = {}
            for event in EVENTS:
                index[boss][event] = []
                for n, text in enumerate(spec.get(event, []), start=1):
                    rel = f"sfx/voice/{boss}-{event}-{n}.mp3"
                    raw = os.path.join(tmp, f"{boss}-{event}-{n}.raw.wav")
                    synth(text, FX[style]["length_scale"], raw)
                    entry = {"file": rel, "text": text, "duration": None}
                    index[boss][event].append(entry)
                    jobs.append((entry, raw, style, os.path.join(root, rel)))
            print(f"  synthesised {boss} ({style})", flush=True)

        with cf.ThreadPoolExecutor(max_workers=os.cpu_count() or 4) as pool:
            futs = {pool.submit(process, raw, style, mp3, tmp): entry
                    for entry, raw, style, mp3 in jobs}
            for f in cf.as_completed(futs):
                futs[f]["duration"] = round(f.result(), 3)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    new_files = {e["file"] for ev in index.values() for clips in ev.values() for e in clips}
    for stale in old_files - new_files:
        p = os.path.join(root, stale)
        if stale.startswith("sfx/voice/") and os.path.exists(p):
            os.remove(p)
            print(f"  removed stale {stale}")

    with open(index_path, "w") as fh:
        json.dump(index, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    print(f"  wrote {len(new_files)} clips + sfx/voice/index.json")
    for ev in index.values():
        for clips in ev.values():
            for e in clips:
                if not 0.5 <= e["duration"] <= 4.0:
                    print(f"  warning: {e['file']} is {e['duration']} s (expected 0.5-4 s)")


if __name__ == "__main__":
    main()
