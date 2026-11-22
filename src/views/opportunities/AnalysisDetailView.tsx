"use client";

import { ArrowLeft, Zap } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { ResponseBlockContext } from "@/components/blocks/ResponseBlockContext";
import { Badge, EmptyState, LoadingState, WarningState } from "@/components/ui";
import { formatDateTime } from "@/state/format";
import { opportunityHistory, type AnalysisSnapshot } from "@/state/history/analysisSnapshot";
import type { SnapshotStore } from "@/state/history/snapshotStore";
import { useSnapshotHistory } from "@/state/history/useSnapshotHistory";
import type { BlockEntry } from "@/state/response/state";
import { opportunities } from "./OpportunitiesView";

function BackLink() {
  return (
    <Link href="/opportunities" className="inline-flex items-center gap-1.5 justify-self-start rounded-full text-sm text-muted hover:text-ink">
      <ArrowLeft aria-hidden="true" className="h-4 w-4" />
      All opportunity analyses
    </Link>
  );
}

function Detail({ analysis }: { analysis: AnalysisSnapshot }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), [analysis.id]);

  const entries = useMemo<BlockEntry[]>(
    () => analysis.blocks.map((block, i) => ({ key: `${i}:${block.id}`, result: { status: "valid", block } })),
    [analysis.blocks],
  );
  // Filters are scoped to this snapshot, so every saved analysis keeps its own.
  const context = useMemo(
    () => ({
      scopeId: `snapshot:${analysis.id}`,
      requestId: analysis.requestId,
      scenarioId: analysis.scenarioId,
      analysis: { reference: analysis.reference, createdAt: analysis.createdAt },
      incomplete: analysis.status === "partial",
    }),
    [analysis],
  );

  return (
    <article aria-labelledby="analysis-heading" className="grid gap-5">
      <header className="grid gap-2">
        <h1 id="analysis-heading" ref={headingRef} tabIndex={-1} className="flex flex-wrap items-center gap-2 text-2xl font-semibold">
          <Zap aria-hidden="true" className="h-6 w-6" />
          {analysis.title} — {analysis.reference}
        </h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <span>
            Generated <time dateTime={analysis.createdAt}>{formatDateTime(analysis.createdAt)}</time>
          </span>
          <Badge>{`${opportunities(analysis.opportunityCount)}${analysis.status === "partial" ? " available" : ""}`}</Badge>
          {analysis.status === "partial" ? <Badge tone="warn">Unfinished</Badge> : null}
        </div>
        <p className="text-sm text-muted">
          From the Agent prompt “{analysis.prompt}” — a saved copy of the answer from that moment, not refreshed with newer
          data.
        </p>
      </header>
      {analysis.status === "partial" ? (
        <WarningState
          title="This analysis is unfinished"
          actions={
            <Link href="/agent" className="inline-flex min-h-10 items-center rounded-full border border-line bg-surface px-4 text-sm font-medium text-ink">
              Run it again in Agent
            </Link>
          }
        >
          The answer ended before all the supporting information was retrieved. Only the opportunities that arrived are shown, and
          some opportunities or evidence may be missing.
        </WarningState>
      ) : null}
      <ResponseBlockContext.Provider value={context}>
        <BlockRenderer entries={entries} />
      </ResponseBlockContext.Provider>
    </article>
  );
}

/** One saved opportunity analysis, reopened from history by its reference. Sends no request. */
export function AnalysisDetailView({
  reference,
  store = opportunityHistory,
}: {
  reference: string;
  store?: SnapshotStore<AnalysisSnapshot>;
}) {
  const history = useSnapshotHistory(store);
  const analysis = history.status === "ready" ? history.items.find((s) => s.reference === reference) : undefined;

  return (
    <div className="mx-auto grid w-full max-w-[1200px] content-start gap-5 px-4 py-8 sm:px-7">
      <BackLink />
      {history.status === "loading" ? <LoadingState title="Loading saved analysis…" /> : null}
      {history.status === "ready" && !analysis ? (
        <EmptyState title={`Analysis ${reference} isn't available`}>
          It isn&apos;t in this browser&apos;s saved history. It may have been generated in another browser or removed when
          older analyses were cleared.
        </EmptyState>
      ) : null}
      {analysis ? <Detail analysis={analysis} /> : null}
    </div>
  );
}
