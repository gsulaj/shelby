// Proof section v2 checks on the real page (PROOF_BRIEF.md step 7): the BEFORE/AFTER label follows the morph's clock
// through three loops, screenshots at 1440 and 390 during each half, reduced motion, console clean.
// node scripts/proof-verify.mjs [--out docs/screenshots/proof-v2] [--engines chromium,webkit] [--loops 3] [--url http://localhost:3000]
//   [--slider true]   only screenshot the before/after slider (run with proofMode set to "slider" in src/content/media.ts)
// Needs the dev server. Exit code 1 on a failed check.
//
// The label check samples every 50 ms: the front video's currentTime and the label's data-phase, plus the opacity of
// the visible label text. Pass: the phase equals "after" exactly when currentTime ≥ proofMorphSwitchAt (read from
// src/content/media.ts), allowing one sample of lag at the switch and at the wrap; two phase changes per loop.
import fs from "node:fs";
import path from "node:path";
import { chromium, webkit } from "playwright";

const args = process.argv.slice(2);
const opt = { out: "docs/screenshots/proof-v2", engines: "chromium,webkit", loops: 3, url: "http://localhost:3000", slider: "false" };
for (let i = 0; i < args.length; i += 1) {
  const key = args[i].replace(/^--/, "");
  if (key in opt) opt[key] = args[(i += 1)];
}
const SWITCH = Number(fs.readFileSync("src/content/media.ts", "utf8").match(/proofMorphSwitchAt = ([\d.]+)/)[1]);
fs.mkdirSync(opt.out, { recursive: true });
let failed = false;
const ok = (m) => console.log(`  ok   ${m}`);
const bad = (m) => {
  failed = true;
  console.log(`  FAIL ${m}`);
};

async function open(type, viewport, { reducedMotion = "no-preference" } = {}) {
  const browser = await type.launch();
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion });
  const page = await context.newPage();
  const messages = [];
  page.on("console", (m) => {
    if (["error", "warning"].includes(m.type())) messages.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => messages.push(`pageerror: ${e.message}`));
  await page.goto(opt.url, { waitUntil: "load" });
  await page.waitForSelector("#proof", { timeout: 30_000 });
  return { browser, page, messages };
}

const front = () => {
  const root = document.querySelector("#proof");
  return root.querySelector('video[data-front="true"]') ?? root.querySelector("video");
};

