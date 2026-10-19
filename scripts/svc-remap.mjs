// Even out a services clip's camera speed (SERVICES_BRIEF.md §1 "constant speed"): a speed-up-only time-remap, the
// hero's method (scripts/hero-remap-plan.mjs) planned globally instead of locally.
// Usage: node scripts/svc-remap.mjs <in.mp4> <out.mp4> [--target-pct 60] [--rmax 4] [--smooth 9] [--workdir dir]
//
// Kling eases into a first-frame-only move: the siding track accelerates about 4× over its 5 s, the windows dolly over
// its first second, and a crossfade loop would then join a fast end to a slow start. Motion per frame = ffmpeg
// signalstats YDIF at 480 px (it tracks displacement, not texture), smoothed over --smooth frames. Target pace = the
// --target-pct percentile of that motion. Every frame slower than the target plays faster, up to --rmax, and nothing is
// slowed down, so the fast passages keep their native frames. The rate is smoothed so acceleration stays gentle. The
// frames are re-timed with setpts and minterpolate (the hero's settings: mci / aobmc / bidir / vsbmc, search 64)
// renders constant 24 fps; each output frame interpolates between two consecutive source frames, whose displacement is
// small precisely because the passage was slow. Output is lossless; prints the motion table before and after.
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { FF, probe } from "./video-metrics.mjs";

const args = process.argv.slice(2);
const [IN, OUT] = args;
if (!IN || !OUT) {
  console.error("usage: node scripts/svc-remap.mjs <in.mp4> <out.mp4> [--target-pct 60] [--rmax 4] [--smooth 9] [--workdir dir]");
  process.exit(1);
}
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const PCT = +opt("--target-pct", 60);
const RMAX = +opt("--rmax", 4);
const SMOOTH = +opt("--smooth", 9);
const WORK = opt("--workdir", join(dirname(OUT), "remap-work"));
mkdirSync(WORK, { recursive: true });
const FPS = 24;

function motion(path) {
  const r = spawnSync(FF, ["-hide_banner", "-loglevel", "error", "-i", path, "-vf", "scale=480:-2:flags=area,signalstats,metadata=print:key=lavfi.signalstats.YDIF:file=-", "-f", "null", "-"], { encoding: "utf8", maxBuffer: 1 << 26 });
  return r.stdout
    .split("\n")
    .map((l) => l.match(/YDIF=([\d.]+)/))
    .filter(Boolean)
    .map((m) => +m[1]);
}
const table = (m) => m.map((v, i) => `${i % FPS === 0 ? `\n  ${(i / FPS).toFixed(0).padStart(2)} s ` : ""}${v.toFixed(1).padStart(5)}`).join("");
const smooth = (a, w) => a.map((_, i) => {
  const h = Math.floor(w / 2);
  let s = 0;
  let n = 0;
  for (let k = i - h; k <= i + h; k++) {
    if (k >= 0 && k < a.length) {
      s += a[k];
      n++;
    }
  }
  return s / n;
});

const N = probe(IN).frames;
const m = motion(IN);
m[0] = m[1]; // frame 0 has no predecessor
const ms = smooth(m, SMOOTH);
const sorted = [...ms].sort((a, b) => a - b);
const target = sorted[Math.floor((PCT / 100) * (sorted.length - 1))];
const r = smooth(ms.map((v) => Math.min(RMAX, Math.max(1, target / v))), SMOOTH).map((v) => Math.max(1, v));
// output time of each source frame (in output frames)
const tau = [0];
for (let i = 1; i < N; i++) tau.push(tau[i - 1] + 1 / r[i]);
const K = Math.floor(tau[N - 1]) + 1;
const expr = tau.map((t, i) => `eq(N,${i})*${t.toFixed(6)}`).join("+");
const filter = `[0:v]setpts='(${expr})/${FPS}/TB',minterpolate=fps=${FPS}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1:scd=none:search_param=64,trim=end_frame=${K},setpts=PTS-STARTPTS[out]`;
const script = join(WORK, `${basename(OUT).replace(/\.[^.]+$/, "")}-remap.txt`);
writeFileSync(script, filter);
console.log(`${basename(IN)}: ${N} frames, target pace ${target.toFixed(2)} (${PCT}th percentile), rate 1.00–${Math.max(...r).toFixed(2)}× → ${K} frames (${(K / FPS).toFixed(2)} s)`);
const enc = spawnSync(FF, ["-hide_banner", "-loglevel", "error", "-y", "-i", IN, "-filter_complex_script", script, "-map", "[out]", "-r", String(FPS), "-an", "-c:v", "libx264", "-qp", "0", "-preset", "fast", "-pix_fmt", "yuv420p", "-color_range", "tv", "-video_track_timescale", "12288", OUT], { encoding: "utf8" });
if (enc.status !== 0) throw new Error(enc.stderr);
const m2 = motion(OUT);
const steady = (a) => {
  const s = smooth(a.slice(1), SMOOTH);
  return `${Math.min(...s).toFixed(2)}–${Math.max(...s).toFixed(2)} (max/min ${(Math.max(...s) / Math.min(...s)).toFixed(2)}×)`;
};
console.log(`motion before (row = 1 s):${table(m)}\nmotion after (${probe(OUT).frames} frames):${table(m2)}`);
console.log(`smoothed pace before ${steady(m)}; after ${steady(m2)}`);
writeFileSync(join(WORK, `${basename(OUT)}.json`), JSON.stringify({ N, K, target, pct: PCT, rmax: RMAX, r, tau, before: m, after: m2 }, null, 1));
