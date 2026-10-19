// Hero screenshots at fixed points in the loop (HERO_BRIEF.md step 7): 1440x900 and 390x844 at 0, 5 and 10 s.
// node scripts/hero-shots.mjs [--url http://localhost:3000] [--out docs/screenshots/hero-v2] [--times 0,5,10]
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const opt = { url: "http://localhost:3000", out: "docs/screenshots/hero-v2", times: [0, 5, 10] };
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === "--url") opt.url = args[(i += 1)];
  else if (args[i] === "--out") opt.out = args[(i += 1)];
  else if (args[i] === "--times") opt.times = args[(i += 1)].split(",").map(Number);
}
fs.mkdirSync(opt.out, { recursive: true });

const browser = await chromium.launch();
for (const vp of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
]) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const logs = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") logs.push(`[${m.type()}] ${m.text()}`);
  });
  page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
  await page.goto(opt.url, { waitUntil: "load" });
  await page.waitForSelector("#top video", { timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(3000); // the intro reveal has finished
  const meta = await page.evaluate(() => {
    const v = document.querySelector("#top video");
    v.pause();
    v.play = () => Promise.resolve(); // keep the SmartVideo watchdog from restarting it while we seek
    return { duration: v.duration, w: v.videoWidth, h: v.videoHeight, src: v.currentSrc.replace(location.origin, "") };
  });
  for (const t of opt.times) {
    await page.evaluate(
      (tt) =>
        new Promise((res) => {
          const v = document.querySelector("#top video");
          v.addEventListener("seeked", () => requestAnimationFrame(() => requestAnimationFrame(res)), { once: true });
          v.currentTime = tt;
        }),
      t,
    );
    const file = path.join(opt.out, `${vp.name}-hero-${t}s.png`);
    await page.screenshot({ path: file });
    console.log(file);
  }
  console.log(`${vp.name}: hero ${meta.src} ${meta.w}x${meta.h} ${meta.duration.toFixed(2)} s · console ${logs.length ? logs.join(" | ") : "clean"}`);
  await context.close();
}
await browser.close();
