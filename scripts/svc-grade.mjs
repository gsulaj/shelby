// Grade a services clip to the hero (SERVICES_BRIEF.md §1 "Light and grade", §4.2): the hero's own finishing grade,
// then a small correction measured against the hero master so all five videos read as one afternoon.
// Usage: node scripts/svc-grade.mjs <in.mp4> <hero-reference.mp4> <out.mp4> [--lift γ] [--warm Δb] [--anchors auto|none]
//        [--da Δa] [--db Δb] [--gain g] [--workdir dir] [--frame n --preview out.jpg] [--report]
// --report measures an existing <out.mp4> against <in.mp4> (same pixels before/after) without regrading.
//
// The clips show other scenes than the hero (a close-up roof, a navy wall, a living room), so a whole-frame statistics
// transfer (the colour match used after an upscale) would be wrong: it would make an interior's tones copy a house
// exterior. Instead the correction is anchored on content classes both share, measured in CIELAB (D65) on the hero's
// grain-free graded master and on the clip after the hero grade:
//   - neutral highlights (L* ≥ 70, C* ≤ 10: white trim, clouds, sunlit walls) set the white balance: the clip's mean
//     a*/b* there moves to the hero's (one global shift, clamped to ±4), when they cover ≥ 0.5% of the clip;
//   - sky (hue 220–290°, C* ≥ 12, L* ≥ 45) and foliage (hue 95–150°, C* ≥ 12, L* 20–80) set saturation: chroma gain =
//     the mean of hero/clip median-chroma ratios over the classes both have (≥ 1% of pixels), clamped to 0.90–1.15.
// Lightness is left alone (each clip is exposed for its own scene), except with --lift γ (L' = 100·(L/100)^(1/γ)),
// used for the kept gutters clip, which was graded overcast and dark in v1. --warm adds an explicit b* shift.
// --split weights the a*/b* shift by lightness (smoothstep over L* 15–70): warm light on highlights, neutral shadows.
// --scurve k (> 1) adds a gentle S-curve on L* after the lift so a lifted scene does not go milky.
// --no-wb keeps the saturation anchor but skips the white-balance one (an interior, whose bright neutrals are walls lit
// by warm sun rather than white trim or clouds: matching them to the hero's whites would cool the golden light away).
// --anchors none skips the class anchors (a scene with no true sky, foliage or white: the rain-soaked gutters clip, whose
// wet blue shingles read as "sky"); --da/--db/--gain then set the correction by hand. --frame n --preview f.jpg grades
// one frame to a JPG and exits (for choosing settings).
// The correction is baked into a 65³ LUT after the grade and applied at full resolution; output is lossless H.264,
// grain-free (grain goes on last, in the finish). Prints the class means before/after against the hero, plus the
// clipped and crushed pixel shares.
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { FF, probe } from "./video-metrics.mjs";

const args = process.argv.slice(2);
const [IN, REF, OUT] = args;
if (!IN || !REF || !OUT) {
  console.error("usage: node scripts/svc-grade.mjs <in.mp4> <hero-reference.mp4> <out.mp4> [--lift γ] [--warm Δb] [--workdir dir]");
  process.exit(1);
}
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const LIFT = +opt("--lift", 1);
const WARM = +opt("--warm", 0);
const SPLIT = args.includes("--split"); // weight the a*/b* shift by lightness (sunlight warms highlights, not shadows)
const SCURVE = +opt("--scurve", 1); // > 1: a gentle S on L* after the lift (0 and 100 fixed, pivot L* 50) so a lifted scene keeps depth
const WORK = opt("--workdir", join(dirname(OUT), "grade-work"));
const ANCHORS = opt("--anchors", "auto");
const NO_WB = args.includes("--no-wb"); // an interior: its bright neutrals are warm-lit walls, not a white reference
const PREVIEW = opt("--preview", null);
const FRAME = +opt("--frame", 0);
mkdirSync(WORK, { recursive: true });
export const HERO_GRADE = "eq=saturation=1.05:contrast=1.01,colorbalance=rm=0.018:gm=0.004:bm=-0.022:rh=0.008:bh=-0.012";
const STAT_W = 960;
const LUT_N = 65;

