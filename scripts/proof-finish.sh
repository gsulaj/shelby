#!/usr/bin/env bash
# Finish the proof morph (PROOF_BRIEF.md v2 step 5): Clip D (storm-damaged) → in-place dissolve → Clip F (new roof) →
# fade to near-black → loop, as one 3840×2160 master.
# Usage: bash scripts/proof-finish.sh <clip-D.raw.mp4> <clip-F.raw.mp4> [workdir]
# Env:   TARGET (3.4) common camera pace in px/frame at 3840 (scripts/proof-remap.mjs, speed-up only);
#        HALF (8) dissolve half-width in frames (17 frames = 0.71 s); FADE_OUT (0.5) and FADE_IN (0.25) seconds;
#        FADE_COLOR (0x0F1216, the --ink token); GRAIN (5); MASTER_CRF (12);
#        D_GRADE / F_GRADE: arguments for scripts/svc-grade.mjs (the hero grade + a Lab correction);
#        HERO_REF (the hero's grain-free graded master); REUSE=1 keeps the sized and remapped clips of an earlier run.
# Steps (ffmpeg-static + node, no credits):
#   1. scale to 2160 high (lanczos) and centre-crop 3840×2160 (Kling's 16:9 4K is 3856×2148), lossless;
#   2. even the camera speed of each clip to TARGET (measured displacement, not YDIF), so D's end and F's start match;
#   3. grade each clip: D moody but clear, F the hero's warm summer grade with charcoal shingles;
#   4. the in-place dissolve (scripts/proof-seam-blend.mjs): both clips on one camera timeline, each extended past its
#      seam frame along the other's measured motion, blended over 2·HALF+1 frames centred on D_last / F0;
#   5. fade in from and out to FADE_COLOR, lossless → the grain-free measurement master
#      assets-raw/originals/proof/proof-morph.v2-clean.mp4;
#   6. grain last at 3840 (noise=alls=GRAIN:allf=t+u, the hero calibration) → assets-raw/proof/proof-master-4k.mp4
#      (CRF MASTER_CRF); assets-raw/proof-morph.mp4 is a symlink to it, the file scripts/process-media.sh encodes.
# Prints the speed tables, the seam self-check, the dissolve's midpoint (the label switch time for media.ts) and the
# luma steps around the seam and the wrap.
set -euo pipefail
DRAW="$1"; FRAW="$2"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="${3:-$ROOT/.superpowers/sdd/PROOF_BRIEF/finish}"
TARGET="${TARGET:-3.4}"; HALF="${HALF:-8}"; FADE_OUT="${FADE_OUT:-0.5}"; FADE_IN="${FADE_IN:-0.25}"
FADE_COLOR="${FADE_COLOR:-0x0F1216}"; GRAIN="${GRAIN:-5}"; MASTER_CRF="${MASTER_CRF:-12}"
D_GRADE="${D_GRADE:---anchors none}"; F_GRADE="${F_GRADE:---anchors none}"
HERO_REF="${HERO_REF:-$ROOT/.superpowers/sdd/HERO_BRIEF/sharpness/new-clean-master.mp4}"
[[ -f "$HERO_REF" ]] || HERO_REF="$ROOT/assets-raw/hero-flyover.master-4k.mp4"
FF="${FFMPEG:-$(cd "$ROOT" && node -p "require('ffmpeg-static')")}"
CLEAN="$ROOT/assets-raw/originals/proof/proof-morph.v2-clean.mp4"
MASTER="$ROOT/assets-raw/proof/proof-master-4k.mp4"
mkdir -p "$WORK" "$(dirname "$CLEAN")"
frames() { "$FF" -hide_banner -i "$1" -map 0:v -c copy -f null - 2>&1 | grep -o "frame= *[0-9]*" | tail -1 | tr -dc '0-9'; }
LOSSLESS=(-an -c:v libx264 -qp 0 -preset fast -pix_fmt yuv420p -color_range tv -video_track_timescale 12288)

