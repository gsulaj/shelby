// Hero text contrast against the video + overlays (HERO_BRIEF.md step 5): seeks the hero video through the loop,
// screenshots the hero with the text hidden, and measures the background luminance inside each text box, so the
// WCAG contrast of the real composite (video frame + gradients) is known at its brightest moment.
// node scripts/hero-contrast.mjs [--url http://localhost:3000] [--out dir] [--step 0.5] [--only desktop|mobile]
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const opt = { url: "http://localhost:3000", out: ".superpowers/sdd/HERO_BRIEF/contrast", step: 0.5, only: null };
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === "--url") opt.url = args[(i += 1)];
  else if (args[i] === "--out") opt.out = args[(i += 1)];
  else if (args[i] === "--step") opt.step = Number(args[(i += 1)]);
  else if (args[i] === "--only") opt.only = args[(i += 1)];
}
fs.mkdirSync(opt.out, { recursive: true });

const lin = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
].filter((v) => !opt.only || v.name === opt.only);
const ELEMENTS = [
  { key: "eyebrow", sel: "#top .js-eyebrow span:last-child", min: 4.5 },
  { key: "h1", sel: "#top h1", min: 3 },
  { key: "sub", sel: "#top .js-sub", min: 4.5 },
  { key: "phone", sel: "#top .js-ctas a", min: 4.5 },
];

const browser = await chromium.launch();
let failures = 0;
for (const vp of viewports) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto(opt.url, { waitUntil: "load" });
  await page.waitForSelector("#top video", { timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(3000); // the intro reveal has finished
  const info = await page.evaluate((els) => {
    const v = document.querySelector("#top video");
    v.pause();
    v.play = () => Promise.resolve(); // keep the SmartVideo watchdog from restarting it while we seek
    const out = { duration: v.duration, els: {} };
    const cv = document.createElement("canvas");
    cv.width = cv.height = 1;
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    const rgba = (css) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
    };
    for (const e of els) {
      const n = document.querySelector(e.sel);
      if (!n) continue;
      const r = n.getBoundingClientRect();
      const color = getComputedStyle(n).color;
      out.els[e.key] = { x: r.left, y: r.top, w: r.width, h: r.height, color, rgba: rgba(color), min: e.min };
    }
    return out;
  }, ELEMENTS);
  const seek = (t) =>
    page.evaluate(
      (tt) =>
        new Promise((res) => {
          const v = document.querySelector("#top video");
          v.addEventListener("seeked", () => requestAnimationFrame(() => requestAnimationFrame(res)), { once: true });
          v.currentTime = tt;
        }),
      t,
    );
  // GSAP leaves inline visibility: visible on the revealed text, so every descendant is hidden with !important
  const hide = await page.addStyleTag({ content: "#top .wrap, #top .wrap * { visibility: hidden !important; }" });
  const times = [];
  for (let t = 0; t < info.duration - 0.05; t += opt.step) times.push(Number(t.toFixed(2)));
  const results = [];
  for (const t of times) {
    await seek(t);
    const img = sharp(await page.screenshot({ type: "png" }));
    const row = { t };
    for (const [key, e] of Object.entries(info.els)) {
      const x = Math.max(0, Math.round(e.x)), y = Math.max(0, Math.round(e.y));
      const w = Math.min(vp.width - x, Math.round(e.w)), h = Math.min(vp.height - y, Math.round(e.h));
      if (w <= 0 || h <= 0) continue;
      const { data, info: m } = await img.clone().extract({ left: x, top: y, width: w, height: h }).raw().toBuffer({ resolveWithObject: true });
      const ls = new Float64Array(w * h);
      for (let i = 0, j = 0; i < data.length; i += m.channels, j += 1) ls[j] = lum(data[i], data[i + 1], data[i + 2]);
      ls.sort();
      const mean = ls.reduce((s, v) => s + v, 0) / ls.length;
      const p90 = ls[Math.floor(ls.length * 0.9)];
      const c = e.rgba;
      const textL = lum(c.r, c.g, c.b);
      const eff = (bg) => (c.a < 1 ? c.a * textL + (1 - c.a) * bg : textL); // translucent text composites over the background first
      row[key] = { mean: contrast(eff(mean), mean), p90: contrast(eff(p90), p90), bgMean: mean, bgP90: p90 };
    }
    results.push(row);
  }
  console.log(`\n${vp.name} ${vp.width}x${vp.height}: video ${info.duration.toFixed(2)} s, ${times.length} samples every ${opt.step} s (contrast vs mean background / vs the 90th-percentile brightest pixels)`);
  let worstH1 = null;
  for (const [key, e] of Object.entries(info.els)) {
    const rows = results.filter((r) => r[key]);
    const wMean = rows.reduce((a, r) => (!a || r[key].mean < a[key].mean ? r : a), null);
    const wP90 = rows.reduce((a, r) => (!a || r[key].p90 < a[key].p90 ? r : a), null);
    const okMean = wMean[key].mean >= e.min, okP90 = wP90[key].p90 >= e.min;
    if (!okMean) failures += 1;
    console.log(`  ${okMean ? "ok  " : "FAIL"} ${key.padEnd(7)} ${e.color.padEnd(26)} box ${Math.round(e.x)},${Math.round(e.y)} ${Math.round(e.w)}x${Math.round(e.h)} · min ${e.min}:1 · worst mean ${wMean[key].mean.toFixed(2)}:1 at ${wMean.t}s · worst p90 ${wP90[key].p90.toFixed(2)}:1 at ${wP90.t}s${okP90 ? "" : " (p90 below min)"}`);
    if (key === "h1") worstH1 = wP90;
  }
  console.log("  h1 contrast by time (mean/p90): " + results.map((r) => `${r.t}s ${r.h1.mean.toFixed(1)}/${r.h1.p90.toFixed(1)}`).join(" · "));
  fs.writeFileSync(path.join(opt.out, `${vp.name}-contrast.json`), JSON.stringify({ info, results }, null, 1));
  await hide.evaluate((el) => el.remove());
  await seek(worstH1.t);
  await page.screenshot({ path: path.join(opt.out, `${vp.name}-worst-h1-${worstH1.t}s.png`) });
  await context.close();
}
await browser.close();
console.log(failures ? `\n${failures} element(s) below the minimum contrast` : "\nall hero text meets the minimum contrast");
process.exit(failures ? 1 : 0);
