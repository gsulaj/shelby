// Seam match for the proof morph (PROOF_BRIEF.md §4 "Seam match"): the frame Clip D ends on (D_last) and the frame Clip F
// starts on (F0, or Clip F's frame 0) must show the same roof from the same camera, so the in-place dissolve only changes
// the materials and the light. Edge maps of both frames are compared and the misalignment is reported in pixels of A.
// Usage: node scripts/proof-seam-check.mjs <A> <B> <out-dir> [--label name] [--roi name:x,y,w,h ...]
//   A and B are an image (PNG/JPG) or a video frame written as <video.mp4>@<frame>. B is scaled onto A's size first
//   (lanczos, the same aspect: Nano Banana's 5504×3072 and Kling's 3856×2148 differ by 0.2%).
//   --roi takes fractions of the frame (0–1): the structural regions to judge (the gutter, the rake edge, the roofline
//   against the trees). Without --roi the whole frame is judged.
// Method, at half of A's width:
//   1. Structural edges: Gaussian σ 3 then Canny with high thresholds (0.10 / 0.25), so granules and fine shingle texture
//      drop out and roof edges, course lines, the gutter and the tree line remain.
//   2. Global shift: a chamfer search over ±24 px (half-res) for the translation of B that brings its edges closest to
//      A's (mean distance of A's edge pixels to B's nearest edge, distances capped at 12 px so texture that exists in only
//      one frame cannot dominate).
//   3. Per region, at zero shift: the share of A's edge pixels with a B edge within 2 px of full-res distance, and the
//      median distance of the matched ones (≤ 12 px); then the same after the global shift.
// Pass: global shift ≤ 4 px (full res) and, in every region, median matched distance ≤ 3 px and match share ≥ 0.5.
// Writes <label>-overlay.jpg (A's edges red, B's edges cyan, both white, on a dimmed A) and <label>-seam.json.
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { FF } from "./video-metrics.mjs";

const argv = process.argv.slice(2);
const [A, B, OUT] = argv;
if (!A || !B || !OUT) {
  console.error("usage: node scripts/proof-seam-check.mjs <A> <B> <out-dir> [--label name] [--roi name:x,y,w,h ...]");
  process.exit(1);
}
const LABEL = argv.includes("--label") ? argv[argv.indexOf("--label") + 1] : "seam";
const rois = [];
argv.forEach((a, i) => {
  if (a !== "--roi") return;
  const [name, spec] = argv[i + 1].split(":");
  const [x, y, w, h] = spec.split(",").map(Number);
  rois.push({ name, x, y, w, h });
});
if (!rois.length) rois.push({ name: "frame", x: 0, y: 0, w: 1, h: 1 });
mkdirSync(OUT, { recursive: true });

function source(spec) {
  const m = spec.match(/^(.*\.(?:mp4|mov|mkv|webm))@(\d+)$/i);
  return m ? { path: m[1], frame: +m[2] } : { path: spec, frame: 0 };
}
function sizeOf(spec) {
  const { path } = source(spec);
  const r = spawnSync(FF, ["-hide_banner", "-i", path], { encoding: "utf8" });
  const d = r.stderr.match(/Video: .*?, (\d{2,5})x(\d{2,5})[ ,]/);
  return { w: +d[1], h: +d[2] };
}
/** Grey frame of `spec` at w×h, optionally blurred and edge-detected. */
function gray(spec, w, h, edges) {
  const { path, frame } = source(spec);
  const vf = [`select='eq(n\\,${frame})'`, `scale=${w}:${h}:flags=lanczos`, "format=gray", ...(edges ? ["gblur=sigma=3", "edgedetect=low=0.10:high=0.25"] : [])].join(",");
  const r = spawnSync(FF, ["-hide_banner", "-loglevel", "error", "-i", path, "-vf", vf, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "gray", "pipe:1"], { maxBuffer: w * h + 1024 });
  if (r.status !== 0) throw new Error(`decode failed for ${spec}: ${r.stderr}`);
  return r.stdout;
}

/** Two-pass chamfer (3-4) distance transform to the nearest edge pixel, in px. */
function distance(edge, w, h) {
  const INF = 1e9;
  const d = new Float32Array(w * h).fill(INF);
  for (let i = 0; i < w * h; i++) if (edge[i]) d[i] = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (x > 0) d[i] = Math.min(d[i], d[i - 1] + 3);
      if (y > 0) {
        d[i] = Math.min(d[i], d[i - w] + 3);
        if (x > 0) d[i] = Math.min(d[i], d[i - w - 1] + 4);
        if (x < w - 1) d[i] = Math.min(d[i], d[i - w + 1] + 4);
      }
    }
  for (let y = h - 1; y >= 0; y--)
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (x < w - 1) d[i] = Math.min(d[i], d[i + 1] + 3);
      if (y < h - 1) {
        d[i] = Math.min(d[i], d[i + w] + 3);
        if (x < w - 1) d[i] = Math.min(d[i], d[i + w + 1] + 4);
        if (x > 0) d[i] = Math.min(d[i], d[i + w - 1] + 4);
      }
    }
  for (let i = 0; i < d.length; i++) d[i] /= 3;
  return d;
}