// sRGB ↔ CIELAB (D65), as in scripts/hero-colormatch.mjs
const D = 6 / 29;
const XN = 0.95047;
const ZN = 1.08883;
const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fromLin = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const f = (t) => (t > D ** 3 ? Math.cbrt(t) : t / (3 * D * D) + 4 / 29);
const finv = (t) => (t > D ? t ** 3 : 3 * D * D * (t - 4 / 29));
const LIN8 = Float64Array.from({ length: 256 }, (_, i) => toLin(i / 255));
function rgbToLab(r, g, b) {
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

const CLASSES = {
  neutralHi: (L, a, b, C) => L >= 70 && C <= 10,
  sky: (L, a, b, C, h) => L >= 45 && C >= 12 && h >= 220 && h <= 290,
  foliage: (L, a, b, C, h) => L >= 20 && L <= 80 && C >= 12 && h >= 95 && h <= 150,
};

/** Class statistics over `count` evenly spaced frames of `path`, after the optional filter chain `pre`. */
function stats(path, pre, count = 30) {
  const n = probe(path).frames;
  const step = Math.max(1, Math.floor(n / count));
  const vf = [`select='not(mod(n\\,${step}))'`, pre, pre ? "format=yuv420p" : "", `scale=${STAT_W}:-2:flags=area:in_color_matrix=bt709:in_range=tv`, "format=rgb24"].filter(Boolean).join(",");
  const r = spawnSync(FF, ["-hide_banner", "-loglevel", "error", "-i", path, "-vf", vf, "-fps_mode", "passthrough", "-f", "rawvideo", "pipe:1"], { maxBuffer: 2 ** 31 });
  if (r.status !== 0) throw new Error(`decode failed: ${path}: ${r.stderr}`);
  const px = r.stdout;
  const acc = Object.fromEntries(Object.keys(CLASSES).map((k) => [k, { n: 0, L: 0, a: 0, b: 0, C: [] }]));
  let total = 0;
  let clipped = 0;
  let crushed = 0;
  let sumL = 0;
  const Ls = [];
  for (let i = 0; i < px.length; i += 3) {
    total++;
    if (px[i] >= 254 || px[i + 1] >= 254 || px[i + 2] >= 254) clipped++;
    if (px[i] <= 2 && px[i + 1] <= 2 && px[i + 2] <= 2) crushed++;
    const [L, a, b] = rgbToLab(LIN8[px[i]], LIN8[px[i + 1]], LIN8[px[i + 2]]);
    sumL += L;
    if (i % 30 === 0) Ls.push(L);
    const C = Math.hypot(a, b);
    let h = (Math.atan2(b, a) * 180) / Math.PI;
    if (h < 0) h += 360;
    for (const [k, test] of Object.entries(CLASSES)) {
      if (!test(L, a, b, C, h)) continue;
      const s = acc[k];
      s.n++;
      s.L += L;
      s.a += a;
      s.b += b;
      if (s.C.length < 400000 && i % 9 === 0) s.C.push(C);
    }
  }
  Ls.sort((p, q) => p - q);
  const out = { total, clipped: clipped / total, crushed: crushed / total, meanL: sumL / total, p2L: Ls[Math.floor(0.02 * Ls.length)], p98L: Ls[Math.floor(0.98 * Ls.length)], classes: {} };
  for (const [k, s] of Object.entries(acc)) {
    s.C.sort((p, q) => p - q);
    out.classes[k] = s.n ? { share: s.n / total, L: s.L / s.n, a: s.a / s.n, b: s.b / s.n, medC: s.C[Math.floor(s.C.length / 2)] ?? 0 } : { share: 0 };
  }
  return out;
}

/** Class means of the same pixels in two versions of a clip: membership is decided on version A, measured in A and B. */
function pairedStats(pathA, preA, pathB, preB, count = 30) {
  const n = probe(pathA).frames;
  const step = Math.max(1, Math.floor(n / count));
  const dec = (path, pre) => {
    const vf = [`select='not(mod(n\\,${step}))'`, pre, pre ? "format=yuv420p" : "", `scale=${STAT_W}:-2:flags=area:in_color_matrix=bt709:in_range=tv`, "format=rgb24"].filter(Boolean).join(",");
    const r = spawnSync(FF, ["-hide_banner", "-loglevel", "error", "-i", path, "-vf", vf, "-fps_mode", "passthrough", "-f", "rawvideo", "pipe:1"], { maxBuffer: 2 ** 31 });
    if (r.status !== 0) throw new Error(`decode failed: ${path}: ${r.stderr}`);
    return r.stdout;
  };
  const A = dec(pathA, preA);
  const B = dec(pathB, preB);
  const len = Math.min(A.length, B.length);
  const acc = Object.fromEntries(Object.keys(CLASSES).map((k) => [k, { n: 0, a: [0, 0, 0], b: [0, 0, 0] }]));
  let total = 0;
  for (let i = 0; i < len; i += 3) {
    total++;
    const la = rgbToLab(LIN8[A[i]], LIN8[A[i + 1]], LIN8[A[i + 2]]);
    const C = Math.hypot(la[1], la[2]);
    let h = (Math.atan2(la[2], la[1]) * 180) / Math.PI;
    if (h < 0) h += 360;
    let lb = null;
    for (const [k, test] of Object.entries(CLASSES)) {
      if (!test(la[0], la[1], la[2], C, h)) continue;
      lb ??= rgbToLab(LIN8[B[i]], LIN8[B[i + 1]], LIN8[B[i + 2]]);
      const s = acc[k];
      s.n++;
      for (let q = 0; q < 3; q++) {
        s.a[q] += la[q];
        s.b[q] += lb[q];
      }
    }
  }
  const out = {};
  for (const [k, s] of Object.entries(acc)) out[k] = s.n ? { share: s.n / total, A: s.a.map((q) => q / s.n), B: s.b.map((q) => q / s.n) } : { share: 0 };
  return out;
}

const fmt = (c) => (c && c.share ? `${(100 * c.share).toFixed(1).padStart(5)}%  Lab ${c.L.toFixed(1)}/${c.a.toFixed(1)}/${c.b.toFixed(1)}  C̃ ${c.medC.toFixed(1)}` : "  —");
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

const hero = stats(REF, "", 15);
const before = stats(IN, HERO_GRADE, PREVIEW ? 8 : 30);

// white balance from neutral highlights
let da = 0;
let db = 0;
const nh = before.classes.neutralHi;
if (ANCHORS === "auto" && !NO_WB && nh.share >= 0.005 && hero.classes.neutralHi.share) {
  da = clamp(hero.classes.neutralHi.a - nh.a, -4, 4);
  db = clamp(hero.classes.neutralHi.b - nh.b, -4, 4);
}
db += WARM;
if (args.includes("--da")) da = +opt("--da");
if (args.includes("--db")) db = +opt("--db");
// saturation from sky and foliage
const ratios = ANCHORS !== "auto" ? [] : ["sky", "foliage"].filter((k) => before.classes[k].share >= 0.01 && hero.classes[k].share >= 0.01).map((k) => hero.classes[k].medC / before.classes[k].medC);
const gain = args.includes("--gain") ? +opt("--gain") : ratios.length ? clamp(ratios.reduce((s, q) => s + q, 0) / ratios.length, 0.9, 1.15) : 1;
console.log(`${basename(IN)}: white balance Δa* ${da.toFixed(2)} Δb* ${db.toFixed(2)}${WARM ? ` (incl. --warm ${WARM})` : ""}, chroma gain ${gain.toFixed(3)} (${ratios.length ? ratios.map((q) => q.toFixed(3)).join(", ") : "no shared sky/foliage"}), lift γ ${LIFT}`);

const lines = [`TITLE "services grade ${basename(IN)}"`, `LUT_3D_SIZE ${LUT_N}`, "DOMAIN_MIN 0 0 0", "DOMAIN_MAX 1 1 1"];
for (let b = 0; b < LUT_N; b++)
  for (let g = 0; g < LUT_N; g++)
    for (let r = 0; r < LUT_N; r++) {
      const [L, a, bb] = rgbToLab(toLin(r / (LUT_N - 1)), toLin(g / (LUT_N - 1)), toLin(b / (LUT_N - 1)));
      let L2 = LIFT === 1 ? L : 100 * Math.max(0, L / 100) ** (1 / LIFT);
      if (SCURVE !== 1) { const x = clamp(L2 / 100, 0, 1); L2 = (100 * x ** SCURVE) / (x ** SCURVE + (1 - x) ** SCURVE); }
      // keep near-black and near-white neutral: fade the white-balance shift in over L* 0–8
      const w = SPLIT ? (() => { const t = clamp((L2 - 15) / 55, 0, 1); return t * t * (3 - 2 * t); })() : clamp(L / 8, 0, 1);
      const rgb = labToRgb(L2, gain * a + w * da, gain * bb + w * db).map((q) => clamp(fromLin(clamp(q, 0, 1)), 0, 1));
      lines.push(rgb.map((q) => q.toFixed(6)).join(" "));
    }
const cube = join(WORK, `${basename(OUT).replace(/\.[^.]+$/, "")}.cube`);
writeFileSync(cube, lines.join("\n") + "\n");
const CHAIN = `${HERO_GRADE},format=yuv420p,scale=in_color_matrix=bt709:in_range=tv,format=gbrp16le,lut3d=file='${cube}':interp=tetrahedral,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p`;
if (args.includes("--report")) {
  const paired = pairedStats(IN, HERO_GRADE, OUT, "");
  for (const [k, c] of Object.entries(paired)) {
    const h = hero.classes[k];
    if (!c.share || !h.share) continue;
    const e = (v) => Math.hypot(v[0] - h.L, v[1] - h.a, v[2] - h.b);
    console.log(`  ${k.padEnd(11)} ${(100 * c.share).toFixed(1).padStart(5)}%  ΔE to hero ${e(c.A).toFixed(1)} → ${e(c.B).toFixed(1)}, chroma-only Δa*b* ${Math.hypot(c.A[1] - h.a, c.A[2] - h.b).toFixed(1)} → ${Math.hypot(c.B[1] - h.a, c.B[2] - h.b).toFixed(1)}`);
  }
  writeFileSync(join(WORK, `${basename(OUT)}.paired.json`), JSON.stringify({ hero: hero.classes, paired }, null, 2));
  process.exit(0);
}
if (PREVIEW) {
  const r = spawnSync(FF, ["-hide_banner", "-loglevel", "error", "-y", "-i", IN, "-vf", `select='eq(n\\,${FRAME})',${CHAIN}`, "-frames:v", "1", "-q:v", "2", PREVIEW]);
  if (r.status !== 0) throw new Error(String(r.stderr));
  console.log(`preview: ${PREVIEW}`);
  process.exit(0);
}
await new Promise((resolve, reject) => {
  const p = spawn(FF, ["-hide_banner", "-loglevel", "error", "-y", "-i", IN, "-vf", CHAIN, "-an", "-c:v", "libx264", "-qp", "0", "-preset", "fast", "-color_range", "tv", "-video_track_timescale", "12288", OUT], { stdio: ["ignore", "inherit", "inherit"] });
  p.on("close", (c) => (c === 0 ? resolve() : reject(new Error(`ffmpeg exited ${c}`))));
});
const raw = stats(IN, "");
const after = stats(OUT, "");
const paired = pairedStats(IN, HERO_GRADE, OUT, "");
const dE = (p, q) => (p && q && p.share && q.share ? Math.hypot(p.L - q.L, p.a - q.a, p.b - q.b) : null);
console.log("class               hero                                   clip raw                               clip graded");
for (const k of Object.keys(CLASSES)) {
  const e0 = dE(raw.classes[k], hero.classes[k]);
  const e1 = dE(after.classes[k], hero.classes[k]);
  console.log(`  ${k.padEnd(11)} ${fmt(hero.classes[k]).padEnd(38)} ${fmt(raw.classes[k]).padEnd(38)} ${fmt(after.classes[k]).padEnd(38)}${e0 != null && e1 != null ? ` ΔE ${e0.toFixed(1)} → ${e1.toFixed(1)}` : ""}`);
}
console.log("same pixels (membership after the hero grade, before the correction) → after the correction, ΔE to the hero class mean:");
for (const [k, c] of Object.entries(paired)) {
  const h = hero.classes[k];
  if (!c.share || !h.share) continue;
  const e = (v) => Math.hypot(v[0] - h.L, v[1] - h.a, v[2] - h.b).toFixed(1);
  const ab = (v) => `${v[0].toFixed(1)}/${v[1].toFixed(1)}/${v[2].toFixed(1)}`;
  console.log(`  ${k.padEnd(11)} ${(100 * c.share).toFixed(1).padStart(5)}%  Lab ${ab(c.A)} → ${ab(c.B)}  (hero ${h.L.toFixed(1)}/${h.a.toFixed(1)}/${h.b.toFixed(1)})  ΔE ${e(c.A)} → ${e(c.B)}, Δa*b* ${Math.hypot(c.A[1] - h.a, c.A[2] - h.b).toFixed(1)} → ${Math.hypot(c.B[1] - h.a, c.B[2] - h.b).toFixed(1)}`);
}
const tone = (s) => `mean L* ${s.meanL.toFixed(1)}, L* 2–98% ${s.p2L.toFixed(1)}–${s.p98L.toFixed(1)}, clipped ${(100 * s.clipped).toFixed(2)}%, crushed ${(100 * s.crushed).toFixed(2)}%`;
console.log(`  tone hero:   ${tone(hero)}\n  tone raw:    ${tone(raw)}\n  tone graded: ${tone(after)}`);
writeFileSync(join(WORK, `${basename(OUT)}.json`), JSON.stringify({ hero, raw, before, after, paired, da, db, gain, lift: LIFT, warm: WARM, grade: HERO_GRADE }, null, 2));
