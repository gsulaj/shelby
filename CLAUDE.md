# CLAUDE.md — Shelby Construction Homepage Prototype

## What this is
A **local-only pitch prototype** of a premium, cinematic, desktop-first homepage for **Shelby Construction Services** (exterior remodeling contractor, Clinton Township, MI). It's built by GSX Solutions to show a *prospective* client what his site could be. It is not deployed, not SEO-optimized, and not production. It must look and feel finished in a live demo on a laptop.

The full section-by-section spec lives in `BUILD_SPEC.md`. Read it before writing code. For any media generation, `docs/MEDIA_PLAYBOOK.md` is the proven method (creative direction, the house, motion rules, the finishing pipeline, real credit costs).

## Working rules
- **The spec is approved.** Don't re-brainstorm requirements or interrogate scope. Write an implementation plan from `BUILD_SPEC.md`, then execute it. Ask me only when you're genuinely blocked.
- **Phase checkpoint:** stop once after Phase 1 (design system + header + hero) and show me screenshots so I can approve the visual direction. After approval, run the remaining phases without stopping unless you're blocked.
- **TDD scope:** use tests for logic only (form validation, phone parsing, the estimate-intent store). UI, animation, and layout are verified **visually** with Playwright screenshots, not unit tests.
- **Never invent business facts.** All copy comes from `src/content/site.ts`, which is seeded from `BUILD_SPEC.md`. Never fabricate reviews, awards, stats, warranties, or prices. If something is missing, leave a clearly marked placeholder.
- **Never recreate third-party brand logos** (CertainTeed, Mastic, Alside, BBB, Google) in SVG or CSS. Use typographic badges instead.
- **Don't touch `logo.png` in the project root.** Copy it into `public/brand/` and derive variants from the copy.
- Use Context7 for current docs on Next.js, GSAP, and Lenis before writing code against them.

## Stack
- Next.js (latest stable, App Router, TypeScript, `src/` dir)
- Tailwind CSS (latest), with design tokens as CSS variables
- GSAP + ScrollTrigger via `@gsap/react` (`useGSAP`) for all scroll animation
- Lenis for smooth scroll, synced to ScrollTrigger; disabled under `prefers-reduced-motion`
- `next/font` for Barlow Condensed (600, 700) and Inter (400, 500, 600)
- `lucide-react` for icons
- Chatling (third-party embed, chatbot ID `2823318974`) for the chatbot, loaded once in `src/app/layout.tsx` via `next/script`; `src/lib/chatling.ts` opens it from page CTAs
- ffmpeg for media processing (install it if missing)
- Local dev only: `npm run dev`. No deployment config.

## Design system: "Premium Industrial"
Rugged luxury, engineered strength, high trust. Think architectural blueprint meets high-end machinery: heavy, solid, precise. **Restraint reads as premium.**

### Color tokens (define on `:root`, expose to Tailwind)
| Token | Hex | Use |
|---|---|---|
| `--ink` | `#0F1216` | Deepest backgrounds, hero overlay base, footer |
| `--slate` | `#1A1F26` | Primary dark sections |
| `--slate-raised` | `#232A33` | Cards and panels on dark backgrounds |
| `--bone` | `#F5F4F1` | Primary light sections |
| `--bone-raised` | `#FFFFFF` | Cards on light backgrounds (sparingly) |
| `--rule-dark` | `#2E3640` | 1px drafting lines on dark |
| `--rule-light` | `#D9D6CF` | 1px drafting lines on light |
| `--text-on-dark` | `#ECEAE6` | Body text on dark |
| `--muted-on-dark` | `#9AA3AE` | Secondary text on dark |
| `--text-on-light` | `#1A1F26` | Body text on light |
| `--muted-on-light` | `#5B6470` | Secondary text on light |
| `--accent` | `#00AEEF` | Logo blue (sampled from `public/brand/logo.png`). Primary CTA and key accents ONLY |
| `--accent-hover` | `#14B4F0` | CTA hover and focus (8% lighter than `--accent`) |

