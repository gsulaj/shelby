# BUILD_SPEC.md — Shelby Construction Homepage

Read `CLAUDE.md` first. This file defines **what** to build. `CLAUDE.md` defines **how**.

---

## 0. Business facts (seed `src/content/site.ts` with exactly these)

- **Name:** Shelby Construction Services
- **Phone:** 833-6-SHELBY · `tel:+18336743529`
- **Email:** info@shelbyconstructionservices.com
- **Address:** 33483 Harper Ave, Clinton Twp, MI 48035
- **Hours:** Mon–Sun, 7am–9pm
- **Story:** Family-owned, based in Clinton Township, and named after the owner's daughter, Shelby. Serving Macomb County homeowners for 6+ years. Fully licensed and insured.
- **Tagline (theirs):** "We Make Your Neighbors Jealous"
- **Credentials:** CertainTeed ShingleMaster™ Contractor · Mastic Elite Contractor · Alside Certified Window Installer · BBB Accredited Business · BBB Torch Awards Finalist for Ethics · Licensed & Insured Michigan Contractor
- **Rating:** `{ value: 4.7, count: 130, source: "Google", verified: false }`. Render it, but keep `verified: false` with a `// TODO: confirm on Google Business Profile` comment.
- **Services:**
  - Roofing: full replacement, new installs, storm damage replacement, insurance claim specialists, CertainTeed systems
  - Siding: vinyl, insulated vinyl, fiber cement, trim/soffit/fascia; Mastic Quest™ and Carvedwood® 44
  - Windows: energy-efficient replacement, custom, triple-pane, full-frame and insert installs; Alside, CertainTeed, Pella
  - Gutters: seamless gutters, gutter guards
  - Attic insulation
- **Service areas:**
  - Macomb County: Clinton Township, Sterling Heights, Shelby Township, Macomb Township, Harrison Township, New Baltimore, St. Clair Shores, Warren, Roseville
  - Oakland County: Troy, Rochester Hills, Bloomfield Hills, Royal Oak, Novi, Farmington Hills
  - St. Clair County, and Grosse Pointe
- **Pricing (typical Metro Detroit ranges):**
  - Roof replacement: $5,800 – $13,500 (avg. ~$9,500)
  - Window replacement: $550 – $1,100 per window (avg. ~$750)
  - Siding replacement: $8,000 – $30,000 (avg. $15,000 – $17,000)
  - Disclaimer: "Typical Metro Detroit ranges. Final pricing depends on material grade, tear-off requirements, and local permits."
- **Offer:** $0 Down + Low Monthly Payments on all Michigan home improvement projects
  - Footnote: "Financing subject to credit approval. Terms vary by lender."
  - Promo terms (small print): "Offers are limited to one per customer and cannot be combined with any other discounts, promotions, or coupons. Offers are valid on new estimates only; previous orders and signed contracts are excluded. All work is subject to inspection."

**Copy marked [PITCH COPY] is new copy for the owner to approve. It's fine to use, but tag it with a `// PITCH COPY` comment in `site.ts`.**

---

## 1. Media manifest (`src/content/media.ts`)

| Key | Raw file in `/assets-raw/` | Used in | Aspect |
|---|---|---|---|
| `hero` | `hero-flyover.mp4` | Hero background | 16:9 |
| `roofing` | `svc-roofing.mp4` | Services | 1:1 (cropped to the panel) |
| `siding` | `svc-siding.mp4` | Services | 1:1 |
| `windows` | `svc-windows.mp4` | Services | 1:1 |
| `gutters` | `svc-gutters.mp4` | Services | 1:1 |
| `proofBefore` | `proof-before.jpg` | Proof (slider mode) | 16:9 |
| `proofAfter` | `proof-after.jpg` | Proof (slider mode) | 16:9 |
| `proofMorph` | `proof-morph.mp4` | Proof (video mode) | 16:9 |

None of these exist yet. Build with the labeled placeholders described in `CLAUDE.md`. Write `scripts/process-media.sh` now so I can drop the files in later and run one command.

