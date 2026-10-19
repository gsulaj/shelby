// First-play smoothness of the hero video (sharpness pass, docs/HERO_RESUME.md): a cold page load in Chromium and WebKit
// (plus installed Google Chrome when present), then 20 s of playback. Reports the source the browser picked, time from
// navigation to the first played frame, stalls ('waiting' events after playback started, apart from the loop wrap),
// dropped frames (getVideoPlaybackQuality), hitches (gaps between presented frames longer than 100 ms, measured with
// requestVideoFrameCallback on the frames the viewer sees, scripts/hero-wrap-tracker.mjs: the hero double-buffers
// its loop over two <video> elements) and how closely the shown media time kept pace with wall time. Run it on an idle machine: a busy
// CPU (an ffmpeg encode) makes every engine stutter.
// node scripts/hero-playback-check.mjs [--url http://localhost:3000] [--seconds 20]
// Needs the dev server. Exit code 1 when an engine stalls after the first frame (outside the loop wrap), hitches, drops
// more than 2% of frames, or plays slower than 0.95× real time.
import fs from "node:fs";
import { chromium, webkit } from "playwright";
import { installWrapTracker, summarizeWrap } from "./hero-wrap-tracker.mjs";

const args = process.argv.slice(2);
const opt = { url: "http://localhost:3000", seconds: 20 };
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === "--url") opt.url = args[(i += 1)];
  else if (args[i] === "--seconds") opt.seconds = Number(args[(i += 1)]);
}

const engines = [
  { name: "chromium", type: chromium, launch: {} },
  { name: "webkit", type: webkit, launch: {} },
];
if (fs.existsSync("/Applications/Google Chrome.app")) engines.push({ name: "chrome", type: chromium, launch: { channel: "chrome" } });

let failed = false;
for (const e of engines) {
  const browser = await e.type.launch(e.launch);
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    // record from the very first moment the hero video exists
    window.__hero = { t0: performance.now(), firstFrame: null, waiting: 0, waitingAfterStart: 0, events: [] };
    const hook = () => document.querySelectorAll("#top video").forEach((v) => {
      if (v.__hooked) return;
      v.__hooked = true;
      const h = window.__hero;
      v.addEventListener("waiting", () => {
        h.waiting += 1;
        const atWrap = v.currentTime < 0.3 || v.currentTime > v.duration - 0.3;
        if (atWrap) h.waitingAtWrap = (h.waitingAtWrap ?? 0) + 1;
        else if (h.firstFrame !== null) h.waitingAfterStart += 1;
        h.events.push(["waiting", performance.now() - h.t0, v.currentTime]);
      });
      v.addEventListener("playing", () => h.events.push(["playing", performance.now() - h.t0, v.currentTime]));
      const onFrame = () => {
        if (h.firstFrame === null && v.currentTime > 0) h.firstFrame = performance.now() - h.t0;
        if (h.firstFrame === null) requestAnimationFrame(onFrame);
      };
      requestAnimationFrame(onFrame);
    });
    new MutationObserver(hook).observe(document, { childList: true, subtree: true });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));
  await page.goto(opt.url, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__hero?.firstFrame !== null, null, { timeout: 60_000 });
  const start = await page.evaluate(() => ({ wall: performance.now() }));
  // record every frame the viewer sees (front element only) while we wait
  await page.evaluate(installWrapTracker);
  await page.waitForTimeout(opt.seconds * 1000);
  const end = await page.evaluate(() => {
    const T = window.__wrap;
    const info = T.info();
    return { wall: performance.now(), events: T.events, q0: T.q0, q1: T.quality(), src: info.src, size: info.size, hero: window.__hero };
  });
  const gaps = end.events.slice(1).map((e, k) => e[0] - end.events[k][0]).sort((a, b) => a - b);
  end.hitchAt = end.events.slice(1).flatMap((e, k) => (e[0] - end.events[k][0] > 100 ? [[Math.round(e[0] - end.events[k][0]), e[2]]] : []));
  end.played = end.events.slice(1).reduce((a, e, k) => a + (e[2] >= end.events[k][2] ? e[2] - end.events[k][2] : 1 / 24), 0);
  const wraps = summarizeWrap(end.events, 24).wraps.length;
  const hitches = gaps.filter((g) => g > 100).length;
  const p99 = gaps.length ? gaps[Math.floor(gaps.length * 0.99)] : null;
  const maxGap = gaps.length ? gaps[gaps.length - 1] : null;
  const pace = end.played / ((end.wall - start.wall) / 1000);
  const frames = end.q1.total - end.q0.total;
  const dropped = end.q1.dropped - end.q0.dropped;
  const dropRate = frames ? dropped / frames : 0;
  const ok = end.hero.waitingAfterStart === 0 && hitches === 0 && dropRate <= 0.02 && pace >= 0.95 && !errors.length;
  if (!ok) failed = true;
  console.log(
    `${e.name.padEnd(8)} ${end.src} ${end.size} · ${wraps} wrap(s) · first frame ${(end.hero.firstFrame / 1000).toFixed(2)} s after navigation · ` +
      `stalls ${end.hero.waitingAfterStart} (+${end.hero.waitingAtWrap ?? 0} at the loop wrap) · ` +
      `frame gaps p99 ${p99 === null ? "n/a" : p99.toFixed(0)} ms max ${maxGap === null ? "n/a" : maxGap.toFixed(0)} ms, hitches >100 ms ${hitches}${end.hitchAt.length ? ` (${end.hitchAt.map(([g, t]) => `${g} ms at media ${t} s`).join(", ")})` : ""} · ` +
      `frames ${frames ?? "n/a"} dropped ${dropped ?? "n/a"} (${(100 * dropRate).toFixed(2)}%) · pace ${pace.toFixed(3)}× over ${opt.seconds} s` +
      `${errors.length ? ` · errors: ${errors.join(" | ")}` : ""} → ${ok ? "smooth" : "NOT SMOOTH"}`,
  );
  await browser.close();
}
process.exit(failed ? 1 : 0);
