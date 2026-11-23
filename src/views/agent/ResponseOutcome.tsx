"use client";

import { RotateCw } from "lucide-react";
import { useState } from "react";
import { COPIED_MESSAGE } from "@/components/blocks/fallbacks";
import { buildResponseIssueReport } from "@/components/blocks/issueReport";
import { Button, ConfirmationState, CopyButton, ErrorState, WarningState } from "@/components/ui";
import type { TurnView } from "@/state/agent/conversation";
import type { ResponseState } from "@/state/response/state";

function StatusLine({ text }: { text: string }) {
  return (
    <p role="status" aria-busy="true" className="flex items-center gap-2 text-[15px] text-muted">
      <span>…{text}</span>
      <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-accent motion-reduce:animate-none" />
    </p>
  );
}

/**
 * Keeps keyboard focus in place while a retry runs: the button stays in the
 * tab order but is marked unavailable.
 */
function TryAgainButton({ retrying, onRetry }: { retrying: boolean; onRetry: () => void }) {
  return (
    <Button aria-disabled={retrying || undefined} onClick={retrying ? undefined : onRetry} className={retrying ? "opacity-70" : undefined}>
      <RotateCw aria-hidden="true" className={retrying ? "h-4 w-4 animate-spin motion-reduce:animate-none" : "h-4 w-4"} />
      {retrying ? "Trying again…" : "Try again"}
    </Button>
  );
}

/** What happened on the latest attempt, announced politely. */
function attemptFeedback(view: TurnView): string | null {
  if (view.retrying) return "Trying again. Your current results stay available while we retry.";
  if (view.retryFailed) {
    return `Trying again didn't work: ${view.latest?.error?.message ?? "the request failed."} The results below are from your previous attempt.`;
  }
  if (view.attempt > 1 && view.latest?.phase === "partial") {
    return `We tried again (attempt ${view.attempt}), but the supporting information is still unavailable. The results below are from your latest attempt.`;
  }
  return null;
}

/**
 * A response that ended early with some valid blocks. Results stay usable;
 * nothing implies they are the complete dataset.
 */
function PartialOutcome({
  view,
  shown,
  scenarioId,
  onRetry,
}: {
  view: TurnView;
  shown: ResponseState;
  scenarioId: string;
  onRetry?: () => void;
}) {
  const [reportedAt] = useState(() => new Date());
  const retryable = (view.latest?.error ?? shown.error)?.retryable ?? false;
  const feedback = attemptFeedback(view);
  const requestIds = [shown.requestId, view.latest?.requestId].filter((id, i, all): id is string => !!id && all.indexOf(id) === i);
  const report = buildResponseIssueReport({
    errorCode: (view.retryFailed ? view.latest?.error?.code : shown.error?.code) ?? "unknown",
    requestIds,
    runId: shown.runId,
    scenarioId,
    sectionsShown: shown.entries.length,
    generatedAt: reportedAt,
  });

  return (
    <section aria-labelledby={`partial-${shown.requestId}`} className="grid gap-3 rounded-xl bg-warn-bg px-4 py-4 text-sm text-ink sm:px-5">
      <div className="grid gap-1">
        <h2 id={`partial-${shown.requestId}`} className="text-[15px] font-semibold text-warn">
          Your opportunity summary is partially ready
        </h2>
        <p>We found some opportunities, but couldn&apos;t finish retrieving the supporting information.</p>
      </div>
      <ul className="grid list-disc gap-1 pl-5 text-ink/85">
        <li>Available results are shown below and remain accessible.</li>
        <li>Some opportunities or supporting evidence may be missing.</li>
      </ul>
      {/* Announced through the turn's polite live region. */}
      <p className="font-medium text-ink empty:hidden">
        {feedback}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {retryable && onRetry ? <TryAgainButton retrying={view.retrying} onRetry={onRetry} /> : null}
        <CopyButton
          text={report}
          label="Copy issue report"
          copiedMessage={COPIED_MESSAGE}
          failedMessage="Couldn't copy automatically. The report is under Technical details."
        />
      </div>
      <details className="text-xs">
        <summary className="cursor-pointer font-medium">Technical details</summary>
        <p className="mt-2 text-muted">Safe to share with support. It contains identifiers only, not the content of the answer.</p>
        <pre className="mt-1 overflow-x-auto rounded-lg bg-surface/70 p-3 font-mono whitespace-pre-wrap">{report}</pre>
      </details>
    </section>
  );
}

/**
 * Overall outcome of a turn. Success is only shown for `complete`; a complete
 * event with failed blocks is reported as a problem. `onRetry` is given only
 * to the active turn.
 */
export function ResponseOutcome({ view, scenarioId, onRetry }: { view: TurnView; scenarioId: string; onRetry?: () => void }) {
  const { shown } = view;
  if (!shown) return null;

  // Earlier content is on screen (retry pending or failed): keep the partial framing.
  if (shown !== view.latest || shown.phase === "partial") {
    return <PartialOutcome view={view} shown={shown} scenarioId={scenarioId} onRetry={onRetry} />;
  }

  const retry =
    shown.error?.retryable && onRetry ? (
      <Button variant="secondary" onClick={onRetry}>
        Try again
      </Button>
    ) : null;

  switch (shown.phase) {
    case "idle":
      return null;
    case "loading":
      return <StatusLine text="Sending request" />;
    case "streaming":
      return <StatusLine text={shown.statusMessage ?? "Receiving response"} />;
    case "complete":
      return <ConfirmationState title={shown.completionMessage ?? "Response complete."} />;
    case "degraded":
      return (
        <WarningState title="Response finished with problems">
          Some parts of this response could not be displayed and are marked below.
        </WarningState>
      );
    case "error":
      return (
        <ErrorState title="The response failed" actions={retry}>
          {shown.error?.message}
        </ErrorState>
      );
    case "denied":
      return <ErrorState title="Access denied">{shown.error?.message}</ErrorState>;
  }
}
