// Shimmer check on a whole stitched hero loop (docs/HERO_RESUME.md, sharpness pass): slide a 24-frame window every
// 12 frames over the loop and, on six texture regions, measure how rigidly the fine detail moves with the scene.
// Usage: node scripts/hero-shimmer-check.mjs <new-stitched.mp4> <old-stitched.mp4> <remap-plan.json> <out-dir>
//
// Per window and region (the method of scripts/hero-upscale-shootout.mjs, check b): per-tile motion, the coherence of
// the fine-detail band between consecutive frames divided by the coherence against a rigidly warped copy of the same
// frame (efficiency), and the 4-frame sharpness pulse. Regions without texture (sky, soft lawn) are skipped. Measured
// before grain, which is uncorrelated by design. A window is flagged when it is worse than anything the owner accepted
// in the clip 1 shootout (Starlight Precise 2.6: efficiency 0.746 at worst, 0.204 below the old clip at worst, pulse
// ±13.3% at worst): efficiency < 0.74, or more than 0.21 below the old loop, or a pulse above ±14%. Timestamps are
// given in hero time (after the time-remap, via the plan's frame map). Exit code 1 when any window is flagged.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cropPlane, detailCoherence, estimateMotion, fitAffine, grabFrames, highpass, laplacianVariance, mean, probe, warpAffine } from "./video-metrics.mjs";

const [NEW, OLD, PLAN, OUT] = process.argv.slice(2);
if (!NEW || !OLD || !PLAN || !OUT) {
  console.error("usage: node scripts/hero-shimmer-check.mjs <new-stitched.mp4> <old-stitched.mp4> <remap-plan.json> <out-dir>");
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });
const plan = JSON.parse(readFileSync(PLAN, "utf8"));
const heroTime = (n) => (plan.T[Math.min(n, plan.T.length - 1)] / plan.fps).toFixed(2);

const WIN = 512;
const MARGIN = 160;
const E = WIN + 2 * MARGIN;
const TILE = 128;
const RANGE = 150;
const LEN = 24;
const STRIDE = 12;
const REGIONS = [600, 1942, 3284].flatMap((cx) => [640, 1520].map((cy) => ({ cx, cy, label: `${cx < 1000 ? "left" : cx < 3000 ? "centre" : "right"}-${cy < 1000 ? "upper" : "lower"}` })));
const tiles = [];
for (let j = 0; j < WIN / TILE; j++) for (let i = 0; i < WIN / TILE; i++) tiles.push({ x: MARGIN + i * TILE, y: MARGIN + j * TILE, s: TILE });
const SEAMS = [139, 256, 364]; // stitched frames where the 3-frame crossfades sit (join 1, join 2, loop close)

function analyse(frames) {
  // frames: LEN Float32 luma windows of one region
  const hp = frames.map((y) => highpass(y, E, E, 2));
  const inner = hp[0];
  let energy = 0;
  for (let j = MARGIN; j < MARGIN + WIN; j++) for (let i = MARGIN; i < MARGIN + WIN; i++) energy += inner[j * E + i] ** 2;
  energy /= WIN * WIN;
  if (energy < 4) return { energy, skipped: true };
  const real = [];
  const ceil = [];
  for (let t = 0; t + 1 < LEN; t++) {
    const m = estimateMotion(frames[t], frames[t + 1], E, E, tiles, RANGE);
    real.push(detailCoherence(frames[t], frames[t + 1], hp[t], hp[t + 1], E, E, tiles, m));
    if (t % 2 === 0) {
      const rigid = warpAffine(frames[t], E, E, fitAffine(tiles, m));
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
  return { energy, efficiency: mean(real) / mean(ceil), coherence: mean(real), pulse: Math.sqrt(mean(pulse.map((q) => q * q))) };
}

async function scan(path, dx) {
  const n = probe(path).frames;
  const ring = [];
  const out = [];
  const t0 = Date.now();
  await grabFrames(path, Array.from({ length: n }, (_, i) => i), { w: path === OLD ? 3870 : 3884, h: 2160 }, (f, p) => {
    ring.push(REGIONS.map((r) => cropPlane(p.y, p.w, p.h, r.cx - E / 2, r.cy - E / 2, E, E, dx, 0)));
    if (ring.length > LEN) ring.shift();
    const start = f - LEN + 1;
    if (start >= 0 && start % STRIDE === 0) {
      REGIONS.forEach((r, k) => out.push({ start, region: r.label, ...analyse(ring.map((fr) => fr[k])) }));
      process.stdout.write(`\r${path.split("/").pop()}: window ${start} (${((Date.now() - t0) / 1000).toFixed(0)} s)   `);
    }
  });
  process.stdout.write("\n");
  return out;
}

const fresh = await scan(NEW, 0);
const old = await scan(OLD, 7); // the old 3870-wide loop sits 7 px in from the 3884 grid's left edge
const rows = fresh.map((q, i) => {
  const o = old[i];
  const seam = SEAMS.some((s) => s >= q.start - 2 && s <= q.start + LEN + 1);
  const r = { ...q, old: o, seam, from: heroTime(q.start), to: heroTime(q.start + LEN) };
  if (!q.skipped && !o.skipped) {
    r.flags = [];
    if (q.efficiency < 0.74) r.flags.push(`efficiency ${q.efficiency.toFixed(3)} < 0.74`);
    if (o.efficiency - q.efficiency > 0.21) r.flags.push(`efficiency ${(o.efficiency - q.efficiency).toFixed(3)} below the old loop`);
    if (q.pulse > 0.14) r.flags.push(`pulse ±${(100 * q.pulse).toFixed(1)}%`);
  }
  return r;
});
writeFileSync(join(OUT, "shimmer.json"), JSON.stringify(rows, null, 2));

console.log("window (stitched frames → hero s)   region        energy  efficiency new/old   pulse new/old");
for (const r of rows) {
  if (r.skipped || r.old.skipped) continue;
  console.log(
    `${String(r.start).padStart(3)}–${String(r.start + LEN - 1).padEnd(3)} (${r.from}–${r.to} s)${r.seam ? " seam" : "     "}  ${r.region.padEnd(13)} ${r.energy.toFixed(0).padStart(5)}   ${r.efficiency.toFixed(3)} / ${r.old.efficiency.toFixed(3)}      ${(100 * r.pulse).toFixed(1).padStart(4)}% / ${(100 * r.old.pulse).toFixed(1).padStart(4)}%${r.flags.length ? "   FLAG: " + r.flags.join("; ") : ""}`,
  );
}
const measured = rows.filter((r) => !r.skipped && !r.old.skipped);
const flagged = measured.filter((r) => r.flags.length);
console.log(`measured ${measured.length} window-regions; efficiency new ${mean(measured.map((r) => r.efficiency)).toFixed(3)} (min ${Math.min(...measured.map((r) => r.efficiency)).toFixed(3)}) vs old ${mean(measured.map((r) => r.old.efficiency)).toFixed(3)}; pulse new max ±${(100 * Math.max(...measured.map((r) => r.pulse))).toFixed(1)}%`);
console.log(flagged.length ? `FLAGGED: ${flagged.map((r) => `${r.from}–${r.to} s ${r.region}`).join(", ")}` : "no window is worse than the levels accepted in the clip 1 shootout");
process.exit(flagged.length ? 1 : 0);
