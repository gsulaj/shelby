#!/usr/bin/env bash
# Stitch the three hero orbit clips (HERO_BRIEF.md Plan B) into one seamless loop.
# Usage: [BLEND_FRAMES=3] [TRIMS="0,0 0,1 0,10"] bash scripts/hero-stitch.sh <clip1.mp4> <clip2.mp4> <clip3.mp4> <out.mp4> [workdir]
#
# 1. Motion per frame: ffmpeg signalstats YDIF (mean |luma difference| to the previous frame).
# 2. Easing trim: frames at the head or tail of a clip whose YDIF is below EASE_FRACTION of that clip's
#    median are cut, so the camera speed reads constant through every seam.
# 3. Joins: the trimmed clips are crossfaded over BLEND_FRAMES at each seam; the loop point gets the same
#    blend by fading the clip's head into its tail (the output ends on a frame that blends into its start).
# 4. The result is written as a near-lossless intermediate (CRF 12); encode for the web with
#    scripts/process-media.sh. A speed table around every join is printed at the end.
set -euo pipefail
C1="$1"; C2="$2"; C3="$3"; OUT="$4"; WORK="${5:-$(dirname "$OUT")/stitch-work}"
EASE_FRACTION="${EASE_FRACTION:-0.5}"
# TRIMS="h0,t0 h1,t1 h2,t2" forces the per-clip head/tail frame cuts instead of detecting easing (exact re-stitch).
TRIMS="${TRIMS:-}"
BLEND_FRAMES="${BLEND_FRAMES:-7}"
FPS=24
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FF="${FFMPEG:-$(cd "$ROOT" && node -p "require('ffmpeg-static')")}"
mkdir -p "$WORK"

ydif() { # <clip> -> one YDIF value per line (frame 0 first)
  "$FF" -hide_banner -loglevel error -i "$1" -vf "signalstats,metadata=print:key=lavfi.signalstats.YDIF:file=-" -f null - \
    | sed -n 's/.*YDIF=//p'
}
median() { sort -n | awk '{ a[NR] = $1 } END { if (NR % 2) print a[(NR + 1) / 2]; else print (a[NR / 2] + a[NR / 2 + 1]) / 2 }'; }

# common frame size: Kling clips can differ by a few pixels (1928x1072 vs 1928x1076); crop to the smallest
dims() { "$FF" -hide_banner -i "$1" 2>&1 | sed -n 's/.*Video:.* \([0-9][0-9]*\)x\([0-9][0-9]*\)[ ,].*/\1 \2/p' | head -1; }
CW=99999; CH=99999
for clip in "$C1" "$C2" "$C3"; do read -r w h <<<"$(dims "$clip")"; (( w < CW )) && CW=$w; (( h < CH )) && CH=$h; done
NORM="crop=$CW:$CH"
echo "common frame size: ${CW}x${CH}"

declare -a HEAD TAIL FRAMES MED
i=0
for clip in "$C1" "$C2" "$C3"; do
  ydif "$clip" > "$WORK/ydif-$i.txt"
  n="$(wc -l < "$WORK/ydif-$i.txt" | tr -d ' ')"
  # frame 0 has no previous frame (YDIF 0): ignore it for the median and never count it as easing
  med="$(tail -n +2 "$WORK/ydif-$i.txt" | median)"
  thr="$(awk -v m="$med" -v f="$EASE_FRACTION" 'BEGIN { print m * f }')"
  head_cut="$(tail -n +2 "$WORK/ydif-$i.txt" | awk -v t="$thr" '{ if ($1 < t) c++; else exit } END { print c + 0 }')"
  tail_cut="$(tail -r "$WORK/ydif-$i.txt" | awk -v t="$thr" '{ if ($1 < t) c++; else exit } END { print c + 0 }')"
  if [[ -n "$TRIMS" ]]; then
    forced="$(echo "$TRIMS" | awk -v k="$((i + 1))" '{ print $k }')"
    head_cut="${forced%,*}"; tail_cut="${forced#*,}"
  fi
  HEAD[$i]=$head_cut; TAIL[$i]=$tail_cut; FRAMES[$i]=$n; MED[$i]=$med
  printf "clip %d: %s frames, median YDIF %.3f, easing cut: %d head / %d tail frames\n" "$((i + 1))" "$n" "$med" "$head_cut" "$tail_cut"
  i=$((i + 1))
done

