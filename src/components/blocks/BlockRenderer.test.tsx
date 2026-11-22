// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { BlockEntry } from "@/state/response/state";
import { fixtureBlock } from "@/test/fixtures";
import { validateBlock } from "@/validation/blocks";
import { BlockRenderer } from "./BlockRenderer";
import { blockRegistry, type BlockRegistry } from "./registry";

const entry = (raw: unknown, i = 0): BlockEntry => ({ key: String(i), result: validateBlock(raw) });

describe("BlockRenderer", () => {
  it("renders each valid fixture block through its registered component", () => {
    render(
      <BlockRenderer
        entries={[
          entry(fixtureBlock("overview", "overview-table"), 0),
          entry(fixtureBlock("overview", "overview-chart"), 1),
          entry(fixtureBlock("client_focus", "client-evidence"), 2),
          entry(fixtureBlock("client_focus", "client-review"), 3),
        ]}
      />,
    );
    expect(screen.getByRole("region", { name: "Client opportunities" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Client opportunities" })).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(4); // header + 3 opportunities
    expect(screen.getByRole("region", { name: "Opportunities by priority" })).toHaveTextContent("High2");
    expect(screen.getByRole("region", { name: "Evidence for Asteria Payments" })).toHaveTextContent("AI interpretation");
    expect(screen.getByRole("region", { name: "Prepare a review task" })).toHaveTextContent("Payment resilience consultation");
  });

  it("renders a safe fallback for the unsupported_block fixture and never executes its payload", () => {
    const { container } = render(<BlockRenderer entries={[entry(fixtureBlock("unsupported_block", "future-block"))]} />);
    expect(screen.getByRole("status")).toHaveTextContent("This part of the answer can't be shown here");
    // The internal type name only appears in the technical details, never in the message.
    expect(screen.getByText(/Block type: future_component/)).toBeInTheDocument();
    expect(screen.getByText(/Block type: future_component/).closest("details")).not.toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(container.innerHTML).not.toContain("__assessmentUnsafe");
    expect((window as unknown as Record<string, unknown>).__assessmentUnsafe).toBeUndefined();
  });

  it("renders an invalid-data fallback for the malformed chart instead of a chart", () => {
    render(<BlockRenderer entries={[entry(fixtureBlock("malformed_block", "invalid-chart"))]} />);
    expect(screen.getByRole("status")).toHaveTextContent("This chart couldn't be shown");
    expect(screen.queryByRole("figure")).toBeNull();
    expect(screen.queryByText("not-a-number")).toBeNull();
  });

  it("keeps valid blocks visible next to a malformed one", () => {
    render(
      <BlockRenderer
        entries={[
          entry(fixtureBlock("overview", "overview-table"), 0),
          entry(fixtureBlock("malformed_block", "invalid-chart"), 1),
          entry(fixtureBlock("unsupported_block", "future-block"), 2),
        ]}
      />,
    );
    expect(screen.getByRole("table", { name: "Client opportunities" })).toBeInTheDocument();
    expect(screen.getAllByRole("status")).toHaveLength(2);
  });

  it.each([
    ["overview-table", "rows", "No opportunities in this response."],
    ["overview-chart", "series", "No data to chart."],
  ])("shows an empty state for a valid but empty %s", (id, field, message) => {
    const block = fixtureBlock("overview", id) as Record<string, unknown>;
    block[field] = [];
    render(<BlockRenderer entries={[entry(block)]} />);
    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it("isolates a component crash to its own block", () => {
    const Crashing = () => {
      throw new Error("boom");
    };
    const registry: BlockRegistry = { ...blockRegistry, bar_chart: Crashing };
    const original = console.error;
    console.error = () => {};
    try {
      render(
        <BlockRenderer
          registry={registry}
          entries={[entry(fixtureBlock("overview", "overview-table"), 0), entry(fixtureBlock("overview", "overview-chart"), 1)]}
        />,
      );
    } finally {
      console.error = original;
    }
    expect(screen.getByRole("table", { name: "Client opportunities" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Something went wrong showing this chart");
    expect(screen.getByRole("status")).toHaveTextContent("The other section of this answer is shown as usual.");
  });
});
