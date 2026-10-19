// Hero upscale shootout on clip 1 (docs/HERO_RESUME.md, sharpness pass): measure each upscaler's output of the raw Kling
// clip against the source and the current hero, then render a comparison sheet.
// Usage: node scripts/hero-upscale-shootout.mjs <candidates.json> <out-dir> [--map]
//   candidates.json: [{ "key", "label", "path", "pre"? }] — upscaler outputs of assets-raw/originals/hero-v2-clip1.mp4
//   --map only draws the crop and tracking boxes on the source frames (to check placement) and exits.
//
// Checks (all on a common grid: the clip's full picture scaled to 2160 px high = 3884×2160):
//  a. detail    Laplacian variance (luma) of 400×400 crops — shingles, brick, stone tower — at frames 15, 72, 129.
//  b. temporal  over 24 consecutive frames on four regions (shingles, two brick walls, the stone tower gable): per 128 px tile the camera motion is found on the
//               source and refined per candidate; then the fine-detail band (luma − Gaussian σ 2) of frame t is compared
//               with frame t+1 shifted back. coherence = 2Σab / (Σa² + Σb²): 1 = detail moves rigidly with the scene,
//               0 = the texture is re-invented every frame (boiling). Crisper detail scores lower even when it is rigid
//               (sub-pixel registration, zoom inside a tile), so each video gets its own ceiling: frame t warped by the
//               affine fit of the measured motion is a perfectly rigid "next frame"; efficiency = coherence / ceiling.
//               Also: the 4-frame sharpness pulse (Kling's VAE groups 4 frames per latent and upscalers amplify that
//               rhythm into a 6 Hz shimmer), motion-compensated mean |Δluma|, and mean-luma flicker against the source.
//  c. fidelity  SSIM against the source (candidate scaled down to 1928×1072, every frame) and structural edge maps
//               (Gaussian σ 2 + Canny at source size) — F1 within 2 px over the whole frame and over architecture ROIs.
//  d. colour    mean Y/U/V at source size every 12 frames against the source (8-bit levels).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import {
  cropPlane,
  detailCoherence,
  edgeF1,
  edgeMaps,
  estimateMotion,
  fitAffine,
  grabFrames,
  highpass,
  laplacianVariance,
  matchTile,
  mean,
  probe,
  rgbPng,
  sampleShifted,
  ssimSeries,
  textPng,
  tileOf,
  warpAffine,
  yuvToRgb,
} from "./video-metrics.mjs";

const SRC = "assets-raw/originals/hero-v2-clip1.mp4";
const SW = 1928;
const SH = 1072;
const GRID = { w: 3884, h: 2160 };
const CROP = 400;

// 100% crops, centres in grid coordinates
const CROPS = [
  { frame: 15, label: "shingles", cx: 960, cy: 900 },
  { frame: 15, label: "brick", cx: 3270, cy: 1140 },
  { frame: 15, label: "stone tower", cx: 2160, cy: 1080 },
  { frame: 72, label: "shingles", cx: 1680, cy: 900 },
  { frame: 72, label: "brick", cx: 3630, cy: 1800 },
  { frame: 72, label: "stone tower", cx: 2700, cy: 900 },
  { frame: 129, label: "shingles", cx: 1200, cy: 1500 },
  { frame: 129, label: "brick", cx: 2640, cy: 1410 },
  { frame: 129, label: "stone tower", cx: 3300, cy: 1440 },
];
// temporal regions: 24 consecutive frames, 512 px window (4×4 tiles of 128) plus a search margin
const TEMPORAL = [
  { label: "shingles", start: 60, n: 24, cx: 1680, cy: 900 },
  { label: "brick", start: 0, n: 24, cx: 2970, cy: 1410 },
  { label: "brick 2", start: 60, n: 24, cx: 3500, cy: 1800 },
  { label: "stone", start: 60, n: 24, cx: 2700, cy: 900 },
];
const WIN = 512;
const MARGIN = 96;
const TILE = 128;
const RANGE = 88;
// architecture ROIs for the edge check (source coordinates)
const ROIS = [
  { frame: 15, label: "tower + arch", x: 894, y: 179, w: 343, h: 596 },
  { frame: 15, label: "right wing windows", x: 1267, y: 596, w: 417, h: 209 },
  { frame: 72, label: "roof lines + tower", x: 924, y: 179, w: 655, h: 804 },
  { frame: 129, label: "gutter + arch", x: 1490, y: 507, w: 438, h: 565 },
];
const EDGE_FRAMES = [15, 72, 129];
const COLOR_FRAMES = Array.from({ length: 13 }, (_, i) => i * 12);

