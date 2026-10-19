"use client";

import { Phone } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { site } from "@/content/site";
import { cn } from "@/lib/cn";
import { gsap, useGSAP } from "@/lib/motion/gsap";
import { prefersReducedMotion } from "@/lib/motion/reduced-motion";
import { scrollToId } from "@/lib/scroll";
import { HeaderNav } from "./HeaderNav";
import { MobileMenu } from "./MobileMenu";

/** Scroll depth after which the veil appears and auto-hide may engage. */
const SCROLL_THRESHOLD = 80;
/** Ignore scroll jitter smaller than this when deciding direction. */
const DIRECTION_DEADBAND = 4;
/** Height of the gradient veil; the header slides up by this much so the veil fully clears too. */
const VEIL_HEIGHT = 140;

export function Header() {
  const header = useRef<HTMLElement>(null);
  const reveal = useRef<() => void>(() => {});
  const [scrolled, setScrolled] = useState(false);
  const { contextSafe } = useGSAP(() => {}, { scope: header });

  useEffect(() => {
    const reduced = prefersReducedMotion();
    let lastY = window.scrollY;
    let hidden = false;

    const setHidden = contextSafe((next: boolean) => {
      if (hidden === next) return;
      hidden = next;
      gsap.to(header.current, {
        y: next ? -VEIL_HEIGHT : 0,
        duration: 0.4,
        ease: "power3.out",
        overwrite: true,
      });
    });
    reveal.current = () => setHidden(false);

    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > SCROLL_THRESHOLD);
      if (reduced) return;
      if (y <= SCROLL_THRESHOLD) {
        setHidden(false);
        lastY = y;
        return;
      }
      if (Math.abs(y - lastY) < DIRECTION_DEADBAND) return;
      setHidden(y > lastY);
      lastY = y;
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [contextSafe]);

  return (
    <header ref={header} className="fixed inset-x-0 top-0 z-50" onFocus={() => reveal.current()}>
      <div
        aria-hidden
        className={cn(
          "header-veil pointer-events-none absolute inset-x-0 top-0 transition-opacity duration-300 motion-reduce:transition-none",
          scrolled ? "opacity-100" : "opacity-0",
        )}
        style={{ height: VEIL_HEIGHT }}
      />
      <div className="wrap relative flex h-16 items-center justify-between md:h-[72px]">
        <a
          href="#top"
          className="flex items-center"
          aria-label={`${site.name}, back to top`}
          onClick={(event) => {
            event.preventDefault();
            scrollToId("top");
          }}
        >
          <Image
            src="/brand/logo-light.png"
            alt={site.name}
            width={116}
            height={40}
            priority
            className="h-8 w-auto md:h-10"
          />
        </a>

        {/* justify-between gives equal gaps, so the nav sits exactly between the logo and the phone link. */}
        <HeaderNav className="hidden min-[1200px]:block" />

        <div className="flex items-center gap-2 md:gap-8">
          <a
            href={site.phone.href}
            className="inline-flex size-11 items-center justify-center gap-2 px-2 font-display text-[15px] font-semibold uppercase tracking-[0.08em] text-on-dark transition-colors hover:text-accent-hover md:h-12 md:w-auto"
          >
            <Phone aria-hidden className="size-4" strokeWidth={2.25} />
            <span className="hidden md:inline">{site.phone.display}</span>
            <span className="sr-only md:hidden">Call {site.phone.display}</span>
          </a>
          {/* Below 768px the hero CTA covers it; display: contents leaves the button laid out as before above that. */}
          <div className="hidden md:contents">
            <Button variant="ghost" size="md" onClick={() => scrollToId("estimate")}>
              Free Estimate
            </Button>
          </div>
          <MobileMenu className="min-[1200px]:hidden" />
        </div>
      </div>
    </header>
  );
}
