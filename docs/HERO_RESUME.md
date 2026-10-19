# Hero v2 — finished (2026-10-17), sharpness pass DONE, loop-wrap hold FIXED (2026-10-18)

The hero is done on `media`: upscaled, re-stitched, time-remapped, graded, grained, encoded, with the left-weighted overlay
and the full verification. On 2026-10-18 the soft ByteDance upscale was replaced by Starlight Precise 2.6 (fal) with the
motion, framing, timing and loop unchanged — see "Sharpness pass" below — and the 4k file's hold at the loop wrap was
removed by a double-buffered loop in `SmartVideo` — see "Loop-wrap hold — fixed" below. **This file is the single place to resume hero
work:** every path, ID, recipe, measurement, open issue and the next task are here. The v2 session ledger with every ruling
is `docs/superpowers/plans/2026-10-17-hero-ledger.md`. Brief: `HERO_BRIEF.md`. Status summary: `docs/STATUS.md` sections 9–11.

## Status

- **Sharpness pass: DONE and committed on `media` as `6246330`** (2026-10-18): Starlight Precise 2.6 upscales of the raw
  clips, colour-matched to them, strict architecture check passed, 3840×2160 H.264 High CRF 20 + VP9 CRF 26 + first-frame
  poster. Rollback: `public/media/hero.v2-prev.mp4` (the previous delivered file; `cp` it over `hero.mp4`, and take the old
  `hero.webm` / `hero-poster.jpg` from `git show 6246330~1:public/media/…`). Merged into `main` at `de5bde4` (2026-10-18).
- **Motion:** the approved Plan B orbit (approach → low skim over the shingles → over the ridge → rear three-quarter → east
  side → front → start), clockwise from above, never reversing. Clip 2's tower smear accepted; no Kling 4k re-render.
- **Quality path (since 2026-10-18):** the three raw pro clips upscaled by Starlight Precise 2.6 (fal), colour-matched back
  to the raw clips, re-stitched with the identical recipe, finished with the recorded remap plan, the same warm grade and
  light grain → a 3884 master (CRF 12) → 3840×2160 H.264 CRF 20 + VP9 CRF 26. (Before: ByteDance `aigc` 4k → 2560 px.)
- **Overlay:** desktop left-weighted shade (`.hero-shade`), phones keep the flat tint; all hero text ≥ AA through the loop.
- **Loop:** double-buffered since 2026-10-18 (two stacked `<video>` elements, no native `loop`; `SmartVideo seamless`),
  MP4 first + watchdog; `npm run test:loop` passes in Chromium and WebKit and now also fails on a hold at the wrap.
- **Credits:** balance **98.61** (lite plan). Hero v2 spend 89.64 in total: 70.75 for frames, keyframes and clips, 18.89
  for the upscales (4.83 + 4.03 + 4.03 ByteDance, 6.00 for the Topaz A/B on clip 1).
- **fal spend (sharpness pass):** ≈ USD 9.99 (shootout ≈ 7.37 + clips 2 and 3 ≈ 2.62; rate-based estimates — the connector
  shows no per-job charge; exact figures in the fal dashboard).
- **Loop-wrap hold: FIXED (2026-10-18).** The native `loop` held the last frame at every wrap with the 4k file (Safari
  132–152 ms, WebKit 133–208 ms, Chromium 117–150 ms, Chrome 67–83 ms over 10 wraps each); re-encoding never helped. The
  double-buffered loop brings every wrap to 50–67 ms in all four (the limit is 84 ms, two 24 fps frames), with 0 dropped
  frames in Safari and Chrome. Same file, encode, motion and framing; the 2560 fallback was not needed. Details, numbers
  and how to measure: "Loop-wrap hold — fixed" below.
- **Accepted:** the 4-frame sharpness pulse of Starlight, visible on close inspection at 5.5–7.7 s, 9.2–10.1 s and
  11.5–13.0 s; the owner accepted it after the 100% review clip.
- **Merged and complete:** `main` was fast-forwarded to `de5bde4` on 2026-10-18 (tsc, lint, 59 tests and `test:loop` pass
  there). **Next task:** the services and proof media (`docs/MEDIA_PLAYBOOK.md`).

## Loop-wrap hold — fixed: double-buffered loop (2026-10-18)

**Problem.** With the 3840×2160 file, every native `loop` wrap held the last frame while the one decoder sought back
to frame 0 and restarted a 4k stream. Re-encoding never changed it (CRF 20 with `-bf 0` or `b-pyramid=none` held the
same); the 2560 file had no hold.

**Fix** (`src/components/ui/SmartVideo.tsx`, `startSeamlessLoop`, behind the `seamless` prop that only the hero passes):
- Two stacked `<video>` elements on the same source: muted, `playsInline`, MP4 then WebM, no `loop` attribute. The
  front one (`data-front="true"`, z-index 1) plays; the back one waits paused on frame 0, already decoded.
- The back element starts on `preload="none"` and requests the same URL only once the front has played 2 s. Only the
  hero is requested at load, so `verify-media` passes; it logs 4 range requests to `/media/hero.mp4`.
- `requestVideoFrameCallback` on the front predicts, from 0.5 s before the end, when its last frame will have been on
  screen for one full frame. In that rendering frame the back element is raised, with no crossfade (the stitch makes
  last → first an ordinary step). The finished element is paused, then rewound to 0 a second later for the next wrap.
- `play()` takes a while to get a clock running: about 40–60 ms in Safari and WebKit, 0–7 ms in Chromium and Chrome once
  warm. So the back element is started that much before the swap, still hidden, and its frame 1 follows its frame 0 on
  time. The delay is measured on the hidden element twice during the first pass, at 4 s (halfway through a clip shorter
  than 8 s: the service clips, since 2026-10-18); the first, cold start is
  discarded because it reads 83 ms in Chromium. Every wrap then refines it.
