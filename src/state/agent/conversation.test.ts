import { describe, expect, it } from "vitest";
import { initialResponseState, type ResponseState } from "@/state/response/state";
import { fixtureBlock } from "@/test/fixtures";
import { validateBlock } from "@/validation/blocks";
import { conversationReducer, initialConversationState, turnView, type ConversationState, type Turn } from "./conversation";

const turn = (...attempts: string[]): Turn => ({ requestId: attempts[0]!, attempts, scenarioId: "overview", prompt: "p" });
const entries = [{ key: "0:refresh-table", result: validateBlock(fixtureBlock("partial_then_error", "refresh-table")) }];
const snap = (requestId: string, phase: ResponseState["phase"], withBlocks = false): ResponseState => ({
  ...initialResponseState,
  requestId,
  phase,
  entries: withBlocks ? entries : [],
});
const conv = (t: Turn, ...snaps: ResponseState[]): ConversationState => ({
  turns: [t],
  snapshots: Object.fromEntries(snaps.map((s) => [s.requestId, s])),
});

describe("conversationReducer", () => {
  it("adds turns in order and records snapshots per request", () => {
    let s = conversationReducer(initialConversationState, { type: "turn_added", turn: turn("a") });
    s = conversationReducer(s, { type: "snapshot_recorded", state: snap("a", "streaming") });
    s = conversationReducer(s, { type: "turn_added", turn: turn("b") });
    expect(s.turns.map((t) => t.requestId)).toEqual(["a", "b"]);
    expect(s.snapshots.a?.phase).toBe("streaming");
  });

  it("adds a retry as another attempt on the same turn, not a new turn", () => {
    let s = conversationReducer(initialConversationState, { type: "turn_added", turn: turn("a") });
    s = conversationReducer(s, { type: "turn_added", turn: turn("b") });
    s = conversationReducer(s, { type: "attempt_added", previousRequestId: "b", requestId: "c" });
    expect(s.turns).toHaveLength(2);
    expect(s.turns[1]!.attempts).toEqual(["b", "c"]);
    expect(s.turns[0]!.attempts).toEqual(["a"]);
  });

  it("ignores an attempt for a request that is not the latest of any turn", () => {
    const s = conversationReducer(initialConversationState, { type: "turn_added", turn: turn("a", "b") });
    expect(conversationReducer(s, { type: "attempt_added", previousRequestId: "a", requestId: "c" })).toBe(s);
  });

  it("ignores snapshots without a request id", () => {
    expect(conversationReducer(initialConversationState, { type: "snapshot_recorded", state: initialResponseState })).toBe(
      initialConversationState,
    );
  });
});

describe("turnView", () => {
  it("shows the active turn's live state", () => {
    const v = turnView(turn("a"), conv(turn("a"), snap("a", "streaming")), "a");
    expect(v).toMatchObject({ shown: snap("a", "streaming"), retrying: false, superseded: false, attempt: 1 });
  });

  it("keeps a finished older turn visible and marks an unfinished one as superseded", () => {
    expect(turnView(turn("a"), conv(turn("a"), snap("a", "complete")), "b").superseded).toBe(false);
    expect(turnView(turn("a"), conv(turn("a"), snap("a", "streaming")), "b").superseded).toBe(true);
    expect(turnView(turn("a"), { turns: [], snapshots: {} }, "b").superseded).toBe(true);
  });

  it("keeps the previous partial result on screen while a retry runs", () => {
    const t = turn("a", "b");
    const v = turnView(t, conv(t, snap("a", "partial", true), snap("b", "streaming")), "b");
    expect(v.retrying).toBe(true);
    expect(v.shown?.requestId).toBe("a");
    expect(v.attempt).toBe(2);
  });

  it("shows the latest partial result once the retry settles, without stacking the earlier one", () => {
    const t = turn("a", "b");
    const v = turnView(t, conv(t, snap("a", "partial", true), snap("b", "partial", true)), "b");
    expect(v).toMatchObject({ retrying: false, retryFailed: false });
    expect(v.shown?.requestId).toBe("b");
  });

  it("falls back to the previous result when the retry fails with no content", () => {
    const t = turn("a", "b");
    const v = turnView(t, conv(t, snap("a", "partial", true), snap("b", "error")), "b");
    expect(v.retryFailed).toBe(true);
    expect(v.shown?.requestId).toBe("a");
    expect(v.latest?.phase).toBe("error");
  });

  it("keeps the previous result when the retry is superseded by a newer request", () => {
    const t = turn("a", "b");
    const v = turnView(t, conv(t, snap("a", "partial", true), snap("b", "streaming")), "z");
    expect(v.superseded).toBe(true);
    expect(v.retrying).toBe(false);
    expect(v.shown?.requestId).toBe("a");
  });
});
