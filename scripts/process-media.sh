#!/usr/bin/env bash
# Converts raw media in /assets-raw into optimized web assets in /public/media.
# Usage: npm run media   (or: bash scripts/process-media.sh)
# Uses ffmpeg from PATH, or the ffmpeg-static devDependency as a fallback.
#
# The hero is the exception to the size budgets: the 4k master (assets-raw/hero-flyover.mp4 → hero-flyover.master-4k.mp4)
# is scaled to 1080 high and centre-cropped to 1920×1080 for the web deploy (Cloudflare Pages rejects files over 25 MiB),
# then encoded two-pass to a target size: H.264 High at HERO_KBPS (5200 kb/s, ~9.4 MB for the 14.6 s loop, SSIM to the
# master 0.936) +faststart and VP9 at HERO_VP9_KBPS (5000 kb/s, ~9.1 MB). The poster is the first frame at 1920, JPEG
# quality ~80 (~360 KB). The earlier 3840×2160 CRF 20 delivery files are kept locally in media-masters/ (gitignored).
#
# The four service clips are the second exception (SERVICES_BRIEF.md §4.3, services v2): the finished masters
# (assets-raw/svc-*.mp4, 2160×2160 with grain, from scripts/svc-finish.sh) are encoded at SVC_SIZE (2160) as H.264 High
# CRF SVC_CRF (18) +faststart and VP9 CRF SVC_VP9_CRF (18: VP9 smooths the grain and plateaus at SSIM ~0.96 at any CRF,
# so it is matched to the H.264 file by bitrate, 6.8 vs 6.2 MB per 2 s; MP4 is served first anyway), poster = the master's
# first frame; no size budget (local demo). If Safari drops frames at 2160, SVC_SIZE=1800 is the documented fallback.
#
# The proof morph is the third exception (PROOF_BRIEF.md v2): the finished 3840×2160 master (assets-raw/proof-morph.mp4 →
# proof/proof-master-4k.mp4, from scripts/proof-finish.sh) is encoded at 2560×1440 as H.264 High CRF PROOF_CRF (19,
# ~20.9 MiB: CRF 18 came to 25.04 MiB, just over Cloudflare Pages' 25 MiB file limit) +faststart and VP9 CRF
# PROOF_VP9_CRF (24). Its poster is frame PROOF_POSTER_FRAME (6), the first frame
# after the 0.25 s fade-in from ink: frame 0 is near-black. The before/after slider stills (D_last and F0, graded like
# the clips) are written at 3840 px.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RAW="$ROOT/assets-raw"
OUT="$ROOT/public/media"
mkdir -p "$OUT"

FFMPEG="${FFMPEG:-}"
if [[ -z "$FFMPEG" ]]; then
  if command -v ffmpeg >/dev/null 2>&1; then
    FFMPEG="$(command -v ffmpeg)"
  elif FFMPEG_STATIC="$(cd "$ROOT" && node -p "require('ffmpeg-static')" 2>/dev/null)" && [[ -x "$FFMPEG_STATIC" ]]; then
    FFMPEG="$FFMPEG_STATIC"
  else
    echo "ffmpeg not found. Install it (brew install ffmpeg) or run npm install for the ffmpeg-static fallback." >&2
    exit 1
  fi
fi

MB=$((1024 * 1024))
filesize() { stat -f%z "$1" 2>/dev/null || stat -c%s "$1"; }
human() { awk -v b="$1" 'BEGIN { printf "%.2f MB", b / 1048576 }'; }

# raw filename -> "<output basename> <width> <mp4 budget in bytes>" (names match src/content/media.ts)
spec_for() {
  case "$1" in
    hero-flyover.mp4) echo "hero 1920 0" ;;
    svc-roofing.mp4)  echo "roofing ${SVC_SIZE:-2160} 0" ;;
    svc-siding.mp4)   echo "siding ${SVC_SIZE:-2160} 0" ;;
    svc-windows.mp4)  echo "windows ${SVC_SIZE:-2160} 0" ;;
    svc-gutters.mp4)  echo "gutters ${SVC_SIZE:-2160} 0" ;;
    proof-morph.mp4)  echo "proof-morph ${PROOF_SIZE:-2560} 0" ;;
    proof-before.jpg) echo "proof-before 3840 0" ;;
    proof-after.jpg)  echo "proof-after 3840 0" ;;
    *) echo "" ;;
  esac
}

