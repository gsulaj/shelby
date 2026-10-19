// Even a proof clip's camera speed to an absolute pace (PROOF_BRIEF.md §4 "constant speed", step 4 "Speed check").
// The services remap (scripts/svc-remap.mjs) measures motion with signalstats YDIF, which scales with how much contrast
// the light gives the texture: the overcast damaged roof and the sunlit new roof read 30% apart at the same camera
// speed. Here the pace is the measured camera displacement (scripts/proof-motion.mjs: tile-matched, px per frame at full
// resolution), so both clips can be brought to one common target and the seam between them matches.
// Speed-up only, as for the hero and the services: every frame slower than --target plays faster (up to --rmax), frames
// at or above it keep their timing, the rate is smoothed over --smooth frames, and minterpolate (the hero's settings:
// mci / aobmc / bidir / vsbmc, search 64) renders constant 24 fps. Output lossless; prints the speed before and after.
// Usage: node scripts/proof-remap.mjs <in.mp4> <out.mp4> --target 3.4 [--rmax 2.5] [--smooth 5] [--workdir dir]
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { measureMotion } from "./proof-motion.mjs";
import { FF, probe } from "./video-metrics.mjs";

const args = process.argv.slice(2);
const [IN, OUT] = args;
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
if (!IN || !OUT || !args.includes("--target")) {
  console.error("usage: node scripts/proof-remap.mjs <in.mp4> <out.mp4> --target <px/frame> [--rmax 2.5] [--smooth 5] [--workdir dir]");
  process.exit(1);
}
const TARGET = +opt("--target");
const RMAX = +opt("--rmax", 2.5);
const SMOOTH = +opt("--smooth", 5);
const WORK = opt("--workdir", join(dirname(OUT), "remap-work"));
mkdirSync(WORK, { recursive: true });
const FPS = 24;
const smooth = (a, w) =>
  a.map((_, i) => {
    const h = Math.floor(w / 2);
    let s = 0;
    let n = 0;
    for (let k = i - h; k <= i + h; k++) if (k >= 0 && k < a.length) { s += a[k]; n++; }
    return s / n;
  });
const halfSeconds = (sp) => {
  const out = [];
  for (let i = 0; i < sp.length; i += 12) {
    const s = sp.slice(i, i + 12);
    out.push((s.reduce((a, b) => a + b, 0) / s.length).toFixed(2));
  }
  return out.join(" ");
};

const N = probe(IN).frames;
const before = (await measureMotion(IN)).map((q) => q.speed); // step i: frame i → i+1
// rate per source frame i (applied to the step into frame i), from the smoothed speed of that step
const sp = smooth([before[0], ...before], SMOOTH);
const r = smooth(sp.map((v) => Math.min(RMAX, Math.max(1, TARGET / v))), SMOOTH).map((v) => Math.max(1, v));
const tau = [0];
for (let i = 1; i < N; i++) tau.push(tau[i - 1] + 1 / r[i]);
const K = Math.floor(tau[N - 1]) + 1;
const expr = tau.map((t, i) => `eq(N,${i})*${t.toFixed(6)}`).join("+");
const filter = `[0:v]setpts='(${expr})/${FPS}/TB',minterpolate=fps=${FPS}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1:scd=none:search_param=64,trim=end_frame=${K},setpts=PTS-STARTPTS[out]`;
const script = join(WORK, `${basename(OUT).replace(/\.[^.]+$/, "")}-remap.txt`);
writeFileSync(script, filter);
console.log(`${basename(IN)}: ${N} frames, target ${TARGET} px/frame, rate 1.00–${Math.max(...r).toFixed(2)}× → ${K} frames (${(K / FPS).toFixed(2)} s)`);
const enc = spawnSync(FF, ["-hide_banner", "-loglevel", "error", "-y", "-i", IN, "-filter_complex_script", script, "-map", "[out]", "-r", String(FPS), "-an", "-c:v", "libx264", "-qp", "0", "-preset", "fast", "-pix_fmt", "yuv420p", "-color_range", "tv", "-video_track_timescale", "12288", OUT], { encoding: "utf8", maxBuffer: 1 << 26 });
if (enc.status !== 0) throw new Error(enc.stderr);
const after = (await measureMotion(OUT)).map((q) => q.speed);
const spread = (a) => {
  const s = smooth(a, 9);
  return `${Math.min(...s).toFixed(2)}–${Math.max(...s).toFixed(2)} (max/min ${(Math.max(...s) / Math.min(...s)).toFixed(2)}×)`;
};
console.log(`speed per half second before: ${halfSeconds(before)}\nspeed per half second after:  ${halfSeconds(after)}`);
console.log(`smoothed pace before ${spread(before)}; after ${spread(after)}; first 12 steps after ${(after.slice(0, 12).reduce((a, b) => a + b, 0) / 12).toFixed(2)}, last 12 ${(after.slice(-12).reduce((a, b) => a + b, 0) / 12).toFixed(2)}`);
writeFileSync(join(WORK, `${basename(OUT)}.json`), JSON.stringify({ N, K, target: TARGET, rmax: RMAX, smooth: SMOOTH, r, tau, before, after }, null, 1));
