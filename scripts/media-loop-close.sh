#!/usr/bin/env bash
# Usage: loopclose.sh <in.mp4> <out.mp4> [fade_seconds=0.5]
# Closes a loop by crossfading the clip's last <fade> seconds into its first <fade> seconds.
# Output = clip[fade..end] with the head blended over its tail, so the last frame equals the first.
set -euo pipefail
IN="$1"; OUT="$2"; FADE="${3:-0.5}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FF="$(cd "$ROOT" && node -p "require('ffmpeg-static')")"
DUR="$("$FF" -hide_banner -i "$IN" 2>&1 | sed -n 's/.*Duration: \([0-9:.]*\),.*/\1/p' | awk -F: '{print ($1*3600)+($2*60)+$3}' || true)"
OFFSET="$(awk -v d="$DUR" -v f="$FADE" 'BEGIN{printf "%.3f", d - 2*f}')"
"$FF" -y -loglevel error -i "$IN" -filter_complex \
  "[0:v]split[a][b];[a]trim=start=$FADE,setpts=PTS-STARTPTS[main];[b]trim=0:$FADE,setpts=PTS-STARTPTS[head];[main][head]xfade=transition=fade:duration=$FADE:offset=$OFFSET,format=yuv420p[out]" \
  -map "[out]" -an -c:v libx264 -preset slow -crf 14 -movflags +faststart "$OUT"
NEWDUR="$("$FF" -hide_banner -i "$OUT" 2>&1 | sed -n 's/.*Duration: \([0-9:.]*\),.*/\1/p' | awk -F: '{print ($1*3600)+($2*60)+$3}' || true)"
SEAM="$("$FF" -hide_banner -i "$OUT" -i "$OUT" -filter_complex "[0:v]select='eq(n\,0)',setpts=PTS-STARTPTS[f];[1:v]reverse,select='eq(n\,0)',setpts=PTS-STARTPTS[l];[f][l]ssim" -frames:v 1 -f null - 2>&1 | sed -n 's/.*All:\([0-9.]*\).*/\1/p' || true)"
echo "$(basename "$OUT"): in ${DUR}s -> out ${NEWDUR}s, fade ${FADE}s, first-vs-last ssim ${SEAM}"
