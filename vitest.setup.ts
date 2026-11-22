import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

if (typeof window !== "undefined" && !("ResizeObserver" in window)) {
  // jsdom has no ResizeObserver; Recharts' ResponsiveContainer needs one.
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.assign(globalThis, { ResizeObserver: ResizeObserverStub });
}

// RTL auto-cleanup needs Vitest globals; register it explicitly instead.
afterEach(async () => {
  if (typeof document !== "undefined") {
    const { cleanup } = await import("@testing-library/react");
    cleanup();
  }
  // Saved history lives in localStorage; never let it leak between tests.
  if (typeof window !== "undefined") window.localStorage.clear();
});
