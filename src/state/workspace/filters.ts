import type { OpportunityRow } from "@/contracts/blocks";
import type { OpportunityFilters } from "./state";

/** Application-owned filtering; never driven by response JSON. */
export const NO_FILTERS: OpportunityFilters = { query: "", clientId: null, priority: null, stage: null };

function matchesQuery(row: OpportunityRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [row.title, row.client_name, row.opportunity_id, row.status_note, ...row.source_ids].some((value) =>
    value.toLowerCase().includes(q),
  );
}

export function filterOpportunities(rows: OpportunityRow[], filters: OpportunityFilters): OpportunityRow[] {
  return rows.filter(
    (row) =>
      matchesQuery(row, filters.query) &&
      (filters.clientId === null || row.client_id === filters.clientId) &&
      (filters.priority === null || row.priority === filters.priority) &&
      (filters.stage === null || row.stage === filters.stage),
  );
}

/** Number of active menu filters (search is shown separately). */
export function activeFilterCount(filters: OpportunityFilters): number {
  return [filters.clientId, filters.priority, filters.stage].filter((v) => v !== null).length;
}

export function hasActiveFilters(filters: OpportunityFilters): boolean {
  return filters.query.trim() !== "" || activeFilterCount(filters) > 0;
}

export function clientOptions(rows: OpportunityRow[]): Array<{ id: string; name: string }> {
  const byId = new Map<string, string>();
  for (const row of rows) if (!byId.has(row.client_id)) byId.set(row.client_id, row.client_name);
  return [...byId].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}