**Accent rule:** the accent covers at most ~5% of any viewport. Use it for primary buttons, active states, focus rings, thin accent rules, and one or two micro-accents (eyebrow tick marks, the active service index). Never use it for large fills, body text, or decorative blocks. Button text on the accent is `--ink` (7.4:1 contrast); never white.

**One solid button per viewport:** at most one solid accent button is visible in any viewport. Every other button in view uses the ghost style: transparent background, 1px `--accent` border, `--text-on-dark` label, arrow icon; on hover/focus it fills `--accent` with `--ink` text. The hero CTA is the solid one; the header CTA is ghost.

### Typography
- Headlines: Barlow Condensed 700, UPPERCASE, letter-spacing `0.02em`, line-height 0.95–1.05. Display sizes are large: hero H1 `clamp(3rem, 6vw, 6.5rem)`.
- Eyebrows: Barlow Condensed 600, uppercase, `0.18em` tracking, 13–14px, preceded by a short accent rule (24px × 1px).
- Body: Inter 400/500, 17–18px, line-height 1.6, max ~62ch.
- Numbers (prices, stats, indices): Barlow Condensed with tabular figures.

### Shape and texture
- **Sharp 90° corners everywhere.** `border-radius: 0` (2px max on inputs). No pill buttons, no rounded cards.
- 1px drafting lines (`--rule-*`) as structural dividers.
- Dark sections get a faint blueprint texture in pure CSS: a 48px grid of 1px lines at ~4% opacity, plus an SVG `feTurbulence` grain at ~3% opacity. No image files.
- Buttons: solid accent, ink-colored text in Barlow Condensed uppercase, 56px tall for primary, with a subtle arrow icon that nudges 4px on hover. Secondary buttons are 1px outlined.
- Shadows: almost none. Depth comes from tone (slate vs. slate-raised), not drop shadows.

### Motion
- Easing: `power3.out` for reveals, `power2.inOut` for crossfades. Durations 0.6–1.0s. Nothing bouncy.
- Reveals: masked line-by-line slide-up (text in `overflow:hidden` wrappers, translating from 100% to 0).
- Under `prefers-reduced-motion`: no Lenis, no scroll animation, content visible immediately, videos show their poster frame only.

## Media pipeline
- Raw AI-generated media goes in `/assets-raw/` with exact filenames from `BUILD_SPEC.md` → Media manifest.
- `scripts/process-media.sh` converts everything in `/assets-raw/` into `public/media/`:
  - MP4: H.264, `-an`, `+faststart`, CRF ~24–28. The service clips are an exception (`SERVICES_BRIEF.md`, services v2): finished 2160×2160 masters from `scripts/svc-finish.sh` (native-4K Kling 2880² scaled to 2160, speed-up-only time-remap where the camera eases in, hero grade via `scripts/svc-grade.mjs`, 0.5 s crossfade loop, grain last), encoded as H.264 High CRF 18 +faststart and VP9 CRF 18, poster = first frame, no size budget; `SVC_SIZE=1800` is the fallback if Safari drops frames. The hero is the other exception: for the Cloudflare Pages deploy (25 MiB per-file limit) the 4k master is scaled and centre-cropped to 1920×1080 and encoded two-pass to a target size, H.264 High at 5.2 Mb/s (~9.4 MB) and VP9 at 5 Mb/s (~9.1 MB), with a 1920 poster (~360 KB); the earlier 3840×2160 CRF 20 files are kept locally in the gitignored `media-masters/`. The proof morph is the third exception (`PROOF_BRIEF.md`, proof v2): a 3840×2160 master from `scripts/proof-finish.sh` (speed-matched remap, in-place dissolve, fades to `--ink`, grain last), delivered at 2560×1440 as H.264 High CRF 19 +faststart (CRF 18 was 43 KB over the 25 MiB deploy limit) and VP9 CRF 24, poster = frame 6 (the first frame after the fade-in), no size budget; the slider stills are 3840.
  - WebM: VP9 version of each video.
  - Poster: `<name>-poster.jpg`, the first frame, quality ~80.
  - Stills: JPG ~1920px wide, plus WebP.
  - Size budgets: none for the hero, the service clips or the proof morph (local demo: quality wins, no CRF raising); any other clip keeps the old raise-CRF-until-it-fits loop.