- WebKit fires `ended` 20–35 ms before the last frame has had its time, so a timed swap ignores `ended`, and the watchdog
  leaves a timed swap alone. Without that guard one WebKit wrap measured 85 ms.
- Fallbacks: without requestVideoFrameCallback, `timeupdate` and a frame loop swap at the end. If the back element is
  not ready, the front restarts from 0 like the native loop.
- Kept: the 1 s watchdog (on whichever element is in front), the IntersectionObserver pause and resume,
  `visibilitychange`, MP4 first, reduced motion as a poster `<img>` with no video, and only the hero preloading.
  Services and proof keep the single-element path unchanged.
- Not changed: the video file, encode, motion and framing. The 2560 fallback was not needed.

**One departure from the brief's wording.** The brief said to start B about 0.5 s before the end. Starting it playing
that early would skip 12 frames at the seam. So at end − 0.5 s the back element is only checked (loaded, paused, on
frame 0), and it starts one measured start-up delay before the swap.

**Measured** with `node scripts/hero-wrap-check.mjs --seconds 150`: 10 consecutive wraps per engine on the real page,
1440×900, after a clean restart with `.next` cleared. A wrap's figure is the longest of the three frame intervals around
it (into the last frame, into frame 0, into frame 1). The pass bar is 84 ms (two 24 fps frames); at 60 Hz a normal
interval is 33 or 50 ms.

| Engine | Before: native `loop` (ms per wrap) | After: double buffer (ms per wrap) | Shown fps | Decoded / dropped (after) | CPU before → after | Peak RSS before → after |
|---|---|---|---|---|---|---|
| Real Safari 27 | 133, 134, 133, 137, 133, 132, 147, 149, 152, 151 | 67, 50, 51, 50, 50, 50, 50, 52, 51, 52 | 23.68 → 23.69 | 3529 / 0 | 28% → 32% | 1679 → 2039 MB* |
| Real Chrome | 83, 83, 83, 83, 83, 83, 83, 67, 83, 67 | 50 in all 10 | 23.96 → 24.00 | 3620 / 0 | 20% → 19% | 1430 → 1406 MB |
| Playwright WebKit | 187, 208, 184, 166, 133, 149, 150, 187, 182 (9 valid)** | 50, 50, 50, 50, 52, 67, 66, 65, 66, 67 | 23.73 → 23.74 | 3634 / 2 | 26% → 24% | 1218 → 1188 MB |
| Playwright Chromium | 150, 133, 117, 133, 133, 133, 117, 117, 133, 133 | 50, 67, 50, 50, 50, 50, 50, 50, 67, 50 | 23.86 → 24.00 | 3619 / 2 | 104% → 107% | 1237 → 1670 MB |

\* Safari's figures sum every Safari and system WebKit process (other tabs included). \** One WebKit baseline wrap
was a hot-reload artefact and is left out. Content runs 14.5417 → 0 at every wrap, no frame skipped at the seam, and
every wrap was a swap (no fallback restart). Raw results: `.superpowers/sdd/HERO_BRIEF/loop-wrap/` (gitignored).

**Worth knowing (not a regression).** Safari and WebKit's requestVideoFrameCallback sometimes reports a 2-frame step in
the middle of a pass: Safari 12 before and 42 after, WebKit 0 and 34. Safari's always land on the same frames
(index ≡ 3 mod 18, a 0.75 s beat between 24 fps and the display), so it is the cadence beat, not the second element.
How often it happens depends on each pass's start phase against the display, which the native loop re-rolled at every
seek and the swap carries over from pass to pass. The browsers' own counters report 0 dropped frames in Safari and the
shown frame rate is unchanged (23.68 → 23.69 fps). Chrome and Chromium show none before or after.

**How to measure.**
- `node scripts/hero-wrap-check.mjs [--engines chromium,webkit,chrome,safari] [--seconds 150] [--json out.json]` needs
  the dev server and an idle machine.
- It reports per engine the wrap intervals, shown fps, interval median, p99 and worst outside the wraps, content skips,
  decoded and dropped frames, and the browser's average CPU and peak RSS. It exits 1 above 84 ms.
- The page-side measurement is `scripts/hero-wrap-tracker.mjs`: requestVideoFrameCallback on both elements, a frame
  counts only while its element is in front, and a swap counts as a shown frame.
- **Real Safari** cannot be driven by Playwright here (do not enable remote automation). The script writes a temporary
  probe page, `public/__probe/wrap.html`, that frames the real page. It opens it with `open -a Safari` and takes the
  result on 127.0.0.1:3999, then **deletes `public/__probe/`** whatever happens: never commit it.
- Keep the Safari window in front: Safari stops rendering a hidden page. Hidden spans are logged and the wraps next to
  them left out; two short runs were spoiled that way before the full run stayed visible.
- `node scripts/hero-playback-check.mjs` (first play, stalls, hitches) and `npm run test:loop` now read frames from the
  element in front too.

**Verification** after a clean restart (`.next` cleared): tsc clean; lint 0 errors (2 old warnings in the gitignored `.superpowers` probe tools); 59 unit tests; `npm run test:loop` 2 of 2 in 182 s with the new no-hold assertion (and, as a check of the check, 2 of 2 failing on the native `loop`: Chromium 133–167 ms, WebKit 133–166 ms); `node scripts/verify-media.mjs` all checks passed (console clean in all four sessions, only the hero requested at load, services 01→04→01, proof, reduced motion with no `<video>`); `node scripts/hero-playback-check.mjs --seconds 40` smooth in Chromium, WebKit and Chrome (2 wraps, no hitch over 100 ms, max frame gap 67–68 ms, first frame 0.22–0.39 s, 0–1 dropped); `node scripts/hero-contrast.mjs` unchanged (desktop worst H1 8.64, eyebrow 8.11, sub 7.63, phone 7.07); `node scripts/hero-shots.mjs` console clean, frames identical to `docs/screenshots/hero-4k/` apart from the moving trust marquee.

