import { describe, expect, it, vi } from "vitest";
import { getEstimateIntent, requestEstimate, subscribeEstimateIntent } from "./estimate-intent";

describe("estimate intent store", () => {
  it("increments requestId on every request, even for the same service", () => {
    requestEstimate("Roofing");
    const first = getEstimateIntent();
    requestEstimate("Roofing");
    const second = getEstimateIntent();
    expect(first.service).toBe("Roofing");
    expect(second.service).toBe("Roofing");
    expect(second.requestId).toBe(first.requestId + 1);
  });

  it("accepts a request with no service and keeps counting", () => {
    const before = getEstimateIntent().requestId;
    requestEstimate(null);
    expect(getEstimateIntent()).toEqual({ service: null, requestId: before + 1 });
  });

  it("notifies subscribers once per request until unsubscribed", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeEstimateIntent(listener);
    requestEstimate("Siding");
    requestEstimate("Windows");
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    requestEstimate("Insulation");
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
