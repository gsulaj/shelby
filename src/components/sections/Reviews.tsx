"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Stars } from "@/components/ui/Stars";
import { type Review, reviews } from "@/content/reviews";
import { site } from "@/content/site";
import { cn } from "@/lib/cn";
import { EASE, MOTION_OK, ScrollTrigger, gsap, useGSAP } from "@/lib/motion/gsap";
import { getLenis } from "@/lib/scroll";

/** Header clearance when a collapsed card is scrolled back into view. */
const HEADER_OFFSET = 96;

/**
 * One review card. Long reviews clamp to six lines with a Read more toggle; the text itself is
 * never cut, only hidden until expanded.
 */
function ReviewCard({ review, id }: { review: Review; id: string }) {
  const card = useRef<HTMLLIElement>(null);
  const text = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [clamps, setClamps] = useState(false);

  // The toggle only appears when the clamped text actually overflows at the current width.
  useLayoutEffect(() => {
    const el = text.current;
    if (!el || open) return;
    const measure = () => setClamps(el.scrollHeight > el.clientHeight + 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    requestAnimationFrame(() => {
      ScrollTrigger.refresh();
      // Collapsing a long card can leave the reader far below it: bring its top back into view.
      const el = card.current;
      if (next || !el || el.getBoundingClientRect().top >= HEADER_OFFSET) return;
      const lenis = getLenis();
      if (lenis) lenis.scrollTo(el, { offset: -HEADER_OFFSET, immediate: true });
      else window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - HEADER_OFFSET });
    });
  };

  return (
    <li ref={card} className="js-card js-reveal flex flex-col gap-5 bg-slate-raised p-8">
      <Stars value={review.rating} size="sm" className="text-on-dark" />
      <div>
        <p
          ref={text}
          id={id}
          className={cn("text-[17px] leading-relaxed whitespace-pre-line text-on-dark/90", !open && "line-clamp-6")}
        >
          {review.text}
        </p>
        {(clamps || open) && (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-controls={id}
            className="group mt-4 inline-flex items-center gap-2 font-display text-[14px] font-semibold tracking-[0.12em] text-on-dark uppercase transition-colors hover:text-accent"
          >
            {open ? "Read less" : "Read more"}
            <ChevronDown
              aria-hidden
              className={cn("size-4 text-accent transition-transform duration-300", open && "rotate-180")}
            />
          </button>
        )}
      </div>
      <p className="mt-auto font-display text-[14px] font-semibold tracking-[0.12em] text-muted-on-dark uppercase">
        {review.name}
        {review.city ? ` · ${review.city}` : ""}
      </p>
    </li>
  );
}

export function Reviews() {
  const section = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.fromTo(
          ".js-card",
          { autoAlpha: 0, y: 24 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.8,
            ease: EASE.reveal,
            stagger: 0.08,
            scrollTrigger: { trigger: ".js-cards", start: "top 80%" },
          },
        );
      });
      return () => mm.revert();
    },
    { scope: section },
  );

  return (
    <section ref={section} id="reviews" className="blueprint bg-slate text-on-dark">
      <div className="wrap py-28 lg:py-40">
        <Eyebrow>{site.reviewsSection.eyebrow}</Eyebrow>

        <div className="mt-8 grid gap-10 lg:grid-cols-12 lg:items-end">
          <h2 className="display-xl max-w-[18ch] lg:col-span-8">{site.reviewsSection.h2}</h2>
          <div className="flex items-end gap-5 lg:col-span-4 lg:justify-self-end">
            <p className="font-display text-7xl leading-[0.85] font-bold tnum lg:text-8xl">{site.rating.value}</p>
            <div className="pb-1">
              <Stars value={site.rating.value} className="text-accent" />
              <p className="mt-2 text-[15px] whitespace-nowrap text-muted-on-dark">
                {site.rating.count} {site.rating.source} Reviews
              </p>
            </div>
          </div>
        </div>

        <ul className="js-cards mt-16 grid gap-px border border-rule-dark bg-rule-dark md:grid-cols-3 lg:mt-20">
          {reviews.map((review, index) => (
            <ReviewCard key={index} id={`review-${index}`} review={review} />
          ))}
        </ul>
      </div>
    </section>
  );
}
