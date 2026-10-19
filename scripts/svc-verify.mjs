// Services v2 integration check (SERVICES_BRIEF.md §5) on the running dev server, Playwright Chromium:
//   - desktop 1440×900: the sticky panel shows the right clip at each of the four positions, scrolling down 01→04 and
//     back up 03→01 (only that layer visible, only its video playing, index "0N / 04", the 2160² file loaded);
//   - mobile 390×844: each block's own 4:5 video plays when its block is on screen while the other blocks' videos
//     are paused;
//   - console: no errors, no hydration warnings, no failed media responses;
//   - screenshots of every position at 1440 and 390 → --out (default docs/screenshots/services-v2/).
// node scripts/svc-verify.mjs [--url http://localhost:3000] [--out docs/screenshots/services-v2]
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const opt = { url: "http://localhost:3000", out: "docs/screenshots/services-v2" };
for (let i = 0; i < args.length; i += 1) {
  const key = args[i].replace(/^--/, "");
  if (key in opt) opt[key] = args[(i += 1)];
}
fs.mkdirSync(opt.out, { recursive: true });
const SERVICES = ["roofing", "siding", "windows", "gutters"];
const SIZE = Number(process.env.SVC_SIZE || 2160);
const pad = (n) => String(n).padStart(2, "0");
const failures = [];
const check = (good, msg) => {
  console.log(`${good ? "ok  " : "FAIL"} ${msg}`);
  if (!good) failures.push(msg);
};

const browser = await chromium.launch();
async function session(name, viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const logs = [];
  const bad = [];
  page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && logs.push(`[${m.type()}] ${m.text()}`));
  page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
  page.on("response", (r) => r.status() >= 400 && bad.push(`${r.status()} ${r.url().replace(opt.url, "")}`));
  await page.goto(opt.url, { waitUntil: "load" });
  await page.waitForSelector("#services", { timeout: 60_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(2500);
  const shot = (label) => page.screenshot({ path: path.join(opt.out, `${name}-${label}.jpg`), type: "jpeg", quality: 90 });
  const finish = async () => {
    const hydration = logs.filter((l) => /hydrat|did not match|does not match/i.test(l));
    const errors = logs.filter((l) => l.startsWith("[error]") || l.startsWith("[pageerror]"));
    check(!hydration.length && !errors.length, `${name}: console ${errors.length} error(s), ${hydration.length} hydration warning(s)${logs.length ? ` — ${logs.join(" | ")}` : ""}`);
    const media = bad.filter((l) => l.includes("/media/"));
    check(!media.length, `${name}: failed media responses: ${media.join(", ") || "none"}`);
    await context.close();
  };
  return { page, shot, finish };
}

// ---------------------------------------------------------------- desktop
{
  const { page, shot, finish } = await session("desktop", { width: 1440, height: 900 });
  const state = () =>
    page.evaluate(() => {
      const layers = [...document.querySelectorAll(".svc-layer")];
      return {
        visible: layers.map((l, i) => (getComputedStyle(l).opacity === "1" ? i : -1)).filter((i) => i >= 0),
        playing: layers.map((l) => {
          const all = [...l.querySelectorAll("video")];
          const v = all.find((x) => x.dataset.front === "true") || all[0]; // the front element of a double-buffered layer
          return v ? !v.paused : null;
        }),
        files: layers.map((l) => {
          const all = [...l.querySelectorAll("video")];
          const v = all.find((x) => x.dataset.front === "true") || all[0]; // the front element of a double-buffered layer
          return v && v.currentSrc ? `${v.currentSrc.replace(location.origin, "")} ${v.videoWidth}x${v.videoHeight}` : null;
        }),
        index: document.querySelector('[aria-live="polite"]')?.textContent?.replace(/\s+/g, " ").trim(),
      };
    });
  const position = async (idx, dir) => {
    await page.evaluate((id) => document.getElementById(`svc-${id}`)?.scrollIntoView({ block: "center" }), SERVICES[idx]);
    await page.waitForTimeout(1800);
    const st = await state();
    const good =
      st.visible.length === 1 &&
      st.visible[0] === idx &&
      st.playing.every((p, i) => (i === idx ? p === true : p === false)) &&
      st.index === `${pad(idx + 1)} / 04` &&
      st.files[idx]?.startsWith(`/media/${SERVICES[idx]}.mp4 ${SIZE}x${SIZE}`);
    check(good, `desktop ${dir} ${SERVICES[idx]}: visible ${JSON.stringify(st.visible)} playing ${JSON.stringify(st.playing)} index "${st.index}" file ${st.files[idx]}`);
    await shot(`${dir}-${pad(idx + 1)}-${SERVICES[idx]}`);
  };
  for (let i = 0; i < 4; i += 1) await position(i, "down");
  for (let i = 2; i >= 0; i -= 1) await position(i, "up");
  await finish();
}

// ---------------------------------------------------------------- mobile
{
  const { page, shot, finish } = await session("mobile", { width: 390, height: 844 });
  for (let i = 0; i < 4; i += 1) {
    await page.evaluate((id) => document.getElementById(`svc-${id}`)?.scrollIntoView({ block: "start" }), SERVICES[i]);
    await page.waitForTimeout(1800);
    const st = await page.evaluate((keys) => {
      const own = (id) => {
        const vids = [...document.querySelectorAll(`#svc-${id} video`)].filter((v) => v.offsetParent !== null);
        return vids.find((v) => v.dataset.front === "true") || vids[0];
      };
      return keys.map((id) => {
        const v = own(id);
        return v ? { playing: !v.paused, file: v.currentSrc ? `${v.currentSrc.replace(location.origin, "")} ${v.videoWidth}x${v.videoHeight}` : "(not loaded)" } : null;
      });
    }, SERVICES);
    const panel = await page.evaluate(() => [...document.querySelectorAll(".svc-layer video")].filter((v) => !v.paused).length);
    const good = st[i]?.playing && st[i].file.startsWith(`/media/${SERVICES[i]}.mp4 ${SIZE}x${SIZE}`) && st.every((s, k) => k === i || !s?.playing) && panel === 0;
    check(good, `mobile ${SERVICES[i]}: ${JSON.stringify(st.map((s) => (s ? (s.playing ? "playing" : "paused") : null)))} own file ${st[i]?.file}; sticky-panel videos playing: ${panel}`);
    await shot(`${pad(i + 1)}-${SERVICES[i]}`);
  }
  await finish();
}

await browser.close();
console.log(failures.length ? `FAILED: ${failures.length} check(s)` : "ALL CHECKS PASSED");
process.exit(failures.length ? 1 : 0);
