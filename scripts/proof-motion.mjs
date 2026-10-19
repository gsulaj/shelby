// Camera motion of a proof clip, frame to frame (PROOF_BRIEF.md step 4 "Speed check" and the seam blend).
// Luma at 960 px wide; a 6 × 4 grid of 128 px tiles matched between consecutive frames (scripts/video-metrics.mjs
// estimateMotion: global search, then per-tile refinement, sub-pixel); a least-squares affine displacement field
// d(x, y) per step, reported in full-resolution pixels. Speed = the median tile displacement per frame, in px at the
// clip's full width; unlike signalstats YDIF it does not depend on how much contrast the light gives the texture, so a
// cool overcast clip and a sunlit one can be compared.
// Usage: node scripts/proof-motion.mjs <clip.mp4> [--from n] [--to n] [--json out.json]
// Exported: measureMotion(path, from, to) → [{ frame, aff: [[a,b,c],[d,e,f]] (full res), speed }] for steps frame → frame+1.
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { estimateMotion, fitAffine, grabFrames, probe } from "./video-metrics.mjs";

const AW = 960;

export async function measureMotion(path, from = 0, to = null) {
  const { w, h, frames } = probe(path);
  const last = to ?? frames - 1;
  const AH = Math.round((AW * h) / w / 2) * 2;
  const S = w / AW;
  const tiles = [];
  for (let j = 0; j < 4; j++) for (let i = 0; i < 6; i++) tiles.push({ x: 48 + i * 144, y: 30 + j * 120, s: 96 });
  const lum = new Map();
  await grabFrames(path, Array.from({ length: last - from + 1 }, (_, k) => from + k), { w: AW, h: AH }, (f, p) => lum.set(f, Float32Array.from(p.y)), { flags: "area" });
  const out = [];
  for (let f = from; f < last; f++) {
    const m = estimateMotion(lum.get(f), lum.get(f + 1), AW, AH, tiles, 40, 8);
    const aff = fitAffine(tiles, m);
    const mags = m.map((q) => Math.hypot(q.dx, q.dy)).sort((a, b) => a - b);
    // scale to full resolution: the linear terms are scale-free, the translations scale by S
    out.push({ frame: f, aff: [[aff[0][0], aff[0][1], aff[0][2] * S], [aff[1][0], aff[1][1], aff[1][2] * S]], speed: mags[Math.floor(mags.length / 2)] * S, dx: (m.reduce((a, q) => a + q.dx, 0) / m.length) * S, dy: (m.reduce((a, q) => a + q.dy, 0) / m.length) * S });
  }
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const [IN] = args;
  if (!IN) {
    console.error("usage: node scripts/proof-motion.mjs <clip.mp4> [--from n] [--to n] [--json out.json]");
    process.exit(1);
  }
  const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
  const from = +opt("--from", 0);
  const to = opt("--to", null);
  const r = await measureMotion(IN, from, to === null ? null : +to);
  const per = (a) => a.map((q) => q.speed.toFixed(1)).join(" ");
  console.log(`${IN}: ${r.length} steps; speed px/frame (full res):\n  ${per(r)}`);
  const sec = [];
  for (let i = 0; i < r.length; i += 12) {
    const s = r.slice(i, i + 12);
    sec.push((s.reduce((a, q) => a + q.speed, 0) / s.length).toFixed(2));
  }
  console.log(`  per half second: ${sec.join(" ")}`);
  const json = opt("--json", null);
  if (json) writeFileSync(json, JSON.stringify(r, null, 1));
}