# trimmed lengths in frames and the xfade offsets (seconds)
len() { echo $(( ${FRAMES[$1]} - ${HEAD[$1]} - ${TAIL[$1]} )); }
L0=$(len 0); L1=$(len 1); L2=$(len 2)
BD="$(awk -v b="$BLEND_FRAMES" -v f="$FPS" 'BEGIN { printf "%.4f", b / f }')"
OFF1="$(awk -v l="$L0" -v b="$BLEND_FRAMES" -v f="$FPS" 'BEGIN { printf "%.4f", (l - b) / f }')"
OFF2="$(awk -v l0="$L0" -v l1="$L1" -v b="$BLEND_FRAMES" -v f="$FPS" 'BEGIN { printf "%.4f", (l0 + l1 - 2 * b) / f }')"
TOTAL=$(( L0 + L1 + L2 - 2 * BLEND_FRAMES ))
echo "trimmed lengths: $L0 + $L1 + $L2 frames, two blends of $BLEND_FRAMES → chain $TOTAL frames ($(awk -v t="$TOTAL" -v f="$FPS" 'BEGIN { printf "%.2f", t / f }') s)"

# chain the three clips with crossfades at both seams
"$FF" -y -loglevel error -i "$C1" -i "$C2" -i "$C3" -filter_complex \
  "[0:v]$NORM,trim=start_frame=${HEAD[0]}:end_frame=$(( ${FRAMES[0]} - ${TAIL[0]} )),setpts=PTS-STARTPTS[a];
   [1:v]$NORM,trim=start_frame=${HEAD[1]}:end_frame=$(( ${FRAMES[1]} - ${TAIL[1]} )),setpts=PTS-STARTPTS[b];
   [2:v]$NORM,trim=start_frame=${HEAD[2]}:end_frame=$(( ${FRAMES[2]} - ${TAIL[2]} )),setpts=PTS-STARTPTS[c];
   [a][b]xfade=transition=fade:duration=$BD:offset=$OFF1[ab];
   [ab][c]xfade=transition=fade:duration=$BD:offset=$OFF2,format=yuv420p[out]" \
  -map "[out]" -r $FPS -an -c:v libx264 -preset slow -crf 12 "$WORK/chain.mp4"

# close the loop: blend the chain's head over its tail so the last frame flows into the first
CHAIN_DUR="$(awk -v t="$TOTAL" -v f="$FPS" 'BEGIN { printf "%.4f", t / f }')"
LOOP_OFF="$(awk -v d="$CHAIN_DUR" -v b="$BD" 'BEGIN { printf "%.4f", d - 2 * b }')"
"$FF" -y -loglevel error -i "$WORK/chain.mp4" -filter_complex \
  "[0:v]split[x][y];[x]trim=start=$BD,setpts=PTS-STARTPTS[main];[y]trim=0:$BD,setpts=PTS-STARTPTS[head];
   [main][head]xfade=transition=fade:duration=$BD:offset=$LOOP_OFF,format=yuv420p[out]" \
  -map "[out]" -r $FPS -an -c:v libx264 -preset slow -crf 12 -movflags +faststart "$OUT"
FINAL=$(( TOTAL - BLEND_FRAMES ))
echo "loop closed: $FINAL frames ($(awk -v t="$FINAL" -v f="$FPS" 'BEGIN { printf "%.2f", t / f }') s) → $OUT"

# speed check: YDIF around each join of the final loop (join frames are after the head trim of the loop blend)
ydif "$OUT" > "$WORK/ydif-out.txt"
J1=$(( L0 - BLEND_FRAMES - BLEND_FRAMES )); J2=$(( L0 + L1 - 3 * BLEND_FRAMES ))
report() { # <label> <centre frame>
  local c="$2" from to
  from=$(( c - 12 )); to=$(( c + 12 ))
  (( from < 1 )) && from=1
  printf "%s (frames %d..%d, join at %d): " "$1" "$from" "$to" "$c"
  awk -v a="$from" -v b="$to" -v c="$c" 'NR - 1 >= a && NR - 1 <= b { v = sprintf("%.2f", $1); if (NR - 1 == c) v = "[" v "]"; printf "%s ", v } END { print "" }' "$WORK/ydif-out.txt"
}
report "join 1 (clip1→clip2)" "$J1"
report "join 2 (clip2→clip3)" "$J2"
printf "loop seam (last 12 → first 12 frames): "; { tail -n 12 "$WORK/ydif-out.txt"; sed -n '2,13p' "$WORK/ydif-out.txt"; } | awk '{ printf "%.2f ", $1 } END { print "" }'
awk 'NR > 1 { s += $1; n++; if ($1 > mx) mx = $1; if (mn == "" || $1 < mn) mn = $1 } END { printf "whole loop: mean YDIF %.2f, min %.2f, max %.2f\n", s / n, mn, mx }' "$WORK/ydif-out.txt"