**Logo:** `logo.png` is in the project root. Copy it to `public/brand/logo.png`. Inspect it: if it's dark on a transparent background, generate a light variant at `public/brand/logo-light.png` with `sharp`, and use that on every dark section. If it has a solid background, tell me before continuing.

---

## 2. Page sections (in order)

### 2.1 Sticky header
- Transparent over the hero. No solid background, no border, and no backdrop blur at any scroll position. After 80px of scroll, a soft vertical gradient (`--ink` at ~75% to transparent, about 140px tall) sits behind it, with no visible edge; headline text passing underneath stays crisp.
- Auto-hide: hides on scroll down (translateY -100%, 0.4s power3.out) and reveals on any scroll up. Always visible at the top of the page. Under `prefers-reduced-motion` it never hides and the gradient is static.
- Left: the logo (light variant), ~40px tall.
- Right: a phone link ("833-6-SHELBY" with a phone icon, `tel:` href), then a ghost accent button (1px `--accent` border, fills on hover/focus), "Free Estimate", that smooth-scrolls to `#estimate`. The hero CTA is the only solid accent button in the first viewport.
- No nav menu; this is a one-page pitch. Keep it minimal.

### 2.2 Cinematic hero (`100vh`)
- Full-bleed `hero` video. Overlay: `--ink` at 40%, plus a bottom gradient to `--ink` at 85% for text legibility.
- Content is left-aligned in the lower-left third:
  - Eyebrow: "CLINTON TOWNSHIP · MACOMB · OAKLAND · ST. CLAIR"
  - H1: "EXPERT EXTERIOR REMODELING IN MACOMB COUNTY."
  - Sub: "Roofing, siding, windows, and gutters, built to The Shelby Standard."
  - Primary CTA: "Get a Free Estimate" (accent, scrolls to `#estimate`)
  - Secondary: "or call 833-6-SHELBY" as a text link
- **Trust bar**, anchored to the bottom of the viewport behind a 1px top rule: ★ 4.7 · 130 Google Reviews | CertainTeed ShingleMaster™ | Mastic Elite Contractor | Alside Certified | BBB Torch Awards Finalist. These are typographic badges with small line icons, all in muted-on-dark, evenly spaced. **No recreated brand logos.**
- Mobile (<640px): the eyebrow reads "MACOMB · OAKLAND · ST. CLAIR" on one line. No wrapped eyebrow line may start with a separator.
- Mobile trust bar (<1024px): a slow, seamless auto-scrolling marquee, paused on hover/touch and static under reduced motion. Desktop keeps the evenly spaced row.
- Motion: on load, the H1 lines mask-reveal with a stagger, then the sub, CTAs, and trust bar fade up. On scroll, once 50% of the hero has scrolled past, the content drifts up subtly and fades to no less than 30% opacity as the next section arrives.

### 2.3 The Shelby Standard (`--slate`, blueprint texture)
- Eyebrow: "THE SHELBY STANDARD"
- Statement (huge, uppercase, ~5 lines): "WHEN YOUR DAUGHTER'S NAME IS ON EVERY JOB, YOU MAKE SURE THE WORK IS DONE RIGHT."
- Body (right column or below, max 62ch): "Shelby Construction Services is a family-owned contractor in Clinton Township, named after the owner's daughter. Every roof, wall, and window we touch has to meet a standard worthy of our own home, and we stand behind every installation."
- Stat row, 4 columns separated by 1px vertical rules:
  - **6+** Years serving Macomb County
  - **Family-Owned** in Clinton Township
  - **Licensed & Insured** Michigan contractor
  - **BBB Torch Awards** Finalist for Ethics
- Motion: the statement reveals line by line as the section scrolls in (masked slide-up, stagger 0.08s). The stats count up or fade in after it.

