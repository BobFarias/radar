import { describe, expect, it } from "vitest";
import type { OpportunityRow } from "@/contracts/blocks";
import { fixtureBlock } from "@/test/fixtures";
import { activeFilterCount, clientOptions, filterOpportunities, hasActiveFilters } from "./filters";

const rows = (fixtureBlock("overview", "overview-table") as { rows: OpportunityRow[] }).rows;
const none = { query: "", clientId: null, priority: null, stage: null };
const ids = (r: OpportunityRow[]) => r.map((x) => x.opportunity_id);

describe("filterOpportunities", () => {
  it("returns all rows without filters", () => {
    expect(ids(filterOpportunities(rows, none))).toEqual(["O001", "O002", "O003"]);
  });

  it("filters by client, priority and stage, combined with AND", () => {
    expect(ids(filterOpportunities(rows, { ...none, clientId: "CL001" }))).toEqual(["O001", "O002"]);
    expect(ids(filterOpportunities(rows, { ...none, priority: "High" }))).toEqual(["O001", "O003"]);
    expect(ids(filterOpportunities(rows, { ...none, stage: "Reviewing" }))).toEqual(["O003"]);
    expect(ids(filterOpportunities(rows, { ...none, clientId: "CL001", priority: "High" }))).toEqual(["O001"]);
    expect(filterOpportunities(rows, { ...none, clientId: "CL002", priority: "Medium" })).toEqual([]);
  });

  it("searches title, client, id, status note and source ids, case-insensitively", () => {
    expect(ids(filterOpportunities(rows, { ...none, query: "GRID" }))).toEqual(["O003"]);
    expect(ids(filterOpportunities(rows, { ...none, query: "asteria" }))).toEqual(["O001", "O002"]);
    expect(ids(filterOpportunities(rows, { ...none, query: "o002" }))).toEqual(["O002"]);
    expect(ids(filterOpportunities(rows, { ...none, query: "partner confirmation" }))).toEqual(["O002"]);
    expect(ids(filterOpportunities(rows, { ...none, query: "src003" }))).toEqual(["O003"]);
    expect(ids(filterOpportunities(rows, { ...none, query: "   " }))).toEqual(["O001", "O002", "O003"]);
  });

  it("combines search with menu filters", () => {
    expect(ids(filterOpportunities(rows, { ...none, query: "payment", priority: "Medium" }))).toEqual(["O002"]);
  });

  it("does not mutate the validated rows", () => {
    const copy = structuredClone(rows);
    filterOpportunities(rows, { ...none, clientId: "CL002" });
    expect(rows).toEqual(copy);
  });
});

describe("filter helpers", () => {
  it("derives unique client options from the rows", () => {
    expect(clientOptions(rows)).toEqual([
      { id: "CL001", name: "Asteria Payments" },
      { id: "CL002", name: "Northstar Renewables" },
    ]);
  });

  it("detects active filters and counts menu filters", () => {
    expect(hasActiveFilters(none)).toBe(false);
    expect(hasActiveFilters({ ...none, stage: "New" })).toBe(true);
    expect(hasActiveFilters({ ...none, query: "grid" })).toBe(true);
    expect(activeFilterCount({ ...none, query: "grid", clientId: "CL001", stage: "New" })).toBe(2);
  });
});
