// Services v2 playback on the real page (SERVICES_BRIEF.md §4.4–4.5), adapted from scripts/hero-wrap-check.mjs.
// For each engine, at 1440×900:
//   1. wrap — each of the four sticky-panel clips in turn: scroll its block to the centre, let it play, then track the
//      frames the viewer sees for --seconds (default 14 s, three wraps of a 4.54 s loop) and report the frame interval
//      at every wrap (limit 84 ms, two 24 fps frames), the shown frame rate and content skips;
//   2. scroll — scroll the sticky section top → bottom → top at a steady pace for --scroll-seconds (default 40 s) and
//      report, for whichever clip is active, the shown frame rate and the worst frame interval (the first 0.5 s after a
//      clip becomes active is its start-up and is reported apart), plus decoded and dropped frames over every service
//      <video> (getVideoPlaybackQuality).
// Engines: chromium, webkit (Playwright), chrome (installed Google Chrome) and safari (real Safari through a temporary
// probe page in public/__probe/ that frames the real page and POSTs to 127.0.0.1:3999; the folder is deleted
// afterwards, whatever happens). Keep the Safari window in front: a hidden page stops rendering.
// node scripts/svc-wrap-check.mjs [--engines chromium,webkit,chrome,safari] [--seconds 14] [--scroll-seconds 40]
//   [--fresh-runs 3]  instead of step 1: for each clip, N times, reload the page, scroll the clip's block into view and
//   measure every wrap from the moment it starts playing, the first wrap after scroll-in included (each run is the clip's
//   first activation on a fresh page). --scroll-seconds 0 skips step 2.
//   [--only roofing,siding] [--headed true] [--url http://localhost:3000] [--json out.json]
// Needs the dev server and an idle machine. Exit code 1 when a wrap is above the limit or frames were dropped.
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium, webkit } from "playwright";
import { summarizeWrap } from "./hero-wrap-tracker.mjs";

const args = process.argv.slice(2);
const opt = { headed: "false", engines: "chromium,webkit,chrome,safari", seconds: 14, "scroll-seconds": 40, "fresh-runs": 0, only: "roofing,siding,windows,gutters", url: "http://localhost:3000", json: null };
for (let i = 0; i < args.length; i += 1) {
  const key = args[i].replace(/^--/, "");
  if (key in opt) opt[key] = args[(i += 1)];
}
const SECONDS = Number(opt.seconds);
const SCROLL_S = Number(opt["scroll-seconds"]);
const FRESH = Number(opt["fresh-runs"]);
const KEYS = ["roofing", "siding", "windows", "gutters"];
const ONLY = opt.only.split(",");

/**
 * In-page measurement (self-contained, serialised into the Safari probe). Tracks every `.svc-layer video`; a frame
 * counts as shown only while its layer is the active one (aria-hidden="false") and, in a double-buffered layer, only
 * while its element is the front one (data-front="true"); a front swap counts as a shown frame of the new front at the
 * swap's rendering time, as in scripts/hero-wrap-tracker.mjs. Exposes window.__svc.
 */
