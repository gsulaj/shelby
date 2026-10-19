"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import type { ResolvedVideo } from "@/lib/media/types";
import { usePrefersReducedMotion } from "@/lib/motion/reduced-motion";
import { MediaPlaceholder, type LabelOffset } from "./MediaPlaceholder";

type SmartVideoProps = {
  media: ResolvedVideo;
  /** Only the hero should preload. */
  preload?: "auto" | "none";
  /** When false the video is paused even while visible (sticky services panel). */
  active?: boolean;
  className?: string;
  /** Absolutely fill the parent instead of reserving an aspect-ratio box. */
  fill?: boolean;
  /** Where the placeholder tag sits when no media exists yet. */
  placeholderLabelOffset?: LabelOffset;
  /** CSS aspect-ratio override (defaults to the manifest aspect). */
  aspect?: string;
  /**
   * Loop through two stacked elements instead of the native `loop` (the hero): at 4k, Safari, WebKit and Chromium
   * hold a frame for 110–170 ms while the native loop seeks back to 0. See startSeamlessLoop.
   */
  seamless?: boolean;
};

/** How often the watchdog samples playback, and how many unchanged samples count as a stall. */
const WATCHDOG_MS = 1000;
const STALL_TICKS = 2;

/** Frame duration until the clip's own frames have been seen (the hero is 24 fps). */
const DEFAULT_FRAME_S = 1 / 24;
/** How long before the end the swap is prepared: the back element is checked (paused, on frame 0) and timed. */
const ARM_S = 0.5;
/** The back element starts loading once the front has played this long, so the first pass keeps the bandwidth. */
const BACK_LOAD_AFTER_S = 2;
/** ...and its start-up delay is measured once it has had this long to buffer. */
const CALIBRATE_AFTER_S = 4;
/**
 * A short clip reaches those points too late or never: the 3.1–3.7 s service clips never got to 4 s, so their first
 * swap started the back element cold (an 83–100 ms hold in Safari and WebKit), and the 4.5 s ones were still probing when
 * the wrap came (a fallback restart). So both points are capped at these shares of the clip's duration: the back element
 * loads a quarter of the way through the first pass and is calibrated halfway, with time left before the swap. The hero
 * (14.6 s) and the proof (8.8 s) still load at 2 s and calibrate at 4 s.
 */
const BACK_LOAD_SHARE = 0.25;
const CALIBRATE_SHARE = 0.5;
const backLoadAt = (duration: number) => Math.min(BACK_LOAD_AFTER_S, duration > 0 ? BACK_LOAD_SHARE * duration : Infinity);
const calibrateAt = (duration: number) => Math.min(CALIBRATE_AFTER_S, duration > 0 ? CALIBRATE_SHARE * duration : Infinity);
/** The element that just finished is rewound this long after the swap, clear of the new front's first frames. */
const REWIND_DELAY_MS = 1000;
/** A rendering frame this close to its target time already counts as on time. */
const EARLY_MS = 4;

type FrameCallbackVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: (now: number, meta: { mediaTime: number }) => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

/**
 * Double-buffered loop for the hero. The native `loop` seeks the one decoder back to frame 0 at every wrap, and at
 * 4k that seek holds the last frame for 110–220 ms in Safari, WebKit and Chromium. Here two stacked elements share
 * the source: the front plays while the back waits paused on frame 0, already decoded. requestVideoFrameCallback
 * on the front predicts when its last frame will have been on screen for a full frame; at that rendering frame the
 * back element is raised (no crossfade: the stitch makes last → first an ordinary step) and the finished one is
 * paused, then rewound to 0 for the next wrap. play() takes a while to get a clock running (about 60 ms in WebKit,
 * next to nothing in Chromium), so the back element is started that much ahead of the swap, still hidden, and its
 * frame 1 follows its frame 0 on time. That delay is measured once on the hidden element during the first pass and
 * refined at every wrap. Where requestVideoFrameCallback is missing, timeupdate and a frame loop swap at the end
 * instead; if the back element is not ready, the front restarts from 0 like the native loop. The watchdog,
 * visibility and `active` rules of the single element apply to whichever element is in front.
 */
