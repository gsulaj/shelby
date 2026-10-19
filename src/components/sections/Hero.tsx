"use client";

import { Award, BadgeCheck, Medal, ShieldCheck, Star } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { SmartVideo } from "@/components/ui/SmartVideo";
import { site, type TrustIcon } from "@/content/site";
import type { ResolvedVideo } from "@/lib/media/types";
import { EASE, MOTION_OK, gsap, revealLines, useGSAP } from "@/lib/motion/gsap";
import { scrollToId } from "@/lib/scroll";

const trustIcons: Record<TrustIcon, typeof Star> = {
  star: Star,
  shield: ShieldCheck,
  award: Award,
  badge: BadgeCheck,
  medal: Medal,
};

/** One copy of the trust badges. The second, aria-hidden copy makes the mobile marquee seamless. */
function TrustList({ hidden = false }: { hidden?: boolean }) {
  return (
    <ul className="trust-copy" aria-hidden={hidden || undefined}>
      {site.hero.trust.map((item) => {
        const Icon = trustIcons[item.icon];
        return (
          <li
            key={item.label}
            className="flex shrink-0 items-center gap-2.5 font-display text-[13px] font-semibold uppercase tracking-[0.12em] whitespace-nowrap text-muted-on-dark"
          >
            <Icon aria-hidden className="size-4 shrink-0" strokeWidth={2} />
            {item.label}
          </li>
        );
      })}
    </ul>
  );
}

export function Hero({ media }: { media: ResolvedVideo }) {
  const section = useRef<HTMLElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [marqueePaused, setMarqueePaused] = useState(false);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        if (heading.current) {
          revealLines(heading.current, { stagger: 0.12, delay: 0.25, duration: 1 });
        }

        const tl = gsap.timeline({ defaults: { ease: EASE.reveal } });
        tl.fromTo(".js-eyebrow", { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.6 }, 0.1)
          .fromTo(
            [".js-sub", ".js-ctas"],
            { autoAlpha: 0, y: 24 },
            { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.1 },
            0.9,
          )
          .fromTo(".js-trust", { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.8 }, 1.1);

        // Only once half the hero has scrolled past: a subtle drift and a fade that never
        // drops below 30% opacity.
        gsap.to(content.current, {
          y: -32,
          opacity: 0.3,
          ease: "none",
          scrollTrigger: {
            trigger: section.current,
            start: "50% top",
            end: "bottom top",
            scrub: true,
          },
        });
      });
      return () => mm.revert();
    },
    { scope: section },
  );

  return (
    <section
      ref={section}
      id="top"
      className="relative isolate min-h-[100svh] overflow-hidden bg-ink text-on-dark"
    >
      <SmartVideo
        media={media}
        preload="auto"
        seamless
        fill
        className="z-0"
        placeholderLabelOffset={{ bottom: 76 }}
      />
      {/* HERO_BRIEF step 5: on desktop a left-weighted shade (about 70% ink at the left edge, gone before the
          house on the right) keeps the headline legible while the house stays bright; phones keep the flat tint
          because the headline spans the full width there. The bottom gradient carries the lower text and trust bar. */}
      <div aria-hidden className="absolute inset-0 z-10 bg-ink/40 lg:hidden" />
      <div aria-hidden className="hero-shade absolute inset-0 z-10 hidden lg:block" />
      <div aria-hidden className="absolute inset-0 z-10 bg-linear-to-t from-ink/85 via-ink/20 to-transparent" />

      <div
        ref={content}
        className="wrap relative z-20 flex min-h-[100svh] flex-col justify-end pb-32 pt-32 lg:pb-44"
      >
        <div className="max-w-[46rem]">
          <Eyebrow className="js-eyebrow js-reveal mb-6 text-on-dark/90">
            <span className="whitespace-nowrap sm:hidden">{site.hero.eyebrowShort}</span>
            <span className="hidden sm:inline">{site.hero.eyebrow}</span>
          </Eyebrow>
          <h1 ref={heading} className="display-xl js-split max-w-[16ch] text-on-dark">
            {site.hero.h1}
          </h1>
          <p className="js-sub js-reveal lede mt-6 text-on-dark/85">{site.hero.sub}</p>
          <div className="js-ctas js-reveal mt-9 flex flex-wrap items-center gap-x-8 gap-y-4">
            <Button onClick={() => scrollToId("estimate")}>{site.hero.ctaPrimary}</Button>
            <a
              href={site.phone.href}
              className="text-[15px] font-medium text-on-dark/85 underline decoration-on-dark/40 underline-offset-4 transition-colors hover:text-on-dark hover:decoration-accent"
            >
              {site.hero.ctaSecondary}
            </a>
          </div>
        </div>
      </div>

      <div className="js-trust js-reveal absolute inset-x-0 bottom-0 z-20 border-t border-white/15 bg-ink/35 backdrop-blur-[2px]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-linear-to-r from-ink/70 to-transparent lg:hidden"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-linear-to-l from-ink/70 to-transparent lg:hidden"
        />
        <div className="trust-scroller py-4 lg:py-5" data-lenis-prevent>
          <div
            className="trust-track"
            data-paused={marqueePaused ? "true" : "false"}
            onPointerDown={() => setMarqueePaused(true)}
            onPointerUp={() => setMarqueePaused(false)}
            onPointerCancel={() => setMarqueePaused(false)}
            onPointerLeave={() => setMarqueePaused(false)}
          >
            <TrustList />
            <TrustList hidden />
          </div>
        </div>
      </div>
    </section>
  );
}
