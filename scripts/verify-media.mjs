// Section 5 verification for the media integration (MEDIA_BRIEF.md): console, media 404s,
// hydration warnings, lazy loading, sticky services forward and back, proof reveal, reduced motion.
// node scripts/verify-media.mjs [--url http://localhost:3000] [--out docs/screenshots/media]
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const opt = { url: "http://localhost:3000", out: "docs/screenshots/media" };
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === "--url") opt.url = args[(i += 1)];
  else if (args[i] === "--out") opt.out = args[(i += 1)];
}
fs.mkdirSync(opt.out, { recursive: true });

const SERVICES = ["roofing", "siding", "windows", "gutters"];
const failures = [];
const notes = [];
const fail = (msg) => {
  failures.push(msg);
  console.log(`FAIL ${msg}`);
};
const ok = (msg) => console.log(`ok   ${msg}`);
const pad = (n) => String(n).padStart(2, "0");
const isSource = (u) => /\.(mp4|webm)(\?|$)/.test(u);

const browser = await chromium.launch();

async function session(name, { width, height, reducedMotion = "no-preference" }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, reducedMotion });
  const page = await context.newPage();
  const logs = [];
  const failedResponses = [];
  const mediaRequests = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") logs.push(`[${m.type()}] ${m.text()}`);
  });
  page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
  page.on("response", (r) => {
    if (r.status() >= 400) failedResponses.push(`${r.status()} ${r.url().replace(opt.url, "")}`);
  });
  page.on("request", (r) => {
    const u = r.url();
    if (u.includes("/media/")) mediaRequests.push(u.replace(opt.url, ""));
  });
  const shot = async (label, extra = {}) => {
    const file = path.join(opt.out, `${name}-${label}.png`);
    await page.screenshot({ path: file, ...extra });
    return file;
  };
  const open = async () => {
    await page.goto(opt.url, { waitUntil: "load" });
    await page.waitForSelector("#top", { timeout: 30_000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(3000);
  };
  return { name, context, page, logs, failedResponses, mediaRequests, shot, open };
}

function report(s) {
  const hydration = s.logs.filter((l) => /hydrat|did not match|does not match/i.test(l));
  const errors = s.logs.filter((l) => l.startsWith("[error]") || l.startsWith("[pageerror]"));
  const warnings = s.logs.filter((l) => l.startsWith("[warning]"));
  if (hydration.length) fail(`${s.name}: hydration warnings: ${hydration.join(" | ")}`);
  if (errors.length) fail(`${s.name}: console errors: ${errors.join(" | ")}`);
  if (!hydration.length && !errors.length) ok(`${s.name}: console clean, ${warnings.length} warning(s)`);
  if (warnings.length) notes.push(`${s.name} warnings: ${warnings.join(" | ")}`);
  const media404 = s.failedResponses.filter((l) => l.includes("/media/"));
  if (media404.length) fail(`${s.name}: failed media responses: ${media404.join(" | ")}`);
  else ok(`${s.name}: no failed media responses`);
  const other = s.failedResponses.filter((l) => !l.includes("/media/"));
  if (other.length) notes.push(`${s.name} other failed responses: ${other.join(" | ")}`);
}

// ---------------------------------------------------------------- desktop 1440x900
{
  const s = await session("desktop", { width: 1440, height: 900 });
  const { page } = s;
  await s.open();

  const sources = s.mediaRequests.filter(isSource);
  const heroSources = sources.filter((u) => /\/media\/hero\./.test(u));
  const otherSources = sources.filter((u) => !/\/media\/hero\./.test(u));
  (heroSources.length ? ok : fail)(`desktop: hero video requested at load: ${heroSources.join(", ") || "none"}`);
  (otherSources.length ? fail : ok)(`desktop: other video sources at initial load: ${otherSources.join(", ") || "none"}`);
  notes.push(`desktop media requests at load: ${[...new Set(s.mediaRequests)].join(", ")}`);

  const hero = await page.evaluate(() => {
    const v = document.querySelector("#top video");
    return v ? { paused: v.paused, w: v.videoWidth, h: v.videoHeight, src: v.currentSrc.replace(location.origin, "") } : null;
  });
  (hero && !hero.paused && hero.w > 0 ? ok : fail)(`desktop: hero video state ${JSON.stringify(hero)}`);
  await s.shot("hero-load");

  const activeState = () =>
    page.evaluate(() => {
      const layers = [...document.querySelectorAll(".svc-layer")];
      return {
        active: layers.map((l, i) => (getComputedStyle(l).opacity === "1" ? i : -1)).filter((i) => i >= 0),
        playing: layers.map((l) => {
          const all = [...l.querySelectorAll("video")];
          const v = all.find((x) => x.dataset.front === "true") || all[0]; // front element of a double-buffered layer
          return v ? !v.paused : null;
        }),
        index: document.querySelector('[aria-live="polite"]')?.textContent?.replace(/\s+/g, " ").trim(),
      };
    });
  const checkPosition = async (idx, dir) => {
    await page.evaluate((id) => document.getElementById(`svc-${id}`)?.scrollIntoView({ block: "center" }), SERVICES[idx]);
    await page.waitForTimeout(1600);
    const st = await activeState();
    const good =
      st.active.length === 1 &&
      st.active[0] === idx &&
      st.playing.every((p, i) => (i === idx ? p === true : p === false)) &&
      st.index === `${pad(idx + 1)} / 04`;
    (good ? ok : fail)(`desktop services ${dir} ${SERVICES[idx]}: active=${JSON.stringify(st.active)} playing=${JSON.stringify(st.playing)} index="${st.index}"`);
    await s.shot(`services-${dir}-${pad(idx + 1)}-${SERVICES[idx]}`);
  };
  for (let i = 0; i < 4; i += 1) await checkPosition(i, "down");
  for (let i = 2; i >= 0; i -= 1) await checkPosition(i, "up");

  const frameTopTo = (fraction) =>
    page.evaluate((f) => {
      // the element the reveal animates: the nearest ancestor of the media with an inline clip-path (a double-buffered
      // SmartVideo wraps its two <video> elements in a host div, so it is not always the direct parent)
      const el = (() => { let el = document.querySelector("#proof video, #proof img"); while (el && el.id !== "proof" && !el.style.clipPath) el = el.parentElement; return el && el.id !== "proof" ? el : null; })();
      if (!el) return null;
      window.scrollBy(0, el.getBoundingClientRect().top - window.innerHeight * f);
      return true;
    }, fraction);
  const clipPath = () => page.evaluate(() => (() => { let el = document.querySelector("#proof video, #proof img"); while (el && el.id !== "proof" && !el.style.clipPath) el = el.parentElement; return el && el.id !== "proof" ? el : null; })()?.style.clipPath ?? "");
  await page.evaluate(() => document.querySelector("#proof")?.scrollIntoView({ block: "start" }));
  await page.waitForTimeout(600);
  await frameTopTo(0.62);
  await page.waitForTimeout(1500);
  const midClip = await clipPath();
  (/inset\(/.test(midClip) && !/^inset\((0%?|0px)( (0%?|0px))?\)$/.test(midClip) ? ok : fail)(`desktop proof mid-reveal clip-path "${midClip}"`);
  await s.shot("proof-mid-reveal");
  await frameTopTo(0.15);
  await page.waitForTimeout(1500);
  const fullClip = await clipPath();
  (/^inset\((0%?|0px)( (0%?|0px))?\)$/.test(fullClip) ? ok : fail)(`desktop proof fully revealed clip-path "${fullClip}"`);
  const morph = await page.evaluate(() => {
    const v = document.querySelector("#proof video");
    return v ? { paused: v.paused, w: v.videoWidth, src: v.currentSrc.replace(location.origin, "") } : null;
  });
  (morph && !morph.paused ? ok : fail)(`desktop proof morph playing: ${JSON.stringify(morph)}`);
  await s.shot("proof-revealed");

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(800);
  await s.shot("full", { fullPage: true });
  report(s);
  await s.context.close();
}

// ---------------------------------------------------------------- mobile 390x844
{
  const s = await session("mobile", { width: 390, height: 844 });
  const { page } = s;
  await s.open();
  const sources = s.mediaRequests.filter(isSource);
  const otherSources = sources.filter((u) => !/\/media\/hero\./.test(u));
  (otherSources.length ? fail : ok)(`mobile: video sources at initial load: ${sources.join(", ") || "none"}`);
  const hero = await page.evaluate(() => {
    const v = document.querySelector("#top video");
    return v ? { paused: v.paused, w: v.videoWidth } : null;
  });
  (hero && !hero.paused && hero.w > 0 ? ok : fail)(`mobile: hero video state ${JSON.stringify(hero)}`);
  await s.shot("hero-load");
  for (let i = 0; i < 4; i += 1) {
    await page.evaluate((id) => document.getElementById(`svc-${id}`)?.scrollIntoView({ block: "start" }), SERVICES[i]);
    await page.waitForTimeout(1600);
    const st = await page.evaluate((id) => {
      const vids = [...document.querySelectorAll(`#svc-${id} video`)].filter((v) => v.offsetParent !== null);
      const v = vids.find((x) => x.dataset.front === "true") || vids[0];
      return v ? { paused: v.paused, w: v.videoWidth, src: v.currentSrc.replace(location.origin, "") } : null;
    }, SERVICES[i]);
    (st && !st.paused && st.w > 0 ? ok : fail)(`mobile services ${SERVICES[i]}: ${JSON.stringify(st)}`);
    await s.shot(`services-${pad(i + 1)}-${SERVICES[i]}`);
  }
  await page.evaluate(() => document.querySelector("#proof video, #proof img")?.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(1600);
  const morph = await page.evaluate(() => {
    const v = document.querySelector("#proof video");
    return v ? { paused: v.paused, w: v.videoWidth } : null;
  });
  (morph && !morph.paused ? ok : fail)(`mobile proof morph playing: ${JSON.stringify(morph)}`);
  await s.shot("proof-revealed");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(800);
  await s.shot("full", { fullPage: true });
  report(s);
  await s.context.close();
}

// ---------------------------------------------------------------- reduced motion
for (const vp of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
]) {
  const s = await session(`reduced-${vp.name}`, { width: vp.width, height: vp.height, reducedMotion: "reduce" });
  const { page } = s;
  await s.open();
  const st = await page.evaluate(() => ({
    videos: document.querySelectorAll("video").length,
    posters: [...new Set([...document.querySelectorAll('img[src*="-poster.jpg"]')].map((i) => i.getAttribute("src")))],
  }));
  (st.videos === 0 ? ok : fail)(`${s.name}: <video> elements in DOM = ${st.videos}`);
  (st.posters.length >= 6 ? ok : fail)(`${s.name}: distinct poster images = ${st.posters.length}`);
  const sources = s.mediaRequests.filter(isSource);
  notes.push(`${s.name}: video source requests = ${sources.length}${sources.length ? ` (${[...new Set(sources)].join(", ")})` : ""}`);
  await s.shot("hero");
  await page.evaluate(() => document.getElementById("svc-siding")?.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(1000);
  await s.shot("services");
  report(s);
  await s.context.close();
}

await browser.close();
console.log(`\nNOTES\n${notes.map((n) => `- ${n}`).join("\n")}`);
console.log(failures.length ? `\n${failures.length} FAILURE(S)` : "\nALL CHECKS PASSED");
process.exit(failures.length ? 1 : 0);
