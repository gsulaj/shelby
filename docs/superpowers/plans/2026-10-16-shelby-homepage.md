# Shelby Construction Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A local-only, cinematic, desktop-first one-page pitch site for Shelby Construction Services with a streaming AI "Shelby Assistant" chatbot that never breaks (scripted fallback), built in six phases with a visual checkpoint after Phase 1.

**Architecture:** Next.js 16 App Router with a single server-rendered `page.tsx` that composes client section components. All copy comes from `src/content/site.ts`; all media paths come from `src/content/media.ts`, and a server-only resolver checks which files exist so components render labeled placeholders until media is dropped in. Motion is GSAP (`useGSAP`, ScrollTrigger, SplitText masks) over Lenis smooth scroll, both disabled under `prefers-reduced-motion`. The chatbot is a Node route (`/api/chat`) that streams NDJSON events from `claude-haiku-5-5` with a `capture_lead` tool; the client silently switches to a pure state machine when the route is unavailable.

**Tech Stack:** Next.js 16.4 (TS, `src/`, Turbopack), Tailwind CSS 4.3 (`@theme inline` tokens), GSAP 3.15 + `@gsap/react` 2.1, Lenis 1.3, `lucide-react`, `next/font` (Barlow Condensed 600/700, Inter 400/500/600), `@anthropic-ai/sdk` 0.135, `sharp`, Vitest 5 (logic tests only), Playwright 1.64 (screenshots), ffmpeg via system binary or `ffmpeg-static`.

**Spec:** `BUILD_SPEC.md` (what) and `CLAUDE.md` (how). Both travel with this plan; read them first.

## Revision log

- 2026-10-16, after the Phase 1 checkpoint: accent is the logo blue `#00AEEF` / hover `#14B4F0` (tokens `--accent` / `--accent-hover`, Tailwind `accent` / `accent-hover`); header is borderless with a masked gradient veil and auto-hide; placeholder label is a bottom-right tag; mobile eyebrow uses the short form; mobile trust bar is a marquee; hero fade starts at 50% and floors at 0.3 opacity.

## Global Constraints

- Node 25 / npm 11; versions pinned at install time: `next@16.4.2`, `tailwindcss@4.3.3`, `gsap@3.15.0`, `@gsap/react@2.1.2`, `lenis@1.3.27`, `lucide-react@0.558+`, `@anthropic-ai/sdk@0.135.0`, `sharp@0.35.5`, `vitest@5.0.5`, `playwright@1.64.1`.
- Color tokens on `:root`, exactly: `--ink #0F1216`, `--slate #1A1F26`, `--slate-raised #232A33`, `--bone #F5F4F1`, `--bone-raised #FFFFFF`, `--rule-dark #2E3640`, `--rule-light #D9D6CF`, `--text-on-dark #ECEAE6`, `--muted-on-dark #9AA3AE`, `--text-on-light #1A1F26`, `--muted-on-light #5B6470`, `--accent #B8612A`, `--accent-hover #CE7438`. Default Tailwind palette is disabled (`--color-*: initial`) so only these exist.
- Accent ≤ ~5% of any viewport: primary buttons, chat FAB, active states, eyebrow tick, active service index only.
- `border-radius: 0` everywhere (inputs ≤ 2px). No drop shadows. 1px `--rule-*` dividers.
- Headlines: Barlow Condensed 700, uppercase, `letter-spacing: .02em`, line-height 0.95–1.05; hero H1 `clamp(3rem, 6vw, 6.5rem)`. Eyebrows: Barlow Condensed 600, uppercase, `.18em` tracking, 13–14px, 24×1px accent rule before. Body: Inter 17–18px, line-height 1.6, max ~62ch. Numbers: Barlow Condensed `tabular-nums`.
- Motion: `power3.out` reveals, `power2.inOut` crossfades, 0.6–1.0s, masked line reveals. Under `prefers-reduced-motion`: no Lenis, no scroll animation, content visible, videos show posters only.
- Every copy string lives in `src/content/site.ts`; `[PITCH COPY]` strings carry `// PITCH COPY`; rating keeps `verified: false` with `// TODO: confirm on Google Business Profile`; `reviews.ts` holds placeholders only. No invented facts, awards, prices, reviews. No recreated brand logos (typographic badges). Root `logo.png` is never modified.
- Only the hero `<video>` has `preload="auto"`; all others `preload="none"`. Every video: `muted autoPlay loop playsInline`, `object-fit: cover`, poster, `<source>` WebM then MP4, play only when visible.
- One `<h1>`. Visible accent `:focus-visible` rings. AA contrast on text over video.
- Desktop-first (1440×900) but 390×844 must be presentable.
- Secrets: `ANTHROPIC_API_KEY` in `.env.local` only; `.env.local.example` ships with an empty value; `.gitignore` includes `.env*.local` and `/data/`. The key is never logged or sent to the client.
- Chat: model `claude-haiku-5-5`, streaming, `max_tokens: 400`, 30-turn cap, input length caps. The demo must never show an error.
- Environment note (2026-10-16): system `git`, `python3`, and Homebrew are blocked until the user runs `sudo xcodebuild -license accept`. Commit steps are executed only once `git --version` works; until then, skip them and continue.

## Review Focus

1. **Phone pasted with a country code or punctuation** (`+1 (586) 555-0123`, `586.555.0123`, `15865550123`) must format to `(586) 555-0123` and validate; 9 digits or 11 digits not starting with 1 must fail. Test in Task 19.
2. **Off-script question mid scripted flow** (`how much is a roof?` while being asked for the city) must answer with the published roofing range and re-ask the pending question without advancing. Test in Task 26.
3. **`capture_lead` input with loose types** (`storm_or_insurance: true`, `email: ""`, phone `586.555.0123`) must normalize to a valid `Lead`; a missing required field must produce `ok: false` and never a 500. Test in Task 23.
4. **Chat request over the caps** (31+ user turns, a 5,000-character message, 61 messages) must return the phone-number pointer or a 400 JSON without calling the API. Test in Task 25.
5. **Service preselect repeated** (`Get a Roofing Estimate` clicked twice, or after the user changed the select) must set the select to Roofing every time; the store exposes an incrementing `requestId`. Test in Task 10.

---

## File Structure

