// Quality checks for the services clips (SERVICES_BRIEF.md §1 "Measurable checks"), measured against the hero.
// Usage: node scripts/svc-quality-check.mjs <config.json> <out-dir> [--only key,key] [--skip-flicker] [--map]
//
// config.json:
//   { "hero": { "path", "w", "h", "dx", "crops": [{ "t", "cx", "cy" }], "shimmer": "<hero shimmer.json>" },
//     "clips": [{ "key", "label", "path", "w", "h", "crops": [{ "t", "cx", "cy", "label" }],
//                 "lines": { "times": [s, s, s], "exclude": [{ "x", "y", "w", "h" }],
//                            "include": { "all" | "<t>": [{ "x", "y", "w", "h" }] } } }] }
//   "sigma" (default 1.4) is the blur before the gradient: 3 for a granular surface such as shingles, so the course
//   edges' shadow lines dominate the granules. "include" limits the line search to the subject (the in-focus roof courses, the siding wall, the window frame), so
//   the main lines measured are the product's own, not soft background edges or natural stone.
//   Crop centres are in each video's own pixel grid (the hero's in its 3840 delivery frame, shifted by dx onto the
//   master's grid, as in docs/screenshots/hero-upscale/before-after.config.json).
//
// Measure the grain-free versions (the brief, §4.2): grain is per-pixel noise and inflates every number here.
//
// 1. Sharpness — Laplacian variance of 400 px luma crops at 100% (the hero before/after method). Bar: every subject
//    crop of a clip ≥ the mean of the hero's three shingle-field crops.
// 2. Temporal stability — the hero shimmer method (scripts/hero-shimmer-check.mjs): 24-frame windows every 12 frames,
//    832 px regions on a 3×3 grid, per-tile motion, coherence of the fine-detail band between consecutive frames divided
//    by the coherence against a rigidly warped copy (efficiency), and the 4-frame sharpness pulse. Flicker ratio =
//    1 − efficiency (the share of fine detail that is re-invented instead of moving with the scene). Regions without
//    texture are skipped; regions whose tiles do not move as one rigid plane (a hand, a nailer, swaying leaves) are
//    reported apart, since genuine subject motion lowers the ratio without being flicker. Bars, from the hero loop the
//    owner accepted (its shimmer.json): mean flicker ratio ≤ the hero's mean, worst window ≤ the hero's 10th-percentile
//    worst, and pulse ≤ 27% (the worst the owner accepted on roof and brick, docs/MEDIA_PLAYBOOK.md §6.1).
// 3. Geometry — edge straightness on the main lines: Canny edges, a Hough transform voted along each pixel's gradient,
//    the longest straight runs (≥ 300 px, ≥ 40% edge coverage, gaps ≤ 24 px), every edge point refined to sub-pixel along the line normal, then a quadratic
//    fit. Bow (sagitta) = |a|·L²/4 and wobble = RMS residual about the quadratic. Bar: bow ≤ max(1.5 px, 0.2% of the
//    line length) — 1.5 px at 2160 is under one CSS pixel in the sticky panel, and sub-pixel edge noise on a short soft
//    edge is ~0.5 px — and wobble ≤ 0.8 px, on each of the 12 longest lines.
// Exit code 1 when any clip fails a bar.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import {
  blur,
  cropPlane,
  detailCoherence,
  estimateMotion,
  fitAffine,
  grabFrames,
  highpass,
  laplacianVariance,
  mean,
  probe,
  warpAffine,
  yuvToRgb,
} from "./video-metrics.mjs";

const args = process.argv.slice(2);
const [cfgPath, OUT] = args;
if (!cfgPath || !OUT) {
  console.error("usage: node scripts/svc-quality-check.mjs <config.json> <out-dir> [--only key,key] [--skip-flicker] [--map]");
  process.exit(1);
}
const flag = (n) => args.includes(n);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1].split(",") : null;
mkdirSync(OUT, { recursive: true });
const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
const FPS = 24;
const C = 400;
const frameOf = (t) => Math.round(t * FPS);

/** Draw an SVG over a full frame, then scale the result to 1080 px (sharp applies composite after resize, so two passes). */
async function overlay(p, svg, file) {
  const full = await sharp(yuvToRgb(p.y, p.u, p.v), { raw: { width: p.w, height: p.h, channels: 3 } }).composite([{ input: Buffer.from(svg) }]).png().toBuffer();
  await sharp(full).resize(1080).jpeg({ quality: 85 }).toFile(file);
}

