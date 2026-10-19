# Shelby Construction homepage prototype — status

As of 2026-10-16, updated 2026-10-18. Baseline commit `ac84c34` on `main`; this file was added in the following commit.
Media generation and integration landed the same evening from the `media` branch (section 7). The v2 media
revamp (section 8) is complete: **all media sections are done** (hero, services, proof), all merged into `main`.

**The hero is COMPLETE and merged into `main` at `de5bde4`** (2026-10-18, a fast-forward: `main` and `media` were the
same commit there). That covers finished v2 (sections 9–10), the Starlight Precise 2.6 sharpness pass (section 11, `6246330`)
and the double-buffered loop that removed the 4k wrap hold (section 12, `de5bde4`).
**Services v2 is COMPLETE and merged into `main` at `bcdf361`** (2026-10-18, a fast-forward; feature commit `01d530e`;
section 13, `SERVICES_BRIEF.md`): new native-4K roofing, siding and windows clips, the kept gutters clip upscaled and
regraded, all four at 2160×2160 and looping through the double buffer. The owner reviewed and approved the clips as
delivered, including the 0.5 s loop dissolve.
**Proof v2 is COMPLETE and merged into `main` at `4dfed23`** (2026-10-18, a fast-forward; feature commit `677197e`;
section 14, `PROOF_BRIEF.md`): a storm-damaged roof that dissolves in place into a new charcoal roof in golden light while
the camera keeps moving, 2560×1440, 8.79 s, double-buffered, with a BEFORE/AFTER label; matched 3840 slider stills. The
owner reviewed and approved it as delivered, including the seam's 6 px course offset (no retake).
**All media sections are done.** Work continues on `media`; no media task is open.
Hero reference (every path, ID, recipe and measurement, plus the deployment notes: Git LFS for the >100 MB hero files, a
~15–25 MB mobile encode for production): `docs/HERO_RESUME.md`.
Spec: `BUILD_SPEC.md` (what) and `CLAUDE.md` (how). Plan: `docs/superpowers/plans/2026-10-16-shelby-homepage.md`.
Decision ledger (every ruling with its reason): `docs/superpowers/plans/2026-10-16-shelby-homepage-ledger.md`.

## 1. What is built and verified

**Stack.** Next.js 16.4.2 (App Router, TypeScript, `src/`, Turbopack), Tailwind CSS 4.3 with the
Premium Industrial tokens on `:root` as the only palette, GSAP 3.15 + `@gsap/react` (ScrollTrigger,
SplitText masks), Lenis 1.3 synced to the GSAP ticker, `next/font` (Barlow Condensed 600/700, Inter),
`lucide-react`, `@anthropic-ai/sdk` 0.135 (server only), Vitest 5, Playwright 1.64, `sharp`, `ffmpeg-static`.

**Page, in spec order.**
- Sticky header: transparent, gradient veil after 80px, auto-hide on scroll down, ghost "Free Estimate" CTA.
- Hero: full-bleed drone clip (`public/media/hero.*`), masked line-by-line H1 reveal, trust bar
  (typographic badges; marquee below 1024px), scroll fade from the hero midpoint to 0.3 opacity.
- The Shelby Standard: statement reveal, body, four-stat row with a count-up.
- Core services: 50/50 sticky video panel with crossfade, "01 / 04" index and progress bar on desktop;
  stacked 4:5 videos on mobile; attic-insulation row; every "Get a … Estimate" link preselects the form.
- Proof: clip-path scrub reveal; `proofMode` switches between the morph video and a keyboard-accessible
  before/after slider (`src/content/media.ts`).
- Reviews: 4.7 summary with fractional stars and three verbatim Google review cards (Jacob S., Felicia W., Greg H.),
  clamped to six lines with a Read more / Read less toggle (section 16).
- How it works: four numbered columns with the accent line drawn on scroll.
- Financing and pricing: three price cards, disclaimer, "Check Financing Options" opens the chat with a
  financing opener.
- Estimate form: exact spec fields, inline validation, live US phone formatting, preselect, 600ms sending
  state, success panel, no network call.
- Footer: four columns, promo terms bar, copyright, "Concept by GSX Solutions".
- Shelby Assistant: FAB with pulse ring, 400×620 panel (full screen on phones), opening message and chips,
  streaming replies, Lead Captured card, financing opener, Escape to close.
- Backend: `POST /api/chat` streams NDJSON from `claude-haiku-5-5` with the `capture_lead` tool, validates
  the lead, appends it to `data/leads.json`, logs one line, and emits the lead event. 30-turn cap and input caps.
- Scripted fallback: `src/lib/chat/scripted-flow.ts` asks the same questions, answers the chips with
  published facts, and ends with the same Lead Captured card. Activates when the route is unavailable or errors.

**Tooling.** `scripts/process-media.sh` (assets-raw → public/media with size budgets),
`scripts/make-logo-variant.mjs` (light logo for dark sections), `scripts/screenshot.mjs` (1440 and 390,
header states, per-section positions, reduced-motion mode).

**Verification run before the baseline commit.**

| Check | Result |
|---|---|
| `npx vitest run` | 59 tests passing in 10 files (content, intent store, chat store, phone, validation, lead parsing, prompt, leads store, handler, scripted flow) |
| `npx tsc --noEmit`, `npm run lint` | clean |
| Browser console at 1440×900 and 390×844, every section | no errors, no hydration warnings |
| Sticky services (Playwright) | correct index and visible layer forward 01→04 and backward 03→01 |
| Estimate form (Playwright) | five inline errors on empty submit, focus to first field, `(586) 555-0123` formatting, success panel, zero requests |
| Chatbot without a key (Playwright) | chips, pricing fact, full qualification, Lead Captured card, Escape, financing opener, focus kept after send |
| Reduced motion (Playwright) | no Lenis, nothing left hidden, no marquee or FAB animation, services still switch |
| Fresh-eyes code review | 0 Critical, 4 Important, 7 Minor; all 11 fixed with tests or browser probes (see ledger "Final:" lines) |

Final screenshots: `docs/screenshots/final/` (30 files).

## 2. Deviations from BUILD_SPEC.md

Items 1–6 were requested at the Phase 1 checkpoint; the spec and CLAUDE.md were updated in place.
Items 7–18 are implementation rulings recorded in the ledger.