const [cfgPath, outDir, flag] = process.argv.slice(2);
if (!cfgPath || !outDir) {
  console.error("usage: node scripts/hero-upscale-shootout.mjs <candidates.json> <out-dir> [--map]");
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });
const candidates = JSON.parse(readFileSync(cfgPath, "utf8"));

// the reference rows: the source (lanczos to the grid), the current hero's 4k source clip, and the delivered hero.mp4
// (2560×1428 of the 3870-wide stitch: hero frame k = clip frame k + 3 for k < 130, which pass the time-remap untouched)
const videos = [
  { key: "source", label: "Source 1928 (lanczos)", path: SRC, ref: true },
  { key: "current", label: "Current 4k (ByteDance)", path: "assets-raw/originals/hero-v2-clip1-4k.mp4", ref: true },
  { key: "hero", label: "Current hero.mp4 (2560)", path: "public/media/hero.mp4", place: { w: 3872, h: 2160, dx: 6, dy: 0 }, frameOffset: -3, sharpOnly: true, ref: true },
  ...candidates,
];
for (const v of videos) v.place ??= { ...GRID, dx: 0, dy: 0 };

const rect = (c, size = CROP) => ({ x: Math.round(c.cx - size / 2), y: Math.round(c.cy - size / 2) });

if (flag === "--map") {
  // draw crop boxes (white) and temporal windows (cyan) on the source frames, 1/3 scale
  const frames = [...new Set([...CROPS.map((c) => c.frame), ...TEMPORAL.flatMap((t) => [t.start, t.start + t.n - 1])])];
  const shots = new Map();
  await grabFrames(SRC, frames, { w: 1294, h: 720 }, (f, p) => shots.set(f, Buffer.from(yuvToRgb(p.y, p.u, p.v))));
  for (const f of frames) {
    const boxes = [
      ...CROPS.filter((c) => c.frame === f).map((c) => ({ ...rect(c), s: CROP, col: "#fff", t: c.label })),
      ...TEMPORAL.filter((t) => f >= t.start && f < t.start + t.n).map((t) => ({ ...rect(t, WIN), s: WIN, col: "#0ff", t: `${t.label} (temporal)` })),
    ];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1294" height="720">${boxes
      .map((b) => `<rect x="${b.x / 3}" y="${b.y / 3}" width="${b.s / 3}" height="${b.s / 3}" fill="none" stroke="${b.col}" stroke-width="2"/><text x="${b.x / 3 + 4}" y="${b.y / 3 + 16}" font-size="14" fill="${b.col}" font-family="Helvetica">${b.t}</text>`)
      .join("")}</svg>`;
    await sharp(shots.get(f), { raw: { width: 1294, height: 720, channels: 3 } })
      .composite([{ input: Buffer.from(svg) }])
      .jpeg({ quality: 85 })
      .toFile(join(outDir, `map-f${f}.jpg`));
  }
  console.log(`crop map written to ${outDir}`);
  process.exit(0);
}

const results = {};
for (const v of videos) {
  const t0 = Date.now();
  const info = probe(v.path);
  const r = (results[v.key] = { key: v.key, label: v.label, path: v.path, probe: info, crops: [], temporal: {}, ref: !!v.ref });
  const off = v.frameOffset ?? 0;
  const { dx, dy } = v.place;

  // a. detail crops
  const byFrame = new Map(CROPS.map((c) => [c.frame + off, []]));
  CROPS.forEach((c) => byFrame.get(c.frame + off).push(c));
  await grabFrames(v.path, [...byFrame.keys()], v.place, (f, p) => {
    for (const c of byFrame.get(f)) {
      const { x, y } = rect(c);
      const Y = cropPlane(p.y, p.w, p.h, x, y, CROP, CROP, dx, dy);
      const U = cropPlane(p.u, p.w, p.h, x, y, CROP, CROP, dx, dy);
      const V = cropPlane(p.v, p.w, p.h, x, y, CROP, CROP, dx, dy);
      r.crops.push({ frame: c.frame, label: c.label, lapVar: laplacianVariance(Y, CROP, CROP), meanY: mean(Y), rgb: yuvToRgb(Y, U, V) });
    }
  }, { pre: v.pre });
  r.crops.sort((a, b) => CROPS.findIndex((c) => c.frame === a.frame && c.label === a.label) - CROPS.findIndex((c) => c.frame === b.frame && c.label === b.label));
  r.lapVarMean = mean(r.crops.map((c) => c.lapVar));
  if (v.sharpOnly) {
    console.log(`${v.key}: detail ${r.lapVarMean.toFixed(1)} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    continue;
  }

  // b. temporal regions: extended luma windows for 24 consecutive frames
  const E = WIN + 2 * MARGIN;
  for (const tr of TEMPORAL) {
    const ys = [];
    const frames = Array.from({ length: tr.n }, (_, i) => tr.start + i);
    const { x, y } = rect(tr, E);
    await grabFrames(v.path, frames, v.place, (f, p) => ys.push(cropPlane(p.y, p.w, p.h, x, y, E, E, dx, dy)), { pre: v.pre });
    r.temporal[tr.label] = { ys };
  }

  // c. fidelity: SSIM every frame, structural edges at three frames
  if (v.key !== "source") {
    const s = ssimSeries(SRC, v.path, SW, SH, { candPre: v.pre });
    r.ssim = { meanY: mean(s.map((q) => q.y)), minY: Math.min(...s.map((q) => q.y)), meanAll: mean(s.map((q) => q.all)), frames: s.length };
  }
  r.edges = await edgeMaps(v.path, EDGE_FRAMES, SW, SH, { pre: v.pre });

  // d. colour every 12 frames at source size
  r.color = [];
  await grabFrames(v.path, COLOR_FRAMES, { w: SW, h: SH }, (f, p) => r.color.push({ frame: f, y: mean(p.y), u: mean(p.u), v: mean(p.v) }), { pre: v.pre, flags: "area" });
  console.log(`${v.key}: ${info.w}x${info.h} ${info.codec} ${info.pixFmt} ${info.frames} frames @ ${info.fps} — detail ${r.lapVarMean.toFixed(1)} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}

// b. temporal analysis: motion from the source, refined per video
const E = WIN + 2 * MARGIN;
const tiles = [];
for (let j = 0; j < WIN / TILE; j++) for (let i = 0; i < WIN / TILE; i++) tiles.push({ x: MARGIN + i * TILE, y: MARGIN + j * TILE, s: TILE });
for (const tr of TEMPORAL) {
  const src = results.source.temporal[tr.label].ys;
  const motion = [];
  let edgeHits = 0;
  for (let t = 0; t + 1 < src.length; t++) {
    const m = estimateMotion(src[t], src[t + 1], E, E, tiles, RANGE);
    edgeHits += m.filter((q) => q.edge).length + (m[0].globalEdge ? 100 : 0);
    motion.push(m);
  }
  const speeds = motion.flat().map((q) => Math.hypot(q.dx, q.dy));
  console.log(`temporal ${tr.label}: tile motion ${Math.min(...speeds).toFixed(1)}–${Math.max(...speeds).toFixed(1)} px/frame, ${edgeHits} search-edge hits (local ±10; +100 per global hit)`);
  const affines = motion.map((m) => fitAffine(tiles, m));
  for (const r of Object.values(results)) {
    const T = r.temporal[tr.label];
    if (!T) continue;
    const hp = T.ys.map((y) => highpass(y, E, E, 2));
    const real = [];
    const ceiling = [];
    let mad = 0;
    let n = 0;
    for (let t = 0; t + 1 < T.ys.length; t++) {
      real.push(detailCoherence(T.ys[t], T.ys[t + 1], hp[t], hp[t + 1], E, E, tiles, motion[t]));
      if (t % 2 === 0) {
        const rigid = warpAffine(T.ys[t], E, E, affines[t]);
        ceiling.push(detailCoherence(T.ys[t], rigid, hp[t], highpass(rigid, E, E, 2), E, E, tiles, motion[t]));
      }
      tiles.forEach((tile, k) => {
        const m = matchTile(T.ys[t], T.ys[t + 1], E, E, tile, Math.round(motion[t][k].dx), Math.round(motion[t][k].dy), 2);
        const ya = tileOf(T.ys[t], E, tile);
        const yb = sampleShifted(T.ys[t + 1], E, E, tile, m.dx, m.dy);
        for (let i = 0; i < ya.length; i++) mad += Math.abs(ya[i] - yb[i]);
        n += ya.length;
      });
    }
    const inner = T.ys.map((y) => {
      const c = new Float32Array(WIN * WIN);
      for (let j = 0; j < WIN; j++) for (let i = 0; i < WIN; i++) c[j * WIN + i] = y[(MARGIN + j) * E + MARGIN + i];
      return c;
    });
    const lv = inner.map((c) => laplacianVariance(c, WIN, WIN));
    // 4-frame pulse: each frame's sharpness against a centred one-period moving average (which cancels a 4-frame rhythm)
    const pulse = [];
    for (let t = 2; t + 2 < lv.length; t++) pulse.push(lv[t] / ((lv[t - 2] / 2 + lv[t - 1] + lv[t] + lv[t + 1] + lv[t + 2] / 2) / 4) - 1);
    const coherence = mean(real);
    const ceil = mean(ceiling);
    r.temporal[tr.label] = {
      coherence,
      ceiling: ceil,
      efficiency: coherence / ceil,
      coherenceMin: Math.min(...real),
      pulse: Math.sqrt(mean(pulse.map((q) => q * q))),
      mcMad: mad / n,
      sharpJitter: mean(lv.slice(1).map((q, i) => Math.abs(q - lv[i]) / lv[i])),
      meanY: inner.map((c) => mean(c)),
      lapVar: mean(lv),
    };
  }
  const srcY = results.source.temporal[tr.label].meanY;
  for (const r of Object.values(results)) {
    const T = r.temporal[tr.label];
    if (!T?.meanY) continue;
    const d = T.meanY.map((q, i) => q - srcY[i]);
    const md = mean(d);
    T.flicker = Math.sqrt(mean(d.map((q) => (q - md) ** 2)));
    T.lumaOffset = md;
    delete T.meanY;
  }
}

// c. edges and d. colour against the source
for (const r of Object.values(results)) {
  if (!r.edges) continue;
  r.edgeFull = EDGE_FRAMES.map((f) => edgeF1(results.source.edges.get(f), r.edges.get(f), SW, SH, 2));
  r.edgeRoi = ROIS.map((q) => ({ label: q.label, ...edgeF1(results.source.edges.get(q.frame), r.edges.get(q.frame), SW, SH, 2, q) }));
  r.edgeF1 = mean(r.edgeFull.map((q) => q.f1));
  r.edgeRoiMin = Math.min(...r.edgeRoi.map((q) => q.f1));
  const dY = r.color.map((c, i) => c.y - results.source.color[i].y);
  const dU = r.color.map((c, i) => c.u - results.source.color[i].u);
  const dV = r.color.map((c, i) => c.v - results.source.color[i].v);
  const maxAbs = (a) => Math.max(...a.map(Math.abs));
  r.colorDelta = { meanY: mean(dY), meanU: mean(dU), meanV: mean(dV), maxY: maxAbs(dY), maxU: maxAbs(dU), maxV: maxAbs(dV) };
}

// verdicts: the current 4k clip is the accepted baseline for stability; the bar for detail is the sharper of the two current rows
const cur = results.current;
const bar = Math.max(results.current.lapVarMean, results.hero.lapVarMean);
for (const r of Object.values(results)) {
  if (r.ref) continue;
  const fails = [];
  for (const tr of TEMPORAL) {
    const T = r.temporal[tr.label];
    const C = cur.temporal[tr.label];
    if (T.efficiency < C.efficiency - 0.04) fails.push(`b: ${tr.label} detail boils — coherence efficiency ${T.efficiency.toFixed(3)} < current ${C.efficiency.toFixed(3)} − 0.04`);
    if (T.pulse > Math.max(0.03, 1.5 * C.pulse)) fails.push(`b: ${tr.label} 4-frame sharpness pulse ±${(100 * T.pulse).toFixed(1)}% > 1.5 × current ±${(100 * C.pulse).toFixed(1)}%`);
    if (T.flicker > 0.75) fails.push(`b: ${tr.label} luma flicker ${T.flicker.toFixed(2)}`);
  }
  if (r.edgeF1 < cur.edgeF1 - 0.05) fails.push(`c: edge F1 ${r.edgeF1.toFixed(3)} < current ${cur.edgeF1.toFixed(3)} − 0.05`);
  if (r.edgeRoiMin < cur.edgeRoiMin - 0.08) fails.push(`c: architecture ROI F1 ${r.edgeRoiMin.toFixed(3)}`);
  if (r.ssim.meanY < cur.ssim.meanY - 0.03) fails.push(`c: SSIM ${r.ssim.meanY.toFixed(3)}`);
  const cd = r.colorDelta;
  if (Math.abs(cd.meanY) > 2 || Math.abs(cd.meanU) > 1.5 || Math.abs(cd.meanV) > 1.5) fails.push(`d: colour shift Y ${cd.meanY.toFixed(2)} U ${cd.meanU.toFixed(2)} V ${cd.meanV.toFixed(2)}`);
  r.fails = fails;
  r.passes = fails.length === 0;
  r.beatsCurrent = r.lapVarMean > bar && r.crops.every((c, i) => c.lapVar > cur.crops[i].lapVar);
}
const eligible = Object.values(results).filter((r) => !r.ref && r.passes && r.beatsCurrent).sort((a, b) => b.lapVarMean - a.lapVarMean);
const winner = eligible[0]?.key ?? null;

// metrics JSON (without pixel buffers)
const slim = Object.fromEntries(
  Object.values(results).map((r) => [r.key, { ...r, crops: r.crops.map((c) => ({ ...c, rgb: undefined })), edges: undefined, color: undefined }]),
);
writeFileSync(join(outDir, "metrics.json"), JSON.stringify({ grid: GRID, crop: CROP, bar, winner, results: slim }, null, 2));

// sheet
const cols = Object.values(results);
const LABEL_W = 170;
const CAP = 34;
const HEAD = 120;
const W = LABEL_W + cols.length * CROP;
const rows = CROPS.length;
const tableLines = [];
const pct = (q) => `${(100 * q).toFixed(1)}%`;
tableLines.push({ text: "Metrics (grid 3884×2160; detail = mean Laplacian variance of the 9 crops; b = 24-frame tracked regions; c = vs source at 1928×1072; d = mean Δ 8-bit levels)", weight: 700 });
tableLines.push({ text: "row".padEnd(26) + "detail  ×cur  | efficiency shingle/brick/brick2/stone  pulse max  flicker | SSIM-Y  edgeF1  ROI-min | ΔY     ΔU     ΔV    | verdict", mono: true });
for (const r of cols) {
  const T = TEMPORAL.map((q) => r.temporal[q.label]).filter((q) => q?.coherence != null);
  const t = T.length ? `${T.map((q) => q.efficiency.toFixed(3)).join("/")}       ${pct(Math.max(...T.map((q) => q.pulse))).padStart(6)}    ${Math.max(...T.map((q) => q.flicker)).toFixed(2).padStart(5)}` : "—".padEnd(45);
  const c = r.ssim ? `${r.ssim.meanY.toFixed(3)}   ${r.edgeF1.toFixed(3)}   ${r.edgeRoiMin.toFixed(3)}` : r.edgeF1 != null ? `  —     ${r.edgeF1.toFixed(3)}   ${r.edgeRoiMin.toFixed(3)}` : "—".padEnd(21);
  const d = r.colorDelta ? `${r.colorDelta.meanY.toFixed(2).padStart(5)}  ${r.colorDelta.meanU.toFixed(2).padStart(5)}  ${r.colorDelta.meanV.toFixed(2).padStart(5)}` : "—".padEnd(19);
  const verdict = r.ref ? "reference" : r.passes ? (r.beatsCurrent ? (r.key === winner ? "PASS — WINNER" : "PASS, sharper") : "PASS, not sharper") : `FAIL (${r.fails.length})`;
  tableLines.push({ text: `${r.label.slice(0, 25).padEnd(26)}${r.lapVarMean.toFixed(1).padStart(6)}  ${(r.lapVarMean / cur.lapVarMean).toFixed(2)}  | ${t} | ${c} | ${d} | ${verdict}`, mono: true });
}
for (const r of cols) for (const f of r.fails ?? []) tableLines.push({ text: `  ${r.label}: ${f}`, mono: true, color: "#F2A0A0" });
for (const r of cols) {
  if (r.ref || r.beatsCurrent) continue;
  const softer = r.crops.map((c, i) => [c, c.lapVar / cur.crops[i].lapVar]).filter(([, q]) => q <= 1);
  if (softer.length) tableLines.push({ text: `  ${r.label}: a: softer than the current hero on ${softer.map(([c, q]) => `f${c.frame} ${c.label} (${q.toFixed(2)}×)`).join(", ")}`, mono: true, color: "#F2A0A0" });
}
tableLines.push({
  text: winner
    ? `Decision: ${results[winner].label} — the sharpest candidate that passes b, c and d and beats the current hero on every crop.`
    : "Decision: no candidate is sharper than the current hero on every crop while passing b, c and d — keep the current hero.",
  weight: 700,
  color: winner ? "#00AEEF" : "#ECEAE6",
});
const TABLE_H = 26 * (tableLines.length + 1) + 20;
const H = HEAD + rows * (CROP + CAP) + TABLE_H;
const comps = [];
comps.push({
  input: await textPng(
    [
      { text: "Hero upscale shootout — clip 1 (Kling pro 1928×1072), 100% crops 400×400 on the 3884×2160 grid", size: 30, weight: 700 },
      { text: "Columns: source scaled with lanczos · the current hero's 4k source clip and the delivered hero.mp4 (graded + grain, 2560 px, scaled to the grid) · the candidates (no grade, no grain).", size: 20, color: "#9AA3AE" },
    ],
    W,
    HEAD - 40,
  ),
  left: 0,
  top: 0,
});
for (let i = 0; i < cols.length; i++) comps.push({ input: await textPng(cols[i].label, CROP, 40, { size: 20, weight: 700, color: cols[i].key === winner ? "#00AEEF" : "#ECEAE6" }), left: LABEL_W + i * CROP, top: HEAD - 40 });
for (let k = 0; k < rows; k++) {
  const top = HEAD + k * (CROP + CAP);
  comps.push({ input: await textPng([`f${CROPS[k].frame}`, CROPS[k].label], LABEL_W, CROP, { size: 22, weight: 700 }), left: 0, top });
  for (let i = 0; i < cols.length; i++) {
    const c = cols[i].crops[k];
    comps.push({ input: await rgbPng(c.rgb, CROP, CROP), left: LABEL_W + i * CROP, top });
    const ratio = c.lapVar / cur.crops[k].lapVar;
    comps.push({ input: await textPng(`LV ${c.lapVar.toFixed(1)}  (${ratio.toFixed(2)}× current)`, CROP, CAP, { size: 18, mono: true, color: cols[i].ref ? "#9AA3AE" : ratio > 1 ? "#ECEAE6" : "#F2A0A0" }), left: LABEL_W + i * CROP, top: top + CROP });
  }
}
const tablePng = await sharp(
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${TABLE_H}"><rect width="100%" height="100%" fill="#1A1F26"/>${tableLines
      .map((l, i) => `<text x="16" y="${30 + i * 26}" font-family="${l.mono ? "Menlo, monospace" : "Helvetica Neue, Helvetica, Arial"}" font-size="${l.mono ? 17 : 19}" font-weight="${l.weight ?? 400}" fill="${l.color ?? "#ECEAE6"}" xml:space="preserve">${l.text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>`)
      .join("")}</svg>`,
  ),
)
  .png()
  .toBuffer();
comps.push({ input: tablePng, left: 0, top: HEAD + rows * (CROP + CAP) });
await sharp({ create: { width: W, height: H, channels: 3, background: "#0F1216" } })
  .composite(comps)
  .jpeg({ quality: 88, mozjpeg: true })
  .toFile(join(outDir, "shootout.jpg"));

for (const r of cols) {
  const ts = r.temporal.shingles;
  console.log(
    `${r.key.padEnd(10)} detail ${r.lapVarMean.toFixed(1).padStart(6)}` +
      (ts?.coherence != null ? ` | eff ${TEMPORAL.map((q) => r.temporal[q.label].efficiency.toFixed(3)).join("/")} pulse ${TEMPORAL.map((q) => pct(r.temporal[q.label].pulse)).join("/")} flk ${TEMPORAL.map((q) => r.temporal[q.label].flicker.toFixed(2)).join("/")}` : "") +
      (r.ssim ? ` | ssim ${r.ssim.meanY.toFixed(3)} (min ${r.ssim.minY.toFixed(3)})` : "") +
      (r.edgeF1 != null ? ` edgeF1 ${r.edgeF1.toFixed(3)} roiMin ${r.edgeRoiMin.toFixed(3)}` : "") +
      (r.colorDelta ? ` | dY ${r.colorDelta.meanY.toFixed(2)} dU ${r.colorDelta.meanU.toFixed(2)} dV ${r.colorDelta.meanV.toFixed(2)}` : "") +
      (r.ref ? " [ref]" : ` → ${r.passes ? "pass" : "FAIL: " + r.fails.join("; ")}${r.beatsCurrent ? ", sharper than current" : ", not sharper"}`),
  );
}
console.log(`winner: ${winner ?? "none (keep the current hero)"}`);
