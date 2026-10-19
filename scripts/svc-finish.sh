#!/usr/bin/env bash
# Finish one services clip (SERVICES_BRIEF.md §4): delivery size, hero grade, seamless loop, grain → master.
# Usage: bash scripts/svc-finish.sh <raw.mp4> <name> [workdir]      (name: roofing | siding | windows | gutters)
# Env:   SIZE (2160) delivery size; FADE (0.5) loop crossfade in seconds; LOOP (xfade | dropdup); GRAIN (5);
#        MASTER_CRF (12); GRADE_ARGS (extra arguments for scripts/svc-grade.mjs, e.g. "--anchors none --lift 1.5");
#        HERO_REF (the hero's grain-free graded master, the grade reference); REMAP_ARGS (when set, even the camera speed
#        with scripts/svc-remap.mjs after sizing, e.g. "--target-pct 80"; speed-up only).
# Steps, all ffmpeg (ffmpeg-static) + node, no credits:
#   1. scale to SIZE×SIZE (lanczos; the native-4K Kling clips are 2880², the Starlight gutters clip is already 2160²),
#      lossless;
#   1b. optional speed-up-only time-remap to constant camera speed (scripts/svc-remap.mjs), when REMAP_ARGS is set;
#   2. grade: the hero's finishing grade + a class-anchored correction to the hero master (scripts/svc-grade.mjs);
#   3. loop: LOOP=xfade crossfades the last FADE seconds into the first (the clip loses FADE seconds and its last frame
#      leads into frame 0 as an ordinary forward step; never ping-pong); LOOP=dropdup drops a final frame that repeats
#      frame 0 (a locked-camera clip that already starts and ends on the same still). This lossless file is the
#      grain-free master every sharpness, flicker and colour measurement uses: assets-raw/originals/svc-<name>.v2-clean.mp4;
#   4. grain last, at the delivery scale (the hero's calibration, noise=alls=5:allf=t+u) → assets-raw/svc-<name>.mp4,
#      H.264 CRF MASTER_CRF, the file scripts/process-media.sh encodes.
# Prints frame counts, the loop seam (SSIM of the last frame against frame 0 and the 480 px motion around the wrap).
set -euo pipefail
IN="$1"; NAME="$2"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="${3:-$ROOT/.superpowers/sdd/SERVICES_BRIEF/finish/$NAME}"
SIZE="${SIZE:-2160}"; FADE="${FADE:-0.5}"; LOOP="${LOOP:-xfade}"; GRAIN="${GRAIN:-5}"; MASTER_CRF="${MASTER_CRF:-12}"
GRADE_ARGS="${GRADE_ARGS:-}"; REMAP_ARGS="${REMAP_ARGS:-}"
HERO_REF="${HERO_REF:-$ROOT/.superpowers/sdd/HERO_BRIEF/sharpness/new-clean-master.mp4}"
[[ -f "$HERO_REF" ]] || HERO_REF="$ROOT/assets-raw/hero-flyover.master-4k.mp4"
FF="${FFMPEG:-$(cd "$ROOT" && node -p "require('ffmpeg-static')")}"
CLEAN="$ROOT/assets-raw/originals/svc-$NAME.v2-clean.mp4"
OUT="$ROOT/assets-raw/svc-$NAME.mp4"
mkdir -p "$WORK"
frames() { "$FF" -hide_banner -i "$1" -map 0:v -c copy -f null - 2>&1 | grep -o "frame= *[0-9]*" | tail -1 | tr -dc '0-9'; }
LOSSLESS=(-an -c:v libx264 -qp 0 -preset fast -pix_fmt yuv420p -color_range tv -video_track_timescale 12288)