## Deployment notes (later — not now)

- **Git LFS before any push:** the repo has no remote today. Files over GitHub's 100 MB limit:
  `assets-raw/hero-flyover.master-4k.mp4` (365.5 MB), `public/media/hero.mp4` (110.6 MB), `public/media/hero.webm`
  (105.2 MB); `assets-raw/hero-flyover.v2-bytedance.mp4` is 98.0 MB (just under). They must move to Git LFS (history
  included, e.g. `git lfs migrate import`) or be kept out of the pushed repository.
- **Production needs a mobile encode of ~15–25 MB:** the 3840×2160 CRF 20 file (~60 Mb/s, 110 MB) is a local-demo choice
  (CLAUDE.md: local only, no deployment). A deployed site needs a phone-sized rendition (about 15–25 MB, e.g. 1280–1920 px
  wide from the same master) served to small screens through `SmartVideo` (a `media`-aware source choice), and very
  likely a lighter desktop rendition too. Not started.

## Sharpness pass (2026-10-18): shootout on clip 1, then the owner's override → delivered (`6246330`)

Goal: crisp shingle/brick/stone texture at 100% without touching motion, framing, timing or the loop, by re-upscaling the
raw Kling clips through the fal connector. Step 1 (shootout on raw clip 1) ran and the brief's stop rule fired (no
candidate both stable and sharper on every crop); the owner then overrode the verdict in favour of Starlight Precise 2.6,
which was built, verified and delivered — "Owner override" below.

**Candidates** (raw `hero-v2-clip1.mp4`, 1928×1072, 145 frames, 24 fps; no `target_fps`, so no interpolation; every
output kept 145 frames at 24 fps). Outputs in `assets-raw/originals/upscale-shootout/` (gitignored, also in the Desktop
backup); fal input `https://v3b.fal.media/files/b/0aaedb47/2zUJrpORK26u94kueagDF_hero-v2-clip1.mp4`.

| Candidate | Endpoint · settings | request_id | Output |
|---|---|---|---|
| Starlight Precise 2.6 | `topaz/upscale/video/generative` · model `Starlight Precise 2.6`, `upscale_factor` 2.015, H265 | `01a14e56-d5cb-7951-b5ca-1cd231b0bf63` | 3884×2160 HEVC |
| Starlight HQ | same endpoint · model `Starlight HQ`, factor 2.015 (served at 2.0) | `01a14e56-db4a-76f2-a5da-1cf2e0c8e7ae` | 3856×2144 HEVC |
| Astra 2 | `topaz/upscale/video/creative` · creativity 0.3, factor 2.015, descriptive prompt | `01a14e56-e63c-7941-8bdb-7cff37dfe013` | 3840×2136 HEVC |
| SeedVR2 | `fal-ai/seedvr/upscale/video` · target 2160p, seed 42, ProRes, quality maximum | `01a14e56-f146-7120-b56e-000ed1428c13` | 3872×2160 ProRes 12-bit |

**Spend (fal, USD).** The connector shows no per-job charge and Topaz bills in undocumented "units", so these are the rates
from the public model pages × this job: Starlight Precise 2.6 ≈ 1.57 and Starlight HQ ≈ 1.57 (0.26/s at 4k), Astra 2 ≈
3.02 (0.50/s at 4k), SeedVR2 1.21 (0.001/MP × 1,213 MP) → **≈ 7.37**. Exact figures: fal dashboard → usage. No Higgsfield
credits were used.

**Method** (`node scripts/hero-upscale-shootout.mjs <candidates.json> <out-dir>`, helpers in `scripts/video-metrics.mjs`):
every video is scaled onto the clip's 3884×2160 grid. (a) detail = Laplacian variance of nine 400 px crops (shingles,
brick, stone tower at frames 15/72/129); (b) four 24-frame tracked regions (shingles, two brick walls, the stone gable):
per-tile motion from the source, then the coherence of the fine-detail band between frames, divided by the same video's
coherence against a rigidly warped copy of itself (efficiency: 1 = detail moves with the scene, lower = re-invented every
frame), plus the 4-frame sharpness pulse (Kling's VAE packs 4 frames per latent; upscalers amplify that rhythm into a
6 Hz shimmer) and luma flicker; (c) SSIM and structural edge F1 at source size, whole frame and architecture ROIs;
(d) mean Y/U/V shift. Bars: stability no worse than the current clip (efficiency −0.04, pulse ≤ 1.5×), edge F1 −0.05,
colour within 2 / 1.5 levels, and sharper than the current hero on every crop.

| Row | Detail (× current) | Efficiency shingle/brick/brick 2/stone | Pulse max | SSIM · edge F1 | ΔY | Verdict |
|---|---|---|---|---|---|---|
| Current 4k (ByteDance) | 51.3 (1.00) | 0.959 / 0.954 / 0.950 / 0.926 | 6.7% | 0.952 · 0.950 | −0.04 | baseline |
| Starlight Precise 2.6 | 190.8 (3.72) | 0.952 / **0.821 / 0.746 / 0.772** | **13.3%** | 0.890 · 0.928 | −1.12 | fails b: brick and stone boil |
| Starlight HQ | 84.0 (1.64) | 0.944 / 0.932 / 0.921 / 0.899 | 9.5% | 0.922 · 0.909 | −1.32 | passes b–d; **softer than now on the f72 brick wall (0.55×, frames 66–77)** |
| Astra 2 | 113.4 (2.21) | 0.923 / 0.924 / **0.886** / 0.895 | 5.4% | **0.775 · 0.832** | **−2.68** | fails b, c, d: invents a stone pier in the arch, re-lays shingles |
| SeedVR2 | 83.0 (1.62) | 0.961 / **0.910 / 0.900 / 0.874** | 8.1% | 0.929 · 0.916 | −1.25 | fails b; softer on f15 shingles and f72 brick |

