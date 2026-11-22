"use client";

import { FileText, ListFilter, Search, SquareArrowOutUpRight, Zap } from "lucide-react";
import Link from "next/link";
import { useId } from "react";
import { PRIORITIES, STAGES, type OpportunityRow, type OpportunityTableBlock, type Priority, type Stage } from "@/contracts/blocks";
import {
  Badge,
  Button,
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  DataTableRowHeader,
  EmptyState,
  Popover,
  RadioGroup,
  cn,
  type BadgeTone,
} from "@/components/ui";
import { formatDateTime } from "@/state/format";
import { activeFilterCount, clientOptions, filterOpportunities, NO_FILTERS } from "@/state/workspace/filters";
import { filterScope, filtersFor, type OpportunityFilters } from "@/state/workspace/state";
import { useWorkspace } from "@/state/workspace/WorkspaceProvider";
import { useResponseBlockContext } from "./ResponseBlockContext";

const priorityTone: Record<Priority, BadgeTone> = { High: "accent", Medium: "warn", Low: "neutral" };
const ALL = "all";

/** Search field + filter menu, right-aligned above the table (Figma "Filters"). */
function OpportunityFilters({
  rows,
  filters,
  shown,
  incomplete,
  onChange,
}: {
  rows: OpportunityRow[];
  filters: OpportunityFilters;
  shown: number;
  incomplete: boolean;
  onChange: (filters: Partial<OpportunityFilters>) => void;
}) {
  const clients = clientOptions(rows);
  // Keep a persisted filter selectable even if this response has no matching client.
  if (filters.clientId && !clients.some((c) => c.id === filters.clientId)) {
    clients.push({ id: filters.clientId, name: filters.clientId });
  }
  const active = activeFilterCount(filters);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p aria-live="polite" className="text-xs text-muted">
        Showing {shown} of {rows.length}
        {incomplete ? " available · this list may be incomplete" : null}
      </p>
      <div className="flex items-center gap-2">
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-icon" />
          <input
            type="search"
            aria-label="Search opportunities"
            placeholder="Search"
            value={filters.query}
            onChange={(e) => onChange({ query: e.target.value })}
            className="h-7 w-[163px] rounded-full border border-sand bg-surface pr-3 pl-7 text-xs text-ink placeholder:text-muted"
          />
        </div>
        <Popover
          label={active > 0 ? `Filters (${active} active)` : "Filters"}
          icon={<ListFilter aria-hidden="true" className="h-4 w-4" />}
          indicator={active > 0}
        >
          <div className="grid gap-4">
            <RadioGroup
              legend="Client"
              value={filters.clientId ?? ALL}
              onChange={(v) => onChange({ clientId: v === ALL ? null : v })}
              options={[{ value: ALL, label: "All clients" }, ...clients.map((c) => ({ value: c.id, label: c.name }))]}
            />
            <RadioGroup<Priority | typeof ALL>
              legend="Priority"
              value={filters.priority ?? ALL}
              onChange={(v) => onChange({ priority: v === ALL ? null : v })}
              options={[{ value: ALL, label: "All priorities" }, ...PRIORITIES.map((p) => ({ value: p, label: p }))]}
            />
            <RadioGroup<Stage | typeof ALL>
              legend="Stage"
              value={filters.stage ?? ALL}
              onChange={(v) => onChange({ stage: v === ALL ? null : v })}
              options={[{ value: ALL, label: "All stages" }, ...STAGES.map((s) => ({ value: s, label: s }))]}
            />
            {active > 0 ? (
              <Button variant="ghost" className="justify-self-start px-0 text-xs" onClick={() => onChange({ clientId: null, priority: null, stage: null })}>
                Reset filters
              </Button>
            ) : null}
          </div>
        </Popover>
      </div>
    </div>
  );
}