function startSeamlessLoop(
  pair: [FrameCallbackVideo, FrameCallbackVideo],
  host: HTMLElement,
  isActive: boolean,
): () => void {
  // Resume where a previous run left off (a remount during development): whichever element is in front stays there.
  let frontIndex = pair[1].dataset.front === "true" ? 1 : 0;
  const front = () => pair[frontIndex];
  const back = () => pair[1 - frontIndex];
  let frameS = DEFAULT_FRAME_S;
  let lastMediaTime = -1;
  /** Rendering time at which the front's last frame will have been on screen for a full frame. */
  let endAt: number | null = null;
  /** The back element was started ahead of the swap. */
  let backStarted = false;
  /** How long play() takes to get an element's clock running. */
  let startDelayMs = 0;
  /** Hidden test starts still to run: the first is a cold start (83 ms in Chromium, ~0 once warm) and is discarded. */
  let probesLeft = 2;
  let calibrated = false;
  let timing: { video: FrameCallbackVideo; calledAt: number; probe: boolean } | null = null;
  let raf = 0;
  let rewindTimer = 0;
  let probeTimer = 0;
  let backRequested = back().preload === "auto";
  let disposed = false;
  let visible = false;
  const frameHandles = new Map<FrameCallbackVideo, number>();
  // Opt-in trace for the wrap checks (scripts/svc-wrap-check.mjs sets window.__loopDebug = []): back loads, calibration
  // probes, timed starts and each swap's state. Inert unless that array exists.
  const trace = (ev: string, data: Record<string, unknown> = {}) => {
    const log = (window as unknown as { __loopDebug?: unknown[] }).__loopDebug;
    if (!Array.isArray(log)) return;
    const src = (pair[0].currentSrc || "").split("/").pop();
    log.push({ ev, at: +performance.now().toFixed(1), src, calibrated, startDelayMs: +startDelayMs.toFixed(1), probesLeft, ...data });
  };
  trace("init", { frontIndex });

  const wanted = () => visible && isActive && document.visibilityState !== "hidden";
  const atEnd = (v: HTMLVideoElement) => v.ended || (v.duration > 0 && v.currentTime >= v.duration - 0.05);
  const play = (v: HTMLVideoElement) =>
    v.play().catch(() => {
      /* autoplay can be refused; the poster stays visible */
    });
  const layer = () =>
    pair.forEach((v, i) => {
      v.dataset.front = String(i === frontIndex);
      v.style.zIndex = i === frontIndex ? "1" : "0";
    });
  /** The back element is meant to be playing: started ahead of the swap, or timed while hidden. */
  const backBusy = () => backStarted || timing?.video === back();

  const requestBack = () => {
    if (backRequested) return;
    backRequested = true;
    trace("request-back", { frontT: +front().currentTime.toFixed(3) });
    const v = back();
    v.preload = "auto";
    v.load();
  };
  const backReady = () => {
    const v = back();
    return v.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA && !v.seeking && v.currentTime < frameS / 2;
  };
  // Shortly before the wrap: the back element must be loading, paused, and on frame 0.
  const arm = () => {
    const v = back();
    if (!backRequested) requestBack();
    else if (!v.seeking && v.readyState >= HTMLMediaElement.HAVE_METADATA && v.currentTime >= frameS / 2) v.currentTime = 0;
    if (!v.paused && !backBusy()) v.pause();
  };

  const startTimed = (v: FrameCallbackVideo, probe: boolean) => {
    timing = { video: v, calledAt: performance.now(), probe };
    play(v);
  };
  // The first frame after play(): its media time says when the clock started.
  const timed = (v: FrameCallbackVideo, now: number, mediaTime: number) => {
    if (!timing || timing.video !== v || mediaTime <= 0 || v.paused) return;
    const delay = Math.min(2 * frameS * 1000, Math.max(0, now - mediaTime * 1000 - timing.calledAt));
    if (timing.probe) probesLeft -= 1;
    trace("timed", { probe: timing.probe, delay: +delay.toFixed(1), mediaTime });
    if (!timing.probe || probesLeft === 0) {
      startDelayMs = calibrated ? (startDelayMs + delay) / 2 : delay;
      calibrated = true;
    }
    if (timing.probe) {
      window.clearTimeout(probeTimer);
      v.pause();
      v.currentTime = 0;
    }
    timing = null;
  };
  // During the first pass: start the hidden back element, time its first frame, put it back on 0; twice.
  const calibrate = () => {
    if (calibrated || timing || !backReady() || !back().paused) return;
    const v = back();
    trace("probe-start", { frontT: +front().currentTime.toFixed(3) });
    startTimed(v, true);
    probeTimer = window.setTimeout(() => {
      if (timing?.video !== v) return;
      timing = null;
      calibrated = true;
      v.pause();
      v.currentTime = 0;
    }, REWIND_DELAY_MS);
  };

  const swap = () => {
    cancelAnimationFrame(raf);
    raf = 0;
    endAt = null;
    lastMediaTime = -1;
    const started = backStarted;
    backStarted = false;
    const finished = front();
    trace("swap", { started, backReady: backReady(), frontT: +finished.currentTime.toFixed(3), dur: +finished.duration.toFixed(3), backRS: back().readyState });
    if (!started && !backReady()) {
      arm();
      finished.currentTime = 0;
      play(finished);
      return;
    }
    frontIndex = 1 - frontIndex;
    layer();
    if (!started) startTimed(front(), false);
    finished.pause();
    window.clearTimeout(rewindTimer);
    rewindTimer = window.setTimeout(() => {
      if (back() === finished && !backBusy()) finished.currentTime = 0;
    }, REWIND_DELAY_MS);
  };

  // From the arm point to the swap, every rendering frame: start the back element one start-up delay before the
  // front's last frame has had its full time, and raise it at that time.
  const waitForSwap = (ts: number) => {
    raf = 0;
    if (endAt === null || disposed) return;
    if (!backStarted && startDelayMs > 0 && ts >= endAt - startDelayMs - EARLY_MS && backReady()) {
      backStarted = true;
      startTimed(back(), false);
    }
    if (ts >= endAt - EARLY_MS) swap();
    else raf = requestAnimationFrame(waitForSwap);
  };

  // Every presented frame: time a start, then for the front element learn the frame duration, load and calibrate
  // the back element after the first seconds, and near the end predict when its last frame will be done.
  const onFrame = (v: FrameCallbackVideo) => (now: number, meta: { mediaTime: number }) => {
    if (disposed) return;
    frameHandles.set(v, v.requestVideoFrameCallback!(onFrame(v)));
    timed(v, now, meta.mediaTime);
    if (v !== front() || v.paused) return;
    const t = meta.mediaTime;
    const step = t - lastMediaTime;
    if (lastMediaTime >= 0 && step > 1 / 240 && step < frameS) frameS = step;
    lastMediaTime = t;
    if (t >= backLoadAt(v.duration)) requestBack();
    if (t >= calibrateAt(v.duration)) calibrate();
    if (!(v.duration > 0) || t < v.duration - ARM_S) return;
    if (!backStarted) arm();
    endAt = now + (v.duration - t) * 1000;
    if (!raf) raf = requestAnimationFrame(waitForSwap);
  };
  const hasFrameCallback = typeof pair[0].requestVideoFrameCallback === "function";
  if (hasFrameCallback) pair.forEach((v) => frameHandles.set(v, v.requestVideoFrameCallback!(onFrame(v))));

  // Without requestVideoFrameCallback: timeupdate loads and arms the back element, then a frame loop swaps as
  // soon as the front reaches the start of its last frame plus half a frame.
  const pollEnd = () => {
    raf = 0;
    const v = front();
    if (disposed || v.paused) return;
    if (v.ended || v.currentTime >= v.duration - frameS / 2) swap();
    else raf = requestAnimationFrame(pollEnd);
  };
  const onTimeUpdate = (e: Event) => {
    const v = e.currentTarget as HTMLVideoElement;
    if (v !== front() || v.paused || !(v.duration > 0)) return;
    if (v.currentTime >= backLoadAt(v.duration)) requestBack();
    if (v.currentTime >= v.duration - ARM_S) {
      arm();
      if (!raf) raf = requestAnimationFrame(pollEnd);
    }
  };
  // WebKit reports `ended` up to 20 ms before the last frame has had its time; the frame loop swaps then.
  const onEnded = (e: Event) => {
    if (e.currentTarget === front() && wanted() && endAt === null) swap();
  };

  const sync = () => {
    if (wanted()) {
      play(front());
      if (!back().paused && !backBusy()) back().pause();
      return;
    }
    cancelAnimationFrame(raf);
    raf = 0;
    endAt = null;
    backStarted = false;
    front().pause();
    back().pause();
  };
  const observer = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      sync();
    },
    { threshold: 0.15 },
  );
  observer.observe(host);

  // Watchdog, as for a single element, on whichever element is in front: restart it when it is visible and
  // paused, ended or not advancing; at the end that restart is the swap.
  const nudge = () => {
    if (!wanted() || raf) return; // a swap is already timed (WebKit is `ended` before the last frame is done)
    if (atEnd(front())) swap();
    else play(front());
  };
  let lastTime = -1;
  let stalledTicks = 0;
  const tick = () => {
    if (!wanted()) {
      lastTime = -1;
      stalledTicks = 0;
      return;
    }
    const v = front();
    if (!back().paused && !backBusy()) back().pause();
    if (v.paused || v.ended) {
      nudge();
    } else if (v.currentTime === lastTime) {
      stalledTicks += 1;
      if (stalledTicks >= STALL_TICKS) {
        stalledTicks = 0;
        nudge();
      }
    } else {
      stalledTicks = 0;
    }
    lastTime = front().currentTime;
  };
  const timer = window.setInterval(tick, WATCHDOG_MS);
  const onVisibility = () => {
    if (document.visibilityState === "visible") nudge();
  };
  const onStalled = (e: Event) => {
    if (e.currentTarget === front()) nudge();
  };
  document.addEventListener("visibilitychange", onVisibility);
  pair.forEach((v) => {
    v.muted = true;
    v.addEventListener("ended", onEnded);
    v.addEventListener("stalled", onStalled);
    if (!hasFrameCallback) v.addEventListener("timeupdate", onTimeUpdate);
  });
  layer();

  return () => {
    disposed = true;
    observer.disconnect();
    window.clearInterval(timer);
    window.clearTimeout(rewindTimer);
    window.clearTimeout(probeTimer);
    cancelAnimationFrame(raf);
    document.removeEventListener("visibilitychange", onVisibility);
    pair.forEach((v) => {
      const handle = frameHandles.get(v);
      if (handle !== undefined) v.cancelVideoFrameCallback?.(handle);
      v.removeEventListener("ended", onEnded);
      v.removeEventListener("stalled", onStalled);
      v.removeEventListener("timeupdate", onTimeUpdate);
    });
  };
}