| Path | Responsibility |
|---|---|
| `src/app/layout.tsx` | Fonts (`next/font`), metadata, `<SmoothScroll />`, `<ChatWidget />` (Phase 5) |
| `src/app/page.tsx` | Server component: `resolveMedia()` then sections in spec order |
| `src/app/globals.css` | Tokens on `:root`, `@theme inline` mapping, base typography, `.blueprint` texture, type-scale utilities |
| `src/app/api/chat/route.ts` | Thin Node route calling `handleChat` |
| `src/content/site.ts` / `media.ts` / `reviews.ts` | Business facts and copy / media manifest / review placeholders |
| `src/lib/media/resolve.ts` | Server-only: checks `public/media` for each manifest file |
| `src/lib/motion/gsap.ts` | Registers `useGSAP`, ScrollTrigger, SplitText once; exports `EASE`, `MOTION_OK`, `revealLines()` |
| `src/lib/motion/reduced-motion.ts` | `prefersReducedMotion()` and `usePrefersReducedMotion()` |
| `src/lib/scroll.ts` | Lenis singleton + `scrollToId()` |
| `src/lib/estimate-intent.ts` | Shared client store for service preselect |
| `src/lib/forms/phone.ts` / `validate.ts` | US phone formatting/validation; estimate form validation |
| `src/lib/chat/protocol.ts` / `lead.ts` / `system-prompt.ts` / `tools.ts` / `leads-store.ts` / `handler.ts` / `scripted-flow.ts` / `client.ts` / `chat-store.ts` | Chat event types / lead parsing / prompt / tool schema / JSON persistence / route logic / fallback state machine / fetch+fallback / open-close store |
| `src/components/layout/Header.tsx` / `Footer.tsx` / `SmoothScroll.tsx` | Sticky header / footer / Lenis+GSAP ticker |
| `src/components/sections/Hero.tsx`, `Standard.tsx`, `Services.tsx`, `Proof.tsx`, `Reviews.tsx`, `Process.tsx`, `Pricing.tsx`, `Estimate.tsx` | One file per page section |
| `src/components/ui/Button.tsx`, `Eyebrow.tsx`, `MediaPlaceholder.tsx`, `SmartVideo.tsx`, `CompareSlider.tsx`, `EstimateForm.tsx` | Reusable UI |
| `src/components/chat/ChatWidget.tsx`, `ChatFab.tsx`, `ChatPanel.tsx`, `MessageList.tsx`, `LeadCard.tsx`, `QuickReplies.tsx` | Chatbot UI |
| `scripts/process-media.sh`, `make-logo-variant.mjs`, `screenshot.mjs` | Media pipeline / logo light variant / Playwright screenshots |
| `public/brand/logo.png`, `logo-light.png`; `public/media/`; `assets-raw/` | Brand assets / processed media / raw drop folder |
| `docs/screenshots/phase-N/` | Verification screenshots per phase |

Tests are co-located as `*.test.ts` next to the module (Vitest, `environment: node`).

---

# Phase 1 — Foundation, header, hero (stop for approval)

### Task 1: Scaffold, dependencies, project config

**Files:**
- Create (via `create-next-app` in a scratch dir, then copied in): `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`, `src/app/*`, `public/*`
- Create: `.env.local.example`, `vitest.config.ts`, `assets-raw/README.md`, `public/media/.gitkeep`, `data/.gitkeep`
- Modify: `.gitignore` (add `.env*.local`, `/data/`, `/docs/screenshots/*.png` stays tracked)

**Interfaces:**
- Produces: npm scripts `dev`, `build`, `lint`, `test` (`vitest run`), `media` (`bash scripts/process-media.sh`), `logo` (`node scripts/make-logo-variant.mjs`), `shots` (`node scripts/screenshot.mjs`). Path alias `@/*` → `src/*` in both tsconfig and Vitest.

- [ ] **Step 1:** Run `npx create-next-app@16.4.2 shelby-scaffold --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes --disable-git --no-agent-feedback` in the scratchpad, then `rsync -a` the result into the project root (root already holds `CLAUDE.md`, `BUILD_SPEC.md`, `logo.png`, `docs/`).
- [ ] **Step 2:** `npm i gsap @gsap/react lenis lucide-react @anthropic-ai/sdk server-only sharp` and `npm i -D vitest playwright ffmpeg-static`; then `npx playwright install chromium`.
- [ ] **Step 3:** Write `vitest.config.ts` (`test.environment: "node"`, `test.include: ["src/**/*.test.ts", "scripts/**/*.test.ts"]`, `resolve.alias["@"] = ./src`). Add the scripts above to `package.json`. Write `.env.local.example` containing `ANTHROPIC_API_KEY=`. Append `.env*.local` and `/data/` to `.gitignore`.
- [ ] **Step 4:** Verify: `npm run dev` serves `http://localhost:3000` with the default page; `npx vitest run` reports "No test files found" without error.
- [ ] **Step 5:** Commit `chore: scaffold Next.js app and tooling` (skip if git is blocked).

### Task 2: Content files

**Files:**
- Create: `src/content/site.ts`, `src/content/media.ts`, `src/content/reviews.ts`
- Test: `src/content/site.test.ts`

**Interfaces:**
- Produces from `site.ts`:
  - `type ServiceOption = "Roofing" | "Windows" | "Siding" | "Insulation" | "Gutters & Gutter Protection"`; `SERVICE_OPTIONS: readonly ServiceOption[]` in that order.
  - `site` (`as const`) with: `name`, `phone: { display: "833-6-SHELBY", href: "tel:+18336743529" }`, `email`, `address: { street, city, state, zip, full }`, `hours: { display: "Mon–Sun, 7am–9pm", short: "7am–9pm, 7 days" }`, `story: { short, long }`, `tagline`, `credentials: string[]` (six, verbatim from spec §0), `rating: { value: 4.7, count: 130, source: "Google", verified: false }` with the TODO comment, `services: [{ key: "roofing" | "siding" | "windows" | "gutters", index: "01"…"04", name, body, cta, formValue: ServiceOption }]` using spec §2.4 copy verbatim, `insulation: { label: "ALSO: ATTIC INSULATION.", body: "Keep the heat you're paying for.", cta: "Get an Insulation Estimate", formValue: "Insulation" }`, `serviceAreas: { macomb: string[], oakland: string[], other: ["St. Clair County", "Grosse Pointe"] }`, `pricing: { items: [{ key: "roof" | "windows" | "siding", name, range, average, unit? }], disclaimer }`, `offer: { headline: "$0 DOWN. LOW MONTHLY PAYMENTS.", line, footnote, promoTerms }`, and per-section copy objects `hero`, `standard`, `proof`, `reviews`, `process`, `pricingSection`, `estimate`, `footer`, `chat` (opening message, five chips, financing opener, `limitReached` text pointing to the phone), each string copied verbatim from spec §2–§3 and `// PITCH COPY` comments on tagged lines.
- Produces from `media.ts`:
  - `type MediaKey = "hero" | "roofing" | "siding" | "windows" | "gutters" | "proofBefore" | "proofAfter" | "proofMorph"`
  - `type MediaEntry = { kind: "video" | "image"; file: string; raw: string; aspect: string; label: string }`
  - `media: Record<MediaKey, MediaEntry>` with `file` values `hero`, `roofing`, `siding`, `windows`, `gutters`, `proof-before`, `proof-after`, `proof-morph`; `raw` values exactly the spec §1 filenames; `aspect` `"16 / 9"` or `"1 / 1"`.
  - `proofMode: "video" | "slider"` (default `"video"`).
  - `videoPaths(file: string): { webm: string; mp4: string; poster: string }` → `/media/<file>.webm`, `.mp4`, `-poster.jpg`; `imagePaths(file: string): { jpg: string; webp: string }`.
- Produces from `reviews.ts`: `type Review = { name: string; city?: string; rating: number; text: string }`; `reviews: Review[]` of three entries `{ name: "[First L.]", rating: 5, text: "[PASTE VERBATIM REVIEW TEXT]" }` under a top-of-file comment requiring verbatim Google copy and forbidding invented or edited text.

- [ ] **Step 1:** Write `site.test.ts`: `phone.href === "tel:+18336743529"`, `rating.verified === false`, `SERVICE_OPTIONS` deep-equals the five spec values in order, `services.map(s => s.formValue)` equals `["Roofing","Siding","Windows","Gutters & Gutter Protection"]`, every `services[i].cta` ends with `"Estimate"`.
- [ ] **Step 2:** Run `npx vitest run src/content` → FAIL (module not found).
- [ ] **Step 3:** Write the three content files.
- [ ] **Step 4:** Run `npx vitest run src/content` → PASS.
- [ ] **Step 5:** Commit `feat: seed site content, media manifest, review placeholders`.

### Task 3: Design system (tokens, fonts, base styles, Button, Eyebrow)

**Files:**
- Modify: `src/app/globals.css`, `src/app/layout.tsx`
- Create: `src/components/ui/Button.tsx`, `src/components/ui/Eyebrow.tsx`, `src/lib/cn.ts`

