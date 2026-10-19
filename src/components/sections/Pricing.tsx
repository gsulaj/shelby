"use client";

import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { site } from "@/content/site";
import { openChatling } from "@/lib/chatling";

export function Pricing() {
  return (
    <section id="pricing" className="border-t border-rule-light bg-bone text-on-light">
      <div className="wrap py-28 lg:py-40">
        <Eyebrow tone="light">{site.pricingSection.eyebrow}</Eyebrow>
        <h2 className="display-xl mt-8 max-w-[17ch]">{site.offer.headline}</h2>
        <p className="lede mt-6 text-muted-on-light">{site.pricingSection.sub}</p>

        <ul className="mt-14 grid gap-px border border-rule-light bg-rule-light md:grid-cols-3 lg:mt-16">
          {site.pricing.items.map((item) => (
            <li key={item.key} className="bg-bone-raised p-8 lg:p-10">
              <p className="eyebrow text-muted-on-light">{item.name}</p>
              <p className="mt-8 font-display text-4xl leading-none font-bold tracking-[0.02em] tnum lg:text-5xl">{item.range}</p>
              {"unit" in item && item.unit ? <p className="mt-2 text-[15px] text-muted-on-light">{item.unit}</p> : null}
              <p className="mt-5 border-t border-rule-light pt-4 text-[15px] text-on-light">{item.average}</p>
            </li>
          ))}
        </ul>

        <p className="mt-8 max-w-[70ch] text-[13px] leading-relaxed text-muted-on-light">
          {site.pricing.disclaimer} {site.offer.footnote}
        </p>

        <div className="mt-10">
          <Button variant="dark" onClick={openChatling}>
            {site.pricingSection.cta}
          </Button>
        </div>
      </div>
    </section>
  );
}
