#!/usr/bin/env bash
# Regenerate all spoken boss lines: tools/voices/lines.json -> sfx/voice/*.mp3 + sfx/voice/index.json
# Usage: tools/voices/make-voices.sh            (from anywhere; idempotent, rebuilds everything)
#        TTS_ENGINE=espeak tools/voices/make-voices.sh   (force the espeak-ng fallback)
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
CACHE="$HERE/.cache"

VOICE="en_US-john-medium"     # MIT weights, public-domain LibriVox data - see README.md
VOICE_URL="https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/john/medium"

for tool in ffmpeg ffprobe python3; do
  command -v "$tool" >/dev/null || { echo "error: $tool not found" >&2; exit 1; }
done
grep -qw rubberband <<<"$(ffmpeg -hide_banner -filters 2>/dev/null)" \
  || { echo "error: this ffmpeg lacks the rubberband filter" >&2; exit 1; }
grep -qw libmp3lame <<<"$(ffmpeg -hide_banner -encoders 2>/dev/null)" \
  || { echo "error: this ffmpeg lacks libmp3lame" >&2; exit 1; }

engine="${TTS_ENGINE:-piper}"

if [[ "$engine" == "piper" ]]; then
  if ! python3 -c 'import piper' 2>/dev/null; then
    echo "installing piper-tts..."
    pip install -q piper-tts 2>/dev/null || pip install -q --break-system-packages piper-tts || true
  fi
  mkdir -p "$CACHE"
  for f in "$VOICE.onnx" "$VOICE.onnx.json" MODEL_CARD; do
    dest="$CACHE/$f"; [[ "$f" == MODEL_CARD ]] && dest="$CACHE/$VOICE.MODEL_CARD"
    if [[ ! -s "$dest" ]]; then
      echo "downloading $f..."
      curl -fsSL --retry 3 "$VOICE_URL/$f" -o "$dest.part" && mv "$dest.part" "$dest" || rm -f "$dest.part"
    fi
  done
  if ! python3 -c 'import piper' 2>/dev/null || [[ ! -s "$CACHE/$VOICE.onnx" || ! -s "$CACHE/$VOICE.onnx.json" ]]; then
    echo "warning: Piper or its voice model unavailable - falling back to espeak-ng" >&2
    engine="espeak"
  fi
fi

if [[ "$engine" == "espeak" ]] && ! command -v espeak-ng >/dev/null; then
  echo "installing espeak-ng..."
  SUDO=""; [[ $EUID -ne 0 ]] && SUDO="sudo"
  { $SUDO apt-get install -y -q espeak-ng || { $SUDO apt-get update -q && $SUDO apt-get install -y -q espeak-ng; }; } >/dev/null
fi

if [[ "$engine" == "piper" ]]; then echo "TTS engine: piper ($VOICE)"; else echo "TTS engine: espeak-ng"; fi
python3 "$HERE/build_voices.py" "$ROOT" "$engine" "$CACHE/$VOICE.onnx"
