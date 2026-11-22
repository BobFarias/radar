// @vitest-environment jsdom
import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SCENARIO_IDS } from "@/contracts/api";
import { SLOW_RESPONSE_MS } from "@/state/agent/AgentSessionProvider";
import { EVENT_INTERVAL_MS } from "@/state/response/useResponseSession";
import { installApiFetch } from "@/test/apiFetch";
import { fixtures } from "@/test/fixtures";
import { renderWithRadar } from "@/test/render";
import { AgentView } from "./AgentView";

/** Full UI integration: AgentView → real controller → fetch → real /api/respond handler. */

beforeEach(() => {
  vi.useFakeTimers();
  installApiFetch();
});
afterEach(() => vi.useRealTimers());

const tick = (ms = EVENT_INTERVAL_MS) => act(() => vi.advanceTimersByTimeAsync(ms));
const flush = () => tick(20_000);

function send(scenario: string, { slow = false } = {}) {
  fireEvent.change(screen.getByLabelText("Demo prompt"), { target: { value: scenario } });
  const checkbox = screen.getByLabelText("Simulate a slow response");
  if ((checkbox as HTMLInputElement).checked !== slow) fireEvent.click(checkbox);
  fireEvent.click(screen.getByRole("button", { name: "Send prompt" }));
}

const turns = () => screen.getAllByRole("listitem", { name: /^Request:/ });

