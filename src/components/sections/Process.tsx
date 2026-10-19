"use client";

import { useRef } from "react";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { site } from "@/content/site";
import { EASE, MOTION_OK, gsap, useGSAP } from "@/lib/motion/gsap";

export function Process() {
  const section = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.fromTo(
          ".js-line",
          { scaleX: 0 },
          { scaleX: 1, ease: "none", scrollTrigger: { trigger: ".js-steps", start: "top 75%", end: "top 35%", scrub: true } },
        );
        gsap.fromTo(
          ".js-step",
          { autoAlpha: 0, y: 24 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.8,
            ease: EASE.reveal,
            stagger: 0.12,
            scrollTrigger: { trigger: ".js-steps", start: "top 70%" },
          },
        );
      });
      return () => mm.revert();
    },
    { scope: section },
  );

  return (
    <section ref={section} id="process" className="bg-bone text-on-light">
      <div className="wrap py-28 lg:py-40">
        <Eyebrow tone="light">{site.process.eyebrow}</Eyebrow>
        <h2 className="display-lg mt-8">{site.process.h2}</h2>

        <div className="js-steps mt-16 lg:mt-20">
          <div className="js-line js-reveal-line h-px w-full origin-left bg-accent" />
          <ol className="grid md:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-rule-light">
            {site.process.steps.map((step, index) => (
              <li
                key={step.title}
                className="js-step js-reveal border-rule-light py-10 max-lg:border-b max-lg:last:border-b-0 md:max-lg:odd:border-r md:max-lg:odd:pr-8 md:max-lg:even:pl-8 lg:px-8 lg:py-12 lg:first:pl-0 lg:last:pr-0"
              >
                <p className="font-display text-5xl leading-none font-bold text-muted-on-light/50 tnum">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="display-md mt-8">{step.title}</h3>
                <p className="mt-4 text-[17px] leading-relaxed text-muted-on-light">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
