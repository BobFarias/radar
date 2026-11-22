// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SCENARIO_IDS } from "@/contracts/api";
import type { ControllerDeps } from "@/state/response/controller";
import { respond } from "@/server/respond";
import { ScenarioRunner } from "./ScenarioRunner";

const scenarios = SCENARIO_IDS.map((id) => ({ id, prompt: id }));

function deps(): ControllerDeps {
  let n = 0;
  return {
    transport: async (req) => {
      const r = respond(req);
      return { status: r.status, body: JSON.parse(JSON.stringify(r.body)) };
    },
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    createRequestId: () => `req-${++n}`,
    eventIntervalMs: 50,
  };
}

async function flush() {
  await act(() => vi.advanceTimersByTimeAsync(5_000));
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

// fireEvent rather than user-event: user-event's internal timers stall under fake timers.
function runScenario(id: string) {
  render(<ScenarioRunner scenarios={scenarios} deps={deps()} />);
  fireEvent.change(screen.getByLabelText("Demo scenario"), { target: { value: id } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
}

describe("ScenarioRunner", () => {
  it("announces progress, then completion, and renders the overview blocks", async () => {
    runScenario("overview");
    expect(screen.getByRole("status")).toHaveTextContent("Sending request…");
    await act(() => vi.advanceTimersByTimeAsync(50));
    expect(screen.getByRole("status")).toHaveTextContent("Preparing opportunity overview");
    await flush();
    expect(screen.getByText("Three opportunities available for review.")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Client opportunities" })).toBeInTheDocument();
  });

  it("shows a partial response as incomplete with an accessible alert and retry", async () => {
    runScenario("partial_then_error");
    await flush();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Incomplete response");
    expect(alert).toHaveTextContent("The response ended before all evidence was available.");
    expect(screen.getByRole("table", { name: "Available opportunity data" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(screen.getByRole("status")).toHaveTextContent("Sending request…");
    await flush();
    expect(screen.getByRole("alert")).toHaveTextContent("Incomplete response");
  });

  it("does not present the malformed response as successful", async () => {
    runScenario("malformed_block");
    await flush();
    expect(screen.getByText("Response finished with problems")).toBeInTheDocument();
    expect(screen.queryByText("Count response received.")).toBeNull();
  });

  it("shows access denied without retry or content", async () => {
    runScenario("permission_denied");
    await flush();
    expect(screen.getByRole("alert")).toHaveTextContent("Access denied");
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Response" })).toBeNull();
  });
});
