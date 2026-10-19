// Colour-match an upscaled hero clip back to its raw source (docs/HERO_RESUME.md, sharpness pass): a per-clip
// CIELAB mean + standard-deviation transfer (Reinhard), baked into a 3D LUT and applied with ffmpeg's lut3d at full
// resolution, then verified against the source.
// Usage: node scripts/hero-colormatch.mjs <raw-source.mp4> <upscaled.mp4> <out.mp4> [workdir]
//
// Statistics come from every frame of both clips scaled to 960 px wide with area averaging, so the detail the upscaler
// added does not count as contrast; one transform per clip (never per frame), so it cannot flicker. YCbCr ↔ RGB uses
// BT.709 limited range both ways. The output is lossless H.264 (the stitch input). Exit code 1 when the mean colour
// after the match is outside the tolerance: CIE76 ΔE of the clip means ≤ 1.0 and every 8-bit Y/U/V mean within 1.0.
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { FF } from "./video-metrics.mjs";

const [SRC, UP, OUT, WORK = join(dirname(OUT), "colormatch-work")] = process.argv.slice(2);
if (!SRC || !UP || !OUT) {
  console.error("usage: node scripts/hero-colormatch.mjs <raw-source.mp4> <upscaled.mp4> <out.mp4> [workdir]");
  process.exit(1);
}
mkdirSync(WORK, { recursive: true });
const STAT_W = 960;
const LUT_N = 65;

// sRGB ↔ CIELAB (D65)
const D = 6 / 29;
const XN = 0.95047;
const ZN = 1.08883;
const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fromLin = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const f = (t) => (t > D ** 3 ? Math.cbrt(t) : t / (3 * D * D) + 4 / 29);
const finv = (t) => (t > D ? t ** 3 : 3 * D * D * (t - 4 / 29));
const LIN8 = Float64Array.from({ length: 256 }, (_, i) => toLin(i / 255));
function rgbToLab(r, g, b) {
  // linear RGB in
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / XN;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / ZN;
  const fy = f(y);
  return [116 * fy - 16, 500 * (f(x) - fy), 200 * (fy - f(z))];
}
function labToRgb(L, a, bb) {
  const fy = (L + 16) / 116;
  const x = XN * finv(fy + a / 500);
  const y = finv(fy);
  const z = ZN * finv(fy - bb / 200);
  return [3.2404542 * x - 1.5371385 * y - 0.4985314 * z, -0.969266 * x + 1.8760108 * y + 0.041556 * z, 0.0556434 * x - 0.2040259 * y + 1.0572252 * z];
}

/** Clip-wide Lab mean/std and Y/U/V means from every frame at STAT_W wide. */
function stats(path) {
  const vf = `scale=${STAT_W}:-2:flags=area:in_color_matrix=bt709:in_range=tv,format=rgb24`;
  const r = spawnSync(FF, ["-hide_banner", "-loglevel", "error", "-i", path, "-vf", vf, "-f", "rawvideo", "pipe:1"], { maxBuffer: 2 ** 31 });
  if (r.status !== 0) throw new Error(`decode failed: ${path}: ${r.stderr}`);
  const px = r.stdout;
  const s = [0, 0, 0];
  const s2 = [0, 0, 0];
  const n = px.length / 3;
  for (let i = 0; i < px.length; i += 3) {
    const lab = rgbToLab(LIN8[px[i]], LIN8[px[i + 1]], LIN8[px[i + 2]]);
    for (let k = 0; k < 3; k++) {
      s[k] += lab[k];
      s2[k] += lab[k] * lab[k];
    }
  }
  const mean = s.map((q) => q / n);
  const std = s2.map((q, k) => Math.sqrt(q / n - mean[k] * mean[k]));
  // limited-range YUV plane means at the same size (what the shootout's colour check measures)
  const y = spawnSync(FF, ["-hide_banner", "-loglevel", "error", "-i", path, "-vf", `scale=${STAT_W}:-2:flags=area:out_range=tv,format=yuv444p`, "-f", "rawvideo", "pipe:1"], { maxBuffer: 2 ** 31 });
  const frames = countFrames(path);
  const per = y.stdout.length / (3 * frames); // pixels per plane per frame (frames are planar Y, U, V)
  const yuv = [0, 0, 0];
  for (let k = 0; k < frames; k++) {
    for (let p = 0; p < 3; p++) {
      const off = (3 * k + p) * per;
      let acc = 0;
      for (let i = 0; i < per; i++) acc += y.stdout[off + i];
      yuv[p] += acc / per;
    }
  }
  return { mean, std, yuv: yuv.map((q) => q / frames), frames, pixels: n };
}