### 2.4 Core services: split-screen sticky video (`--ink`)
- Section eyebrow: "WHAT WE BUILD"
- **Desktop (≥1024px):** a 50/50 grid.
  - **Left:** a video panel, `position: sticky; top: 0; height: 100vh`. All four service videos are stacked absolutely in the panel. Only the active one has `opacity: 1`, with a 0.7s `power2.inOut` crossfade. Only the active video plays; the others pause.
  - Bottom-left of the panel overlay: a large index counter ("01 / 04") in Barlow Condensed with the current number in accent, plus a thin progress bar.
  - **Right:** four service blocks, each about `100vh` tall with content vertically centered, separated by 1px `--rule-dark` lines. Each ScrollTrigger (`start: "top center"`, `end: "bottom center"`) sets the active index.
  - Inactive blocks dim to 35% opacity; the active block is at 100%.
- **Mobile (<1024px):** no sticky panel. Each block shows its own 4:5 video above the text, played and paused by IntersectionObserver.
- Blocks:
  1. **01 — ROOFING:** "Full roof replacement and new installs with CertainTeed systems engineered for Michigan snow loads, ice dams, and high winds. Storm damage? We handle your insurance claim from inspection to final shingle." Link: "Get a Roofing Estimate →"
  2. **02 — SIDING:** "Vinyl, insulated vinyl, and fiber cement siding, including Mastic Quest™ and Carvedwood® 44, installed by a Mastic Elite Contractor. Trim, soffit, and fascia finished to match." Link: "Get a Siding Estimate →"
  3. **03 — WINDOWS:** "Energy-efficient replacement windows from Alside, CertainTeed, and Pella, including triple-pane options. Full-frame or insert installs that cut drafts and energy bills." Link: "Get a Window Estimate →"
  4. **04 — GUTTERS:** "Seamless gutters and gutter guards sized to your roofline, so water goes exactly where it should." Link: "Get a Gutter Estimate →"
- Below the four blocks, a single slim row: "ALSO: ATTIC INSULATION. Keep the heat you're paying for." plus a "Get an Insulation Estimate →" link.
- **Each "Get a … Estimate" link** scrolls to `#estimate` and **preselects that service** in the form's Service Needed field (pass the value through shared client state or a URL hash param).

### 2.5 Proof: storm-damaged to The Shelby Standard (`--bone`)
- Eyebrow: "STORM DAMAGE & INSURANCE CLAIMS"
- H2 (oversized): "FROM STORM-DAMAGED TO THE SHELBY STANDARD."
- Sub: "Hail, wind, and Michigan winters take a toll. We inspect your roof, show you exactly what we find, and work with your insurance company to rebuild it right." [PITCH COPY]
- Media: a full-width video frame with `--bone` margins. The `ProofMedia` component supports two modes via `media.ts`:
  - `mode: "video"` (default now): the auto-playing looping `proofMorph` video.
  - `mode: "slider"`: a draggable before/after comparison of `proofBefore` and `proofAfter`, with a vertical accent handle and keyboard support (arrow keys). Build it now even though video mode is the default; real job photos will use it.
- Motion: on scroll in, the media frame expands from `clip-path: inset(8% 6%)` to `inset(0)`, scrubbed.
- CTA: "Book a Free Storm Inspection", a accent button that scrolls to `#estimate` and preselects Roofing.

### 2.6 Reviews (`--slate`, blueprint texture)
- Eyebrow: "REVIEWS"
- H2: "WE MAKE YOUR NEIGHBORS JEALOUS."
- Rating summary: a large "4.7" with five stars and "130 Google Reviews" (from `site.ts`).
- Three review cards in `--slate-raised`, 1px `--rule-dark` borders, sharp corners. Each shows stars, review text, the reviewer's first name and last initial, and their city if available.
- **Content lives in `src/content/reviews.ts` as three placeholder entries.** `text: "[PASTE VERBATIM REVIEW TEXT]"`, `name: "[First L.]"`, `rating: 5`. Add a top-of-file comment saying they must be copied verbatim from Google and never invented or edited. **Do not write fake review text under any circumstances.**

### 2.7 How it works (`--bone`) [PITCH COPY]
- Eyebrow: "THE PROCESS". H2: "FOUR STEPS. NO SURPRISES."
- A 4-column horizontal row with large index numbers (01–04) and 1px rules between columns:
  1. **Free Inspection:** "We inspect your roof, siding, or windows and show you exactly what we find."
  2. **Clear Estimate:** "A straightforward quote with no pressure and no surprises."
  3. **Insurance Handled:** "Storm damage? We work with your insurance company so you don't have to."
  4. **Install & Walkthrough:** "Certified crews install, clean up, and walk the finished job with you."
