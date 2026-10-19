import { describe, expect, it } from "vitest";
import { formatUSPhone } from "./phone";
import { validateEstimate, type EstimateValues } from "./validate";

const valid: EstimateValues = {
  name: "Pat Jones",
  city: "Warren",
  email: "pat@example.com",
  phone: "(586) 555-0123",
  service: "Roofing",
  message: "",
};

describe("validateEstimate", () => {
  it("returns no errors for a valid record", () => {
    expect(validateEstimate(valid)).toEqual({});
  });

  it("requires name, city, email, phone, and service with the spec messages", () => {
    const errors = validateEstimate({ name: "", city: "  ", email: "", phone: "", service: "", message: "" });
    expect(Object.keys(errors).sort()).toEqual(["city", "email", "name", "phone", "service"]);
    expect(errors.name).toBe("Please enter your name.");
    expect(errors.city).toBe("Please enter your city.");
    expect(errors.email).toBe("Please enter a valid email address.");
    expect(errors.phone).toBe("Please enter a 10-digit phone number.");
    expect(errors.service).toBe("Please choose a service.");
  });

  it("rejects a malformed email", () => {
    expect(validateEstimate({ ...valid, email: "pat@example" }).email).toBe("Please enter a valid email address.");
    expect(validateEstimate({ ...valid, email: "pat example.com" }).email).toBe("Please enter a valid email address.");
  });

  it("rejects an eleven-digit number that does not start with 1, even after formatting", () => {
    const pasted = formatUSPhone("25865550123");
    expect(validateEstimate({ ...valid, phone: pasted }).phone).toBe("Please enter a 10-digit phone number.");
  });

  it("rejects a short phone and accepts a pasted one with a country code", () => {
    expect(validateEstimate({ ...valid, phone: "586-555" }).phone).toBe("Please enter a 10-digit phone number.");
    expect(validateEstimate({ ...valid, phone: "+1 (586) 555-0123" })).toEqual({});
  });

  it("never flags the optional message", () => {
    expect(validateEstimate({ ...valid, message: "" })).toEqual({});
    expect(validateEstimate({ ...valid, message: "Hail damage on the north side." })).toEqual({});
  });
});
