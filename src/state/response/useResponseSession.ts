"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createResponseController, type ControllerDeps, type ResponseController } from "./controller";
import { initialResponseState } from "./state";

export const EVENT_INTERVAL_MS = 450;

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason);
    });
  });
}

/**
 * Random request id. `crypto.randomUUID` only exists in secure contexts
 * (HTTPS or localhost), so plain-HTTP access over the LAN falls back to
 * `getRandomValues`, which is available everywhere.
 */
export function randomId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const browserDeps: ControllerDeps = {
  async transport(request, signal) {
    const res = await fetch("/api/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal,
    });
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { status: res.status, body };
  },
  sleep,
  createRequestId: () => `req-${randomId()}`,
  eventIntervalMs: EVENT_INTERVAL_MS,
};

export function useResponseSession(deps: ControllerDeps = browserDeps) {
  const [controller] = useState<ResponseController>(() => createResponseController(deps));
  useEffect(() => () => controller.cancelInFlight(), [controller]);
  const state = useSyncExternalStore(controller.subscribe, controller.getState, () => initialResponseState);
  return { state, controller, start: controller.start, retry: controller.retry };
}
