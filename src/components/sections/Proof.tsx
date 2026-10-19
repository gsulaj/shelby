"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CompareSlider } from "@/components/ui/CompareSlider";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { SmartVideo } from "@/components/ui/SmartVideo";
import { cn } from "@/lib/cn";
import { proofMode, proofMorphSwitchAt } from "@/content/media";
import { site } from "@/content/site";
import { requestEstimate } from "@/lib/estimate-intent";
import type { ResolvedMedia } from "@/lib/media/types";
import { MOTION_OK, gsap, useGSAP } from "@/lib/motion/gsap";

type ProofMedia = Pick<ResolvedMedia, "proofMorph" | "proofBefore" | "proofAfter">;
type Phase = "before" | "after";

/**
 * Which half of the morph is on screen, read from the playing video's clock: "before" until the dissolve's midpoint,
 * "after" from it to the loop. Polls on animation frames only while the frame is in view; with the double-buffered loop
 * the element in front (data-front) is the one on screen. Reduced motion shows the poster (the damaged roof): "before".
 */
function useMorphPhase(frame: React.RefObject<HTMLDivElement | null>, enabled: boolean): Phase {
  const [phase, setPhase] = useState<Phase>("before");
  useEffect(() => {
    const root = frame.current;
    if (!enabled || !root) return;
    let raf = 0;
    const tick = () => {
      const video = root.querySelector<HTMLVideoElement>('video[data-front="true"]') ?? root.querySelector("video");
      if (video) setPhase(video.currentTime >= proofMorphSwitchAt ? "after" : "before");
      raf = requestAnimationFrame(tick);
    };
    const observer = new IntersectionObserver(([entry]) => {
      cancelAnimationFrame(raf);
      if (entry.isIntersecting) raf = requestAnimationFrame(tick);
    });
    observer.observe(root);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [frame, enabled]);
  return phase;
}

export function Proof({ media }: { media: ProofMedia }) {
  const section = useRef<HTMLElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const showVideo = proofMode === "video";
  const phase = useMorphPhase(frame, showVideo && media.proofMorph.available);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.fromTo(
          frame.current,
          { clipPath: "inset(8% 6%)" },
          {
            clipPath: "inset(0% 0%)",
            ease: "none",
            scrollTrigger: { trigger: frame.current, start: "top 85%", end: "top 35%", scrub: true },
          },
        );
      });
      return () => mm.revert();
    },
    { scope: section },
  );

  return (
    <section ref={section} id="proof" className="bg-bone text-on-light">
      <div className="wrap py-28 lg:py-40">
        <Eyebrow tone="light">{site.proof.eyebrow}</Eyebrow>
        <h2 className="display-xl mt-8 max-w-[22ch]">{site.proof.h2}</h2>
        <p className="lede mt-6 text-muted-on-light">{site.proof.sub}</p>

        <div ref={frame} className="relative mt-14 lg:mt-20">
          {showVideo ? (
            <>
              <SmartVideo media={media.proofMorph} seamless={media.proofMorph.seamless} />
              {media.proofMorph.available && (
                // The label is decorative (the heading says what the video shows), so it stays out of the a11y tree.
                <div
                  aria-hidden
                  data-phase={phase}
                  className="proof-phase pointer-events-none absolute top-3 left-3 z-10 grid bg-ink/60 px-3 py-2 sm:top-5 sm:left-5 sm:px-3.5 sm:py-2.5"
                >
                  {(["before", "after"] as const).map((p) => (
                    <span
                      key={p}
                      className={cn(
                        "eyebrow col-start-1 row-start-1 flex items-center gap-3 text-on-dark transition-opacity duration-300 ease-in-out motion-reduce:transition-none",
                        phase === p ? "opacity-100" : "opacity-0",
                      )}
                    >
                      <span className="h-px w-6 shrink-0 bg-accent" />
                      {site.proof.phases[p]}
                    </span>
                  ))}
                </div>
              )}
            </>
          ) : (
            <CompareSlider
              before={media.proofBefore}
              after={media.proofAfter}
              labels={{ before: site.proof.phases.before, after: site.proof.phases.after }}
            />
          )}
        </div>

        <div className="mt-12">
          <Button onClick={() => requestEstimate("Roofing")}>{site.proof.cta}</Button>
        </div>
      </div>
    </section>
  );
}
