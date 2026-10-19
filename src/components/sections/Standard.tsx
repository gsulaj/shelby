"use client";

import { useRef } from "react";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { site, type StatItem } from "@/content/site";
import { EASE, MOTION_OK, gsap, revealLines, useGSAP } from "@/lib/motion/gsap";

const stats: readonly StatItem[] = site.standard.stats;

export function Standard() {
  const section = useRef<HTMLElement>(null);
  const statement = useRef<HTMLHeadingElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        if (statement.current) {
          revealLines(statement.current, {
            stagger: 0.08,
            scrollTrigger: { trigger: section.current, start: "top 70%" },
          });
        }

        gsap.fromTo(
          ".js-stat",
          { autoAlpha: 0, y: 20 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.7,
            ease: EASE.reveal,
            stagger: 0.1,
            scrollTrigger: { trigger: ".js-stats", start: "top 85%" },
          },
        );

        const counter = section.current?.querySelector<HTMLElement>(".js-count");
        if (counter) {
          const target = Number(counter.dataset.count ?? 0);
          const proxy = { n: 0 };
          gsap.to(proxy, {
            n: target,
            duration: 1.2,
            ease: "power2.out",
            scrollTrigger: { trigger: ".js-stats", start: "top 85%" },
            onUpdate: () => {
              counter.textContent = `${Math.round(proxy.n)}+`;
            },
          });
        }
      });
      return () => mm.revert();
    },
    { scope: section },
  );

  return (
    <section ref={section} id="standard" className="blueprint bg-slate text-on-dark">
      <div className="wrap py-28 lg:py-40">
        <Eyebrow className="mb-10 lg:mb-14">{site.standard.eyebrow}</Eyebrow>

        <div className="grid gap-12 lg:grid-cols-12 lg:gap-8">
          <h2 ref={statement} className="display-lg js-split max-w-[18ch] lg:col-span-7">
            {site.standard.statement}
          </h2>
          <p className="lede text-on-dark/85 lg:col-span-4 lg:col-start-9 lg:self-end">{site.standard.body}</p>
        </div>

        <ul className="js-stats mt-20 grid grid-cols-2 border-y border-rule-dark lg:mt-28 lg:grid-cols-4 lg:divide-x lg:divide-rule-dark">
          {stats.map((stat) => (
            <li
              key={stat.label}
              className="js-stat js-reveal border-rule-dark px-5 py-8 max-lg:odd:border-r max-lg:[&:nth-child(-n+2)]:border-b lg:px-8 lg:py-10 lg:first:pl-0"
            >
              <p className="font-display text-[2rem] leading-none font-bold tracking-[0.02em] uppercase tnum lg:text-[2.5rem]">
                {stat.countUp ? (
                  <span className="js-count" data-count={stat.countUp}>
                    {stat.value}
                  </span>
                ) : (
                  stat.value
                )}
              </p>
              <p className="mt-3 text-[15px] text-muted-on-dark">{stat.label}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
