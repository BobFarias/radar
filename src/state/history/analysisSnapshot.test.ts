import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ScenarioId } from "@/contracts/api";
import { respond } from "@/server/respond";
import { createResponseController } from "@/state/response/controller";
import type { ResponseState } from "@/state/response/state";
import { analysisHref, createAnalysisSnapshot, nextReference, parseAnalysisSnapshot, type AnalysisSnapshot } from "./analysisSnapshot";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** Final response state for a fixture scenario, through the real controller and respond handler. */
async function finalState(scenarioId: ScenarioId): Promise<ResponseState> {
  const controller = createResponseController({
    transport: async (req) => {
      const result = respond(req);
      return { status: result.status, body: JSON.parse(JSON.stringify(result.body)) };
    },
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    createRequestId: () => `req-${scenarioId}`,
    eventIntervalMs: 10,
  });
  controller.start(scenarioId);
  await vi.advanceTimersByTimeAsync(5_000);
  return controller.getState();
}

const now = new Date("2026-10-01T09:30:00.000Z");
const build = (state: ResponseState) =>
  createAnalysisSnapshot(state, { id: "an-1", reference: "OP00001", prompt: "Show opportunities", now });

describe("createAnalysisSnapshot", () => {
  it("saves a successful overview with its validated table and chart", async () => {
    const snapshot = build(await finalState("overview"));
    expect(snapshot).toMatchObject({
      version: 2,
      id: "an-1",
      reference: "OP00001",
      requestId: "req-overview",
      scenarioId: "overview",
      runId: expect.any(String),
      prompt: "Show opportunities",
      createdAt: "2026-10-01T09:30:00.000Z",
      status: "complete",
      title: "Client opportunities",
      opportunityCount: 3,
    });
    expect(snapshot!.blocks.map((b) => b.type)).toEqual(["opportunity_table", "bar_chart"]);
  });

  it.each<[ScenarioId, string]>([
    ["malformed_block", "degraded"],
    ["unsupported_block", "degraded"],
    ["permission_denied", "denied"],
  ])("never saves %s (%s)", async (scenario, phase) => {
    const state = await finalState(scenario);
    expect(state.phase).toBe(phase);
    expect(build(state)).toBeNull();
  });

  it("saves a partial answer as unfinished, with only the sections that arrived", async () => {
    const state = await finalState("partial_then_error");
    expect(state.phase).toBe("partial");
    const snapshot = build(state);
    expect(snapshot).toMatchObject({ status: "partial", title: "Available opportunity data", opportunityCount: 1 });
    expect(snapshot!.blocks.map((b) => b.id)).toEqual(["refresh-table"]);
  });

  it("keeps only valid sections of a partial answer and never fills gaps", async () => {
    const state = await finalState("partial_then_error");
    const withBroken = {
      ...state,
      entries: [...state.entries, { key: "9:x", result: { status: "unsupported" as const, id: "x", type: "future_component" } }],
    };
    expect(build(withBroken)!.blocks.map((b) => b.id)).toEqual(["refresh-table"]);
  });

  it("does not save a successful response without an opportunity table (briefing content)", async () => {
    const state = await finalState("client_focus");
    expect(state.phase).toBe("complete");
    expect(build(state)).toBeNull();
  });

  it("does not save protected content even if it were marked complete", async () => {
    const overview = await finalState("overview");
    expect(build({ ...overview, httpStatus: 403 })).toBeNull();
  });
});

describe("parseAnalysisSnapshot", () => {
  let saved: AnalysisSnapshot;
  beforeEach(async () => {
    saved = build(await finalState("overview"))!;
  });
  const roundTrip = (value: unknown) => parseAnalysisSnapshot(JSON.parse(JSON.stringify(value)));

  it("accepts a stored snapshot after a JSON round trip", () => {
    expect(roundTrip(saved)).toEqual(saved);
  });

  it("accepts a stored unfinished snapshot", async () => {
    const partial = build(await finalState("partial_then_error"))!;
    expect(roundTrip(partial)).toEqual(partial);
  });

  it("re-derives display metadata from the blocks instead of trusting storage", () => {
    expect(roundTrip({ ...saved, title: "<b>tampered</b>", opportunityCount: 999 })).toMatchObject({
      title: "Client opportunities",
      opportunityCount: 3,
    });
  });

  it.each([
    ["a tampered block value", (s: AnalysisSnapshot) => ({ ...s, blocks: [{ ...s.blocks[0], rows: "nope" }, s.blocks[1]] })],
    ["an unsupported block", (s: AnalysisSnapshot) => ({ ...s, blocks: [...s.blocks, { id: "x", type: "future_component", payload: { html: "<script>" } }] })],
    ["no opportunity table", (s: AnalysisSnapshot) => ({ ...s, blocks: [s.blocks[1]] })],
    ["no blocks", (s: AnalysisSnapshot) => ({ ...s, blocks: [] })],
    ["an unknown status", (s: AnalysisSnapshot) => ({ ...s, status: "degraded" })],
    ["an unknown version", (s: AnalysisSnapshot) => ({ ...s, version: 1 })],
    ["a malformed reference", (s: AnalysisSnapshot) => ({ ...s, reference: "../agent" })],
    ["a missing reference", (s: AnalysisSnapshot) => ({ ...s, reference: undefined })],
    ["an unknown scenario", (s: AnalysisSnapshot) => ({ ...s, scenarioId: "made_up" })],
    ["an invalid date", (s: AnalysisSnapshot) => ({ ...s, createdAt: "yesterday" })],
    ["a missing id", (s: AnalysisSnapshot) => ({ ...s, id: undefined })],
    ["an oversized prompt", (s: AnalysisSnapshot) => ({ ...s, prompt: "x".repeat(501) })],
  ])("rejects %s", (_, mutate) => {
    expect(roundTrip(mutate(saved))).toBeNull();
  });

  it("rejects values that are not objects", () => {
    expect(parseAnalysisSnapshot(null)).toBeNull();
    expect(parseAnalysisSnapshot("snapshot")).toBeNull();
    expect(parseAnalysisSnapshot([])).toBeNull();
  });
});

describe("references", () => {
  it("numbers analyses after the highest existing reference", () => {
    expect(nextReference([])).toBe("OP00001");
    expect(nextReference([{ reference: "OP00002" }, { reference: "OP00007" }])).toBe("OP00008");
    expect(nextReference([{ reference: "OP99999" }])).toBe("OP100000");
  });

  it("links to the analysis in the Opportunities workspace", () => {
    expect(analysisHref("OP00003")).toBe("/opportunities/OP00003");
  });
});
