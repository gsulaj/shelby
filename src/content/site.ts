// Business facts and every line of copy on the site, seeded from BUILD_SPEC.md §0–§3.
// Never invent facts here. Lines marked `// PITCH COPY` are new copy for the owner to approve.
// Headlines are stored in sentence case; the design system uppercases them with CSS.

export type ServiceOption = "Roofing" | "Windows" | "Siding" | "Insulation" | "Gutters & Gutter Protection";

/** Options for the estimate form's "Service Needed" select, in spec order. */
export const SERVICE_OPTIONS: readonly ServiceOption[] = [
  "Roofing",
  "Windows",
  "Siding",
  "Insulation",
  "Gutters & Gutter Protection",
];

export type TrustIcon = "star" | "shield" | "award" | "badge" | "medal";
export type ServiceKey = "roofing" | "siding" | "windows" | "gutters";

export type ServiceBlock = {
  key: ServiceKey;
  index: string;
  name: string;
  body: string;
  cta: string;
  formValue: ServiceOption;
};

export type PriceItem = {
  key: "roof" | "windows" | "siding";
  name: string;
  range: string;
  average: string;
  unit?: string;
};

export type StatItem = { value: string; label: string; countUp?: number };
export type ProcessStep = { title: string; body: string };

type SiteContent = {
  name: string;
  phone: { display: string; href: string };
  email: string;
  address: { street: string; city: string; state: string; zip: string; full: string };
  hours: { display: string; short: string };
  story: { short: string; long: string };
  tagline: string;
  credentials: readonly string[];
  rating: { value: number; count: number; source: string; verified: boolean };
  services: readonly ServiceBlock[];
  insulation: { label: string; body: string; cta: string; formValue: ServiceOption };
  serviceAreas: { macomb: readonly string[]; oakland: readonly string[]; other: readonly string[] };
  pricing: { items: readonly PriceItem[]; disclaimer: string };
  offer: { headline: string; line: string; footnote: string; promoTerms: string };
  hero: {
    eyebrow: string;
    h1: string;
    sub: string;
    ctaPrimary: string;
    ctaSecondary: string;
    trust: readonly { icon: TrustIcon; label: string }[];
    /** Shown below 640px, always on one line. */
    eyebrowShort: string;
  };
  standard: { eyebrow: string; statement: string; body: string; stats: readonly StatItem[] };
  servicesSection: { eyebrow: string };
  proof: {
    eyebrow: string;
    h2: string;
    sub: string;
    cta: string;
    /** The label in the corner of the morph video: the storm-damaged roof, then the new one. */
    phases: { before: string; after: string };
  };
  reviewsSection: { eyebrow: string; h2: string };
  process: { eyebrow: string; h2: string; steps: readonly ProcessStep[] };
  pricingSection: { eyebrow: string; sub: string; cta: string };
  estimate: {
    eyebrow: string;
    h2: string;
    intro: string;
    prefer: string;
    submit: string;
    submitting: string;
    successTitle: string;
    successBody: string;
  };
  footer: {
    macombTitle: string;
    oaklandTitle: string;
    otherTitle: string;
    copyright: string;
    concept: string;
  };
};

const rating = { value: 4.7, count: 195, source: "Google", verified: true }; // Confirmed on Google Business Profile 2026-10-18

