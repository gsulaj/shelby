# Media generation prompts

> Superseded: `MEDIA_BRIEF.md` is the approved brief and wins on any difference. This file is the earlier draft, kept for reference.

Prompts for the eight files in the media manifest (`src/content/media.ts`, `assets-raw/README.md`).
Written for Higgsfield; the wording is model-agnostic so it also works in any text-to-video,
image, or image-to-video model. Raw outputs go in `assets-raw/` under the exact filenames below,
then `npm run media` produces the web versions.

Nothing here is a business fact. Prompts describe generic materials (architectural asphalt
shingles, insulated vinyl siding, triple-pane windows, seamless aluminum gutters). They never ask
for brand names, logos, lettering, or signage, per CLAUDE.md.

## How the site uses each file

| File | Aspect | Target | How it is shown |
|---|---|---|---|
| `hero-flyover.mp4` | 16:9 | 10 s, 1080p or better, loopable | Full-bleed under an ink 40% overlay plus a bottom gradient to ink 85%. Headline, copy, and CTA sit in the lower-left third. A trust bar covers the bottom ~70px. |
| `svc-roofing.mp4` | 1:1 | 5–10 s, 1080×1080 | Sticky panel, cropped to about 4:5 on desktop (a 720×900 panel at 1440×900) and 4:5 on phones. A large "01 / 04" counter and a progress bar sit over the lower left; a gradient darkens the bottom third. |
| `svc-siding.mp4` | 1:1 | same | same |
| `svc-windows.mp4` | 1:1 | same | same |
| `svc-gutters.mp4` | 1:1 | same | same |
| `proof-after.jpg` | 16:9 | 1920 wide or better, JPG | Right side of the before/after slider. Also the end frame of the morph. |
| `proof-before.jpg` | 16:9 | same framing as the after | Left side of the slider. Also the start frame of the morph. |
| `proof-morph.mp4` | 16:9 | 5–10 s, 1080p | Full-width video frame on a bone background, autoplaying and looping. |

Composition rules that follow from the above:

- **Hero:** keep the house right of center with sky above it; leave the lower-left quiet. Favor
  bright, high-contrast surfaces so the frame reads through the dark overlay.
- **Service clips:** keep the subject in the middle of the square so the side crop loses nothing,
  and keep the key detail in the middle third vertically because of the counter and gradient.
- **Proof set:** before and after must be the same house, camera, and framing, or the slider and
  the morph fall apart. Generate the after first, derive the before from it with an image edit,
  then drive the morph from those two frames.

## Shared style block

Prepend to every prompt:

> Cinematic, photorealistic, high-end architectural commercial. A real Michigan suburban
> neighborhood with mature maple and oak trees, late summer. Muted, slightly desaturated grade
> with deep shadows and cool highlights; soft overcast or late-afternoon light. Slow, steady
> camera moves only. No text, no logos, no signage, no watermarks, no readable lettering, no
> close-up faces.

Negative guidance (where the model accepts it):

> fast motion, whip pans, cuts, jitter, people in the foreground, cars with lettering, text,
> logos, lens flare, snow, cartoon, oversaturated, HDR halo

## 1. `hero-flyover.mp4`

Text-to-video, 16:9, 10 s.

> Slow drone shot gliding forward and gently descending toward a two-story colonial home at dusk.
> Brand-new charcoal architectural asphalt shingle roof, crisp light-gray horizontal lap siding
> with white trim, new black seamless gutters, warm light in new double-hung windows. Street-side
> three-quarter view with the house centered-right, open blue-hour sky above and a neat lawn in
> front. A thin band of amber at the horizon. Constant speed, no shake, no cuts.

Loop note: the site plays this with the `loop` attribute and no crossfade, so a single continuous
move restarts with a visible jump. If the model offers a seamless-loop or ping-pong option, use it.

## 2. `svc-roofing.mp4`

Text-to-video, 1:1, 5–10 s.

