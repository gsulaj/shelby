#!/usr/bin/env bash
# Local finishing of the stitched hero loop (HERO_RESUME.md step c): time-remap, grade, grain → master.
# Usage: bash scripts/hero-finish.sh <stitched-loop.mp4> <out-master.mp4> [workdir]
# Env: RMAX (1.5) max speed-up; MASTER_CRF (17); GRADE (ffmpeg filter chain, "" = none); GRAIN (noise strength,
#      0 = none); SKIP_REMAP=1 keeps the source timing; PLAN_ARGS extra args for scripts/hero-remap-plan.mjs;
#      REMAP_PLAN=<dir> reuses a recorded plan (its remap-filter.txt and remap-plan.log) instead of planning from this
#      input's motion, so a re-upscaled loop keeps the approved timing frame for frame (the fresh plan is still logged);
#      POSTER_IN + POSTER_OUT also run the same grade (no grain) over the poster still so it matches frame 0.
# The default grade is a subtle warm-summer lift: +5% saturation, +1% contrast, and a small warm shift in the
# midtones and highlights. colorbalance's pl (preserve lightness) option is deliberately not used: in ffmpeg 6.0 it
# cut saturation by a quarter and mottled the sunlit lawn.
# No credits: ffmpeg only. Prints a per-second motion table before and after the remap (signalstats YDIF measured
# at 480 px wide, so it tracks camera displacement rather than texture), and proves that frames outside the
# sped-up regions pass through bit-exact.
set -euo pipefail
IN="$1"; OUT="$2"; WORK="${3:-$(dirname "$OUT")/finish-work}"
RMAX="${RMAX:-1.5}"; MASTER_CRF="${MASTER_CRF:-17}"; GRAIN="${GRAIN:-5}"; SKIP_REMAP="${SKIP_REMAP:-0}"; PLAN_ARGS="${PLAN_ARGS:-}"; REMAP_PLAN="${REMAP_PLAN:-}"
GRADE="${GRADE-eq=saturation=1.05:contrast=1.01,colorbalance=rm=0.018:gm=0.004:bm=-0.022:rh=0.008:bh=-0.012}"
POSTER_IN="${POSTER_IN:-}"; POSTER_OUT="${POSTER_OUT:-}"
FPS=24
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FF="${FFMPEG:-$(cd "$ROOT" && node -p "require('ffmpeg-static')")}"
mkdir -p "$WORK"

frames() { "$FF" -hide_banner -i "$1" -map 0:v -c copy -f null - 2>&1 | grep -o "frame= *[0-9]*" | tail -1 | tr -dc '0-9'; }
motion2x() { # <clip> -> motion per frame for the clip played twice (frame N = loop seam)
  "$FF" -hide_banner -loglevel error -stream_loop 1 -i "$1" -vf "scale=480:-2:flags=area,signalstats,metadata=print:key=lavfi.signalstats.YDIF:file=-" -f null - | sed -n 's/.*YDIF=//p'
}
table() { # <motion-2x.txt> <N> : the cycle that starts at the seam, one row per second
  awk -v n="$2" -v fps="$FPS" 'NR > n && NR <= 2 * n { i = NR - n - 1; if (i % fps == 0) printf "\n  %5.1fs ", i / fps; printf "%5.1f", $1 } END { print "" }' "$1"
}

N="$(frames "$IN")"
motion2x "$IN" > "$WORK/motion-in-2x.txt"
echo "input: $N frames ($(awk -v n="$N" -v f=$FPS 'BEGIN { printf "%.2f", n / f }') s)"
echo "motion per frame before (row = 1 s, first value = loop seam):"; table "$WORK/motion-in-2x.txt" "$N"

if [[ "$SKIP_REMAP" == "1" ]]; then
  REMAPPED="$IN"; K="$N"
