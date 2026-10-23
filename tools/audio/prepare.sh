#!/usr/bin/env bash
# Rebuilds sfx/*.mp3 from the untouched originals in tools/audio/src/.
# Trims long tails (with a fade), folds to mono, resamples to 44.1 kHz, normalises loudness
# to -16 LUFS (measured, then a linear gain + a -1 dBFS limiter) and encodes 96 kbps mp3.
# The game-over music stays stereo. Requires ffmpeg. Usage: tools/audio/prepare.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="$HERE/src"
OUT="$HERE/../../sfx"
TARGET=-16
mkdir -p "$OUT"

# name  max-seconds  fade-seconds  channels  extra-gain-dB
while read -r name len fade ch extra; do
  [ -z "$name" ] && continue
  in="$SRC/$name.mp3"
  [ -f "$in" ] || { echo "skip $name (missing)"; continue; }
  trim="atrim=0:$len,afade=t=out:st=$(printf "%.3f" "$(echo "$len - $fade" | bc -l)"):d=$fade"
  # Measure loudness of the trimmed, downmixed clip.
  I=$(ffmpeg -nostdin -hide_banner -nostats -i "$in" -af "aresample=44100,pan=mono|c0=0.5*c0+0.5*c1,$trim,ebur128" -f null - 2>&1 \
      | awk '/^ *I:/ { v=$2 } END { print v }')
  [ "$ch" = 2 ] && pan="aresample=44100" || pan="aresample=44100,pan=mono|c0=0.5*c0+0.5*c1"
  # Mono sources have a single channel: pan from c0 only.
  if [ "$(ffprobe -v error -show_entries stream=channels -of csv=p=0 "$in")" = 1 ]; then
    [ "$ch" = 2 ] && pan="aresample=44100" || pan="aresample=44100,pan=mono|c0=c0"
    I=$(ffmpeg -nostdin -hide_banner -nostats -i "$in" -af "aresample=44100,$trim,ebur128" -f null - 2>&1 | awk '/^ *I:/ { v=$2 } END { print v }')
  fi
  # Clips shorter than one 400 ms gating block measure as -70 LUFS: fall back to RMS level.
  if [ "$(echo "$I < -60" | bc -l)" = 1 ]; then
    I=$(ffmpeg -nostdin -hide_banner -nostats -i "$in" -af "$pan,$trim,volumedetect" -f null - 2>&1 | awk '/mean_volume/ { print $5 }')
  fi
  gain=$(echo "$TARGET - ($I) + $extra" | bc -l)
  ffmpeg -nostdin -hide_banner -loglevel error -y -i "$in" \
    -af "$pan,$trim,volume=${gain}dB,alimiter=limit=0.89:level=false" \
    -ac "$ch" -ar 44100 -b:a 96k "$OUT/$name.mp3"
  printf '%-16s %5ss  %6s LUFS -> gain %+.1f dB  %s bytes\n' "$name" "$len" "$I" "$gain" "$(wc -c < "$OUT/$name.mp3")"
done <<'LIST'
boom            1.2   0.5   1  0
grenade         0.6   0.25  1  -2
gunshot         0.35  0.15  1  -3
level-up        1.8   0.3   1  0
monster-cry     1.2   0.4   1  -1
powerup         1.3   0.4   1  0
sword-slice     0.5   0.2   1  -2
game-over       45    3     2  -2
LIST