encode_video() { # <input> <name> <width> <budget bytes>
  local in="$1" name="$2" width="$3" budget="$4" crf=24 webm_crf=33
  local mp4="$OUT/$name.mp4"
  local vf="scale=${width}:-2"
  local svc=0
  case "$name" in roofing|siding|windows|gutters) svc=1 ;; esac
  if (( svc )); then
    # Services v2: square masters at the delivery size, H.264 High CRF 18, no budget.
    crf="${SVC_CRF:-18}"; webm_crf="${SVC_VP9_CRF:-18}"
    vf="scale=${width}:${width}:flags=lanczos"
    "$FFMPEG" -y -loglevel error -i "$in" -an -c:v libx264 -profile:v high -preset slow -crf "$crf" \
      -pix_fmt yuv420p -movflags +faststart -vf "$vf" "$mp4"
  elif [[ "$name" == "proof-morph" ]]; then
    # Proof v2: 2560×1440 from the 3840×2160 master, H.264 High CRF 19 (keeps it under the 25 MiB deploy limit).
    crf="${PROOF_CRF:-19}"; webm_crf="${PROOF_VP9_CRF:-24}"
    vf="scale=${width}:-2:flags=lanczos"
    "$FFMPEG" -y -loglevel error -i "$in" -an -c:v libx264 -profile:v high -preset slow -crf "$crf" \
      -pix_fmt yuv420p -movflags +faststart -vf "$vf" "$mp4"
  elif [[ "$name" == "hero" ]]; then
    # 1920×1080 (scaled to 1080 high, centre crop), two-pass to a target size for the web deploy.
    local kbps="${HERO_KBPS:-5200}" vp9_kbps="${HERO_VP9_KBPS:-5000}" passlog
    passlog="$(mktemp -d)"
    crf="${kbps}k"; webm_crf="${vp9_kbps}k"
    vf="scale=-2:1080:flags=lanczos,crop=${width}:1080"
    for pass in 1 2; do
      local target=/dev/null
      (( pass == 2 )) && target="$mp4"
      "$FFMPEG" -y -loglevel error -i "$in" -an -vf "$vf" -c:v libx264 -profile:v high -preset slow -b:v "${kbps}k" \
        -maxrate "$((kbps * 3 / 2))k" -bufsize "$((kbps * 2))k" -pix_fmt yuv420p -pass "$pass" -passlogfile "$passlog/x264" \
        -movflags +faststart -f mp4 "$target"
    done
    for pass in 1 2; do
      local target=/dev/null
      (( pass == 2 )) && target="$OUT/$name.webm"
      "$FFMPEG" -y -loglevel error -i "$in" -an -vf "$vf" -c:v libvpx-vp9 -b:v "${vp9_kbps}k" \
        -maxrate "$((vp9_kbps * 3 / 2))k" -minrate "$((vp9_kbps / 2))k" -row-mt 1 -tile-columns 2 -deadline good \
        -cpu-used "$(( pass == 1 ? 2 : 1 ))" -pix_fmt yuv420p -pass "$pass" -passlogfile "$passlog/vp9" -f webm "$target"
    done
    rm -rf "$passlog"
    "$FFMPEG" -y -loglevel error -i "$in" -vf "$vf" -frames:v 1 -q:v 4 "$OUT/$name-poster.jpg"
  else
    while :; do
      "$FFMPEG" -y -loglevel error -i "$in" -an -c:v libx264 -preset slow -crf "$crf" \
        -pix_fmt yuv420p -movflags +faststart -vf "scale=${width}:-2" "$mp4"
      local size
      size="$(filesize "$mp4")"
      if (( size <= budget )) || (( crf >= 34 )); then
        if (( size > budget )); then
          echo "  warning: $name.mp4 is $(human "$size") at CRF $crf, over the $(human "$budget") budget" >&2
        fi
        break
      fi
      crf=$((crf + 2))
    done
  fi
  if [[ "$name" == "proof-morph" ]]; then
    "$FFMPEG" -y -loglevel error -i "$in" -an -c:v libvpx-vp9 -b:v 0 -crf "$webm_crf" -row-mt 1 -tile-columns 2 \
      -cpu-used 2 -pix_fmt yuv420p -vf "$vf" "$OUT/$name.webm"
    "$FFMPEG" -y -loglevel error -i "$in" -vf "select='eq(n\,${PROOF_POSTER_FRAME:-6})',$vf" -frames:v 1 -q:v 2 "$OUT/$name-poster.jpg"
  elif [[ "$name" == "hero" ]]; then
    : # WebM and poster are written in the two-pass branch above.
  elif (( svc )); then
    "$FFMPEG" -y -loglevel error -i "$in" -an -c:v libvpx-vp9 -b:v 0 -crf "$webm_crf" -row-mt 1 -tile-columns 2 \
      -cpu-used 2 -pix_fmt yuv420p -vf "$vf" "$OUT/$name.webm"
    "$FFMPEG" -y -loglevel error -i "$in" -vf "$vf" -frames:v 1 -q:v 2 "$OUT/$name-poster.jpg"
  else
    "$FFMPEG" -y -loglevel error -i "$in" -an -c:v libvpx-vp9 -b:v 0 -crf "$webm_crf" -row-mt 1 \
      -vf "scale=${width}:-2:flags=lanczos" "$OUT/$name.webm"
    "$FFMPEG" -y -loglevel error -i "$mp4" -frames:v 1 -q:v 3 "$OUT/$name-poster.jpg"
  fi
  printf "  %-14s mp4 %s (crf %s) · webm %s (crf %s) · poster ok\n" "$name" \
    "$(human "$(filesize "$mp4")")" "$crf" "$(human "$(filesize "$OUT/$name.webm")")" "$webm_crf"
}

