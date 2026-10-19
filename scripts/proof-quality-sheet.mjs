// Quality sheet for the proof morph v2 (PROOF_BRIEF.md step 7): D0, D_last and F0; a 100% shingle crop of each clip next
// to the hero's; the seam's edge overlay; the measured numbers.
// Usage: node scripts/proof-quality-sheet.mjs <qc-dir with metrics.json> <seam json> <seam overlay jpg> <notes.json> <out.jpg>
//   notes.json: { "lines": ["…" | { "text", "color" }, …] } — the playback, speed and seam figures measured elsewhere.
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { textPng } from "./video-metrics.mjs";

const [QC, SEAM, OVERLAY, NOTES, OUT] = process.argv.slice(2);
if (!OUT) {
  console.error("usage: node scripts/proof-quality-sheet.mjs <qc-dir> <seam.json> <overlay.jpg> <notes.json> <out.jpg>");
  process.exit(1);
}
const M = JSON.parse(readFileSync(`${QC}/metrics.json`, "utf8"));
const S = JSON.parse(readFileSync(SEAM, "utf8"));
const notes = JSON.parse(readFileSync(NOTES, "utf8")).lines;
const bg = "#0F1216";
const GAP = 14;
const TW = 760; // still thumbnail width (16:9)
const TH = Math.round((TW * 9) / 16);
const C = 400;
const LABEL_H = 34;
const W = GAP + 3 * (TW + GAP);
const HEAD_H = 120;
const heroBar = M.bars.sharpness;
const heroCrop = M.hero.sharpness[0];
const tiles = [];
const put = (input, left, top) => tiles.push({ input, left, top });
const label = (t, w = C) => textPng(t, w, LABEL_H, { size: 18, bg, color: "#9AA3AE" });

put(
  await textPng(
    [
      { text: "Proof morph v2 — quality sheet (100% crops at 3840 px, grain-free graded clips)", size: 30, weight: 700 },
      { text: `Hero baseline (shingle field, grain-free): sharpness ${M.hero.sharpness.map((c) => c.lv.toFixed(1)).join(" / ")} → bar ${heroBar.toFixed(1)}; flicker ratio mean ${M.hero.flicker.mean.toFixed(3)}, 90th pct ${M.hero.flicker.p90.toFixed(3)}`, size: 21 },
      { text: "Row 1: D0 (damaged start still) · D_last (Clip D's last frame) · F0 (edit of D_last). Rows 2–3: three 100% crops per clip + the hero's crop.", size: 21, color: "#9AA3AE" },
    ],
    W,
    HEAD_H,
    { bg },
  ),
  0,
  0,
);

let top = HEAD_H;
const stills = [
  ["assets-raw/proof/D0.png", "D0 — damaged start still (Nano Banana Pro 4K edit)"],
  ["assets-raw/proof-before.jpg", "D_last — Clip D's last frame, graded (= proof-before)"],
  ["assets-raw/proof-after.jpg", "F0 — edit of D_last, as Clip F's first frame, graded (= proof-after)"],
];
for (const [i, [p, t]] of stills.entries()) {
  put(await sharp(p).resize(TW, TH, { fit: "cover" }).png().toBuffer(), GAP + i * (TW + GAP), top);
  put(await label(t, TW), GAP + i * (TW + GAP), top + TH);
}
top += TH + LABEL_H + GAP;

for (const key of ["D", "F"]) {
  const c = M.clips[key];
  let x = GAP;
  for (const crop of c.sharpness) {
    put(await sharp(crop.png).png().toBuffer(), x, top);
    put(await label(`${key} ${crop.t}s: ${crop.lv.toFixed(1)} (${(crop.lv / heroBar).toFixed(2)}× hero)`), x, top + C);
    x += C + GAP;
  }
  put(await sharp(heroCrop.png).png().toBuffer(), x, top);
  put(await label(`hero ${heroCrop.t}s shingles: ${heroCrop.lv.toFixed(1)}`), x, top + C);
  x += C + GAP;
  const F = c.flicker;
  put(
    await textPng(
      [
        { text: c.label.toUpperCase(), size: 24, weight: 700 },
        { text: `Sharpness min ${Math.min(...c.sharpness.map((q) => q.lv)).toFixed(1)} vs hero ${heroBar.toFixed(1)}`, size: 19 },
        F?.mean != null ? { text: `Flicker ratio mean ${F.mean.toFixed(3)} (hero ${M.hero.flicker.mean.toFixed(3)}), worst ${F.worst.toFixed(3)}`, size: 19 } : { text: "Flicker: not measured", size: 19 },
        F?.pulseMax != null ? { text: `4-frame pulse max ±${(100 * F.pulseMax).toFixed(1)}% (bar ±27%)`, size: 19 } : { text: "", size: 19 },
      ],
      W - x - GAP,
      C,
      { bg },
    ),
    x,
    top,
  );
  top += C + LABEL_H + GAP;
}

const OW = 2 * TW + GAP;
const OH = Math.round((OW * 1080) / 1920);
put(await sharp(OVERLAY).resize(OW, OH, { fit: "cover" }).png().toBuffer(), GAP, top);
put(await label("Seam: D_last edges red, F0 edges cyan, both white (structural edges, σ 3)", OW), GAP, top + OH);
const C2 = S.courses;
put(
  await textPng(
    [
      { text: "SEAM AND PLAYBACK", size: 24, weight: 700 },
      { text: `Course lines: |offset| median ${C2.medianAbsOffsetPx} px, p90 ${C2.p90AbsOffsetPx} px at 3840`, size: 19 },
      { text: `Course correlation median ${C2.medianCorr} (aligned frames: 0.94)`, size: 19 },
      { text: `Structural edges within 2 px: ${(100 * S.regions[0].atZero.matchShare).toFixed(0)}%`, size: 19 },
      ...notes.map((t) => (typeof t === "string" ? { text: t, size: 19 } : { size: 19, ...t })),
    ],
    TW,
    OH + LABEL_H,
    { bg },
  ),
  GAP + OW + GAP,
  top,
);
top += OH + LABEL_H + GAP;

await sharp({ create: { width: W, height: top, channels: 3, background: bg } }).composite(tiles).jpeg({ quality: 88 }).toFile(OUT);
console.log(`${OUT}: ${W}×${top}`);
