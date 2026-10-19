# Services v2 ledger (SERVICES_BRIEF.md), 2026-10-18

Every paid call, id, ruling and measurement for the services media pass. Branch `media`.

## Spend log

| # | Provider | Item | Cost | Balance after |
|---|---|---|---|---|
| 0 | Higgsfield | start | — | 98.61 credits |
| 1 | Higgsfield | Nano Banana Pro 4k ×2, roofing (7 references) — candidate A failed and was refunded | 4.00 | — |
| 2 | Higgsfield | Nano Banana Pro 4k ×2, siding | 8.00 | — |
| 3 | Higgsfield | Nano Banana Pro 4k ×2, windows | 8.00 | — |
| 4 | fal | Starlight Precise 2.6 ×1.5, gutters v1 (5.04 s), `01a14f4d-d31c-7783-a5b2-923ae66b4094` | ≈ USD 1.31 (rate 0.26/s; Topaz bills undocumented units) | — |
| 5 | Higgsfield | NB Pro 4k edit, siding roof → charcoal | 4.00 | — |
| 6 | Higgsfield | NB Pro 4k edit, windows trees green + plain books | 4.00 | — |
| 7 | Higgsfield | NB Pro 4k edit, roofing shallow depth of field — no visible change, not used | 4.00 | 66.61 credits (read) |
| 8 | Higgsfield | Kling 3.0 Omni Frames 4k, 1:1, 5 s, silent — roofing `b411de6c-b88c-4798-8a6e-34f589b4662a` | 30.00 (preflight) | — |
| 9 | Higgsfield | Kling 3.0 Omni Frames 4k, 1:1, 5 s, silent — windows `c46cf8ae-e184-45bb-864b-4f47b7d1b075` | 30.00 (preflight) | — |
| 10 | fal | Kling v3 4K image-to-video, 5 s, no audio — siding `01a14f5e-0143-7562-80ca-78f13a08e97c` | USD 2.10 (estimate_cost) | — |

## Rulings

- R1. The brief asks for Kling 3.0 Omni Frames **4k mode**; the playbook (written before this brief) said never 4k mode.
  The brief is newer and explicit, so 4k mode is used. Preflight: 30 credits per 5 s 1:1 clip (pro: 6.25).
- R2. Budget: 98.61 credits covers the three 4k stills (count 2, 24 credits) and two 4k clips (60). The third clip and
  any retakes go to fal per the brief's fallback.

- R3. Stills: roofing B (`f03d6aae`) used as generated; the depth-of-field edit (`cdb29ee7`) came back unchanged, so the
  stone tower stays in focus (it keeps the hero house recognisable; a local blur would need a hand/nailer cut-out).
  Siding A (`17c7c261`, B was grey not navy) + roof edit (`3d3acd05`), whose two remaining brown strips and purplish
  main roof were moved locally to one neutral cool charcoal (Lab a* 0.5 / b* −3.5, lightness kept, 8.3% of the frame,
  no pixel moved; `.superpowers/sdd/SERVICES_BRIEF/tools/siding-roof-fix.mjs`). Windows A (`363ece51`; B's sun pane
  was blown, 0.59% clipped) + edit (`6ab67c1c`: autumn tree → green, garbled book text → plain), three faint spine
  marks filled locally. Finals: `assets-raw/stills/svc-{roofing,siding,windows}.v2.{png,jpg}`; candidates in
  `assets-raw/originals/services-v2-stills/`.
- R4. Clip providers: roofing and windows on Higgsfield 4k mode (60 credits); siding on fal's native-4K Kling v3
  (`fal-ai/kling-video/v3/4k/image-to-video`, USD 0.42/s), since 6.61 credits cannot pay a third 4k clip.
- R5. Gutters: v1 is 1440×1440, so Starlight Precise 2.6 ×1.5 → 2160×2160 HEVC, 121 frames kept; colour-matched to v1
  with `scripts/hero-colormatch.mjs` (ΔE 0.76 → 0.03). Backup `assets-raw/svc-gutters.v1.mp4` (byte-identical to v1).
  The clip is a rain scene (wet shingles, fallen leaves): the regrade warms and brightens it but cannot make it summer.
- R6. Measurement bars (`scripts/svc-quality-check.mjs`): sharpness ≥ mean of the hero's three grain-free shingle
  crops (61.1 / 29.1 / 28.7 → 39.6, reproducing the before/after log); flicker ratio (1 − efficiency, hero shimmer
  method) mean ≤ hero 0.284 and worst ≤ hero 90th percentile 0.537, pulse ≤ 27%; straightness on the 12 longest lines
  bow ≤ max(1.5 px, 0.2% of length) and wobble ≤ 0.8 px.

