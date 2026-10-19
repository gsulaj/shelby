# Proof v2 ledger (PROOF_BRIEF.md, 2026-10-18)

Every paid call, request id, ruling and measurement of the storm-damage proof section. fal only (no Higgsfield).
Prices: `fal-ai/nano-banana-pro/edit` USD 0.15 per image (fal's pricing API; 4K is billed at 2× on fal's model page, so
≈ USD 0.30 per 4K image), `fal-ai/kling-video/v3/4k/image-to-video` USD 0.42/s (USD 2.10 per 5 s).

## Setup
- Branch `media`. References backed up untouched: `assets-raw/proof/reference-backup/{damaged_roof,fixed_roof}.mp4`
  (Gemini, 1280×720, 240 frames, 24 fps).
- `assets-raw/proof/ref-damaged-first.png`: frame 0 of `damaged_roof.mp4`, 1280×720. fal upload
  `https://v3b.fal.media/files/b/0aaee6f3/t5XcjFGnqwPP_81hb7c-G_ref-damaged-first.png` (verified, 1,432,974 bytes).

## Charges

| # | Step | Endpoint | request_id | Estimate (USD) | Result |
|---|---|---|---|---|---|
| 1 | D0 attempt 1 (2 candidates) | `fal-ai/nano-banana-pro/edit` 4K 16:9 PNG | `01a1501d-e3df-7f71-9882-4c325e077912` | 0.30 (API) / ≈ 0.60 at the 4K rate | 5504×3072 ×2; rejected (see D0) |
| 2 | D0 attempt 2: cleanup edit of a1 c2 (2 candidates) | same | `01a1501f-d791-71f0-b51c-fad27b55fcff` | 0.30 / ≈ 0.60 | c1 **accepted** → `assets-raw/proof/D0.png` |
| 3 | Clip D attempt 1 | `fal-ai/kling-video/v3/4k/image-to-video` 5 s, no audio | `01a15021-7d54-7be0-81f7-eb25f6f2f0ac` | 2.10 | 3856×2148, 121 frames, **accepted** |
| 4 | F0 attempt 1 (2 candidates), brief prompt verbatim | `fal-ai/nano-banana-pro/edit` 4K | `01a15024-8baa-7301-bcfb-7608ccebe241` | 0.30 / ≈ 0.60 | both reframed to a wide sky view; rejected |
| 5 | F0 attempt 2 (2 candidates), framing locked | same | `01a15026-0727-70f1-b834-fcffc16f0db6` | 0.30 / ≈ 0.60 | invented a gutter and diagonal courses; rejected |
| 6 | F0 attempt 3 (4 candidates), D_last's real geometry described | same | `01a15027-c2bf-7df3-a3b8-003af3456b7b` | 0.60 / ≈ 1.20 | c1 best, **kept at the 3-attempt limit** → `assets-raw/proof/F0.png` |
| 7 | Clip F attempt 1 | `fal-ai/kling-video/v3/4k/image-to-video` 5 s, no audio | `01a1502b-9274-7843-bf8f-d2cbead5a923` | 2.10 | 3856×2148, 121 frames, **accepted** |