function installSvcTracker(root) {
  const doc = root || document;
  const win = doc.defaultView;
  const time = () => (win.document.timeline && win.document.timeline.currentTime != null ? win.document.timeline.currentTime : win.performance.now());
  const layers = () => Array.from(doc.querySelectorAll(".svc-layer"));
  const activeIndex = () => layers().findIndex((l) => l.getAttribute("aria-hidden") === "false");
  // A double-buffered layer (SmartVideo seamless) has two elements; only the front one is on screen.
  const front = (l) => {
    const all = Array.from(l.querySelectorAll("video"));
    return all.find((v) => v.dataset.front === "true") || all[0];
  };
  const T = { events: [], activations: [], errors: [], swaps: 0 };
  const last = new Map();
  let shown = null;
  let lastActive = -1;
  const show = (v, idx, mt, t, why) => {
    if (shown && shown.v === v && Math.abs(shown.mt - mt) < 1e-4) return;
    T.events.push([+t.toFixed(2), idx, +mt.toFixed(4), why]);
    shown = { v, idx, mt };
  };
  const hook = (v, idx) => {
    if (v.__svcHooked) return;
    v.__svcHooked = true;
    if (!v.requestVideoFrameCallback) {
      T.errors.push("requestVideoFrameCallback unsupported");
      return;
    }
    const cb = (t, meta) => {
      last.set(v, meta.mediaTime);
      const a = activeIndex();
      if (a !== lastActive) {
        T.activations.push([+t.toFixed(2), a]);
        lastActive = a;
      }
      if (a === idx && v === front(layers()[idx])) show(v, idx, meta.mediaTime, t, "f");
      v.requestVideoFrameCallback(cb);
    };
    v.requestVideoFrameCallback(cb);
  };
  const hookAll = () => layers().forEach((l, i) => l.querySelectorAll("video").forEach((v) => hook(v, i)));
  hookAll();
  new win.MutationObserver(() => {
    hookAll();
    const a = activeIndex();
    if (a < 0) return;
    const f = front(layers()[a]);
    // a swap: the new front's frame 0 (decoded while hidden) is on screen from this rendering frame
    if (f && shown && shown.idx === a && f !== shown.v) {
      T.swaps += 1;
      show(f, a, last.has(f) ? last.get(f) : f.currentTime, time(), "s");
    }
  }).observe(doc.querySelector("#services"), { subtree: true, childList: true, attributes: true, attributeFilter: ["data-front"] });
  T.quality = () =>
    layers().reduce(
      (acc, l) => {
        l.querySelectorAll("video").forEach((v) => {
          const q = v.getVideoPlaybackQuality && v.getVideoPlaybackQuality();
          if (q) {
            acc.total += q.totalVideoFrames;
            acc.dropped += q.droppedVideoFrames;
          }
        });
        return acc;
      },
      { total: 0, dropped: 0 },
    );
  T.q0 = T.quality();
  T.info = () =>
    layers().map((l) => {
      const v = front(l);
      return v ? { src: v.currentSrc.replace(win.location.origin, ""), size: `${v.videoWidth}x${v.videoHeight}`, paused: v.paused, elements: l.querySelectorAll("video").length } : null;
    });
  T.reset = () => {
    T.events = [];
    T.activations = [];
    T.swaps = 0;
    T.q0 = T.quality();
    shown = null;
  };
  win.__svc = T;
}

/** Steady scroll of the sticky section, top → bottom → top, in `seconds` (in-page; serialised for Safari). */
async function scrollSection(root, seconds) {
  const doc = root || document;
  const win = doc.defaultView;
  const sec = doc.querySelector("#services");
  const top = sec.getBoundingClientRect().top + win.scrollY;
  const blocks = Array.from(doc.querySelectorAll(".svc-block"));
  const last = blocks[blocks.length - 1];
  const bottom = last.getBoundingClientRect().bottom + win.scrollY - win.innerHeight;
  const half = (seconds * 1000) / 2;
  const t0 = win.performance.now();
  await new Promise((resolve) => {
    const step = () => {
      const e = win.performance.now() - t0;
      if (e >= 2 * half) return resolve();
      const p = e < half ? e / half : 2 - e / half;
      win.scrollTo(0, top + (bottom - top) * p);
      win.requestAnimationFrame(step);
    };
    win.requestAnimationFrame(step);
  });
}

function summarizeScroll(events, activations) {
  // per activation segment: frames of the active clip, start-up gap (first 0.5 s) and steady intervals
  const out = [];
  const bounds = activations.map(([t, a], i) => ({ a, from: t, to: activations[i + 1]?.[0] ?? Infinity }));
  for (const b of bounds) {
    if (b.a < 0) continue;
    const ev = events.filter((e) => e[1] === b.a && e[0] >= b.from && e[0] < b.to);
    if (ev.length < 3) {
      out.push({ clip: b.a, frames: ev.length, seconds: +((Math.min(b.to, ev.at(-1)?.[0] ?? b.from) - b.from) / 1000).toFixed(2) });
      continue;
    }
    const firstShown = ev[0][0] - b.from;
    const steady = ev.filter((e) => e[0] >= ev[0][0] + 500);
    const iv = [];
    for (let k = 1; k < steady.length; k += 1) if (steady[k][2] >= steady[k - 1][2] - 1) iv.push(steady[k][0] - steady[k - 1][0]);
    const secs = steady.length > 1 ? (steady.at(-1)[0] - steady[0][0]) / 1000 : 0;
    out.push({
      clip: b.a,
      frames: ev.length,
      firstFrameMs: +firstShown.toFixed(0),
      steadySeconds: +secs.toFixed(2),
      fps: secs ? +((steady.length - 1) / secs).toFixed(2) : null,
      maxGap: iv.length ? +Math.max(...iv).toFixed(1) : null,
    });
  }
  return out;
}

