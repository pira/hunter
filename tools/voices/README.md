# Boss voices

Turns `lines.json` into spoken, monster-styled clips for the bosses.

```
tools/voices/make-voices.sh
```

Output:

- `sfx/voice/<boss>-<event>-<n>.mp3` (n starts at 1), mono, 44.1 kHz, 64 kbps, about −16 LUFS
- `sfx/voice/index.json`, shaped like `{ boss: { event: [ { file, text, duration } ] } }`. The events are `intro`, `taunt`, `enrage` and `death`, and `duration` is in seconds.

Each run rebuilds every clip. It also deletes any clip listed in the previous `index.json` that is no longer in `lines.json`. A full run takes about 30 s. Piper is not deterministic, so each run gives slightly different takes.

## Changing lines or adding a boss

Edit `lines.json`, then re-run the script. Every boss needs an `fx` set to one of the styles below. To change or add a style, edit `FX` in `build_voices.py`.

| fx | character | chain (summary) |
|---|---|---|
| brute | deep, gravelly | −6 st, chest EQ, 28 Hz tremolo rattle, tanh overdrive, small room |
| witch | higher, cackly | +2 st, flanger, 7 Hz pitch wobble, presence boost, light echo |
| swarm | layered, hissy | 3 copies (−5/−8/−2 st, offset), 3-voice chorus, treble boost |
| void | very deep, big echo | −6.5 st, subtle chorus, 300/600 ms echo ducked under the voice |
| giant | deepest, slow, rumbly | slower speech, −7 st, heavy low end, slow wobble, saturation |
| storm | deep, crackly | −6 st, hard clip, bit/sample crusher, bright, echo |
| hydra | three heads at once | 3 detuned copies (−5/−6.5/−3.5 st), staggered 0/20/40 ms |
| lich | hollow, ghostly | −5 st, band-limited, 7/13 ms comb ("tube"), chorus, dark echo |

How each clip is processed:

1. Piper TTS.
2. Trim silence and normalise RMS.
3. Pitch-shift with the ffmpeg `rubberband` filter, then apply the style graph.
4. Trim the tail and fade the ends to avoid clicks.
5. Measure EBU R128 loudness and apply linear gain. Clips shorter than 0.4 s use RMS instead, because R128 can't measure them.
6. Run `alimiter` at −1 dBFS and encode with LAME.
7. Re-measure, and correct up to two more times if the result is more than 0.7 LU off target.

Tuning notes:

- I tuned the chains for intelligibility by transcribing every clip with Whisper `base.en`. Clean TTS scores 0.92 word recall. The styled clips score roughly 0.65–0.8.
- Pitch drops beyond about −7 st hurt intelligibility badly. So do full-band echoes, which is why void and lich use ducked or low-passed echoes.
- Don't use ffmpeg 6.1's `vibrato` filter: it outputs NaNs. The script aborts if an fx graph produces NaN or Inf samples.

## TTS voice and license

- **Engine:** [Piper](https://github.com/OHF-Voice/piper1-gpl) (`pip install piper-tts`, tested with 1.8.0). Piper is only a build tool and is not shipped with the game.
- **Voice:** `en_US-john-medium`, a US English male voice from <https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_US/john/medium>. It is downloaded once into `tools/voices/.cache/`, which is gitignored, together with its `MODEL_CARD`.
- **Licenses:**
  - The model card says the training data is LibriVox recordings, **license: public domain**.
  - The voice was fine-tuned from `kristin` (medium), which was trained from scratch on LibriVox recordings, also **public domain**.
  - The `rhasspy/piper-voices` repository, which holds the model weights, is **MIT**-licensed.
  - Commercial use of the generated audio is therefore fine.
- **Voices I rejected:**
  - `en_US-norman-medium` (public domain) babbles for several seconds after short exclamations like "Ha!" and "Zapped!".
  - `en_US-ljspeech-high` (public domain) is robust but female.
  - `ryan` and `hfc_male` are non-commercial (CC BY-NC).
  - `joe` is fine-tuned from `lessac`, whose dataset license is restrictive.

Text tweaks applied before TTS only (`index.json` keeps the original text):

- ALL-CAPS words become normal case, so they aren't spelled out letter by letter.
- A mid-line `...` becomes a comma, which keeps the dramatic pause.

## Fallback

If `piper-tts` can't be installed or the model can't be downloaded, the script switches to **espeak-ng** (voice `en-us+m3`) and installs it with apt if needed. It prints a warning when this happens. espeak-ng is GPL software, but the audio it generates isn't restricted.

To force the fallback, run `TTS_ENGINE=espeak tools/voices/make-voices.sh`. It sounds noticeably more robotic.

## Requirements

- bash, python3 and curl
- ffmpeg built with `rubberband` and `libmp3lame`. Ubuntu's ffmpeg 6.1 has both, and the script checks for them.
