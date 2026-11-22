import { describe, expect, it } from "vitest";
import { SCENARIO_IDS } from "@/contracts/api";
import { fixtures } from "@/test/fixtures";
import { POST } from "./route";

function call(body: unknown): Promise<Response> {
  return POST(
    new Request("http://test/api/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

describe("POST /api/respond", () => {
  it("returns the overview fixture with its status, run_id and events", async () => {
    const res = await call({ scenario_id: "overview", request_id: "req-1" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      request_id: "req-1",
      scenario_id: "overview",
      run_id: "RUN-OVERVIEW",
      events: fixtures.overview.events,
    });
  });

  it.each(SCENARIO_IDS)("supports scenario %s with the fixture's HTTP status", async (scenario) => {
    const res = await call({ scenario_id: scenario, request_id: `req-${scenario}` });
    const body = await res.json();
    expect(res.status).toBe(fixtures[scenario].http_status);
    expect(body.run_id).toBe(fixtures[scenario].run_id);
    expect(body.request_id).toBe(`req-${scenario}`);
  });

  it("preserves request identity across repeated runs of the same scenario", async () => {
    const [a, b] = await Promise.all([
      call({ scenario_id: "overview", request_id: "first" }).then((r) => r.json()),
      call({ scenario_id: "overview", request_id: "second" }).then((r) => r.json()),
    ]);
    expect(a.run_id).toBe(b.run_id);
    expect([a.request_id, b.request_id]).toEqual(["first", "second"]);
  });

  it("returns 403 for permission_denied with only the error event", async () => {
    const res = await call({ scenario_id: "permission_denied", request_id: "req-403" });
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.events).toEqual([
      {
        kind: "error",
        code: "forbidden",
        message: "Your account does not have access to this information.",
        retryable: false,
      },
    ]);
    expect(JSON.stringify(body)).not.toMatch(/"kind":"block"/);
  });

  it("returns 404 for an unknown scenario", async () => {
    const res = await call({ scenario_id: "nope", request_id: "req-x" });
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("unknown_scenario");
  });

  it("does not resolve inherited object keys as scenarios", async () => {
    const res = await call({ scenario_id: "constructor", request_id: "req-x" });
    expect(res.status).toBe(404);
  });

  it.each([
    [{ scenario_id: "overview" }],
    [{ scenario_id: "overview", request_id: "" }],
    [{ scenario_id: "overview", request_id: 12 }],
    [{ scenario_id: "overview", request_id: "has spaces" }],
    [{ scenario_id: "overview", request_id: "x".repeat(129) }],
    [{ request_id: "req-1" }],
    [[]],
  ])("rejects invalid request %j with 400", async (body) => {
    const res = await call(body);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("invalid_request");
  });

  it("rejects a non-JSON body with 400", async () => {
    const res = await call("not json");
    expect(res.status).toBe(400);
  });
});