const full = sizeOf(A);
const W = Math.round(full.w / 2 / 2) * 2;
const H = Math.round(full.h / 2 / 2) * 2;
const S = full.w / W; // half-res px → full-res px
const ea = gray(A, W, H, true);
const eb = gray(B, W, H, true);
const db = distance(eb, W, H);
const CAP = 12;
const ptsA = [];
for (let i = 0; i < W * H; i++) if (ea[i]) ptsA.push(i);

const cost = (dx, dy) => {
  let s = 0;
  let n = 0;
  for (const i of ptsA) {
    const x = (i % W) + dx;
    const y = ((i / W) | 0) + dy;
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    s += Math.min(CAP, db[y * W + x]);
    n++;
  }
  return n ? s / n : CAP;
};
let best = { dx: 0, dy: 0, c: cost(0, 0) };
const zero = best.c;
for (let dy = -24; dy <= 24; dy += 2) for (let dx = -24; dx <= 24; dx += 2) {
  const c = cost(dx, dy);
  if (c < best.c) best = { dx, dy, c };
}
for (let dy = best.dy - 2; dy <= best.dy + 2; dy++) for (let dx = best.dx - 2; dx <= best.dx + 2; dx++) {
  const c = cost(dx, dy);
  if (c < best.c) best = { dx, dy, c };
}

function region(r, dx, dy) {
  const x0 = Math.round(r.x * W);
  const y0 = Math.round(r.y * H);
  const x1 = Math.round((r.x + r.w) * W);
  const y1 = Math.round((r.y + r.h) * H);
  const dists = [];
  let total = 0;
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      if (!ea[y * W + x]) continue;
      const xx = x + dx;
      const yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      total++;
      const d = db[yy * W + xx];
      if (d <= CAP) dists.push(d);
    }
  dists.sort((a, b) => a - b);
  const within2 = dists.filter((d) => d * S <= 2).length;
  return {
    edges: total,
    matchShare: total ? within2 / total : 0,
    medianPx: dists.length ? +(dists[Math.floor(dists.length / 2)] * S).toFixed(2) : null,
    p90Px: dists.length ? +(dists[Math.floor(0.9 * (dists.length - 1))] * S).toFixed(2) : null,
  };
}

const result = {
  a: A,
  b: B,
  size: `${full.w}x${full.h}`,
  analysis: `${W}x${H}`,
  shiftPx: { dx: +(best.dx * S).toFixed(1), dy: +(best.dy * S).toFixed(1) },
  meanDistancePx: { atZero: +(zero * S).toFixed(2), atShift: +(best.c * S).toFixed(2) },
  regions: rois.map((r) => ({ ...r, atZero: region(r, 0, 0), atShift: region(r, best.dx, best.dy) })),
};
// Course lines: the shingle courses are the roof's structure in a frame with no gutter or horizon. In each of STRIPS
// narrow vertical strips, the row profile of the vertical gradient (blurred σ 2 so granules drop out) is a comb with a
// tooth per course line; the vertical offset that best correlates B's comb with A's says how far B's courses sit from
// A's in that strip. Texture differences (torn pieces vs new tabs) lower the correlation but do not move its peak.
const STRIPS = argv.includes("--strips") ? +argv[argv.indexOf("--strips") + 1] : 24;
function rowProfiles(spec) {
  const { path, frame } = source(spec);
  const vf = [`select='eq(n\\,${frame})'`, `scale=${W}:${H}:flags=lanczos`, "format=gray", "gblur=sigma=2"].join(",");
  const r = spawnSync(FF, ["-hide_banner", "-loglevel", "error", "-i", path, "-vf", vf, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "gray", "pipe:1"], { maxBuffer: W * H + 1024 });
  const g = r.stdout;
  const sw = Math.floor(W / STRIPS);
  return Array.from({ length: STRIPS }, (_, s) => {
    const p = new Float64Array(H);
    for (let y = 1; y < H - 1; y++) {
      let acc = 0;
      for (let x = s * sw; x < (s + 1) * sw; x++) acc += Math.abs(g[(y + 1) * W + x] - g[(y - 1) * W + x]);
      p[y] = acc / sw;
    }
    return p;
  });
}
const pa = rowProfiles(A);
const pb = rowProfiles(B);
const Y0 = Math.round(0.08 * H); // leave out the top rows (leaves in the corner, soft distance)
const Y1 = H - 30;
const corrAt = (a, b, off) => {
  let sa = 0, sb = 0, n = 0;
  for (let y = Y0; y < Y1; y++) if (y + off >= 1 && y + off < H - 1) { sa += a[y]; sb += b[y + off]; n++; }
  const ma = sa / n, mb = sb / n;
  let num = 0, va = 0, vb = 0;
  for (let y = Y0; y < Y1; y++) if (y + off >= 1 && y + off < H - 1) { const da = a[y] - ma, db2 = b[y + off] - mb; num += da * db2; va += da * da; vb += db2 * db2; }
  return num / Math.sqrt(va * vb || 1);
};
const strips = pa.map((a, s) => {
  let bestOff = 0, bestC = -2;
  for (let off = -30; off <= 30; off++) { const c = corrAt(a, pb[s], off); if (c > bestC) [bestC, bestOff] = [c, off]; }
  return { strip: s, offsetPx: +(bestOff * S).toFixed(1), corr: +bestC.toFixed(3), corrAtZero: +corrAt(a, pb[s], 0).toFixed(3) };
});
const absOff = strips.map((q) => Math.abs(q.offsetPx)).sort((a, b) => a - b);
result.courses = {
  strips,
  medianAbsOffsetPx: absOff[Math.floor(absOff.length / 2)],
  p90AbsOffsetPx: absOff[Math.floor(0.9 * (absOff.length - 1))],
  medianCorr: [...strips.map((q) => q.corr)].sort((a, b) => a - b)[Math.floor(strips.length / 2)],
  medianCorrAtZero: [...strips.map((q) => q.corrAtZero)].sort((a, b) => a - b)[Math.floor(strips.length / 2)],
};

