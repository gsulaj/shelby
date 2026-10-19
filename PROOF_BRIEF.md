# PROOF_BRIEF.md: Storm-damage proof section (v2), one pass, fal only

Supersedes MEDIA_BRIEF.md and SECTIONS_BRIEF.md for the proof assets. Read `CLAUDE.md`, `docs/STATUS.md`, `docs/MEDIA_PLAYBOOK.md`, and `docs/HERO_RESUME.md` first. Work on the `media` branch. Don't touch the hero or the services.

**Run end to end in one pass, with no approval gates.** Quality control is your job: self-review against the bars below and regenerate until every asset passes (max 3 attempts per asset; if one still fails, keep the best attempt, record why, and continue). Spending is approved; log every charge.

**Use fal only. Do not use Higgsfield for any step.**

---

## 1. The concept

One continuous drone-style push along a roof. The camera never stops. Mid-move, the storm-damaged roof **transforms in place** into a brand-new charcoal roof as the light warms to golden summer sun. It must read as **the same roof, the same camera move**, before and after.

How it's built (the same frame-control method that made the hero work):
1. **D0**: the damaged start still, at 4K.
2. **Clip D**: a ~5s push starting on D0 (damaged roof).
3. **D_last**: the actual last frame of Clip D.
4. **F0**: an **edit of D_last**: the same roof, same framing, brand-new shingles, golden light. Editing guarantees identical geometry.
5. **Clip F**: a ~5s push starting on F0, continuing the identical camera move.
6. Stitch D → F with a short in-place dissolve at the shared frame, then loop.

## 2. Reference
- `assets-raw/proof/damaged_roof.mp4` and `assets-raw/proof/fixed_roof.mp4` (Gemini, 720p) are **references only, for angle and view**. They are not used in the final video. Back them up untouched.
- Use the damaged clip's camera angle and composition: a low, close view along the roof slope from near the eave, with the gutter line at lower right and trees and sky at the upper right.

## 3. Tools (fal; copy endpoint IDs exactly)
- **Stills/edits:** `fal-ai/nano-banana-pro/edit`, `resolution: "4K"`, `aspect_ratio: "16:9"`, PNG output.
- **Video:** `fal-ai/kling-video/v3/4k/image-to-video` (native 4K), `generate_audio: false`, `duration: "5"`. Use `start_image_url`, plus `end_image_url` only where stated.
- **Negative prompt for all video:** `blur, distortion, warping, morphing geometry, flicker, shimmering texture, melting shingles, camera shake, low quality, text, logos, watermark, people`
- Upload local images with fal's upload tool and verify the upload before each job. Run `estimate_cost` before every job.
- If the 4K endpoint fails, fall back to `fal-ai/kling-video/v3/pro/image-to-video`, then Topaz Starlight Precise 2.6 + color-match to source (the playbook method).

## 4. Quality bar (non-negotiable; the same as hero and services)

**Image quality**
- Tack-sharp at 100% zoom: individual shingle tabs, granule texture, torn shingle edges, nail heads, gutter edges, leaves. Nothing waxy, smeared, painted, or plastic.
- Photorealistic high-end real estate / insurance-documentation cinematography on a cinema camera. Nothing that reads as CGI or "AI".
- Correct construction: shingle courses straight and properly overlapped, the roof plane flat, the gutter straight and attached. No bent, melted, or wobbly geometry.
- No artifacts: no garbled text or brand marks, duplicated objects, floating debris, or impossible shadows. No people, faces, signs, power lines, or flags.

**Damaged state (believable, not apocalyptic):** storm and hail/wind damage typical of a Michigan storm insurance claim: missing tabs, torn and lifted shingles, exposed dark underlayment patches, granule loss, a few loose shingle pieces and debris in the gutter. Light is after-storm: soft, slightly cool, overcast or clearing sky. It must still be clearly visible and well exposed, not muddy or dark.

**Fixed state:** brand-new **charcoal** architectural shingles matching the hero and services roofs: crisp uniform rows, ridge/edges seated flat, zero wear or granule loss. A clean gutter. Warm golden late-afternoon summer sun (~5pm), blue sky, lush green trees, color-matched to the hero master.

**Motion:** one slow, steady forward push along the roof at constant speed, stabilized, with no shake, flicker, boiling texture, or reversal.

**Measured (report the numbers):**
- Sharpness: Laplacian variance on 100% shingle crops at 3 timestamps per clip ≥ the hero's shingle baseline.
- Stability: the high-frequency flicker ratio ≤ the hero's accepted level.
- Seam match: at the D → F dissolve, edge maps of D_last vs F0 must align (roof lines, gutter, horizon) within a few pixels.

---

## 5. Steps

### Step 1: D0 (damaged start still)
- Extract the first frame of `damaged_roof.mp4` → `assets-raw/proof/ref-damaged-first.png`.
- `nano-banana-pro/edit` with that frame as the input image, 4K, 16:9. Prompt:
> Recreate this exact scene and camera angle as an ultra-sharp, photorealistic 4K photograph: a close, low view along a residential asphalt shingle roof slope near the eave, gutter along the lower right, trees and sky at upper right. The roof has realistic storm and hail/wind damage from a Michigan storm: torn and lifted charcoal architectural shingles, several missing tabs exposing dark underlayment, granule loss, a few loose shingle pieces and debris in the gutter. Soft, slightly cool after-storm daylight under a clearing overcast sky, well exposed so every detail is clear. Tack-sharp granule texture and torn edges, insurance-documentation realism, shot on a cinema camera. No text, no logos, no people.
- Self-review against Section 4. Save the passing image as `assets-raw/proof/D0.png`.