> Slow tracking shot moving along a roof ridge while a roofer in work gloves and a plain dark
> shirt sets a charcoal architectural asphalt shingle and drives it with a pneumatic nailer.
> Fresh underlayment and the finished shingle course lead away into the distance under an
> overcast sky. Shallow depth of field. The hands and the shingle are centered in frame.

## 3. `svc-siding.mp4`

Text-to-video, 1:1, 5–10 s.

> Slow lateral dolly along the side of a home while a worker in work gloves locks a long panel of
> insulated vinyl siding into place. Crisp horizontal lap lines in a deep slate blue-gray, bright
> white trim, soffit, and fascia above. Raking afternoon light draws sharp shadow lines along
> every course. The siding fills the frame, centered.

## 4. `svc-windows.mp4`

Text-to-video, 1:1, 5–10 s.

> Interior shot looking out through a brand-new white triple-pane double-hung window as it is
> seated into the opening from outside by gloved hands. Soft daylight, trees out of focus beyond
> the glass, a hand running along the clean new frame. Slow push-in toward the glass. The window
> is centered and fills most of the frame.

## 5. `svc-gutters.mp4`

Text-to-video, 1:1, 5–10 s.

> Macro slow motion of rainwater sheeting off the edge of charcoal shingles into a brand-new
> seamless black aluminum gutter fitted with a fine mesh gutter guard. Droplets catch soft light;
> the downspout corner is visible. Slow lateral drift along the gutter, the edge centered in
> frame.

## 6. `proof-after.jpg`

Text-to-image, 16:9, highest resolution available. Generate this one first.

> Photograph, street-side three-quarter view of a 1990s two-story colonial home on an overcast
> afternoon. Brand-new, perfectly aligned charcoal architectural asphalt shingle roof with crisp
> ridge caps and clean flashing, new black seamless gutters, neutral beige vinyl siding, white
> trim. Wide lens with the entire roof visible, neighborhood trees behind, a wet driveway
> reflecting soft light.

## 7. `proof-before.jpg`

Image edit of `proof-after.jpg` so the house, camera, and light stay identical.

> Same house, same camera, same light. Make the roof look hail- and wind-damaged: dozens of torn
> and missing shingles exposing dark underlayment and patches of bare decking, lifted and curled
> shingle tabs along the eaves, a blue tarp weighted with boards over one section, bent and
> sagging gutters, shingle debris scattered on the lawn and driveway, and a darker storm sky.
> Change nothing else.

If the model cannot edit an image, generate the before from the same prompt as the after with the
damage description added, then pick the pair whose framing matches best.

## 8. `proof-morph.mp4`

Image-to-video, 16:9, 5–10 s, start frame `proof-before.jpg`, end frame `proof-after.jpg`.

> Static camera. The storm-damaged roof is restored progressively from the ridge down: the tarp
> lifts away, torn shingles are replaced course by course with clean new charcoal architectural
> shingles, the gutters straighten, the debris clears, and the sky brightens from storm gray to
> soft overcast. Smooth and continuous, no cuts, no people.

Fallbacks, in order: start frame only with the same prompt; then a 1.5 s ffmpeg crossfade from
the before still to the after still with a 3 s hold on each end.

## Generation order

1. `proof-after.jpg`, then `proof-before.jpg` from it, then `proof-morph.mp4` from the pair.
2. `hero-flyover.mp4`.
3. The four service clips.

## Post-processing

- Keep the exact filenames. Stills must be `.jpg`; convert PNG or WebP output with the bundled
  binary: `node_modules/ffmpeg-static/ffmpeg -i in.png -q:v 2 assets-raw/proof-after.jpg`.
- Run `npm run media`, then restart `npm run dev` so the server sees the new files.
- Check each clip in the browser at 1440×900 and 390×844: the hero under its overlay, the four
  service positions, and the proof frame in both `proofMode` values.
