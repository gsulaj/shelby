import { describe, expect, it } from "vitest";
import { formatUSPhone, isValidUSPhone, normalizeUSDigits } from "./phone";

describe("normalizeUSDigits", () => {
  it("strips punctuation and a leading country code", () => {
    expect(normalizeUSDigits("+1 (586) 555-0123")).toBe("5865550123");
    expect(normalizeUSDigits("586.555.0123")).toBe("5865550123");
    expect(normalizeUSDigits("15865550123")).toBe("5865550123");
  });

  it("keeps extra digits so validation can reject them", () => {
    expect(normalizeUSDigits("25865550123")).toBe("25865550123");
  });
});

describe("formatUSPhone", () => {
  it("formats a full number", () => {
    expect(formatUSPhone("5865550123")).toBe("(586) 555-0123");
    expect(formatUSPhone("+1 586-555-0123")).toBe("(586) 555-0123");
  });

  it("formats progressively while typing", () => {
    expect(formatUSPhone("5")).toBe("(5");
    expect(formatUSPhone("586")).toBe("(586");
    expect(formatUSPhone("5865")).toBe("(586) 5");
    expect(formatUSPhone("586555")).toBe("(586) 555");
    expect(formatUSPhone("58655501")).toBe("(586) 555-01");
  });

  it("leaves more than ten digits unformatted so validation can reject them", () => {
    expect(formatUSPhone("586555012345")).toBe("586555012345");
    expect(formatUSPhone("25865550123")).toBe("25865550123");
    expect(formatUSPhone("abc")).toBe("");
  });
});

describe("isValidUSPhone", () => {
  it("accepts ten digits in any punctuation", () => {
    expect(isValidUSPhone("(586) 555-0123")).toBe(true);
    expect(isValidUSPhone("+1 586-555-0123")).toBe(true);
    expect(isValidUSPhone("586.555.0123")).toBe(true);
  });

  it("rejects nine digits, eleven digits without a leading 1, and bad area codes", () => {
    expect(isValidUSPhone("586555012")).toBe(false);
    expect(isValidUSPhone("25865550123")).toBe(false);
    expect(isValidUSPhone("0865550123")).toBe(false);
    expect(isValidUSPhone("1865550123")).toBe(false);
    expect(isValidUSPhone("")).toBe(false);
  });
});
