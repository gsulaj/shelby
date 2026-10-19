// Playwright screenshots for visual verification.
// node scripts/screenshot.mjs --out docs/screenshots/phase-1 [--url http://localhost:3000]
//   [--at <y|css-selector> ...] [--scrolled-header] [--reduced-motion] [--only desktop|mobile]
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const opt = { out: "docs/screenshots/latest", url: "http://localhost:3000", at: [], scrolledHeader: false, reducedMotion: false, only: null };
for (let i = 0; i < args.length; i += 1) {
  const a = args[i];
  if (a === "--out") opt.out = args[(i += 1)];
  else if (a === "--url") opt.url = args[(i += 1)];
  else if (a === "--at") opt.at.push(args[(i += 1)]);
  else if (a === "--scrolled-header") opt.scrolledHeader = true;
  else if (a === "--reduced-motion") opt.reducedMotion = true;
  else if (a === "--only") opt.only = args[(i += 1)];
}

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
].filter((v) => !opt.only || v.name === opt.only);

fs.mkdirSync(opt.out, { recursive: true });
const browser = await chromium.launch();
const written = [];
const slug = (s) => s.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();

for (const vp of viewports) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 2,
    reducedMotion: opt.reducedMotion ? "reduce" : "no-preference",
  });
  const page = await context.newPage();
  const logs = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") logs.push(`[${m.type()}] ${m.text()}`);
  });
  page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));

  await page.goto(opt.url, { waitUntil: "load" });
    await page.waitForSelector("#top", { timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(2500);

  const save = async (name, extra = {}) => {
    const file = path.join(opt.out, `${vp.name}-${name}.png`);
    await page.screenshot({ path: file, ...extra });
    written.push(file);
  };

  await save("top");
  await save("full", { fullPage: true });

  // Pad the page so scroll positions are reachable even when only the hero exists.
  if (opt.scrolledHeader) {
    await page.evaluate(() => {
      document.body.style.minHeight = "300vh";
    });
  }

  for (let i = 0; i < opt.at.length; i += 1) {
    const target = opt.at[i];
    await page.evaluate((t) => {
      const y = Number(t);
      if (!Number.isNaN(y)) window.scrollTo(0, y);
      else document.querySelector(t)?.scrollIntoView({ block: "start" });
    }, target);
    await page.waitForTimeout(1500);
    await save(`at-${String(i + 1).padStart(2, "0")}-${slug(target)}`);
  }

  if (opt.scrolledHeader) {
    // Scroll down past the threshold (header hides), then back up a little (header reveals).
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    await page.evaluate(() => window.scrollTo(0, 120));
    await page.waitForTimeout(150);
    await page.evaluate(() => window.scrollTo(0, 360));
    await page.waitForTimeout(900);
    await save("header-hidden");
    await page.evaluate(() => window.scrollTo(0, 300));
    await page.waitForTimeout(900);
    await save("header-revealed");
  }

  console.log(logs.length ? `console (${vp.name}):\n  ${logs.join("\n  ")}` : `console (${vp.name}): clean`);
  await context.close();
}

await browser.close();
console.log(written.join("\n"));
