// Before/after sheet for the hero sharpness pass (docs/HERO_RESUME.md): 100% crops of the previous and the new hero at
// fixed times, with sharpness numbers.
// Usage: node scripts/hero-before-after.mjs <config.json> <out-dir> [--map]
//   config.json: { "times": [2, 7, 12], "crops": [{ "t": 2, "label": "shingles", "cx": 1200, "cy": 900 }, ...],
//                  "videos": [{ "key", "label", "path", "w", "h", "dx", "role": "old"|"new", "pair": "delivered"|"clean" }] }
//   Crop centres are in the new hero's 3840×2160 frame. Each video is scaled to w×h and sits dx px from the grid's left
//   edge (a centre crop has a negative dx). Old crops are aligned to the new ones by block matching (± 24 px, on luma
//   blurred σ 1.5), because the old and new loops frame clip 2 a few tenths of a percent differently.
//   --map draws the crop boxes on the new frames and exits.
//
// Sharpness = Laplacian variance of the luma crop. Grain is per-pixel noise and inflates it, and the old hero's grain was
// averaged down to 2560 px, so two pairs are compared: the delivered files (what a 4k screen shows; the 2560 file
// upscaled with lanczos) and grain-free graded masters of both loops (the honest detail comparison).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { blur, cropPlane, grabFrames, laplacianVariance, matchTile, rgbPng, textPng, yuvToRgb } from "./video-metrics.mjs";

const [cfgPath, OUT, flag] = process.argv.slice(2);
if (!cfgPath || !OUT) {
  console.error("usage: node scripts/hero-before-after.mjs <config.json> <out-dir> [--map]");
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });
const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
const FPS = 24;
const C = 400;
const SEARCH = 24;
const frameOf = (t) => Math.round(t * FPS);

/** Decode the frames at cfg.times of one video and return full luma/chroma planes per frame. */
async function frames(v) {
  const out = new Map();
  await grabFrames(v.path, cfg.times.map(frameOf), { w: v.w, h: v.h }, (f, p) => out.set(f, { y: Buffer.from(p.y), u: Buffer.from(p.u), v: Buffer.from(p.v), w: p.w, h: p.h }));
  return out;
}