**Interfaces:**
- `globals.css`: `@import "tailwindcss"`; tokens on `:root`; `@theme { --color-*: initial; }` then `@theme inline` exposing `--color-ink`, `--color-slate`, `--color-slate-raised`, `--color-bone`, `--color-bone-raised`, `--color-rule-dark`, `--color-rule-light`, `--color-on-dark`, `--color-muted-on-dark`, `--color-on-light`, `--color-muted-on-light`, `--color-accent`, `--color-accent-hover`, `--color-white`, `--color-black`, `--font-display: var(--font-barlow-condensed)`, `--font-body: var(--font-inter)`. Base layer: `html` bg ink, body Inter 17px/1.6, `h1–h3` display settings, `:focus-visible` 2px accent outline offset 3px, form controls radius 0. Component classes: `.wrap` (max-width 1440px, `padding-inline: clamp(1.5rem, 5vw, 4.5rem)`), `.blueprint` (48px grid lines at 4% via two `linear-gradient`s on `::before`, `feTurbulence` grain as an inline SVG data URI at 3% on `::after`, both `pointer-events: none`), `.display-xl` (`clamp(3rem, 6vw, 6.5rem)`, lh .95), `.display-lg` (`clamp(2.5rem, 4.6vw, 4.75rem)`, lh 1), `.lede` (18px Inter, max-width 62ch), `.tnum`.
- `layout.tsx`: `Barlow_Condensed({ weight: ["600","700"], subsets: ["latin"], variable: "--font-barlow-condensed", display: "swap" })`, `Inter({ weight: ["400","500","600"], subsets: ["latin"], variable: "--font-inter", display: "swap" })`; both variable classes on `<html lang="en">`; metadata title `Shelby Construction Services — Expert Exterior Remodeling in Macomb County`.
- `Button`: `({ variant = "primary" | "ghost" | "dark", size = "lg" | "md", href?, onClick?, type?, arrow = true, className?, children })` renders `<a>` when `href` else `<button>`; base classes `group inline-flex h-14 items-center gap-3 px-7 font-display text-[15px] font-semibold uppercase tracking-[0.08em]`; primary `bg-accent text-ink hover:bg-accent-hover`; ghost `border border-accent text-on-dark hover:bg-accent hover:text-ink`; dark `bg-ink text-bone hover:bg-slate`; arrow is `lucide-react` `ArrowRight` with `group-hover:translate-x-1`. `size="md"` → `h-12 px-5`.
- `Eyebrow`: `({ tone = "dark" | "light", children, className? })` → `<p>` with a `24×1px` accent `<span aria-hidden>` then uppercase Barlow 600 13px `.18em` text in muted-on-dark/muted-on-light.
- `cn(...classes: (string | false | null | undefined)[]): string`.

- [ ] **Step 1:** Write `globals.css`, `layout.tsx`, `cn.ts`, `Button.tsx`, `Eyebrow.tsx`.
- [ ] **Step 2:** Verify: `npx tsc --noEmit` passes; `npm run dev` compiles with no console errors; `bg-ink`, `text-accent`, `font-display` utilities resolve (check the rendered CSS in the browser devtools or `curl` the page).
- [ ] **Step 3:** Commit `feat: premium industrial design tokens and base components`.

### Task 4: Logo copy and light variant

**Files:**
- Create: `scripts/make-logo-variant.mjs`, `public/brand/logo.png` (copy), `public/brand/logo-light.png` (generated)

**Interfaces:**
- `npm run logo`: copies root `logo.png` → `public/brand/logo.png` (never modifies the root file), reads raw RGBA with `sharp(...).ensureAlpha().raw().toBuffer({ resolveWithObject: true })`, prints `transparent pixels: N%`. If alpha min is > 0 across the image, print `SOLID BACKGROUND — stop and ask` and exit 2. Otherwise, for each pixel with alpha > 0 whose max(R,G,B) < 110 and (max−min) < 40 (the near-black wordmark), set RGB to bone `245,244,241`; blue and gray cube pixels stay; write `logo-light.png` via `sharp(buf, { raw })`.

- [ ] **Step 1:** Write the script and run `npm run logo`.
- [ ] **Step 2:** Verify: output exists at 291×100; open both PNGs and confirm "SHELBY" is bone while "CONSTRUCTION" stays blue. If the script exits 2, stop and tell the user (spec §1).
- [ ] **Step 3:** Commit `feat: brand logo and light variant`.

### Task 5: Media plumbing (resolver, placeholder, SmartVideo, process-media.sh)

**Files:**
- Create: `src/lib/media/resolve.ts`, `src/lib/motion/reduced-motion.ts`, `src/components/ui/MediaPlaceholder.tsx`, `src/components/ui/SmartVideo.tsx`, `scripts/process-media.sh`, `assets-raw/README.md`

**Interfaces:**
- `resolve.ts` (`import "server-only"`): `type ResolvedVideo = { kind: "video"; key: MediaKey; label: string; raw: string; aspect: string; available: boolean; webm: string; mp4: string; poster: string }`; `type ResolvedImage = { kind: "image"; …; jpg: string; webp: string }`; `type ResolvedMedia = { hero: ResolvedVideo; roofing: ResolvedVideo; siding: ResolvedVideo; windows: ResolvedVideo; gutters: ResolvedVideo; proofMorph: ResolvedVideo; proofBefore: ResolvedImage; proofAfter: ResolvedImage }`; `resolveMedia(): ResolvedMedia` using `fs.existsSync(path.join(process.cwd(), "public", mp4 | jpg))`.
- `reduced-motion.ts`: `prefersReducedMotion(): boolean` (false on the server); `usePrefersReducedMotion(): boolean` (state + `matchMedia` change listener, initial `false` to match SSR).
- `MediaPlaceholder`: `({ raw, aspect?, className?, fill?, labelOffset? })` → slate gradient + `.blueprint`; the filename sits in a small mono tag in the bottom-right corner (`labelOffset` nudges it clear of overlaid bars); no corner marks.
- `SmartVideo`: `({ media: ResolvedVideo; preload?: "auto" | "none" (default "none"); active?: boolean (default true); className?; fill?: boolean })`. Renders `MediaPlaceholder` when `!media.available`; poster `<img>` only when reduced motion; otherwise `<video muted autoPlay loop playsInline preload={preload} poster={media.poster}>` with `<source webm>` then `<source mp4>`, `object-cover`, and an `IntersectionObserver` (threshold 0.15) that plays when intersecting && `active`, pauses otherwise.
- `process-media.sh`: `set -euo pipefail`; `FFMPEG=${FFMPEG:-$(command -v ffmpeg || node -p "require('ffmpeg-static')")}`; maps raw → output name per the manifest (`hero-flyover.mp4→hero`, `svc-roofing.mp4→roofing`, `svc-siding.mp4→siding`, `svc-windows.mp4→windows`, `svc-gutters.mp4→gutters`, `proof-morph.mp4→proof-morph`, `proof-before.jpg→proof-before`, `proof-after.jpg→proof-after`); MP4 `-an -c:v libx264 -preset slow -pix_fmt yuv420p -movflags +faststart -vf scale=W:-2` with W=1920 for hero and 1280 otherwise, CRF starting at 24 and raised by 2 (max 34) until the file is under budget (hero 6 MB, service clips 2.5 MB, morph 3 MB); WebM `-c:v libvpx-vp9 -b:v 0 -crf 33 -an`; poster `-frames:v 1 -q:v 3 <name>-poster.jpg`; stills scaled to 1920 wide as JPG `-q:v 3` plus WebP `-quality 80`; prints a size table; exits 0 with "nothing to process" when `assets-raw/` has no recognized files.

