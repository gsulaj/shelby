import { EstimateForm } from "@/components/ui/EstimateForm";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { site } from "@/content/site";

export function Estimate() {
  return (
    <section id="estimate" className="blueprint scroll-mt-0 bg-ink text-on-dark">
      <div className="wrap grid gap-14 py-28 lg:grid-cols-12 lg:gap-10 lg:py-40">
        <div className="lg:col-span-5">
          <Eyebrow>{site.estimate.eyebrow}</Eyebrow>
          <h2 className="display-lg mt-8 max-w-[14ch]">{site.estimate.h2}</h2>
          <p className="lede mt-6 text-on-dark/85">{site.estimate.intro}</p>
          <p className="mt-10 text-[15px] text-muted-on-dark">
            {site.estimate.prefer}{" "}
            <a href={site.phone.href} className="font-display text-[17px] font-semibold tracking-[0.06em] text-on-dark uppercase underline decoration-rule-dark underline-offset-4 hover:decoration-accent">
              {site.phone.display}
            </a>{" "}
            · {site.hours.short}.
          </p>
        </div>
        <div className="lg:col-span-7 lg:col-start-6">
          <EstimateForm />
        </div>
      </div>
    </section>
  );
}