- Motion: the columns stagger in, and a 1px accent line draws left to right across the top as the section scrolls.

### 2.8 Financing and pricing (`--bone`, sharing the background with 2.7 but separated by a 1px rule)
- Eyebrow: "FINANCING & PRICING"
- H2: "$0 DOWN. LOW MONTHLY PAYMENTS."
- Sub: "On all Michigan home improvement projects. Here's what homeowners typically invest; no hiding numbers until the end."
- Three price cards (Roof / Windows / Siding) in a grid: service name, the range in large Barlow Condensed, the average beneath it, and the per-window note for Windows. White cards with 1px `--rule-light` borders.
- Disclaimer and financing footnote in small muted text below.
- CTA: "Check Financing Options", a dark (`--ink`) high-contrast button. **On click it opens the chatbot** with a financing intent, so the bot leads with financing.

### 2.9 Estimate form (`id="estimate"`, `--ink`, blueprint texture)
- Two columns on desktop.
  - Left: eyebrow "FREE ESTIMATE", H2 "LET'S LOOK AT YOUR PROJECT.", a short line "Tell us what you need and a Shelby project specialist will reach out to schedule your free inspection." [PITCH COPY], then the phone and hours: "Prefer to talk? 833-6-SHELBY · 7am–9pm, 7 days."
  - Right: the form.
- Fields (keep exactly these): Name*, City*, Email*, Phone*, Service Needed* (select: Roofing, Windows, Siding, Insulation, Gutters & Gutter Protection), Message (optional textarea).
- Inputs: `--slate-raised` background, 1px `--rule-dark` border, accent focus border, uppercase Barlow Condensed labels.
- Validation: client-side; required fields, email format, and a US phone format (auto-format as the user types). Errors appear inline under each field.
- **Submit makes no network call.** It shows a 600ms loading state, then replaces the form with a success panel: a check icon, "REQUEST RECEIVED.", and "A Shelby project specialist will contact you shortly to schedule your free inspection."

### 2.10 Footer (`--ink`)
- 4 columns separated by 1px rules:
  1. Logo (light variant), a one-line story ("Family-owned in Clinton Township. Named after the owner's daughter."), and the credentials list.
  2. Contact: phone, email, address, hours.
  3. Service areas: Macomb County.
  4. Service areas: Oakland County, plus St. Clair County and Grosse Pointe.
- A bottom bar: promo terms in small print, "© 2026 Shelby Construction Services", and on the right a subtle "Concept by GSX Solutions".

---

## 3. AI chatbot: "Shelby Assistant"

### UI
- **FAB:** fixed bottom-right with 24px offsets (16px below 640px). A square accent button (56px; 48px on phones, no rounding) with a message icon; the label "Get an Instant Quote" is its accessible name and slides in beside it on hover/focus so the button never covers trust badges or CTAs. A slow, subtle accent pulse ring repeats every ~4s. It's hidden while the panel is open.
- **Panel:** 400×620 on desktop and full-screen on mobile, `--slate` background, 1px `--rule-dark` border, sharp corners, opened with a slide-up and fade.
  - Header: "SHELBY ASSISTANT", a green "Online" dot, the subline "Typically replies instantly", and a close button.
  - Messages: user bubbles in `--slate-raised` aligned right; bot messages are plain text aligned left. Bot replies stream token by token, with a typing indicator before the first token.
  - Opening message: "Hi! I'm Shelby's virtual assistant. I can answer questions, give you typical pricing, and set up your free estimate. What are you looking to get done?"
  - Quick-reply chips under the opening message: "Roof replacement" · "Storm damage" · "Siding" · "Windows" · "Financing"
  - Input with a send button; Enter sends.
