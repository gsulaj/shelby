# MEDIA_PLAYBOOK.md — the proven method for the remaining video assets

What the hero taught us, written down so the services videos (roofing, siding, windows), the proof section (before/after
stills and the morph) and any later clip follow the same path without re-learning it. Read with `CLAUDE.md` (style and
tooling), `docs/HERO_RESUME.md` (the hero's exact recipe, paths, job ids and prices) and `docs/STATUS.md` (where things
stand). Every ruling behind this page is in `docs/superpowers/plans/2026-10-17-hero-ledger.md`.

## 1. Creative direction

- **Bright, aspirational late-afternoon Michigan summer.** Sun around 5 pm, warm golden light with soft long shadows, deep
  blue sky with a few soft white clouds, lush saturated green lawn and trees, vivid but natural high-end real-estate colour.
- **Never dark, overcast, cool, desaturated or wintry.** v1 failed exactly there. The dark UI frames the footage; the footage
  itself is bright. The site sells vision: what the homeowner's house will look like.
- Prompt wording that produced the approved frames: "late afternoon summer sun around 5pm with warm golden light and soft
  long shadows, deep blue sky with a few soft white clouds, vivid but natural high-end real estate photography color grade,
  ultra-detailed, tack sharp, photorealistic, no text, no logos, no watermarks, no people, no cars in driveway".
- Do not prompt for "cinematic", "moody" or "dramatic". The warm lift is added in finishing (section 6), the prompt only sets
  the light and the season.

## 2. The house: style and continuity reference

- The approved hero house: blonde brick with natural stone veneer, arched stone entry tower, charcoal hip-and-gable
  architectural shingle roof, black-framed windows, black garage doors on a three-car wing, covered rear porch with a wood
  ceiling, wide driveway, manicured lawn and fresh landscaping, in a new-construction Macomb County subdivision.
- **Continuity set** (use as `image_references` for any asset that shows the house, and as the geometry truth when
  reviewing): `assets-raw/stills/hero-frame.v2a-final.png` (start frame: front three-quarter from the south-west, high),
  `hero-k2.matched.png` (low over the front roof at the garage end), `hero-k3.png` (rear three-quarter from the back-right).
  Upload the JPG copies (`*.jpg`, quality 1): the connector refused a 37 MB PNG and curl PUTs over ~3 MB fail (use Node's
  `https.request`).
- The client's photos in `assets-raw/reference/` are an architecture reference only. They shaped the house; they must never
  appear in a frame.
- A new angle of the house is made as an **edit of the nearest keyframe** (section 4), never a fresh generation, and is
  checked against the continuity set at 100% before any clip is rendered from it.
- For the proof "before" frame: the same house, storm-damaged, as an edit of the start frame (section 4 and 5 rules still
  apply to the "after"); the "after" is the hero house as it is.

## 3. Motion technique

- **Model:** Kling 3.0 Omni Frames (`kling_o3_flf`), **pro** mode, `sound: "off"`, 16:9 for wide shots and 1:1 for the
  service panels, 5–6 s per clip, for a chain whose approved takes are upscaled (the hero). 4k mode renders a new take at
  about five times the price (30–36 credits per clip against 6.25–7.50), not an upscale of an approved take.
- **Brand-new single clips (services v2, 2026-10-18): native 4K.** `SERVICES_BRIEF.md` asked for 4k mode, and it is right
  for a new take: 1:1 comes out at **2880×2880**, 121 frames, 24 fps, sharper than pro + upscale, so the 2160 delivery is a
  downscale. **fal's `fal-ai/kling-video/v3/4k/image-to-video` costs USD 0.42/s (USD 2.10 per 5 s clip) against 30
  Higgsfield credits** for the same native 4K; use fal for 4K takes and retakes (`generate_audio: false`, the aspect comes
  from the start image). Details in section 10.
- **Different first and last frames for every clip.** The same frame at both ends makes the model push in and rewind: the
  15 s Plan A preview ping-ponged (reversed-halves SSIM 0.69 against 0.59 forward) and cost 18.75. The one proven exception
  is a locked camera with subject-only motion (the v1 gutters clip keeps its still at both ends: drips only, no reversal).
