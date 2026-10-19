import { describe, expect, it } from "vitest";
import { SERVICE_OPTIONS, site } from "./site";

describe("site content", () => {
  it("has the exact tel: href from the spec", () => {
    expect(site.phone.display).toBe("833-6-SHELBY");
    expect(site.phone.href).toBe("tel:+18336743529");
  });

  it("uses the rating confirmed on the Google Business Profile", () => {
    expect(site.rating).toEqual({ value: 4.7, count: 195, source: "Google", verified: true });
  });

  it("offers exactly the five form services in spec order", () => {
    expect([...SERVICE_OPTIONS]).toEqual([
      "Roofing",
      "Windows",
      "Siding",
      "Insulation",
      "Gutters & Gutter Protection",
    ]);
  });

  it("maps the four service blocks to form values", () => {
    expect(site.services.map((s) => s.formValue)).toEqual([
      "Roofing",
      "Siding",
      "Windows",
      "Gutters & Gutter Protection",
    ]);
    expect(site.insulation.formValue).toBe("Insulation");
  });

  it("ends every service CTA with Estimate", () => {
    for (const s of site.services) expect(s.cta.endsWith("Estimate")).toBe(true);
    expect(site.insulation.cta.endsWith("Estimate")).toBe(true);
  });
});
