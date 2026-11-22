"use client";

import { FileText, Quote, Sparkles } from "lucide-react";
import type { EvidenceCardsBlock } from "@/contracts/blocks";
import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui";
import { useWorkspace } from "@/state/workspace/WorkspaceProvider";

/**
 * Quoted source text and AI interpretation are visually and semantically
 * separate, so users can tell what the source says from what the AI infers.
 */
export function EvidenceCards({ block }: { block: EvidenceCardsBlock }) {
  const { openSource } = useWorkspace();
  const headingId = `${block.id}-heading`;
  return (
    <Card aria-labelledby={headingId}>
      <CardHeader title={block.title} headingId={headingId} />
      <CardBody className="grid gap-3">
        {block.items.length === 0 ? (
          <EmptyState title="No evidence was returned." />
        ) : (
          <>
            <p className="text-sm text-muted">
              Excerpts are quoted from the source documents. Interpretations are AI-generated: check them against the source.
            </p>
            <ul className="grid gap-3 md:grid-cols-2">
              {block.items.map((item, i) => (
                <li
                  key={`${item.source_id}-${i}`}
                  aria-label={`Evidence from ${item.source_id}`}
                  className="grid content-start gap-3 rounded-xl border border-line p-4 text-sm"
                >
                  <figure className="grid gap-2">
                    <figcaption className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
                      <Quote aria-hidden="true" className="h-3.5 w-3.5" />
                      Source excerpt · {item.source_id}
                    </figcaption>
                    <blockquote className="border-l-2 border-ink/30 pl-3 font-serif text-[15px] leading-relaxed">
                      {item.excerpt}
                    </blockquote>
                  </figure>
                  <div className="grid gap-1 rounded-lg bg-chip px-3 py-2">
                    <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
                      <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
                      AI interpretation
                    </p>
                    <p>{item.interpretation}</p>
                  </div>
                  {openSource ? (
                    <button
                      type="button"
                      onClick={() => openSource(item.source_id)}
                      className="inline-flex min-h-8 items-center gap-1 justify-self-start rounded-full border border-line px-2.5 text-xs font-medium hover:border-accent hover:text-accent"
                    >
                      <FileText aria-hidden="true" className="h-3.5 w-3.5" />
                      View source {item.source_id}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        )}
      </CardBody>
    </Card>
  );
}
