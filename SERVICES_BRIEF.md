# SERVICES_BRIEF.md: Services section media (v2), one pass

Supersedes MEDIA_BRIEF.md and SECTIONS_BRIEF.md for the four service clips. **Proof is NOT part of this task.** Read `CLAUDE.md`, `docs/STATUS.md`, `docs/MEDIA_PLAYBOOK.md`, and `docs/HERO_RESUME.md` first. Work on the `media` branch. Don't touch anything hero-related.

**Run this end to end in one pass. There are no approval gates.** Quality control is your job: self-review against the bars below and regenerate until every asset passes. Stop only if both Higgsfield and fal are unable to continue.

---

## 1. The quality bar (non-negotiable, applies to every frame)

These clips sit on the same page as the hero and must look like the same production. A visitor scrolling from the hero into this section must not notice a drop in quality.

**Image quality**
- Tack-sharp at 100% zoom on the subject: individual shingle tabs and granule texture, siding board edges and shadow lines, window frame corners, glass reflections, leaf detail. No waxy, smeared, painted, or plastic-looking surfaces.
- Photorealistic, like high-end real estate cinematography on a cinema camera. Nothing that reads as CGI or "AI".
- Clean straight lines: rooflines, siding courses, window mullions, and trim are straight and parallel where they should be. No bent, melted, or wobbly geometry.
- Correct physical construction: shingle courses overlap properly, the ridge cap is seated flat, siding laps correctly, the window sits square in its opening. Every roof in frame is attached and continuous.
- No AI artifacts: no extra or fused fingers on the glove, no garbled text or brand marks, no duplicated objects, no impossible reflections, no floating parts.
- No text, logos, readable brand names, faces, cars, power lines, utility poles, signs, or flags.

**Light and grade (must match the hero)**
- Late-afternoon Michigan summer, ~5pm: warm golden light, deep blue sky, soft white clouds, lush green lawns and trees.
- Vivid but natural high-end real estate grade. No crushed shadows, no blown highlights (especially white trim and sky), no orange cast.
- Every shingle is brand new: charcoal, crisp uniform rows, no wear, granule loss, or lifted edges.
- Color-match every final clip to the hero's grade (sample the hero master) so all five videos on the page read as one afternoon.

**Motion quality**
- One simple camera move per clip, constant speed, stabilized, with no shake, jitter, or speed bumps.
- No warping, morphing, flicker, or texture boiling. Shingles, siding, and brick stay rock-steady frame to frame.
- No reversal and no ping-pong.

**Measurable checks (run them, report the numbers)**
- Sharpness: Laplacian variance on 100% crops of each clip's subject texture at 3 timestamps must be ≥ the hero's on a comparable texture region (the shingle field). Compute the hero baseline first.
- Temporal stability: the high-frequency frame-to-frame flicker ratio must be ≤ the hero's accepted level (same method as the hero shimmer check in the playbook).
- Geometry: the edge-straightness check on the main lines (roof courses, siding courses, window frame) must pass with no visible bowing.

Any asset failing any bar gets regenerated. Up to 3 attempts per asset; if it still fails, take the best attempt, record exactly what fails, and continue.

---

## 2. Tools and settings: highest quality available

**Primary: Higgsfield**
- Stills: **Nano Banana Pro at 4k** (its highest setting). Use edits rather than regenerations to fix details without losing geometry.
- Video: **Kling 3.0 Omni Frames in 4k mode** (native 4K, not pro), silent, 1:1, 5s. For brand-new clips, native 4K beats pro + upscale. Confirm the 4k mode's actual output resolution with ffprobe on the first clip.
- Re-run the cost preflight before each paid call. Spending is approved; don't stop for cost, but log every charge.

**Fallback: fal (only when Higgsfield credits run out)**
- Find the equivalents with `search_models` / `recommend_model`: Nano Banana Pro (or the best photoreal image model) at its highest resolution, and Kling 3.0 image-to-video at its highest quality tier. Copy endpoint IDs exactly from the search results.
- If the fal video tier is below 2160px, upscale with **Topaz Starlight Precise 2.6**, then color-match back to the raw clip (the hero method in the playbook).
- Use `estimate_cost` before each job and log the spend.
- If both providers are exhausted, stop and tell me exactly what's needed.

---

## 3. The assets

All service clips are 1:1. The sticky panel crops them to roughly 4:5 with `object-fit: cover`, so **keep the subject centered** with breathing room on the left and right edges.

### B. `svc-roofing.mp4`: roofing, on the hero house
- **Reference images:** the approved hero keyframes (start frame, K2, K3) and `assets-raw/reference/` photos, so it's recognizably the same house: the same charcoal shingles and the stone tower.
- **Still prompt:**
> Low-angle close-up on the roof of a newly built brick-and-stone luxury home: a roofer's gloved hand holding a pneumatic roofing nailer, setting a brand-new charcoal architectural asphalt shingle into a perfectly straight course. Crisp granule texture and clean shingle edges in the foreground, the stone tower gable softly out of focus behind, deep blue summer sky with soft white clouds, warm golden late-afternoon sunlight raking across the shingles from the upper left with a subtle natural lens flare. Shallow depth of field, subject centered. Photorealistic high-end real estate cinematography, shot on a cinema camera, tack sharp, ultra-detailed. No text, no logos, no faces.
- **Motion prompt (first frame only):**
> Slow, steady push-in. The nailer fires once and the gloved hand slides smoothly to the next shingle. Calm, precise, stabilized camera, constant speed. The sunlight and flare drift very slightly. The shingles and roof stay perfectly stable.