# 1. size (REUSE=1 keeps existing sized and remapped files)
for c in D F; do
  [[ "${REUSE:-0}" == 1 && -f "$WORK/$c-sized.mp4" ]] && continue
  src="$DRAW"; [[ "$c" == F ]] && src="$FRAW"
  "$FF" -y -loglevel error -i "$src" -vf "scale=-2:2160:flags=lanczos,crop=3840:2160" "${LOSSLESS[@]}" "$WORK/$c-sized.mp4"
done
# 2. constant speed
for c in D F; do
  [[ "${REUSE:-0}" == 1 && -f "$WORK/$c-remapped.mp4" ]] && continue
  node "$ROOT/scripts/proof-remap.mjs" "$WORK/$c-sized.mp4" "$WORK/$c-remapped.mp4" --target "$TARGET" --smooth 5 --workdir "$WORK/remap"
done
# 3. grade
# shellcheck disable=SC2086
node "$ROOT/scripts/svc-grade.mjs" "$WORK/D-remapped.mp4" "$HERO_REF" "$WORK/D-graded.mp4" --workdir "$WORK/grade-D" $D_GRADE
# shellcheck disable=SC2086
node "$ROOT/scripts/svc-grade.mjs" "$WORK/F-remapped.mp4" "$HERO_REF" "$WORK/F-graded.mp4" --workdir "$WORK/grade-F" $F_GRADE
# 4. in-place dissolve
node "$ROOT/scripts/proof-seam-blend.mjs" "$WORK/D-graded.mp4" "$WORK/F-graded.mp4" "$WORK/joined.mp4" --half "$HALF"
# 5. fades → grain-free master
N="$(frames "$WORK/joined.mp4")"
ND="$(frames "$WORK/D-graded.mp4")"
DUR="$(awk -v n="$N" 'BEGIN { printf "%.6f", n / 24 }')"
OUT_ST="$(awk -v d="$DUR" -v f="$FADE_OUT" 'BEGIN { printf "%.6f", d - f }')"
"$FF" -y -loglevel error -i "$WORK/joined.mp4" -vf "fade=t=in:st=0:d=${FADE_IN}:color=${FADE_COLOR},fade=t=out:st=${OUT_ST}:d=${FADE_OUT}:color=${FADE_COLOR}" "${LOSSLESS[@]}" "$CLEAN"
# 6. grain → master
"$FF" -y -loglevel error -i "$CLEAN" -vf "noise=alls=${GRAIN}:allf=t+u,format=yuv420p" -an -c:v libx264 -profile:v high -preset slow -crf "$MASTER_CRF" \
  -movflags +faststart -video_track_timescale 12288 "$MASTER"
ln -sfn proof/proof-master-4k.mp4 "$ROOT/assets-raw/proof-morph.mp4"

SEAM="$(awk -v n="$((ND - 1))" 'BEGIN { printf "%.3f", n / 24 }')"
echo "clean master: $CLEAN ($(frames "$CLEAN") frames, $(awk -v n="$N" 'BEGIN { printf "%.2f", n / 24 }') s)"
echo "master: $MASTER ($(frames "$MASTER") frames, grain $GRAIN, CRF $MASTER_CRF, $(stat -f%z "$MASTER" | awk '{ printf "%.1f MB", $1 / 1048576 }'))"
echo "dissolve midpoint (D_last / F0 50/50): frame $((ND - 1)) = ${SEAM} s → proofMorphSwitchAt in src/content/media.ts"
echo "mean luma per frame around the seam (frames $((ND - 1 - HALF - 3))…$((ND - 1 + HALF + 3))):"
"$FF" -hide_banner -loglevel error -i "$CLEAN" -vf "select='between(n\,$((ND - 1 - HALF - 3))\,$((ND - 1 + HALF + 3)))',scale=480:-2,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-" -fps_mode passthrough -f null - \
  | sed -n 's/.*YAVG=//p' | awk '{ printf "%5.1f", $1 } END { print "" }'
echo "mean luma at the wrap (last 4 frames | first 8 frames):"
"$FF" -hide_banner -loglevel error -stream_loop 1 -i "$CLEAN" -vf "scale=480:-2,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-" -f null - \
  | sed -n 's/.*YAVG=//p' | awk -v n="$N" 'NR > n - 4 && NR <= n + 8 { printf "%5.1f%s", $1, (NR == n ? " |" : "") } END { print "" }'