- **One camera move per clip, in camera language, and the subject static.** The prompts that worked:
  "The drone flies steadily forward and descends toward the front of the roof. Camera moves only; the house is static.
  Constant speed, no slowing at the end." · "The drone orbits around the house at roof height; the camera moves to the left
  around the house. Constant speed, smooth continuous arc, no slowing at the end."
- **Consistent direction, no reversal across a chain.** Pick the direction seen from above (the hero orbits clockwise, the
  camera moving to its left) and keep it in every prompt of the chain.
- **Arcs under 180° between consecutive keyframes.** An interpolating model takes the shorter arc, so a longer one flips the
  direction. Hero arcs: about 40° / 155° / 165°.
- **Loops.** A seamless loop is a chain that returns to its start frame (hero: start → K2 → K3 → start, 6 + 5 + 5 s). Two
  clips cannot close an orbit (each arc would be 180°), so a full orbit needs three. A short non-orbit move (dolly, crane,
  push) can be looped with a crossfade (`scripts/media-loop-close.sh`), but the dissolve shows on long camera travel (v1
  services) — fine for short moves and for panels, not for the hero.
- Kling eases into its end frame whatever the prompt says. The stitch trims the easing (section 6) and the time-remap evens
  what remains. Expect a judgment call on about one clip in three (hero clip 2 hugged the stone tower instead of circling at
  roof height and was accepted); budget one retake per asset.

## 4. Still workflow (style frames and keyframes)

- **Model:** Nano Banana Pro (`nano_banana_pro`) at **4k**, the clip's aspect ratio, `count: 2` for a new composition (two
  candidates at 4 credits each; 2k is 2 credits and not sharp enough for a frame that becomes a poster or a 4k clip).
- **Edits, not regenerations, to preserve geometry.** Cleanups (plaque lettering, lawn signs, wires, a phantom chimney) and
  new angles are image edits with the approved frame's job id as the reference. A regeneration is a new house; an edit is a
  re-render that keeps the content (SSIM against the source drops to ~0.45 from a few-pixel shift, but nothing moves).
  An edit can still miss (the first cleanup removed the plaque and the sign but not the wires): diff the result against the
  source before using it.
- **Every roof plane must be physically attached and continuous.** K2 v1 was rejected because its foreground shingles were a
  roof plane not attached to the house; a clip from it would have morphed. Check at 100%: each slope meets a wall or a ridge,
  the ridge cap is flat and continuous, valleys are clean, no extra chimney or dormer, the window and garage-door counts
  match the start frame, no text, no people, no wires or poles.
- **Composition.** Wide shots put the house in the right half with sky and lawn on the left for the headline; 1:1 service
  frames centre the subject with the product (roof, siding, window, gutter) filling most of the frame.
- **Tone drift is fixed locally, for free.** An edit can shift one material's colour while the geometry is right (K2 v3's
  stone tower came back cooler and lilac against the start frame's beige). Measure the mean RGB of that material in both
  frames with sharp, apply a per-channel gain inside a soft mask over the drifted region only, re-measure, inspect at 100%,
  and save as `<name>.matched.png` with a quality-1 JPG; that JPG is what gets uploaded as the keyframe. It costs nothing and
  moves no pixels; a paid re-edit (4 credits) re-renders the whole frame and can drift elsewhere. On K2 v3 the match touched about 10% of the frame (the stone and brick) and moved that region's mean RGB
  from a lilac 110/89/104 to a warm 147/103/75; nothing else changed.
- Save the PNG original plus a quality-1 JPG in `assets-raw/stills/`; keep superseded versions with a suffix
  (`.v2`, `.rejected-v1`) and record every job id in the ledger.

## 5. Shingles: the product must look brand new

- Charcoal architectural asphalt shingles, crisp uniform rows, visible granule texture, ridge cap seated flat and continuous,
  clean valleys and drip edges, straight ridge lines. **No** wear, granule loss, lifted or curled edges, moss, patches, repairs
  or mismatched colour anywhere on the hero house or on any "after" frame.
- Reference tones measured on the approved frames (sRGB means): sunlit main roof about 31/44/71, garage roof in shade about
  54/54/78, the sunlit close-up of K2 about 74/73/93: the same charcoal family, lighter in a close-up.
