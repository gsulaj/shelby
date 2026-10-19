// The proof morph's in-place dissolve (PROOF_BRIEF.md step 5): Clip D (damaged) → Clip F (new roof) with a dissolve
// centred on the shared frame, while the camera keeps moving.
// Usage: node scripts/proof-seam-blend.mjs <D.mp4> <F.mp4> <out.mp4> [--half 8]
//
// Clip F starts on F0, an edit of D's last frame, so D's last frame and F's first frame show the same roof from the same
// camera. A plain crossfade (xfade) would overlap D's last 0.7 s with F's first 0.7 s: two different moments of the
// move, about 17 frames of camera travel apart, so every course line would show twice. Instead both layers are put on
// one camera timeline, D on frames 0…ND−1 and F on ND−1…ND+NF−2 (D_last and F0 share frame ND−1), and each is extended
// past its own end by moving its seam frame with the other clip's measured camera motion:
//   - after the seam (frame ND−1+j): D's layer is D_last carried along F's motion from F0 to F_j;
//   - before the seam (frame ND−1−j): F's layer is F0 carried back along D's motion from D_last to D_(ND−1−j).
// Motion per step is the affine field from scripts/proof-motion.mjs (tile-matched at 960 px), composed over the steps.
// The dissolve weight is a smoothstep over 2·half+1 frames centred on the seam (half = 8: 17 frames, 0.71 s), so at
// the seam frame D_last and F0 are blended 50/50. Output: D frames 0…ND−2−half, the blended frames, F frames
// half+1…NF−1 → ND + NF − 1 frames, lossless H.264 (yuv420p, tv range, untagged, like the inputs).
// Self-check printed: D's own motion carried from D_(ND−1−half) onto D_last, compared with the real D_last (the same
// kind of extrapolation the extended layers use), against the unmoved frame.
import { spawn, spawnSync } from "node:child_process";
import { measureMotion } from "./proof-motion.mjs";
import { FF, probe } from "./video-metrics.mjs";

const args = process.argv.slice(2);
const [DIN, FIN, OUT] = args;
if (!DIN || !FIN || !OUT) {
  console.error("usage: node scripts/proof-seam-blend.mjs <D.mp4> <F.mp4> <out.mp4> [--half 8]");
  process.exit(1);
}
const HALF = args.includes("--half") ? +args[args.indexOf("--half") + 1] : 8;
const pd = probe(DIN);
const pf = probe(FIN);
if (pd.w !== pf.w || pd.h !== pf.h) throw new Error("D and F must have the same size");
const W = pd.w;
const H = pd.h;
const ND = pd.frames;
const NF = pf.frames;
const FRAME = W * H * 3;

function rgbFrames(path, from, to) {
  const r = spawnSync(FF, ["-hide_banner", "-loglevel", "error", "-i", path, "-vf", `select='between(n\\,${from}\\,${to})'`, "-fps_mode", "passthrough", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"], {
    maxBuffer: FRAME * (to - from + 1) + 1024,
  });
  if (r.status !== 0) throw new Error(r.stderr.toString());
  return Array.from({ length: to - from + 1 }, (_, i) => r.stdout.subarray(i * FRAME, (i + 1) * FRAME));
}

// 3×3 matrices: a step's affine displacement d maps p → p + d(p)
const stepMatrix = (aff) => [
  [1 + aff[0][0], aff[0][1], aff[0][2]],
  [aff[1][0], 1 + aff[1][1], aff[1][2]],
  [0, 0, 1],
];
const mul = (A, B) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
const inv = (M) => {
  const [[a, b, c], [d, e, f]] = M;
  const det = a * e - b * d;
  return [
    [e / det, -b / det, (b * f - c * e) / det],
    [-d / det, a / det, (c * d - a * f) / det],
    [0, 0, 1],
  ];
};
const I3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

/** out(p) = img(S·p), bilinear, edges clamped. */
function warp(img, S) {
  const out = Buffer.alloc(FRAME);
  const [[a, b, c], [d, e, f]] = S;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let sx = a * x + b * y + c;
      let sy = d * x + e * y + f;
      sx = sx < 0 ? 0 : sx > W - 1 ? W - 1 : sx;
      sy = sy < 0 ? 0 : sy > H - 1 ? H - 1 : sy;
      const ix = Math.min(W - 2, Math.floor(sx));
      const iy = Math.min(H - 2, Math.floor(sy));
      const fx = sx - ix;
      const fy = sy - iy;
      const i00 = (iy * W + ix) * 3;
      const i01 = i00 + 3;
      const i10 = i00 + W * 3;
      const i11 = i10 + 3;
      const o = (y * W + x) * 3;
      for (let k = 0; k < 3; k++) {
        const top = img[i00 + k] + (img[i01 + k] - img[i00 + k]) * fx;
        const bot = img[i10 + k] + (img[i11 + k] - img[i10 + k]) * fx;
        out[o + k] = Math.round(top + (bot - top) * fy);
      }
    }
  }
  return out;
}

