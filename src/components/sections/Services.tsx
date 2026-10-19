"use client";

import { ArrowRight } from "lucide-react";
import { useRef, useState } from "react";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { SmartVideo } from "@/components/ui/SmartVideo";
import { site, type ServiceOption } from "@/content/site";
import { cn } from "@/lib/cn";
import { requestEstimate } from "@/lib/estimate-intent";
import type { ResolvedMedia, ResolvedVideo } from "@/lib/media/types";
import { ScrollTrigger, gsap, useGSAP } from "@/lib/motion/gsap";

type ServicesMedia = Pick<ResolvedMedia, "roofing" | "siding" | "windows" | "gutters">;

const crossfade = "transition-opacity duration-700 ease-[cubic-bezier(0.45,0,0.55,1)] motion-reduce:transition-none";

function EstimateLink({ label, service }: { label: string; service: ServiceOption }) {
  return (
    <button
      type="button"
      onClick={() => requestEstimate(service)}
      className="group inline-flex items-center gap-3 font-display text-[15px] font-semibold tracking-[0.08em] text-on-dark uppercase transition-colors hover:text-accent"
    >
      {label}
      <ArrowRight aria-hidden className="size-4 transition-transform duration-200 group-hover:translate-x-1" strokeWidth={2.25} />
    </button>
  );
}

export function Services({ media }: { media: ServicesMedia }) {
  const section = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const videos: ResolvedVideo[] = [media.roofing, media.siding, media.windows, media.gutters];
  const total = site.services.length;

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(min-width: 1024px)", () => {
        const blocks = gsap.utils.toArray<HTMLElement>(".svc-block");
        blocks.forEach((block, index) => {
          ScrollTrigger.create({
            trigger: block,
            start: "top center",
            end: "bottom center",
            onToggle: (self) => {
              if (self.isActive) setActive(index);
            },
          });
        });
      });
      return () => mm.revert();
    },
    { scope: section },
  );

  return (
    <section ref={section} id="services" className="bg-ink text-on-dark">
      <div className="wrap border-b border-rule-dark py-8 lg:py-10">
        <Eyebrow>{site.servicesSection.eyebrow}</Eyebrow>
      </div>

      <div className="lg:grid lg:grid-cols-2">
        {/* Sticky video panel: desktop only. */}
        <div className="relative hidden lg:block">
          <div className="sticky top-0 h-screen overflow-hidden bg-ink">
            {videos.map((video, index) => (
              <div
                key={video.key}
                aria-hidden={index !== active}
                className={cn("svc-layer absolute inset-0", crossfade, index === active ? "opacity-100" : "opacity-0")}
              >
                <SmartVideo
                  media={video}
                  fill
                  active={index === active}
                  seamless={video.seamless}
                  placeholderLabelOffset={{ bottom: 40, right: 40 }}
                />
              </div>
            ))}
            <div aria-hidden className="absolute inset-0 bg-linear-to-t from-ink/70 via-transparent to-transparent" />
            <div className="absolute bottom-12 left-12 z-10">
              <p className="font-display text-7xl leading-none font-bold tnum" aria-live="polite">
                <span className="text-accent">{site.services[active].index}</span>
                <span className="text-on-dark/40"> / {String(total).padStart(2, "0")}</span>
              </p>
              <div className="mt-5 h-0.5 w-48 bg-white/15">
                <div
                  className={cn("h-full origin-left bg-accent transition-transform duration-700 ease-[cubic-bezier(0.45,0,0.55,1)] motion-reduce:transition-none")}
                  style={{ transform: `scaleX(${(active + 1) / total})` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Service blocks. Below lg each carries its own 4:5 video. */}
        <div>
          {site.services.map((service, index) => (
            <article
              key={service.key}
              id={`svc-${service.key}`}
              className={cn(
                "svc-block border-t border-rule-dark transition-opacity duration-500 first:border-t-0 lg:flex lg:min-h-screen lg:flex-col lg:justify-center",
                index === active ? "lg:opacity-100" : "lg:opacity-35",
              )}
            >
              <div className="px-6 py-16 md:px-10 lg:px-16 lg:py-24">
                <SmartVideo
                  media={videos[index]}
                  seamless={videos[index].seamless}
                  aspect="4 / 5"
                  className="mb-8 lg:hidden"
                  placeholderLabelOffset={{ bottom: 12, right: 12 }}
                />
                <p className="font-display text-lg font-semibold tracking-[0.1em] tnum">
                  <span className={index === active ? "text-accent" : "text-muted-on-dark"}>{service.index}</span>
                </p>
                <h3 className="display-lg mt-4">{service.name}</h3>
                <p className="lede mt-6 max-w-[36rem] text-on-dark/85">{service.body}</p>
                <div className="mt-8">
                  <EstimateLink label={service.cta} service={service.formValue} />
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="wrap border-t border-rule-dark">
        <div className="flex flex-col gap-4 py-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-display text-xl font-semibold tracking-[0.04em] uppercase">
            {site.insulation.label}{" "}
            <span className="font-body text-base font-normal tracking-normal text-muted-on-dark normal-case">
              {site.insulation.body}
            </span>
          </p>
          <EstimateLink label={site.insulation.cta} service={site.insulation.formValue} />
        </div>
      </div>
    </section>
  );
}
