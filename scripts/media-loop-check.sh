#!/usr/bin/env bash
# Usage: loopcheck.sh <clip.mp4> <outdir>
# Prints stream info, writes a 10-frame contact sheet plus first/last frames, and
# compares SSIM of (t vs T-t, reversed) against (t vs t+gap, forward) to detect ping-pong motion.
set -euo pipefail
CLIP="$1"; OUT="$2"; mkdir -p "$OUT"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FF="$(cd "$ROOT" && node -p "require('ffmpeg-static')")"
NAME="$(basename "${CLIP%.*}")"
echo "== $NAME"
"$FF" -hide_banner -i "$CLIP" 2>&1 | grep -E "Duration|Stream" || true
DUR="$("$FF" -hide_banner -i "$CLIP" 2>&1 | sed -n 's/.*Duration: \([0-9:.]*\),.*/\1/p' | awk -F: '{print ($1*3600)+($2*60)+$3}' || true)"
echo "duration_s=$DUR"
"$FF" -y -loglevel error -i "$CLIP" -vf "fps=10/$DUR,scale=360:-1,tile=5x2" "$OUT/$NAME-sheet.png"
"$FF" -y -loglevel error -i "$CLIP" -frames:v 1 "$OUT/$NAME-first.png"
"$FF" -y -loglevel error -sseof -0.05 -i "$CLIP" -frames:v 1 -update 1 "$OUT/$NAME-last.png"
A="$(awk -v d="$DUR" 'BEGIN{printf "%.2f", d*0.4}')"   # compare the first 40% ...
B="$(awk -v d="$DUR" 'BEGIN{printf "%.2f", d*0.6}')"   # ... against the last 40%
rev="$("$FF" -hide_banner -i "$CLIP" -i "$CLIP" -filter_complex "[0:v]trim=0:$A,setpts=PTS-STARTPTS[a];[1:v]trim=$B:$DUR,setpts=PTS-STARTPTS,reverse[b];[a][b]ssim" -f null - 2>&1 | sed -n 's/.*All:\([0-9.]*\).*/\1/p')"
fwd="$("$FF" -hide_banner -i "$CLIP" -i "$CLIP" -filter_complex "[0:v]trim=0:$A,setpts=PTS-STARTPTS[a];[1:v]trim=$B:$DUR,setpts=PTS-STARTPTS[b];[a][b]ssim" -f null - 2>&1 | sed -n 's/.*All:\([0-9.]*\).*/\1/p')"
seam="$("$FF" -hide_banner -i "$OUT/$NAME-first.png" -i "$OUT/$NAME-last.png" -filter_complex "[0:v][1:v]ssim" -f null - 2>&1 | sed -n 's/.*All:\([0-9.]*\).*/\1/p')"
echo "ssim_reversed_halves=$rev   (near 1.0 means the second half plays the first half backwards)"
echo "ssim_forward_halves=$fwd    (baseline: same frames compared in forward order)"
echo "ssim_first_vs_last=$seam    (loop seam: higher is a cleaner loop)"
