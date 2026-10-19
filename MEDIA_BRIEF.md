# MEDIA_BRIEF.md: Higgsfield media generation and integration

Read `CLAUDE.md`, `BUILD_SPEC.md` (section 1, media manifest), and `docs/STATUS.md` first. This brief defines the 8 media assets, how to generate them through the Higgsfield MCP, and how to integrate them **without breaking the build**.

---

## 0. Ground rules
- **Work on a branch:** `git checkout -b media`. Merge to `main` only after every verification check in section 5 passes. If anything breaks, `main` stays clean.
- **Don't edit components or layout.** The placeholders are already wired to `src/content/media.ts`. Integration means files in the right paths, running the media script, and flipping readiness flags. Nothing else.
- **Discover, don't assume.** Before generating anything, list the Higgsfield MCP tools and available models. Don't assume model names, durations, or aspect ratios; read what the server actually supports and map this brief onto it.
- **Credits:** before generating, report which model you'll use for stills and for video, the estimated credit cost per asset and in total, and the balance if the MCP exposes it. Wait for my OK.
- **Review gates:** two approval stops (section 3). Don't animate anything until I approve the stills.
- **Keep the raw originals.** Save every generated file to `/assets-raw/` with the exact filenames below. Never overwrite a raw file without keeping the previous version as `<name>.v1.<ext>`.
- No text, logos, or watermarks in any frame. If a generation contains garbled text or brand marks, regenerate it.

---

## 1. Asset list (exact filenames, the contract with `media.ts`)

| # | Raw filename | Type | Aspect | Duration | Section |
|---|---|---|---|---|---|
| A | `hero-flyover.mp4` | video | 16:9 | longest supported up to 10s | Hero background |
| B | `svc-roofing.mp4` | video | 1:1 | 5s | Services panel 01 |
| C | `svc-siding.mp4` | video | 1:1 | 5s | Services panel 02 |
| D | `svc-windows.mp4` | video | 1:1 | 5s | Services panel 03 |
| E | `svc-gutters.mp4` | video | 1:1 | 5s | Services panel 04 |
| F | `proof-before.jpg` | still | 16:9 | — | Proof (slider + morph start) |
| G | `proof-after.jpg` | still | 16:9 | — | Proof (slider + morph end) |
| H | `proof-morph.mp4` | video | 16:9 | 5s | Proof (video mode) |

- If the video model doesn't support 1:1, use the closest supported aspect and keep the subject dead center. The sticky panel crops with `object-fit: cover` to roughly 8:9.
- Each video is generated image-to-video from an approved still. Save the source stills as `/assets-raw/stills/<same-name>.jpg` (e.g. `stills/hero-flyover.jpg`). These are working files, not site assets.
- Generate at the highest resolution the model allows. No audio (strip it in processing if the model adds any).

---

## 2. Prompts

### Global style suffix (append to every still prompt, verbatim)
> photorealistic, shot on cinema camera, overcast soft daylight with a cool steel-blue grade, muted desaturated palette, deep shadows, premium architectural photography, Southeast Michigan suburban setting, no text, no logos, no watermarks

### A. Hero flyover
- **Still:** Aerial three-quarter view of a two-story brick-and-vinyl colonial home in a mature tree-lined Michigan suburb, freshly installed charcoal architectural asphalt shingle roof with crisp ridge lines, clean white trim, seamless gutters, late autumn trees + suffix
- **Motion:** Slow, smooth cinematic drone push-in and gentle orbit around the home, steady and stabilized, no camera shake, subtle tree movement, seamless loop
- Composition note: keep the house in the **right half** of the frame. The hero headline sits on the left.

### B. Roofing
- **Still:** Close-up of a roofer's gloved hand and nail gun securing a charcoal architectural shingle on a roof deck, texture visible, shallow depth of field, subject centered + suffix
- **Motion:** Slow push-in as the nail gun fires and the hand moves to the next shingle, precise and deliberate, macro detail

### C. Siding
- **Still:** Low-angle detail of newly installed slate-gray insulated vinyl siding with crisp horizontal lines and white corner trim, centered composition + suffix
- **Motion:** Smooth lateral tracking shot gliding along the siding wall, revealing clean lines, steady gimbal movement