const shiftMag = Math.hypot(result.shiftPx.dx, result.shiftPx.dy);
const regionsOk = result.regions.every((r) => r.atZero.medianPx !== null && r.atZero.medianPx <= 3 && r.atZero.matchShare >= 0.5);
// Course alignment: the courses of B within a few px of A's in most strips, with a clear correlation peak.
result.coursesPass = result.courses.medianAbsOffsetPx <= 4 && result.courses.p90AbsOffsetPx <= 8 && result.courses.medianCorr >= 0.5;
result.pass = shiftMag <= 4 && (regionsOk || result.coursesPass);

console.log(`${LABEL}: ${A} vs ${B} (${result.size}, analysed at ${result.analysis})`);
console.log(`  global shift of B onto A: dx ${result.shiftPx.dx} px, dy ${result.shiftPx.dy} px (|${shiftMag.toFixed(1)}| px); mean capped edge distance ${result.meanDistancePx.atZero} px at zero → ${result.meanDistancePx.atShift} px at the shift`);
for (const r of result.regions)
  console.log(
    `  ${r.name.padEnd(10)} edges ${String(r.atZero.edges).padStart(6)} · within 2 px ${(100 * r.atZero.matchShare).toFixed(0)}% · median ${r.atZero.medianPx} px · p90 ${r.atZero.p90Px} px  (after shift: ${(100 * r.atShift.matchShare).toFixed(0)}%, median ${r.atShift.medianPx} px)`,
  );
const C = result.courses;
console.log(
  `  course lines (${STRIPS} strips): offset |median| ${C.medianAbsOffsetPx} px, p90 ${C.p90AbsOffsetPx} px; correlation median ${C.medianCorr} (at zero offset ${C.medianCorrAtZero}) → ${result.coursesPass ? "aligned" : "not aligned"}`,
);
console.log(`    per strip offset px: ${C.strips.map((q) => q.offsetPx).join(" ")}`);
console.log(
  `  ${result.pass ? "PASS" : "FAIL"} (bar: global shift ≤ 4 px, and either every region's edges within 3 px (median, ≥ 50% within 2 px) or the course lines aligned: |offset| median ≤ 4 px, p90 ≤ 8 px, correlation ≥ 0.5)`,
);

// overlay at half resolution: A edges red, B edges cyan, both white, on dimmed A
const base = gray(A, W, H, false);
const img = Buffer.alloc(W * H * 3);
const near = (map, i) => map[i] || (i % W > 0 && map[i - 1]) || (i % W < W - 1 && map[i + 1]) || (i >= W && map[i - W]) || (i < W * (H - 1) && map[i + W]);
for (let i = 0; i < W * H; i++) {
  const g = base[i] / 2.2;
  const a = ea[i];
  const b = eb[i];
  const [r, gg, bb] = a && near(eb, i) ? [255, 255, 255] : a ? [255, 50, 50] : b ? [0, 220, 255] : [g, g, g];
  img[3 * i] = r;
  img[3 * i + 1] = gg;
  img[3 * i + 2] = bb;
}
const boxes = rois
  .filter((r) => !(r.w === 1 && r.h === 1))
  .map((r) => `<rect x="${r.x * W}" y="${r.y * H}" width="${r.w * W}" height="${r.h * H}" fill="none" stroke="#ffd400" stroke-width="3"/><text x="${r.x * W + 8}" y="${r.y * H + 28}" font-family="Helvetica" font-size="26" fill="#ffd400">${r.name}</text>`)
  .join("");
await sharp(img, { raw: { width: W, height: H, channels: 3 } })
  .composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${boxes}</svg>`) }])
  .jpeg({ quality: 88 })
  .toFile(join(OUT, `${LABEL}-overlay.jpg`));
writeFileSync(join(OUT, `${LABEL}-seam.json`), JSON.stringify(result, null, 2));
console.log(`  overlay: ${join(OUT, `${LABEL}-overlay.jpg`)}`);
process.exit(result.pass ? 0 : 1);