### Step 2: Clip D
- Kling 4K, `start_image_url` = D0, 5s, no audio. Prompt:
> A slow, steady, smooth drone push forward along the roof slope at constant speed, low over the damaged shingles, revealing the torn and missing shingles in sharp detail. Stabilized camera, no shake. The roof geometry stays perfectly stable and consistent. Soft after-storm light.
- Self-review (motion, stability, sharpness). Save as `assets-raw/proof/clip-D.mp4`.
- Extract its **last frame** at full resolution → `assets-raw/proof/D_last.png`.

### Step 3: F0 (fixed, an edit of D_last)
- `nano-banana-pro/edit` with D_last as input, 4K, 16:9. Prompt:
> Keep the exact same camera angle, framing, roof shape, roof edges, gutter position, trees, and horizon. Change only: the roof is now a brand-new, perfectly installed charcoal architectural asphalt shingle roof with crisp uniform rows, no damage, no wear, no granule loss; the gutter is clean; the light is warm golden late-afternoon summer sun with a deep blue sky and soft white clouds, lush green trees. Ultra-sharp, photorealistic, tack-sharp granule texture. No text, no logos, no people.
- Verify the seam match (edge-map alignment vs D_last). If it drifts, re-run the edit; don't regenerate from scratch. Save as `assets-raw/proof/F0.png`.

### Step 4: Clip F
- Kling 4K, `start_image_url` = F0, 5s, no audio. Prompt:
> Continue the same slow, steady drone push forward along the roof slope at the same constant speed, low over the brand-new charcoal shingles, warm golden sunlight raking across the crisp shingle texture. Stabilized, no shake. The roof geometry stays perfectly stable.
- Self-review. Save as `assets-raw/proof/clip-F.mp4`.
- Speed check: compare motion-per-frame at the end of D vs the start of F. If they differ by more than ~15%, time-remap to match (the playbook method).

### Step 5: Stitch, finish, encode
- **Sequence:** Clip D → 0.6–0.8s dissolve centered on the D_last/F0 seam (the roof transforms in place while the camera keeps moving) → Clip F → 0.5s fade to near-black → loop. Target ~10–11s, one file looping natively. Check for a brightness pop at the seam and at the wrap.
- **Grade:** Clip D moody but clear (well exposed). Clip F matched to the hero master's warm summer grade, with shingles reading charcoal. Light grain **after** everything, at the hero calibration; measure on the grain-free version.
- **Deliver:** keep a 4K master at `assets-raw/proof/proof-master-4k.mp4`. Serve `public/media/proof-morph.mp4` (keep the existing media.ts key) at 2560×1440, H.264 High, CRF 18, `+faststart`, no audio, MP4 first + VP9 WebM + first-frame poster. Back up the old proof files as `.v1`.
- **Slider stills (matched pair):** `proof-before.jpg` = D_last, `proof-after.jpg` = F0, as 3840 JPG + WebP.
- Measure the loop wrap with the hero wrap-check script; if any wrap holds a frame >84ms, enable `SmartVideo seamless` for this clip.

### Step 6: BEFORE/AFTER labels (the only component change allowed)
- A small label in the proof media frame's top-left: "BEFORE" during Clip D, "AFTER" during Clip F, switching at the dissolve midpoint, driven by the video's `currentTime`.
- Style: the design-system eyebrow (Barlow Condensed uppercase, tracked, 1px accent rule) on a subtle `--ink` scrim; cross-fade the label over 0.3s.
- Keep the existing clip-path reveal and copy. Proof stays `mode: "video"`. Confirm slider mode works with the new stills.

### Step 7: Verify
- Clean restart (stop the dev server, delete `.next`, `npm run dev`).
- 24fps with 0 dropped frames in real Safari and real Chrome. The label switches correctly through 3 loops.
- Console clean. tsc, lint, unit tests, and `test:loop` pass; the hero still passes its wrap check; services are untouched.
- Screenshots at 1440 and 390 during BEFORE and AFTER → `docs/screenshots/proof-v2/`.
- A quality sheet → `docs/screenshots/proof-v2/quality-sheet.jpg`: D0, D_last, F0, a 100% shingle crop of each clip next to the hero's shingle crop, the seam edge-overlay, and the sharpness/flicker numbers.

### Step 8: Wrap-up
- Update `STATUS.md` and `MEDIA_PLAYBOOK.md` (prompts, endpoints, settings, costs, what worked).
- Back up everything to `~/Desktop/shelby-hero-backup/proof-v2/`.
- Commit on `media`. **Do not merge to main.**
- Send me: the quality sheet, a 1280px review copy, the screenshots, and a summary with the measured numbers, anything that hit the 3-attempt limit and why, and total fal spend in USD.
