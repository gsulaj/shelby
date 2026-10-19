// Contact sheet for the services v2 clips (SERVICES_BRIEF.md §5): per clip, the delivered first frame (poster), its
// three 100% subject crops, the hero's shingle-field crop for comparison, and the measured numbers.
// Usage: node scripts/svc-quality-sheet.mjs <qc-out-dir with metrics.json> <out.jpg>
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { textPng } from "./video-metrics.mjs";

const [DIR, OUT] = process.argv.slice(2);
if (!DIR || !OUT) {
  console.error("usage: node scripts/svc-quality-sheet.mjs <qc-out-dir> <out.jpg>");
  process.exit(1);
}
const M = JSON.parse(readFileSync(`${DIR}/metrics.json`, "utf8"));
const KEYS = ["roofing", "siding", "windows", "gutters"].filter((k) => M.clips[k]);
const C = 400; // crop size (100%)
const GAP = 12;
const LABEL_H = 34;
const TEXT_W = 520;
const ROW_H = C + LABEL_H + GAP;
const W = GAP + C + GAP + 3 * (C + GAP) + C + GAP + TEXT_W + GAP;
const HEAD_H = 150;
const H = HEAD_H + KEYS.length * ROW_H + GAP;
const bg = "#0F1216";
const heroBar = M.bars.sharpness;
const heroFl = M.hero.flicker;
const heroCrop = M.hero.sharpness[0];

const tiles = [];
const put = (input, left, top) => tiles.push({ input, left, top });
put(
  await textPng(
    [
      { text: "Services v2 — quality sheet (100% crops at the 2160 px delivery scale, grain-free graded masters)", size: 30, weight: 700 },
      { text: `Hero baseline (shingle field, grain-free): sharpness ${M.hero.sharpness.map((c) => c.lv.toFixed(1)).join(" / ")} → bar ${heroBar.toFixed(1)} (Laplacian variance of a 400 px crop)`, size: 21 },
      { text: `Hero flicker ratio (1 − detail-coherence efficiency, hero shimmer method): mean ${heroFl.mean.toFixed(3)}, 90th pct ${heroFl.p90.toFixed(3)}; 4-frame pulse median ±${(100 * heroFl.pulseMedian).toFixed(1)}%, max ±${(100 * heroFl.pulseMax).toFixed(1)}% (bar ±27%)`, size: 21 },
      { text: "Columns: delivered poster (first frame) · three 100% subject crops · the hero's 100% shingle crop (2 s) · numbers", size: 21, color: "#9AA3AE" },
    ],
    W,
    HEAD_H,
    { bg },
  ),
  0,
  0,
);

const label = (t) => textPng(t, C, LABEL_H, { size: 18, bg, color: "#9AA3AE" });
for (const [r, key] of KEYS.entries()) {
  const c = M.clips[key];
  const top = HEAD_H + r * ROW_H;
  let x = GAP;
  put(await sharp(`public/media/${key}-poster.jpg`).resize(C, C).png().toBuffer(), x, top);
  put(await label(`${c.label}: poster`), x, top + C);
  x += C + GAP;
  for (const crop of c.sharpness) {
    put(await sharp(crop.png).png().toBuffer(), x, top);
    put(await label(`${crop.t}s ${crop.label ?? ""}: ${crop.lv.toFixed(1)} (${(crop.lv / heroBar).toFixed(2)}×)`), x, top + C);
    x += C + GAP;
  }
  put(await sharp(heroCrop.png).png().toBuffer(), x, top);
  put(await label(`hero ${heroCrop.t}s shingles: ${heroCrop.lv.toFixed(1)}`), x, top + C);
  x += C + GAP;
  const F = c.flicker;
  const worstBow = Math.max(0, ...c.geometry.flatMap((g) => g.lines.map((l) => l.bow)));
  const lines = c.geometry.reduce((n, g) => n + g.lines.length, 0);
  const text = [
    { text: c.label.toUpperCase(), size: 26, weight: 700 },
    { text: `Sharpness min ${Math.min(...c.sharpness.map((q) => q.lv)).toFixed(1)} vs hero ${heroBar.toFixed(1)}`, size: 20 },
    F && F.mean != null
      ? { text: `Flicker ratio mean ${F.mean.toFixed(3)} (hero ${heroFl.mean.toFixed(3)}), worst ${F.worst.toFixed(3)}`, size: 20 }
      : { text: "Flicker: not measured", size: 20 },
    F && F.pulseMax != null ? { text: `Pulse median ±${(100 * F.pulseMedian).toFixed(1)}%, max ±${(100 * F.pulseMax).toFixed(1)}%`, size: 20 } : { text: "", size: 20 },
    { text: `Lines: ${lines} measured, worst bow ${worstBow.toFixed(2)} px`, size: 20 },
    { text: c.pass ? "All numeric bars met" : `Exceeds: ${c.fails.length} item(s), see report`, size: 20, color: c.pass ? "#7BD88F" : "#F2B84B" },
  ];
  put(await textPng(text, TEXT_W, C, { bg }), x, top);
}

await sharp({ create: { width: W, height: H, channels: 3, background: bg } }).composite(tiles).jpeg({ quality: 88 }).toFile(OUT);
console.log(`${OUT}: ${W}×${H}`);