if (flag === "--map") {
  const v = cfg.videos.find((q) => q.role === "new" && q.pair === "delivered");
  const fr = await frames(v);
  for (const t of cfg.times) {
    const p = fr.get(frameOf(t));
    const rgb = yuvToRgb(p.y, p.u, p.v);
    const boxes = cfg.crops.filter((c) => c.t === t);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${p.w}" height="${p.h}">${boxes
      .map((b) => `<rect x="${b.cx - C / 2 - v.dx}" y="${b.cy - C / 2}" width="${C}" height="${C}" fill="none" stroke="#0ff" stroke-width="6"/><text x="${b.cx - C / 2 - v.dx + 10}" y="${b.cy - C / 2 + 50}" font-size="44" fill="#0ff" font-family="Helvetica">${b.label}</text>`)
      .join("")}</svg>`;
    await sharp(rgb, { raw: { width: p.w, height: p.h, channels: 3 } }).composite([{ input: Buffer.from(svg) }]).resize(1280).jpeg({ quality: 85 }).toFile(join(OUT, `map-${t}s.jpg`));
  }
  console.log(`maps written to ${OUT}`);
  process.exit(0);
}

const decoded = {};
for (const v of cfg.videos) decoded[v.key] = await frames(v);

const rows = [];
for (const c of cfg.crops) {
  const f = frameOf(c.t);
  const row = { ...c, frame: f, cells: {} };
  const x = Math.round(c.cx - C / 2);
  const y = Math.round(c.cy - C / 2);
  for (const pair of ["delivered", "clean"]) {
    const nv = cfg.videos.find((q) => q.pair === pair && q.role === "new");
    const ov = cfg.videos.find((q) => q.pair === pair && q.role === "old");
    if (!nv || !ov) continue;
    const np = decoded[nv.key].get(f);
    const op = decoded[ov.key].get(f);
    const nY = cropPlane(np.y, np.w, np.h, x, y, C, C, nv.dx, 0);
    // align: the new crop (blurred) searched for in a window of the old picture around the nominal position
    const W = C + 2 * SEARCH;
    const oWin = cropPlane(op.y, op.w, op.h, x - SEARCH, y - SEARCH, W, W, ov.dx, 0);
    const nWin = new Float32Array(W * W);
    const nb = blur(nY, C, C, 1.5);
    for (let j = 0; j < C; j++) for (let i = 0; i < C; i++) nWin[(j + SEARCH) * W + i + SEARCH] = nb[j * C + i];
    const m = matchTile(nWin, blur(oWin, W, W, 1.5), W, W, { x: SEARCH, y: SEARCH, s: C }, 0, 0, SEARCH - 1);
    const ox = x + Math.round(m.dx);
    const oy = y + Math.round(m.dy);
    const oY = cropPlane(op.y, op.w, op.h, ox, oy, C, C, ov.dx, 0);
    const rgbOf = (p, vv, cx0, cy0) => yuvToRgb(cropPlane(p.y, p.w, p.h, cx0, cy0, C, C, vv.dx, 0), cropPlane(p.u, p.w, p.h, cx0, cy0, C, C, vv.dx, 0), cropPlane(p.v, p.w, p.h, cx0, cy0, C, C, vv.dx, 0));
    const lvNew = laplacianVariance(nY, C, C);
    const lvOld = laplacianVariance(oY, C, C);
    row.cells[pair] = { lvOld, lvNew, ratio: lvNew / lvOld, shift: [Math.round(m.dx), Math.round(m.dy)], rgbOld: rgbOf(op, ov, ox, oy), rgbNew: rgbOf(np, nv, x, y) };
  }
  rows.push(row);
  console.log(
    `${c.t}s ${c.label.padEnd(12)} ` +
      Object.entries(row.cells)
        .map(([k, q]) => `${k}: old ${q.lvOld.toFixed(1)} → new ${q.lvNew.toFixed(1)} (${q.ratio.toFixed(2)}×, align ${q.shift.join(",")})`)
        .join(" | "),
  );
}
const pairs = Object.keys(rows[0].cells);
const verdict = Object.fromEntries(pairs.map((k) => [k, { min: Math.min(...rows.map((r) => r.cells[k].ratio)), allSharper: rows.every((r) => r.cells[k].ratio > 1) }]));
writeFileSync(join(OUT, "before-after.json"), JSON.stringify({ times: cfg.times, crop: C, rows: rows.map((r) => ({ ...r, cells: Object.fromEntries(Object.entries(r.cells).map(([k, q]) => [k, { lvOld: q.lvOld, lvNew: q.lvNew, ratio: q.ratio, shift: q.shift }])) })), verdict }, null, 2));

// sheet: per crop row, the pairs side by side (old | new)
const LABEL_W = 170;
const CAP = 34;
const HEAD = 130;
const cols = pairs.flatMap((k) => [
  { pair: k, side: "old", label: cfg.videos.find((q) => q.pair === k && q.role === "old").label },
  { pair: k, side: "new", label: cfg.videos.find((q) => q.pair === k && q.role === "new").label },
]);
const W = LABEL_W + cols.length * C + (pairs.length - 1) * 20;
const colX = (i) => LABEL_W + i * C + Math.floor(i / 2) * 20;
const summary = pairs.map((k) => `${k}: new/old sharpness ${rows.map((r) => r.cells[k].ratio.toFixed(2)).join(" · ")} → min ${verdict[k].min.toFixed(2)}× (${verdict[k].allSharper ? "sharper on every crop" : "NOT sharper everywhere"})`);
const TABLE_H = 40 + 30 * summary.length;
const H = HEAD + rows.length * (C + CAP) + TABLE_H;
const comps = [
  {
    input: await textPng(
      [
        { text: "Hero sharpness pass — before / after, 100% crops 400×400 on the 3840×2160 frame", size: 30, weight: 700 },
        { text: "delivered: previous hero.mp4 (2560 px, upscaled to 3840 with lanczos) vs the new 3840 hero.mp4 · clean: the same grade without grain, old 3870 master vs new 3884 master (centre crop 3840)", size: 19, color: "#9AA3AE" },
      ],
      W,
      HEAD - 40,
    ),
    left: 0,
    top: 0,
  },
];
for (let i = 0; i < cols.length; i++) comps.push({ input: await textPng(cols[i].label, C, 40, { size: 19, weight: 700, color: cols[i].side === "new" ? "#00AEEF" : "#ECEAE6" }), left: colX(i), top: HEAD - 40 });
for (let k = 0; k < rows.length; k++) {
  const r = rows[k];
  const top = HEAD + k * (C + CAP);
  comps.push({ input: await textPng([`${r.t} s`, r.label], LABEL_W, C, { size: 22, weight: 700 }), left: 0, top });
  for (let i = 0; i < cols.length; i++) {
    const q = r.cells[cols[i].pair];
    comps.push({ input: await rgbPng(cols[i].side === "old" ? q.rgbOld : q.rgbNew, C, C), left: colX(i), top });
    const caption = cols[i].side === "old" ? `LV ${q.lvOld.toFixed(1)}` : `LV ${q.lvNew.toFixed(1)}  (${q.ratio.toFixed(2)}× old)`;
    comps.push({ input: await textPng(caption, C, CAP, { size: 18, mono: true, color: cols[i].side === "old" ? "#9AA3AE" : q.ratio > 1 ? "#ECEAE6" : "#F2A0A0" }), left: colX(i), top: top + C });
  }
}
comps.push({ input: await textPng(summary.map((s) => ({ text: s, mono: true })), W, TABLE_H, { size: 18, bg: "#1A1F26" }), left: 0, top: HEAD + rows.length * (C + CAP) });
await sharp({ create: { width: W, height: H, channels: 3, background: "#0F1216" } }).composite(comps).jpeg({ quality: 88, mozjpeg: true }).toFile(join(OUT, "before-after.jpg"));
for (const s of summary) console.log(s);
