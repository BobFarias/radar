import { describe, expect, it } from "vitest";
import type { ValidatedEvent } from "@/contracts/events";
import { fixtureBlock } from "@/test/fixtures";
import { validateBlock } from "@/validation/blocks";
import { initialResponseState, responseReducer, type ResponseAction, type ResponseState } from "./state";

const R = "req-1";

function run(actions: ResponseAction[], from: ResponseState = initialResponseState): ResponseState {
  return actions.reduce(responseReducer, from);
}

const started: ResponseAction = { type: "request_started", requestId: R, scenarioId: "overview" };
const received = (httpStatus = 200): ResponseAction => ({ type: "response_received", requestId: R, httpStatus, runId: "RUN" });
const ev = (event: ValidatedEvent, requestId = R): ResponseAction => ({ type: "event_received", requestId, event });
const block = (raw: unknown) => ev({ kind: "block", result: validateBlock(raw) });
const validTable = () => block(fixtureBlock("overview", "overview-table"));

describe("responseReducer", () => {
  it("ignores actions for a request that is not active", () => {
    const s = run([started, received(), ev({ kind: "status", message: "old" }, "req-0")]);
    expect(s.statusMessage).toBeNull();
  });

  it("ignores events after a terminal event", () => {
    const s = run([started, received(), ev({ kind: "complete", message: "done" }), validTable()]);
    expect(s.phase).toBe("complete");
    expect(s.entries).toHaveLength(0);
  });

  it("is degraded, not complete, when a complete event follows an invalid event envelope", () => {
    const s = run([started, received(), ev({ kind: "invalid_event", errors: ["bad"] }), ev({ kind: "complete", message: "ok" })]);
    expect(s.phase).toBe("degraded");
    expect(s.eventIssues).toEqual(["bad"]);
  });

  it("treats a stream that ends without a terminal event as partial when blocks exist", () => {
    const s = run([started, received(), validTable(), { type: "stream_ended", requestId: R }]);
    expect(s.phase).toBe("partial");
    expect(s.error).toMatchObject({ code: "incomplete_response", retryable: true });
  });

  it("treats a stream that ends without any block or terminal event as an error", () => {
    const s = run([started, received(), { type: "stream_ended", requestId: R }]);
    expect(s.phase).toBe("error");
  });

  it("an error event with only invalid blocks is an error, not partial", () => {
    const s = run([
      started,
      received(),
      block(fixtureBlock("malformed_block", "invalid-chart")),
      ev({ kind: "error", code: "x", message: "y", retryable: true }),
    ]);
    expect(s.phase).toBe("error");
  });

  it("never renders blocks in a 403 response, even if they arrive", () => {
    const s = run([started, received(403), validTable(), ev({ kind: "complete", message: "ok" })]);
    expect(s.phase).toBe("denied");
    expect(s.entries).toEqual([]);
    expect(s.error?.retryable).toBe(false);
  });

  it("keeps the discarded-response counter across new requests", () => {
    const s = run([
      started,
      { type: "stale_response_discarded", requestId: "req-0" },
      { type: "request_started", requestId: "req-2", scenarioId: "overview" },
    ]);
    expect(s.discardedResponses).toBe(1);
    expect(s.requestId).toBe("req-2");
  });

  it("gives duplicate block ids distinct render keys", () => {
    const s = run([started, received(), validTable(), validTable()]);
    expect(new Set(s.entries.map((e) => e.key)).size).toBe(2);
  });
});