else
  # shellcheck disable=SC2086
  node "$ROOT/scripts/hero-remap-plan.mjs" "$WORK/motion-in-2x.txt" "$N" "$WORK/remap-filter.txt" "$WORK/remap-plan.json" --rmax "$RMAX" $PLAN_ARGS | tee "$WORK/remap-plan.log"
  if [[ -n "$REMAP_PLAN" ]]; then
    if cmp -s "$REMAP_PLAN/remap-filter.txt" "$WORK/remap-filter.txt"; then echo "fresh plan is identical to the recorded plan in $REMAP_PLAN"
    else echo "fresh plan differs from the recorded plan; using the recorded one ($REMAP_PLAN)"; fi
    cp "$WORK/remap-filter.txt" "$WORK/remap-filter.fresh.txt"; cp "$WORK/remap-plan.log" "$WORK/remap-plan.fresh.log"
    cp "$REMAP_PLAN/remap-filter.txt" "$WORK/remap-filter.txt"; cp "$REMAP_PLAN/remap-plan.log" "$WORK/remap-plan.log"
  fi
  K="$(sed -n 's/^K=//p' "$WORK/remap-plan.log")"
  PASS="$(sed -n 's/^PASS=//p' "$WORK/remap-plan.log")"
  REMAPPED="$WORK/remapped.mp4"
  "$FF" -y -loglevel error -stream_loop 1 -i "$IN" -filter_complex_script "$WORK/remap-filter.txt" -map "[out]" \
    -frames:v "$K" -r $FPS -an -c:v libx264 -preset slow -crf 12 -pix_fmt yuv420p -video_track_timescale 12288 "$REMAPPED"
  GOT="$(frames "$REMAPPED")"
  [[ "$GOT" == "$K" ]] || { echo "remap produced $GOT frames, expected $K" >&2; exit 1; }
  if [[ -n "$PASS" ]]; then # source frame S must appear as output frame O bit-exact (before the CRF 12 encode: PSNR high)
    S="${PASS%:*}"; O="${PASS#*:}"
    PSNR="$("$FF" -hide_banner -i "$IN" -i "$REMAPPED" -filter_complex "[0:v]select=eq(n\,$S),setpts=0[a];[1:v]select=eq(n\,$O),setpts=0[b];[a][b]psnr" -f null - 2>&1 | sed -n 's/.*PSNR y:\([0-9.inf]*\).*/\1/p')"
    echo "pass-through check: source frame $S vs output frame $O → PSNR Y $PSNR dB (identical frames differ only by the CRF 12 encode, so expect > 45)"
  fi
  motion2x "$REMAPPED" > "$WORK/motion-remapped-2x.txt"
  echo "motion per frame after the remap ($K frames, $(awk -v n="$K" -v f=$FPS 'BEGIN { printf "%.2f", n / f }') s):"; table "$WORK/motion-remapped-2x.txt" "$K"
fi

VF=""
[[ -n "$GRADE" ]] && VF="$GRADE"
if [[ "$GRAIN" != "0" ]]; then VF="${VF:+$VF,}noise=alls=$GRAIN:allf=t+u"; fi
[[ -z "$VF" ]] && VF="null"
"$FF" -y -loglevel error -i "$REMAPPED" -vf "$VF,format=yuv420p" -an -c:v libx264 -preset slow -crf "$MASTER_CRF" -movflags +faststart -video_track_timescale 12288 "$OUT"
echo "master: $OUT — $(frames "$OUT") frames, $(stat -f%z "$OUT" | awk '{ printf "%.1f MB", $1 / 1048576 }'), grade: ${GRADE:-none}, grain: $GRAIN, crf $MASTER_CRF"
if [[ -n "$POSTER_IN" && -n "$POSTER_OUT" ]]; then
  "$FF" -y -loglevel error -i "$POSTER_IN" -vf "format=yuv444p,${GRADE:-null},format=rgb24" -frames:v 1 "$POSTER_OUT"
  echo "poster: $POSTER_OUT (same grade, no grain)"
fi
