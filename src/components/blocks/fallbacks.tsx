"use client";

import { ListRestart } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { BlockType } from "@/contracts/blocks";
import { Button, CopyButton, WarningState, type CopyState } from "@/components/ui";
import { useResponseBlockContext } from "./ResponseBlockContext";
import { buildIssueReport, type BlockIssueKind } from "./issueReport";
import { BLOCK_LABELS } from "./registry";

interface BlockIssueProps {
  kind: BlockIssueKind;
  title: string;
  /** What happened, in plain language. */
  explanation: ReactNode;
  blockId: string | null;
  blockType: string | null;
  errors?: string[];
  /** Number of other sections in the same answer that are still shown. */
  otherSections: number;
}

export const COPIED_MESSAGE = "Copied. Paste it into your support request.";
export const COPY_FAILED_MESSAGE = "Couldn't copy automatically. The report is under Technical details.";

/**
 * Shared layout for a block that couldn't be shown: what happened, what is
 * unaffected, what to do next, and a copyable report for support. Nothing is
 * retried or sent anywhere automatically.
 */
function BlockIssue({ kind, title, explanation, blockId, blockType, errors, otherSections }: BlockIssueProps) {
  const { requestId, scenarioId, onChoosePrompt } = useResponseBlockContext();
  const [copy, setCopy] = useState<CopyState>("idle");
  const [reportedAt] = useState(() => new Date());
  const report = buildIssueReport({ kind, blockId, blockType, errors, requestId, scenarioId, generatedAt: reportedAt });


  return (
    <WarningState
      title={title}
      actions={
        <>
          {onChoosePrompt ? (
            <Button variant="secondary" onClick={onChoosePrompt}>
              <ListRestart aria-hidden="true" className="h-4 w-4" />
              Choose a supported prompt
            </Button>
          ) : null}
          <CopyButton
            text={report}
            label="Copy issue report"
            copiedMessage={COPIED_MESSAGE}
            failedMessage={COPY_FAILED_MESSAGE}
            onStateChange={setCopy}
          />
        </>
      }
    >
      <div className="grid gap-2 text-ink/85">
        <p>{explanation}</p>
        <p>
          {otherSections > 0
            ? `The other ${otherSections === 1 ? "section" : `${otherSections} sections`} of this answer ${otherSections === 1 ? "is" : "are"} shown as usual. `
            : ""}
          Your selections and filters haven&apos;t changed.
        </p>
        <details open={copy === "failed" || undefined} className="text-xs">
          <summary className="cursor-pointer font-medium">Technical details</summary>
          <p className="mt-2 text-muted">Safe to share with support. It contains identifiers only, not the content of the answer.</p>
          <pre className="mt-1 overflow-x-auto rounded-lg bg-surface/70 p-3 font-mono whitespace-pre-wrap text-ink">{report}</pre>
        </details>
      </div>
    </WarningState>
  );
}

/** Unknown component type. The payload is never rendered; the type appears only in the report. */
export function UnsupportedBlockFallback({ id, type, otherSections = 0 }: { id: string | null; type: string | null; otherSections?: number }) {
  return (
    <BlockIssue
      kind="unsupported"
      title="This part of the answer can't be shown here"
      explanation="The answer included a type of view that this version of RADAR doesn't support yet, so we left it out. Nothing from it was run or displayed."
      blockId={id}
      blockType={type}
      otherSections={otherSections}
    />
  );
}

/** Known component whose data failed schema validation. Never rendered with coerced data. */
export function InvalidBlockFallback({
  id,
  type,
  errors,
  otherSections = 0,
}: {
  id: string | null;
  type: BlockType;
  errors: string[];
  otherSections?: number;
}) {
  const label = BLOCK_LABELS[type];
  return (
    <BlockIssue
      kind="invalid"
      title={`This ${label} couldn't be shown`}
      explanation={`Some of the information for this ${label} wasn't in the expected format, so we left it out rather than risk showing something incorrect.`}
      blockId={id}
      blockType={type}
      errors={errors}
      otherSections={otherSections}
    />
  );
}

/** A valid block whose component failed while rendering. */
export function RenderErrorFallback({ id, type, otherSections = 0 }: { id: string; type: BlockType; otherSections?: number }) {
  const label = BLOCK_LABELS[type];
  return (
    <BlockIssue
      kind="render_error"
      title={`Something went wrong showing this ${label}`}
      explanation={`The information arrived, but RADAR couldn't display this ${label}.`}
      blockId={id}
      blockType={type}
      otherSections={otherSections}
    />
  );
}
