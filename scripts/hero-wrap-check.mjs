// Loop-wrap timing of the hero on the real page (docs/HERO_RESUME.md "Loop-wrap hold"): plays the hero for --seconds
// (default 150 s = 10 wraps of the 14.58 s loop) in each engine and reports, from the frames the viewer sees
// (scripts/hero-wrap-tracker.mjs), the frame interval at every wrap, the normal interval, the worst interval elsewhere,
// content skips, presented frame rate and dropped frames (getVideoPlaybackQuality over every hero <video>), plus the
// browser's average CPU and peak resident memory over the run (ps, summed over the browser's processes).
// Engines: chromium, webkit (Playwright), chrome (installed Google Chrome through Playwright) and safari (real Safari:
// cannot be automated here, so a temporary probe page in public/__probe/ frames the real page, measures it and POSTs
// the result to a listener on 127.0.0.1:3999; the probe folder is deleted afterwards, whatever happens).
// node scripts/hero-wrap-check.mjs [--engines chromium,webkit,chrome,safari] [--seconds 150] [--url http://localhost:3000] [--json out.json]
//   [--section "#proof"]  measures another section's looping video instead of the hero: the section is scrolled into
//   the middle of the viewport first (the proof morph only plays while visible). Default "#top" (the hero).
//   [--headed true]  runs the Playwright engines headed: headless Chromium and Chrome skip frames on heavy video.
// Needs the dev server and an idle machine (an encode makes every engine stutter). Exit code 1 when any wrap interval
// is longer than 2× the frame interval (83.3 ms at 24 fps).
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium, webkit } from "playwright";
import { installWrapTracker, summarizeWrap } from "./hero-wrap-tracker.mjs";

const args = process.argv.slice(2);
const opt = { engines: "chromium,webkit,chrome,safari", seconds: 150, url: "http://localhost:3000", json: null, section: "#top", headed: "false" };
for (let i = 0; i < args.length; i += 1) {
  const key = args[i].replace(/^--/, "");
  if (key in opt) opt[key] = args[(i += 1)];
}
opt.seconds = Number(opt.seconds);

function processes() {
  const out = execFileSync("ps", ["-A", "-o", "pid=,ppid=,time=,rss=,command="], { encoding: "utf8", maxBuffer: 64 << 20 });
  return out
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const m = line.trim().match(/^(\d+)\s+(\d+)\s+(\S+)\s+(\d+)\s+(.*)$/);
      if (!m) return null;
      const cpu = m[3].split(":").reduce((a, part) => a * 60 + Number(part), 0);
      return { pid: Number(m[1]), ppid: Number(m[2]), cpu, rss: Number(m[4]), cmd: m[5] };
    })
    .filter(Boolean);
}

/** Samples CPU time and memory of the processes `pick` selects, from start() to stop(). */
function meter(pick) {
  let first = null;
  let peak = 0;
  let timer = null;
  const snap = () => {
    const ps = pick(processes());
    peak = Math.max(peak, ps.reduce((a, p) => a + p.rss, 0));
    return ps;
  };
  return {
    start() {
      first = { wall: performance.now(), cpu: new Map(snap().map((p) => [p.pid, p.cpu])) };
      timer = setInterval(snap, 5000);
    },
    stop() {
      clearInterval(timer);
      const ps = snap();
      const wall = (performance.now() - first.wall) / 1000;
      const cpu = ps.reduce((a, p) => a + p.cpu - (first.cpu.get(p.pid) ?? 0), 0);
      return { cpuPct: +((100 * cpu) / wall).toFixed(0), peakRssMb: +(peak / 1024).toFixed(0), processes: ps.length };
    },
  };
}

function report(name, r) {
  const s = r.summary;
  const frames = r.q1.total - r.q0.total;
  const dropped = r.q1.dropped - r.q0.dropped;
  const pass = s.maxWrapGap !== null && s.maxWrapGap <= s.limit;
  const lines = [
    `${name.padEnd(8)} ${r.info.src} ${r.info.size} · ${r.info.videos} <video> · ${s.wraps.length} wraps in ${s.seconds} s · ` +
      `${s.excludedWraps ? `${s.excludedWraps} wrap(s) left out (page hidden) · ` : ""}${s.fps} fps shown · interval median ${s.median} ms p99 ${s.p99} ms · worst outside wraps ${s.maxOther} ms (media ${s.maxOtherAt} s) · ` +
      `content skips ${s.skips}${s.skips ? ` (after media ${s.skipAt.join(", ")} s)` : ""} · decoded ${frames} dropped ${dropped} · CPU ${r.cpu?.cpuPct ?? "n/a"}% peak RSS ${r.cpu?.peakRssMb ?? "n/a"} MB`,
    `         wrap gaps (ms): ${s.wraps.map((w) => w.gap).join(", ") || "none"} → max ${s.maxWrapGap} ms vs limit ${s.limit} ms → ${pass ? "PASS" : "FAIL"}`,
    `         at the wrap: ${s.wraps.map((w) => `[${w.intervals.join("/")}] ${w.from}→${w.to}${w.swap ? " swap" : ""}`).join(" · ")}`,
  ];
  console.log(lines.join("\n"));
  return pass;
}