async function playwrightRun(type, launch) {
  const browser = await type.launch({ ...launch, headless: opt.headed !== "true" });
  try {
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    const wraps = {};
    const fresh = {};
    const load = async () => {
      await page.goto(opt.url, { waitUntil: "load" });
      await page.waitForSelector("#services", { timeout: 60_000 });
      await page.waitForTimeout(2000);
      await page.evaluate(() => (window.__loopDebug = []));
      await page.evaluate(installSvcTracker);
    };
    for (const key of FRESH ? KEYS.filter((k) => ONLY.includes(k)) : []) {
      const idx = KEYS.indexOf(key);
      fresh[key] = [];
      for (let run = 0; run < FRESH; run += 1) {
        await load();
        await page.evaluate((id) => document.getElementById(`svc-${id}`)?.scrollIntoView({ block: "center" }), key);
        await page.waitForFunction((i) => {
          const l = document.querySelectorAll(".svc-layer")[i];
          const v = l && ([...l.querySelectorAll("video")].find((x) => x.dataset.front === "true") || l.querySelector("video"));
          return v && !v.paused && v.currentTime > 0;
        }, idx, { timeout: 60_000 });
        await page.waitForTimeout(SECONDS * 1000);
        const raw = await page.evaluate(() => ({ events: window.__svc.events, q0: window.__svc.q0, q1: window.__svc.quality(), info: window.__svc.info(), debug: window.__loopDebug }));
        fresh[key].push({ ...raw, summary: summarizeWrap(raw.events.filter((e) => e[1] === idx)) });
      }
    }
    await load();
    for (const key of FRESH ? [] : KEYS.filter((k) => ONLY.includes(k))) {
      const idx = KEYS.indexOf(key);
      await page.evaluate((id) => document.getElementById(`svc-${id}`)?.scrollIntoView({ block: "center" }), key);
      await page.waitForFunction((i) => {
        const l = document.querySelectorAll(".svc-layer")[i];
        const v = l && ([...l.querySelectorAll("video")].find((x) => x.dataset.front === "true") || l.querySelector("video"));
        return v && !v.paused && v.currentTime > 0.3;
      }, idx, { timeout: 60_000 });
      await page.waitForTimeout(800);
      await page.evaluate(() => window.__svc.reset());
      await page.waitForTimeout(SECONDS * 1000);
      const raw = await page.evaluate(() => ({ events: window.__svc.events, q0: window.__svc.q0, q1: window.__svc.quality(), info: window.__svc.info() }));
      wraps[key] = { ...raw, summary: summarizeWrap(raw.events.filter((e) => e[1] === idx)) };
    }
    if (!SCROLL_S) return { wraps, fresh, scroll: null, errors };
    await page.evaluate(() => document.getElementById("services")?.scrollIntoView({ block: "start" }));
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.__svc.reset());
    await page.evaluate(`(${scrollSection})(document, ${SCROLL_S})`);
    const raw = await page.evaluate(() => ({ events: window.__svc.events, activations: window.__svc.activations, q0: window.__svc.q0, q1: window.__svc.quality() }));
    return { wraps, fresh, scroll: { ...raw, segments: summarizeScroll(raw.events, raw.activations) }, errors };
  } finally {
    await browser.close();
  }
}

