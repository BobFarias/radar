"use client";

import { Briefcase } from "lucide-react";
import Link from "next/link";
import { EmptyState, FilterPills, LoadingState, Pagination, WarningState } from "@/components/ui";
import { findClient, findOpportunity } from "@/state/catalog";
import { formatDateTime } from "@/state/format";
import { briefingHistory, briefingHref, type BriefingSnapshot } from "@/state/history/briefingSnapshot";
import type { SnapshotStore } from "@/state/history/snapshotStore";
import { useSnapshotHistory } from "@/state/history/useSnapshotHistory";
import type { BriefingListView } from "@/state/workspace/state";
import { useWorkspace } from "@/state/workspace/WorkspaceProvider";
import { plural } from "@/views/opportunities/OpportunitiesView";
import { briefingItem, countBriefings, queryBriefings, type BriefingItem } from "./briefingQuery";
import { BriefingStatusBadge } from "./BriefingStatusBadge";

const STATUS_OPTIONS: Array<{ value: BriefingListView["status"]; label: string }> = [
  { value: "all", label: "All" },
  { value: "generated", label: "Generated" },
  { value: "draft", label: "Unsaved drafts" },
  { value: "saved", label: "Saved tasks" },
];

function BriefingRow({ item }: { item: BriefingItem }) {
  const { snapshot, draft, status } = item;
  const client = findClient(snapshot.clientId)?.name ?? snapshot.clientId;
  const opportunity = findOpportunity(snapshot.opportunityId)?.title ?? snapshot.opportunityId;
  return (
    <li>
      <Link
        href={briefingHref(snapshot.reference)}
        className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl bg-[#f5f1ec] px-4 py-3 text-sm text-ink/85 transition hover:bg-line sm:flex-nowrap"
      >
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className="font-medium">
            {client} — <span className="whitespace-nowrap">{snapshot.reference}</span>
          </span>
          <span className="text-xs text-muted">
            {opportunity} · {snapshot.opportunityId}
          </span>
        </span>
        <BriefingStatusBadge status={status} />
        {status === "saved" && draft?.savedTaskId ? (
          <span className="max-w-[16rem] truncate font-mono text-xs text-muted" title={draft.savedTaskId}>
            {draft.savedTaskId}
          </span>
        ) : null}
        <time dateTime={snapshot.createdAt} className="font-medium whitespace-nowrap text-muted">
          {formatDateTime(snapshot.createdAt, "short")}
        </time>
      </Link>
    </li>
  );
}

/**
 * Briefing workspace: briefings generated in Agent, with the state of each
 * one's review task. Each row opens the saved briefing at /briefing/<reference>.
 */
export function BriefingView({ store = briefingHistory }: { store?: SnapshotStore<BriefingSnapshot> }) {
  const history = useSnapshotHistory(store);
  const { state, dispatch } = useWorkspace();
  const view = state.briefingList;
  const setView = (next: Partial<BriefingListView>) => dispatch({ type: "briefing_list_changed", view: next });

  const all = history.status === "ready" ? history.items.map((s) => briefingItem(s, state.drafts)) : [];
  const result = queryBriefings(all, view);
  const counts = countBriefings(all);

  return (
    <div className="mx-auto grid w-full max-w-[1200px] content-start gap-5 px-4 py-8 sm:px-7">
      <header className="grid gap-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Briefcase aria-hidden="true" className="h-6 w-6" />
          Briefing
        </h1>
        <p className="text-sm text-muted">Client briefings generated in Agent and the review tasks prepared from them, in this browser.</p>
      </header>

      {history.status === "loading" ? <LoadingState title="Loading briefings…" /> : null}

      {history.status === "ready" && history.skipped > 0 ? (
        <WarningState title="Some saved briefings couldn't be read">
          {plural(history.skipped, "saved entry", "saved entries")} {history.skipped === 1 ? "was" : "were"} damaged or in an
          old format and {history.skipped === 1 ? "has" : "have"} been skipped. Your other briefings are unaffected.
        </WarningState>
      ) : null}

      {state.draftsSkipped > 0 ? (
        <WarningState title="Some unsaved drafts couldn't be restored">
          They were damaged and have been removed. Saved review tasks are not affected; their task IDs are kept by RADAR.
        </WarningState>
      ) : null}

      {history.status === "ready" && !history.persistent ? (
        <WarningState title="Briefings are only kept for this visit">
          This browser isn&apos;t letting RADAR save data, so briefings will disappear when you close or reload the page.
        </WarningState>
      ) : null}

      {history.status === "ready" && all.length === 0 ? (
        <EmptyState
          title="No briefings yet"
          actions={
            <Link href="/agent" className="inline-flex min-h-10 items-center rounded-full bg-accent px-4 text-sm font-medium text-accent-ink">
              Go to Agent
            </Link>
          }
        >
          Ask Agent to prepare a partner briefing for a client. Each briefing is kept here with its evidence and review task.
        </EmptyState>
      ) : null}

      {all.length > 0 ? (
        <section aria-labelledby="briefings-heading" className="grid gap-3">
          <FilterPills
            label="Briefing status"
            options={STATUS_OPTIONS}
            value={view.status}
            counts={counts}
            onChange={(status) => setView({ status, page: 1 })}
          />
          <h2 id="briefings-heading" className="text-sm font-normal text-muted" aria-live="polite">
            {result.total === 0 ? "No briefings" : `Showing ${result.from}–${result.to} of ${plural(result.total, "briefing")}`}
          </h2>
          {result.total === 0 ? (
            <EmptyState title="No briefings with this status" />
          ) : (
            <ul className="grid gap-2">
              {result.items.map((item) => (
                <BriefingRow key={item.snapshot.id} item={item} />
              ))}
            </ul>
          )}
          {result.pageCount > 1 ? <Pagination page={result.page} pageCount={result.pageCount} onPage={(page) => setView({ page })} /> : null}
        </section>
      ) : null}
    </div>
  );
}
