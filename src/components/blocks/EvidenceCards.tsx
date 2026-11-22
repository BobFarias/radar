"use client";

import { FileText } from "lucide-react";
import type { EvidenceCardsBlock } from "@/contracts/blocks";
import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui";
import { useWorkspace } from "@/state/workspace/WorkspaceProvider";

/** Quoted source text and AI interpretation are labelled separately so users can verify claims. */
export function EvidenceCards({ block }: { block: EvidenceCardsBlock }) {
  const { openSource } = useWorkspace();
  const headingId = `${block.id}-heading`;
  return (
    <Card aria-labelledby={headingId}>
      <CardHeader title={block.title} headingId={headingId} />
      <CardBody>
        {block.items.length === 0 ? (
          <EmptyState title="No evidence was returned." />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {block.items.map((item, i) => (
              <li key={`${item.source_id}-${i}`} className="rounded-xl border border-line p-4 text-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Source {item.source_id}</p>
                <blockquote className="mt-2 border-l-2 border-line pl-3">{item.excerpt}</blockquote>
                <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted">AI interpretation</p>
                <p className="mt-1">{item.interpretation}</p>
                {openSource ? (
                  <button
                    type="button"
                    onClick={() => openSource(item.source_id)}
                    className="mt-3 inline-flex min-h-8 items-center gap-1 rounded-full border border-line px-2.5 text-xs font-medium hover:border-accent hover:text-accent"
                  >
                    <FileText aria-hidden="true" className="h-3.5 w-3.5" />
                    View source {item.source_id}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