function probeHtml() {
  return `<!doctype html><meta charset="utf-8"><title>services probe</title>
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}iframe{border:0;width:1440px;height:900px;display:block}</style>
<iframe id="f" src="/"></iframe>
<script>
const installSvcTracker = ${installSvcTracker};
const scrollSection = ${scrollSection};
const KEYS = ${JSON.stringify(KEYS)}, ONLY = ${JSON.stringify(ONLY)};
const p = new URLSearchParams(location.search);
const S = Number(p.get("s") || 14), SC = Number(p.get("sc") || 0), FR = Number(p.get("fr") || 0);
const post = (body) => fetch(p.get("beacon"), { method: "POST", body: JSON.stringify(body) }).finally(() => location.replace("about:blank"));
const vis = [];
document.addEventListener("visibilitychange", () => vis.push([performance.now(), document.visibilityState]));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const f = document.getElementById("f");
const loaded = (src) => new Promise((res) => { f.addEventListener("load", () => res(), { once: true }); if (src) f.src = src; });
const first = loaded(null);
const playing = async (d, idx) => {
  const t0 = performance.now();
  for (;;) {
    const l = d.querySelectorAll(".svc-layer")[idx];
    const v = l && ([...l.querySelectorAll("video")].find((x) => x.dataset.front === "true") || l.querySelector("video"));
    if (v && !v.paused && v.currentTime > 0) return true;
    if (performance.now() - t0 > 60000) return false;
    await wait(50);
  }
};
(async () => {
  await first;
  const fresh = {};
  for (const key of FR ? KEYS.filter((k) => ONLY.includes(k)) : []) {
    const idx = KEYS.indexOf(key);
    fresh[key] = [];
    for (let run = 0; run < FR; run += 1) {
      await loaded("/?fresh=" + key + "-" + run);
      const w = f.contentWindow, d = f.contentDocument;
      await wait(2500);
      w.__loopDebug = [];
      installSvcTracker(d);
      d.getElementById("svc-" + key).scrollIntoView({ block: "center" });
      if (!(await playing(d, idx))) {
        const l = d.querySelectorAll(".svc-layer")[idx];
        const v = l && l.querySelector("video");
        return post({ error: key + " never played (fresh run " + run + "): " + JSON.stringify({ vis: document.visibilityState, frameVis: d.visibilityState, scrollY: w.scrollY, active: [...d.querySelectorAll(".svc-layer")].map((x) => x.getAttribute("aria-hidden")), video: v && { paused: v.paused, t: v.currentTime, rs: v.readyState, src: v.currentSrc } }) });
      }
      await wait(S * 1000);
      fresh[key].push({ events: w.__svc.events, q0: w.__svc.q0, q1: w.__svc.quality(), info: w.__svc.info(), debug: w.__loopDebug });
    }
  }
  if (FR) await loaded("/?after-fresh");
  const w = f.contentWindow, d = f.contentDocument;
  await wait(2500);
  installSvcTracker(d);
  const wraps = {};
  for (const key of FR ? [] : KEYS.filter((k) => ONLY.includes(k))) {
    const idx = KEYS.indexOf(key);
    d.getElementById("svc-" + key).scrollIntoView({ block: "center" });
    const t0 = performance.now();
    for (;;) {
      const l = d.querySelectorAll(".svc-layer")[idx];
      const v = l && ([...l.querySelectorAll("video")].find((x) => x.dataset.front === "true") || l.querySelector("video"));
      if (v && !v.paused && v.currentTime > 0.3) break;
      if (performance.now() - t0 > 60000) return post({ error: key + " never played" });
      await wait(200);
    }
    await wait(800);
    w.__svc.reset();
    await wait(S * 1000);
    wraps[key] = { events: w.__svc.events, q0: w.__svc.q0, q1: w.__svc.quality(), info: w.__svc.info() };
  }
  let scroll = null;
  if (SC) {
    d.getElementById("services").scrollIntoView({ block: "start" });
    await wait(1500);
    w.__svc.reset();
    await scrollSection(d, SC);
    scroll = { events: w.__svc.events, activations: w.__svc.activations, q0: w.__svc.q0, q1: w.__svc.quality() };
  }
  post({ wraps, fresh, scroll, errors: w.__svc.errors, ua: navigator.userAgent, vis });
})();
</script>`;
}