## Jobs

| Asset | Job / request id | Notes |
|---|---|---|
| roofing still A | `b3a39369-f10e-4f37-bbda-9a0f407b2cc1` | failed, refunded |
| roofing still B (used) | `f03d6aae-83c5-4d31-b2c2-193d4cd126cc` | 4096², hand + nailer, stone tower behind |
| roofing DOF edit | `cdb29ee7-b790-4c6e-929d-550b76c6210c` | unchanged focus, not used |
| siding still A | `17c7c261-46a4-4e4c-9a2d-a752f9c393c6` | chosen |
| siding still B | `ef12e943-3e6f-42c6-a156-ed1d1173f04a` | grey wall, rejected |
| siding roof edit | `3d3acd05-47b9-45b3-bb05-dc1e9613c27a` | + local charcoal match → upload media `26731129-742e-4ded-8f22-94b185c55c70` |
| windows still A | `363ece51-65ec-4576-8643-8bd7cb2a8acc` | chosen |
| windows still B | `bb8aeed8-deda-4ba1-8d4f-3ea0be1f315f` | blown sun pane, rejected |
| windows edit | `6ab67c1c-e76a-4c7a-b312-94e7bdaa336d` | + spine cleanup → upload media `b3a78137-d3c2-41f0-a8c7-ae831db9fb12` |
| siding still on fal | `https://v3b.fal.media/files/b/0aaee208/vx84aiZR5M9XIyh5haG28_svc-siding.v2.jpg` | |
| gutters v1 on fal | `https://v3b.fal.media/files/b/0aaee19f/iGtQS79l_89xmk3yXJW_E_svc-gutters-v1.mp4` | |


## Clips (attempt 1, all kept)

| Clip | Provider · job / request | Raw | Notes |
|---|---|---|---|
| roofing | Higgsfield `kling_o3_flf` 4k · `b411de6c-b88c-4798-8a6e-34f589b4662a` | 2880×2880, 121 frames, 24 fps, 31 Mb/s | Kling rendered the shallow depth of field the still edit could not; nail shot with a dust burst at ~2.2 s, hand moves to the next spot; no reversal (reversed/forward halves SSIM 0.687/0.685) |
| windows | Higgsfield `kling_o3_flf` 4k · `c46cf8ae-e184-45bb-864b-4f47b7d1b075` | 2880×2880, 121 frames | dolly-in; eases in over the first ~1.3 s (480 px motion 0.4 → 2.5) |
| siding | fal `fal-ai/kling-video/v3/4k/image-to-video` · `01a14f5e-0143-7562-80ca-78f13a08e97c` | 2880×2880, 121 frames | lateral track; accelerates 4.2× over the clip (0.7 → 3.0) |
| gutters | v1 kept; fal Starlight Precise 2.6 ×1.5 · `01a14f4d-d31c-7783-a5b2-923ae66b4094` | 2160×2160 HEVC, 121 frames | colour-matched to v1 (ΔE 0.76 → 0.03) |

Native 4k mode at 1:1 is **2880×2880** on both providers (confirmed by decode), so delivery at 2160 is a downscale; no
upscale was needed for the three new clips.

## Finishing rulings

- R7. Constant speed: Kling eases into a first-frame-only move. `scripts/svc-remap.mjs` (the hero's speed-up-only
  method, planned globally): siding target = 80th percentile pace, rate up to 3.4× → 88 frames, smoothed pace spread
  4.22× → 1.36×; windows target = 70th percentile, up to 3.6× → 102 frames, spread 4.30× → 1.24×. Roofing's camera is
  steady (its mid-clip motion peak is the hand), gutters is locked: no remap.