Evidence: `docs/screenshots/hero-upscale/shootout.jpg` (crops + table) and `metrics.json`; a 100% brick-wall comparison
of all six rows over 4 s (where the boiling is visible) is `.superpowers/sdd/HERO_BRIEF/review/upscale-shootout-brick-100pct.mp4`.

### Owner override: Starlight Precise 2.6 for all three clips (2026-10-18) — delivered

The owner overrode the shootout verdict (Precise 2.6 is far sharper; its flicker was judged proportional to its detail)
with two conditions: colour-match every upscaled clip to its raw source before finishing, and keep the architecture check
strict; plus a shimmer check on the whole stitched loop, stopping before the commit if any segment shimmers visibly.

**Steps 2–4 (done).**
- Clips 2 and 3 through `topaz/upscale/video/generative`, model `Starlight Precise 2.6`, `upscale_factor` 2.015 (the
  clip 1 settings): request ids `01a14e7b-cc36-7cf0-bb02-43a24673a151` (clip 2 → 3884×2168) and
  `01a14e7b-d2db-74c1-bd81-b3cd144160f9` (clip 3 → 3884×2160). Frame counts match the sources exactly: 145 / 121 / 121
  at 24 fps. Files: `assets-raw/originals/hero-v2-clip{1,2,3}-4k-starlight.mp4`.
- Colour match (`node scripts/hero-colormatch.mjs <raw> <upscaled> <out>`): CIELAB mean + std transfer per clip,
  statistics at 960 px (so added detail is not counted as contrast), baked into a 65³ LUT and applied with `lut3d` at full
  resolution, lossless output `…-starlight-cm.mp4`. ΔE of the clip means 0.66 / 0.66 / 0.68 → 0.04 / 0.05 / 0.04;
  ΔY 1.1 levels → ≤ 0.06.
- Architecture (`node scripts/hero-architecture-check.mjs <raw> <current-4k> <new-4k> <out-dir>`): strong edges only
  (σ 2, Canny 0.12 / 0.3 — rooflines against the sky, ridges and hips, eaves and gutters, rakes, window frames, the arch);
  recall (every source line still there) and precision (no new strong structure) each ≥ the current clip − 0.03 on
  average and − 0.05 on the worst frame, every 12th frame. Validated on Astra 2 (invented pier): fails all four. Starlight:
  recall 0.976 / 0.976 / 0.984, precision 0.945 / 0.929 / 0.907 (current 0.999 / 0.86–0.81) — **pass on all three**.
  The softer σ 3.5 "geometry" scale flagged clip 2 (0.847 worst frame): close over the roof it counts shingle courses,
  and the overlays and 100% crops show the hips, eaves and gutters in the same place.
- Stitch: identical recipe (`BLEND_FRAMES=3 TRIMS="0,0 0,1 0,10"`), common size 3884×2160 (clip 2's 2168 rows cropped
  by 4, like the approved 1928 stitch), 367 frames → `assets-raw/originals/hero-flyover.4k-starlight-stitched.mp4`.
- Finish: `MASTER_CRF=12 REMAP_PLAN=docs/hero-remap-plan bash scripts/hero-finish.sh …` — the recorded remap plan
  (archived in `docs/hero-remap-plan/`; a fresh plan on the new loop would have given 349 frames, not 350), the same grade,
  grain `alls=5` after the upscale → `assets-raw/hero-flyover.master-4k.mp4`, 3884×2160, 350 frames, 348.6 MB;
  pass-through PSNR 51.1 dB. `assets-raw/hero-flyover.mp4` is now a symlink to it; the previous master is
  `assets-raw/hero-flyover.v2-bytedance.mp4`.
- Encode (`bash scripts/process-media.sh hero-flyover.mp4`): centre crop 3840×2160, first at the brief's H.264 High CRF 16
  (187.3 MB, 107.7 Mb/s, SSIM 0.985) + VP9 CRF 18; after the Safari finding below and the owner's ruling, **H.264 High
  CRF 20 +faststart (105.5 MB, 60.7 Mb/s, SSIM 0.978 to the master) + VP9 CRF 26 (100.3 MB, SSIM 0.979)** — the matching
  VP9 CRF from a 2 s calibration (H.264 20 = 0.9756; VP9 26 = 0.9776, 28 = 0.9753). Poster = master frame 0 at 3840
  (SSIM 0.987). Rollback: `public/media/hero.v2-prev.mp4` (the previous delivered file, not referenced by the page).

**Step 5 (verification).**
- Before/after (`node scripts/hero-before-after.mjs docs/screenshots/hero-upscale/before-after.config.json
  docs/screenshots/hero-upscale`): sharper on every crop at 2 / 7 / 12 s — the delivered CRF 20 file 1.37–4.60× (old 2560
  upscaled to 3840; CRF 16 was 1.48–4.89×), grain-free graded masters 1.10–3.18×. Sheet
  `docs/screenshots/hero-upscale/before-after.jpg`.