// ---------- 1. sharpness ----------
async function sharpness(v, crops) {
  const frames = new Map();
  await grabFrames(v.path, crops.map((c) => frameOf(c.t)), { w: v.w, h: v.h }, (f, p) =>
    frames.set(f, { y: Buffer.from(p.y), u: Buffer.from(p.u), v: Buffer.from(p.v), w: p.w, h: p.h }),
  );
  const out = [];
  for (const c of crops) {
    const p = frames.get(frameOf(c.t));
    const x = c.cx - C / 2 - (v.dx ?? 0);
    const y = c.cy - C / 2;
    const lum = cropPlane(p.y, p.w, p.h, x, y, C, C);
    const lv = laplacianVariance(lum, C, C);
    const rgb = yuvToRgb(
      Uint8Array.from(lum),
      Uint8Array.from(cropPlane(p.u, p.w, p.h, x, y, C, C)),
      Uint8Array.from(cropPlane(p.v, p.w, p.h, x, y, C, C)),
    );
    const png = join(OUT, `${v.key}-crop-${c.t}s-${(c.label ?? "subject").replace(/\W+/g, "-")}.png`);
    await sharp(rgb, { raw: { width: C, height: C, channels: 3 } }).png().toFile(png);
    out.push({ ...c, frame: frameOf(c.t), lv, png });
  }
  return out;
}