### D. Windows
- **Still:** Exterior of a new black-framed double-hung replacement window set into a fresh siding wall, sky and trees reflecting in the glass, centered + suffix
- **Motion:** Slow dolly-in toward the window, reflections drifting gently across the glass

### E. Gutters
- **Still:** Close-up of a seamless dark-bronze aluminum gutter along a roof edge with a gutter guard, light rain falling, centered + suffix
- **Motion:** Rainwater flowing smoothly through the gutter toward the downspout, slow and calm, gentle camera drift

### F. Proof: before
- **Still:** The same colonial home as asset A, seen at eye level from the street. The roof is visibly storm-damaged: missing and curled shingles, granule loss, a tarp on one section, debris in the gutters, gray stormy sky + suffix
- If the MCP supports reference or edit images, use the approved hero still as the reference so it's recognizably the same house.

### G. Proof: after
- **Generate this as an edit of the approved `proof-before.jpg`, not as a fresh prompt.** Same framing, camera angle, house, and trees. Change only: the roof becomes a pristine charcoal architectural shingle installation, the gutters are clean, the sky is clearing.
- If edit mode isn't available, stop and tell me before proceeding. Mismatched framing ruins both the morph and the slider.

### H. Proof morph
- Image-to-video with **start frame = `proof-before.jpg`** and **end frame = `proof-after.jpg`** (use the model's first-frame/last-frame mode).
- **Motion:** Smooth continuous transformation as damaged shingles are replaced by a new roof and the sky clears, static locked-off camera.
- If no start/end-frame mode exists, report the closest option and wait.

---

## 3. Generation order and approval gates

1. **Discovery and cost report.** Tools, models, the capabilities used, the credit estimate. → Wait for my OK.
2. **Stills round.** Generate stills for A–F (one candidate each, two for A since it's the most important asset). Then G as an edit of the approved F. Save them to `/assets-raw/stills/`, open them, and self-review each one against its prompt: composition, no text or logos, a consistent grade across the set, no AI artifacts (warped lines, melted shingles, extra fingers on the roofer's glove).
   → **GATE 1:** show me all the stills. Wait for approval or regeneration notes.
3. **Video round.** Animate the approved stills into A–E and H. Save to `/assets-raw/` with the exact filenames. Self-review each clip: smooth motion, no warping or flicker, no morphing geometry (except H), and loops cleanly or can be made to.
   - If a clip doesn't loop seamlessly, fix it in processing with a short ffmpeg crossfade of the end into the start (about 0.5s). Never ping-pong (reverse playback looks wrong for camera moves).
   → **GATE 2:** report every clip with duration, resolution, and any issues. Wait for approval.

---

## 4. Integration (only after Gate 2)
1. Run `npm run media`.
2. Confirm every output is under budget: hero ≤ 6MB MP4, each service clip ≤ 2.5MB, morph ≤ 3MB. Each video must have an MP4, a WebM, and a poster JPG. Stills need a JPG and a WebP. If one is over budget, raise the CRF and re-run that file only.
3. Update `src/content/media.ts` readiness flags so the placeholders are replaced. Keep the proof section in `mode: "video"`.
4. Restart cleanly (this project's Turbopack quirk): stop the dev server, delete `.next`, then `npm run dev`.

---

## 5. Verification (all must pass before merging `media` → `main`)
- Type check, lint, and the full test suite pass (59+ tests).
- Browser console is clean at 1440 and 390: no 404s on media and no hydration warnings.
- Playwright screenshots at 1440 and 390 of:
  - the hero at load, confirming the headline stays readable over the video (overlay contrast)
  - the sticky services section at all four positions, scrolled down and back up, with the correct clip active each time
  - the proof section mid-reveal and fully revealed
- Network check: only the hero video loads on initial page load, and the rest load lazily.
- Reduced motion: videos show their posters only.
- Save the screenshots to `docs/screenshots/media/`, update `docs/STATUS.md`, commit on `media`, merge to `main`, and send me the screenshots with a short summary.
