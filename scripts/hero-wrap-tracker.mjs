// Loop-wrap timing of the hero video, measured on what the viewer sees (docs/HERO_RESUME.md "Loop-wrap hold").
// `installWrapTracker` runs inside the page (Playwright `page.evaluate`, or the Safari probe page on an iframe's document):
// every `#top video` (or the videos of the section passed as the second argument) reports each presented frame through requestVideoFrameCallback, and a frame counts as shown only
// while its element is the front one (`data-front="true"`, or the only video). A front swap counts as a shown frame of
// the new front element at the swap's rendering time. `summarizeWrap` (Node or page) turns the shown-frame list into
// the frame intervals at every wrap (the interval into the first frame of the new pass, the one before it and the one
// after it), the normal interval, the worst interval elsewhere and content skips. `hidden` lists [from, to] page times
// when the page was not visible (the browser stops rendering); intervals touching them are left out, and so is a wrap
// next to one.
// Both functions are self-contained so they can be serialised into a page.

export function installWrapTracker(root, section) {
  // installWrapTracker(document | iframeDocument, "#proof") or, through Playwright's single argument, installWrapTracker("#proof")
  const doc = root && root.nodeType ? root : document;
  const sel = typeof root === "string" ? root : section || "#top";
  const win = doc.defaultView;
  const time = () => (win.document.timeline && win.document.timeline.currentTime != null ? win.document.timeline.currentTime : win.performance.now());
  const list = () => Array.from(doc.querySelectorAll(`${sel} video`));
  const front = () => {
    const all = list();
    return all.find((v) => v.dataset.front === "true") || all[0];
  };
  const T = { events: [], swaps: 0, errors: [] };
  const last = new Map();
  let shown = null;
  const show = (v, mt, t, why) => {
    if (shown && shown.v === v && Math.abs(shown.mt - mt) < 1e-4) return;
    T.events.push([+t.toFixed(2), list().indexOf(v), +mt.toFixed(4), why]);
    shown = { v, mt };
  };
  const hook = (v) => {
    if (v.__wrapHooked) return;
    v.__wrapHooked = true;
    if (!v.requestVideoFrameCallback) {
      T.errors.push("requestVideoFrameCallback unsupported");
      return;
    }
    const cb = (t, meta) => {
      last.set(v, meta.mediaTime);
      if (v === front()) show(v, meta.mediaTime, t, "f");
      v.requestVideoFrameCallback(cb);
    };
    v.requestVideoFrameCallback(cb);
  };
  list().forEach(hook);
  new win.MutationObserver(() => {
    list().forEach(hook);
    const f = front();
    if (f && shown && f !== shown.v) {
      T.swaps += 1;
      show(f, last.has(f) ? last.get(f) : f.currentTime, time(), "s");
    }
  }).observe(doc.querySelector(sel), { subtree: true, childList: true, attributes: true, attributeFilter: ["data-front"] });
  T.quality = () =>
    list().reduce(
      (a, v) => {
        const q = v.getVideoPlaybackQuality && v.getVideoPlaybackQuality();
        return q ? { total: a.total + q.totalVideoFrames, dropped: a.dropped + q.droppedVideoFrames } : a;
      },
      { total: 0, dropped: 0 },
    );
  T.q0 = T.quality();
  T.info = () => {
    const v = front();
    return { videos: list().length, src: v ? v.currentSrc.replace(win.location.origin, "") : null, size: v ? `${v.videoWidth}x${v.videoHeight}` : null };
  };
  win.__wrap = T;
}

export function summarizeWrap(events, fps, hidden) {
  const rate = fps || 24;
  const frame = 1000 / rate;
  const ev = events;
  if (ev.length < 3) return { frames: ev.length, wraps: [], limit: Math.ceil(2 * frame), maxWrapGap: null, error: "too few frames" };
  const dt = (k) => ev[k][0] - ev[k - 1][0];
  const off = new Set();
  for (const [from, to] of hidden || []) for (let k = 1; k < ev.length; k += 1) if (ev[k - 1][0] < to + 250 && ev[k][0] > from - 250) off.add(k);
  const touched = (k) => off.has(k - 1) || off.has(k) || off.has(k + 1);
  const wrapIdx = [];
  for (let k = 1; k < ev.length; k += 1) if (ev[k][2] < ev[k - 1][2] - 1) wrapIdx.push(k);
  const near = new Set();
  const excluded = wrapIdx.filter(touched).length;
  const wraps = wrapIdx.filter((k) => !touched(k)).map((k) => {
    const ks = [k - 1, k, k + 1].filter((j) => j >= 1 && j < ev.length);
    ks.forEach((j) => near.add(j));
    const intervals = ks.map((j) => +dt(j).toFixed(1));
    return {
      at: +(ev[k][0] / 1000).toFixed(2),
      gap: Math.max(...intervals),
      intervals,
      from: ev[k - 1][2],
      to: ev[k][2],
      swap: ev[k][1] !== ev[k - 1][1],
    };
  });
  const all = [];
  for (let k = 1; k < ev.length; k += 1) if (!off.has(k)) all.push(dt(k));
  const sorted = [...all].sort((a, b) => a - b);
  let maxOther = 0;
  let maxOtherAt = null;
  let skips = 0;
  const skipAt = [];
  for (let k = 1; k < ev.length; k += 1) {
    if (off.has(k)) continue;
    if (!near.has(k) && dt(k) > maxOther) {
      maxOther = dt(k);
      maxOtherAt = ev[k][2];
    }
    const step = ev[k][2] - ev[k - 1][2];
    if (!wrapIdx.includes(k) && step > 1.5 / rate) {
      skips += Math.round(step * rate) - 1;
      skipAt.push(+(ev[k][2] - step).toFixed(3));
    }
  }
  let hiddenMs = 0;
  for (const k of off) hiddenMs += dt(k);
  const seconds = (ev[ev.length - 1][0] - ev[0][0] - hiddenMs) / 1000;
  return {
    frames: all.length + 1,
    excludedWraps: excluded,
    seconds: +seconds.toFixed(1),
    fps: +(all.length / seconds).toFixed(2),
    median: +sorted[Math.floor(sorted.length / 2)].toFixed(1),
    p99: +sorted[Math.floor(sorted.length * 0.99)].toFixed(1),
    maxOther: +maxOther.toFixed(1),
    maxOtherAt,
    skips,
    skipAt: skipAt.slice(0, 20),
    limit: Math.ceil(2 * frame),
    maxWrapGap: wraps.length ? Math.max(...wraps.map((w) => w.gap)) : null,
    wraps,
  };
}
