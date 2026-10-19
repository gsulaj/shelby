import type Lenis from "lenis";
import { prefersReducedMotion } from "@/lib/motion/reduced-motion";

let lenisInstance: Lenis | null = null;

export function setLenis(lenis: Lenis | null) {
  lenisInstance = lenis;
}

export function getLenis(): Lenis | null {
  return lenisInstance;
}

/** Smooth-scrolls to an element id, through Lenis when active, natively otherwise. */
export function scrollToId(id: string, offset = 0) {
  if (typeof document === "undefined") return;
  const el = document.getElementById(id);
  if (!el) return;
  if (lenisInstance) {
    lenisInstance.scrollTo(el, { offset, duration: 1.2 });
    return;
  }
  el.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
}