describe("Agent landing", () => {
  it("offers suggested prompts from the fixtures and every scenario in the demo selector", () => {
    renderWithRadar(<AgentView />);
    expect(screen.getByRole("heading", { level: 1, name: "What would you like to explore?" })).toBeInTheDocument();
    const suggestions = within(screen.getByRole("region", { name: "Suggested prompts" })).getAllByRole("button");
    expect(suggestions.map((b) => b.textContent)).toEqual([fixtures.overview.prompt, fixtures.client_focus.prompt]);
    const options = within(screen.getByLabelText("Demo prompt")).getAllByRole("option");
    expect(options.map((o) => (o as HTMLOptionElement).value)).toEqual([...SCENARIO_IDS]);
    expect(screen.getByText(/Free-text questions aren't supported/)).toBeInTheDocument();
  });
});

describe("Overview journey", () => {
  it("sends the suggested prompt and renders the response progressively from the API", async () => {
    renderWithRadar(<AgentView />);
    fireEvent.click(screen.getByRole("button", { name: fixtures.overview.prompt }));

    const turn = turns()[0]!;
    expect(within(turn).getByText(fixtures.overview.prompt)).toBeInTheDocument();
    expect(within(turn).getByRole("status")).toHaveTextContent("Sending request");

    await tick();
    expect(within(turn).getByRole("status")).toHaveTextContent("Preparing opportunity overview");
    expect(within(turn).queryByRole("table")).toBeNull();

    await tick();
    expect(within(turn).getByRole("table", { name: "Client opportunities" })).toBeInTheDocument();
    expect(within(turn).queryByRole("figure")).toBeNull();

    await tick();
    expect(within(turn).getByRole("figure", { name: "Opportunities by priority" })).toBeInTheDocument();

    await tick();
    expect(within(turn).getByRole("status")).toHaveTextContent("Three opportunities available for review.");
  });

  it("keeps the opportunity selection when the overview is requested again", async () => {
    renderWithRadar(<AgentView />);
    send("overview");
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Discuss cross-border payment data arrangements" }));

    send("overview");
    await flush();
    const latest = turns()[1]!;
    expect(within(latest).getByRole("button", { name: "Discuss cross-border payment data arrangements" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});

describe("Response states", () => {
  it("renders a safe fallback for the unsupported block", async () => {
    renderWithRadar(<AgentView />);
    send("unsupported_block");
    await flush();
    expect(screen.getByText("This part of the answer can't be shown here")).toBeInTheDocument();
    expect(document.querySelector("script")).toBeNull();
    expect((window as unknown as Record<string, unknown>).__assessmentUnsafe).toBeUndefined();
  });

  it("does not present the malformed response as successful", async () => {
    renderWithRadar(<AgentView />);
    send("malformed_block");
    await flush();
    expect(screen.getByText("Response finished with problems")).toBeInTheDocument();
    expect(screen.getByText("This chart couldn't be shown")).toBeInTheDocument();
    expect(screen.queryByText("Count response received.")).toBeNull();
  });

  it("shows access denied without retry or content", async () => {
    renderWithRadar(<AgentView />);
    send("permission_denied");
    await flush();
    expect(screen.getByRole("alert")).toHaveTextContent("Access denied");
    expect(screen.queryByRole("button", { name: /Try again|Retry/ })).toBeNull();
    expect(screen.queryByRole("region", { name: /^Response to:/ })).toBeNull();
  });
});

describe("Unsupported and malformed blocks", () => {
  it("keeps earlier answers, selection and filters, and does not retry on its own", async () => {
    const fetchSpy = vi.mocked(globalThis.fetch);
    renderWithRadar(<AgentView />);
    send("overview");
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Review payment resilience readiness" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search opportunities" }), { target: { value: "payment" } });

    send("unsupported_block");
    await flush();
    const callsAfterAnswer = fetchSpy.mock.calls.length;
    expect(within(turns()[1]!).getByText("This part of the answer can't be shown here")).toBeInTheDocument();
    expect(within(turns()[1]!).getByText(/Your selections and filters haven't changed/)).toBeInTheDocument();

    // The earlier answer and the user's work are untouched.
    const first = turns()[0]!;
    expect(within(first).getByRole("table", { name: "Client opportunities" })).toBeInTheDocument();
    expect(within(first).getByRole("button", { name: "Review payment resilience readiness" })).toHaveAttribute("aria-pressed", "true");
    expect(within(first).getByRole("searchbox", { name: "Search opportunities" })).toHaveValue("payment");

    // No automatic retry and no retry button for a deterministic unsupported answer.
    await flush();
    expect(fetchSpy.mock.calls.length).toBe(callsAfterAnswer);
    expect(turns()).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /Try again|Retry/ })).toBeNull();
  });

  it("moves focus to the prompt picker from the fallback", async () => {
    renderWithRadar(<AgentView />);
    send("malformed_block");
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Choose a supported prompt" }));
    expect(screen.getByLabelText("Demo prompt")).toHaveFocus();
    expect(turns()).toHaveLength(1);
  });

  it("puts the request and scenario ids in the issue report", async () => {
    renderWithRadar(<AgentView />);
    send("unsupported_block");
    await flush();
    const report = screen.getByText(/RADAR issue report/);
    expect(report).toHaveTextContent("Demo scenario: unsupported_block");
    expect(report.textContent).toMatch(/Request id: (?!unknown)\S+/);
  });
});

describe("Per-table filters across the conversation", () => {
  it("filtering one answer's table leaves another answer's table unchanged, also after switching workspace", async () => {
    const { rerender } = renderWithRadar(<AgentView />);
    send("overview");
    await flush();
    send("overview");
    await flush();
    const [first, second] = turns() as [HTMLElement, HTMLElement];

    fireEvent.change(within(first).getByRole("searchbox", { name: "Search opportunities" }), { target: { value: "grid" } });
    fireEvent.click(within(second).getByRole("button", { name: "Filters" }));
    fireEvent.click(within(second).getByRole("radio", { name: "Medium" }));
    fireEvent.click(within(second).getByRole("button", { name: "Discuss cross-border payment data arrangements" }));

    expect(within(first).getByText("Showing 1 of 3")).toBeInTheDocument();
    expect(within(second).getByText("Showing 1 of 3")).toBeInTheDocument();
    expect(within(first).getByRole("cell", { name: "Northstar Renewables" })).toBeInTheDocument();
    expect(within(second).getByRole("searchbox", { name: "Search opportunities" })).toHaveValue("");

    // Leave the Agent workspace and come back: conversation, filters and selection are kept.
    rerender(<p>Opportunities workspace</p>);
    rerender(<AgentView />);
    const [again1, again2] = turns() as [HTMLElement, HTMLElement];
    expect(within(again1).getByRole("searchbox", { name: "Search opportunities" })).toHaveValue("grid");
    expect(within(again2).getByRole("button", { name: "Filters (1 active)" })).toBeInTheDocument();
    expect(within(again2).getByRole("button", { name: "Discuss cross-border payment data arrangements" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("keeps a table's filters through a retry of the same answer", async () => {
    renderWithRadar(<AgentView />);
    send("partial_then_error");
    await flush();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search opportunities" }), { target: { value: "payment" } });
    fireEvent.click(screen.getByRole("button", { name: /^Try again/ }));
    await flush();
    expect(screen.getByRole("searchbox", { name: "Search opportunities" })).toHaveValue("payment");
  });
});

describe("Partial results (partial_then_error)", () => {
  const PARTIAL_TITLE = "Your opportunity summary is partially ready";
  const banner = () => screen.getByRole("region", { name: PARTIAL_TITLE });
  const tryAgain = () => within(banner()).getByRole("button", { name: /Try again|Trying again/ });

  async function partialTurn() {
    renderWithRadar(<AgentView />);
    send("partial_then_error");
    await flush();
    return turns()[0]!;
  }

  it("explains the partial result and marks the response and table as incomplete", async () => {
    const turn = await partialTurn();
    expect(banner()).toHaveTextContent("We found some opportunities, but couldn't finish retrieving the supporting information.");
    expect(banner()).toHaveTextContent("Available results are shown below and remain accessible.");
    expect(banner()).toHaveTextContent("Some opportunities or supporting evidence may be missing.");
    expect(tryAgain()).toHaveTextContent("Try again");
    expect(within(banner()).getByRole("button", { name: "Copy issue report" })).toBeInTheDocument();

    const response = within(turn).getByRole("region", { name: `Incomplete response to: ${fixtures.partial_then_error.prompt}` });
    expect(within(response).getByText("Incomplete results")).toBeInTheDocument();
    expect(within(response).getByText("Incomplete")).toBeInTheDocument();
    expect(within(response).getByText("Showing 1 of 1 available · this list may be incomplete")).toBeInTheDocument();
    // Nothing suggests success or a complete dataset, and nothing is invented.
    expect(screen.queryByText(/Response complete/)).toBeNull();
    expect(within(response).getAllByRole("row")).toHaveLength(2);
  });

  it("keeps the partial table interactive", async () => {
    await partialTurn();
    const select = screen.getByRole("button", { name: "Review payment resilience readiness" });
    fireEvent.click(select);
    expect(select).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    expect(screen.getByRole("group", { name: "Filters" })).toBeInTheDocument();
  });

  it("keeps the previous result, selection and filters visible while retrying, then shows one result", async () => {
    const fetchSpy = vi.mocked(globalThis.fetch);
    const turn = await partialTurn();
    fireEvent.click(screen.getByRole("button", { name: "Review payment resilience readiness" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search opportunities" }), { target: { value: "payment" } });
    const calls = fetchSpy.mock.calls.length;

    tryAgain().focus();
    fireEvent.click(tryAgain());
    expect(fetchSpy.mock.calls.length).toBe(calls + 1);
    expect(turns()).toHaveLength(1);
    // While retrying: same turn, previous table still there, button keeps focus but is unavailable.
    expect(tryAgain()).toHaveTextContent("Trying again…");
    expect(tryAgain()).toHaveAttribute("aria-disabled", "true");
    expect(tryAgain()).toHaveFocus();
    expect(banner()).toHaveTextContent("Your current results stay available while we retry.");
    expect(within(turn).getByRole("table", { name: "Available opportunity data" })).toBeInTheDocument();
    fireEvent.click(tryAgain());
    expect(fetchSpy.mock.calls.length).toBe(calls + 1);

    await flush();
    expect(turns()).toHaveLength(1);
    expect(within(turn).getAllByRole("table")).toHaveLength(1);
    expect(banner()).toHaveTextContent("We tried again (attempt 2), but the supporting information is still unavailable.");
    expect(screen.getByRole("button", { name: "Review payment resilience readiness" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("searchbox", { name: "Search opportunities" })).toHaveValue("payment");
  });

  it("keeps the previous result and says so when the retry itself fails", async () => {
    const turn = await partialTurn();
    vi.mocked(globalThis.fetch).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    fireEvent.click(tryAgain());
    await flush();

    expect(banner()).toHaveTextContent("Trying again didn't work: The request could not be completed.");
    expect(banner()).toHaveTextContent("The results below are from your previous attempt.");
    expect(within(turn).getAllByRole("table")).toHaveLength(1);
    expect(within(turn).getByText("Incomplete results")).toBeInTheDocument();
    expect(tryAgain()).toHaveTextContent("Try again");
  });

  it("keeps the partial result when a newer prompt replaces the retry", async () => {
    const turn = await partialTurn();
    fireEvent.click(tryAgain());
    send("overview");
    await flush();

    expect(turns()).toHaveLength(2);
    expect(within(turn).getByText(/Your retry was replaced by a newer request/)).toBeInTheDocument();
    expect(within(turn).getAllByRole("table")).toHaveLength(1);
    expect(within(turn).queryByRole("button", { name: /Try again/ })).toBeNull();
    expect(within(turns()[1]!).getByRole("table", { name: "Client opportunities" })).toBeInTheDocument();
  });

  it("copies a safe issue report without response content", async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    try {
      await partialTurn();
      await act(async () => fireEvent.click(within(banner()).getByRole("button", { name: "Copy issue report" })));
      const report = writeText.mock.calls[0]![0];
      expect(report).toContain("Issue: partial_response");
      expect(report).toContain("Error code: upstream_timeout");
      expect(report).toContain("Run id: RUN-PARTIAL");
      expect(report).toContain("Demo scenario: partial_then_error");
      expect(report).toContain("Sections shown: 1");
      expect(report).not.toMatch(/Asteria|O001|SRC001|ended before/);
      expect(within(banner()).getByText("Copied. Paste it into your support request.")).toBeInTheDocument();
      expect(banner()).not.toHaveTextContent(/submitted|sent to|expert/i);
    } finally {
      Reflect.deleteProperty(navigator, "clipboard");
    }
  });
});

describe("Stale responses", () => {
  it("a slow earlier request never overwrites a newer one", async () => {
    renderWithRadar(<AgentView />);
    send("overview", { slow: true });
    send("client_focus");
    await tick(SLOW_RESPONSE_MS + EVENT_INTERVAL_MS * 10);

    const [older, newer] = turns();
    expect(within(older!).getByText(/Replaced by a newer request/)).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Client opportunities" })).toBeNull();
    expect(within(newer!).getByRole("region", { name: "Evidence for Asteria Payments" })).toBeInTheDocument();
    expect(within(newer!).getByRole("status")).toHaveTextContent("Briefing prepared");
    expect(screen.getByText(/1 outdated response was ignored/)).toBeInTheDocument();
  });
});