export const site = {
  name: "Shelby Construction Services",
  phone: { display: "833-6-SHELBY", href: "tel:+18336743529" },
  email: "info@shelbyconstructionservices.com",
  address: {
    street: "33483 Harper Ave",
    city: "Clinton Twp",
    state: "MI",
    zip: "48035",
    full: "33483 Harper Ave, Clinton Twp, MI 48035",
  },
  hours: { display: "Mon–Sun, 7am–9pm", short: "7am–9pm, 7 days" },
  story: {
    short: "Family-owned in Clinton Township. Named after the owner's daughter.",
    long: "Family-owned, based in Clinton Township, and named after the owner's daughter, Shelby. Serving Macomb County homeowners for 6+ years. Fully licensed and insured.",
  },
  tagline: "We Make Your Neighbors Jealous",
  credentials: [
    "CertainTeed ShingleMaster™ Contractor",
    "Mastic Elite Contractor",
    "Alside Certified Window Installer",
    "BBB Accredited Business",
    "BBB Torch Awards Finalist for Ethics",
    "Licensed & Insured Michigan Contractor",
  ],
  rating,

  services: [
    {
      key: "roofing",
      index: "01",
      name: "Roofing",
      body: "Full roof replacement and new installs with CertainTeed systems engineered for Michigan snow loads, ice dams, and high winds. Storm damage? We handle your insurance claim from inspection to final shingle.",
      cta: "Get a Roofing Estimate",
      formValue: "Roofing",
    },
    {
      key: "siding",
      index: "02",
      name: "Siding",
      body: "Vinyl, insulated vinyl, and fiber cement siding, including Mastic Quest™ and Carvedwood® 44, installed by a Mastic Elite Contractor. Trim, soffit, and fascia finished to match.",
      cta: "Get a Siding Estimate",
      formValue: "Siding",
    },
    {
      key: "windows",
      index: "03",
      name: "Windows",
      body: "Energy-efficient replacement windows from Alside, CertainTeed, and Pella, including triple-pane options. Full-frame or insert installs that cut drafts and energy bills.",
      cta: "Get a Window Estimate",
      formValue: "Windows",
    },
    {
      key: "gutters",
      index: "04",
      name: "Gutters",
      body: "Seamless gutters and gutter guards sized to your roofline, so water goes exactly where it should.",
      cta: "Get a Gutter Estimate",
      formValue: "Gutters & Gutter Protection",
    },
  ],
  insulation: {
    label: "Also: attic insulation.",
    body: "Keep the heat you're paying for.",
    cta: "Get an Insulation Estimate",
    formValue: "Insulation",
  },

  serviceAreas: {
    macomb: [
      "Clinton Township",
      "Sterling Heights",
      "Shelby Township",
      "Macomb Township",
      "Harrison Township",
      "New Baltimore",
      "St. Clair Shores",
      "Warren",
      "Roseville",
    ],
    oakland: ["Troy", "Rochester Hills", "Bloomfield Hills", "Royal Oak", "Novi", "Farmington Hills"],
    other: ["St. Clair County", "Grosse Pointe"],
  },

  pricing: {
    items: [
      { key: "roof", name: "Roof replacement", range: "$5,800 – $13,500", average: "avg. ~$9,500" },
      { key: "windows", name: "Window replacement", range: "$550 – $1,100", average: "avg. ~$750", unit: "per window" },
      { key: "siding", name: "Siding replacement", range: "$8,000 – $30,000", average: "avg. $15,000 – $17,000" },
    ],
    disclaimer:
      "Typical Metro Detroit ranges. Final pricing depends on material grade, tear-off requirements, and local permits.",
  },

  offer: {
    headline: "$0 down. Low monthly payments.",
    line: "$0 Down + Low Monthly Payments on all Michigan home improvement projects",
    footnote: "Financing subject to credit approval. Terms vary by lender.",
    promoTerms:
      "Offers are limited to one per customer and cannot be combined with any other discounts, promotions, or coupons. Offers are valid on new estimates only; previous orders and signed contracts are excluded. All work is subject to inspection.",
  },

  hero: {
    // Non-breaking spaces before each separator so no wrapped line ever starts with "·".
    eyebrow: "Clinton Township\u00A0· Macomb\u00A0· Oakland\u00A0· St.\u00A0Clair",
    eyebrowShort: "Macomb\u00A0· Oakland\u00A0· St.\u00A0Clair",
    h1: "Expert exterior remodeling in Macomb County.",
    sub: "Roofing, siding, windows, and gutters, built to The Shelby Standard.",
    ctaPrimary: "Get a Free Estimate",
    ctaSecondary: "or call 833-6-SHELBY",
    trust: [
      { icon: "star", label: `${rating.value} · ${rating.count} ${rating.source} Reviews` },
      { icon: "shield", label: "CertainTeed ShingleMaster™" },
      { icon: "award", label: "Mastic Elite Contractor" },
      { icon: "badge", label: "Alside Certified" },
      { icon: "medal", label: "BBB Torch Awards Finalist" },
    ],
  },

  standard: {
    eyebrow: "The Shelby Standard",
    statement: "When your daughter's name is on every job, you make sure the work is done right.",
    body: "Shelby Construction Services is a family-owned contractor in Clinton Township, named after the owner's daughter. Every roof, wall, and window we touch has to meet a standard worthy of our own home, and we stand behind every installation.",
    stats: [
      { value: "6+", label: "Years serving Macomb County", countUp: 6 },
      { value: "Family-Owned", label: "in Clinton Township" },
      { value: "Licensed & Insured", label: "Michigan contractor" },
      { value: "BBB Torch Awards", label: "Finalist for Ethics" },
    ],
  },

  servicesSection: { eyebrow: "What we build" },

  proof: {
    eyebrow: "Storm damage & insurance claims",
    h2: "From storm\u2011damaged to The Shelby Standard.", // non-breaking hyphen keeps the compound on one line
    sub: "Hail, wind, and Michigan winters take a toll. We inspect your roof, show you exactly what we find, and work with your insurance company to rebuild it right.", // PITCH COPY
    cta: "Book a Free Storm Inspection",
    phases: { before: "Before", after: "After" },
  },

  reviewsSection: { eyebrow: "Reviews", h2: "We make your neighbors jealous." },

  process: {
    // PITCH COPY (whole section)
    eyebrow: "The process",
    h2: "Four steps. No surprises.",
    steps: [
      { title: "Free Inspection", body: "We inspect your roof, siding, or windows and show you exactly what we find." },
      { title: "Clear Estimate", body: "A straightforward quote with no pressure and no surprises." },
      { title: "Insurance Handled", body: "Storm damage? We work with your insurance company so you don't have to." },
      { title: "Install & Walkthrough", body: "Certified crews install, clean up, and walk the finished job with you." },
    ],
  },

  pricingSection: {
    eyebrow: "Financing & pricing",
    sub: "On all Michigan home improvement projects. Here's what homeowners typically invest; no hiding numbers until the end.",
    cta: "Check Financing Options",
  },

  estimate: {
    eyebrow: "Free estimate",
    h2: "Let's look at your project.",
    intro: "Tell us what you need and a Shelby project specialist will reach out to schedule your free inspection.", // PITCH COPY
    prefer: "Prefer to talk?",
    submit: "Request My Free Estimate",
    submitting: "Sending…",
    successTitle: "Request received.",
    successBody: "A Shelby project specialist will contact you shortly to schedule your free inspection.",
  },

  footer: {
    macombTitle: "Macomb County",
    oaklandTitle: "Oakland County",
    otherTitle: "Also serving",
    copyright: "© 2026 Shelby Construction Services",
    concept: "Concept by GSX Solutions",
  },
} as const satisfies SiteContent;