const frameCache = new Map();
function countFrames(path) {
  if (!frameCache.has(path)) {
    const r = spawnSync(FF, ["-hide_banner", "-i", path, "-map", "0:v:0", "-c", "copy", "-f", "null", "-"], { encoding: "utf8" });
    frameCache.set(path, +[...r.stderr.matchAll(/frame=\s*(\d+)/g)].pop()[1]);
  }
  return frameCache.get(path);
}

const fmt = (a, d = 2) => a.map((q) => q.toFixed(d)).join(" / ");
const src = stats(SRC);
const up = stats(UP);
console.log(`source   ${basename(SRC)}: Lab mean ${fmt(src.mean)}  std ${fmt(src.std)}  YUV ${fmt(src.yuv)}`);
console.log(`upscaled ${basename(UP)}: Lab mean ${fmt(up.mean)}  std ${fmt(up.std)}  YUV ${fmt(up.yuv)}`);
const gain = src.std.map((q, k) => q / up.std[k]);
console.log(`transfer: L/a/b gain ${fmt(gain, 4)}, offsets to source mean ${fmt(src.mean.map((q, k) => q - up.mean[k]), 3)}`);

// bake the transfer into a 3D LUT (R fastest, as .cube expects)
const lines = [`TITLE "hero colour match ${basename(UP)} → ${basename(SRC)}"`, `LUT_3D_SIZE ${LUT_N}`, "DOMAIN_MIN 0 0 0", "DOMAIN_MAX 1 1 1"];
for (let b = 0; b < LUT_N; b++)
  for (let g = 0; g < LUT_N; g++)
    for (let r = 0; r < LUT_N; r++) {
      const lab = rgbToLab(toLin(r / (LUT_N - 1)), toLin(g / (LUT_N - 1)), toLin(b / (LUT_N - 1)));
      const t = lab.map((q, k) => src.mean[k] + (q - up.mean[k]) * gain[k]);
      const rgb = labToRgb(...t).map((q) => Math.min(1, Math.max(0, fromLin(Math.min(1, Math.max(0, q))))));
      lines.push(rgb.map((q) => q.toFixed(6)).join(" "));
    }
const cube = join(WORK, `${basename(UP).replace(/\.[^.]+$/, "")}.cube`);
writeFileSync(cube, lines.join("\n") + "\n");

// apply at full resolution in 16-bit RGB, back to 4:2:0, lossless
const vf = `scale=in_color_matrix=bt709:in_range=tv,format=gbrp16le,lut3d=file='${cube}':interp=tetrahedral,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p`;
await new Promise((resolve, reject) => {
  const p = spawn(FF, ["-hide_banner", "-loglevel", "error", "-y", "-i", UP, "-vf", vf, "-an", "-c:v", "libx264", "-qp", "0", "-preset", "fast", "-color_range", "tv", "-video_track_timescale", "12288", OUT], { stdio: ["ignore", "inherit", "inherit"] });
  p.on("close", (c) => (c === 0 ? resolve() : reject(new Error(`ffmpeg exited ${c}`))));
});

// verify
const out = stats(OUT);
const dE = Math.hypot(...out.mean.map((q, k) => q - src.mean[k]));
const dYUV = out.yuv.map((q, k) => q - src.yuv[k]);
const dEbefore = Math.hypot(...up.mean.map((q, k) => q - src.mean[k]));
console.log(`matched  ${basename(OUT)}: Lab mean ${fmt(out.mean)}  std ${fmt(out.std)}  YUV ${fmt(out.yuv)}`);
console.log(`ΔE of the clip means: ${dEbefore.toFixed(2)} before → ${dE.toFixed(2)} after; ΔY/ΔU/ΔV ${fmt(up.yuv.map((q, k) => q - src.yuv[k]))} before → ${fmt(dYUV)} after; frames ${countFrames(SRC)} → ${countFrames(OUT)}`);
const ok = dE <= 1.0 && dYUV.every((q) => Math.abs(q) <= 1.0) && countFrames(OUT) === countFrames(UP);
writeFileSync(join(WORK, `${basename(OUT)}.json`), JSON.stringify({ src, up, out, gain, dE, dEbefore, dYUV, ok }, null, 2));
console.log(ok ? "colour match: PASS" : "colour match: FAIL (outside tolerance)");
process.exit(ok ? 0 : 1);