/** Scroll the morph into the middle of the viewport and wait until it plays. */
async function toMorph(page) {
  await page.evaluate(() => document.querySelector("#proof video, #proof img")?.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(1500); // the clip-path reveal is scrubbed by scroll; let Lenis settle
  await page.evaluate(() => document.querySelector("#proof video, #proof img")?.scrollIntoView({ block: "center" }));
  await page.waitForFunction(`(${front})()?.currentTime > 0.2`, null, { timeout: 60_000 });
}

async function shotAt(page, from, to, file) {
  await page.waitForFunction(`(() => { const t = (${front})()?.currentTime ?? -1; return t >= ${from} && t <= ${to}; })()`, null, { timeout: 30_000, polling: 20 });
  await page.waitForTimeout(350); // the label's 0.3 s cross-fade
  const state = await page.evaluate(`(() => ({ t: (${front})().currentTime, phase: document.querySelector(".proof-phase")?.dataset.phase }))()`);
  await page.screenshot({ path: file, type: "jpeg", quality: 88 });
  return state;
}

for (const name of opt.engines.split(",")) {
  const type = name === "webkit" ? webkit : chromium;
  console.log(`\n${name}`);
  if (opt.slider === "true") {
    for (const [label, viewport] of [["desktop", { width: 1440, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
      const { browser, page, messages } = await open(type, viewport);
      await page.evaluate(() => document.querySelector("#proof [role=slider]")?.scrollIntoView({ block: "center" }));
      await page.waitForTimeout(1500);
      await page.evaluate(() => document.querySelector("#proof [role=slider]")?.scrollIntoView({ block: "center" }));
      await page.waitForTimeout(800);
      const imgs = await page.evaluate(() => [...document.querySelectorAll("#proof img")].map((i) => ({ src: i.currentSrc.replace(location.origin, ""), w: i.naturalWidth, h: i.naturalHeight })));
      (imgs.length === 2 && imgs.every((i) => i.w >= 3840) ? ok : bad)(`${label} slider images ${JSON.stringify(imgs)}`);
      await page.focus("#proof [role=slider]");
      await page.keyboard.press("End");
      await page.keyboard.press("ArrowLeft");
      const now = await page.getAttribute("#proof [role=slider]", "aria-valuenow");
      (now === "98" ? ok : bad)(`${label} slider keyboard: End then ArrowLeft → ${now}`);
      await page.keyboard.press("Home");
      for (let i = 0; i < 15; i++) await page.keyboard.press("ArrowRight");
      await page.screenshot({ path: path.join(opt.out, `${label}-slider-${name}.jpg`), type: "jpeg", quality: 88 });
      (messages.length === 0 ? ok : bad)(`${label} console: ${messages.length ? messages.join(" | ") : "clean"}`);
      await browser.close();
    }
    continue;
  }

  // 1440: label through the loops, screenshots
  {
    const { browser, page, messages } = await open(type, { width: 1440, height: 900 });
    await toMorph(page);
    const info = await page.evaluate(`(() => { const v = (${front})(); return { src: v.currentSrc.replace(location.origin, ""), size: v.videoWidth + "x" + v.videoHeight, duration: v.duration, videos: document.querySelectorAll("#proof video").length }; })()`);
    console.log(`  morph ${info.src} ${info.size}, ${info.duration.toFixed(2)} s, ${info.videos} <video>; switch at ${SWITCH} s`);
    await page.evaluate(`(() => {
      const S = (window.__proof = { samples: [] });
      const tick = () => {
        const v = (${front})();
        const lab = document.querySelector(".proof-phase");
        const vis = lab ? [...lab.children].find((c) => getComputedStyle(c).opacity === "1") : null;
        S.samples.push([performance.now(), v ? v.currentTime : -1, lab ? lab.dataset.phase : null, vis ? vis.textContent : null]);
      };
      S.timer = setInterval(tick, 50);
    })()`);
    const seconds = Number(opt.loops) * info.duration + 1.5;
    await page.waitForTimeout(seconds * 1000);
    const samples = await page.evaluate(() => {
      clearInterval(window.__proof.timer);
      return window.__proof.samples;
    });
    let wraps = 0;
    let changes = 0;
    const mismatches = [];
    for (let i = 1; i < samples.length; i++) {
      const [, t, phase] = samples[i];
      const [, tp, pp] = samples[i - 1];
      if (t < tp - 1) wraps++;
      if (phase !== pp) changes++;
      const expected = t >= SWITCH ? "after" : "before";
      const lag = Math.abs(t - SWITCH) < 0.12 || t < 0.12 || (t < tp - 1);
      if (phase !== expected && !lag) mismatches.push(`t=${t.toFixed(3)} phase=${phase}`);
    }
    const fades = samples.filter((s) => s[3] === null).length;
    (wraps >= Number(opt.loops) ? ok : bad)(`${wraps} loops played in ${seconds.toFixed(0)} s (${samples.length} samples)`);
    (mismatches.length === 0 ? ok : bad)(`label matches the clock in every sample${mismatches.length ? `: ${mismatches.slice(0, 5).join(", ")}` : ""}`);
    (changes >= 2 * Number(opt.loops) && changes <= 2 * Number(opt.loops) + 2 ? ok : bad)(`${changes} label changes (2 per loop)`);
    console.log(`  samples mid-cross-fade (no label text fully opaque): ${fades}`);
    const b = await shotAt(page, 1.6, 2.4, path.join(opt.out, `desktop-before-${name}.jpg`));
    (b.phase === "before" ? ok : bad)(`desktop BEFORE shot at ${b.t.toFixed(2)} s, label "${b.phase}"`);
    const a = await shotAt(page, SWITCH + 1.8, SWITCH + 2.6, path.join(opt.out, `desktop-after-${name}.jpg`));
    (a.phase === "after" ? ok : bad)(`desktop AFTER shot at ${a.t.toFixed(2)} s, label "${a.phase}"`);
    await shotAt(page, SWITCH - 0.05, SWITCH + 0.05, path.join(opt.out, `desktop-seam-${name}.jpg`));
    (messages.length === 0 ? ok : bad)(`desktop console: ${messages.length ? messages.join(" | ") : "clean"}`);
    await browser.close();
  }
  // 390
  {
    const { browser, page, messages } = await open(type, { width: 390, height: 844 });
    await toMorph(page);
    const b = await shotAt(page, 1.6, 2.4, path.join(opt.out, `mobile-before-${name}.jpg`));
    (b.phase === "before" ? ok : bad)(`mobile BEFORE shot at ${b.t.toFixed(2)} s, label "${b.phase}"`);
    const a = await shotAt(page, SWITCH + 1.8, SWITCH + 2.6, path.join(opt.out, `mobile-after-${name}.jpg`));
    (a.phase === "after" ? ok : bad)(`mobile AFTER shot at ${a.t.toFixed(2)} s, label "${a.phase}"`);
    (messages.length === 0 ? ok : bad)(`mobile console: ${messages.length ? messages.join(" | ") : "clean"}`);
    await browser.close();
  }
  // reduced motion: poster only, label "before"
  {
    const { browser, page, messages } = await open(type, { width: 1440, height: 900 }, { reducedMotion: "reduce" });
    await page.evaluate(() => document.querySelector("#proof img")?.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(800);
    const r = await page.evaluate(() => ({
      videos: document.querySelectorAll("#proof video").length,
      img: document.querySelector("#proof img")?.getAttribute("src"),
      phase: document.querySelector(".proof-phase")?.dataset.phase,
    }));
    (r.videos === 0 && /proof-morph-poster/.test(r.img ?? "") && r.phase === "before" ? ok : bad)(`reduced motion: ${JSON.stringify(r)}`);
    await page.screenshot({ path: path.join(opt.out, `desktop-reduced-${name}.jpg`), type: "jpeg", quality: 88 });
    (messages.length === 0 ? ok : bad)(`reduced-motion console: ${messages.length ? messages.join(" | ") : "clean"}`);
    await browser.close();
  }
}
console.log(failed ? "\nFAILED" : "\nALL CHECKS PASSED");
process.exit(failed ? 1 : 0);
