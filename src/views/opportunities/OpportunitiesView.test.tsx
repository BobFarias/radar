// @vitest-environment jsdom
import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ScenarioId } from "@/contracts/api";
import { OPPORTUNITY_HISTORY_KEY } from "@/state/history/analysisSnapshot";
import { installApiFetch } from "@/test/apiFetch";
import { fixtures } from "@/test/fixtures";
import { renderWithRadar } from "@/test/render";
import { AgentView } from "@/views/agent/AgentView";
import { AnalysisDetailView } from "./AnalysisDetailView";
import { OpportunitiesView } from "./OpportunitiesView";

/** Agent → real controller → real /api handlers → history in jsdom localStorage. */

beforeEach(() => {
  vi.useFakeTimers();
  installApiFetch();
});
afterEach(() => vi.useRealTimers());

const flush = () => act(() => vi.advanceTimersByTimeAsync(20_000));
const stored = () => JSON.parse(window.localStorage.getItem(OPPORTUNITY_HISTORY_KEY) ?? "[]") as Array<Record<string, unknown>>;

function send(scenario: ScenarioId) {
  fireEvent.change(screen.getByLabelText("Demo prompt"), { target: { value: scenario } });
  fireEvent.click(screen.getByRole("button", { name: "Send prompt" }));
}

async function runInAgent(...scenarios: ScenarioId[]) {
  const view = renderWithRadar(<AgentView />);
  for (const scenario of scenarios) {
    send(scenario);
    await flush();
  }
  return view;
}

const rows = () => within(screen.getByRole("region", { name: /^Showing|^No analyses/ })).getAllByRole("link");
const detail = () => screen.getByRole("article", { name: /^Client opportunities — OP\d+/ });
const search = () => within(detail()).getByRole("searchbox", { name: "Search opportunities" });

describe("Agent table footer", () => {
  it("shows the saved reference, creation time and a link to the analysis", async () => {
    await runInAgent("overview");
    const footer = screen.getByRole("heading", { name: "Client opportunities" }).closest("footer")!;
    expect(footer).toHaveTextContent(/Client opportunities — OP00001 · \d{1,2} \w{3} \d{4}, \d{2}:\d{2}/);
    expect(footer.querySelector("time")).toHaveAttribute("datetime", stored()[0]!.createdAt as string);
    expect(within(footer).getByRole("link", { name: "Open OP00001 in Opportunities" })).toHaveAttribute("href", "/opportunities/OP00001");
  });

  it("numbers each run separately", async () => {
    await runInAgent("overview", "overview");
    const links = screen.getAllByRole("link", { name: /^Open OP\d+ in Opportunities$/ }).map((l) => l.getAttribute("href"));
    expect(links).toEqual(["/opportunities/OP00001", "/opportunities/OP00002"]);
  });

  it("gives an unfinished (partial) answer a reference and link too, still marked incomplete", async () => {
    await runInAgent("partial_then_error");
    const footer = screen.getByRole("heading", { name: "Available opportunity data" }).closest("footer")!;
    expect(footer).toHaveTextContent("OP00001");
    expect(footer).toHaveTextContent("Incomplete");
    expect(within(footer).getByRole("link", { name: "Open OP00001 in Opportunities" })).toHaveAttribute("href", "/opportunities/OP00001");
  });
});