**Spend: ≈ USD 7.80** — Kling 2 × 2.10 = 4.20, plus 12 Nano Banana Pro 4K images (2 + 2 + 2 + 2 + 4) at ≈ 0.30 = 3.60
(USD 6.00 if the 4K images were billed at the API's flat 0.15). The connector shows no per-job charge; exact figures:
fal dashboard → usage. No Higgsfield credits used.

## Clip D (Step 2)
- Prompt and negative prompt verbatim from the brief; start image D0. Output 3856×2148 (Kling's 16:9 4K from a
  5504×3072 still), 121 frames, 24 fps, 34 Mb/s H.264. Raw: `assets-raw/originals/proof/clip-D-a1.raw.mp4`.
- Motion: a slow, steady drift forward and to the left along the slope; the gutter leaves the frame at lower right by
  4 s. No shake, no reversal. 480 px motion per half second 2.92 → 4.24 (Kling's ease-in, 1.45× spread; evened later by
  the remap).
- `node scripts/svc-quality-check.mjs .superpowers/sdd/PROOF_BRIEF/qc/config-D.json …/qc/D-a1` (raw clip, no grain):
  sharpness 49.8 / 132.2 / 100.7 at 0.5 / 2.5 / 4.5 s = **1.26× / 3.34× / 2.54×** the hero's shingle baseline 39.6;
  flicker ratio mean **0.036** (hero 0.284), worst 0.089 (hero 90th pct 0.537); pulse max ±0.8% (bar ±27%).
  Straightness flags 22 lines with 0.1–1.2% bow: torn, lifted and curled shingle edges (genuinely curved), not courses;
  the course lines are straight at 100%. Accepted on review, as in the services ruling ("look at any flagged line").
- `assets-raw/proof/D_last.png`: frame 120 of the raw clip at 3856×2148 (upload
  `https://v3b.fal.media/files/b/0aaee71f/vj1aFAT850qCPcV8Ih-5G_D_last.jpg`).

## F0 (Step 3) — hit the 3-attempt limit
- **Why it is hard.** Clip D drifted until its last frame holds no structure but shingle courses and a sliver of
  leaves in the top-right corner: no gutter, no rake edge, no horizon. The brief's F0 prompt names a gutter, a horizon and
  a "deep blue sky", none of which are in D_last, so the model recomposes the frame to show them; and re-shingling a whole
  roof lets it re-lay the courses at its own spacing.
- Seam check written for this step: `node scripts/proof-seam-check.mjs <D_last> <F0> <out> [--roi name:x,y,w,h]`.
  Structural edges (σ 3, Canny 0.10/0.25) for a global shift and per-region distances, plus a course-line measure (24
  vertical strips; the row profile of the vertical gradient cross-correlated between the two frames: offset and
  correlation per strip). Validated on two real neighbouring frames of Clip D (119 vs 120): shift 2 px, course offset
  median 2 px, correlation 0.94 → aligned.
- Attempt 1: both candidates zoomed out to a wide sky view (global shift 44 px, 5% of edges within 2 px).
- Attempt 2 ("composition is locked … do not reveal more sky"): c1 kept the zoom but invented a gutter at lower right and
  laid the courses diagonally (course correlation 0.09); c2 shifted 41 px.
- Attempt 3 (4 candidates; the prompt describes D_last as it is: roof fills the frame, courses almost horizontal and
  descending to the right, no gutter or edge, leaves in the top-right corner; "re-shingle in place, every course on the
  same line"): all four still fail the strict bar. **c1 is the best by far**: global shift 51 px is the tab pattern
  (new tabs never sit where torn ones were); course offset median **6 px**, p90 14 px, correlation 0.38 (c2–c4: 12–30 px,
  0.17–0.24). Kept as F0 at the limit, as the brief says.
- Tried and dropped (free, local): a smooth vertical warp fitted to per-cell course offsets (quadratic, then planar). The
  cells lock onto neighbouring courses (only 54–56 of 216 above correlation 0.3) and neither fit improved the measure
  (median 4 px but p90 12–18 px, correlation 0.36–0.40), so F0 is used unwarped and nothing was moved.
- What it means on screen: during the 0.7 s dissolve the course lines sit a median 6 px apart at 3856 (≈ 4 px at the
  2560 delivery, ≈ 2 CSS px in the 1300 px proof frame) while the camera moves; the leaf cluster in the top-right corner
  is larger in F0 than in D_last, so it grows during the dissolve.
- F0 at 100%: crisp new charcoal architectural shingles, golden raking light, no damage, no text; mid-ground tack-sharp,
  the bottom foreground slightly defocused (shallow depth of field). Mean RGB 102/93/94.
- `assets-raw/proof/F0.png` (5504×3072) + `F0.jpg` (q96, upload `https://v3b.fal.media/files/b/0aaee74d/Ja03xBKEJ1zM2kKeHMDQD_F0.jpg`).

## D0 (Step 1)
- Attempt 1 (brief prompt verbatim, input `ref-damaged-first.png`): both candidates kept the reference's angle well.
  c1 kept the reference's warm low sun (not the brief's cool after-storm light); c2 was cooler and flatter (chosen
  base). Both inherited two defects from the Gemini frame: claw-like diagonal streaks on the exposed underlayment (read
  as a hand or claw print, not storm damage) and garbled "L4"-like marks on the gutter end (garbled lettering). Rejected.
- Attempt 2 (edit of a1 c2, upload `https://v3b.fal.media/files/b/0aaee700/yZCeQx0K7Q59l5Eny-Bxw_D0-a1-c2.jpg`), prompt:
  "Keep this exact photograph … Make only these changes: (1) the exposed dark underlayment … plain, uniform black roofing
  felt with a few loose granules, with no streaks, smears or marks; (2) the white aluminium gutter is clean and plain,
  with no markings, stickers or lettering; (3) deep depth of field …; (4) slightly brighter, clear exposure in soft,
  slightly cool after-storm daylight …". c1: streaks and gutter marks gone, gutter debris kept, geometry identical,
  mean RGB 96/90/103. c2 also emptied the gutter (the brief wants debris there) → c1 accepted. The depth-of-field
  request had no effect (as with the services roofing edit): the far slope stays photographically soft; the in-focus
  foreground is tack-sharp at 100% (granules, torn edges, nails).
- `assets-raw/proof/D0.png` (5504×3072) + `D0.jpg` (q96, uploaded `https://v3b.fal.media/files/b/0aaee70b/lLj5duo3EQyhj3l9DAfiZ_D0.jpg`).

## Clip F (Step 4)
- Prompt and negative prompt verbatim from the brief; start image F0. Output 3856×2148, 121 frames, 47 Mb/s. Raw:
  `assets-raw/originals/proof/clip-F-a1.raw.mp4`. Its frame 0 matches F0 (seam check D_last vs F frame 0: course offset
  median 6 px, correlation 0.38, the same as F0 itself).
- Motion: the same slow drift forward and to the left over the new courses, stable, no reversal; the bottom foreground
  stays softly defocused (it is in F0). Raw colour reads mauve (shingle a* +5–6); fixed in the grade.
- **Speed check.** signalstats YDIF cannot compare the two clips (F's raking light gives the same texture 30% more
  contrast), so `scripts/proof-motion.mjs` measures camera displacement (tile matching, px/frame at full width).
  End of D 3.74 vs start of F 2.85 px/frame: **24% apart (> 15%)** → time-remap. Both clips also show Kling's 8-frame
  speed pulse (two fast frames every eight), D more than F.

## Finishing (Step 5): `bash scripts/proof-finish.sh <clip-D> <clip-F>`
- Size: scale to 2160 high (lanczos), centre-crop 3840×2160, lossless.
- Remap (`scripts/proof-remap.mjs`, the hero/services speed-up-only method on measured displacement): common target 3.4
  px/frame, smoothed over 5 frames, up to 2.22×. D 121 → 97 frames, pace spread 2.35× → 1.24×; F 121 → 115 frames,
  1.36× → 1.20×. **Seam pace D 3.58 vs F 3.31 px/frame (7.5%)**.
- Grade (`scripts/svc-grade.mjs`, the hero grade + a fixed Lab correction, `--anchors none`):
  D `--da -3 --db -1.5 --lift 1.12 --scurve 1.08` → moody, cool, clear: shingles L* 40.6 a* 1.1 b* −4.9, mean L* 40.0, 0%
  clipped. F `--da -2.2 --db 1.2 --scurve 1.06` → charcoal in golden sun: shingles a* 2.3 b* 3.2 (the approved services
  roofing close-up: a* 4.4 b* 4.1), foliage ΔE 2–4 from the hero's, mean L* 37.9.
- **In-place dissolve** (`scripts/proof-seam-blend.mjs`, 17 frames = 0.71 s centred on the seam). An xfade would overlap
  two different moments of the move (≈ 17 frames of travel apart) and double every line, so both clips sit on one camera
  timeline (D_last and F0 share frame 96) and each layer is extended past its end by carrying its seam frame along the
  other clip's measured affine motion. Self-check: D frame 88 carried 8 steps onto D_last, mean |ΔY| 11.4 vs 17.9
  unmoved. Luma through the dissolve glides 97.9 → 92.8 with no step.
- Fades: 0.25 s in from and 0.5 s out to `--ink` (#0F1216). Wrap luma …41.5, 36.3 | 31.0, 42.3, 53.6… (a dip, no pop).
  The brief named only the fade out; without the fade in the wrap would cut from near-black to full exposure.
- Grain `alls=5` at 3840 last → `assets-raw/proof/proof-master-4k.mp4` (211 frames, 8.79 s, CRF 12, 329 MB;
  `assets-raw/proof-morph.mp4` links to it). Grain-free master: `assets-raw/originals/proof/proof-morph.v2-clean.mp4`.
- **Length 8.79 s** instead of the brief's ~10–11 s: the remap that evens the speed and matches the seam shortens D by
  24 frames and F by 6 (speed-up only; slowing down would interpolate every frame).
- Deliver (`bash scripts/process-media.sh proof-morph.mp4`): 2560×1440 H.264 High CRF 18 +faststart **25.0 MB
  (23.9 Mb/s)**, VP9 CRF 24 20.1 MB, poster = frame 6 (the first full frame after the fade-in; frame 0 is ink). SSIM
  master → mp4 0.981 / 0.987 / 0.982, → webm 0.983 / 0.985 / 0.978 at frames 24 / 120 / 190. v1 kept as
  `public/media/proof-*.v1.*` and `assets-raw/proof-*.v1.*`.
- Slider stills: `proof-before` = graded D_last (D's frame 96), `proof-after` = graded F0 (F's frame 0), 3840×2160 PNG
  in `assets-raw/proof/`, JPG q1 in `assets-raw/`, delivered 3840 JPG (1.1 / 1.7 MB) + WebP (0.5 / 1.0 MB).

## Measured (grain-free graded clips, `node scripts/svc-quality-check.mjs .superpowers/sdd/PROOF_BRIEF/qc/config-final.json …/qc/final`)

| Clip | Sharpness, 3 × 100% crops (hero 39.6) | Flicker ratio mean / worst (hero 0.284 / 0.537) | Pulse max (bar ±27%) |
|---|---|---|---|
| D (damaged) | 54.9 / 80.0 / 92.2 (1.38–2.33×) | 0.044 / 0.089 | ±14.9% |
| F (new roof) | 203.0 / 324.8 / 414.2 (5.1–10.5×) | 0.041 / 0.084 | ±9.5% |

- D's pulse rose from ±0.8% (raw) to ±14.9%: the remap interpolates most of D's frames (rate up to 2.22×), and an
  interpolated frame is a little softer than a source frame. Within the bar the owner accepted on the hero.
- Straightness flags course butt edges and torn edges at 0.1–0.86% bow (≤ 3.4 px on 300–1000 px) with ~1 px wobble
  (granule roughness, as on services). The courses read straight at 100%.
- **Seam** (`node scripts/proof-seam-check.mjs …/D-graded.mp4@96 …/F-graded.mp4@0`): course offset median 6 px, p90
  14 px at 3840, correlation 0.375 (aligned neighbouring frames: 0.94). **Fails the brief's "within a few pixels"**: F0
  is the best of the 3 attempts. On screen: ≈ 4 px at 2560, ≈ 2 CSS px in the 1300 px proof frame, during a 0.7 s
  dissolve with the camera moving.

## Component (Step 6)
- `src/components/sections/Proof.tsx`: label in the frame's top-left, eyebrow type (Barlow Condensed 600, 0.18em, 13 px)
  with a 24 × 1 px accent rule on `bg-ink/60`; "Before" until `proofMorphSwitchAt` (4.0 s, `src/content/media.ts`),
  "After" from it; 0.3 s opacity cross-fade (`motion-reduce:transition-none`); read from the front video's
  `currentTime` on animation frames while the frame is in view; `aria-hidden`. Copy `site.proof.phases` (also the
  slider's labels). Clip-path reveal and copy unchanged; `proofMode` stays `"video"`.

## Playback (Step 7), after a clean restart (`.next` cleared)
`node scripts/hero-wrap-check.mjs --section "#proof" --seconds 45 --headed true` (new options: `--section`, `--headed`):

| Engine | Native `loop`: wrap (ms) | Double buffer: wrap (ms) | Shown fps | Decoded / dropped |
|---|---|---|---|---|
| Real Safari | 84, 66, **86**, 82, 82 | 53, 52, 51, 52, 50 | 23.97 | 1079 / 0 |
| Real Chrome (headed) | 66.6–67.2 | 49.5–51.7 | 24.04 | 1101 / 0 |
| Playwright WebKit | 66, 66, **85**, 83, 82 | 49–53 | 23.98 | 1095 / 0 |
| Playwright Chromium (headed) | 66.7–83.4 | 50.0–51.9 | 24.02 | 1101 / 0 |

Native wraps went over 84 ms in Safari and WebKit → `seamless: true` on `proofMorph` (the brief's rule).
`node scripts/proof-verify.mjs` (Chromium + WebKit, double buffer): 3 loops, the label matches the clock in all
533–557 samples, 6 changes (2 per loop); BEFORE/AFTER shots at 1440 and 390 (`docs/screenshots/proof-v2/`); reduced
motion = poster, no `<video>`, label "Before"; console clean everywhere. Slider mode (temporarily `proofMode = "slider"`,
then back): both 3840 stills load, keyboard End/ArrowLeft → 98, console clean. `node scripts/verify-media.mjs`: all
checks passed (its reveal locator now finds the nearest ancestor with the clip-path, since a double-buffered
SmartVideo wraps its videos in a host div). tsc clean; lint 0 errors (2 old warnings in gitignored tools); 59 unit tests;
`npm run test:loop` 2 of 2 (181.8 s).

Hero wrap check (the hero untouched): `node scripts/hero-wrap-check.mjs --seconds 150`, 10 wraps per engine — Chromium
50.0–66.7 ms, WebKit 49–57 ms, Chrome 50–66.7 ms, real Safari 50–54 ms (limit 84). The first full run, taken while other
work was running, had one Chromium wrap at 133 ms with 9 content skips and a Safari window hidden for 41 s; Chromium and
Safari were re-run on an idle machine (above). Logs: `.superpowers/sdd/PROOF_BRIEF/playback/`.
