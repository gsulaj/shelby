import { useSyncExternalStore } from "react";
import type { ServiceOption } from "@/content/site";
import { scrollToId } from "@/lib/scroll";

export type EstimateIntent = {
  /** Service to preselect in the estimate form, or null for no preference. */
  service: ServiceOption | null;
  /** Increments on every request so repeated clicks for the same service still apply. */
  requestId: number;
};

let state: EstimateIntent = { service: null, requestId: 0 };
const listeners = new Set<() => void>();
const serverSnapshot: EstimateIntent = { service: null, requestId: 0 };

/** Preselects a service in the estimate form and scrolls to it. */
export function requestEstimate(service: ServiceOption | null) {
  state = { service, requestId: state.requestId + 1 };
  listeners.forEach((listener) => listener());
  scrollToId("estimate");
}

export function getEstimateIntent(): EstimateIntent {
  return state;
}

export function subscribeEstimateIntent(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useEstimateIntent(): EstimateIntent {
  return useSyncExternalStore(subscribeEstimateIntent, getEstimateIntent, () => serverSnapshot);
}
