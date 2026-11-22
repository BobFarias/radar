import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ScenarioId } from "@/contracts/api";
import { respond } from "@/server/respond";
import { createResponseController } from "@/state/response/controller";
import type { ResponseState } from "@/state/response/state";
import { nextReference } from "./analysisSnapshot";
import { briefingHref, createBriefingSnapshot, parseBriefingSnapshot, type BriefingSnapshot } from "./briefingSnapshot";

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
  createBriefingSnapshot(state, { id: "br-1", reference: "BR00001", prompt: "Prepare a briefing", now });
const roundTrip = (s: BriefingSnapshot) => parseBriefingSnapshot(JSON.parse(JSON.stringify(s)));

describe("createBriefingSnapshot", () => {
  it("saves the client_focus briefing with its evidence and review form", async () => {
    const snapshot = build(await finalState("client_focus"));
    expect(snapshot).toMatchObject({
      version: 1,
      reference: "BR00001",
      requestId: "req-client_focus",
      scenarioId: "client_focus",
      clientId: "CL001",
      opportunityId: "O001",
      createdAt: now.toISOString(),
    });
    expect(snapshot!.blocks.map((b) => b.type)).toEqual(["evidence_cards", "review_form"]);
  });

  it.each<[ScenarioId]>([["overview"], ["partial_then_error"], ["malformed_block"], ["unsupported_block"], ["permission_denied"]])(
    "does not save %s (no complete, valid review form)",
    async (scenario) => {
      expect(build(await finalState(scenario))).toBeNull();
    },
  );

  it("numbers briefings with their own prefix and links them in Briefing", () => {
    expect(nextReference([], "BR")).toBe("BR00001");
    expect(nextReference([{ reference: "BR00007" }], "BR")).toBe("BR00008");
    expect(briefingHref("BR00002")).toBe("/briefing/BR00002");
  });
});

describe("parseBriefingSnapshot", () => {
  let saved: BriefingSnapshot;
  beforeEach(async () => {
    saved = build(await finalState("client_focus"))!;
  });

  it("accepts a stored snapshot after a JSON round trip", () => {
    expect(roundTrip(saved)).toEqual(saved);
  });

  it("re-derives client and opportunity from the validated form", () => {
    expect(parseBriefingSnapshot({ ...saved, clientId: "CL999", opportunityId: "O999" })).toEqual(saved);
  });

  it.each<[string, (s: BriefingSnapshot) => unknown]>([
    ["a wrong version", (s) => ({ ...s, version: 2 })],
    ["an opportunity reference", (s) => ({ ...s, reference: "OP00001" })],
    ["an invalid block", (s) => ({ ...s, blocks: [{ ...s.blocks[1], subject: 42 }] })],
    ["no review form", (s) => ({ ...s, blocks: s.blocks.filter((b) => b.type !== "review_form") })],
    ["an unknown scenario", (s) => ({ ...s, scenarioId: "nope" })],
    ["a bad date", (s) => ({ ...s, createdAt: "yesterday" })],
    ["not an object", () => "BR00001"],
  ])("rejects %s", (_, tamper) => {
    expect(parseBriefingSnapshot(tamper(saved))).toBeNull();
  });
});