async function cropMap(v, crops) {
  const frames = new Map();
  const times = [...new Set(crops.map((c) => frameOf(c.t)))];
  await grabFrames(v.path, times, { w: v.w, h: v.h }, (f, p) => frames.set(f, { y: Buffer.from(p.y), u: Buffer.from(p.u), v: Buffer.from(p.v), w: p.w, h: p.h }));
  for (const f of times) {
    const p = frames.get(f);
    const boxes = crops.filter((c) => frameOf(c.t) === f);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${p.w}" height="${p.h}">${boxes
      .map((b) => `<rect x="${b.cx - C / 2 - (v.dx ?? 0)}" y="${b.cy - C / 2}" width="${C}" height="${C}" fill="none" stroke="#0ff" stroke-width="6"/>`)
      .join("")}</svg>`;
    await overlay(p, svg, join(OUT, `${v.key}-map-f${f}.jpg`));
  }
}

// ---------- 2. temporal stability (hero shimmer method) ----------
const WIN = 512;
const MARGIN = 160;
const E = WIN + 2 * MARGIN;
const TILE = 128;
const RANGE = 150;
const LEN = 24;
const STRIDE = 12;
const tiles = [];
for (let j = 0; j < WIN / TILE; j++) for (let i = 0; i < WIN / TILE; i++) tiles.push({ x: MARGIN + i * TILE, y: MARGIN + j * TILE, s: TILE });

function analyse(frames) {
  const hp = frames.map((y) => highpass(y, E, E, 2));
  let energy = 0;
  for (let j = MARGIN; j < MARGIN + WIN; j++) for (let i = MARGIN; i < MARGIN + WIN; i++) energy += hp[0][j * E + i] ** 2;
  energy /= WIN * WIN;
  if (energy < 4) return { energy, skipped: true };
  const real = [];
  const ceil = [];
  const resid = [];
  for (let t = 0; t + 1 < LEN; t++) {
    const m = estimateMotion(frames[t], frames[t + 1], E, E, tiles, RANGE);
    real.push(detailCoherence(frames[t], frames[t + 1], hp[t], hp[t + 1], E, E, tiles, m));
    const aff = fitAffine(tiles, m);
    // how far the tiles are from one rigid (affine) motion: genuine subject motion, not texture flicker
    let r2 = 0;
    tiles.forEach((tl, k) => {
      const x = tl.x + tl.s / 2;
      const y = tl.y + tl.s / 2;
      r2 += (m[k].dx - (aff[0][0] * x + aff[0][1] * y + aff[0][2])) ** 2 + (m[k].dy - (aff[1][0] * x + aff[1][1] * y + aff[1][2])) ** 2;
    });
    resid.push(Math.sqrt(r2 / tiles.length));
    if (t % 2 === 0) {
      const rigid = warpAffine(frames[t], E, E, aff);
      ceil.push(detailCoherence(frames[t], rigid, hp[t], highpass(rigid, E, E, 2), E, E, tiles, m));
    }
  }
  const lv = frames.map((y) => {
    const c = new Float32Array(WIN * WIN);
    for (let j = 0; j < WIN; j++) for (let i = 0; i < WIN; i++) c[j * WIN + i] = y[(MARGIN + j) * E + MARGIN + i];
    return laplacianVariance(c, WIN, WIN);
  });
  const pulse = [];
  for (let t = 2; t + 2 < lv.length; t++) pulse.push(lv[t] / ((lv[t - 2] / 2 + lv[t - 1] + lv[t] + lv[t + 1] + lv[t + 2] / 2) / 4) - 1);
  const efficiency = mean(real) / mean(ceil);
  return { energy, efficiency, flicker: 1 - efficiency, nonRigid: mean(resid), pulse: Math.sqrt(mean(pulse.map((q) => q * q))) };
}

async function flicker(v) {
  const n = probe(v.path).frames;
  const cs = [0.25, 0.5, 0.75].map((q) => Math.round(q * v.w));
  const rs = [0.25, 0.5, 0.75].map((q) => Math.round(q * v.h));
  const regions = rs.flatMap((cy, j) => cs.map((cx, i) => ({ cx, cy, label: `${["top", "mid", "bottom"][j]}-${["left", "centre", "right"][i]}` })));
  const ring = [];
  const out = [];
  const t0 = Date.now();
  await grabFrames(v.path, Array.from({ length: n }, (_, i) => i), { w: v.w, h: v.h }, (f, p) => {
    ring.push(regions.map((r) => cropPlane(p.y, p.w, p.h, r.cx - E / 2, r.cy - E / 2, E, E)));
    if (ring.length > LEN) ring.shift();
    const start = f - LEN + 1;
    if (start >= 0 && start % STRIDE === 0) {
      regions.forEach((r, k) => out.push({ start, from: (start / FPS).toFixed(2), to: ((start + LEN) / FPS).toFixed(2), region: r.label, ...analyse(ring.map((fr) => fr[k])) }));
      process.stdout.write(`\r  ${v.key}: window ${start}/${n - LEN} (${((Date.now() - t0) / 1000).toFixed(0)} s)   `);
    }
  });
  process.stdout.write("\n");
  return out;
}

// ---------- 3. geometry: straightness of the main lines ----------
function sobel(g, w, h) {
  const gx = new Float32Array(w * h);
  const gy = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      gx[i] = g[i - w + 1] + 2 * g[i + 1] + g[i + w + 1] - g[i - w - 1] - 2 * g[i - 1] - g[i + w - 1];
      gy[i] = g[i + w - 1] + 2 * g[i + w] + g[i + w + 1] - g[i - w - 1] - 2 * g[i - w] - g[i - w + 1];
    }
  return { gx, gy };
}

/** Canny-style edges: gradient magnitude, non-maximum suppression, hysteresis on magnitude percentiles. */
function cannyEdges(gx, gy, w, h, exclude, include) {
  const mag = new Float32Array(w * h);
  for (let i = 0; i < mag.length; i++) mag[i] = Math.hypot(gx[i], gy[i]);
  const sample = [];
  for (let i = 0; i < mag.length; i += 97) sample.push(mag[i]);
  sample.sort((a, b) => a - b);
  const hi = Math.max(30, sample[Math.floor(0.9 * sample.length)]);
  const lo = hi * 0.45;
  const nms = new Uint8Array(w * h);
  for (let y = 2; y < h - 2; y++)
    for (let x = 2; x < w - 2; x++) {
      const i = y * w + x;
      const m = mag[i];
      if (m < lo) continue;
      const a = Math.atan2(gy[i], gx[i]);
      const dx = Math.round(Math.cos(a));
      const dy = Math.round(Math.sin(a));
      if (m >= mag[i + dy * w + dx] && m > mag[i - dy * w - dx]) nms[i] = m >= hi ? 2 : 1;
    }
  // hysteresis
  const edge = new Uint8Array(w * h);
  const stack = [];
  for (let i = 0; i < nms.length; i++) if (nms[i] === 2) { edge[i] = 1; stack.push(i); }
  while (stack.length) {
    const i = stack.pop();
    for (const d of [-w - 1, -w, -w + 1, -1, 1, w - 1, w, w + 1]) {
      const k = i + d;
      if (nms[k] && !edge[k]) { edge[k] = 1; stack.push(k); }
    }
  }
  for (const r of exclude ?? []) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (y >= 0 && y < h && x >= 0 && x < w) edge[y * w + x] = 0;
  if (include?.length) {
    const keep = new Uint8Array(w * h);
    for (const r of include) for (let y = Math.max(0, r.y); y < Math.min(h, r.y + r.h); y++) for (let x = Math.max(0, r.x); x < Math.min(w, r.x + r.w); x++) keep[y * w + x] = 1;
    for (let i = 0; i < edge.length; i++) if (!keep[i]) edge[i] = 0;
  }
  return { edge, mag };
}

function bilinear(img, w, h, x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  if (ix < 0 || iy < 0 || ix >= w - 1 || iy >= h - 1) return 0;
  const fx = x - ix;
  const fy = y - iy;
  const i = iy * w + ix;
  return img[i] * (1 - fx) * (1 - fy) + img[i + 1] * fx * (1 - fy) + img[i + w] * (1 - fx) * fy + img[i + w + 1] * fx * fy;
}

function solve3(A, b) {
  const M = A.map((r, i) => [...r, b[i]]);
  for (let i = 0; i < 3; i++) {
    let p = i;
    for (let k = i + 1; k < 3; k++) if (Math.abs(M[k][i]) > Math.abs(M[p][i])) p = k;
    [M[i], M[p]] = [M[p], M[i]];
    if (Math.abs(M[i][i]) < 1e-12) return null;
    for (let k = i + 1; k < 3; k++) {
      const f = M[k][i] / M[i][i];
      for (let j = i; j < 4; j++) M[k][j] -= f * M[i][j];
    }
  }
  const x = [0, 0, 0];
  for (let i = 2; i >= 0; i--) {
    let s = M[i][3];
    for (let j = i + 1; j < 3; j++) s -= M[i][j] * x[j];
    x[i] = s / M[i][i];
  }
  return x;
}

function quadFit(pts) {
  // least squares d = a s² + b s + c
  const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const B = [0, 0, 0];
  for (const { s, d } of pts) {
    const v = [s * s, s, 1];
    for (let i = 0; i < 3; i++) {
      B[i] += v[i] * d;
      for (let j = 0; j < 3; j++) A[i][j] += v[i] * v[j];
    }
  }
  return solve3(A, B);
}

function straightLines(Y, w, h, exclude, include, sigma = 1.4) {
  const g = blur(Y, w, h, sigma);
  const { gx, gy } = sobel(g, w, h);
  const { edge } = cannyEdges(gx, gy, w, h, exclude, include);
  const NT = 900; // 0.2° bins over 180°
  const VOTE = sigma > 2 ? 20 : 8; // ± θ bins each edge pixel votes in: a textured edge (granules) has noisier gradient angles
  const D = Math.ceil(Math.hypot(w, h));
  const RB = 2; // ρ bin size in px: a long line's points spread over ± 1–2 px of ρ inside one 0.2° θ bin
  const NR = Math.ceil((2 * D + 1) / RB);
  const acc = new Int32Array(NT * NR);
  const cosT = Float64Array.from({ length: NT }, (_, k) => Math.cos((k * Math.PI) / NT));
  const sinT = Float64Array.from({ length: NT }, (_, k) => Math.sin((k * Math.PI) / NT));
  const pts = [];
  for (let y = 2; y < h - 2; y++)
    for (let x = 2; x < w - 2; x++) {
      const i = y * w + x;
      if (!edge[i]) continue;
      let th = Math.atan2(gy[i], gx[i]);
      if (th < 0) th += Math.PI;
      const k0 = Math.round((th * NT) / Math.PI);
      for (let dk = -VOTE; dk <= VOTE; dk++) {
        const k = (k0 + dk + NT) % NT;
        const r = Math.round((x * cosT[k] + y * sinT[k] + D) / RB);
        acc[k * NR + r]++;
      }
      pts.push(i);
    }
  const used = new Uint8Array(w * h);
  const lines = [];
  for (let iter = 0; iter < 400; iter++) {
    let best = 0;
    let bi = -1;
    for (let i = 0; i < acc.length; i++) if (acc[i] > best) [best, bi] = [acc[i], i];
    if (best < 120) { if (process.env.SVC_DEBUG) console.log(`    hough stop at iter ${iter}`); break; }
    const k = Math.floor(bi / NR);
    const r = (bi % NR) * RB - D;
    // suppress the neighbourhood of this peak
    for (let dk = -10; dk <= 10; dk++) for (let dr = -6; dr <= 6; dr++) {
      const kk = (k + dk + NT) % NT;
      const rr = (bi % NR) + dr;
      if (rr >= 0 && rr < NR) acc[kk * NR + rr] = 0;
    }
    const c = cosT[k];
    const s = sinT[k];
    // edge points on this line: within 2.5 px and gradient within 4° of the line normal
    const on = [];
    for (const i of pts) {
      if (used[i]) continue;
      const x = i % w;
      const y = (i / w) | 0;
      if (Math.abs(x * c + y * s - r) > 3) continue;
      let th = Math.atan2(gy[i], gx[i]);
      if (th < 0) th += Math.PI;
      let dth = Math.abs(th - (k * Math.PI) / NT);
      dth = Math.min(dth, Math.PI - dth);
      if (dth > ((sigma > 2 ? 7 : 4) * Math.PI) / 180) continue;
      on.push({ i, t: -x * s + y * c });
    }
    on.sort((a, b) => a.t - b.t);
    if (process.env.SVC_DEBUG && iter < 25) { let mx = 0, cur = 0; for (let q = 1; q < on.length; q++) { if (on[q].t - on[q - 1].t <= 24) cur += on[q].t - on[q - 1].t; else cur = 0; mx = Math.max(mx, cur); } console.log(`      peak ${iter}: votes ${best} θ ${((k * 180) / NT).toFixed(1)} ρ ${r} on ${on.length} longest-run ${mx.toFixed(0)}`); }
    // split into runs with gaps ≤ 14 px
    let run = [];
    const flush = () => {
      if (run.length && run.at(-1).t - run[0].t >= 300 && run.length >= (sigma > 2 ? 0.25 : 0.4) * (run.at(-1).t - run[0].t)) lines.push({ k, r, c, s, t0: run[0].t, t1: run.at(-1).t, n: run.length });
      run.forEach((q) => (used[q.i] = 1));
      run = [];
    };
    for (const q of on) {
      if (run.length && q.t - run.at(-1).t > 24) flush();
      run.push(q);
    }
    flush();
  }
  // sub-pixel refinement and quadratic fit per line
  const res = [];
  if (process.env.SVC_DEBUG) console.log(`    hough: ${pts.length} edge px, ${lines.length} straight runs`);
  for (const L of lines) {
    const { c, s, r } = L;
    const p0 = [];
    for (let t = L.t0; t <= L.t1; t += 2) {
      // base point on the line, normal n = (c, s), tangent = (-s, c)
      const bx = r * c - t * s;
      const by = r * s + t * c;
      let bestV = -1;
      let bestD = 0;
      const vals = [];
      for (let d = -3; d <= 3.001; d += 0.25) {
        const x = bx + d * c;
        const y = by + d * s;
        const v = Math.abs(bilinear(gx, w, h, x, y) * c + bilinear(gy, w, h, x, y) * s);
        vals.push(v);
        if (v > bestV) [bestV, bestD] = [v, d];
      }
      const idx = Math.round((bestD + 3) / 0.25);
      if (idx <= 0 || idx >= vals.length - 1 || bestV < 8) continue;
      const den = vals[idx - 1] - 2 * vals[idx] + vals[idx + 1];
      const off = den < 0 ? (0.25 * 0.5 * (vals[idx - 1] - vals[idx + 1])) / den : 0;
      p0.push({ s: t, d: bestD + off, v: bestV });
    }
    if (p0.length < 60) continue;
    const tm = (L.t0 + L.t1) / 2;
    let pts = p0.map((q) => ({ s: q.s - tm, d: q.d }));
    let fit = quadFit(pts);
    if (!fit) continue;
    // one round of outlier rejection (3× MAD)
    const resid = pts.map((q) => q.d - (fit[0] * q.s * q.s + fit[1] * q.s + fit[2]));
    const mad = [...resid.map(Math.abs)].sort((a, b) => a - b)[Math.floor(resid.length / 2)] || 0.1;
    pts = pts.filter((_, i) => Math.abs(resid[i]) <= 3 * 1.4826 * mad + 0.2);
    fit = quadFit(pts);
    if (!fit) continue;
    const len = L.t1 - L.t0;
    const bow = (Math.abs(fit[0]) * len * len) / 4;
    const wob = Math.sqrt(mean(pts.map((q) => (q.d - (fit[0] * q.s * q.s + fit[1] * q.s + fit[2])) ** 2)));
    const x0 = r * c - L.t0 * s;
    const y0 = r * s + L.t0 * c;
    const x1 = r * c - L.t1 * s;
    const y1 = r * s + L.t1 * c;
    res.push({ x0, y0, x1, y1, len, angle: ((L.k * 180) / NT + 90) % 180, bow, bowPct: (100 * bow) / len, wobble: wob, points: pts.length, pass: bow <= Math.max(1.5, 0.002 * len) && wob <= 0.8 });
  }
  res.sort((a, b) => b.len - a.len);
  return res.slice(0, 12);
}

async function geometry(v) {
  const times = v.lines?.times ?? [0.5, 2.5, 4.5];
  const frames = new Map();
  await grabFrames(v.path, times.map(frameOf), { w: v.w, h: v.h }, (f, p) => frames.set(f, { y: Buffer.from(p.y), u: Buffer.from(p.u), v: Buffer.from(p.v), w: p.w, h: p.h }));
  const out = [];
  for (const t of times) {
    const p = frames.get(frameOf(t));
    const Y = Float32Array.from(p.y);
    const inc = v.lines?.include?.[String(t)] ?? v.lines?.include?.all;
    const lines = straightLines(Y, p.w, p.h, v.lines?.exclude, inc, v.lines?.sigma);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${p.w}" height="${p.h}">${lines
      .map(
        (l, i) =>
          `<line x1="${l.x0}" y1="${l.y0}" x2="${l.x1}" y2="${l.y1}" stroke="${l.pass ? "#00e676" : "#ff1744"}" stroke-width="5"/><text x="${(l.x0 + l.x1) / 2 + 8}" y="${(l.y0 + l.y1) / 2 - 8}" font-size="40" font-family="Helvetica" fill="${l.pass ? "#00e676" : "#ff1744"}">${i + 1}</text>`,
      )
      .join("")}</svg>`;
    const img = join(OUT, `${v.key}-lines-${t}s.jpg`);
    await overlay(p, svg, img);
    out.push({ t, lines, img });
  }
  return out;
}

// ---------- run ----------
const report = { hero: {}, clips: {} };
const hero = { key: "hero", ...cfg.hero };

if (flag("--map")) {
  for (const v of cfg.clips.filter((q) => !only || only.includes(q.key))) await cropMap(v, v.crops);
  console.log(`crop maps written to ${OUT}`);
  process.exit(0);
}

console.log("hero baseline (grain-free graded master, shingle field)");
report.hero.sharpness = await sharpness(hero, hero.crops);
const heroBar = mean(report.hero.sharpness.map((c) => c.lv));
report.hero.sharpness.forEach((c) => console.log(`  ${c.t}s shingles  ${c.lv.toFixed(1)}`));
console.log(`  bar: mean ${heroBar.toFixed(1)}`);
const hs = JSON.parse(readFileSync(cfg.hero.shimmer, "utf8")).filter((q) => !q.skipped && !(q.old && q.old.skipped));
const heroFl = hs.map((q) => 1 - q.efficiency).sort((a, b) => a - b);
const heroFlicker = { mean: mean(heroFl), p90: heroFl[Math.floor(0.9 * (heroFl.length - 1))], worst: heroFl.at(-1), pulseMax: Math.max(...hs.map((q) => q.pulse)), pulseMedian: [...hs.map((q) => q.pulse)].sort((a, b) => a - b)[Math.floor(hs.length / 2)], windows: hs.length };
report.hero.flicker = heroFlicker;
console.log(
  `  flicker ratio (1 − efficiency): mean ${heroFlicker.mean.toFixed(3)}, 90th pct ${heroFlicker.p90.toFixed(3)}, worst ${heroFlicker.worst.toFixed(3)}; pulse median ±${(100 * heroFlicker.pulseMedian).toFixed(1)}%, max ±${(100 * heroFlicker.pulseMax).toFixed(1)}% (${hs.length} windows)`,
);
const PULSE_BAR = 0.27;

let failed = false;
for (const v of cfg.clips.filter((q) => !only || only.includes(q.key))) {
  console.log(`\n${v.label} (${v.path})`);
  const r = { label: v.label, path: v.path, fails: [] };
  r.sharpness = await sharpness(v, v.crops);
  r.sharpness.forEach((c) => console.log(`  sharpness ${c.t}s ${c.label ?? ""}: ${c.lv.toFixed(1)} (${(c.lv / heroBar).toFixed(2)}× hero)`));
  const minLv = Math.min(...r.sharpness.map((c) => c.lv));
  if (minLv < heroBar) r.fails.push(`sharpness ${minLv.toFixed(1)} < hero ${heroBar.toFixed(1)}`);

  if (!flag("--skip-flicker")) {
    const w = await flicker(v);
    const measured = w.filter((q) => !q.skipped);
    const rigid = measured.filter((q) => q.nonRigid <= 1.0);
    const moving = measured.filter((q) => q.nonRigid > 1.0);
    const fl = rigid.map((q) => q.flicker).sort((a, b) => a - b);
    r.flicker = {
      series: w,
      measured: measured.length,
      rigid: rigid.length,
      moving: moving.length,
      mean: fl.length ? mean(fl) : null,
      worst: fl.length ? fl.at(-1) : null,
      pulseMax: rigid.length ? Math.max(...rigid.map((q) => q.pulse)) : null,
      pulseMedian: rigid.length ? [...rigid.map((q) => q.pulse)].sort((a, b) => a - b)[Math.floor(rigid.length / 2)] : null,
      movingMean: moving.length ? mean(moving.map((q) => q.flicker)) : null,
    };
    const F = r.flicker;
    if (F.mean == null) r.fails.push("flicker: no rigid textured region to measure");
    else {
      console.log(
        `  flicker ratio: mean ${F.mean.toFixed(3)} (hero ${heroFlicker.mean.toFixed(3)}), worst ${F.worst.toFixed(3)} (hero 90th pct ${heroFlicker.p90.toFixed(3)}); pulse median ±${(100 * F.pulseMedian).toFixed(1)}%, max ±${(100 * F.pulseMax).toFixed(1)}% (bar ±27%); ${F.rigid} rigid / ${F.moving} moving-subject window-regions${F.moving ? ` (moving mean ${F.movingMean.toFixed(3)})` : ""}`,
      );
      if (F.mean > heroFlicker.mean) r.fails.push(`flicker mean ${F.mean.toFixed(3)} > hero ${heroFlicker.mean.toFixed(3)}`);
      if (F.worst > heroFlicker.p90) r.fails.push(`flicker worst ${F.worst.toFixed(3)} > hero 90th pct ${heroFlicker.p90.toFixed(3)}`);
      if (F.pulseMax > PULSE_BAR) r.fails.push(`pulse ±${(100 * F.pulseMax).toFixed(1)}% > ±27%`);
    }
  }

  r.geometry = await geometry(v);
  for (const g of r.geometry) {
    const bad = g.lines.filter((l) => !l.pass);
    const worst = g.lines.reduce((m, l) => Math.max(m, l.bowPct), 0);
    console.log(`  straightness ${g.t}s: ${g.lines.length} main lines, worst bow ${worst.toFixed(3)}% of length, worst wobble ${Math.max(0, ...g.lines.map((l) => l.wobble)).toFixed(2)} px${bad.length ? `, FAIL on ${bad.length}` : ""}`);
    bad.forEach((l) => r.fails.push(`line at ${g.t}s (${Math.round(l.len)} px, ${l.angle.toFixed(1)}°): bow ${l.bow.toFixed(2)} px (${l.bowPct.toFixed(3)}%), wobble ${l.wobble.toFixed(2)} px`));
  }
  r.pass = r.fails.length === 0;
  if (!r.pass) failed = true;
  console.log(r.pass ? "  PASS" : `  FAIL: ${r.fails.join("; ")}`);
  report.clips[v.key] = r;
}
report.bars = { sharpness: heroBar, flickerMean: heroFlicker.mean, flickerWorst: heroFlicker.p90, pulse: PULSE_BAR, bow: "max(1.5 px, 0.2% of length)", wobblePx: 0.8 };
const prev = (() => {
  try {
    return JSON.parse(readFileSync(join(OUT, "metrics.json"), "utf8"));
  } catch {
    return null;
  }
})();
if (prev && only) report.clips = { ...prev.clips, ...report.clips };
writeFileSync(join(OUT, "metrics.json"), JSON.stringify(report, (k, v) => (k === "series" ? undefined : v), 2)); // per-window series left out (large)
console.log(`\nmetrics: ${join(OUT, "metrics.json")}`);
process.exit(failed ? 1 : 0);