export function SmartVideo({
  media,
  preload = "none",
  active = true,
  className,
  fill,
  placeholderLabelOffset,
  aspect,
  seamless = false,
}: SmartVideoProps) {
  const ratio = aspect ?? media.aspect;
  const ref = useRef<HTMLVideoElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLVideoElement>(null);
  const second = useRef<HTMLVideoElement>(null);
  const visible = useRef(false);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (!host.current || !first.current || !second.current) return;
    return startSeamlessLoop([first.current, second.current], host.current, active);
  }, [active, media.mp4, reducedMotion]);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.muted = true;

    const sync = () => {
      if (visible.current && active) {
        video.play().catch(() => {
          /* autoplay can be refused; the poster stays visible */
        });
      } else {
        video.pause();
      }
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible.current = entry.isIntersecting;
        sync();
      },
      { threshold: 0.15 },
    );
    observer.observe(video);
    sync();

    // Watchdog: a looping clip must play forever while it is on screen. WebKit stops looping WebM at the end of
    // the file without firing `ended` (currentTime sits at the duration, paused stays false), browsers pause
    // muted video in hidden tabs, and a stalled read leaves the clip frozen. Whenever the clip is visible and
    // paused, ended, or not advancing, restart it: from the top when it is sitting at the end.
    const wanted = () => visible.current && active && document.visibilityState !== "hidden";
    const nudge = () => {
      if (!wanted()) return;
      if (video.ended || (video.duration > 0 && video.currentTime >= video.duration - 0.05)) {
        video.currentTime = 0;
      }
      video.play().catch(() => {});
    };
    let lastTime = -1;
    let stalledTicks = 0;
    const tick = () => {
      if (!wanted()) {
        lastTime = -1;
        stalledTicks = 0;
        return;
      }
      if (video.paused || video.ended) {
        nudge();
      } else if (video.currentTime === lastTime) {
        stalledTicks += 1;
        if (stalledTicks >= STALL_TICKS) {
          stalledTicks = 0;
          nudge();
        }
      } else {
        stalledTicks = 0;
      }
      lastTime = video.currentTime;
    };
    const timer = window.setInterval(tick, WATCHDOG_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") nudge();
    };
    document.addEventListener("visibilitychange", onVisibility);
    video.addEventListener("ended", nudge);
    video.addEventListener("stalled", nudge);

    return () => {
      observer.disconnect();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      video.removeEventListener("ended", nudge);
      video.removeEventListener("stalled", nudge);
    };
  }, [active, media.mp4]);

  if (!media.available) {
    return (
      <MediaPlaceholder
        raw={media.raw}
        aspect={ratio}
        className={className}
        fill={fill}
        labelOffset={placeholderLabelOffset}
      />
    );
  }

  const box = cn(fill ? "absolute inset-0" : "relative w-full", "h-full w-full object-cover", className);
  const style = fill ? undefined : { aspectRatio: ratio };

  if (reducedMotion) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={media.poster} alt="" className={box} style={style} />;
  }

  if (seamless) {
    // Two stacked elements on one source (startSeamlessLoop). The second stays on preload="none" until the first
    // has played a couple of seconds, so the page load still fetches the hero once; it never needs a poster
    // because it only comes to the front once its frame 0 is decoded. No `loop`: the swap is the loop.
    const layerBox = "absolute inset-0 h-full w-full object-cover";
    return (
      <div
        ref={host}
        aria-hidden
        className={cn(fill ? "absolute inset-0" : "relative w-full", "h-full w-full overflow-hidden", className)}
        style={style}
      >
        <video
          ref={first}
          muted
          autoPlay={preload === "auto" && active}
          playsInline
          preload={preload}
          poster={media.poster}
          data-front="true"
          className={layerBox}
          style={{ zIndex: 1 }}
        >
          <source src={media.mp4} type="video/mp4" />
          <source src={media.webm} type="video/webm" />
        </video>
        <video ref={second} muted playsInline preload="none" data-front="false" className={layerBox} style={{ zIndex: 0 }}>
          <source src={media.mp4} type="video/mp4" />
          <source src={media.webm} type="video/webm" />
        </video>
      </div>
    );
  }

  return (
    <video
      ref={ref}
      muted
      // Only the preloaded hero carries the autoplay attribute: Chromium fetches a source for any
      // autoplay video even with preload="none", which defeated lazy loading of the other clips.
      // Those start from the IntersectionObserver play() call above instead.
      autoPlay={preload === "auto" && active}
      loop
      playsInline
      preload={preload}
      poster={media.poster}
      aria-hidden
      className={box}
      style={style}
    >
      {/* MP4 first: WebKit (Safari) stops looping a WebM source at the end of the file, while the H.264 MP4
          loops cleanly in every engine. The WebM stays as the fallback for browsers without H.264. */}
      <source src={media.mp4} type="video/mp4" />
      <source src={media.webm} type="video/webm" />
    </video>
  );
}
