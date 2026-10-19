import { site } from "@/content/site";

/** Header navigation copy, from the approved nav mockups. Every item is display-only for now. */

export type ServiceIconKey = "house" | "wrench" | "search" | "siding" | "window" | "gutter";

export const nav = {
  services: {
    label: "Services",
    items: [
      { title: "Roof Replacement", description: "Complete tear-off and new roof", icon: "house" },
      { title: "Roof Repair", description: "Leaks, storm damage, missing shingles", icon: "wrench" },
      { title: "Roof Inspections", description: "Know the condition of your roof", icon: "search" },
      { title: "Siding", description: "Vinyl siding installation and repair", icon: "siding" },
      { title: "Windows", description: "Replacement window installation", icon: "window" },
      { title: "Gutters", description: "New gutter installation", icon: "gutter" },
    ],
    prompt: "Not sure what you need?",
    cta: "Get a Free Estimate",
  },
  areas: {
    label: "Service Areas",
    items: ["Clinton Township", "Macomb", "Oakland", "St. Clair"],
  },
  links: ["Specials", "FAQ"],
  menu: {
    open: "Open menu",
    close: "Close menu",
    dialog: "Site menu",
    estimate: "Get a Free Estimate",
    call: `Call ${site.phone.display}`,
  },
} as const satisfies {
  services: {
    label: string;
    items: readonly { title: string; description: string; icon: ServiceIconKey }[];
    prompt: string;
    cta: string;
  };
  areas: { label: string; items: readonly string[] };
  links: readonly string[];
  menu: { open: string; close: string; dialog: string; estimate: string; call: string };
};
