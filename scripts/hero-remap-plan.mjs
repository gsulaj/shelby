#!/usr/bin/env node
// Plan the hero time-remap (HERO_RESUME.md step c): even out the camera speed through the stitched loop.
//
// Input: one motion value per frame (ffmpeg signalstats YDIF, measured at low resolution so it tracks
// displacement rather than texture) for the loop played twice (-stream_loop 1), so the motion into frame 0 (the
// loop seam) is measured as well. Output: an ffmpeg filter script that re-times the input frame by frame and
// lets minterpolate render constant-rate output, plus a plan JSON for the report.
//
// Model: m[i] is the motion between frame i-1 and i (cyclic). ms = m smoothed over SHORT frames; mL = m
// smoothed over LONG frames (the local pace of the orbit). Rate r[i] = clamp(mL / ms, 1, RMAX): passages that
// are slow for their surroundings (easing into a keyframe, the rear view) play up to RMAX times faster, and
// nothing is ever slowed down, so the fast passes keep their native frames. r is smoothed over RSMOOTH frames
// so acceleration stays gentle. Every sped-up region is then scaled to consume a whole number of output frames,
// so each frame outside the regions lands exactly on a source frame (minterpolate passes it through untouched)
// and the loop still closes exactly (source frame N maps onto output frame K).
import fs from "node:fs";

const args = process.argv.slice(2);
const positional = [];
const opt = { rmax: 1.5, short: 15, long: 73, rsmooth: 9, margin: 12, fps: 24, search: 64, mingain: 2 };
for (let i = 0; i < args.length; i += 1) {
  if (args[i].startsWith("--")) opt[args[i].slice(2)] = Number(args[(i += 1)]);
  else positional.push(args[i]);
}
const [ydifFile, nArg, outFilter, outPlan] = positional;
if (!ydifFile || !nArg || !outFilter) {
  console.error(
    "usage: node scripts/hero-remap-plan.mjs <ydif-2x.txt> <frames> <filter-script.txt> [plan.json]" +
      " [--rmax 1.5] [--short 15] [--long 73] [--rsmooth 9] [--margin 12] [--fps 24] [--search 64] [--mingain 2]",
  );
  process.exit(2);
}
const N = Number(nArg);
const lines = fs.readFileSync(ydifFile, "utf8").trim().split(/\r?\n/).map(Number);
if (lines.length < 2 * N) {
  console.error(`expected ${2 * N} motion lines (the loop played twice), got ${lines.length}`);
  process.exit(2);
}
// m[i]: motion into frame i, taken from the second pass so m[0] is the seam (last frame → first frame)
const m = Array.from({ length: N }, (_, i) => lines[N + i]);

const circ = (arr, half) =>
  arr.map((_, i) => {
    let s = 0;
    for (let k = -half; k <= half; k += 1) s += arr[(((i + k) % arr.length) + arr.length) % arr.length];
    return s / (2 * half + 1);
  });
const half = (w) => Math.floor(w / 2);
const ms = circ(m, half(opt.short));
const mL = circ(m, half(opt.long));
const rRaw = ms.map((v, i) => Math.min(opt.rmax, Math.max(1, mL[i] / v)));
const r = circ(rRaw, half(opt.rsmooth));

// output frames consumed per source frame; whole frames per sped-up region
const d = r.map((v) => 1 / v);
const regions = [];
let start = -1;
for (let i = 0; i <= N; i += 1) {
  const on = i < N && r[i] > 1 + 1e-9;
  if (on && start < 0) start = i;
  if (!on && start >= 0) {
    regions.push({ from: start, to: i }); // [from, to)
    start = -1;
  }
}
// outside the regions exactly one output frame per source frame, so the loop closes on whole frames
const inRegion = new Array(N).fill(false);
for (const g of regions) for (let i = g.from; i < g.to; i += 1) inRegion[i] = true;
for (let i = 0; i < N; i += 1) if (!inRegion[i]) d[i] = 1;
// a region that saves fewer than MINGAIN frames is not worth interpolating: play it at native speed instead
for (const g of regions) {
  const sum = d.slice(g.from, g.to).reduce((s, v) => s + v, 0);
  if (g.to - g.from - sum < opt.mingain) {
    for (let i = g.from; i < g.to; i += 1) { d[i] = 1; r[i] = 1; }
    g.dropped = true;
  }
}
for (let j = regions.length - 1; j >= 0; j -= 1) if (regions[j].dropped) regions.splice(j, 1);
for (const g of regions) {
  const sum = d.slice(g.from, g.to).reduce((s, v) => s + v, 0);
  g.outFrames = Math.max(1, Math.round(sum));
  const k = g.outFrames / sum;
  for (let i = g.from; i < g.to; i += 1) d[i] *= k;
  g.frames = g.to - g.from;
  g.maxRate = Math.max(...r.slice(g.from, g.to));
}
const K = Math.round(d.reduce((s, v) => s + v, 0));
const T = [0];
for (let i = 0; i < N; i += 1) T.push(T[i] + d[i]);
if (Math.abs(T[N] - K) > 1e-6) throw new Error(`loop does not close: T[N]=${T[N]} K=${K}`);
T[N] = K;
const ext = (n) => (n < N ? T[n] : K + T[n - N]); // the margin frames come from the second pass
const last = N + opt.margin;
const terms = [];
for (let n = 0; n < last; n += 1) terms.push(`eq(N,${n})*${ext(n).toFixed(6)}`);
const filter =
  `[0:v]trim=end_frame=${last},setpts='(${terms.join("+")})/${opt.fps}/TB',` +
  `minterpolate=fps=${opt.fps}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1:scd=none:search_param=${opt.search}[out]\n`;
fs.writeFileSync(outFilter, filter);

// pass-through frames (exact source frames in the output), for the report and a bit-exact check
const passThrough = [];
for (let i = 0; i < N; i += 1) if (Math.abs(T[i] - Math.round(T[i])) < 1e-6 && Math.abs(d[i] - 1) < 1e-9) passThrough.push([i, Math.round(T[i])]);
const longest = (() => {
  let best = null, runStart = 0;
  for (let j = 1; j <= passThrough.length; j += 1) {
    if (j === passThrough.length || passThrough[j][0] !== passThrough[j - 1][0] + 1) {
      if (!best || j - runStart > best.len) best = { len: j - runStart, mid: passThrough[Math.floor((runStart + j - 1) / 2)] };
      runStart = j;
    }
  }
  return best;
})();
const plan = { N, K, fps: opt.fps, opt, mean: m.reduce((s, v) => s + v, 0) / N, m, ms, mL, r, T, regions, passThroughCount: passThrough.length, seam: { rateIntoSeam: r[N - 1], rateOutOfSeam: r[0] } };
if (outPlan) fs.writeFileSync(outPlan, JSON.stringify(plan));
console.log(`source ${N} frames → output ${K} frames (${(K / opt.fps).toFixed(2)} s); rate 1.00–${Math.max(...r).toFixed(2)}; ${passThrough.length} frames pass through untouched`);
for (const g of regions) console.log(`  sped up: frames ${g.from}–${g.to - 1} (${g.frames} → ${g.outFrames} frames, max ${g.maxRate.toFixed(2)}×)`);
console.log(`  loop seam: rate ${r[N - 1].toFixed(2)} into the seam, ${r[0].toFixed(2)} out of it`);
if (longest) console.log(`PASS=${longest.mid[0]}:${longest.mid[1]}`);
console.log(`K=${K}`);