function SourceButtons({ row }: { row: OpportunityRow }) {
  const { openSource } = useWorkspace();
  if (row.source_ids.length === 0) return <span className="text-muted">None</span>;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {row.source_ids.map((sourceId) => (
        <li key={sourceId}>
          {openSource ? (
            <button
              type="button"
              onClick={() => openSource(sourceId, row)}
              aria-label={`View source ${sourceId} for ${row.title}`}
              className={cn(
                "inline-flex min-h-8 items-center gap-1 rounded-full border border-sand bg-surface px-2.5 text-xs font-medium",
                "hover:border-accent hover:text-accent",
              )}
            >
              <FileText aria-hidden="true" className="h-3.5 w-3.5" />
              {sourceId}
            </button>
          ) : (
            <span className="text-xs">{sourceId}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function OpportunityTable({ block }: { block: OpportunityTableBlock }) {
  const { state, dispatch } = useWorkspace();
  const { incomplete = false, scopeId, analysis } = useResponseBlockContext();
  // Each table owns its filters (turn + block), so filtering one never changes another.
  const scope = filterScope(scopeId, block.id);
  const filters = filtersFor(state, scope);
  const headingId = useId();
  const rows = filterOpportunities(block.rows, filters);
  const setFilters = (next: Partial<OpportunityFilters>) => dispatch({ type: "filters_changed", scope, filters: next });
  const hasRows = block.rows.length > 0;

  return (
    <div className="grid gap-3">
      {hasRows ? <OpportunityFilters rows={block.rows} filters={filters} shown={rows.length} incomplete={incomplete} onChange={setFilters} /> : null}

      <section aria-labelledby={headingId} className="overflow-hidden rounded-2xl border border-sand bg-surface">
        <div className="p-[17px]">
          {!hasRows ? (
            <EmptyState title="No opportunities in this response." />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No opportunities match your search or filters."
              actions={<Button onClick={() => setFilters(NO_FILTERS)}>Clear search and filters</Button>}
            />
          ) : (
            <DataTable caption={block.title} className="min-w-[640px]">
              <DataTableHead>
                <DataTableHeaderCell className="w-[40%]">Opportunity</DataTableHeaderCell>
                <DataTableHeaderCell>Client</DataTableHeaderCell>
                <DataTableHeaderCell>Priority</DataTableHeaderCell>
                <DataTableHeaderCell>Stage</DataTableHeaderCell>
                <DataTableHeaderCell>Source</DataTableHeaderCell>
              </DataTableHead>
              <DataTableBody>
                {rows.map((row) => {
                  const selected = state.selectedOpportunityId === row.opportunity_id;
                  return (
                    <DataTableRow key={row.opportunity_id} selected={selected}>
                      <DataTableRowHeader>
                        <button
                          type="button"
                          aria-pressed={selected}
                          onClick={() => dispatch({ type: "opportunity_selected", opportunityId: selected ? null : row.opportunity_id })}
                          className="rounded text-left font-medium hover:underline"
                        >
                          {row.title}
                        </button>
                        <span className="mt-0.5 block text-xs text-muted">
                          {row.opportunity_id}
                          {selected ? " · Selected" : ""}
                        </span>
                        <span className="mt-1.5 block text-xs text-muted">{row.status_note}</span>
                      </DataTableRowHeader>
                      <DataTableCell>{row.client_name}</DataTableCell>
                      <DataTableCell>
                        <Badge tone={priorityTone[row.priority]}>{row.priority}</Badge>
                      </DataTableCell>
                      <DataTableCell>{row.stage}</DataTableCell>
                      <DataTableCell>
                        <SourceButtons row={row} />
                      </DataTableCell>
                    </DataTableRow>
                  );
                })}
              </DataTableBody>
            </DataTable>
          )}
        </div>
        <footer className="flex min-h-[39px] flex-wrap items-center gap-x-1.5 gap-y-1 bg-sand px-[17px] py-2 text-sm text-[#6a6865]">
          <Zap aria-hidden="true" className="h-4 w-4 shrink-0" />
          <h2 id={headingId} className="font-normal">
            {block.title}
          </h2>
          {analysis ? (
            <span className="text-[#6a6865]">
              <span aria-hidden="true"> — </span>
              <span className="font-medium">{analysis.reference}</span>
              <span aria-hidden="true"> · </span>
              <time dateTime={analysis.createdAt}>{formatDateTime(analysis.createdAt, "short")}</time>
            </span>
          ) : null}
          <span className="ml-auto flex items-center gap-2">
            {incomplete ? <Badge tone="warn">Incomplete</Badge> : null}
            {analysis?.href ? (
              <Link
                href={analysis.href}
                aria-label={`Open ${analysis.reference} in Opportunities`}
                title="Open in Opportunities"
                className="grid h-8 w-8 place-items-center rounded-full text-[#6a6865] transition hover:bg-surface/60 hover:text-ink"
              >
                <SquareArrowOutUpRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            ) : null}
          </span>
        </footer>
      </section>
    </div>
  );
}
