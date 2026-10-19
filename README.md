# Shelby Construction Services — homepage prototype

A local-only pitch prototype of a premium, cinematic homepage for Shelby Construction Services
(Clinton Township, MI), built by GSX Solutions. It is not deployed and not SEO-optimized; it is
meant to look finished in a live demo on a laptop and to be presentable on a phone.

Spec: `BUILD_SPEC.md` (what) and `CLAUDE.md` (how). Build plan: `docs/superpowers/plans/`.

## Run the site

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. Checks: `npm test` (logic tests), `npm run lint`, `npx tsc --noEmit`.

## Add media

Every section renders a labeled placeholder until its media exists. To swap in real footage:

1. Drop the raw files into `assets-raw/` using these exact names:

   | File | Used in |
   |---|---|
   | `hero-flyover.mp4` | Hero background (16:9) |
   | `svc-roofing.mp4`, `svc-siding.mp4`, `svc-windows.mp4`, `svc-gutters.mp4` | Services (1:1) |
   | `proof-morph.mp4` | Proof section, video mode (16:9) |
   | `proof-before.jpg`, `proof-after.jpg` | Proof section, slider mode (16:9) |

2. Run `npm run media`. It uses `ffmpeg` from your PATH, or the bundled `ffmpeg-static` fallback,
   and writes MP4 + WebM + poster (videos) and JPG + WebP (stills) into `public/media/`, raising
   the CRF until each file fits its size budget.
3. Restart `npm run dev`. Paths live in `src/content/media.ts`; flip `proofMode` there to
   `"slider"` to use the before/after comparison instead of the morph video.

## Paste reviews

Edit `src/content/reviews.ts`. Every entry must be copied verbatim from the Google Business
Profile: never invent, paraphrase, or edit review text. Use the reviewer's first name and last
initial, and a city only if it appears on the review.

## Chatbot (Chatling)

The chat bubble is the Chatling widget (chatbot ID `2823318974`), loaded once in `src/app/layout.tsx`
with `next/script` (`afterInteractive`). Its answers, greeting and styling are managed in the Chatling
dashboard, not in this repo. The pricing section’s "Check Financing Options" button opens it through
`window.Chatling.open()` (`src/lib/chatling.ts`). No API key is needed.

## Screenshots

With the dev server running:

```bash
npm run shots -- --out docs/screenshots/latest --scrolled-header --at "#standard" --at "#svc-roofing" --at "#svc-siding" --at "#svc-windows" --at "#svc-gutters" --at "#proof" --at "#reviews" --at "#process" --at "#pricing" --at "#estimate" --at footer
```

Captures 1440×900 and 390×844, the header's hidden and revealed states, and each section.
Add `--reduced-motion` to check the reduced-motion rendering.