N0="$(frames "$IN")"
echo "== $NAME: $IN ($N0 frames)"
# 1. delivery size
"$FF" -y -loglevel error -i "$IN" -vf "scale=${SIZE}:${SIZE}:flags=lanczos" "${LOSSLESS[@]}" "$WORK/sized.mp4"
# 1b. even the camera speed (optional)
SRC="$WORK/sized.mp4"
if [[ -n "$REMAP_ARGS" ]]; then
  # shellcheck disable=SC2086
  node "$ROOT/scripts/svc-remap.mjs" "$WORK/sized.mp4" "$WORK/remapped.mp4" --workdir "$WORK/remap" $REMAP_ARGS
  SRC="$WORK/remapped.mp4"
  N0="$(frames "$SRC")"
fi
# 2. grade
# shellcheck disable=SC2086
node "$ROOT/scripts/svc-grade.mjs" "$SRC" "$HERO_REF" "$WORK/graded.mp4" --workdir "$WORK/grade" $GRADE_ARGS
# 3. loop
if [[ "$LOOP" == "dropdup" ]]; then
  "$FF" -y -loglevel error -i "$WORK/graded.mp4" -vf "trim=end_frame=$((N0 - 1)),setpts=PTS-STARTPTS" "${LOSSLESS[@]}" "$CLEAN"
else
  DUR="$(awk -v n="$N0" 'BEGIN { printf "%.6f", n / 24 }')"
  OFFSET="$(awk -v d="$DUR" -v f="$FADE" 'BEGIN { printf "%.6f", d - 2 * f }')"
  "$FF" -y -loglevel error -i "$WORK/graded.mp4" -filter_complex \
    "[0:v]split[a][b];[a]trim=start=${FADE},setpts=PTS-STARTPTS[main];[b]trim=0:${FADE},setpts=PTS-STARTPTS[head];[main][head]xfade=transition=fade:duration=${FADE}:offset=${OFFSET},format=yuv420p[out]" \
    -map "[out]" "${LOSSLESS[@]}" "$CLEAN"
fi
N1="$(frames "$CLEAN")"
# 4. grain → master
"$FF" -y -loglevel error -i "$CLEAN" -vf "noise=alls=${GRAIN}:allf=t+u,format=yuv420p" -an -c:v libx264 -profile:v high -preset slow -crf "$MASTER_CRF" \
  -movflags +faststart -video_track_timescale 12288 "$OUT"
N2="$(frames "$OUT")"
SEAM="$("$FF" -hide_banner -i "$CLEAN" -i "$CLEAN" -filter_complex "[0:v]select='eq(n\,$((N1 - 1)))',setpts=0[l];[1:v]select='eq(n\,0)',setpts=0[f];[l][f]ssim" -f null - 2>&1 | sed -n 's/.*All:\([0-9.]*\).*/\1/p')"
NEXT="$("$FF" -hide_banner -i "$CLEAN" -i "$CLEAN" -filter_complex "[0:v]select='eq(n\,0)',setpts=0[a];[1:v]select='eq(n\,1)',setpts=0[b];[a][b]ssim" -f null - 2>&1 | sed -n 's/.*All:\([0-9.]*\).*/\1/p')"
echo "loop ($LOOP): $N0 → $N1 frames ($(awk -v n="$N1" 'BEGIN { printf "%.2f", n / 24 }') s); seam SSIM last→first $SEAM vs an ordinary step (frame 0→1) $NEXT"
echo "motion at 480 px around the wrap (last 6 frames | first 6 frames):"
"$FF" -hide_banner -loglevel error -stream_loop 1 -i "$CLEAN" -vf "scale=480:-2:flags=area,signalstats,metadata=print:key=lavfi.signalstats.YDIF:file=-" -f null - \
  | sed -n 's/.*YDIF=//p' | awk -v n="$N1" 'NR > n - 6 && NR <= n + 6 { printf "%5.1f%s", $1, (NR == n ? " |" : "") } END { print "" }'
echo "clean master: $CLEAN ($N1 frames, $(stat -f%z "$CLEAN" | awk '{ printf "%.0f MB", $1 / 1048576 }')); master: $OUT ($N2 frames, grain $GRAIN, CRF $MASTER_CRF, $(stat -f%z "$OUT" | awk '{ printf "%.1f MB", $1 / 1048576 }'))"