async function playwrightRun(name, type, launch) {
  const before = new Set(processes().map((p) => p.pid));
  const browser = await type.launch({ ...launch, headless: opt.headed !== "true" });
  try {
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(opt.url, { waitUntil: "load" });
    if (opt.section !== "#top") {
      await page.waitForSelector(opt.section, { timeout: 30_000 });
      await page.evaluate((sel) => document.querySelector(sel).scrollIntoView({ block: "center" }), opt.section);
    }
    await page.waitForFunction((sel) => (document.querySelector(`${sel} video`)?.currentTime ?? 0) > 0.3, opt.section, { timeout: 60_000 });
    await page.waitForTimeout(1000);
    const m = meter((ps) => ps.filter((p) => !before.has(p.pid) && /ms-playwright|Google Chrome/.test(p.cmd)));
    await page.evaluate(installWrapTracker, opt.section);
    m.start();
    await page.waitForTimeout(opt.seconds * 1000);
    const raw = await page.evaluate(() => ({ events: window.__wrap.events, q0: window.__wrap.q0, q1: window.__wrap.quality(), info: window.__wrap.info(), errors: window.__wrap.errors }));
    const cpu = m.stop();
    return { ...raw, cpu, pageErrors: errors, summary: summarizeWrap(raw.events) };
  } finally {
    await browser.close();
  }
}

function probeHtml() {
  return `<!doctype html><meta charset="utf-8"><title>wrap probe</title>
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}iframe{border:0;width:100vw;height:100vh;display:block}</style>
<iframe id="f" src="/"></iframe>
<script>
const installWrapTracker = ${installWrapTracker};
const summarizeWrap = ${summarizeWrap};
const p = new URLSearchParams(location.search);
const S = Number(p.get("s") || 150);
const SEL = p.get("sel") || "#top";
const post = (body) => fetch(p.get("beacon"), { method: "POST", body: JSON.stringify(body) }).finally(() => location.replace("about:blank"));
const f = document.getElementById("f");
const t00 = performance.now(), vis = [], hidden = [];
let hiddenSince = document.visibilityState === "hidden" ? 0 : null;
const note = (what) => {
  vis.push([+((performance.now() - t00) / 1000).toFixed(1), what]);
  // hidden spans in the iframe document's time, which the frame events use
  const now = performance.now() + performance.timeOrigin - f.contentWindow.performance.timeOrigin;
  if (what === "hidden" && hiddenSince === null) hiddenSince = now;
  if (what === "visible" && hiddenSince !== null) { hidden.push([hiddenSince, now]); hiddenSince = null; }
};
document.addEventListener("visibilitychange", () => note(document.visibilityState));
addEventListener("blur", () => note("blur"));
addEventListener("focus", () => note("focus"));
f.addEventListener("load", async () => {
  const w = f.contentWindow, d = f.contentDocument;
  const t0 = performance.now();
  for (;;) {
    if (SEL !== "#top") d.querySelector(SEL)?.scrollIntoView({ block: "center" });
    const v = d.querySelector(SEL + " video");
    if (v && v.currentTime > 0.3) break;
    if (performance.now() - t0 > 60000) return post({ error: SEL + " never played" });
    await new Promise((r) => setTimeout(r, 200));
  }
  await new Promise((r) => setTimeout(r, 1000));
  installWrapTracker(d, SEL);
  fetch(p.get("beacon") + "/start", { method: "POST", body: "{}" });
  await new Promise((r) => setTimeout(r, S * 1000));
  const T = w.__wrap;
  if (hiddenSince !== null) hidden.push([hiddenSince, 1e12]);
  post({ hidden, events: T.events, q0: T.q0, q1: T.quality(), info: T.info(), errors: T.errors, ua: navigator.userAgent, vis });
}, { once: true });
</script>`;
}

async function safariRun() {
  const dir = path.join(process.cwd(), "public", "__probe");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "wrap.html"), probeHtml());
  const m = meter((ps) => ps.filter((p) => /\/Applications\/Safari\.app|\/System\/.*com\.apple\.WebKit\.(WebContent|GPU|Networking)/.test(p.cmd)));
  let server;
  try {
    const result = await new Promise((resolve, reject) => {
      server = http.createServer((req, res) => {
        let body = "";
        req.on("data", (d) => (body += d));
        req.on("end", () => {
          res.writeHead(204, { "access-control-allow-origin": "*" }).end();
          if (req.method !== "POST") return;
          if (req.url.endsWith("/start")) m.start();
          else resolve(JSON.parse(body));
        });
      });
      server.listen(3999, "127.0.0.1", () => {
        const url = `${opt.url}/__probe/wrap.html?s=${opt.seconds}&sel=${encodeURIComponent(opt.section)}&beacon=http://127.0.0.1:3999/r`;
        spawn("open", ["-a", "Safari", url], { stdio: "ignore" });
      });
      setTimeout(() => reject(new Error("Safari probe timed out")), (opt.seconds + 120) * 1000);
    });
    if (result.error) throw new Error(`Safari: ${result.error}`);
    return { ...result, cpu: m.stop(), summary: summarizeWrap(result.events, 24, result.hidden) };
  } finally {
    server?.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const results = {};
let failed = false;
for (const name of opt.engines.split(",")) {
  let r;
  if (name === "safari") r = await safariRun();
  else if (name === "chrome") r = await playwrightRun(name, chromium, { channel: "chrome" });
  else r = await playwrightRun(name, name === "webkit" ? webkit : chromium, {});
  results[name] = r;
  if (!report(name, r)) failed = true;
  if (r.vis?.length) console.log(`         page visibility (s since probe load): ${r.vis.map(([t, w]) => `${t} ${w}`).join(", ")}`);
  if (r.errors?.length || r.pageErrors?.length) {
    console.log(`         errors: ${[...(r.errors ?? []), ...(r.pageErrors ?? [])].join(" | ")}`);
    failed = true;
  }
}
if (opt.json) fs.writeFileSync(opt.json, JSON.stringify(results, null, 1));
process.exit(failed ? 1 : 0);