async function safariRun() {
  const dir = path.join(process.cwd(), "public", "__probe");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "svc.html"), probeHtml());
  let server;
  try {
    const result = await new Promise((resolve, reject) => {
      server = http.createServer((req, res) => {
        let body = "";
        req.on("data", (d) => (body += d));
        req.on("end", () => {
          res.writeHead(204, { "access-control-allow-origin": "*" }).end();
          if (req.method === "POST") resolve(JSON.parse(body));
        });
      });
      server.listen(3999, "127.0.0.1", () => {
        spawn("open", ["-a", "Safari", `${opt.url}/__probe/svc.html?s=${SECONDS}&sc=${SCROLL_S}&fr=${FRESH}&beacon=http://127.0.0.1:3999/r`], { stdio: "ignore" });
      });
      setTimeout(() => reject(new Error("Safari probe timed out")), (SECONDS * 4 * Math.max(1, FRESH) + 15 * 4 * FRESH + SCROLL_S + 180) * 1000);
    });
    if (result.error) throw new Error(`Safari: ${result.error}`);
    for (const [key, r] of Object.entries(result.wraps)) r.summary = summarizeWrap(r.events.filter((e) => e[1] === KEYS.indexOf(key)));
    for (const [key, runs] of Object.entries(result.fresh ?? {})) for (const r of runs) r.summary = summarizeWrap(r.events.filter((e) => e[1] === KEYS.indexOf(key)));
    if (result.scroll) result.scroll.segments = summarizeScroll(result.scroll.events, result.scroll.activations);
    return result;
  } finally {
    server?.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const results = {};
let failed = false;
for (const name of opt.engines.split(",")) {
  let r;
  try {
    if (name === "safari") r = await safariRun();
    else if (name === "chrome") r = await playwrightRun(chromium, { channel: "chrome" });
    else r = await playwrightRun(name === "webkit" ? webkit : chromium, {});
  } catch (e) {
    console.log(`${name}: ERROR ${e.message}`);
    failed = true;
    continue;
  }
  results[name] = r;
  for (const [key, w] of Object.entries(r.wraps)) {
    const s = w.summary;
    const idx = KEYS.indexOf(key);
    const dropped = w.q1.dropped - w.q0.dropped;
    const pass = s.maxWrapGap !== null && s.maxWrapGap <= s.limit && dropped === 0;
    if (!pass) failed = true;
    console.log(
      `${name.padEnd(8)} ${key.padEnd(8)} ${w.info[idx]?.src} ${w.info[idx]?.size} · ${s.wraps?.length ?? 0} wraps · ${s.fps} fps shown · median ${s.median} ms · worst outside wraps ${s.maxOther} ms · skips ${s.skips} · dropped ${dropped} · wrap gaps ${s.wraps?.map((x) => x.gap).join(", ") || "none"} ms → max ${s.maxWrapGap} vs ${s.limit} → ${pass ? "PASS" : "FAIL"}`,
    );
  }
  for (const [key, runs] of Object.entries(r.fresh ?? {})) {
    runs.forEach((w, run) => {
      const s = w.summary;
      const dropped = w.q1.dropped - w.q0.dropped;
      const pass = s.maxWrapGap !== null && s.maxWrapGap <= s.limit && dropped === 0;
      if (!pass) failed = true;
      const swaps = (w.debug ?? []).filter((d) => d.ev === "swap").map((d) => (d.started ? "pre" : d.backReady ? "cold" : "restart") + (d.calibrated ? "" : "*")).join(",");
      console.log(
        `${name.padEnd(8)} ${key.padEnd(8)} fresh ${run + 1}/${runs.length} · ${s.wraps?.length ?? 0} wraps · ${s.fps} fps · first wrap ${s.wraps?.[0]?.gap ?? "–"} ms · all wraps ${s.wraps?.map((x) => x.gap).join(", ") || "none"} ms · skips ${s.skips} · dropped ${dropped}${swaps ? ` · swaps [${swaps}]` : ""} → ${pass ? "PASS" : "FAIL"}`,
      );
    });
  }
  const sc = r.scroll;
  if (!sc) continue;
  const dropped = sc.q1.dropped - sc.q0.dropped;
  const decoded = sc.q1.total - sc.q0.total;
  if (dropped) failed = true;
  console.log(
    `${name.padEnd(8)} scroll ${SCROLL_S} s: decoded ${decoded} dropped ${dropped}; segments ${sc.segments
      .map((g) => `${KEYS[g.clip] ?? g.clip}: ${g.fps ?? "–"} fps, max gap ${g.maxGap ?? "–"} ms, first frame ${g.firstFrameMs ?? "–"} ms, ${g.steadySeconds ?? g.seconds} s`)
      .join(" · ")}`,
  );
  if (r.errors?.length) {
    console.log(`         errors: ${r.errors.join(" | ")}`);
    failed = true;
  }
}
if (opt.json) fs.writeFileSync(opt.json, JSON.stringify(results, null, 1));
process.exit(failed ? 1 : 0);