- [ ] **Step 1:** Write all six files.
- [ ] **Step 2:** Verify: `bash -n scripts/process-media.sh` passes; `npm run media` with an empty `assets-raw/` prints the "nothing to process" line; `npx tsc --noEmit` passes.
- [ ] **Step 3:** Commit `feat: media manifest resolver, placeholders, video component, media script`.

### Task 6: Motion foundation (GSAP registration, Lenis, scrollToId)

**Files:**
- Create: `src/lib/motion/gsap.ts`, `src/lib/scroll.ts`, `src/components/layout/SmoothScroll.tsx`
- Modify: `src/app/layout.tsx` (mount `<SmoothScroll />`, import `lenis/dist/lenis.css`)

**Interfaces:**
- `gsap.ts`: registers `useGSAP`, `ScrollTrigger`, `SplitText` once (guarded by `typeof window !== "undefined"`); exports `{ gsap, ScrollTrigger, SplitText, useGSAP }`, `EASE = { reveal: "power3.out", crossfade: "power2.inOut" }`, `MOTION_OK = "(prefers-reduced-motion: no-preference)"`, and `revealLines(target: HTMLElement, vars: { stagger?: number; delay?: number; duration?: number; scrollTrigger?: ScrollTrigger.Vars }): SplitText` = `SplitText.create(target, { type: "lines", mask: "lines", autoSplit: true, onSplit: self => { gsap.set(target, { visibility: "visible" }); return gsap.from(self.lines, { yPercent: 110, duration: vars.duration ?? 0.9, ease: EASE.reveal, stagger: vars.stagger ?? 0.08, delay, scrollTrigger }) } })`.
- `scroll.ts`: `setLenis(l: Lenis | null)`, `getLenis(): Lenis | null`, `scrollToId(id: string, offset = 0): void` → `lenis.scrollTo(el, { offset, duration: 1.2 })` when Lenis exists, else `el.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth" })`.
- `SmoothScroll`: client component returning `null`; in `useEffect`, returns early under reduced motion; else `new Lenis({ autoRaf: false })`, `lenis.on("scroll", ScrollTrigger.update)`, `gsap.ticker.add(t => lenis.raf(t * 1000))`, `gsap.ticker.lagSmoothing(0)`, cleanup removes the ticker and destroys Lenis.
- CSS: `@media (prefers-reduced-motion: no-preference) { .js-reveal { opacity: 0 } .js-split { visibility: hidden } }` in `globals.css` so reveal targets never flash before hydration; GSAP always animates to a fully visible end state with `fromTo`/`set`.

- [ ] **Step 1:** Write the three files, mount `SmoothScroll`, add the CSS rules.
- [ ] **Step 2:** Verify: dev server has no console errors; wheel scrolling on the page is eased (temporarily set `body { min-height: 300vh }` in devtools to test); with the OS reduced-motion setting emulated in devtools, no Lenis instance is created (check `getLenis()` via a console log in dev only, then remove it).
- [ ] **Step 3:** Commit `feat: GSAP + Lenis motion foundation`.

### Task 7: Sticky header