- The hero master itself is finished locally from the upscaled orbit clips: `scripts/hero-stitch.sh` joins them into the loop, `scripts/hero-finish.sh` time-remaps (ffmpeg `minterpolate`, speed-up only, pass-through frames bit-exact), grades, grains (grain only after the upscale) and writes `assets-raw/hero-flyover.master-4k.mp4` (3884×2160, CRF 12; `hero-flyover.mp4` is a symlink to it). The orbit clips are Starlight Precise 2.6 upscales (fal) of the raw Kling clips, colour-matched back to them by `scripts/hero-colormatch.mjs`; the finish reuses the recorded time-remap plan in `docs/hero-remap-plan/` (`REMAP_PLAN`), so the timing never drifts; `docs/HERO_RESUME.md` holds the exact recipe.
- `src/content/media.ts` is the single source of truth for every media path. Swapping in real photos later must be a one-file change.
- **Until a file exists**, components render a labeled placeholder: a slate gradient with the blueprint texture and the filename as a small mono tag in the bottom-right corner of the media area (it must never overlap text or bars). The layout must not break with missing media.

## Performance and quality bars
- Only the hero video preloads (`preload="auto"`). All other videos use `preload="none"` and load as they approach the viewport.
- Every `<video>`: `muted autoPlay loop playsInline`, `object-fit: cover`, poster set, `<source>` MP4 then WebM. MP4 goes first because WebKit (Safari) stops looping a WebM source at the end of the file; `SmartVideo` also runs a watchdog that restarts a visible clip that pauses, ends, or stops advancing, proven by `npm run test:loop` (3 minutes in Chromium and WebKit, needs the dev server). The hero, the service clips and the proof morph are the exception to `loop`: `SmartVideo seamless` (the manifest `seamless` flag) loops them through two stacked elements, because the native loop held a frame above 84 ms at the wrap (110–220 ms with the 4k hero file, 85–101 ms on the services and the proof) (`docs/HERO_RESUME.md` "Loop-wrap hold — fixed"); `test:loop` fails on a wrap interval above 84 ms.
- Only play videos that are visible; pause offscreen ones (IntersectionObserver).
- Semantic HTML, one H1, visible accent focus rings, AA contrast on text over video (overlay included).
- Desktop-first, but **mobile (390px) must be presentable**. The owner may pull it up on his phone.

## Verification (use the webapp-testing / Playwright skill)
After each phase:
1. Run the dev server.
2. Screenshot at **1440×900** and **390×844**, full page plus key viewport positions.
3. For the sticky services section, screenshot at each of the four scroll positions to confirm the correct video is active.
4. Review the screenshots yourself against this file and `BUILD_SPEC.md`, fix the issues, then re-shoot.
5. Check the console for errors and hydration warnings.
6. For the hero: `node scripts/hero-contrast.mjs` (text contrast against the video + overlays through the whole loop, AA on the mean background), `node scripts/hero-shots.mjs` (1440 and 390 at 0/5/10 s), `npm run test:loop` and, after any change to the hero video or `SmartVideo`, `node scripts/hero-wrap-check.mjs` (wrap timing in Chromium, WebKit, Chrome and real Safari).

## Secrets
- The site needs no API keys (the Chatling chatbot is configured in Chatling’s dashboard). Keep `.env*.local` in `.gitignore`.
- Never log, print, or echo any key. Never send one to the client.
