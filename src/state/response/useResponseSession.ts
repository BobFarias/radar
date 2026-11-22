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
  createRequestId: () => `req-${crypto.randomUUID()}`,
  eventIntervalMs: EVENT_INTERVAL_MS,
};

export function useResponseSession(deps: ControllerDeps = browserDeps) {
  const [controller] = useState<ResponseController>(() => createResponseController(deps));
  useEffect(() => () => controller.cancelInFlight(), [controller]);
  const state = useSyncExternalStore(controller.subscribe, controller.getState, () => initialResponseState);
  return { state, start: controller.start, retry: controller.retry };
}
