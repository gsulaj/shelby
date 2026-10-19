// Hero loop endurance test (HERO_BRIEF.md step 6, docs/HERO_RESUME.md "Loop-wrap hold"): the hero video must play
// forever, and seamlessly. Loads the page in Chromium and WebKit, records every frame the viewer sees for 3 minutes
// (scripts/hero-wrap-tracker.mjs: requestVideoFrameCallback on both hero <video> elements, counting the front one),
// and asserts that playback keeps advancing in every 10 s window, that the clip wraps around at least 8 times, and
// that no frame interval at a wrap is longer than 2× the frame interval (83.3 ms at 24 fps): no hold at the loop point.
// Needs the dev server: npm run dev, then npm run test:loop   (HERO_URL / HERO_LOOP_SECONDS override the defaults).
import { chromium, webkit, type BrowserType } from "playwright";
import { describe, expect, test } from "vitest";
import { installWrapTracker, summarizeWrap } from "./hero-wrap-tracker.mjs";

const URL = process.env.HERO_URL ?? "http://localhost:3000";
const SECONDS = Number(process.env.HERO_LOOP_SECONDS ?? 180);
const SAMPLE_MS = 10_000;
/** 8 wraps in the default 180 s (a wrap is every 14.58 s), scaled for shorter runs. */
const MIN_WRAPS = Math.max(1, Math.floor(SECONDS / 22));
/** Media seconds that must be shown inside each 10 s window; leaves room for timer jitter. */
const MIN_ADVANCE_PER_WINDOW = 7;
const FRAME_S = 1 / 24;

type Event = [number, number, number, string];
type Sample = { at: number; t: number; paused: boolean; ended: boolean; front: number; visible: boolean };

/** Media seconds shown between two page times: every shown frame's step, one frame for a wrap. */
function played(events: Event[], from: number, to: number) {
  let sum = 0;
  for (let k = 1; k < events.length; k += 1) {
    if (events[k][0] <= from || events[k][0] > to) continue;
    const step = events[k][2] - events[k - 1][2];
    sum += step >= 0 ? step : FRAME_S;
  }
  return sum;
}

async function run(engine: BrowserType, name: string) {
  const browser = await engine.launch();
  try {
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(URL, { waitUntil: "load" });
    await page.waitForSelector("#top video", { timeout: 30_000 });
    await page.waitForFunction(() => (document.querySelector<HTMLVideoElement>("#top video")?.currentTime ?? 0) > 0.3, null, { timeout: 60_000 });
    await page.evaluate(installWrapTracker);
    const read = () =>
      page.evaluate((): Sample => {
        const all = [...document.querySelectorAll<HTMLVideoElement>("#top video")];
        const v = all.find((x) => x.dataset.front === "true") ?? all[0];
        return { at: performance.now(), t: v.currentTime, paused: v.paused, ended: v.ended, front: all.indexOf(v), visible: document.visibilityState === "visible" };
      });
    const samples: Sample[] = [await read()];
    const windows = Math.floor((SECONDS * 1000) / SAMPLE_MS);
    for (let i = 0; i < windows; i += 1) {
      await page.waitForTimeout(SAMPLE_MS);
      samples.push(await read());
    }
    const events = (await page.evaluate(() => (window as unknown as { __wrap: { events: Event[] } }).__wrap.events)) as Event[];
    const summary = summarizeWrap(events, 24);
    const advance = samples.slice(1).map((s, i) => played(events, samples[i].at, s.at));
    const log = samples.map(
      (s, i) => `${i * 10}s t=${s.t.toFixed(2)} front=${s.front} shown=${i ? advance[i - 1].toFixed(1) : "-"}s paused=${s.paused} ended=${s.ended}`,
    );
    const stalled = advance.map((d, i) => (d < MIN_ADVANCE_PER_WINDOW ? `${i * 10}-${i * 10 + 10}s showed ${d.toFixed(1)}s` : null)).filter(Boolean);
    const holds = summary.wraps.filter((w) => w.gap > summary.limit).map((w) => `${w.gap} ms at ${w.at} s [${w.intervals.join("/")}]`);
    const report =
      `${name}: ${summary.wraps.length} wraps, ${summary.fps} fps shown, wrap gaps ${summary.wraps.map((w) => w.gap).join(", ")} ms ` +
      `(max ${summary.maxWrapGap} vs limit ${summary.limit}), worst elsewhere ${summary.maxOther} ms\n${log.join("\n")}`;
    expect(errors, `${name}: page errors`).toEqual([]);
    expect(stalled, `${name}: playback stalled\n${report}`).toEqual([]);
    expect(summary.wraps.length, `${name}: too few loops\n${report}`).toBeGreaterThanOrEqual(MIN_WRAPS);
    expect(holds, `${name}: frame held at the loop wrap\n${report}`).toEqual([]);
    console.log(report.split("\n")[0]);
  } finally {
    await browser.close();
  }
}

describe("hero video loops forever, without a hold at the wrap", () => {
  test.concurrent("chromium", () => run(chromium, "chromium"), SECONDS * 1000 + 60_000);
  test.concurrent("webkit", () => run(webkit, "webkit"), SECONDS * 1000 + 60_000);
});
