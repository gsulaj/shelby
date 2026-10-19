// Strict architecture check for an upscaled hero clip (docs/HERO_RESUME.md, sharpness pass): rooflines, windows, the
// tower arch, gutters and the ridge must stay where the raw source has them, whatever texture the upscaler invents.
// Usage: node scripts/hero-architecture-check.mjs <raw-source.mp4> <current-4k.mp4> <new-4k.mp4> <out-dir> [label]
//
// Every 12th frame, all three are scaled to the source size with area averaging and reduced to edge maps, compared
// with the source within 2 px. The decision uses the architecture scale: Gaussian σ 2 then Canny with high thresholds
// (0.12 / 0.3), which keeps only the high-contrast boundaries — rooflines against the sky, ridges and hips, eaves and
// gutters, gable rakes, window frames, the tower arch — and drops texture (shingle courses, mortar, stone joints), which
// the owner accepts changing. Recall = the source's lines still present; precision = no new strong structure (an
// invented pier or window shows up here). The new clip passes when its mean recall and mean precision are each at least
// the current clip's − 0.03 and its worst frame at least the current clip's worst − 0.05 on both. Two lower-threshold
// scales (σ 3.5 "geometry" and σ 2 "structure", the shootout's c-check) are reported alongside; close to the roof they
// include shingle courses. Overlays (source edges red, new edges cyan, both white) go to out-dir. Exit 1 on a failure.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { edgeF1, edgeMaps, grabFrames, mean, probe, yuvToRgb } from "./video-metrics.mjs";

const [SRC, CUR, NEW, OUT, LABEL = "clip"] = process.argv.slice(2);
if (!SRC || !CUR || !NEW || !OUT) {
  console.error("usage: node scripts/hero-architecture-check.mjs <raw-source.mp4> <current-4k.mp4> <new-4k.mp4> <out-dir> [label]");
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });
const { w: SW, h: SH, frames: N } = probe(SRC);
const FRAMES = Array.from({ length: Math.floor((N - 1) / 12) + 1 }, (_, i) => i * 12);
const SCALES = [
  { key: "architecture", sigma: 2, low: 0.12, high: 0.3 },
  { key: "geometry", sigma: 3.5, low: 0.03, high: 0.08 },
  { key: "structure", sigma: 2, low: 0.04, high: 0.1 },
];

const result = { label: LABEL, size: `${SW}x${SH}`, frames: FRAMES, scales: {} };
for (const sc of SCALES) {
  const maps = {};
  for (const [k, p] of [["src", SRC], ["cur", CUR], ["new", NEW]]) maps[k] = await edgeMaps(p, FRAMES, SW, SH, sc);
  const per = FRAMES.map((f) => ({ frame: f, cur: edgeF1(maps.src.get(f), maps.cur.get(f), SW, SH, 2), new: edgeF1(maps.src.get(f), maps.new.get(f), SW, SH, 2) }));
  const agg = (who, k) => ({ mean: mean(per.map((q) => q[who][k])), min: Math.min(...per.map((q) => q[who][k])) });
  const s = { perFrame: per };
  for (const who of ["cur", "new"]) for (const k of ["f1", "recall", "precision"]) s[`${who}_${k}`] = agg(who, k);
  result.scales[sc.key] = s;
  const line = (who) => ["f1", "recall", "precision"].map((k) => `${k} ${s[`${who}_${k}`].mean.toFixed(3)} (min ${s[`${who}_${k}`].min.toFixed(3)})`).join(", ");
  console.log(`${LABEL} ${sc.key} (σ ${sc.sigma}, ${sc.low}/${sc.high}): current ${line("cur")}`);
  console.log(`${" ".repeat(LABEL.length + sc.key.length + 2)}new     ${line("new")}`);
  console.log(`  per frame F1 (current/new): ${per.map((q) => `${q.frame}:${q.cur.f1.toFixed(2)}/${q.new.f1.toFixed(2)}`).join(" ")}`);
  if (sc.key === "architecture") {
    // overlays for the three frames where the new clip agrees least with the source
    const worst = [...per].sort((a, b) => a.new.f1 - b.new.f1).slice(0, 3).map((q) => q.frame);
    const bases = new Map();
    await grabFrames(NEW, worst, { w: SW, h: SH }, (f, p) => bases.set(f, yuvToRgb(p.y, p.u, p.v)), { flags: "area" });
    for (const f of worst) {
      const base = bases.get(f);
      const a = maps.src.get(f);
      const b = maps.new.get(f);
      const img = Buffer.alloc(SW * SH * 3);
      for (let i = 0; i < SW * SH; i++) {
        const g = (base[3 * i] + base[3 * i + 1] + base[3 * i + 2]) / 6; // dimmed grey
        const [r, gg, bb] = a[i] && b[i] ? [255, 255, 255] : a[i] ? [255, 40, 40] : b[i] ? [0, 220, 255] : [g, g, g];
        img[3 * i] = r;
        img[3 * i + 1] = gg;
        img[3 * i + 2] = bb;
      }
      await sharp(img, { raw: { width: SW, height: SH, channels: 3 } }).jpeg({ quality: 85 }).toFile(join(OUT, `${LABEL}-f${f}-architecture.jpg`));
    }
    result.overlays = worst;
  }
}
const a = result.scales.architecture;
const checks = ["recall", "precision"].flatMap((k) => [
  [`mean ${k}`, a[`new_${k}`].mean, a[`cur_${k}`].mean - 0.03],
  [`worst ${k}`, a[`new_${k}`].min, a[`cur_${k}`].min - 0.05],
]);
result.checks = checks.map(([name, got, need]) => ({ name, got, need, ok: got >= need }));
result.pass = result.checks.every((c) => c.ok);
writeFileSync(join(OUT, `${LABEL}-architecture.json`), JSON.stringify(result, null, 2));
console.log(`${LABEL}: architecture ${result.pass ? "PASS" : "FAIL"} — ${result.checks.map((c) => `${c.name} ${c.got.toFixed(3)} (need ≥ ${c.need.toFixed(3)})${c.ok ? "" : " ✗"}`).join(", ")}; overlays: frames ${result.overlays.join(", ")}`);
process.exit(result.pass ? 0 : 1);