describe("Opportunities list", () => {
  it("shows an empty state with a way to Agent when no analyses exist", () => {
    renderWithRadar(<OpportunitiesView />);
    expect(screen.getByRole("heading", { level: 1, name: "Opportunities" })).toBeInTheDocument();
    expect(screen.getByText("No saved analyses yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Agent" })).toHaveAttribute("href", "/agent");
  });

  it("lists each successful run as a distinct analysis, newest first", async () => {
    const { rerender } = await runInAgent("overview", "overview");
    rerender(<OpportunitiesView />);
    expect(screen.getByRole("heading", { name: "Showing 1–2 of 2 analyses" })).toBeInTheDocument();
    expect(rows().map((r) => r.getAttribute("href"))).toEqual(["/opportunities/OP00002", "/opportunities/OP00001"]);
    expect(rows()[0]).toHaveTextContent("Client opportunities — OP00002");
    expect(rows()[0]).toHaveTextContent("3 opportunities");
    expect(rows()[0]!.querySelector("time")).toHaveAttribute("datetime", expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/));
    // The smile icon explains who created the analysis (tooltip on hover, text for screen readers).
    expect(within(rows()[0]!).getByText("Created by the Agent")).toHaveAttribute("aria-hidden", "true");
    expect(rows()[0]).toHaveAccessibleName(expect.stringContaining("Created by the Agent,"));
  });

  it("filters by period and sorts, keeping the choice when coming back", async () => {
    const { rerender } = await runInAgent("overview", "overview");
    rerender(<OpportunitiesView />);
    fireEvent.click(screen.getByRole("button", { name: "Filter analyses" }));
    fireEvent.click(screen.getByRole("radio", { name: "Oldest first" }));
    expect(rows().map((r) => r.getAttribute("href"))).toEqual(["/opportunities/OP00001", "/opportunities/OP00002"]);
    fireEvent.click(screen.getByRole("radio", { name: "Today" }));
    expect(rows()).toHaveLength(2);

    rerender(<AnalysisDetailView reference="OP00001" />);
    rerender(<OpportunitiesView />);
    expect(screen.getByRole("button", { name: "Filter analyses (1 active)" })).toBeInTheDocument();
    expect(rows()[0]).toHaveAttribute("href", "/opportunities/OP00001");
  });

  it("separates completed and unfinished analyses with status filters", async () => {
    const { rerender } = await runInAgent("overview", "partial_then_error");
    rerender(<OpportunitiesView />);
    const status = screen.getByRole("group", { name: "Analysis status" });
    expect(within(status).getByRole("button", { name: "All 2" })).toHaveAttribute("aria-pressed", "true");
    expect(within(status).getByRole("button", { name: "Completed 1" })).toBeInTheDocument();
    expect(rows()[0]).toHaveTextContent("Available opportunity data — OP00002");
    expect(rows()[0]).toHaveTextContent("Unfinished");
    expect(rows()[0]).toHaveTextContent("1 opportunity available");
    expect(rows()[1]).not.toHaveTextContent("Unfinished");

    fireEvent.click(within(status).getByRole("button", { name: "Unfinished 1" }));
    expect(within(status).getByRole("button", { name: "Unfinished 1" })).toHaveAttribute("aria-pressed", "true");
    expect(rows().map((r) => r.getAttribute("href"))).toEqual(["/opportunities/OP00002"]);
    fireEvent.click(within(status).getByRole("button", { name: "Completed 1" }));
    expect(rows().map((r) => r.getAttribute("href"))).toEqual(["/opportunities/OP00001"]);
  });

  it("paginates more than ten analyses", async () => {
    const { rerender } = await runInAgent(...Array<ScenarioId>(12).fill("overview"));
    rerender(<OpportunitiesView />);
    expect(rows()).toHaveLength(10);
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByRole("heading", { name: "Showing 11–12 of 12 analyses" })).toBeInTheDocument();
    expect(rows().map((r) => r.getAttribute("href"))).toEqual(["/opportunities/OP00002", "/opportunities/OP00001"]);
  });

  it("keeps saved analyses after a reload", async () => {
    const { unmount } = await runInAgent("overview");
    unmount();
    // New providers and components: only localStorage survives, as after a browser refresh.
    renderWithRadar(<OpportunitiesView />);
    expect(rows()).toHaveLength(1);
  });

  it("handles corrupted storage without crashing and keeps valid entries", async () => {
    const { unmount } = await runInAgent("overview");
    unmount();
    const valid = stored()[0];
    window.localStorage.setItem(
      OPPORTUNITY_HISTORY_KEY,
      JSON.stringify([valid, { version: 2, blocks: [{ type: "future_component", payload: { html: "<script>x()</script>" } }] }, "junk"]),
    );
    renderWithRadar(<OpportunitiesView />);
    expect(screen.getByText("Some saved analyses couldn't be read")).toBeInTheDocument();
    expect(screen.getByText(/2 saved entries were damaged/)).toBeInTheDocument();
    expect(rows()).toHaveLength(1);
    expect(document.querySelector("script")).toBeNull();
  });

  it("shows an empty history for unreadable JSON", () => {
    window.localStorage.setItem(OPPORTUNITY_HISTORY_KEY, "{not json");
    renderWithRadar(<OpportunitiesView />);
    expect(screen.getByText("Some saved analyses couldn't be read")).toBeInTheDocument();
    expect(screen.getByText("No saved analyses yet")).toBeInTheDocument();
  });

  it("does not save malformed, unsupported, protected or non-opportunity responses", async () => {
    const { rerender } = await runInAgent("malformed_block", "unsupported_block", "permission_denied", "client_focus");
    expect(window.localStorage.getItem(OPPORTUNITY_HISTORY_KEY)).toBeNull();
    rerender(<OpportunitiesView />);
    expect(screen.getByText("No saved analyses yet")).toBeInTheDocument();
  });
});