### C. `svc-siding.mp4`: siding, a different new-build home
- **Still prompt:**
> Three-quarter view along the side wall of a newly built modern-farmhouse-style home in a new Macomb County subdivision: deep navy insulated vinyl lap siding with crisp, perfectly straight horizontal courses and sharp shadow lines between each board, bright white trim and corner boards, black-framed windows, the edge of a brand-new charcoal architectural shingle roof at the top of frame, manicured green lawn and fresh landscaping with flowering shrubs at the base. Warm golden late-afternoon summer sunlight raking along the wall, deep blue sky with soft white clouds. The siding lines recede toward the background. Centered composition. Photorealistic high-end real estate cinematography, tack sharp, ultra-detailed. No text, no logos, no people.
- **Motion prompt (first frame only):**
> Smooth lateral tracking shot gliding along the siding wall at a constant speed, revealing clean straight siding lines and crisp shadow detail. Stabilized gimbal, no shake. The house geometry stays perfectly stable.

### D. `svc-windows.mp4`: windows, interior looking out
- **Still prompt:**
> Interior of a bright, modern, high-end living room looking out through a large new black-framed picture window onto a sunny backyard with a lush green lawn and mature full-leaf trees. Warm golden late-afternoon summer sunlight streams through the glass across a light oak floor, with soft leaf shadows. Clean, uncluttered, minimal decor, light neutral walls. The window is the hero of the frame and centered; its black frame and mullions are crisp, square, and perfectly straight. Photorealistic luxury real estate interior photography, tack sharp, ultra-detailed. No people, no text, no logos, no TV screens.
- **Motion prompt (first frame only):**
> Slow, steady dolly-in toward the window. Sunlight and soft leaf shadows shift gently across the floor; the trees outside sway slightly. Stabilized camera, constant speed. The window frame stays perfectly straight and stable.

### E. `svc-gutters.mp4`: KEEP the existing clip (the client likes it)
- Don't regenerate it. Back up the original as `svc-gutters.v1.mp4`.
- If it's below delivery resolution, upscale it with Starlight Precise 2.6, then color-match back to its source.
- Regrade it to the new set's warm-summer look (use the hero master as the color reference). Run the same sharpness and stability checks; it must not visibly lag the other three.

---

## 4. Finishing pipeline (after every clip passes review)

1. **Loop:** services use a 0.5s crossfade of the end into the start, so each file loops seamlessly. Never ping-pong. Verify there's no visible seam at the loop point.
2. **Grade:** color-match to the hero master. Add light grain **after** any upscale, at the hero's calibration. Measure sharpness, flicker, and color on the grain-free version.
3. **Delivery encode:** 2160×2160 (or native 4K output if smaller, never upscaled past the source without Starlight), H.264 High profile, CRF 18, `+faststart`, no audio, MP4 first in source order, plus VP9 WebM and a first-frame poster JPG. Size isn't a constraint (local demo).
4. **Playback:** confirm 24fps with 0 dropped frames in real Safari and real Chrome while scrolling the sticky section. If Safari drops frames at 2160, re-encode at 1800×1800 and re-test. Smooth beats big.
5. **Wrap check:** measure each clip's loop wrap with `scripts/hero-wrap-check.mjs` (adapted). If any wrap holds a frame >84ms, use `SmartVideo seamless` (the double-buffer) for that clip.
6. Keep raw originals in `assets-raw/` and back up any file before overwriting it.

---

## 5. Integration and verification
- Integrate via `src/content/media.ts` only. No component or layout changes, beyond enabling `seamless` per clip if the wrap check requires it.
- Clean restart (stop the dev server, delete `.next`, `npm run dev`).
- The sticky services section crossfades to the correct clip at all 4 positions, scrolling down and back up.
- Mobile (390): each block's own video plays and pauses correctly.
- Console clean; tsc, lint, unit tests, and `test:loop` pass. The hero is untouched and still passes its wrap check.
- Screenshots at 1440 and 390 of each of the 4 service positions → `docs/screenshots/services-v2/`.
- A contact sheet → `docs/screenshots/services-v2/quality-sheet.jpg`: for each clip, the first frame plus a 100% subject crop, next to the hero's shingle crop for comparison, with the sharpness and flicker numbers.

## 6. Wrap-up
- Update `STATUS.md` and `MEDIA_PLAYBOOK.md` (what worked, prompts, settings, costs).
- Back up the finals and raws to `~/Desktop/shelby-hero-backup/services-v2/`.
- Commit on `media`. **Do not merge to main**; I'll approve the merge separately.
- Send me: the quality sheet, a 1280px review copy of each clip, the screenshots, and a summary with the measured numbers, any asset that hit the 3-attempt limit and why, and the total spend split by Higgsfield credits and fal USD.