- Prompt wording: "brand-new charcoal architectural asphalt shingle roof with crisp clean ridge lines". Review: a 100% crop of
  every roof plane before a frame is turned into a clip, and again on the clip's frame grabs.
- The storm-damaged "before" frame is the only place wear belongs, and it must be the same house with the same geometry.

## 6. Finishing pipeline (run it exactly like this)

1. **Upscale the raw clips, never the stitched file: Starlight Precise 2.6, then colour-match to the source.** The hero's
   proven path (2026-10-18). Each raw Kling clip goes through Starlight Precise 2.6 on fal: `topaz/upscale/video/generative`,
   model `Starlight Precise 2.6`, `upscale_factor` 2.015 (1928×1072 → 3884×2160), no `target_fps`, so the frame count
   and 24 fps are kept. It costs about USD 0.26/s at 4k (rate-based; the exact charge is in the fal dashboard). Upload
   through the fal connector (`prepare_upload` + PUT). It gives real shingle, mortar and stone detail with faithful
   architecture. Then three mandatory checks:
   - **Colour-match every upscaled clip to its raw source** before anything else:
     `node scripts/hero-colormatch.mjs <raw> <upscaled> <out>`. CIELAB mean and std transfer, statistics taken at 960 px so
     the added detail is not read as contrast, baked into a 65³ LUT, applied at full resolution, lossless output. Starlight
     shifts tone slightly: on the hero ΔE 0.66 → 0.04 and ΔY 1.1 → ≤ 0.06 levels after the match.
   - **Strict architecture check:**
     `node scripts/hero-architecture-check.mjs <raw> <baseline-4k> <new-4k> <out-dir> [label]`. Strong edges only
     (rooflines, ridges, eaves, window frames, the arch); recall and precision must each stay within 0.03 of the baseline on
     average and 0.05 on the worst frame. It fails Astra 2, which invented a stone pier.
   - **Shimmer.** Kling's VAE packs 4 frames per latent, and an upscaler amplifies that into a ~6 Hz sharpness pulse.
     Measure it on the grain-free stitch with `node scripts/hero-shimmer-check.mjs <new-stitched> <old-stitched>
     <remap-plan.json> <out-dir>` and compare with what the owner accepted on the hero: a 20–27% pulse at worst, on roof and brick. Above that, show a 100% review clip before going on.

   Choosing an upscaler for a new kind of asset: `node scripts/hero-upscale-shootout.mjs <candidates.json> <out-dir>`
   (detail, calibrated temporal coherence, pulse, fidelity, colour). Rejected on the hero: Starlight HQ (softer than
   ByteDance on a brick wall), Astra 2 (invents architecture), SeedVR2 (boils, softer in places). **Cheap fallback:**
   ByteDance 4k on Higgsfield (`upscale_video`, `provider: "bytedance"`, `resolution: "4k"`, `preset: "aigc"`,
   `fps: 24`, the source `width`/`height`, the clip's job id as `video_id`). It keeps geometry, tone and frame count,
   but reads soft and waxy at 100%. It has **no cost preflight**: read `balance` before and after. Topaz 2160p pads a
   non-16:9 clip and came back softer. Details and request ids: `docs/HERO_RESUME.md` "Sharpness pass".
2. **Re-stitch with the recipe.** `BLEND_FRAMES=3 TRIMS="h,t h,t h,t" bash scripts/hero-stitch.sh c1 c2 c3 out.mp4 workdir`:
   common crop to the smallest clip, the easing trims measured on the raw clips at the preview gate (reuse the same TRIMS so
   the upscaled loop matches the approved one frame for frame), 3-frame seam blends, loop close. Its speed table is the first
   QA. For a single-clip asset there is nothing to stitch; close the loop with `scripts/media-loop-close.sh` if it loops.
3. **Finish.** `bash scripts/hero-finish.sh stitched.mp4 assets-raw/<manifest name>.mp4 workdir`: time-remap for constant
   speed (speed-up only, at most 1.5×, measured at 480 px, whole-frame regions so untouched frames pass through bit-exact),
   the warm grade, light grain, a 4k master (CRF 17; the hero used `MASTER_CRF=12` because it delivers at 3840).
   `POSTER_IN`/`POSTER_OUT` put the same grade on the poster still so frame 0 does not pop. `SKIP_REMAP=1` for a clip
   whose motion is already even; `REMAP_PLAN=<dir>` reuses a recorded remap so a re-finished loop keeps its timing frame
   for frame (the hero's is `docs/hero-remap-plan/`); `GRAIN=0` for stills.
   Grade: `eq=saturation=1.05:contrast=1.01,colorbalance=rm=0.018:gm=0.004:bm=-0.022:rh=0.008:bh=-0.012` — never
   `colorbalance … pl=1` (in ffmpeg 6.0 it cut saturation by a quarter and mottled the lawn).
   **Grain goes on last, after the upscale**, at 4k in the finish: `noise=alls=5:allf=t+u`, calibrated on 100% crops at
   the delivery scale (4 barely visible, 6 clearly visible). Never feed grain to an upscaler: a generative upscaler
   re-invents fine texture frame by frame, and grain is exactly that. Take every sharpness, shimmer or colour measurement
   on the grain-free version; the hero's before/after and shimmer checks did.
4. **Deliver.** `bash scripts/process-media.sh <manifest name>`: the hero at 3840×2160 CRF 20 (VP9 CRF 26; Safari cannot
   decode 4k H.264 above ~60 Mb/s in real time, so CRF 16 stutters there — check with `scripts/hero-playback-check.mjs`
   and real Safari), everything else
   at its own settings (service clips 2160² CRF 18, section 10; proof morph 2560 CRF 18, section 11). `SmartVideo` serves **MP4 before WebM** (WebKit stops
   looping WebM) and runs the watchdog; do not reorder the sources.
   **Heavy looping video: double-buffer it, never the native `loop`.** At 3840×2160 the native loop held the last frame
   at every wrap while the one decoder restarted a 4k stream: Safari 132–152 ms, WebKit 133–208 ms, Chromium 117–150 ms,
   Chrome 67–83 ms. Re-encoding (`-bf 0`, `b-pyramid=none`) never helped; the 2560 file had no hold.
   - `<SmartVideo seamless>` loops through two stacked elements instead. The back one waits paused on frame 0, already
     decoded. requestVideoFrameCallback times the swap to the end of the front's last frame, and the back one starts one
     measured start-up delay early (40–60 ms in Safari, about 0 in Chrome). Result: 50–67 ms at every wrap in all four
     browsers, 0 dropped frames in Safari and Chrome, at a cost in Safari of CPU 28% → 32% and +360 MB.
   - The hero, the four service clips and the proof use it (the manifest `seamless` flag). Give it to any clip that holds at the wrap. The 2560 hero had no hold, so the 1280 px
     clips are not expected to need it, but their wraps have not been measured: measure before assuming.
   - Measure with `node scripts/hero-wrap-check.mjs` (10 wraps in Chromium, WebKit, Chrome and real Safari; the limit is
     84 ms, two 24 fps frames). Keep the Safari window in front: a hidden page stops rendering. The check reads
     `#top video`, so another section needs its own selector. `npm run test:loop` asserts it for the hero.
   - The whole design is in `docs/HERO_RESUME.md` "Loop-wrap hold — fixed".
5. **QA before anything is called done.** The motion tables before and after the remap; SSIM master → delivery at three
   timestamps (hero: ≥ 0.986); 100% crops of the sky (grain, banding) and of the product at the delivery scale; poster
   against frame 0 (mean RGB within a few levels); `node scripts/verify-media.mjs`; `npm run test:loop` and `node scripts/hero-wrap-check.mjs` whenever the hero
   file or `SmartVideo` changes; `node scripts/hero-playback-check.mjs` and real Safari for any 4k delivery; `node scripts/hero-contrast.mjs` whenever the hero or its overlay changes; screenshots at 1440 and 390.
6. **Keep the chain of custody.** Raw downloads in `assets-raw/originals/` (gitignored), masters and stills in `assets-raw/`
   under the manifest names, everything copied to `~/Desktop/shelby-hero-backup/`, ids and costs in the ledger.

## 7. Credits: what the hero actually cost (2026-10-17 prices)

| Item | Credits |
|---|---|
| Nano Banana Pro 4k still, per image (2k: 2.00) | 4.00 |
| Nano Banana Pro 4k edit of an existing frame | 4.00 |
| Kling 3.0 Omni Frames pro, 16:9, silent: 5 s / 6 s / 15 s | 6.25 / 7.50 / 18.75 |
| Kling 4k mode, same durations (do not use) | 30.00 / 36.00 / 90.00 |
| ByteDance 4k upscale, preset aigc, 24 fps: 5 s / 6 s clip | 4.03 / 4.83 |
| Topaz 2160p upscale, 6 s clip (tested once, not used) | 6.00 |

Hero v2 total **89.64**: two style frames 8.00, plaque/sign edit 4.00, wire edit 4.00, Plan A single-take preview 18.75,
K2 v1 + K3 8.00, K2 v2 4.00, K2 v3 4.00, three clips 20.00, upscales 18.89 (4.83 + 4.03 + 4.03 + the 6.00 Topaz test).
With this playbook the avoidable spend was the Plan A preview, the Topaz test and K2 v1 (28.75), so a clean hero costs
about 61.

The sharpness pass is billed on fal in USD, not Higgsfield credits: Starlight Precise 2.6 at about USD 0.26/s at 4k (≈ 1.31
per 5 s clip, ≈ 1.57 per 6 s). The hero's three clips plus the clip 1 shootout came to ≈ USD 9.99 (rate-based; exact
figures in the fal dashboard).

Estimates for what is left, from those prices (one retake per asset is a prudent reserve). The rows use the ByteDance
upscale; on the Starlight path, take the 4.03-credit upscale out of each row and add ≈ USD 1.31 on fal per 5 s clip.

| Asset | Clean path | With one retake |
|---|---|---|
| One service clip (1:1, keyframe as an edit 4 + one 5 s clip 6.25 + upscale 4.03) | ≈ 14.25 | ≈ 24.5 |
| Three services (roofing, siding, windows; gutters kept) | ≈ 43 | ≈ 74 |
| Proof: "before" frame as an edit 4 + 5 s morph 6.25 + upscale 4.03 (the "after" is the hero frame) | ≈ 14.25 | ≈ 24.5 |
| Services + proof | ≈ 57 | ≈ 98 |

Balance **98.61** on the lite plan (2026-10-17). It covers the clean path with room for about four retakes, or every asset
with one retake; a brighter grade for the kept gutters clip is local and free. Preflight every paid generation with
`get_cost: true` and stop if a price differs from this table; log each job id, its cost and the balance in the ledger.

### Services v2, actual (2026-10-18)

| Item | Cost |
|---|---|
| Nano Banana Pro 4k stills, roofing ×2 (one failed and refunded), siding ×2, windows ×2 | 20.00 credits |
| NB Pro 4k edits: siding roof, windows trees + books, roofing focus (no effect) | 12.00 credits |
| Kling 3.0 Omni Frames 4k, 1:1, 5 s: roofing, windows (Higgsfield) | 60.00 credits |
| Kling v3 4K, 1:1, 5 s: siding (fal) | USD 2.10 |
| Starlight Precise 2.6 ×1.5, gutters, 5.04 s (fal; rate-based) | ≈ USD 1.31 |
| **Total** | **92.00 credits + ≈ USD 3.41** |

Higgsfield balance **6.61** on the lite plan after this pass: not enough for another 4k clip (30) or more than one 4k
still. The proof section's 4k morph should go to fal (USD 2.10 per 5 s); stills can stay on Higgsfield only after a top-up,
or move to fal's Nano Banana Pro.

## 8. Gates (the owner decides at each)

1. Style frames or keyframes: show the candidates with 100% crops of the product; wait for the pick and notes.
2. Clips: show the stitched preview at 2560 px with frame grabs every second and the speed tables; wait for approval.
3. Finishing: show the review copy (1280 px) and the 0/5/10 s screenshots; then commit and update `docs/STATUS.md`.

## 9. Environment reminders

Git needs `DEVELOPER_DIR=/Library/Developer/CommandLineTools`; `python3` and `brew` are blocked by the Xcode 27.1 licence,
so pixel work is Node + sharp; ffmpeg is `node_modules/ffmpeg-static/ffmpeg` (no ffprobe, no `timeout` on this Mac); inline
commands run in zsh, so brace every variable (`${var}`) and index arrays from 1; `src/app/globals.css` edits need
`rm -rf .next` and a dev-server restart; the Higgsfield tools come from the claude.ai connector (prefix `mcp__cd8cde6c-…`); the fal tools (Starlight) come from
the fal connector (upload with `prepare_upload`, then PUT the file).

## 10. Services v2 — what the service clips taught us (2026-10-18)

The full record (every id, ruling and number) is `docs/superpowers/plans/2026-10-18-services-ledger.md`; the state is in
`docs/STATUS.md` section 13. The proof is section 11.

**Stills (Nano Banana Pro 4k, 4 credits each).**
- Prompt adherence fails on details: siding B came out grey instead of navy, siding A's roof weathered brown instead of
  charcoal, windows A had an autumn tree and garbled lettering on the books, windows B a blown sun pane (0.59% clipped).
  Check at 100%: colour of every named material, the season of every tree, any lettering (books, labels, plates).
- An edit fixes content (green trees, plain books, a recoloured roof plane) but can miss: the roofing depth-of-field edit
  came back unchanged. Diff the edit against its source before paying for the next step.
- What an edit leaves behind is fixed locally for free: a masked Lab recolour of two leftover brown roof strips (target
  a neutral cool charcoal, lightness kept, no pixel moved), and three faint spine marks filled by vertical interpolation.
- Seven references (three hero keyframes + four client photos) keep the hero house recognisable in a close-up (stone
  tower, arch, brick, charcoal roof) without copying any reference composition.

**Clips (native 4K, first frame only).**
- Kling 4K adds what the still lacks: the roofing still was deep-focus and the clip rendered a soft background. It also
  eases into the move: the siding track accelerated 4.2× over 5 s, the windows dolly 4.3× over its first second.
- `scripts/svc-remap.mjs` evens the speed (the hero's speed-up-only remap, planned globally: target = a high percentile of
  the 480 px motion, rate up to 3.4–3.6×): pace spread 4.2× → 1.4× (siding) and 4.3× → 1.2× (windows). It shortens the
  clip (siding 121 → 88 frames).
- **A crossfade cannot hide a move that does not return.** The 0.5 s dissolve showed two images on every clip whose camera
  or subject travels: at 2160 px the frames blended 50/50 sat 70 px apart on roofing (two hands), 19 px median on siding
  (doubled windows), 147 px on windows. Only the locked-camera gutters clip (0 px) is truly seamless. For a seamless panel
  loop with no reversal: locked camera + subject motion, first frame = last frame (the gutters method), or an orbit
  chain (the hero method). Measure with `.superpowers/sdd/SERVICES_BRIEF/tools/seam-offset.mjs` before finishing.

**Finishing (`scripts/svc-finish.sh`).** Size to 2160 (lanczos) → optional remap → grade (`scripts/svc-grade.mjs`) → 0.5 s
crossfade, lossless (the grain-free measurement master `assets-raw/originals/svc-<name>.v2-clean.mp4`) → grain `alls=5` at
2160 → `assets-raw/svc-<name>.mp4` (CRF 12) → `npm run media` (2160² H.264 High CRF 18 +faststart, VP9 CRF 18, poster).
- Grade to the hero across different scenes with class anchors, never a whole-frame transfer: neutral highlights set the
  white balance, sky and foliage set the saturation, clamped. Skip the white-balance anchor indoors (`--no-wb`: warm-lit
  walls are not a white reference), and set a scene with no true sky, foliage or white by hand (`--anchors none`: the
  rain-soaked gutters' wet shingles read as sky). Report colour on the same pixels before and after (`--report`); a class
  re-selected after the shift moves the means by itself. A white-balance shift fitted on the whites alone moves the sky
  too: on siding the whites landed on the hero's (a*b* 4.5 → 0.4) while its sky went 2.1 → 6.8. Next time fit one shift
  to every shared class at once (least squares over whites, sky and foliage).
- Kept gutters: Starlight Precise 2.6 ×1.5 (1440 → 2160), colour-matched back to v1 (ΔE 0.76 → 0.03), then lift γ 1.5,
  S-curve 1.15 and a lightness-weighted warm shift (warm highlights, neutral shadows: a uniform warm shift turned the dark
  gutter olive). It is a rain scene with fallen leaves; the grade warms and brightens it, it cannot make it summer.

**Measuring (`scripts/svc-quality-check.mjs`).** Sharpness = Laplacian variance of 400 px crops against the hero's
grain-free shingle field (61.1 / 29.1 / 28.7 → 39.6); flicker = 1 − detail-coherence efficiency with the hero shimmer
method, against the hero loop the owner accepted (mean 0.284); straightness = Hough lines refined to sub-pixel with a
quadratic fit, limited to the subject (`include`), with a stronger blur for granular surfaces (`sigma: 3` on shingles).
Edge roughness of real materials (granules, embossed wood grain, mesh) reads ~1 px of "wobble"; treat it as texture, look
at any flagged line at 100%. All four clips came out 2–90× the hero's sharpness and 8–40× steadier.

**Playback.** The 2160² files decode in real time everywhere (26–31 Mb/s). Native-loop wraps measured 66–84 ms in real
Safari (limit 84 ms) at first, but every clip held above 84 ms in some engine, so all four went seamless (section 13).
A short clip must be calibrated early: since 2026-10-18 the loop loads the back element a quarter of the way through
the first pass and calibrates it halfway (`BACK_LOAD_SHARE`, `CALIBRATE_SHARE` in `SmartVideo.tsx`; the 2 s / 4 s caps
keep the hero and proof as they were). Before, the 3.1–3.7 s clips never reached the 4 s point and started their first
swap cold (83–100 ms in Safari). Check the first wrap after scroll-in with `node scripts/svc-wrap-check.mjs
--fresh-runs 3 --headed true` (it prints how each swap ran: `pre` = calibrated and started early). Check with `node scripts/svc-wrap-check.mjs`; a
programmatic jump to the last block can be undone by Lenis in Safari, so the scroll phase's wraps are counted too.

## 11. Proof v2 — the in-place transformation (2026-10-18)

Full record: `docs/superpowers/plans/2026-10-18-proof-ledger.md`; state: `docs/STATUS.md` section 14. Brief:
`PROOF_BRIEF.md`. All on fal, no Higgsfield.

**Endpoints and settings.**
- Stills and edits: `fal-ai/nano-banana-pro/edit`, `resolution: "4K"`, `aspect_ratio: "16:9"`, PNG → 5504×3072.
  USD 0.15 per image on the pricing API (`estimate_cost` takes `num_images`); fal's model page bills 4K at 2×, so budget
  ≈ 0.30. `num_images: 4` in one job is the cheap way to get candidates for a hard edit.
- Video: `fal-ai/kling-video/v3/4k/image-to-video`, `duration: "5"`, `generate_audio: false`, `start_image_url` only,
  the brief's negative prompt. 16:9 from a 5504×3072 still comes out **3856×2148**, 121 frames, 24 fps; USD 2.10 per 5 s
  (`estimate_cost` with `unit_quantity: {5, "seconds"}`). About 3–4 minutes per clip.
- Uploads: `upload_file` (`prepare_upload`) → `curl -X PUT -H "Content-Type: …" --upload-file` → `verify_upload`.
  Upload a quality-96 JPG of a PNG master (5–8 MB instead of 20–28 MB).

**Prompts that worked.**
- D0 (from the reference frame): the brief's prompt verbatim, then a cleanup edit: "Keep this exact photograph … Make
  only these changes: (1) the exposed dark underlayment … plain, uniform black roofing felt with a few loose granules,
  with no streaks, smears or marks; (2) the white aluminium gutter is clean and plain, with no markings, stickers or
  lettering …". Do not ask for "a clean gutter" in a damaged frame: one candidate emptied the debris the brief wanted.
- Clips: the brief's prompts verbatim ("A slow, steady, smooth drone push forward along the roof slope at constant
  speed …"). Kling 4K renders a slow drift forward and sideways with an ease-in (D 1.9 → 3.7 px/frame over 5 s).
- F0 (edit of D_last), the best of three: "Edit this photograph in place. It is a frame from a video and the result must
  line up with it exactly when the two images are overlaid. Keep the same camera position, angle, lens, perspective and
  framing: the roof plane fills the whole frame, its shingle courses run almost horizontally … There is no gutter, no
  wall and no roof edge in this view; do not add any. Re-shingle the roof in place: every course stays on exactly the
  same line …".

**What the frame-control method needs (the F0 lesson).**
- An edit holds geometry only where the frame has structure to hold: edges, a gutter, a horizon. Clip D drifted until
  its last frame was nothing but shingle courses; asked to replace the whole roof, Nano Banana re-lays the courses at its
  own spacing (best of 8 candidates: median 6 px off, correlation 0.38 against 0.94 for two real neighbouring frames).
- Describe the frame being edited, never the frame you wish it were: the brief's F0 prompt named a gutter, a horizon
  and a deep blue sky that D_last does not show, and attempts 1–2 recomposed the frame to show them (41–44 px shifts,
  an invented gutter).
- Next time: plan the move so the last frame of Clip D still holds structure (prompt the drift to end with the gutter
  or rake edge in frame, or pick an end frame), or make F0 a repair edit of a frame with anchors.
- Measure it: `node scripts/proof-seam-check.mjs <D_last> <F0 | F.mp4@0> <out>` (structural-edge shift, plus a
  course-line comb correlation per vertical strip). A fitted warp to pull the courses into line did not work (the cells
  lock onto neighbouring courses); do not move pixels to fake a seam.

**Finishing (`bash scripts/proof-finish.sh <clip-D> <clip-F>`).**
- Speed: measure camera displacement, not YDIF (`node scripts/proof-motion.mjs <clip>`): raking golden light gives
  the same texture 30% more YDIF than overcast light. `scripts/proof-remap.mjs --target 3.4` (speed-up only, smooth 5)
  matches the two clips' pace at the seam (24% → 7.5% apart) and evens each (D 2.35× → 1.24×), at the cost of length
  (10.1 → 8.8 s) and a softer-frame pulse on the heavily remapped clip (±0.8% → ±14.9%, bar ±27%).
- **In-place dissolve, not xfade** (`scripts/proof-seam-blend.mjs`): an xfade overlaps two moments of a moving camera
  and doubles every line. Put both clips on one camera timeline (D_last and F0 share a frame) and extend each layer past
  its end by carrying its seam frame along the other clip's measured affine motion; a smoothstep weight over 17 frames
  (0.71 s) centred on the seam. The luma glides through it.
- Grade: `scripts/svc-grade.mjs --anchors none` with fixed Lab shifts. D (moody, clear): `--da -3 --db -1.5 --lift 1.12
  --scurve 1.08`. F: `--da -2.2 --db 1.2 --scurve 1.06` removes Kling's mauve cast (shingle a* +5 → +2.3) so new shingles
  read charcoal in golden light (target: the approved services roofing close-up, a* 4.4 b* 4.1).
- Fades to and from `--ink`: 0.5 s out (the brief) and 0.25 s in (otherwise the wrap cuts from near-black to full
  exposure). The poster is then frame 6, not frame 0 (`PROOF_POSTER_FRAME` in `scripts/process-media.sh`).
- Slider stills: the graded seam frames themselves (D's last, F's first), so the slider and the video agree.
- Delivery: 2560×1440 H.264 High CRF 18 (24 Mb/s, fine in Safari) + VP9 CRF 24 (SSIM 0.978–0.987 to the master).
- Playback: the native wrap of this 2560 clip held 85–86 ms in real Safari and WebKit; `seamless: true` brings it to
  49–53 ms everywhere. Measure with `node scripts/hero-wrap-check.mjs --section "#proof" --headed true`.
- The label: `node scripts/proof-verify.mjs` checks it against the video clock through 3 loops.

**Cost (actual).** Kling 4K 2 × USD 2.10 + Nano Banana Pro 4K 12 images (D0 2 + 2, F0 2 + 2 + 4) ≈ USD 3.60 at the 4K
rate → **≈ USD 7.80** (6.00 at the flat API rate). A clean run (D0 cleanup in one pass, F0 right first time) would cost
about USD 5.40.