encode_image() { # <input> <name> <width>
  local in="$1" name="$2" width="$3"
  "$FFMPEG" -y -loglevel error -i "$in" -vf "scale=${width}:-2:flags=lanczos" -q:v 3 "$OUT/$name.jpg"
  "$FFMPEG" -y -loglevel error -i "$in" -vf "scale=${width}:-2:flags=lanczos" -c:v libwebp -quality 80 "$OUT/$name.webp"
  printf "  %-14s jpg %s · webp %s\n" "$name" \
    "$(human "$(filesize "$OUT/$name.jpg")")" "$(human "$(filesize "$OUT/$name.webp")")"
}

ONLY="${1:-}"   # optional: process a single raw filename, e.g. hero-flyover.mp4
count=0
shopt -s nullglob
for f in "$RAW"/*; do
  base="$(basename "$f")"
  [[ -n "$ONLY" && "$base" != "$ONLY" ]] && continue
  spec="$(spec_for "$base")"
  if [[ -z "$spec" ]]; then
    [[ "$base" == "README.md" || "$base" == *.master-4k.* || "$base" == *.v1.* || "$base" == *.v2-* || "$base" == .DS_Store ]] || echo "  skipping unrecognized file: $base"
    continue
  fi
  read -r name width budget <<<"$spec"
  echo "processing $base"
  case "$base" in
    *.mp4) encode_video "$f" "$name" "$width" "$budget" ;;
    *.jpg) encode_image "$f" "$name" "$width" ;;
  esac
  count=$((count + 1))
done

if (( count == 0 )); then
  echo "nothing to process: drop files into assets-raw/ (see assets-raw/README.md)"
fi
echo "done: $count file(s) → public/media"