- Seams (480 px motion, the finish's table): loop seam max step 2.71 (old 2.39), join 1 2.33 (2.78), join 2 2.28 (2.09);
  the largest step anywhere in the loop is 4.16 (old 4.07) — no seam is the jumpiest moment.
- `npx tsc --noEmit`, `npm run lint`, `npx vitest run` (59): clean. `npm run test:loop`: 2 of 2 passed (182 s).
  `node scripts/verify-media.mjs`: all checks passed. `node scripts/hero-shots.mjs --out docs/screenshots/hero-4k`:
  console clean. `node scripts/hero-contrast.mjs`: all hero text above AA (desktop worst H1 8.64, eyebrow 8.11, sub 7.63,
  phone 7.07 — unchanged).
- **Playback (`node scripts/hero-playback-check.mjs`) — FAILS in Safari.** Real Chrome plays the 3840 CRF 16 file
  perfectly (480 frames in 20 s, 0 dropped, no hitch). Real Safari 27.0.1 and Playwright WebKit present only 7–14 fps on
  it (frame gaps up to 1–2 s). Isolated with a probe page on 8 s cuts: it is the bitrate, not the resolution or the server
  (the dev server streams at 1.36 GB/s; a plain static server behaves the same): H.264 CRF 16 103 Mb/s 13 fps (CAVLC and
  `-tune fastdecode` variants 9–10 fps), CRF 18 76 Mb/s 14.6–23.5 fps (borderline), **CRF 20 57 Mb/s 23.6 fps both runs**,
  CRF 24 32 Mb/s 22.6, CRF 30 15 Mb/s 23.8, HEVC CRF 18 65 Mb/s 23.6. CRF 20 keeps 90–97% of CRF 16's crop sharpness
  (SSIM 0.978 to the master) and is still 2.2–4.6× sharper than the old hero.
- **Shimmer (`node scripts/hero-shimmer-check.mjs`, before grain, roof and brick regions only):** compared with the clip 1
  approach the owner accepted (same method: 4-frame sharpness pulse ≤ 20.5% in its worst window), three stretches go
  further — **5.5–7.7 s** (low roof pass, roof shingles: pulse 20–25% vs 8–10% in the old loop), **9.2–10.1 s** (rear
  wall: detail resolves in 14× as the camera slows — the old loop 3.5× — then pulses ±15%), **11.5–13.0 s** (rear orbit
  into the east side: roof 27%, brick 23% vs 10–13%). The brick pattern itself stays put frame to frame (no re-invented
  layout); what shows is a 6 Hz sharpening/softening rhythm. Review clip: `.superpowers/sdd/HERO_BRIEF/review/hero-shimmer-review-100pct.mp4`.

**Ruling and delivery.** The work stopped before the commit on both findings; the owner reviewed the 100% clip, accepted
the shimmer, and chose H.264 CRF 20 for Safari. On the CRF 20 file, after a clean restart (`.next` cleared):
real Safari 27.0.1 23.7 fps, 472 frames in 20 s, 0 dropped (twice); Chrome 23.9 fps, max frame gap 67 ms, no hold even at
the loop point; Playwright WebKit and Chromium full rate (434–482 frames in 20 s, 0 dropped). The one remaining hitch in
Safari, WebKit and Chromium is a ~110–170 ms hold at the loop wrap (4k only; B-frame settings make no difference). tsc,
lint, 59 tests, `test:loop` (2 of 2, 181.9 s), `verify-media` (all 32 checks), hero shots (`docs/screenshots/hero-4k/`) and
contrast (unchanged) all pass. One-step rollback: `cp public/media/hero.v2-prev.mp4 public/media/hero.mp4` (and
`git show HEAD~1:public/media/hero.webm` / `hero-poster.jpg` for the old WebM and poster). Spend: clips 2 + 3 ≈ USD 2.62
(0.26/s × 10.08 s) → sharpness pass total ≈ **USD 9.99** on fal (rate-based estimate; exact figures in the fal dashboard).

## Files

| What | Path | Notes |
|---|---|---|
| **Hero master (finished, 4k)** | `assets-raw/hero-flyover.master-4k.mp4` (`hero-flyover.mp4` is a symlink to it) | 3884×2160, 350 frames, 14.58 s, H.264 CRF 12, 348.6 MB, grain 5; the source `npm run media` encodes |
| Processed hero | `public/media/hero.mp4`, `hero.webm`, `hero-poster.jpg` | 3840×2160 centre crop, H.264 High CRF 20 (105.5 MB, 60.7 Mb/s) / VP9 CRF 26 (100.3 MB); poster = master frame 0; MP4 is served first |
| Rollback | `public/media/hero.v2-prev.mp4` (not referenced), `assets-raw/hero-flyover.v2-bytedance.mp4` | the previous delivered file and the previous master (3870×2160, CRF 17) |
| Starlight clips 1–3 | `assets-raw/originals/hero-v2-clip{1,2,3}-4k-starlight.mp4` | 3884×2160 / 3884×2168 / 3884×2160 HEVC, 145 / 121 / 121 frames; colour-matched lossless `…-starlight-cm.mp4` (the stitch inputs) |
| Starlight stitched loop | `assets-raw/originals/hero-flyover.4k-starlight-stitched.mp4` | 367 frames, CRF 12 |
| Remap plan (recorded) | `docs/hero-remap-plan/` | `remap-filter.txt`, `remap-plan.log`, `remap-plan.json` — reused by `REMAP_PLAN` |
| Shootout outputs | `assets-raw/originals/upscale-shootout/` | clip 1 through Starlight Precise 2.6 / HQ, Astra 2, SeedVR2 |
| Poster still (graded, v2) | `assets-raw/stills/hero-frame.v2a-final.graded.png` | the v2 poster (the approved start frame with the master's grade); since the sharpness pass the poster is the master's first frame |
| Start/end frame (approved, ungraded) | `assets-raw/stills/hero-frame.v2a-final.png` (+ `.jpg`) | 5504×3072; candidate A + plaque/sign edit + wire edit |
| K2 v3, colour-matched (used in the clips) | `assets-raw/stills/hero-k2.matched.png` (+ `.jpg`) | low over the front roof |
| K3 (approved) | `assets-raw/stills/hero-k3.png` (+ `.jpg`) | rear three-quarter from the back-right |
| Raw clips 1–3 (Kling pro) | `assets-raw/originals/hero-v2-clip{1,2,3}.mp4` | 1928×1072 / 1928×1076 / 1928×1072, 145 / 121 / 121 frames, 24 fps |
| 4k clips 1–3 (ByteDance) | `assets-raw/originals/hero-v2-clip{1,2,3}-4k.mp4` | 3880×2160 / 3870×2160 / 3880×2160, same frame counts |
| Topaz A/B of clip 1 (not used) | `assets-raw/originals/hero-v2-clip1-4k-topaz.mp4` | 3840×2160 HEVC, padded to 16:9, softer |
| 4k stitched loop (pre-finish) | `assets-raw/originals/hero-flyover.4k-stitched.mp4` | 367 frames, 15.29 s, CRF 12, 148 MB |
| 1928 stitched master (pre-upscale, superseded) | `assets-raw/originals/hero-flyover.v2-1928-stitched.mp4` | the loop approved at Gate 2 |
| Plan A preview (rejected) | `assets-raw/originals/hero-flyover.v2-pro-preview.mp4` | kept for reference |
| v1 hero | `assets-raw/hero-flyover.v1.mp4`, `assets-raw/originals/hero-flyover.mp4` | regenerate `public/media/hero.*` from it if ever needed |
| Superseded stills | `assets-raw/stills/hero-frame.v2a.jpg`, `hero-frame.v2b.jpg`, `hero-frame.v2a-clean.jpg`, `hero-k2.jpg`, `hero-k2.v2.jpg`, `hero-k2.rejected-v1.jpg` | candidates A/B, the plaque/sign edit, K2 v1–v3 |
| Reference photos | `assets-raw/reference/*.jpeg` | the client's house, architecture reference only |
| Screenshots | `docs/screenshots/hero-4k/` (`hero-v2/` before the sharpness pass) | 1440 and 390 at 0 / 5 / 10 s |
| Sharpness sheets | `docs/screenshots/hero-upscale/` | `shootout.jpg` + `metrics.json`, `before-after.jpg` + `.json` + config |
| Review material (gitignored) | `.superpowers/sdd/HERO_BRIEF/` | finish-work (plans, motion tables, crops), contrast runs, review copy; regenerable |
| Wrap measurement | `scripts/hero-wrap-check.mjs`, `scripts/hero-wrap-tracker.mjs`; raw runs in `.superpowers/sdd/HERO_BRIEF/loop-wrap/` | before/after JSON and logs of the 10-wrap runs (gitignored) |

`assets-raw/originals/` is gitignored; everything in it is also in `~/Desktop/shelby-hero-backup/` (raw clips, 4k clips,
Topaz test, Plan A preview, the 1928 master, keyframes as PNG + JPG, superseded PNG masters, reference photos).

## Recipe (reproduce the master from the Starlight clips)

```bash
O=assets-raw/originals
# 1. colour-match each Starlight clip to its raw Kling clip (lossless output)
for c in 1 2 3; do node scripts/hero-colormatch.mjs $O/hero-v2-clip$c.mp4 $O/hero-v2-clip$c-4k-starlight.mp4 $O/hero-v2-clip$c-4k-starlight-cm.mp4; done
# 2. strict architecture check against the raw clips (the previous 4k clips are the baseline)
for c in 1 2 3; do node scripts/hero-architecture-check.mjs $O/hero-v2-clip$c.mp4 $O/hero-v2-clip$c-4k.mp4 $O/hero-v2-clip$c-4k-starlight-cm.mp4 .superpowers/sdd/HERO_BRIEF/sharpness/architecture clip$c; done
# 3. stitch: common crop, easing trims, 3-frame seam blends, loop close (the trims are the ones measured at Gate 2)
BLEND_FRAMES=3 TRIMS="0,0 0,1 0,10" bash scripts/hero-stitch.sh \
  $O/hero-v2-clip1-4k-starlight-cm.mp4 $O/hero-v2-clip2-4k-starlight-cm.mp4 $O/hero-v2-clip3-4k-starlight-cm.mp4 \
  $O/hero-flyover.4k-starlight-stitched.mp4 .superpowers/sdd/HERO_BRIEF/sharpness/stitch-work
# 4. finish with the recorded remap plan (timing frame-identical to the approved loop), grade, grain → master
MASTER_CRF=12 REMAP_PLAN=docs/hero-remap-plan bash scripts/hero-finish.sh \
  $O/hero-flyover.4k-starlight-stitched.mp4 assets-raw/hero-flyover.master-4k.mp4 .superpowers/sdd/HERO_BRIEF/sharpness/finish-new
ln -sfn hero-flyover.master-4k.mp4 assets-raw/hero-flyover.mp4
# 5. encode 3840×2160 H.264 CRF 20 + VP9 CRF 26 + first-frame poster
bash scripts/process-media.sh hero-flyover.mp4
```

The v2 recipe (ByteDance clips `hero-v2-clip{1,2,3}-4k.mp4`, master at CRF 17, 2560 px encode, graded poster still) is the
same with those inputs and `POSTER_IN`/`POSTER_OUT` in step 4; it produced `hero-flyover.v2-bytedance.mp4`.

**Stitch** (`scripts/hero-stitch.sh`): crops every clip to the smallest common size (3870×2160), cuts the measured easing frames
(0/0, 0/1, 0/10 head/tail), joins with `xfade` over 3 frames at (145−3)/24 s and (145+120−6)/24 s, trims the chain's first
3 frames and fades the head over the tail → 367 frames, 15.29 s. The seams join identical keyframes, so the blend only hides
render mismatch. If a clip ever changes frame count, scale the trims by the new/old ratio.

**Finish** (`scripts/hero-finish.sh`, planner `scripts/hero-remap-plan.mjs`):
- Motion per frame = ffmpeg `signalstats` YDIF measured at 480 px wide (at full resolution, interpolation softness reads as
  slower motion), for the loop played twice so the seam is measured.
- Rate = clamp(local 73-frame pace / 15-frame motion, 1.0, 1.5), smoothed over 9 frames: slow passages play faster, nothing
  is slowed down. Each sped-up region consumes a whole number of output frames and regions saving < 2 frames are dropped,
  so every frame outside the three regions lands exactly on a source frame and passes through `minterpolate` bit-exact
  (the script checks one with PSNR). Regions on the 4k loop: frames 130–186 (57→49, max 1.30×), 240–276 (37→32, 1.39×),
  344–366 (23→19, 1.44×) → **350 frames, 14.58 s**; 250 frames untouched.
- `minterpolate=fps=24:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1:scd=none:search_param=64` renders the warped
  timestamps; interpolated frames measure ~3% softer than their neighbours (blurdetect), indistinguishable at 100%.
- Grade `eq=saturation=1.05:contrast=1.01,colorbalance=rm=0.018:gm=0.004:bm=-0.022:rh=0.008:bh=-0.012` (never `pl=1`:
  it cut saturation by a quarter and mottled the lawn in ffmpeg 6.0). Grain `noise=alls=5:allf=t+u` at 4k. Master CRF 17.
- The log prints the per-second motion table before and after; the planner's JSON is in the work directory.

**Encode** (`scripts/process-media.sh`, hero branch, since the sharpness pass): scaled to 2160 high, centre crop 3840,
H.264 High CRF 20 (`HERO_CRF`) +faststart, VP9 CRF 26 (`HERO_VP9_CRF`), poster = the master's first frame with the same
crop, no size budget. CRF 20 because Safari cannot decode CRF 16 (~103 Mb/s) at 4k in real time (see below).

## Overlay (HERO_BRIEF step 5)

`src/components/sections/Hero.tsx` + `.hero-shade` in `src/app/globals.css`: on `lg` and up the flat `bg-ink/40` layer is
replaced by a left-weighted shade — ink 70% at the left edge → 55% at 15% → 36% at 30% → 16% at 44% → 0 at 55% of the width —
so the house on the right keeps its light; below `lg` the flat 40% tint stays because the headline spans the full width. The
bottom gradient (`from-ink/85 via-ink/20`) is unchanged. The hero eyebrow is `text-on-dark/90` and the phone link
`text-on-dark/85`: the muted colour measured 3.7–3.9:1 against the video even under the old flat tint.

`node scripts/hero-contrast.mjs` hides the text, seeks the hero every 0.5 s through the loop and measures the background
inside each text box (mean and brightest 10%). Results on the final hero are in `docs/STATUS.md` section 10.

## Higgsfield IDs (re-download with `jobs_wait` / `show_generation_by_ids`, or the result URLs)

| Asset | Job / media id | Result URL |
|---|---|---|
| Style frame candidate A (chosen) | `e7fd26fd-e2ac-4722-b7c9-d6c070159934` | https://d8j0ntlcm91z4.cloudfront.net/user_3E8iT9l6XWFvwhu7S8waBGlE14d/hf_20261017_042750_e7fd26fd-e2ac-4722-b7c9-d6c070159934.png |
| Style frame candidate B | `109c5824-17fb-4dbd-ba49-d546627a0285` | https://d8j0ntlcm91z4.cloudfront.net/user_3E8iT9l6XWFvwhu7S8waBGlE14d/hf_20261017_042752_109c5824-17fb-4dbd-ba49-d546627a0285.png |
| A + plaque/sign cleanup edit | `bf591e91-8272-4b6b-8ca1-b6ce055fe578` | https://d8j0ntlcm91z4.cloudfront.net/user_3E8iT9l6XWFvwhu7S8waBGlE14d/hf_20261017_043856_bf591e91-8272-4b6b-8ca1-b6ce055fe578.png |
| **Start/end frame** (wire edit of the above) | `9d17d2af-0f1a-4a51-bdf5-854e242da68f` | https://d8j0ntlcm91z4.cloudfront.net/user_3E8iT9l6XWFvwhu7S8waBGlE14d/hf_20261017_045055_9d17d2af-0f1a-4a51-bdf5-854e242da68f.png |
| Plan A preview (rejected) | `2d267a6b-3e87-40b6-9214-c640c44078e2` | https://d8j0ntlcm91z4.cloudfront.net/user_3E8iT9l6XWFvwhu7S8waBGlE14d/hf_20261017_045326_2d267a6b-3e87-40b6-9214-c640c44078e2.mp4 |
| K2 v1 (rejected, phantom roof) | `38f107e7-357e-41e8-871e-f755ea6bc2ba` | https://d8j0ntlcm91z4.cloudfront.net/user_3E8iT9l6XWFvwhu7S8waBGlE14d/hf_20261017_051603_38f107e7-357e-41e8-871e-f755ea6bc2ba.png |
| K2 v2 (geometry approved) | `461414dd-bb2c-42e8-8546-fe9e82d4a0da` | https://d8j0ntlcm91z4.cloudfront.net/user_3E8iT9l6XWFvwhu7S8waBGlE14d/hf_20261017_052216_461414dd-bb2c-42e8-8546-fe9e82d4a0da.png |
| K2 v3 (shingles/chimney/trees fix) | `fa31c9e5-276e-4641-9335-b3ae5518fe67` | https://d8j0ntlcm91z4.cloudfront.net/user_3E8iT9l6XWFvwhu7S8waBGlE14d/hf_20261017_053338_fa31c9e5-276e-4641-9335-b3ae5518fe67.png |
| **K2 v3 colour-matched** (uploaded JPEG, used by clips 1 and 2) | media `e795fcaf-580b-4bc2-b314-2f214835cb6a` | https://d2ol7oe51mr4n9.cloudfront.net/user_3E8iT9l6XWFvwhu7S8waBGlE14d/e795fcaf-580b-4bc2-b314-2f214835cb6a.jpg |
| **K3** | `01dbf21a-7f4a-453a-8855-9c90bde4d4d5` | https://d8j0ntlcm91z4.cloudfront.net/user_3E8iT9l6XWFvwhu7S8waBGlE14d/hf_20261017_051605_01dbf21a-7f4a-453a-8855-9c90bde4d4d5.png |
| **Clip 1** (start → K2, 6 s pro) | `a5b8fdea-b221-49b2-93d7-8c42dbb3086d` | https://d8j0ntlcm91z4.cloudfront.net/user_3E8iT9l6XWFvwhu7S8waBGlE14d/hf_20261017_054955_a5b8fdea-b221-49b2-93d7-8c42dbb3086d.mp4 |
| **Clip 2** (K2 → K3, 5 s pro) | `8da10f5a-4914-4c47-adb5-2da8912e5c1d` | https://d8j0ntlcm91z4.cloudfront.net/user_3E8iT9l6XWFvwhu7S8waBGlE14d/hf_20261017_054957_8da10f5a-4914-4c47-adb5-2da8912e5c1d.mp4 |
| **Clip 3** (K3 → start, 5 s pro) | `bd04e6d3-3727-4552-b891-9281a8764cce` | https://d8j0ntlcm91z4.cloudfront.net/user_3E8iT9l6XWFvwhu7S8waBGlE14d/hf_20261017_054959_bd04e6d3-3727-4552-b891-9281a8764cce.mp4 |
| **Clip 1 4k** (ByteDance, aigc, 24 fps) | `265b4e8c-b56d-4166-a034-87ee93622f70` | https://d8j0ntlcm91z4.cloudfront.net/user_3E8iT9l6XWFvwhu7S8waBGlE14d/hf_20261017_215738_265b4e8c-b56d-4166-a034-87ee93622f70.mp4 |
| Clip 1 Topaz 2160p (A/B, not used) | `c249c41a-ecfe-44c2-a352-cc775498d151` | https://d8j0ntlcm91z4.cloudfront.net/user_3E8iT9l6XWFvwhu7S8waBGlE14d/hf_20261017_220357_c249c41a-ecfe-44c2-a352-cc775498d151.mp4 |
| **Clip 2 4k** (ByteDance) | `1b10a0cd-aa32-45c1-89f2-416466c02274` | https://d8j0ntlcm91z4.cloudfront.net/user_3E8iT9l6XWFvwhu7S8waBGlE14d/hf_20261017_222645_1b10a0cd-aa32-45c1-89f2-416466c02274.mp4 |
| **Clip 3 4k** (ByteDance) | `a98e71a4-4a80-43f1-8465-43408d9a0d86` | https://d8j0ntlcm91z4.cloudfront.net/user_3E8iT9l6XWFvwhu7S8waBGlE14d/hf_20261017_222649_a98e71a4-4a80-43f1-8465-43408d9a0d86.mp4 |
| Reference photos (uploaded) | front `40fc82f6-942e-4bd9-a8d0-829322a2b2d3`, left side `b08d7eeb-c170-4f08-9abb-7d3232f7189c`, back-left `c9981111-5247-41a8-959b-69bd72a389f1`, back `497ce8f6-8864-4d2f-998e-59991986424a` | — |

Models and prices (2026-10-17): stills `nano_banana_pro` at 4k 4 credits each (2 at 2k); clips `kling_o3_flf` pro, 16:9,
`sound: "off"`, 6.25 per 5 s, 7.50 per 6 s (4k mode 30 / 36); `upscale_video` has **no cost preflight** — ByteDance 4k
cost 4.83 for 6 s and 4.03 for 5 s, Topaz 2160p 6.00 for 6 s (read `balance` before and after). The Higgsfield tools arrive
through the claude.ai connector (prefix `mcp__cd8cde6c-…`); preflight paid generations with `get_cost: true`.

Clip prompts used (verbatim): clip 1 "The drone flies steadily forward and descends toward the front of the roof. Camera
moves only; the house is static. Constant speed, no slowing at the end." · clip 2 "The drone orbits around the house at
roof height; the camera moves to the left around the house. Constant speed, smooth continuous arc, no slowing at the
end." · clip 3 "The drone continues orbiting; the camera keeps moving to the left around the house while rising smoothly
back to the high front three-quarter view. Constant speed, no slowing at the end."

## Loop fix (done, proven; the hero's wrap hold is a separate fix, "Loop-wrap hold — fixed" above)

- Root cause: WebKit (Safari engine) stops looping a **WebM** source at the end of the file after the second pass:
  `currentTime` sits at the duration, `paused` and `ended` stay false, readyState 4. Every muxing variant failed (Cues
  in front, 2 s keyframes, a silent Opus track); the H.264 MP4 loops. Chromium never stalls.
- Fix in `src/components/ui/SmartVideo.tsx`: `<source>` MP4 before WebM (all videos), plus a 1 s watchdog: while the
  clip is visible and active, a paused/ended/not-advancing video is restarted (from 0 when it sits at the end), with
  resume on `visibilitychange` and `ended`/`stalled` listeners. Recorded in `CLAUDE.md`.
- Test: `scripts/hero-loop.e2e.ts` via `npm run test:loop` (needs `npm run dev`): 180 s, Chromium and WebKit
  concurrently, frames the viewer sees (`scripts/hero-wrap-tracker.mjs`); asserts ≥ 7 s of media shown per 10 s window,
  ≥ 8 wraps, and since 2026-10-18 no frame interval at any wrap above 84 ms (no hold at the loop point).

Environment reminders: git needs `DEVELOPER_DIR=/Library/Developer/CommandLineTools`; `python3` and `brew` are blocked by
the Xcode 27.1 licence (pixel work is done with Node + sharp); ffmpeg is `node_modules/ffmpeg-static/ffmpeg` (no ffprobe,
no `timeout`); `globals.css` edits need a dev-server restart with `.next` cleared; `.env.local` holds the Anthropic key and
is never committed.
