"use client";

import { ListFilter, Smile, Zap } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge, Button, EmptyState, FilterPills, LoadingState, Pagination, Popover, RadioGroup, WarningState } from "@/components/ui";
import { formatDateTime } from "@/state/format";
import { analysisHref, opportunityHistory, type AnalysisSnapshot } from "@/state/history/analysisSnapshot";
import type { SnapshotStore } from "@/state/history/snapshotStore";
import { useSnapshotHistory } from "@/state/history/useSnapshotHistory";
import type { AnalysisListView, AnalysisPeriod } from "@/state/workspace/state";
import { useWorkspace } from "@/state/workspace/WorkspaceProvider";
import { countByStatus, queryAnalyses } from "./analysisQuery";

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
export const opportunities = (n: number) => plural(n, "opportunity", "opportunities");

const PERIODS: Array<{ value: AnalysisPeriod; label: string }> = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "last7", label: "Last 7 days" },
];

function ListFilters({ view, onChange }: { view: AnalysisListView; onChange: (view: Partial<AnalysisListView>) => void }) {
  const active = view.period !== "all" ? 1 : 0;
  return (
    <Popover
      label={active ? "Filter analyses (1 active)" : "Filter analyses"}
      icon={<ListFilter aria-hidden="true" className="h-4 w-4" />}
      indicator={active > 0}
    >
      <div className="grid gap-4">
        <RadioGroup legend="Created" value={view.period} onChange={(period) => onChange({ period, page: 1 })} options={PERIODS} />
        <RadioGroup
          legend="Sort"
          value={view.sort}
          onChange={(sort) => onChange({ sort, page: 1 })}
          options={[
            { value: "newest", label: "Newest first" },
            { value: "oldest", label: "Oldest first" },
          ]}
        />
      </div>
    </Popover>
  );
}

function AnalysisRow({ item }: { item: AnalysisSnapshot }) {
  return (
    <li>
      <Link
        href={analysisHref(item.reference)}
        className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-[#f5f1ec] px-4 py-3 text-sm text-ink/85 transition hover:bg-line sm:flex-nowrap"
      >
        <span className="min-w-0 flex-1 font-medium">
          {item.title} — <span className="whitespace-nowrap">{item.reference}</span>
        </span>
        {item.status === "partial" ? <Badge tone="warn">Unfinished</Badge> : null}
        <span className="text-xs text-muted">
          {opportunities(item.opportunityCount)}
          {item.status === "partial" ? " available" : null}
        </span>
        <span className="flex items-center gap-1.5 font-medium whitespace-nowrap text-muted">
          <span className="group/creator relative grid place-items-center">
            <Smile aria-hidden="true" className="h-4 w-4" />
            <span className="sr-only">Created by the Agent, </span>
            {/* Visual tooltip; screen readers get the sr-only text above. */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 rounded-md bg-ink px-2 py-1 text-xs font-normal whitespace-nowrap text-surface opacity-0 shadow transition-opacity group-hover/creator:opacity-100"
            >
              Created by the Agent
            </span>
          </span>
          <time dateTime={item.createdAt}>{formatDateTime(item.createdAt, "short")}</time>
        </span>
      </Link>
    </li>
  );
}

const STATUS_TABS: Array<{ value: AnalysisListView["status"]; label: string }> = [
  { value: "all", label: "All" },
  { value: "complete", label: "Completed" },
  { value: "partial", label: "Unfinished" },
];

/**
 * Opportunities workspace: the list of opportunity analyses generated in
 * Agent, with a period filter, sort and pagination. Each row opens the saved
 * analysis at /opportunities/<reference>.
 */
export function OpportunitiesView({ store = opportunityHistory }: { store?: SnapshotStore<AnalysisSnapshot> }) {
  const history = useSnapshotHistory(store);
  const { state, dispatch } = useWorkspace();
  const [now] = useState(() => new Date());
  const view = state.analysisList;
  const setView = (next: Partial<AnalysisListView>) => dispatch({ type: "analysis_list_changed", view: next });

  const all = history.status === "ready" ? history.items : [];
  const result = queryAnalyses(all, view, now);
  const counts = countByStatus(all, view.period, now);

  return (
    <div className="mx-auto grid w-full max-w-[1200px] content-start gap-5 px-4 py-8 sm:px-7">
      <header className="grid gap-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Zap aria-hidden="true" className="h-6 w-6" />
          Opportunities
        </h1>
        <p className="text-sm text-muted">Opportunity analyses you generated in Agent, saved in this browser.</p>
      </header>

      {history.status === "loading" ? <LoadingState title="Loading saved analyses…" /> : null}

      {history.status === "ready" && history.skipped > 0 ? (
        <WarningState title="Some saved analyses couldn't be read">
          {plural(history.skipped, "saved entry", "saved entries")} {history.skipped === 1 ? "was" : "were"} damaged or in an
          old format and {history.skipped === 1 ? "has" : "have"} been skipped. Your other analyses are unaffected.
        </WarningState>
      ) : null}

      {history.status === "ready" && !history.persistent ? (
        <WarningState title="History is only kept for this visit">
          This browser isn&apos;t letting RADAR save data, so analyses will disappear when you close or reload the page.
        </WarningState>
      ) : null}

      {history.status === "ready" && all.length === 0 ? (
        <EmptyState
          title="No saved analyses yet"
          actions={
            <Link href="/agent" className="inline-flex min-h-10 items-center rounded-full bg-accent px-4 text-sm font-medium text-accent-ink">
              Go to Agent
            </Link>
          }
        >
          Ask Agent for the current client opportunities. Each analysis is saved here so you can reopen it later.
        </EmptyState>
      ) : null}

      {all.length > 0 ? (
        <section aria-labelledby="analyses-heading" className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <FilterPills
              label="Analysis status"
              options={STATUS_TABS}
              value={view.status}
              counts={counts}
              onChange={(status) => setView({ status, page: 1 })}
            />
            <ListFilters view={view} onChange={setView} />
          </div>
          <h2 id="analyses-heading" className="text-sm font-normal text-muted" aria-live="polite">
            {result.total === 0 ? "No analyses" : `Showing ${result.from}–${result.to} of ${plural(result.total, "analysis", "analyses")}`}
          </h2>

          {result.total === 0 ? (
            <EmptyState
              title="No analyses match this filter"
              actions={<Button onClick={() => setView({ status: "all", period: "all", page: 1 })}>Show all analyses</Button>}
            />
          ) : (
            <ul className="grid gap-2">
              {result.items.map((item) => (
                <AnalysisRow key={item.id} item={item} />
              ))}
            </ul>
          )}

          {result.pageCount > 1 ? <Pagination page={result.page} pageCount={result.pageCount} onPage={(page) => setView({ page })} /> : null}
        </section>
      ) : null}
    </div>
  );
}
