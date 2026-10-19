import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

if (typeof window !== "undefined") {
  gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);
}

export { gsap, ScrollTrigger, SplitText, useGSAP };

export const EASE = { reveal: "power3.out", crossfade: "power2.inOut" } as const;
export const DURATION = { reveal: 0.9, crossfade: 0.7 } as const;

/** gsap.matchMedia() condition: only animate when the visitor has not asked for reduced motion. */
export const MOTION_OK = "(prefers-reduced-motion: no-preference)";

export type RevealVars = {
  stagger?: number;
  delay?: number;
  duration?: number;
  scrollTrigger?: ScrollTrigger.Vars;
};

/**
 * Masked line-by-line slide-up reveal. Splits `target` into lines, wraps each in an overflow
 * mask, and animates them from 110% below. The target should carry the `js-split` class so it
 * stays hidden until the split runs (see globals.css).
 */
export function revealLines(target: HTMLElement, vars: RevealVars = {}): SplitText {
  return SplitText.create(target, {
    type: "lines",
    mask: "lines",
    autoSplit: true,
    linesClass: "split-line",
    onSplit(self) {
      gsap.set(target, { visibility: "visible" });
      return gsap.from(self.lines, {
        yPercent: 110,
        duration: vars.duration ?? DURATION.reveal,
        ease: EASE.reveal,
        stagger: vars.stagger ?? 0.08,
        delay: vars.delay ?? 0,
        scrollTrigger: vars.scrollTrigger,
      });
    },
  });
}
