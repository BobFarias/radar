"use client";

import { ArrowLeft, Briefcase } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { ResponseBlockContext } from "@/components/blocks/ResponseBlockContext";
import { EmptyState, LoadingState } from "@/components/ui";
import { findClient, findOpportunity } from "@/state/catalog";
import { formatDateTime } from "@/state/format";
import { briefingHistory, type BriefingSnapshot } from "@/state/history/briefingSnapshot";
import type { SnapshotStore } from "@/state/history/snapshotStore";
import { useSnapshotHistory } from "@/state/history/useSnapshotHistory";
import type { BlockEntry } from "@/state/response/state";
import { useWorkspace } from "@/state/workspace/WorkspaceProvider";
import { briefingItem } from "./briefingQuery";
import { BriefingStatusBadge } from "./BriefingStatusBadge";

function BackLink() {
  return (
    <Link href="/briefing" className="inline-flex items-center gap-1.5 justify-self-start rounded-full text-sm text-muted hover:text-ink">
      <ArrowLeft aria-hidden="true" className="h-4 w-4" />
      All briefings
    </Link>
  );
}

function Detail({ briefing }: { briefing: BriefingSnapshot }) {
  const { state } = useWorkspace();
  const { status } = briefingItem(briefing, state.drafts);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), [briefing.id]);

  const client = findClient(briefing.clientId);
  const opportunity = findOpportunity(briefing.opportunityId);
  const entries = useMemo<BlockEntry[]>(
    () => briefing.blocks.map((block, i) => ({ key: `${i}:${block.id}`, result: { status: "valid", block } })),
    [briefing.blocks],
  );
  // Same request id as in Agent, so the review form continues the same draft.
  const context = useMemo(
    () => ({
      scopeId: `briefing:${briefing.id}`,
      requestId: briefing.requestId,
      scenarioId: briefing.scenarioId,
      briefing: { reference: briefing.reference, createdAt: briefing.createdAt },
    }),
    [briefing],
  );

  return (
    <article aria-labelledby="briefing-heading" className="grid gap-5">
      <header className="grid gap-2">
        <h1 id="briefing-heading" ref={headingRef} tabIndex={-1} className="flex flex-wrap items-center gap-2 text-2xl font-semibold">
          <Briefcase aria-hidden="true" className="h-6 w-6" />
          {client?.name ?? briefing.clientId} briefing — {briefing.reference}
        </h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <span>
            Generated <time dateTime={briefing.createdAt}>{formatDateTime(briefing.createdAt)}</time>
          </span>
          <BriefingStatusBadge status={status} />
        </div>
        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-muted">Client</dt>
          <dd>
            {client?.name ?? briefing.clientId} · {briefing.clientId}
            {client ? <span className="text-muted"> · {client.sector}</span> : null}
          </dd>
          <dt className="text-muted">Opportunity</dt>
          <dd>
            {opportunity?.title ?? briefing.opportunityId} · {briefing.opportunityId}
          </dd>
        </dl>
        <p className="text-sm text-muted">
          From the Agent prompt “{briefing.prompt}” — a saved copy of the evidence from that moment, not refreshed with newer
          data.
        </p>
      </header>
      <ResponseBlockContext.Provider value={context}>
        <BlockRenderer entries={entries} />
      </ResponseBlockContext.Provider>
    </article>
  );
}

/** One saved briefing, reopened from history by its reference. Sends no request and creates no task. */
export function BriefingDetailView({
  reference,
  store = briefingHistory,
}: {
  reference: string;
  store?: SnapshotStore<BriefingSnapshot>;
}) {
  const history = useSnapshotHistory(store);
  const briefing = history.status === "ready" ? history.items.find((s) => s.reference === reference) : undefined;

  return (
    <div className="mx-auto grid w-full max-w-[1200px] content-start gap-5 px-4 py-8 sm:px-7">
      <BackLink />
      {history.status === "loading" ? <LoadingState title="Loading briefing…" /> : null}
      {history.status === "ready" && !briefing ? (
        <EmptyState title={`Briefing ${reference} isn't available`}>
          It isn&apos;t in this browser&apos;s saved history. It may have been generated in another browser or removed when
          older briefings were cleared.
        </EmptyState>
      ) : null}
      {briefing ? <Detail briefing={briefing} /> : null}
    </div>
  );
}
