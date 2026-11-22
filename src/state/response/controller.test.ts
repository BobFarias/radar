import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ScenarioId } from "@/contracts/api";
import { respond } from "@/server/respond";
import { createResponseController, type ControllerDeps } from "./controller";
import type { ResponseState } from "./state";

const INTERVAL = 100;

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new Error("aborted"));
    });
  });
}

/** Transport backed by the real respond handler, serialised like HTTP. */
function makeDeps(overrides: Partial<ControllerDeps> = {}): ControllerDeps {
  let n = 0;
  return {
    transport: async (req) => {
      const result = respond(req);
      return { status: result.status, body: JSON.parse(JSON.stringify(result.body)) };
    },
    sleep,
    createRequestId: () => `req-${++n}`,
    eventIntervalMs: INTERVAL,
    ...overrides,
  };
}

async function runToEnd() {
  await vi.advanceTimersByTimeAsync(10_000);
}

function record(controller: ReturnType<typeof createResponseController>): ResponseState[] {
  const states: ResponseState[] = [];
  controller.subscribe(() => states.push(controller.getState()));
  return states;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("response controller — scenarios", () => {
  it("processes overview events progressively and in order", async () => {
    const c = createResponseController(makeDeps());
    c.start("overview");
    expect(c.getState().phase).toBe("loading");

    await vi.advanceTimersByTimeAsync(INTERVAL);
    expect(c.getState()).toMatchObject({ phase: "streaming", statusMessage: "Preparing opportunity overview" });
    expect(c.getState().entries).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(INTERVAL);
    expect(c.getState().entries.map((e) => e.result.status)).toEqual(["valid"]);

    await vi.advanceTimersByTimeAsync(INTERVAL);
    expect(c.getState().entries).toHaveLength(2);
    expect(c.getState().phase).toBe("streaming");

    await vi.advanceTimersByTimeAsync(INTERVAL);
    const s = c.getState();
    expect(s.phase).toBe("complete");
    expect(s.completionMessage).toBe("Three opportunities available for review.");
    expect(s.runId).toBe("RUN-OVERVIEW");
    expect(s.entries.map((e) => (e.result.status === "valid" ? e.result.block.type : null))).toEqual([
      "opportunity_table",
      "bar_chart",
    ]);
  });

  it("client_focus completes with evidence cards and a review form", async () => {
    const c = createResponseController(makeDeps());
    c.start("client_focus");
    await runToEnd();
    expect(c.getState().phase).toBe("complete");
    expect(c.getState().entries.map((e) => e.result.status === "valid" && e.result.block.type)).toEqual([
      "evidence_cards",
      "review_form",
    ]);
  });

  it("partial_then_error keeps the partial table and reports a retryable incomplete response", async () => {
    const c = createResponseController(makeDeps());
    c.start("partial_then_error");
    await runToEnd();
    const s = c.getState();
    expect(s.phase).toBe("partial");
    expect(s.httpStatus).toBe(200);
    expect(s.entries).toHaveLength(1);
    expect(s.entries[0]!.result.status).toBe("valid");
    expect(s.error).toEqual({
      code: "upstream_timeout",
      message: "The response ended before all evidence was available.",
      retryable: true,
    });
  });

  it("retry issues a new request for the same scenario", async () => {
    const c = createResponseController(makeDeps());
    const first = c.start("partial_then_error");
    await runToEnd();
    const second = c.retry();
    expect(second).not.toBe(first);
    expect(c.getState()).toMatchObject({ requestId: second, scenarioId: "partial_then_error", phase: "loading" });
    await runToEnd();
    expect(c.getState().phase).toBe("partial");
  });

  it("unsupported_block yields a safe fallback entry and a degraded (not successful) outcome", async () => {
    const c = createResponseController(makeDeps());
    c.start("unsupported_block");
    await runToEnd();
    const s = c.getState();
    expect(s.phase).toBe("degraded");
    expect(s.entries[0]!.result).toEqual({ status: "unsupported", id: "future-block", type: "future_component" });
    expect(JSON.stringify(s)).not.toContain("<script>");
  });

  it("malformed_block yields an invalid-data entry; the complete event does not hide it", async () => {
    const c = createResponseController(makeDeps());
    c.start("malformed_block");
    await runToEnd();
    const s = c.getState();
    expect(s.phase).toBe("degraded");
    expect(s.completionMessage).toBe("Count response received.");
    expect(s.entries[0]!.result.status).toBe("invalid");
  });

  it("permission_denied produces a non-retryable denied state with no content", async () => {
    const c = createResponseController(makeDeps());
    c.start("permission_denied");
    await runToEnd();
    expect(c.getState()).toMatchObject({
      phase: "denied",
      httpStatus: 403,
      entries: [],
      error: { code: "forbidden", retryable: false },
    });
  });
});

describe("response controller — stale responses", () => {
  it("an older delayed request cannot overwrite a newer one", async () => {
    const c = createResponseController(makeDeps());
    const older = c.start("overview", { delayMs: 1000 });
    const newer = c.start("client_focus", { delayMs: 100 });

    await runToEnd();
    const s = c.getState();
    expect(s.requestId).toBe(newer);
    expect(s.requestId).not.toBe(older);
    expect(s.scenarioId).toBe("client_focus");
    expect(s.phase).toBe("complete");
    expect(s.discardedResponses).toBe(1);
    expect(s.entries.every((e) => e.result.status === "valid" && e.result.block.id.startsWith("client-"))).toBe(true);
  });

  it("ignores progress and completion messages from a request superseded mid-stream", async () => {
    const c = createResponseController(makeDeps());
    const states = record(c);
    c.start("overview");
    await vi.advanceTimersByTimeAsync(INTERVAL * 2); // status + table from the first request
    // The newer request is still loading while the old stream would continue.
    const newer = c.start("client_focus", { delayMs: INTERVAL * 3 });
    const fromNewer = states.length;
    await runToEnd();

    const after = states.slice(fromNewer);
    expect(after.length).toBeGreaterThan(0);
    for (const s of after) {
      expect(s.requestId).toBe(newer);
      expect(s.statusMessage).not.toBe("Preparing opportunity overview");
      expect(s.completionMessage).not.toBe("Three opportunities available for review.");
      expect(s.entries.every((e) => e.result.status === "valid" && e.result.block.id.startsWith("client-"))).toBe(true);
    }
    expect(c.getState().phase).toBe("complete");
  });

  it("a stale response arriving after a newer one finished is counted and discarded", async () => {
    const c = createResponseController(makeDeps());
    c.start("permission_denied", { delayMs: 500 });
    c.start("overview");
    await vi.advanceTimersByTimeAsync(INTERVAL * 5);
    expect(c.getState().phase).toBe("complete");
    await runToEnd();
    expect(c.getState()).toMatchObject({ scenarioId: "overview", phase: "complete", discardedResponses: 1 });
  });
});

describe("response controller — transport failures", () => {
  it("maps an API error body to a non-retryable error", async () => {
    const c = createResponseController(makeDeps());
    c.start("nope" as ScenarioId);
    await runToEnd();
    expect(c.getState()).toMatchObject({ phase: "error", error: { code: "unknown_scenario", retryable: false } });
  });

  it("maps a network failure to a retryable error", async () => {
    const c = createResponseController(makeDeps({ transport: () => Promise.reject(new Error("offline")) }));
    c.start("overview");
    await runToEnd();
    expect(c.getState()).toMatchObject({ phase: "error", error: { code: "network_error", retryable: true } });
  });

  it("rejects a response whose request_id does not match", async () => {
    const c = createResponseController(
      makeDeps({ transport: async () => ({ status: 200, body: { request_id: "other", run_id: "R", events: [] } }) }),
    );
    c.start("overview");
    await runToEnd();
    expect(c.getState().error?.code).toBe("request_mismatch");
  });

  it("treats an unreadable body as an invalid response", async () => {
    const c = createResponseController(makeDeps({ transport: async () => ({ status: 200, body: "<html>" }) }));
    c.start("overview");
    await runToEnd();
    expect(c.getState()).toMatchObject({ phase: "error", error: { code: "invalid_response" } });
  });

  it("cancelInFlight stops playback without breaking later requests", async () => {
    const c = createResponseController(makeDeps());
    c.start("overview");
    await vi.advanceTimersByTimeAsync(INTERVAL);
    c.cancelInFlight();
    await runToEnd();
    expect(c.getState().phase).toBe("streaming");
    c.start("client_focus");
    await runToEnd();
    expect(c.getState().phase).toBe("complete");
  });
});

describe("randomId", () => {
  it("falls back to getRandomValues when randomUUID is unavailable (plain HTTP on a LAN IP)", async () => {
    const { randomId } = await import("./useResponseSession");
    const original = crypto.randomUUID;
    Object.defineProperty(crypto, "randomUUID", { value: undefined, configurable: true });
    try {
      const a = randomId();
      expect(a).toMatch(/^[0-9a-f]{32}$/);
      expect(randomId()).not.toBe(a);
      expect(`req-${a}`).toMatch(/^[A-Za-z0-9._:-]{1,128}$/);
    } finally {
      Object.defineProperty(crypto, "randomUUID", { value: original, configurable: true });
    }
  });
});
