import Image from "next/image";
import { site } from "@/content/site";

const heading = "eyebrow text-on-dark";
const list = "mt-5 space-y-2 text-[15px] text-muted-on-dark";
const column = "border-rule-dark py-10 max-lg:border-b max-lg:last:border-b-0 lg:px-10 lg:py-14 lg:first:pl-0 lg:last:pr-0";

export function Footer() {
  return (
    <footer className="border-t border-rule-dark bg-ink text-on-dark">
      <div className="wrap">
        <div className="grid lg:grid-cols-4 lg:divide-x lg:divide-rule-dark">
          <div className={column}>
            <Image src="/brand/logo-light.png" alt={site.name} width={116} height={40} className="h-10 w-auto" />
            <p className="mt-6 max-w-[32ch] text-[15px] leading-relaxed text-muted-on-dark">{site.story.short}</p>
            <ul className="mt-6 space-y-2 text-[14px] text-muted-on-dark">
              {site.credentials.map((credential) => (
                <li key={credential}>{credential}</li>
              ))}
            </ul>
          </div>

          <div className={column}>
            <p className={heading}>Contact</p>
            <ul className={list}>
              <li>
                <a href={site.phone.href} className="font-display text-[17px] font-semibold tracking-[0.06em] text-on-dark uppercase hover:text-accent-hover">
                  {site.phone.display}
                </a>
              </li>
              <li>
                <a href={`mailto:${site.email}`} className="hover:text-on-dark">
                  {site.email}
                </a>
              </li>
              <li>{site.address.full}</li>
              <li>{site.hours.display}</li>
            </ul>
          </div>

          <div className={column}>
            <p className={heading}>{site.footer.macombTitle}</p>
            <ul className={list}>
              {site.serviceAreas.macomb.map((city) => (
                <li key={city}>{city}</li>
              ))}
            </ul>
          </div>

          <div className={column}>
            <p className={heading}>{site.footer.oaklandTitle}</p>
            <ul className={list}>
              {site.serviceAreas.oakland.map((city) => (
                <li key={city}>{city}</li>
              ))}
            </ul>
            <p className={`${heading} mt-8`}>{site.footer.otherTitle}</p>
            <ul className={list}>
              {site.serviceAreas.other.map((area) => (
                <li key={area}>{area}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-rule-dark py-6 text-[12px] leading-relaxed text-muted-on-dark lg:flex-row lg:items-end lg:justify-between lg:gap-10">
          <p className="max-w-[80ch]">{site.offer.promoTerms}</p>
          <div className="flex shrink-0 flex-col gap-1 lg:items-end">
            <p>{site.footer.copyright}</p>
            <p className="text-muted-on-dark/70">{site.footer.concept}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
