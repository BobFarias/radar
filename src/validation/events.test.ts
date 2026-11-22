import { describe, expect, it } from "vitest";
import { fixtures } from "@/test/fixtures";
import { parseRespondEnvelope, validateEvent } from "./events";

describe("validateEvent", () => {
  it("accepts every event envelope in the supplied fixtures", () => {
    for (const scenario of Object.values(fixtures)) {
      for (const event of scenario.events) {
        expect(validateEvent(event).kind).not.toBe("invalid_event");
      }
    }
  });

  it("validates the block payload inside block events", () => {
    const event = fixtures.malformed_block.events[0];
    const result = validateEvent(event);
    expect(result.kind).toBe("block");
    if (result.kind === "block") expect(result.result.status).toBe("invalid");
  });

  it("passes error events through with retryable flag", () => {
    expect(validateEvent(fixtures.permission_denied.events[0])).toEqual({
      kind: "error",
      code: "forbidden",
      message: "Your account does not have access to this information.",
      retryable: false,
    });
  });

  it.each([
    [{ kind: "telemetry", message: "x" }],
    [{ kind: "status" }],
    [{ kind: "status", message: 1 }],
    [{ kind: "error", code: "x", message: "y" }],
    [{ kind: "error", code: "x", message: "y", retryable: "yes" }],
    [{ kind: "complete", message: "done", html: "<script></script>" }],
    [{ kind: "block" }],
    [null],
    ["status"],
  ])("rejects malformed envelope %j", (raw) => {
    expect(validateEvent(raw).kind).toBe("invalid_event");
  });
});

describe("parseRespondEnvelope", () => {
  it("accepts a well-formed body", () => {
    expect(parseRespondEnvelope({ request_id: "r1", run_id: "RUN", events: [] })).toEqual({
      request_id: "r1",
      run_id: "RUN",
      events: [],
    });
  });

  it.each([[null], [{}], [{ request_id: "r", run_id: "x", events: "no" }], [{ run_id: "x", events: [] }]])(
    "rejects %j",
    (raw) => {
      expect(parseRespondEnvelope(raw)).toBeNull();
    },
  );
});
