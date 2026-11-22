import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

// RTL auto-cleanup needs Vitest globals; register it explicitly instead.
afterEach(async () => {
  if (typeof document !== "undefined") {
    const { cleanup } = await import("@testing-library/react");
    cleanup();
  }
});