**Files:**
- Create: `src/components/layout/Header.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- `Header` (client): `fixed inset-x-0 top-0 z-50`, 72px tall (64px below `md`), no background and no border ever. After `window.scrollY > 80` a `.header-veil` layer (140px tall, `--ink` 75% → transparent gradient, no blur) fades in. Auto-hide via GSAP: `yPercent: -100` on scroll down, `0` on any scroll up (0.4s `power3.out`), always shown at `scrollY <= 80`; under reduced motion it never hides. Left: `next/image` of `/brand/logo-light.png` at 116×40 (`priority`), `alt="Shelby Construction Services"`, 93×32 below `md`. Right: `<a href={site.phone.href}>` with `Phone` icon and `site.phone.display` (label hidden below `sm`, icon stays), then `<Button variant="ghost" size="md" onClick={() => scrollToId("estimate")}>Free Estimate</Button>` (ghost: 1px accent border, fills on hover/focus; one solid accent button per viewport). No nav.

- [ ] **Step 1:** Write `Header.tsx`; render `<Header />` and an empty `<main>` in `page.tsx`.
- [ ] **Step 2:** Verify in the browser at 1440 and 390: logo height, phone link, button; scrolled state (temporarily force `min-height: 300vh` via devtools, scroll 200px).
- [ ] **Step 3:** Commit `feat: sticky header`.

### Task 8: Cinematic hero

**Files:**
- Create: `src/components/sections/Hero.tsx`
- Modify: `src/app/page.tsx` (call `resolveMedia()` and pass `media.hero`)

**Interfaces:**
- `Hero({ media: ResolvedVideo })` (client): `<section class="relative min-h-[100svh] bg-ink overflow-hidden">`; `<SmartVideo media preload="auto" fill />`; overlay `absolute inset-0 bg-ink/40` plus `bg-gradient-to-t from-ink/85 via-ink/20 to-transparent`; content in `.wrap` lower-left: `Eyebrow` (`site.hero.eyebrow`), the only `<h1 class="display-xl js-split max-w-[16ch]">` (`site.hero.h1`), `<p class="lede js-reveal">` (`site.hero.sub`), CTA row `js-reveal` with `<Button onClick={() => scrollToId("estimate")}>{site.hero.ctaPrimary}</Button>` and `<a href={site.phone.href}>` "or call 833-6-SHELBY" (underline offset 4px, muted-on-dark → on-dark hover). Trust bar `absolute inset-x-0 bottom-0 border-t border-white/15 js-reveal`: five items (`Star` + `4.7 · 130 Google Reviews` from `site.rating`, `ShieldCheck` + `CertainTeed ShingleMaster™`, `Award` + `Mastic Elite Contractor`, `BadgeCheck` + `Alside Certified`, `Medal` + `BBB Torch Awards Finalist`) as Barlow 600 13px uppercase `.12em` muted-on-dark, `flex justify-between` at `lg`, `flex-wrap gap-x-6 gap-y-3` below. Content padding-bottom leaves room for the trust bar (`pb-32 lg:pb-36`).
- Motion (`useGSAP` scoped to the section, inside `gsap.matchMedia().add(MOTION_OK, …)`): `revealLines(h1, { stagger: 0.12, delay: 0.2, duration: 1 })`; timeline `fromTo` eyebrow `{ autoAlpha: 0, y: 16 } → { autoAlpha: 1, y: 0, duration: 0.6 }` at 0.1, then sub + CTA row `{ autoAlpha: 0, y: 24 } → { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.1 }` at 0.9, then trust bar at 1.1. Scroll drift: `gsap.to(content, { y: -32, opacity: 0.3, ease: "none", scrollTrigger: { trigger: section, start: "50% top", end: "bottom top", scrub: true } })` (fade begins only after half the hero has scrolled past, never below 30% opacity). Below `sm` the eyebrow renders `site.hero.eyebrowShort` on one line; below `lg` the trust bar is a seamless CSS marquee (`.trust-track`, two copies, paused on hover/touch, static under reduced motion).

- [ ] **Step 1:** Write `Hero.tsx`; update `page.tsx`.
- [ ] **Step 2:** Verify in the browser: placeholder fills the hero (no media yet), one H1, lines reveal with stagger on load, trust bar sits on the viewport bottom at 1440×900, nothing overflows at 390×844, no console errors or hydration warnings.
- [ ] **Step 3:** Commit `feat: cinematic hero`.

### Task 9: Screenshot tooling and Phase 1 checkpoint

**Files:**
- Create: `scripts/screenshot.mjs`, `docs/screenshots/phase-1/*.png`

**Interfaces:**
- `node scripts/screenshot.mjs --out <dir> [--url http://localhost:3000] [--at <y|#selector> ...] [--scrolled-header]`: launches Chromium; for viewports `desktop` 1440×900 and `mobile` 390×844 (`deviceScaleFactor: 2`): load, `document.fonts.ready`, wait 2500ms for load reveals, save `<vp>-full.png` (`fullPage: true`) and `<vp>-top.png`; for each `--at` value scroll there (`window.scrollTo` or `scrollIntoView`), wait 1200ms, save `<vp>-at-<n>.png`; with `--scrolled-header`, pad `document.body.style.minHeight = "300vh"`, scroll to 200, wait 600ms, save `<vp>-header-scrolled.png`. Prints every path written.

- [ ] **Step 1:** Write the script. Run `npm run dev` (background) then `node scripts/screenshot.mjs --out docs/screenshots/phase-1 --scrolled-header`.
- [ ] **Step 2:** Review every PNG against `CLAUDE.md` and spec §2.1–2.2 (type sizes, accent budget, trust bar, 390 layout); fix issues; re-shoot.
- [ ] **Step 3:** Check the dev server output and browser console for errors or hydration warnings; fix.
- [ ] **Step 4:** Commit `feat: phase 1 screenshots`. **STOP. Show the user the plan and the 1440/390 screenshots and wait for approval.**

---

# Phase 2 — The Shelby Standard and sticky services

### Task 10: Estimate intent store

**Files:**
- Create: `src/lib/estimate-intent.ts`
- Test: `src/lib/estimate-intent.test.ts`

**Interfaces:**
- `type EstimateIntent = { service: ServiceOption | null; requestId: number }`; `requestEstimate(service: ServiceOption | null): void` (increments `requestId`, stores `service`, calls `scrollToId("estimate", -72)`); `getEstimateIntent(): EstimateIntent`; `subscribeEstimateIntent(cb): () => void`; `useEstimateIntent(): EstimateIntent` via `useSyncExternalStore` (server snapshot `{ service: null, requestId: 0 }`). `scrollToId` is imported from `@/lib/scroll` and is a no-op when `document` is undefined.

- [ ] **Step 1:** Test: two `requestEstimate("Roofing")` calls yield `requestId` 1 then 2 with `service === "Roofing"`; `requestEstimate(null)` keeps counting; subscribers are called once per request.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS. **Step 5:** Commit `feat: estimate intent store`.

### Task 11: The Shelby Standard section

**Files:**
- Create: `src/components/sections/Standard.tsx`; Modify: `src/app/page.tsx`

**Interfaces:**
- `Standard()` (client): `<section class="bg-slate blueprint text-on-dark py-28 lg:py-40">`; `Eyebrow` "THE SHELBY STANDARD"; `<h2 class="display-lg js-split max-w-[18ch]">` statement from `site.standard.statement`; body `<p class="lede">` in a right column at `lg` (grid `lg:grid-cols-12`, statement spans 7, body spans 4 offset 1); stat row `grid grid-cols-2 lg:grid-cols-4` with `divide-x divide-rule-dark`, each cell: value in Barlow 700 `text-4xl tnum` and label in muted-on-dark. Values/labels from `site.standard.stats` (`6+`/Years serving Macomb County, `Family-Owned`/in Clinton Township, `Licensed & Insured`/Michigan contractor, `BBB Torch Awards`/Finalist for Ethics).
- Motion: `revealLines(h2, { stagger: 0.08, scrollTrigger: { trigger: section, start: "top 70%" } })`; stats `fromTo` `{ autoAlpha: 0, y: 20 } → { autoAlpha: 1, y: 0, stagger: 0.1, duration: 0.7 }` triggered at `top 60%`; the `6+` number counts from 0 with `snap: 1` over 1s.

- [ ] **Step 1:** Write it; add to `page.tsx` after `Hero`. **Step 2:** Verify in the browser at both sizes. **Step 3:** Commit `feat: shelby standard section`.

### Task 12: Core services (sticky split-screen + mobile fallback)

**Files:**
- Create: `src/components/sections/Services.tsx`; Modify: `src/app/page.tsx` (pass `media.roofing|siding|windows|gutters`)

**Interfaces:**
- `Services({ media: Pick<ResolvedMedia, "roofing" | "siding" | "windows" | "gutters"> })` (client), state `active: number` (0–3).
- Desktop ≥1024 (`lg:grid lg:grid-cols-2`, section `bg-ink`): left `<div class="lg:sticky lg:top-0 lg:h-screen relative">` with four `SmartVideo` stacked `absolute inset-0` (`active={i === active}`), opacity driven by `gsap.to(video, { autoAlpha: i === active ? 1 : 0, duration: 0.7, ease: EASE.crossfade })` in an effect on `active`; bottom-left overlay: `<span class="font-display text-6xl tnum"><span class="text-accent">0{active+1}</span> / 04</span>` and a 2px progress bar whose inner `scaleX = (active+1)/4` (accent, origin left, 0.7s). Right: section `Eyebrow` "WHAT WE BUILD" above four blocks `min-h-screen flex flex-col justify-center border-t border-rule-dark` each with index `01`, `<h3 class="display-lg">`, body `.lede`, link `<button class="font-display uppercase …" onClick={() => requestEstimate(s.formValue)}>` with `ArrowRight`. Inactive blocks `opacity: 0.35` (CSS transition 0.5s). One `ScrollTrigger.create({ trigger: block, start: "top center", end: "bottom center", onToggle: self => self.isActive && setActive(i) })` per block inside `gsap.matchMedia().add("(min-width: 1024px)", …)`.
- Mobile <1024: no sticky; each block renders its own `<SmartVideo className="aspect-[4/5]" />` above the text; no ScrollTriggers (`SmartVideo`'s observer handles play/pause).
- Below the blocks: `border-t border-rule-dark py-8 flex justify-between` row with `site.insulation.label + body` and `<button onClick={() => requestEstimate("Insulation")}>`.

- [ ] **Step 1:** Write it; add to `page.tsx`. **Step 2:** Verify: `node scripts/screenshot.mjs --out docs/screenshots/phase-2 --at "#svc-roofing" --at "#svc-siding" --at "#svc-windows" --at "#svc-gutters"` shows the matching active index at each; scroll back up in the browser and confirm reverse order works; 390 shows stacked 4:5 placeholders. **Step 3:** Commit `feat: sticky services section`.

---

# Phase 3 — Proof, Reviews, Process, Financing

### Task 13: Proof section with ProofMedia and CompareSlider

**Files:**
- Create: `src/components/sections/Proof.tsx`, `src/components/ui/CompareSlider.tsx`; Modify: `src/app/page.tsx`

**Interfaces:**
- `CompareSlider({ before: ResolvedImage; after: ResolvedImage; labels?: { before: string; after: string } })` (client): container `relative aspect-video select-none touch-none`; `after` layer clipped with `clip-path: inset(0 ${100-pos}% 0 0)`; vertical 2px accent handle with a square accent grip; pointer events (`setPointerCapture`) update `pos` 0–100; the handle is `<button role="slider" aria-valuemin=0 aria-valuemax=100 aria-valuenow={pos} aria-label="Compare before and after">`; ArrowLeft/ArrowRight move ±2, Home/End 0/100. Missing images render `MediaPlaceholder`.
- `Proof({ media: Pick<ResolvedMedia, "proofMorph" | "proofBefore" | "proofAfter"> })`: `bg-bone text-on-light`; `Eyebrow tone="light"` "STORM DAMAGE & INSURANCE CLAIMS"; `<h2 class="display-xl">`; sub `.lede` (PITCH COPY); media frame `<div class="js-clip">` rendering `SmartVideo(proofMorph)` when `proofMode === "video"` else `CompareSlider`; CTA `<Button onClick={() => requestEstimate("Roofing")}>Book a Free Storm Inspection</Button>`.
- Motion: `gsap.fromTo(frame, { clipPath: "inset(8% 6%)" }, { clipPath: "inset(0% 0%)", ease: "none", scrollTrigger: { trigger: frame, start: "top 85%", end: "top 35%", scrub: true } })`.

- [ ] **Step 1:** Write both; add to `page.tsx`. **Step 2:** Verify both modes by temporarily flipping `proofMode` (restore to `"video"`); keyboard moves the handle. **Step 3:** Commit `feat: proof section with video and slider modes`.

### Task 14: Reviews section

**Files:**
- Create: `src/components/sections/Reviews.tsx`; Modify: `src/app/page.tsx`

**Interfaces:**
- `Reviews()`: `bg-slate blueprint`; `Eyebrow` "REVIEWS"; `<h2 class="display-xl">WE MAKE YOUR NEIGHBORS JEALOUS.</h2>`; summary row: `4.7` in Barlow 700 `text-7xl tnum`, five `Star` icons (fill accent, the fifth clipped to 70% width via an overflow wrapper), `130 Google Reviews` from `site.rating`; three cards `bg-slate-raised border border-rule-dark p-8` from `reviews.ts`: stars, text, `name`, `city` (if present). Cards stagger in (`fromTo` autoAlpha/y, 0.08 stagger).

- [ ] **Step 1:** Write it. **Step 2:** Verify placeholders show `[PASTE VERBATIM REVIEW TEXT]` literally. **Step 3:** Commit `feat: reviews section with placeholder entries`.

### Task 15: How it works section

**Files:**
- Create: `src/components/sections/Process.tsx`; Modify: `src/app/page.tsx`

**Interfaces:**
- `Process()`: `bg-bone text-on-light`; `Eyebrow tone="light"` "THE PROCESS"; `<h2 class="display-lg">FOUR STEPS. NO SURPRISES.</h2>`; a 1px accent line `js-line` (`scaleX: 0`, origin left) above a `grid lg:grid-cols-4 divide-x divide-rule-light` row; each column: index `01`–`04` in Barlow 700 `text-5xl tnum text-muted-on-light`, title `<h3>`, body from `site.process.steps`.
- Motion: line `to { scaleX: 1, ease: "none", scrollTrigger: { trigger: section, start: "top 70%", end: "top 30%", scrub: true } }`; columns `fromTo` autoAlpha/y stagger 0.12 at `top 65%`.

- [ ] **Step 1:** Write it. **Step 2:** Verify. **Step 3:** Commit `feat: process section`.

### Task 16: Financing & pricing section and chat store

**Files:**
- Create: `src/components/sections/Pricing.tsx`, `src/lib/chat/chat-store.ts`; Modify: `src/app/page.tsx`
- Test: `src/lib/chat/chat-store.test.ts`

**Interfaces:**
- `chat-store.ts`: `type ChatIntent = "financing" | null`; `openChat(intent?: ChatIntent)`, `closeChat()`, `getChatState(): { open: boolean; intent: ChatIntent; openCount: number }`, `useChatState()` (`useSyncExternalStore`).
- `Pricing()`: `bg-bone border-t border-rule-light`; `Eyebrow tone="light"` "FINANCING & PRICING"; `<h2 class="display-xl">` `site.offer.headline`; sub; `grid md:grid-cols-3 gap-px bg-rule-light` with white cards (`bg-bone-raised p-8`): name, range in Barlow 700 `text-4xl lg:text-5xl tnum`, average, Windows note "per window"; below: `site.pricing.disclaimer` and `site.offer.footnote` in 13px muted-on-light; `<Button variant="dark" onClick={() => openChat("financing")}>Check Financing Options</Button>`.

- [ ] **Step 1:** Test `chat-store`: `openChat("financing")` → `{ open: true, intent: "financing", openCount: 1 }`; `closeChat()` → `open: false`, intent retained until next open; `openChat()` resets intent to `null`. **Step 2:** FAIL → implement → PASS. **Step 3:** Write `Pricing.tsx`, verify. **Step 4:** Commit `feat: pricing section and chat store`.

---

# Phase 4 — Estimate form and footer

### Task 17: Phone formatting and form validation (TDD)

**Files:**
- Create: `src/lib/forms/phone.ts`, `src/lib/forms/validate.ts`
- Test: `src/lib/forms/phone.test.ts`, `src/lib/forms/validate.test.ts`

**Interfaces:**
- `normalizeUSDigits(input: string): string` → strips non-digits, drops a leading `1` when 11 digits, truncates to 10.
- `formatUSPhone(input: string): string` → `(586) 555-0123` progressively (`(586`, `(586) 555`, `(586) 555-01`).
- `isValidUSPhone(input: string): boolean` → exactly 10 normalized digits, area code not starting with 0 or 1.
- `type EstimateValues = { name: string; city: string; email: string; phone: string; service: ServiceOption | ""; message: string }`; `type EstimateErrors = Partial<Record<keyof EstimateValues, string>>`; `validateEstimate(values: EstimateValues): EstimateErrors` — required `name`, `city`, `email`, `phone`, `service`; email must match `/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/`; phone must pass `isValidUSPhone`; messages: `"Please enter your name."`, `"Please enter your city."`, `"Please enter a valid email address."`, `"Please enter a 10-digit phone number."`, `"Please choose a service."`.

- [ ] **Step 1:** Tests: the Review Focus #1 cases; `formatUSPhone("5865550123") === "(586) 555-0123"`; partial formatting; `validateEstimate` on empty values returns all five errors and no `message` error; a valid record returns `{}`.
- [ ] **Step 2:** FAIL → implement → PASS. **Step 3:** Commit `feat: phone formatting and estimate validation`.

### Task 18: Estimate section and form

**Files:**
- Create: `src/components/sections/Estimate.tsx`, `src/components/ui/EstimateForm.tsx`; Modify: `src/app/page.tsx`

**Interfaces:**
- `Estimate()`: `<section id="estimate" class="bg-ink blueprint text-on-dark scroll-mt-[72px]">`, `lg:grid-cols-2`; left: `Eyebrow` "FREE ESTIMATE", `<h2 class="display-lg">LET'S LOOK AT YOUR PROJECT.</h2>`, the PITCH COPY line, `Prefer to talk? 833-6-SHELBY · 7am–9pm, 7 days.` with the phone as a `tel:` link; right: `<EstimateForm />`.
- `EstimateForm()` (client): fields exactly Name*, City*, Email*, Phone*, Service Needed* (`<select>` with a disabled placeholder option plus `SERVICE_OPTIONS`), Message; labels Barlow 600 uppercase 13px; inputs `bg-slate-raised border border-rule-dark focus:border-accent h-12 px-4` (radius 0, outline none, accent border on focus); phone `onChange` applies `formatUSPhone`; errors from `validateEstimate` shown under fields after first submit attempt (`aria-invalid`, `aria-describedby`); `useEstimateIntent()` sets `service` whenever `requestId` changes; submit (no network call) → `submitting` for 600ms (button shows "Sending…" and is disabled) → replace the form with a success panel: `CheckCircle2` icon, `<p class="display-lg">REQUEST RECEIVED.</p>`, `site.estimate.success` text.

- [ ] **Step 1:** Write both; add to `page.tsx`. **Step 2:** Verify in the browser: validation messages, phone auto-format, preselect from a "Get a Siding Estimate" click, success state, network tab shows no request. **Step 3:** Commit `feat: estimate form`.

### Task 19: Footer

**Files:**
- Create: `src/components/layout/Footer.tsx`; Modify: `src/app/page.tsx`

**Interfaces:**
- `Footer()`: `bg-ink border-t border-rule-dark`; `grid md:grid-cols-2 lg:grid-cols-4 divide-rule-dark lg:divide-x`; col 1: logo-light (116×40), `site.story.short`, credentials list; col 2: phone, email, address, hours as links/text; col 3: "Macomb County" + list; col 4: "Oakland County" + list, then "St. Clair County · Grosse Pointe"; bottom bar `border-t border-rule-dark text-[12px] text-muted-on-dark`: `site.offer.promoTerms`, `© 2026 Shelby Construction Services`, right-aligned `Concept by GSX Solutions`.

- [ ] **Step 1:** Write it. **Step 2:** Verify both sizes (`node scripts/screenshot.mjs --out docs/screenshots/phase-4 --at "#estimate" --at footer`). **Step 3:** Commit `feat: footer`.

---

# Phase 5 — Shelby Assistant chatbot

### Task 20: Chat protocol and lead parsing (TDD)

**Files:**
- Create: `src/lib/chat/protocol.ts`, `src/lib/chat/lead.ts`; Test: `src/lib/chat/lead.test.ts`

**Interfaces:**
- `protocol.ts`: `type ChatRole = "user" | "assistant"`; `type ChatTurn = { role: ChatRole; content: string }`; `type ChatRequest = { messages: ChatTurn[]; intent?: "financing" }`; `type StreamEvent = { type: "text"; text: string } | { type: "lead"; lead: Lead } | { type: "done" } | { type: "error"; message: string }`; `MAX_TURNS = 30`, `MAX_MESSAGE_CHARS = 1000`, `MAX_MESSAGES = 60`.
- `lead.ts`: `type Lead = { name: string; phone: string; email?: string; service: string; city: string; timeline?: string; storm_or_insurance?: "yes" | "no"; notes?: string; capturedAt: string; source: "ai" | "scripted" }`; `parseLead(input: unknown, source: Lead["source"], now = () => new Date()): { ok: true; lead: Lead } | { ok: false; errors: string[] }` — trims strings; `name` 2–80 chars; `phone` via `normalizeUSDigits` + `isValidUSPhone`, stored formatted; `email` optional, dropped when empty, must match the form regex when present; `service` and `city` 2–60 chars; `timeline` and `notes` optional, ≤120 / ≤500 chars; `storm_or_insurance` accepts `true/false`, `"yes"/"no"` (case-insensitive), `"y"/"n"`; `leadSummary(lead): string` → `"name · phone · service · city"`.

- [ ] **Step 1:** Tests: Review Focus #3 cases; happy path; missing `city` → `ok: false` with one error naming `city`; non-object input → `ok: false`.
- [ ] **Step 2:** FAIL → implement → PASS. **Step 3:** Commit `feat: chat protocol and lead parsing`.

### Task 21: System prompt and tool definition

**Files:**
- Create: `src/lib/chat/system-prompt.ts`, `src/lib/chat/tools.ts`; Test: `src/lib/chat/system-prompt.test.ts`

**Interfaces:**
- `buildSystemPrompt(intent?: "financing"): string` — the spec §3 rules verbatim as numbered guidance, followed by a `BUSINESS FACTS` block rendered from `site` (name, phone + hours, email, address, story, credentials, services with details, service areas, pricing ranges with the disclaimer, offer + footnote), and when `intent === "financing"` a final line: "The visitor arrived from the financing section; lead with financing when relevant."
- `tools.ts`: `captureLeadTool: Anthropic.Tool` named `capture_lead` with `input_schema` properties `name`, `phone`, `email`, `service`, `city`, `timeline` (enum `ASAP`, `1-3 months`, `just researching`), `storm_or_insurance` (enum `yes`, `no`), `notes`; `required: ["name", "phone", "service", "city"]`; description tells the model to call it once it has those four.

- [ ] **Step 1:** Test: prompt contains `833-6-SHELBY`, `7am–9pm`, `$5,800`, `Typical Metro Detroit ranges`, `capture_lead`; the financing line appears only with the intent. **Step 2:** FAIL → implement → PASS. **Step 3:** Commit `feat: chat system prompt and capture_lead tool`.

### Task 22: Leads store, chat handler, route (TDD)

**Files:**
- Create: `src/lib/chat/leads-store.ts`, `src/lib/chat/handler.ts`, `src/app/api/chat/route.ts`; Test: `src/lib/chat/handler.test.ts`, `src/lib/chat/leads-store.test.ts`

**Interfaces:**
- `leads-store.ts`: `appendLead(lead: Lead, file = process.env.LEADS_FILE ?? path.join(process.cwd(), "data", "leads.json")): Promise<void>` — creates the directory and an empty array file if missing, appends, writes pretty JSON.
- `handler.ts`: `type ChatDeps = { client: Pick<Anthropic, "messages"> | null; appendLead: (lead: Lead) => Promise<void>; log?: (line: string) => void }`; `handleChat(body: unknown, deps: ChatDeps): Promise<Response>`:
  1. Invalid body / over `MAX_MESSAGES` / any `content` over `MAX_MESSAGE_CHARS` → `400` JSON `{ error: "invalid_request" }`.
  2. More than `MAX_TURNS` user turns → NDJSON stream of `{ type: "text", text: site.chat.limitReached }` then `{ type: "done" }` (no API call).
  3. `deps.client === null` → `503` JSON `{ error: "no_api_key" }`.
  4. Otherwise `client.messages.stream({ model: "claude-haiku-5-5", max_tokens: 400, system: buildSystemPrompt(intent), tools: [captureLeadTool], messages, thinking: { type: "disabled" }, output_config: { effort: "low" } })`; forward `.on("text", delta)` as `{ type: "text" }`; after `finalMessage()`, if `stop_reason === "tool_use"`: `parseLead(block.input, "ai")`; on `ok` → `appendLead`, `log(leadSummary)`, emit `{ type: "lead" }`; then a second `stream` call with the assistant content and a `tool_result` (`is_error` when invalid, content listing the errors so the model re-asks) and forward its text; finally `{ type: "done" }`. Any thrown error → `{ type: "error", message: "unavailable" }` then close (never the raw error text). Response headers `Content-Type: application/x-ndjson`, `Cache-Control: no-store`.
- `route.ts`: `export const runtime = "nodejs"`; `POST(req)` → `handleChat(await req.json().catch(() => null), { client: process.env.ANTHROPIC_API_KEY ? new Anthropic() : null, appendLead, log: console.log })`.

- [ ] **Step 1:** Tests with a fake client whose `messages.stream()` returns `{ on(event, cb), finalMessage() }` scripted per test: Review Focus #4 cases; `client: null` → 503; a text-only turn streams its text and `done`; a `tool_use` turn with a valid lead calls `appendLead` once, emits `lead` before the follow-up text, and the second `stream` call carries a `tool_result` with the first block's `id`; an invalid lead emits no `lead` event and the `tool_result` has `is_error: true`; a thrown error emits `{ type: "error" }`. `leads-store`: writes to a temp `LEADS_FILE`, appends twice → array length 2.
- [ ] **Step 2:** FAIL → implement → PASS. **Step 3:** Commit `feat: chat API route with capture_lead`.

### Task 23: Scripted fallback state machine (TDD)

**Files:**
- Create: `src/lib/chat/scripted-flow.ts`; Test: `src/lib/chat/scripted-flow.test.ts`

**Interfaces:**
- `type ScriptedStep = "service" | "city" | "storm" | "timeline" | "name" | "phone" | "email" | "done"`; `type ScriptedState = { step: ScriptedStep; lead: Partial<Lead>; asked: Partial<Record<ScriptedStep, number>> }`; `createScriptedState(intent?: "financing"): ScriptedState`; `scriptedReply(state: ScriptedState, input: string): { state: ScriptedState; replies: string[]; lead?: Lead }`; `scriptedQuestion(step): string`.
- Behavior: chips/keywords — `roof` → service Roofing + canned roofing range; `storm`/`hail`/`insurance` → `storm_or_insurance: "yes"` + canned insurance line; `siding` / `window` → service + range; `financ`/`payment`/`$0` → canned financing line; `price`/`cost`/`how much` → canned range for the known service (or all three). A canned fact is followed by the pending question unless the input also answered it. Order of questions: service → city → storm (`yes`/`no`) → timeline (`ASAP`, `1–3 months`, `just researching`) → name → phone (`isValidUSPhone`, re-ask with a hint on failure) → email (optional; `skip`/`no`/blank → none; else needs `@`). At `email` completion: `parseLead(lead, "scripted")` → `lead` returned and `replies` end with the warm confirmation mentioning `833-6-SHELBY`, 7am–9pm, 7 days. After `done`, replies point to the phone number.

- [ ] **Step 1:** Tests: full happy path yields a `Lead` with `source: "scripted"`; Review Focus #2; chip "Storm damage" first sets storm=yes and asks for service; invalid phone re-asks and does not advance; `skip` on email completes.
- [ ] **Step 2:** FAIL → implement → PASS. **Step 3:** Commit `feat: scripted chat fallback`.

### Task 24: Chat client and widget UI

**Files:**
- Create: `src/lib/chat/client.ts`, `src/components/chat/ChatWidget.tsx`, `ChatFab.tsx`, `ChatPanel.tsx`, `MessageList.tsx`, `LeadCard.tsx`, `QuickReplies.tsx`; Modify: `src/app/layout.tsx` (mount `<ChatWidget />`), `globals.css` (`@keyframes fab-pulse`)

**Interfaces:**
- `client.ts`: `class ChatUnavailable extends Error`; `streamChat(req: ChatRequest, handlers: { onText(t: string): void; onLead(l: Lead): void }, signal?: AbortSignal): Promise<void>` — `fetch("/api/chat", { method: "POST", body })`; non-2xx, network failure, or an `error` event throws `ChatUnavailable`; parses NDJSON lines incrementally with `TextDecoder`.
- `ChatWidget` (client, mounted once): state `mode: "ai" | "scripted"`, `messages: UiMessage[]` where `UiMessage = { id; role: "user" | "assistant"; text; streaming?: boolean } | { id; role: "lead"; lead: Lead }`, `scripted: ScriptedState`, `busy`. On open: if no messages, push the opening message (`site.chat.financingOpening` when `intent === "financing"`, else `site.chat.opening`) and show chips. Sending: push the user turn, show the typing indicator, call `streamChat` in `ai` mode; on `ChatUnavailable` set `mode = "scripted"`, `console.info` only when `process.env.NODE_ENV === "development"`, and answer the same input via `scriptedReply`. Enter sends; Shift+Enter newlines.
- `ChatFab`: `fixed bottom-6 right-6 z-50 h-14 bg-accent text-ink px-5` square, `MessageSquare` icon + "Get an Instant Quote"; `::after` accent ring animating `fab-pulse` 4s infinite (disabled under reduced motion); hidden when the panel is open.
- `ChatPanel`: `fixed bottom-6 right-6 w-[400px] h-[620px] bg-slate border border-rule-dark` (`inset-0 w-full h-full` below `md`); header "SHELBY ASSISTANT", green 8px dot + "Online", "Typically replies instantly", `X` close; open/close via `gsap.fromTo({ y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, ease: EASE.reveal })` and the reverse.
- `MessageList`: user bubbles `bg-slate-raised` right-aligned; assistant plain text left; typing indicator (three dots) while `busy` and no token yet; auto-scroll to bottom.
- `LeadCard({ lead })`: `border-t-2 border-accent bg-slate-raised p-5`, title "LEAD CAPTURED ✓" (Barlow 700), a two-column definition list of every present field.
- `QuickReplies({ chips, onPick })`: outlined 1px chips in Barlow 600 uppercase; hidden after the first user message.

- [ ] **Step 1:** Write all files and mount the widget. **Step 2:** Verify with the API key (if present in `.env.local`): a full qualification ends with the Lead Captured card and a row in `data/leads.json`; then rename `.env.local` temporarily and verify the scripted flow produces the same card without any visible error; "Check Financing Options" opens with the financing opener; restore `.env.local`. **Step 3:** Run `npx vitest run` → all green. **Step 4:** Commit `feat: Shelby Assistant chat widget`.

---

# Phase 6 — Polish and QA

### Task 25: Reduced-motion pass
- [ ] Emulate `prefers-reduced-motion: reduce` in the screenshot script (`--reduced-motion` flag → `page.emulateMedia({ reducedMotion: "reduce" })`) and verify: no Lenis, all `.js-reveal`/`.js-split` content visible, videos render posters only, the FAB does not pulse, the services section still switches the active index by ScrollTrigger (allowed: it is state, not animation) with instant opacity. Fix gaps. Commit `fix: reduced motion pass`.

### Task 26: Mobile pass (390×844)
- [ ] Walk every section at 390: header fits, hero H1 wraps to ≤4 lines, trust bar wraps cleanly, stat rows go 2-up, services stack with 4:5 placeholders, price cards stack, form fields full-width, footer stacks, chat panel is full-screen with a reachable close button. Fix. Commit `fix: mobile pass`.

### Task 27: Console cleanup and full screenshot sweep
- [ ] `npm run dev` fresh; load the page; zero console errors and zero hydration warnings; `npm run lint` and `npx tsc --noEmit` pass. Run `node scripts/screenshot.mjs --out docs/screenshots/phase-6 --scrolled-header --at "#standard" --at "#svc-roofing" --at "#svc-siding" --at "#svc-windows" --at "#svc-gutters" --at "#proof" --at "#reviews" --at "#process" --at "#pricing" --at "#estimate" --at footer` and review every image against the spec. Fix and re-shoot until clean. Commit `chore: phase 6 QA sweep`.

### Task 28: README
- [ ] Replace the generated `README.md` with sections: Run (`npm install`, `npm run dev`), Add media (`/assets-raw/` filenames table → `npm run media`), Paste reviews (`src/content/reviews.ts`, verbatim rule), API key (`cp .env.local.example .env.local`, set `ANTHROPIC_API_KEY`; scripted fallback without it), Screenshots (`npm run shots`). Commit `docs: README`.

---

## Self-review notes

- Spec coverage: §0 → Task 2; §1 → Tasks 2, 4, 5; §2.1 → 7; §2.2 → 8; §2.3 → 11; §2.4 → 10, 12; §2.5 → 13; §2.6 → 14; §2.7 → 15; §2.8 → 16; §2.9 → 17, 18; §2.10 → 19; §3 UI → 24; §3 backend → 20–22; §3 fallback → 23; §4 phases → headings; §5 done criteria → Tasks 25–27.
- Names used across tasks: `scrollToId`, `requestEstimate`, `useEstimateIntent`, `openChat`, `SmartVideo`, `ResolvedVideo`, `ResolvedImage`, `revealLines`, `parseLead`, `Lead`, `handleChat`, `scriptedReply`, `streamChat` are defined once and referenced by those exact names.