- **Lead Captured card:** when a lead is captured, render a distinct card in the thread with a accent top border, "LEAD CAPTURED ✓", and a summary of every field. This is the key demo moment, so make it look polished.
- Opening from "Check Financing Options" sends a hidden context flag so the bot opens with: "Happy to help with financing. We offer $0 down with low monthly payments on all projects. What project are you considering?"

### Backend: `src/app/api/chat/route.ts`
- Use `@anthropic-ai/sdk` with model **`claude-haiku-5-5`**, streaming responses, `max_tokens: 400`. Verify current SDK streaming and tool-use syntax through Context7.
- **System prompt** (put it in `src/lib/chat/system-prompt.ts` and inject the business facts from `site.ts`):
  - You are Shelby Construction Services' virtual assistant. Be friendly, confident, and concise: at most 3 short sentences per reply, plain language, no markdown headers.
  - Answer only from the provided business facts. If you don't know, say a project specialist will confirm, and keep qualifying.
  - Pricing: give only the published typical ranges, framed as "typical Metro Detroit ranges"; final pricing comes after a free inspection. Never quote a firm price.
  - Insurance: say we're insurance claim specialists and will work with the insurance company. Never promise coverage, approval, or outcomes.
  - Financing: $0 down with low monthly payments, subject to credit approval. Never quote rates or terms.
  - Goal: qualify and capture the lead naturally, one question at a time. Collect: service, city, timeline (ASAP / 1–3 months / just researching), storm damage or insurance claim (yes/no), full name, phone; email is optional.
  - Once you have name, phone, service, and city, call the `capture_lead` tool, then confirm warmly that a specialist will call, and mention they can also call 833-6-SHELBY, 7am–9pm, 7 days.
  - Stay on topic; politely redirect off-topic requests.
- **Tool `capture_lead`:** fields `name`, `phone`, `email?`, `service`, `city`, `timeline?`, `storm_or_insurance?`, `notes?`. On the server, validate the input, append it to `/data/leads.json` (create it if missing; gitignored), log a one-line summary to the server console, and stream an event to the client that renders the Lead Captured card.
- Limits: 30 turns per conversation (after that, point to the phone number), and basic input length caps.

### Scripted fallback (required)
- If `ANTHROPIC_API_KEY` is missing **or** any API call fails, the client silently switches to a scripted state machine in `src/lib/chat/scripted-flow.ts`. It asks the same questions in order (service → city → storm/insurance → timeline → name → phone → optional email), answers the quick-reply chips with canned facts from `site.ts`, and ends with the same Lead Captured card.
- Log the fallback to the browser console in dev only. Show no error to the user; the demo must never break.
- Unit-test the state machine and the lead validation.

---

## 4. Build phases

1. **Foundation:** scaffold, tokens, fonts, Lenis + GSAP setup, content files (`site.ts`, `media.ts`, `reviews.ts`), the logo variant, the placeholder media component, the `process-media.sh` script, the header, and the hero. **Stop here, send me screenshots (1440 and 390), and wait for approval.**
2. **Story & services:** The Shelby Standard and the sticky services section, including the mobile fallback and the service-preselect wiring.
3. **Proof & trust:** the Proof section (both modes), Reviews, How It Works, and Financing & Pricing.
4. **Conversion:** the estimate form and the footer.
5. **Chatbot:** the UI, the API route, the `capture_lead` tool, the scripted fallback, and tests.
6. **Polish & QA:** the reduced-motion pass, the mobile pass, console cleanup, and full Playwright screenshot verification of every section at both sizes. Fix everything you find. Then give me a short README section covering how to run the site, add media (`/assets-raw/` → `npm run media`), paste reviews, and set the API key.

## 5. Definition of done
- `npm run dev` runs with no console errors or hydration warnings.
- Every section matches this spec at 1440px and looks presentable at 390px.
- The sticky services section crossfades to the correct video at each block, in both directions.
- Every "Get a … Estimate" link preselects the right service in the form.
- The form validates and shows the success state with no network call.
- The chatbot completes a full qualification and shows the Lead Captured card, **with the API key and without it** (scripted fallback).
- Missing media shows labeled placeholders and nothing breaks.
- No invented reviews, awards, prices, or facts anywhere.