| # | Area | Spec said | Built | Why |
|---|---|---|---|---|
| 1 | Accent color | Copper `#B8612A` / `#CE7438` | Logo blue `#00AEEF` / `#14B4F0` as `--accent` / `--accent-hover`; ink text on accent (7.42:1) | Requested; sampled from `public/brand/logo.png` |
| 2 | Header | Ink 92% background + 1px border after 80px | No background or border; 140px ink gradient veil (75%→0, no blur) after 80px; hides on scroll down, returns on scroll up; ghost CTA | Requested; blur made headlines smudge under the header |
| 3 | Hero scroll motion | "Drifts up slightly and fades" | Fade starts after 50% of the hero has scrolled, floors at 0.3 opacity, 32px drift | Requested |
| 4 | Hero eyebrow on phones | One eyebrow string | Below 640px: "MACOMB · OAKLAND · ST. CLAIR" on one line; non-breaking spaces keep separators off line starts | Requested |
| 5 | Trust bar on phones | Not specified | Seamless marquee below 1024px, paused on hover/touch, static under reduced motion | Requested |
| 6 | Media placeholder | Filename in small mono text | Small tag in the bottom-right corner with a per-use offset; no corner marks | Requested |
| 7 | Chat FAB | Square button with icon and label | 56px square (48px on phones) with the icon; the label is the accessible name and slides in on hover/focus; desktop trust row reserves 80px on the right | A labeled FAB covered the last trust badge at 1440 and full-width CTAs on phones |
| 8 | One solid accent button per viewport (CLAUDE.md) | — | The FAB is the standing exception | Spec §3 mandates a solid FAB; CLAUDE.md lists the FAB among allowed accent uses |
| 9 | No API key | Plan said 503 | `200` with JSON `{ "error": "no_api_key" }`; the client treats any non-NDJSON reply as unavailable | Browsers log a 503 as a console error, breaking the "no console errors" bar for a designed fallback |
| 10 | Haiku request | `claude-haiku-5-5`, streaming, `max_tokens: 400` | Same, plus `output_config.effort: "low"` and no `thinking` parameter (adaptive by default) | Protects the 400-token budget; SDK docs describe Haiku 5.5 as adaptive-only |
| 11 | Caps | "30 turns" and "basic input length caps" | `MAX_TURNS` 30, `MAX_MESSAGE_CHARS` 1000 (also the textarea `maxLength`), `MAX_MESSAGES` 80 | 80 lets the 31st user turn arrive so the phone-number pointer is reachable |
| 12 | Conversation start | Not specified | Leading assistant turns (the widget's local opener) are dropped server-side; the system prompt names the opener already shown | The API conversation always starts with the visitor and the model does not greet twice |
| 13 | Phone auto-format | "Auto-format as the user types" | Formats up to 10 digits; 11+ digits stay unformatted so validation rejects them | A pasted 11-digit number without a leading 1 was being truncated into a wrong number |
| 14 | Scripted fallback copy | "Canned facts from site.ts" | Questions, hints, facts, and confirmation added to `site.chat` (tagged PITCH COPY); the "Storm damage" chip also sets storm = yes | Needed for a complete scripted flow; every fact restates a published fact |
| 15 | Service block title | "01 — ROOFING" | Small accent index above the H3 | Keeps the display headline clean at the sticky panel's scale |
| 16 | Headlines | — | Wider max-widths with balanced wrapping; non-breaking hyphen in "storm‑damaged" | Avoids orphaned words at 1440 |
| 17 | Lead file | "Append to /data/leads.json" | Same, with writes serialized per file and a corrupt file backed up as `leads.json.corrupt-<timestamp>` | Concurrent captures lost a lead; a hand-edited file was silently overwritten |
| 18 | Mid-conversation API failure | "Silently switches" | Switches and replays the visitor's earlier turns into the scripted state | Keeps what the AI had already collected instead of restarting |

## 3. Outstanding

- **Live Haiku path untested.** A `.env.local` was added on 2026-10-16 but the live path has not been exercised; the handler was verified only against a fake
  client in `src/lib/chat/handler.test.ts`. To test: `cp .env.local.example .env.local`, set
  `ANTHROPIC_API_KEY`, restart `npm run dev`, run a chat to the Lead Captured card, then check
  `data/leads.json` (created on the first lead) and the terminal for `[lead] …` or `[chat] error: …`.
  If a request parameter is rejected, the widget falls back to the scripted flow and the terminal shows why.
- **Media v2 revamp.** The hero is **COMPLETE** (sections 9–12, merged into `main` at `de5bde4`). Services v2 is **COMPLETE** (section 13, merged into `main` at `bcdf361`). Proof v2 is **COMPLETE** (section 14, merged into `main` at `4dfed23`). All media sections are done. Higgsfield balance **6.61** (lite plan, 2026-10-18), unused by the proof (fal only).
- **Proof seam (accepted).** The in-place dissolve joins two edits of one roof whose course lines sit a median 6 px apart at 3840 (≈ 2 CSS px on screen), and the leaf cluster in the corner grows during it (brief bar: within a few pixels). The owner approved it as delivered on 2026-10-18, no retake. If it is ever revisited: a new F0 from a D_last that still shows the gutter or rake edge (a Clip D retake whose camera ends on structure, ≈ USD 2.10 + edits), which gives the edit anchors to hold.
- **Safari: first wraps after a service clip becomes active — FIXED (2026-10-18, `9a762e7`, section 15).** The seamless loop now loads and calibrates a short clip within its first pass; every first wrap after a fresh scroll-in is 49–51 ms in all four browsers, real Safari included.
- **Services loop dissolve (accepted).** The brief's 0.5 s crossfade shows both ends of the move at once on roofing, siding and windows (section 13); the owner approved the clips as they are on 2026-10-18. If it is ever revisited: locked camera with subject motion, first frame = last frame (the gutters method), about USD 2.10 per clip on fal.
- **Reviews — DONE (2026-10-18, section 16).** Three verbatim Google reviews replace the placeholders.
- **Rating confirmation — DONE (2026-10-18, section 16).** `site.rating` is `{ 4.7, 195, Google, verified: true }`, as
  confirmed on the Google Business Profile. `BUILD_SPEC.md` still quotes the original seed (4.7 · 130); `site.ts` wins.
- **Xcode 27.1 license** (see quirks) and, optionally, `brew install ffmpeg` once Homebrew works again.
- **Owner call on the FAB exception** to the one-solid-button rule (deviation 8).

## 4. Known quirks

- **git / Xcode.** `/usr/bin/git`, `python3`, and `brew` route through the selected Xcode 27.1, whose license
  is not yet accepted (the accept on 2026-10-16 was recorded for Xcode 26.4.1). The Command Line Tools' git
  works: `DEVELOPER_DIR=/Library/Developer/CommandLineTools git …`. Fix for good with
  `sudo xcodebuild -license accept` from a terminal where `xcode-select -p` shows Xcode 27.1, or switch with
  `sudo xcode-select -s /Library/Developer/CommandLineTools`.
- **`globals.css` is not hot-reloaded.** This Next 16.4 + `@tailwindcss/turbopack` setup kept serving the old
  stylesheet after CSS edits. After editing `src/app/globals.css`, stop the dev server, `rm -rf .next`, start
  it again, and trust screenshots only after that.
- **Fonts.** Inter is loaded without a `weight` list because Turbopack's Google Fonts loader rejects weight
  arrays on variable fonts; the variable axis covers 400–600.
- **`next.config.ts`.** `devIndicators: false` hides the Next badge during demos; `turbopack.root` is pinned
  because a stray `~/package-lock.json` otherwise becomes the workspace root; the scaffold's
  `cacheComponents` was removed because the page reads the filesystem per request to detect media.
- **Vitest config** is `vitest.config.mts` (ESM) to avoid a CommonJS warning.
- **Screenshot script** pads the page to 300vh for the header-hidden/revealed shots, so those two frames are
  not the real page bottom.

## 5. Commands

```bash
npm install                    # dependencies (also installs ffmpeg-static)
npx playwright install chromium   # once, for npm run shots
npm run dev                    # http://localhost:3000
npm test                       # vitest run (logic tests only)
npm run lint                   # eslint
npx tsc --noEmit               # type check
npm run logo                   # copy logo.png to public/brand and derive logo-light.png
npm run media                  # process assets-raw/ into public/media/ (restart dev after)
npm run shots -- --out docs/screenshots/latest --scrolled-header --at "#standard" --at "#svc-roofing" --at "#svc-siding" --at "#svc-windows" --at "#svc-gutters" --at "#proof" --at "#reviews" --at "#process" --at "#pricing" --at "#estimate" --at footer
npm run shots -- --out docs/screenshots/reduced --reduced-motion   # reduced-motion rendering
node scripts/verify-media.mjs --out docs/screenshots/media   # media checks: console, lazy load, services, proof, reduced motion
bash scripts/media-loop-check.sh assets-raw/originals/svc-gutters.mp4 /tmp/clipcheck   # contact sheet and reversal metrics for a clip
bash scripts/media-loop-close.sh assets-raw/originals/svc-siding.mp4 assets-raw/svc-siding.mp4 0.5   # close a loop with an xfade
BLEND_FRAMES=3 TRIMS="0,0 0,1 0,10" bash scripts/hero-stitch.sh <clip1> <clip2> <clip3> <out.mp4> [workdir]   # hero orbit clips → loop
bash scripts/hero-finish.sh <stitched.mp4> assets-raw/hero-flyover.mp4 [workdir]   # time-remap, grade, grain → hero master (POSTER_IN/POSTER_OUT grade the poster)
npm run test:loop                  # 3-minute hero loop test, Chromium + WebKit, fails on a hold at the wrap (needs npm run dev)
node scripts/hero-wrap-check.mjs   # hero loop-wrap timing, 10 wraps: Chromium, WebKit, Chrome and real Safari (needs npm run dev)
node scripts/hero-contrast.mjs     # hero text contrast against the video + overlays through the loop
node scripts/hero-shots.mjs        # hero screenshots at 0/5/10 s, 1440 and 390
cp .env.local.example .env.local   # then set ANTHROPIC_API_KEY to enable the live chat
DEVELOPER_DIR=/Library/Developer/CommandLineTools git status      # until the Xcode 27.1 license is accepted
```

## 6. What the baseline commit contains

- 114 files, 45.5 MB. Of that, 44.97 MB is the 30 PNGs in `docs/screenshots/final/` (2× device scale,
  full-page 1440 and 390 plus every section and header state). Everything else is 0.57 MB: `package-lock.json`
  0.28 MB, source under `src/` about 0.2 MB, docs, scripts, and the two brand PNGs.
- Not tracked, by `.gitignore`: `node_modules/`, `.next/`, `.env*.local` (so `.env.local`), `/data/`,
  `/.superpowers/`, and the intermediate `docs/screenshots/phase-*/` runs (about 150 MB on disk, regenerable).
  Verified with `git ls-files | grep -E '^(node_modules/|\.next/|\.env\.local$|data/)'` returning nothing.

## 7. Media generation and integration (2026-10-16)

All eight manifest assets were generated through the Higgsfield MCP per `MEDIA_BRIEF.md` and processed with
`npm run media`. The work ran on the `media` branch and merged to `main` after the section 5 checks below.

**Models and spend.** Stills: Nano Banana Pro (`nano_banana_pro`) at 2k, 2 credits each; the job tracker labels
these jobs `nano_banana_2` although they were requested and billed as Pro. Clips: Kling 3.0 Omni Frames
(`kling_o3_flf`), pro mode, sound off, 6.25 credits per 5 s clip and 12.5 for the 10 s hero. Nine stills (one hero
retake after a rotated frame) and six clips cost 61.75 credits; balance 250 → 188.25. Every paid call was preceded
by a free cost check that matched the approved table.

**Pipeline.** Still first, then image-to-video from the approved still. Proof: F generated with the hero still as a
reference, G as an instruction edit of F (framing verified with a 50/50 blend), H from F as first frame and G as last
frame. Loops: E keeps its still as both first and last frame (locked camera, drips only, no reversal); A–D use the
first frame only and are closed in processing with a 0.5 s xfade (`scripts/media-loop-close.sh`), which trims them
to 9.54 s and 4.54 s. The dissolve is visible on the clips with long camera travel; accepted at Gate 2. H restarts
on loop by design.

**Files.** Deliverables in `assets-raw/` under the manifest names; source stills in `assets-raw/stills/` (PNG original
plus JPG; the rotated hero first try is `hero-flyover-a.v1.*`); untouched Kling downloads in `assets-raw/originals/`,
gitignored (about 100 MB) and recoverable from the Higgsfield library by the job ids below. Outputs in `public/media/`
(22 files): hero MP4 5.33 MB, service clips 0.38–1.29 MB, morph 1.07 MB, all at CRF 24 and within budget.
`media.ts` needed no edit: readiness is detected from the files on disk and `proofMode` stays `"video"`.

**Deviations recorded.**
- F sits a little above eye level rather than at street level so the roof damage is visible; accepted at Gate 1.
- `SmartVideo` now sets the `autoplay` attribute only on the preloaded hero. Chromium fetches a source for any
  autoplay video even with `preload="none"`, so every clip downloaded on page load; the other clips start from the
  existing IntersectionObserver `play()` call instead. A one-attribute change, found by the lazy-load check.
- Hero output is 1928×1076 in pro mode and scales to 1920×1072; it is sharp enough that 4k mode (60 credits) was
  not used.

**Verification** (`node scripts/verify-media.mjs`; screenshots in `docs/screenshots/media/`, 22 files).

| Check | Result |
|---|---|
| `npx tsc --noEmit`, `npm run lint`, `npx vitest run` | clean, 59 tests passing |
| Console at 1440×900 and 390×844, normal and reduced motion | no errors, no warnings, no hydration messages, no failed media responses |
| Initial-load network | only `hero.webm` plus the six posters at 1440 and 390; service clips and the morph load on scroll |
| Sticky services | correct layer visible and playing with the others paused, index 01→04 down and 03→01 back up |
| Proof reveal | clip-path `inset(4.32% 3.24%)` mid-scroll, `inset(0%)` revealed, morph playing |
| Reduced motion | zero `<video>` elements, six distinct poster images; the hero source is still requested once from the pre-hydration markup |

Job ids: stills hero B `4ccf0289-7128-46a5-bf11-15cdec01fd3e`, hero A retake `108eeaaa-65c1-421e-973b-f91e83ba5b03`,
roofing `d8b6ee85-6a65-4b15-82ed-a27a101b3c32`, siding `9edb1f9f-eb82-42e2-9419-b3bc5025170f`, windows
`1bf4f51e-e7b1-499b-8669-b70a5f8db70b`, gutters `37c12dea-c81e-47e8-a01d-9e6007523aec`, before
`39273927-c92d-4aeb-b19c-6761808bb305`, after `80e3ba4f-ccc6-4256-93ca-0e88af1fb9e8`; clips hero
`66ae9d01-8292-4336-9319-08db7fec469e`, roofing `321def74-2a67-4a9a-a92a-93b22142b73b`, siding
`2b059f37-65d1-4386-a813-62ac816e29f3`, windows `1f46c375-cc7d-4250-838a-26a17afbe8c3`, gutters
`a712e602-5fd9-47e5-8dea-5b605bc566fe`, morph `1ebe9c74-fa91-4f46-bea6-415d0232226e`.

## 8. Media v2 revamp (in progress, 2026-10-17)

**Branch.** Work continues on `media`. `main` was fast-forwarded to it on 2026-10-17 (hero v2 finished) and again on 2026-10-18 to `de5bde4` (sharpness pass and loop fix), so both hold the complete hero and the v1 services and proof.

**v1, generated and integrated (section 7).** All eight manifest assets: `hero-flyover.mp4`, `svc-roofing.mp4`,
`svc-siding.mp4`, `svc-windows.mp4`, `svc-gutters.mp4`, `proof-before.jpg`, `proof-after.jpg`, and `proof-morph.mp4`,
processed into `public/media/` and live on the page.

**Creative decision.** All v1 media is being revamped. The v1 grade (overcast, cool, desaturated, deep shadows) came
out too dark and wintry. The new direction is bright, aspirational late-afternoon Michigan summer: the dark UI frames
the footage, the footage itself is not dark. Exception: `svc-gutters` stays, since the client likes it; it may get a
brighter grade in processing later.

**Order.** Hero first, per `HERO_BRIEF.md` — complete and merged at `de5bde4` (sections 9–12). Next the services videos (roofing, siding,
windows; gutters is kept and may get a brighter grade), then the proof section (before/after + morph using the hero house),
each with its own brief and the method in `docs/MEDIA_PLAYBOOK.md`. The v1 files stay in place meanwhile so the page never
falls back to placeholders.

**Reference photos.** `assets-raw/reference/` holds four angles of the target house style: `front_of_house.jpeg`,
`left_side_of_house.jpeg`, `back_of_house.jpeg`, and `back_left_of_house.jpeg`. The hero brief uses them as the
style reference for a new-construction home in the same architectural language, not a copy. The brief and the
photos were untracked when this section was written.

**Credits.** Higgsfield balance 188.25 on the lite plan as of 2026-10-17 before any v2 generation; 98.61 after the hero
(section 10; the playbook has the per-item prices and the estimates for the remaining assets).

## 9. Hero v2 — approved motion (2026-10-17)

Summary of the first hero session (the remaining steps were completed in section 10): candidate A of two 4k Nano Banana Pro style frames was chosen, cleaned
(plaque lettering, lawn sign, wires) and used as the start/end frame; a single-take Plan A preview rewound, so Plan B ran:
keyframes K2 (low over the front roof, colour-matched locally to the start frame) and K3 (rear three-quarter), three Kling
3.0 Omni Frames pro clips (6 + 5 + 5 s) stitched by `scripts/hero-stitch.sh` (easing trims, 3-frame seam blends, loop
close) into a 15.3 s loop at `assets-raw/hero-flyover.mp4`, encoded to `public/media/hero.*` at 2560 px, CRF 18.
The motion is approved as-is (no clip 2 retake, no 4k re-render).

The hero loop bug is fixed: WebKit stops looping a WebM source at the end of the file, so `SmartVideo` serves MP4 first and
runs a watchdog; `npm run test:loop` (3 minutes, Chromium + WebKit) failed before and passes after, on both the old and the
new hero. Credits: 188.25 → 117.50 on the lite plan. Ledger: `docs/superpowers/plans/2026-10-17-hero-ledger.md`.

## 10. Hero v2 — finished (2026-10-17)

The remaining steps of the resume file (a–f) ran in one session on `media`; every ruling is in the ledger from "Resume"
onward. `docs/HERO_RESUME.md` now holds the finished state, every path and ID, and the recipe.

**Upscale (a, b).** `upscale_video` has no cost preflight, so the balance was read around every call (owner ruling for this
run: credits approved, stop only if the balance cannot complete a step). ByteDance 4k (preset `aigc`, 24 fps, source
dimensions passed) on raw clip 1: 4.83 credits, 3880×2160, 145 frames, no tone shift (YAVG 106.88 vs 106.97), SSIM 0.952
to the source after downscale, sharpness jitter 0.0046 vs the source's 0.0053 (no added flicker). A Topaz 2160p A/B on the
same clip (6.00) came back softer at 100% on shingles and brick and padded to 16:9 (HEVC), so ByteDance was used for clips 2
and 3 too (4.03 each; 3870×2160 and 3880×2160, 121 frames, SSIM 0.959 / 0.942). Upscale spend 18.89; balance 117.50 → 98.61.
Re-stitch with the identical recipe (`BLEND_FRAMES=3 TRIMS="0,0 0,1 0,10"`, common crop 3870×2160): 367 frames, 15.29 s.

**Finishing (c).** `scripts/hero-finish.sh` with `scripts/hero-remap-plan.mjs` (ffmpeg only, no credits):
- Time-remap: motion per frame (signalstats YDIF at 480 px) → passages slower than their 3-second surroundings play up to
  1.5× faster, nothing is slowed down. Three regions — the front-low pass (frames 130–186, 57→49), the clip 2→3 join with
  the rear view (240–276, 37→32) and the easing into the start frame (344–366, 23→19) — give **350 frames, 14.58 s**.
  Regions consume whole output frames, so the other 250 frames pass through `minterpolate` bit-exact (PSNR check in the
  log); interpolated frames (mci / aobmc / bidir / vsbmc, search 64) measure ~3% softer than their neighbours and are
  indistinguishable at 100%. Join 2 now runs 8.0 → 6.7 → 9.2 instead of 7.4 → 5.7 → 8.6 (480 px YDIF) and the seam
  8.2 → 7.0 → 9.4 → 11.4 instead of 6.3 → 6.0 → 7.6 → 10.5; the single-frame dips that remain are the 3-frame crossfades.
- Grade: +5% saturation, +1% contrast, warm midtones and highlights (`colorbalance`, deliberately without `pl`, which cut
  saturation by a quarter and mottled the lawn in ffmpeg 6.0). Mean RGB at 0 s 120/119/102 → 119/119/95; clipped pixels
  0.13% → 0.33%; clouds and sky intact.
- Grain `noise=alls=5:allf=t+u` at 4k (barely visible at 2560; no blotching or banding after either encode).
- Master `assets-raw/hero-flyover.mp4`: 3870×2160, 350 frames, H.264 CRF 17, 93.5 MB (tracked; the 1928 master moved to
  `assets-raw/originals/hero-flyover.v2-1928-stitched.mp4`). Poster `assets-raw/hero-poster.png` →
  `stills/hero-frame.v2a-final.graded.png` (same grade, no grain; mean RGB within 4 levels of frame 0).

**Encode (d).** `bash scripts/process-media.sh hero-flyover.mp4`: `hero.mp4` 2560×1428 CRF 18 **42.85 MB** (24.6 Mb/s),
`hero.webm` VP9 CRF 26 **31.45 MB**, `hero-poster.jpg` 1.3 MB. SSIM master → mp4 0.987 / 0.986 / 0.990 and → webm
0.987 / 0.986 / 0.988 at 2 / 7 / 12 s.

**Overlay (e).** Desktop `.hero-shade` (ink 70% → 55% → 36% → 16% → 0 at 0 / 15 / 30 / 44 / 55% of the width) replaces
the flat `bg-ink/40` on `lg` and up; phones keep the flat tint; the bottom gradient is unchanged. The hero eyebrow is
`text-on-dark/90` and the phone link `text-on-dark/85` (the muted colour measured 3.7–3.9:1 against the video even under
the old flat tint). `node scripts/hero-contrast.mjs` on the final hero (text hidden, 30 frames every 0.5 s; contrast
against the mean background / against its brightest 10%):

| Text (minimum) | 1440×900 worst | 390×844 worst |
|---|---|---|
| H1 (3:1) | 8.60 / 4.44 | 7.58 / 4.56 |
| Eyebrow (4.5:1) | 8.13 / 4.79 | 5.15 / 3.62 |
| Sub (4.5:1) | 7.58 / 4.26 | 7.69 / 5.28 |
| Phone link (4.5:1) | 7.02 / 6.44 | 8.51 / 7.83 |

**Verification (f)** after a clean restart (`.next` cleared, managed dev server).

| Check | Result |
|---|---|
| `npx tsc --noEmit`, `npm run lint`, `npx vitest run` | clean, 59 tests passing |
| `npm run test:loop` (180 s, Chromium + WebKit) | PASS, 2 of 2 in 182.7 s — 2 passed (Chromium and WebKit), 182.7 s |
| `node scripts/verify-media.mjs` | ALL CHECKS PASSED: console clean in all four sessions, only `hero.mp4` at load, services 01→04→01, proof reveal and morph playing, reduced motion with posters only |
| `node scripts/hero-shots.mjs` | `docs/screenshots/hero-v2/` (1440 and 390 at 0 / 5 / 10 s), console clean |
| `node scripts/hero-contrast.mjs` | all hero text above AA on the mean background (table above) |

Credits: hero v2 spend 89.64 in total (70.75 frames, keyframes and clips + 18.89 upscales); balance 98.61 on the lite
plan. Review copy for the owner: `.superpowers/sdd/HERO_BRIEF/review/hero-v2-final-review-1280.mp4` (gitignored,
regenerable from `public/media/hero.mp4`). Merged: `main` was fast-forwarded to `media` on 2026-10-17 after the owner reviewed the hero, so both branches serve
the finished v2 hero. The method for the remaining assets is written up in `docs/MEDIA_PLAYBOOK.md`; the Desktop backup
(`~/Desktop/shelby-hero-backup/`, with a README) holds the raw and 4k clips, the 4k master, the delivered files and the
keyframes.

## 11. Hero sharpness pass — shootout, override, delivered (2026-10-18)

The owner found the hero soft and waxy at 100%, so the raw Kling clip 1 was re-upscaled through the fal connector by
Starlight Precise 2.6, Starlight HQ, Astra 2 (creativity 0.3) and SeedVR2, and measured against the current hero with
`scripts/hero-upscale-shootout.mjs` (detail, calibrated temporal coherence and 4-frame pulse, edge/SSIM fidelity, colour).
No candidate was both stable and sharper on every crop. Precise 2.6 had real stone, mortar and shingle detail (3.7×) but
boiled on brick and stone. HQ passed every stability, fidelity and colour bar (1.6× on average) but smeared one
mid-distance brick wall below today's level. Astra invented architecture, and SeedVR2 boiled slightly and was softer in
places. Per the brief's stop rule the current hero stays; nothing in `public/media/` or the master changed. Spend ≈ USD
7.37 on fal (rate-based estimate; exact charges in the fal dashboard). Details, request IDs and the full table:
`docs/HERO_RESUME.md` "Sharpness pass"; sheet `docs/screenshots/hero-upscale/shootout.jpg`.

**Owner override, same day: Starlight Precise 2.6 delivered.** All three raw clips through
Starlight Precise 2.6, colour-matched to the raw clips (ΔE 0.66 → 0.04), strict architecture check passed on all three,
identical stitch, the recorded remap plan (350 frames), the same grade and grain → 3884 master (CRF 12) → 3840×2160
H.264 CRF 20 (105.5 MB, after the Safari finding below) + VP9 CRF 26 (100.3 MB) + first-frame poster; the previous file is kept as
`public/media/hero.v2-prev.mp4`. Sharper on every before/after crop (1.37–4.60× delivered, 1.10–3.18× grain-free); seams
in the old range; tsc, lint, 59 tests, `test:loop`, `verify-media`, contrast all pass. The first encode stopped before the commit
for two reasons: real Safari presented only 7–14 fps on the 103 Mb/s CRF 16 stream, and the whole-loop shimmer check
showed a stronger 4-frame sharpness pulse than the accepted clip 1 level at 5.5–7.7 s, 9.2–10.1 s and 11.5–13.0 s. The
owner accepted the shimmer after a 100% review clip and chose CRF 20: Safari 23.7 fps, Chrome 23.9 fps with no hitch,
Playwright engines full rate; the only remaining hitch is a ~110–170 ms hold at the loop wrap in Safari/WebKit/Chromium
(4k only). Total fal spend for the
pass ≈ USD 9.99. Details: `docs/HERO_RESUME.md` "Owner override".

**State (save point).** Done and committed on `media` as `6246330`; `main` does not have it yet. Open issue at the time: the
4k loop-wrap hold (~110–170 ms in Safari, WebKit and Chromium; Chrome is clean; re-encoding does not fix it), fixed the same
day by the double-buffered loop (section 12). Deployment (later): Git LFS for the >100 MB hero files and a ~15–25 MB mobile encode. All of it,
with the measurements and how to test: `docs/HERO_RESUME.md` (Status, "Next task", "Deployment notes").

## 12. Hero loop-wrap hold — fixed with a double-buffered loop (2026-10-18)

With the 3840×2160 file, the native `loop` held the last frame at every wrap while the one decoder sought back to frame
0. `SmartVideo` now loops the hero (and only the hero, `seamless`) through two stacked `<video>` elements on the
same source, with no `loop` attribute:
- The back element waits paused on frame 0, already decoded. requestVideoFrameCallback on the front times the swap to
  the moment its last frame has had a full frame on screen, and the back element is raised with no crossfade.
- The back element is started one measured start-up delay before the swap, still hidden: 40–60 ms in Safari and
  WebKit, about 0 in Chromium and Chrome.
- The finished element is rewound to 0 for the next wrap.
- The watchdog, visibility rules, MP4-first order, reduced-motion poster and single hero request at load all still
  hold.
- The video file, encode, motion and framing did not change; the 2560 fallback was not needed.

Measured on the real page, 10 consecutive wraps per engine (`node scripts/hero-wrap-check.mjs --seconds 150`). Each
figure is the longest frame interval at a wrap; the limit is 84 ms, two 24 fps frames.

| Engine | Before (native `loop`) | After (double buffer) | Dropped frames after | CPU / peak RSS before → after |
|---|---|---|---|---|
| Real Safari 27 | 132–152 ms | 50–67 ms | 0 of 3529 | 28% → 32% / 1679 → 2039 MB (all Safari processes) |
| Real Chrome | 67–83 ms | 50 ms | 0 of 3620 | 20% → 19% / 1430 → 1406 MB |
| Playwright WebKit | 133–208 ms | 50–67 ms | 2 of 3634 | 26% → 24% / 1218 → 1188 MB |
| Playwright Chromium | 117–150 ms | 50–67 ms | 2 of 3619 | 104% → 107% / 1237 → 1670 MB |

Shown frame rate is unchanged (Safari 23.68 → 23.69 fps, Chrome 23.96 → 24.00). Safari and WebKit's frame callbacks
show a 0.75 s cadence beat in some passes, before and after alike: Safari 12 → 42 two-frame steps, the same frame
positions both times, 0 dropped by the browser's count. `npm run test:loop` now fails on any wrap above 84 ms.
Verification after a clean restart (`.next` cleared): tsc clean; lint 0 errors (2 old warnings in the gitignored `.superpowers` probe tools); 59 unit tests; `npm run test:loop` 2 of 2 in 182 s with the new no-hold assertion (and, as a check of the check, 2 of 2 failing on the native `loop`: Chromium 133–167 ms, WebKit 133–166 ms); `node scripts/verify-media.mjs` all checks passed (console clean in all four sessions, only the hero requested at load, services 01→04→01, proof, reduced motion with no `<video>`); `node scripts/hero-playback-check.mjs --seconds 40` smooth in Chromium, WebKit and Chrome (2 wraps, no hitch over 100 ms, max frame gap 67–68 ms, first frame 0.22–0.39 s, 0–1 dropped); `node scripts/hero-contrast.mjs` unchanged (desktop worst H1 8.64, eyebrow 8.11, sub 7.63, phone 7.07); `node scripts/hero-shots.mjs` console clean, frames identical to `docs/screenshots/hero-4k/` apart from the moving trust marquee. Details, design and how to measure in real Safari:
`docs/HERO_RESUME.md` "Loop-wrap hold — fixed".

**State (save point, 2026-10-18).** The hero is COMPLETE. `main` was fast-forwarded to `de5bde4`, with no separate merge
commit. On `main` after a clean restart: tsc clean, lint 0 errors (the same 2 warnings in gitignored `.superpowers`
tools), 59 unit tests, `npm run test:loop` 2 of 2 in 184 s. Work is back on `media`. **Next task: the services and
proof media** (section 8 "Order", `docs/MEDIA_PLAYBOOK.md`).

## 13. Services v2 — COMPLETE, merged into `main` at `bcdf361` (2026-10-18)

Brief: `SERVICES_BRIEF.md` (one pass, no gates). Ledger with every id, ruling and number:
`docs/superpowers/plans/2026-10-18-services-ledger.md`. Method and lessons: `docs/MEDIA_PLAYBOOK.md` section 10.

**Assets.**
- Stills, Nano Banana Pro 4k (4096²). Roofing on the hero house: 7 references, the stone tower and charcoal roof carry over.
  Siding: navy wall; an edit turned the roof charcoal and a free local recolour fixed two leftover brown strips.
  Windows: an edit turned an autumn tree green and blanked garbled book lettering; three faint marks were filled locally.
- Clips, native 4K, 1:1, 5 s, first frame only, 2880×2880. Roofing and windows: Kling 3.0 Omni Frames 4k (Higgsfield).
  Siding: Kling v3 4K on fal, the same native 4K at USD 2.10 instead of 30 credits.
- Gutters: v1 kept (backup `assets-raw/svc-gutters.v1.mp4`), Starlight Precise 2.6 ×1.5 to 2160, colour-matched back
  to v1 (ΔE 0.76 → 0.03), regraded brighter and warmer (still a rain scene).
- Finishing, `scripts/svc-finish.sh`: 2160 → speed-up-only remap where Kling eased in → the hero grade plus a
  class-anchored match (`scripts/svc-grade.mjs`) → 0.5 s crossfade → grain `alls=5` → 2160² H.264 High CRF 18 +faststart
  (11.4–14.4 MB, 26–31 Mb/s) + VP9 CRF 18 + first-frame poster. Loops: roofing and gutters 4.54 s, windows 3.71 s,
  siding 3.12 s.

**Measured** (`scripts/svc-quality-check.mjs` on the grain-free masters; hero baselines from its grain-free graded master).

| Clip | Sharpness, 3 × 100% crops (hero shingle field 39.6) | Flicker ratio mean / worst (hero 0.284 / 0.537) | Pulse max (bar ±27%) | Straightness |
|---|---|---|---|---|
| Roofing | 221.7 / 164.6 / 82.6 (2.1–5.6×) | 0.034 / 0.116 | ±11.8% | in-focus courses: 2 segments over the strict bow bar (1.95 px on 685 px, 2.43 px on 385 px); straight at 100% |
| Siding | 91.6 / 110.5 / 142.6 (2.3–3.6×) | 0.014 / 0.030 | ±13.8% | long courses 0.004–0.03% bow; one gable course 0.26%; wobble 0.9–1.1 px = embossed-grain roughness |
| Windows | 613.3 / 670.3 / 636.6 (15–17×) | 0.032 / 0.069 | ±7.9% | all bars met (worst bow 0.17%, wobble ≤ 0.79 px) |
| Gutters | 1378 / 781 / 3688 (20–93×) | 0.007 / 0.020 | ±1.9% | bow ≤ 0.16%; wobble 0.83–0.93 px on the mesh-edged guard |

Colour (`node scripts/svc-grade.mjs … --report`: the same pixels before and after the correction, a*b* distance to the hero's
class mean): roofing neutral highlights 1.8 → 0.3 and sky 3.1 → 0.9; siding neutral highlights 4.5 → 0.4 but its sky
2.1 → 6.8 (the warming shift makes it a little less blue than the hero's); windows foliage 8.3 → 7.6 with no white-balance
anchor (its warm walls stay warm); gutters graded by hand. 0–0.4% clipped and ≤ 0.44% crushed on the new clips (hero
0.43% / 0.57%).

**Loop seam — accepted by the owner on review.** The wrap itself is an ordinary step (seam SSIM within 0.03 of a normal frame step), but
the brief's 0.5 s dissolve blends two different moments of a move that never returns: at the dissolve's midpoint the two
images sit a median 70 px apart on roofing (two hands and nailers), 19 px on siding (doubled windows, up to 64 px) and
147 px on windows (doubled frame and chairs); gutters 0 px. Kept per the brief and the playbook ruling that the dissolve is
"fine for short moves and for panels". Seamless alternative: locked camera + subject motion, first = last frame.

**Playback**, after a clean restart (`.next` cleared), all four clips on `SmartVideo seamless` (every clip had held a
frame above 84 ms at a native wrap in some engine: roofing 85.2, siding 84.4, gutters 101.3 ms in Chrome, windows 86 ms in
WebKit). `node scripts/svc-wrap-check.mjs`, 3–4 wraps per clip plus a 40 s scroll of the sticky section:

| Engine | Shown fps | Wraps | 40 s scroll |
|---|---|---|---|
| Real Safari | 23.85–23.98 | 48–53 ms; first wrap after activation 83 ms on siding and windows | 538 decoded, 0 dropped |
| Chrome (headed) | 23.97–24.17 | 48–52 ms | 748 decoded, 0 dropped |
| Chromium (headed) | 24.01–24.06 | 48.5–51.8 ms | 754 decoded, 0 dropped (2 dropped in roofing's wrap phase) |
| WebKit | 23.59–23.84 | 49–53 ms; first wrap after activation 83–85 ms | 253 decoded, 0 dropped |

The first wrap after a clip becomes active is uncalibrated: SmartVideo measures the start-up delay at 4 s of playback,
which a 3.1–4.5 s clip reaches too late or never (`CALIBRATE_AFTER_S`, a hero-era constant left unchanged; scaling it to
the clip's duration would fix it without touching the hero). **Fixed on 2026-10-18 at `9a762e7` (section 15).** Headless Chromium and Chrome skip frames once several 2160²
clips are loaded (15–18 fps, the same at 1800²); headed Chrome does not, so the 1800 fallback was not kept.

**Verification.** `npx tsc --noEmit` clean; `npm run lint` 0 errors (the 2 old warnings in gitignored `.superpowers`
tools); `npx vitest run` 59 passing; `node scripts/svc-verify.mjs` all checks passed (sticky panel 01→04→01 on the right
2160² clip, mobile 390 own clip playing and the others paused, console clean); `npm run test:loop` 2 of 2 (182 s);
`node scripts/verify-media.mjs` all checks passed. **The hero is untouched** and passes `node scripts/hero-wrap-check.mjs
--seconds 150`: 10 wraps per engine, worst 66.7 ms (Chromium), 63 ms (WebKit), 66.7 ms (Chrome), 52 ms (real Safari), limit
84 ms; Safari and WebKit show 31–47 two-frame steps outside the wraps, the cadence beat documented in `docs/HERO_RESUME.md`.
Screenshots: `docs/screenshots/services-v2/` (1440: `desktop-{down,up}-0N-*.jpg`; 390: `mobile-0N-*.jpg`); quality sheet
`docs/screenshots/services-v2/quality-sheet.jpg`.

**Spend.** Higgsfield 92.00 credits (stills 20, edits 12, two 4k clips 60), balance 98.61 → **6.61**. fal ≈ USD 3.41
(siding clip 2.10 + gutters Starlight ≈ 1.31, rate-based). No asset hit the 3-attempt limit; every clip is attempt 1.

**Files.** Masters `assets-raw/svc-<name>.mp4` (v1: `svc-<name>.v1.mp4`); stills `assets-raw/stills/svc-<name>.v2.*`;
raw clips, Starlight output, grain-free masters and still candidates in `assets-raw/originals/` (gitignored); delivered
`public/media/<name>.{mp4,webm}` + `<name>-poster.jpg` (v1 kept as `<name>.v1.*`). Review copies (1280, three loops):
`.superpowers/sdd/SERVICES_BRIEF/review/final/`. Desktop backup: `~/Desktop/shelby-hero-backup/services-v2/`.

**Merged.** The owner reviewed the clips and approved them; `main` was fast-forwarded from `de5bde4` to `bcdf361` (no
merge commit). On `main` after a clean restart (`.next` cleared): `npx tsc --noEmit` clean; `npm run lint` 0 errors (the
2 old warnings in gitignored `.superpowers` tools); `npx vitest run` 59 passing; `npm run test:loop` 2 of 2 in 182.6 s
(Chromium and WebKit, including the hero's no-hold assertion at the wrap). Work is back on `media`. **Next task: the
proof section.**

## 14. Proof v2 — COMPLETE, merged into `main` at `4dfed23` (2026-10-18)

Brief: `PROOF_BRIEF.md` (one pass, fal only). Ledger with every request id, prompt, ruling and number:
`docs/superpowers/plans/2026-10-18-proof-ledger.md`. Method and lessons: `docs/MEDIA_PLAYBOOK.md` section 11.

**Concept as built.** One continuous push along a roof: Clip D (storm-damaged, after-storm light) → a 0.71 s in-place
dissolve centred on the shared frame → Clip F (brand-new charcoal shingles, golden sun) → 0.5 s fade to `--ink` → a
0.25 s fade in → loop. 211 frames, 8.79 s (the brief targeted ~10–11 s; the speed-matching remap shortened it).

**Assets (fal).**
- D0: Nano Banana Pro 4K edit of the Gemini reference's first frame; attempt 2 (a cleanup edit) removed claw-like
  streaks on the underlayment and garbled marks on the gutter.
- Clip D: Kling v3 4K from D0 (3856×2148, 121 frames), attempt 1.
- D_last: Clip D's last frame. **F0: edit of D_last, 3 attempts, kept at the limit.** D_last shows only shingle courses
  (Clip D drifted off the gutter), so every edit re-laid the courses; the best (attempt 3 c1) is 6 px off (median).
- Clip F: Kling v3 4K from F0, attempt 1.

**Finishing** (`scripts/proof-finish.sh`): 3840×2160 → speed-up-only remap on measured camera displacement
(`scripts/proof-remap.mjs`; seam pace 24% apart → 7.5%) → grades (D moody and clear, F the hero's warm grade with the
mauve cast removed so the shingles read charcoal) → the in-place dissolve (`scripts/proof-seam-blend.mjs`: each clip
extended past the seam along the other's measured motion, so the two layers stay registered while the camera moves) →
fades → grain → `assets-raw/proof/proof-master-4k.mp4`. Delivery: 2560×1440 H.264 High CRF 18 25.0 MB + VP9 20.1 MB +
poster (frame 6, after the fade-in); slider stills 3840 JPG + WebP from the graded seam frames.

**Measured** (grain-free graded clips; hero shingle baseline 39.6, hero flicker 0.284).

| | Sharpness (3 crops) | Flicker mean / worst | Pulse max | Seam / speed |
|---|---|---|---|---|
| Clip D | 54.9 / 80.0 / 92.2 (1.4–2.3×) | 0.044 / 0.089 | ±14.9% | pace spread 2.35× → 1.24× |
| Clip F | 203.0 / 324.8 / 414.2 (5.1–10.5×) | 0.041 / 0.084 | ±9.5% | pace spread 1.36× → 1.20× |
| Seam | courses median 6 px, p90 14 px (bar: a few px) **— missed, recorded** | | | pace D 3.58 vs F 3.31 px/frame |

**Component.** `Proof.tsx`: a BEFORE/AFTER eyebrow label (accent rule, `--ink` scrim, 0.3 s cross-fade) in the frame's
top-left, switched at `proofMorphSwitchAt` (4.0 s, `src/content/media.ts`) from the front video's `currentTime`.
`proofMorph` now loops through the double buffer (`seamless: true`).

**Playback**, after a clean restart: native wraps were 85–86 ms in real Safari and WebKit, so the clip went seamless;
then every wrap 49–53 ms in real Safari, real Chrome, WebKit and Chromium, 23.97–24.04 fps, 0 dropped frames.

**Verification.** `node scripts/proof-verify.mjs` (label through 3 loops, 1440 and 390 shots, reduced motion, console),
slider mode, `node scripts/verify-media.mjs`, tsc, lint (0 errors), 59 unit tests, `npm run test:loop` (2 of 2):
all pass. Hero untouched (no hero file changed) and `node scripts/hero-wrap-check.mjs --seconds 150` passes, 10 wraps per engine: Chromium 50–66.7 ms, WebKit 49–57, Chrome 50–66.7, real Safari 50–54 (limit 84). A first run taken while other work was running had one 133 ms Chromium wrap and a hidden Safari window; Chromium and Safari were re-run idle. Services untouched (no services file changed).
Screenshots and quality sheet: `docs/screenshots/proof-v2/`. Review copy (1280, three loops):
`.superpowers/sdd/PROOF_BRIEF/review/proof-v2-review-1280.mp4`. Desktop backup: `~/Desktop/shelby-hero-backup/proof-v2/`.

**Spend.** fal ≈ USD 7.80 (two Kling 4K clips 4.20 + twelve Nano Banana Pro 4K images ≈ 3.60; 6.00 at the flat API rate).
Higgsfield: none.

**Merged.** The owner reviewed the proof and approved it as delivered (seam offset accepted, no retake); `main` was
fast-forwarded from `782c1d2` to `4dfed23` (no merge commit). On `main` after a clean restart (`.next` cleared):
`npx tsc --noEmit` clean; `npm run lint` 0 errors (the 2 old warnings in gitignored `.superpowers` tools); `npx vitest run`
59 passing; `npm run test:loop` 2 of 2 in 182.5 s (the hero, Chromium and WebKit, no hold above 84 ms).
- Proof wraps (`node scripts/hero-wrap-check.mjs --section "#proof" --seconds 45 --headed true`), 5 wraps per engine:
  Chromium 50.0–51.9 ms, WebKit 49–52, Chrome 48.3–52, real Safari 50–52 (limit 84); 23.97–24.07 fps; 0 dropped.
- Services wraps (`node scripts/svc-wrap-check.mjs --headed true`, 3–4 wraps per clip): Chromium 49.9–50.9 ms, Chrome
  48–52 ms, WebKit 48–84 ms, all PASS; real Safari roofing 50–53, gutters 50, siding 50–84, **windows 85 ms on its first
  wrap after activation** (then 50–51). A Safari re-run of siding and windows: siding 83, **100**, 51, 51; windows 84, 52, 50,
  50. Scroll phase: 0–1 dropped of 522–863 decoded per engine. This is the pre-existing first-wrap calibration case (section
  13), not a change from this merge; fixed afterwards at `9a762e7` (section 15).
- All media sections are done: hero (sections 9–12), services (13), proof (14).

## 15. Safari first-wrap fix — merged into `main` at `9a762e7` (2026-10-18)

**Root cause.** `SmartVideo`'s double-buffered loop loaded its back element at 2 s and measured `play()`'s start-up
delay at 4 s of playback, points sized for the 14.6 s hero. The 3.1–3.7 s service clips (siding, windows) never reached
4 s, so their first swap started the back element cold: the start-up delay showed as a hold (WebKit 82–84 ms, real Safari
83–100 ms). The 4.5 s clips (roofing, gutters) did reach 4 s, but the calibration probes were still running at the wrap,
so the swap fell back to restarting the front from 0 (83–99 ms in WebKit). Found with an opt-in trace in `SmartVideo`
(`window.__loopDebug`) that records back loads, probes, timed starts and each swap's state.

**Fix** (`src/components/ui/SmartVideo.tsx`): both points are capped at a share of the clip's duration, so the back
element loads a quarter of the way through the first pass and is calibrated halfway (`BACK_LOAD_SHARE` 0.25,
`CALIBRATE_SHARE` 0.5). Siding: load 0.78 s, calibrate 1.56 s, swap armed at 2.63 s; windows 0.93 / 1.85 / 3.21 s;
roofing and gutters 1.14 / 2.27 / 4.04 s. The hero (14.6 s) and the proof (8.8 s) compute to the old 2 s / 4 s, so
their behaviour is unchanged. No video file changed.

**Test.** `node scripts/svc-wrap-check.mjs --fresh-runs 3 --headed true` (new option): for each clip, three times,
reload the page, scroll the clip's block into view and measure every wrap from its first frame, including the first wrap
after scroll-in; it prints how each swap ran (`pre` = calibrated and started early).

**First wrap after scroll-in, siding and windows, real Safari:**

| Clip | Before (`main` at `4dfed23`, the wrap check after first activation) | After (3 fresh scroll-ins, all wraps) |
|---|---|---|
| Siding | 84 ms; re-run 83 ms, then **100 ms** on the second wrap | 51 / 50 / 50 ms (all wraps 50–51) |
| Windows | **85 ms**; re-run 84 ms | 50 / 50 / 50 ms (all wraps 50) |

The Safari "before" is the measurement from the `main` verification (section 14); a fresh-scroll-in Safari run on the
old code was not possible at the time (the Safari window was hidden). Same-protocol baseline in Playwright WebKit, old
code: siding and windows first wraps 82–84 ms in all 6 runs (every first swap cold and uncalibrated), roofing 99 / 51 /
84 ms and gutters 50 / 50 / 83 ms (3 of 6 a fallback restart).

**After, all four browsers** (after a clean restart, `.next` cleared; 3 fresh scroll-ins per clip, 12 s each):
- Real Safari: every wrap 49–51 ms, first wraps 49–51 ms, all 30 swaps pre-started; 40 s scroll 0 dropped of 977, worst
  gap 67 ms.
- Chrome (headed): every wrap 49–67 ms, first wraps 49.5–50.7 ms; scroll 1 dropped of 896 (the same as before the fix).
- Chromium (headed): every wrap 49–51 ms, first wraps 49.1–51.1 ms; scroll 1 dropped of 896 (the same as before).
- WebKit (headed): every wrap 49–52 ms, first wraps 49–51 ms; scroll 0 dropped of 984.

**Hero and proof still pass.** `node scripts/hero-wrap-check.mjs --seconds 150` (10 wraps each): Chromium 49.9–66.7 ms,
WebKit 49–59, Chrome 49.9–66.7, real Safari 49–66; 0 dropped in all four. Proof (`--section "#proof"
--seconds 45 --headed true`, 5 wraps each): 49.1–51 ms in all four, 0 dropped. `npx tsc --noEmit` clean; `npm run lint`
0 errors (the 2 old warnings in gitignored tools); `npx vitest run` 59 passing; `npm run test:loop` 2 of 2 in 182.1 s.
Raw runs: `.superpowers/sdd/FIRSTWRAP/` (gitignored).

## 16. Verbatim Google reviews (2026-10-18)

`src/content/reviews.ts` now holds three real Google reviews, copied verbatim from the request (wording, spelling and
punctuation untouched, including Greg H.'s review ending without a full stop): Jacob S., Felicia W. and Greg H., all 5 stars,
first name and last initial, no city. Multi-paragraph reviews keep their paragraph breaks: each paragraph is a string
joined with a blank line, rendered with `white-space: pre-line`.

**Long reviews.** Every card clamps its text to six lines (`line-clamp-6`) and shows a **Read more** toggle only
when the clamped text actually overflows (measured with a ResizeObserver, so it reacts to width). Expanding shows the
whole review; nothing is cut. The toggle is a real `<button>` with `aria-expanded` and `aria-controls`, Barlow
Condensed uppercase with an accent chevron that flips. Toggling refreshes ScrollTrigger (the page height changes), and
collapsing a card whose top has scrolled above the header scrolls it back to 96 px below the top (through Lenis when
active). In the 3-column grid an expanded card stretches its row; the others keep the name pinned to the bottom.

**Verified** (Playwright, 1440×900 and 390×844, dev server): at both widths all three cards clamp (349 / 348 px tall)
with Read more; expanding card 1 removes the overflow (1233 px at 1440, 1564 px at 390) with `aria-expanded="true"` and
Read less; collapsing returns its top to 96 px. Console clean (no errors, no hydration warnings). Screenshots:
`docs/screenshots/reviews/`. `npx tsc --noEmit` clean; `npm run lint` 0 errors (the 2 old warnings in gitignored
tools); `npx vitest run` 59 passing.

**Rating.** Confirmed on the Google Business Profile on 2026-10-18: 4.7 from 195 Google reviews. `site.rating` is now
`{ value: 4.7, count: 195, source: "Google", verified: true }` (the TODO comment is gone), and `src/content/site.test.ts`
asserts it (the updated test failed against the old 130 / unverified values first, then passed). The trust bar, the reviews
summary and the chat system prompt all read it from `site.ts`. Verified at 1440 and 390: "195 Google Reviews" in the
trust bar and the reviews summary, no "130" left on the page, console clean (`docs/screenshots/reviews/rating-*.png`).
`npx tsc --noEmit` clean; `npm run lint` 0 errors; `npx vitest run` 59 passing.


## 17. Chatbot replaced with Chatling (2026-10-19)

The in-house "Shelby Assistant" (FAB, panel, `POST /api/chat`, Haiku + `capture_lead`, scripted fallback, leads store)
is removed, along with its tests, `site.chat` copy, FAB/typing CSS, `@anthropic-ai/sdk` and `.env.local.example`.
Sections 1–16 above describe the old widget and are kept as history. The Chatling embed (chatbot ID `2823318974`) loads
once from `src/app/layout.tsx` via two `next/script` tags (`afterInteractive`): `chtl-config` sets `window.chtlConfig`,
then `chtl-script` loads `https://chatling.ai/js/embed.js` with `data-id`. "Check Financing Options" now calls
`window.Chatling.open()` (`src/lib/chatling.ts`). The bubble is 55 px with a 20 px inset at bottom-right; nothing
else on the page is fixed to the bottom, and the desktop trust row's 80 px right reserve still clears it (last badge
ends at x 1288, bubble starts at 1365 at 1440). Verified in the dev server at 1440×900 and 375×812: one embed script,
bubble opens (full-screen panel on phones), financing CTA opens it, no horizontal overflow, console clean.
`npx tsc --noEmit` clean; `npx eslint src` clean; `npx vitest run` 21 passing in 4 files.