describe("Reopened analysis", () => {
  it("renders the saved table and chart through the registry, with its reference in the footer", async () => {
    const { rerender } = await runInAgent("overview");
    rerender(<AnalysisDetailView reference="OP00001" />);
    expect(within(detail()).getByRole("heading", { level: 1 })).toHaveFocus();
    expect(detail()).toHaveTextContent(`From the Agent prompt “${fixtures.overview.prompt}”`);
    expect(detail()).toHaveTextContent("3 opportunities");
    expect(within(detail()).getByRole("table", { name: "Client opportunities" })).toBeInTheDocument();
    expect(within(detail()).getAllByRole("row")).toHaveLength(4);
    expect(within(detail()).getByRole("region", { name: "Opportunities by priority" })).toHaveTextContent("High2");
    const footer = within(detail()).getByRole("heading", { name: "Client opportunities" }).closest("footer")!;
    expect(footer).toHaveTextContent("OP00001");
    // Already in Opportunities: no link to itself.
    expect(within(footer).queryByRole("link")).toBeNull();
    expect(screen.getByRole("link", { name: "All opportunity analyses" })).toHaveAttribute("href", "/opportunities");
  });

  it("reopening never creates a new snapshot", async () => {
    const { rerender } = await runInAgent("overview");
    rerender(<AnalysisDetailView reference="OP00001" />);
    rerender(<OpportunitiesView />);
    rerender(<AnalysisDetailView reference="OP00001" />);
    expect(stored()).toHaveLength(1);
  });

  it("opens sources in the source viewer", async () => {
    const { rerender } = await runInAgent("overview");
    rerender(<AnalysisDetailView reference="OP00001" />);
    fireEvent.click(within(detail()).getByRole("button", { name: "View source SRC003 for Check grid application completeness" }));
    await flush();
    const dialog = screen.getByRole("dialog", { name: "Solar grid access bulletin" });
    expect(within(dialog).getByRole("region", { name: "Original source text" })).toHaveTextContent("completeness check");
    expect(within(detail()).getByRole("button", { name: "Check grid application completeness" })).toHaveAttribute("aria-pressed", "true");
  });

  it("reopens an unfinished analysis clearly marked as incomplete, without invented data", async () => {
    const { rerender } = await runInAgent("partial_then_error");
    rerender(<AnalysisDetailView reference="OP00001" />);
    const article = screen.getByRole("article", { name: /Available opportunity data — OP00001/ });
    expect(within(article).getByText("This analysis is unfinished")).toBeInTheDocument();
    expect(within(article).getByRole("link", { name: "Run it again in Agent" })).toHaveAttribute("href", "/agent");
    expect(article).toHaveTextContent("1 opportunity available");
    expect(within(article).getByText("Showing 1 of 1 available · this list may be incomplete")).toBeInTheDocument();
    expect(within(article).getAllByRole("row")).toHaveLength(2);
    expect(within(article).queryByRole("figure")).toBeNull();
  });

  it("explains when a reference isn't in this browser's history", () => {
    renderWithRadar(<AnalysisDetailView reference="OP00042" />);
    expect(screen.getByText("Analysis OP00042 isn't available")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("keeps separate filters per analysis, and the shared selection, across navigation", async () => {
    const { rerender } = await runInAgent("overview", "overview");
    rerender(<AnalysisDetailView reference="OP00002" />);
    fireEvent.change(search(), { target: { value: "grid" } });
    fireEvent.click(within(detail()).getByRole("button", { name: "Check grid application completeness" }));
    expect(within(detail()).getAllByRole("row")).toHaveLength(2);

    rerender(<AnalysisDetailView reference="OP00001" />);
    expect(search()).toHaveValue("");
    expect(within(detail()).getAllByRole("row")).toHaveLength(4);
    expect(within(detail()).getByRole("button", { name: "Check grid application completeness" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(detail()).getByRole("button", { name: "Filters" }));
    fireEvent.click(within(detail()).getByRole("radio", { name: "Medium" }));

    // The Agent conversation's tables are unaffected by either analysis.
    rerender(<AgentView />);
    for (const box of screen.getAllByRole("searchbox", { name: "Search opportunities" })) expect(box).toHaveValue("");

    rerender(<AnalysisDetailView reference="OP00001" />);
    expect(within(detail()).getByRole("button", { name: "Filters (1 active)" })).toBeInTheDocument();
    rerender(<AnalysisDetailView reference="OP00002" />);
    expect(search()).toHaveValue("grid");
  });

  it("keeps the Agent conversation and an in-progress request intact while browsing history", async () => {
    const { rerender } = await runInAgent("overview");
    send("overview");
    // Leave Agent while the second request is still streaming.
    rerender(<OpportunitiesView />);
    expect(rows()).toHaveLength(1);
    rerender(<AnalysisDetailView reference="OP00001" />);

    await flush();
    // The request finished while the user was away and was saved without disturbing the open analysis.
    expect(stored()).toHaveLength(2);
    expect(within(detail()).getByRole("heading", { level: 1 })).toHaveTextContent("OP00001");

    rerender(<AgentView />);
    const turns = screen.getAllByRole("listitem", { name: /^Request:/ });
    expect(turns).toHaveLength(2);
    for (const turn of turns) {
      expect(within(turn).getByRole("table", { name: "Client opportunities" })).toBeInTheDocument();
      expect(within(turn).getByText(fixtures.overview.events.at(-1)!.message as string)).toBeInTheDocument();
    }
    expect(screen.getAllByRole("link", { name: /^Open OP\d+ in Opportunities$/ })).toHaveLength(2);
  });
});