/** Mean absolute luma difference over the central 80% of two RGB frames (sampled every 2nd pixel). */
function mad(p, q) {
  let s = 0;
  let n = 0;
  for (let y = Math.round(0.1 * H); y < 0.9 * H; y += 2)
    for (let x = Math.round(0.1 * W); x < 0.9 * W; x += 2) {
      const i = (y * W + x) * 3;
      s += Math.abs(0.299 * (p[i] - q[i]) + 0.587 * (p[i + 1] - q[i + 1]) + 0.114 * (p[i + 2] - q[i + 2]));
      n++;
    }
  return s / n;
}

console.log(`D ${ND} frames, F ${NF} frames, ${W}×${H}; dissolve ${2 * HALF + 1} frames (${((2 * HALF + 1) / 24).toFixed(2)} s) centred on the seam`);
const md = await measureMotion(DIN, ND - 1 - HALF, ND - 1); // steps ND-1-HALF … ND-2
const mf = await measureMotion(FIN, 0, HALF); // steps 0 … HALF-1
const speed = (m) => (m.reduce((s, q) => s + q.speed, 0) / m.length).toFixed(2);
console.log(`camera speed at the seam: D's last ${HALF} steps ${speed(md)} px/frame, F's first ${HALF} steps ${speed(mf)} px/frame`);

// Q[j]: maps D frame (ND-1-j) coordinates to D_last coordinates; P[j]: maps F0 coordinates to F_j coordinates
const Q = [I3];
for (let j = 1; j <= HALF; j++) Q.push(mul(Q[j - 1], stepMatrix(md[HALF - j].aff)));
const P = [I3];
for (let j = 1; j <= HALF; j++) P.push(mul(stepMatrix(mf[j - 1].aff), P[j - 1]));

const dFrames = rgbFrames(DIN, ND - 1 - HALF, ND - 1); // index i ↔ D frame ND-1-HALF+i
const fFrames = rgbFrames(FIN, 0, HALF);
const dLast = dFrames[HALF];
const f0 = fFrames[0];

// self-check: D_(ND-1-HALF) carried onto D_last's camera with D's own measured motion
const predicted = warp(dFrames[0], inv(Q[HALF]));
console.log(
  `self-check (D frame ${ND - 1 - HALF} carried ${HALF} steps onto D_last): mean |ΔY| ${mad(predicted, dLast).toFixed(2)} vs ${mad(dFrames[0], dLast).toFixed(2)} unmoved`,
);

const smoothstep = (t) => t * t * (3 - 2 * t);
const enc = spawn(FF, ["-hide_banner", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", `${W}x${H}`, "-r", "24", "-i", "pipe:0", "-an", "-c:v", "libx264", "-qp", "0", "-preset", "fast", "-pix_fmt", "yuv420p", "-color_range", "tv", "-video_track_timescale", "12288", `${OUT}.blend.mp4`]);
const done = new Promise((res, rej) => enc.on("close", (c) => (c === 0 ? res() : rej(new Error(`blend encode exit ${c}`)))));
const weights = [];
for (let k = -HALF; k <= HALF; k++) {
  const dLayer = k <= 0 ? dFrames[HALF + k] : warp(dLast, inv(P[k]));
  const fLayer = k >= 0 ? fFrames[k] : warp(f0, Q[-k]);
  const wF = smoothstep((k + HALF + 1) / (2 * HALF + 2));
  weights.push(wF.toFixed(3));
  const out = Buffer.alloc(FRAME);
  for (let i = 0; i < FRAME; i++) out[i] = Math.round(dLayer[i] * (1 - wF) + fLayer[i] * wF);
  if (!enc.stdin.write(out)) await new Promise((r) => enc.stdin.once("drain", r));
}
enc.stdin.end();
await done;
console.log(`F weights across the dissolve: ${weights.join(" ")}`);

// assemble: D head + blend + F tail, lossless
const filter = `[0:v]trim=end_frame=${ND - 1 - HALF},setpts=PTS-STARTPTS[a];[1:v]setpts=PTS-STARTPTS[b];[2:v]trim=start_frame=${HALF + 1},setpts=PTS-STARTPTS[c];[a][b][c]concat=n=3:v=1:a=0,format=yuv420p[out]`;
const cat = spawnSync(FF, ["-hide_banner", "-loglevel", "error", "-y", "-i", DIN, "-i", `${OUT}.blend.mp4`, "-i", FIN, "-filter_complex", filter, "-map", "[out]", "-r", "24", "-an", "-c:v", "libx264", "-qp", "0", "-preset", "fast", "-color_range", "tv", "-video_track_timescale", "12288", OUT], { encoding: "utf8" });
if (cat.status !== 0) throw new Error(cat.stderr);
const n = probe(OUT).frames;
console.log(`out: ${OUT} — ${n} frames (${(n / 24).toFixed(2)} s; expected ${ND + NF - 1}); seam (50/50) at frame ${ND - 1} = ${((ND - 1) / 24).toFixed(2)} s`);
