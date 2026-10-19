# HERO_BRIEF.md: Hero video revamp (v2)

This **supersedes MEDIA_BRIEF.md for asset A (hero) only.** All other assets are on hold until the hero is approved. Read `CLAUDE.md` and `docs/STATUS.md` first. Stay on the `media` branch.

## Why v1 failed
The v1 grade (overcast, cool, desaturated, deep shadows) was the wrong creative direction. The site sells **vision**: what the homeowner's house will look like. The footage must be bright, warm, aspirational summer. The dark UI frames it; the footage itself is not dark.

## Tool restrictions (unchanged)
Only use: models_explore, balance, generate_image, generate_video, upscale_image, upscale_video, reframe, outpaint_image, media_upload, media_confirm, jobs_wait, show_result, job_display. Never use website, deploy, publish, TikTok, ads, or influencer tools. Re-run the cost check before every paid call and stop if any price differs from what you reported.

---

## Step 0: Credits and reference
1. Run `balance` and report it.
2. If `assets-raw/reference/` contains an image, it's a real house the client likes. Use it as the reference image for the style frame, so the generated house is a new-construction home in that style (same architectural language, not a copy).

## Step 1: Style frame (Gate 1)
- **Model:** Nano Banana Pro, **4k**, 16:9. Generate **2 candidates.** Save them as `assets-raw/stills/hero-frame.v2a.jpg` and `.v2b.jpg`.
- **Prompt:**
> Aerial three-quarter drone view of a newly built two-story modern farmhouse–style luxury home in a new-construction subdivision in Macomb County, Michigan. White board-and-batten siding with dark charcoal accents and natural stone veneer, large black-framed windows, steep intersecting gabled rooflines with a brand-new charcoal architectural asphalt shingle roof with crisp clean ridge lines, covered front porch with warm wood ceiling, three-car garage with modern black garage doors, wide driveway, manicured bright green lawn, fresh landscaping with flowering shrubs, late afternoon summer sun around 5pm with warm golden light and soft long shadows, deep blue sky with a few soft white clouds, vivid but natural high-end real estate photography color grade, ultra-detailed, tack sharp, photorealistic, no text, no logos, no watermarks, no people, no cars in driveway
- **Composition:** the house sits in the **right half** of the frame, with open sky and lawn on the left where the headline goes. The whole roof must be clearly visible and well lit; it's the product.
- **Self-review:** sharpness at 100% zoom, clean straight roof and window lines, no melted shingles or warped geometry, nothing garbled.
- **GATE 1:** show me both candidates. Wait for my pick and any notes.

## Step 2: Motion test in pro mode (Gate 2)

### Plan A (try first): single continuous take, perfect loop
- **Model:** Kling 3.0 Omni Frames, **pro**, silent, 16:9, **15s**.
- **First frame AND last frame:** the approved style frame, the same image for both.
- **Motion prompt:**
> One single continuous uninterrupted drone shot, a single take with no cuts. The drone begins in this exact position, glides smoothly forward toward the house while descending, skims low over the new roof so the shingle texture catches the warm sunlight, then rises and orbits smoothly around the house revealing the entire roofline from every side, and completes the circle to arrive back at exactly the starting position and framing. Constant smooth speed throughout with no slowing at the end, stabilized gimbal, no camera shake. The house's architecture, roof shape, and lighting stay perfectly consistent the whole time.
- **Evaluate:** does the house keep the same shape from every angle? Is the motion one smooth direction with no visible reversal or rewind? Is the speed constant? Check frame grabs every 1s.

### Plan B (only if Plan A warps the house or reverses visibly)
- Generate 2 more keyframes as Nano Banana Pro **edits of the approved frame** (same house, light, and grade): K2 is low over the roof with the shingles in close detail; K3 is the side or rear orbit view showing the full roofline.
- Chain 3 pro clips: frame → K2, K2 → K3, K3 → frame, each with an explicit "constant speed, no easing, continuous movement" prompt.
- Join them with a 6–8 frame blend at each seam so it reads as one uninterrupted camera move with **no visible cuts**. The total loop is about 15–18s.
- Report the credits before generating Plan B.

### GATE 2
Show me the preview video (Plan A, or the stitched Plan B) plus frame grabs. Wait for approval before the final render.

## Step 3: Final render at maximum quality
- Re-render the approved motion in **Kling 4k mode** with the identical frames, prompt, and settings. Report the credit cost and wait for my OK first.
- If 4k mode isn't available for the approved plan, render in pro and use `upscale_video` to the highest available resolution.
- Save as `assets-raw/hero-flyover.mp4`. Keep the v1 file as `hero-flyover.v1.mp4`.

## Step 4: Processing (hero-specific; overrides the 6MB budget)
This is a local demo, so quality beats file size for the hero:
- H.264 at **2560px wide**, CRF 18–20, `+faststart`, no audio. VP9 WebM at matching quality. Target ≤ 15MB each, and quality wins if they conflict.
- Poster: the first frame, from the 4k still, downscaled to 2560px.
- **Quality check:** extract frames at 2s, 7s, and 12s from both the raw and the processed file and compare them side by side. If the processed frames show visible compression softness, lower the CRF.
- Update `scripts/process-media.sh` so the hero uses these settings and the other assets keep theirs. Record the change in `CLAUDE.md`.

## Step 5: Hero overlay
Replace the flat 40% black overlay with a **left-weighted gradient**: about 70% `--ink` on the left edge, fading to 0% by roughly 55% of the width, plus the existing bottom gradient for the trust bar. The house on the right should be bright and fully visible. Verify headline contrast against the brightest frame of the video.

## Step 6: Fix the loop (it must play forever)
The video currently stops after a few loops. Diagnose the real cause before patching. Likely suspects: the offscreen pause/resume IntersectionObserver not resuming, an `ended` handler, a `visibilitychange` gap, or a stalled network read. Then:
- Ensure `loop` is set and nothing listens to `ended` in a way that stops playback.
- Add a watchdog: if the hero video is visible and becomes paused, stalled, or ended, call `play()` (catching the promise rejection).
- Resume on `visibilitychange` back to visible.
- **Prove it:** a Playwright test that loads the page and samples `currentTime` every 10s for **3 minutes**, asserting it keeps advancing and wraps around at least 8 times. Add it to the test suite.

## Step 7: Verify and commit
- Type check, lint, and the full test suite pass.
- Screenshots at 1440 and 390 of the hero at 0s, 5s, and 10s into the video.
- Restart cleanly (stop the dev server, delete `.next`, run `npm run dev`) before trusting screenshots.
- Commit on `media`. Update `docs/STATUS.md`. Send me the screenshots and a summary.
