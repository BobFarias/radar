// @vitest-environment jsdom
import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { OpportunityTableBlock } from "@/contracts/blocks";
import { fixtureBlock } from "@/test/fixtures";
import { renderWithRadar } from "@/test/render";
import { validateBlock } from "@/validation/blocks";
import { OpportunityTable } from "./OpportunityTable";

function validated(scenario: "overview" | "partial_then_error", id: string): OpportunityTableBlock {
  const result = validateBlock(fixtureBlock(scenario, id));
  if (result.status !== "valid" || result.block.type !== "opportunity_table") throw new Error("fixture invalid");
  return result.block;
}

const overview = () => validated("overview", "overview-table");
const table = () => screen.getByRole("table", { name: "Client opportunities" });
const bodyRows = () => within(table()).getAllByRole("row").slice(1);
const openFilters = () => fireEvent.click(screen.getByRole("button", { name: /^Filters/ }));
const menu = () => screen.getByRole("group", { name: /^Filters/ });
const pick = (legend: string, option: string) =>
  fireEvent.click(within(within(menu()).getByRole("group", { name: legend })).getByRole("radio", { name: option }));

describe("OpportunityTable", () => {
  it("renders every validated row with client, title, priority, stage, note and source", () => {
    renderWithRadar(<OpportunityTable block={overview()} />);
    expect(screen.getByRole("region", { name: "Client opportunities" })).toBeInTheDocument();
    expect(bodyRows()).toHaveLength(3);
    const first = within(bodyRows()[0]!);
    expect(first.getByRole("button", { name: "Review payment resilience readiness" })).toBeInTheDocument();
    expect(first.getByText("Asteria Payments")).toBeInTheDocument();
    expect(first.getByText("High")).toBeInTheDocument();
    expect(first.getByText("New")).toBeInTheDocument();
    expect(first.getByText("Consultation proposal; no mandatory implementation date.")).toBeInTheDocument();
    expect(first.getByRole("button", { name: "View source SRC001 for Review payment resilience readiness" })).toBeInTheDocument();
  });

  it("searches the rows from the search field", () => {
    renderWithRadar(<OpportunityTable block={overview()} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search opportunities" }), { target: { value: "grid" } });
    expect(bodyRows()).toHaveLength(1);
    expect(screen.getByText("Showing 1 of 3")).toBeInTheDocument();
  });

  it("opens the filter menu with client, priority and stage options", () => {
    renderWithRadar(<OpportunityTable block={overview()} />);
    const button = screen.getByRole("button", { name: "Filters" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    openFilters();
    expect(button).toHaveAttribute("aria-expanded", "true");
    const legends = within(menu()).getAllByRole("group").map((g) => g.getAttribute("name") ?? g.querySelector("legend")?.textContent);
    expect(legends).toEqual(["Client", "Priority", "Stage"]);
    expect(within(menu()).getByRole("radio", { name: "All clients" })).toBeChecked();
    expect(within(menu()).getByRole("radio", { name: "All clients" })).toHaveFocus();
  });

  it("filters by client and by priority, updating the count and the button label", () => {
    renderWithRadar(<OpportunityTable block={overview()} />);
    openFilters();
    pick("Client", "Asteria Payments");
    expect(bodyRows()).toHaveLength(2);
    expect(screen.getByText("Showing 2 of 3")).toBeInTheDocument();

    pick("Priority", "Medium");
    expect(bodyRows()).toHaveLength(1);
    expect(within(bodyRows()[0]!).getByText("Discuss cross-border payment data arrangements")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filters (2 active)" })).toBeInTheDocument();
  });

  it("filters by stage", () => {
    renderWithRadar(<OpportunityTable block={overview()} />);
    openFilters();
    pick("Stage", "Reviewing");
    expect(bodyRows()).toHaveLength(1);
    expect(within(bodyRows()[0]!).getByText("Northstar Renewables")).toBeInTheDocument();
  });

  it("closes the menu on Escape and returns focus to the filter button", () => {
    renderWithRadar(<OpportunityTable block={overview()} />);
    openFilters();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("group", { name: /^Filters/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Filters" })).toHaveFocus();
  });

  it("shows an empty state when nothing matches, and can clear search and filters", () => {
    renderWithRadar(<OpportunityTable block={overview()} />);
    openFilters();
    pick("Client", "Northstar Renewables");
    pick("Priority", "Medium");
    expect(screen.getByText("No opportunities match your search or filters.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Clear search and filters" }));
    expect(bodyRows()).toHaveLength(3);
  });

  it("selects and deselects an opportunity", () => {
    renderWithRadar(<OpportunityTable block={overview()} />);
    const button = screen.getByRole("button", { name: "Check grid application completeness" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button.closest("tr")).toHaveAttribute("data-selected", "true");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it("keeps selection, search and filters when a new response renders a new table", () => {
    const { rerender } = renderWithRadar(<OpportunityTable block={overview()} />);
    fireEvent.click(screen.getByRole("button", { name: "Review payment resilience readiness" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search opportunities" }), { target: { value: "payment" } });
    openFilters();
    pick("Client", "Asteria Payments");

    // Same providers, different validated block (as when a later response arrives).
    rerender(<OpportunityTable block={validated("partial_then_error", "refresh-table")} />);
    expect(screen.getByRole("searchbox", { name: "Search opportunities" })).toHaveValue("payment");
    expect(screen.getByRole("button", { name: "Filters (1 active)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review payment resilience readiness" })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows an empty state for a valid table with no rows", () => {
    renderWithRadar(<OpportunityTable block={{ ...overview(), rows: [] }} />);
    expect(screen.getByText("No opportunities in this response.")).toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).toBeNull();
  });
});