- R8. Grade (`scripts/svc-grade.mjs`): the hero's finishing grade, then a correction anchored on content classes both
  scenes share (neutral highlights → white balance, clamped ±4 a*/b*; sky + foliage → chroma gain, clamped 0.90–1.15).
  Roofing Δa* −1.67 Δb* −0.64, gain 0.90; siding Δa* +0.45 Δb* +4.00 (clamp), gain 0.98; windows **no white-balance
  anchor** (`--no-wb`: its bright neutrals are walls in warm sun; the anchor wanted Δb* −4, cooling the golden light
  away), gain 1.125 from the foliage; gutters manual (`--anchors none`: its wet blue shingles read as "sky") — lift γ 1.5,
  S-curve 1.15, lightness-weighted warm shift Δa* +4 Δb* +18 (highlights warm, shadows neutral), gain 1.08. Grain after
  everything, at the delivery scale, `alls=5` (the hero's calibration).
- R9. Loop: 0.5 s crossfade on all four (`scripts/svc-finish.sh`, lossless). Gutters' last frame is not a copy of its
  first (SSIM 0.968 vs 0.99+ for an ordinary step), so it gets the crossfade too. The wrap itself is an ordinary step on
  all four (seam SSIM last→first vs frame 0→1: roofing 0.970/0.975, siding 0.912/0.929, windows 0.879/0.908, gutters
  0.996/0.994). **The dissolve shows a double image on the three clips whose camera or subject travels**: the two frames
  blended 50/50 sit, at 2160 px, a median 70 px apart on roofing (the hand and nailer appear twice), 19 px (max 64) on
  siding (windows and gable doubled) and 147 px on windows (the window frame and chairs doubled); gutters 0 px. A
  non-returning push-in, track or hand move cannot close without a reversal (banned) or a dissolve; the playbook records
  the owner's earlier ruling that the dissolve is "fine for short moves and for panels". Kept per the brief's method;
  flagged in the report with the seamless alternative (locked camera, first frame = last frame, like gutters).
- R10. Delivery: 2160×2160 H.264 High CRF 18 +faststart (roofing 14.4 MB / 26.5 Mb/s, siding 11.4 MB / 30.5,
  windows 13.8 MB / 31.2, gutters 14.0 MB / 25.8) + VP9 CRF 18 (VP9 smooths the grain and plateaus at SSIM ~0.96 at any
  CRF against H.264 CRF 18's 0.970 on a 2 s cut, so it is matched by bitrate: 6.8 vs 6.2 MB per 2 s) + first-frame
  poster. v1 files kept as `public/media/<name>.v1.{mp4,webm}` and `<name>-poster.v1.jpg`; v1 masters as
  `assets-raw/svc-<name>.v1.mp4`.
- R11. Playback. First native-loop round at 2160² (`scripts/svc-wrap-check.mjs`): real Safari 23.6–23.8 fps, 0 dropped
  over a 40 s scroll of the sticky section, wraps 66–84 ms; WebKit 23.6–23.8 fps, wraps 66–84 ms. Headless Chromium and
  headless Chrome showed 15–18 fps with frame skips once more than one service clip had loaded (a fresh load straight to
  siding or windows played at 23.8 fps), and the same at 1800² — so the 1800 fallback was tried and **not** kept: it
  is a headless-rendering artefact. Headed Chrome plays all four at 23.8–23.9 fps with no skips (scroll: 1175 decoded,
  3 dropped, all at clip switches). Headed runs are the "real Chrome" numbers from here on.
- R12. Wraps above 84 ms at the native loop (roofing 85.2, siding 84.4, gutters 101.3 ms in headed Chrome; windows 86 ms
  in WebKit) → per the brief, all four loop through `SmartVideo seamless`, enabled per clip from `src/content/media.ts`
  (`seamless: true` → `ResolvedVideo.seamless` → `Services.tsx` passes it to both the sticky-panel and the mobile
  `SmartVideo`). No other component or layout change. `scripts/svc-wrap-check.mjs`, `scripts/svc-verify.mjs` and
  `scripts/verify-media.mjs` read the front element of a double-buffered layer. The 3.1 s siding loop ends before
  SmartVideo's 4 s calibration point, so its first wrap is uncalibrated (83 ms in WebKit); later wraps self-calibrate.
- R13. Colour, same pixels before → after the correction (a*b* distance to the hero's class mean): roofing whites 1.8 → 0.3,
  sky 3.1 → 0.9; siding whites 4.5 → 0.4, sky 2.1 → 6.8 (the whites-only warming shift); windows foliage 8.3 → 7.6, whites
  5.4 → 6.3 (the foliage-driven chroma gain); gutters by hand.
- R14. Final verification after a clean restart, all four clips `seamless`: real Safari 23.85–23.98 fps, wraps 48–53 ms
  (first wrap after activation 83 ms on siding and windows), 40 s scroll 0 of 538 dropped; headed Chrome 23.97–24.17 fps,
  48–52 ms, 0 of 748 dropped; headed Chromium 24.0 fps, 48.5–51.8 ms, 0 of 754 dropped in the scroll (2 in roofing's wrap
  phase); WebKit 23.6–23.8 fps, 49–53 ms (first wrap 83–85 ms), 0 of 253 dropped. `test:loop` 2 of 2; hero wrap check
  10 wraps per engine, worst 52–66.7 ms; `verify-media` and `svc-verify` all passed; tsc clean, lint 0 errors, 59 tests.
  No asset hit the 3-attempt limit; every clip is attempt 1. Spend: 92.00 Higgsfield credits (balance 6.61) + ≈ USD 3.41
  on fal.
