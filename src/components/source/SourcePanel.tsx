"use client";

import { AS_OF_DATE } from "@/contracts/constants";
import { Badge, Button, Dialog, ErrorState, LoadingState } from "@/components/ui";
import { daysBetween, formatDate } from "@/state/format";
import { useSource } from "@/state/source/useSource";
import { useSourceView } from "@/state/workspace/WorkspaceProvider";
import { DocumentCanvas } from "./DocumentCanvas";
import { SourceContent } from "./SourceContent";
import { SourceViewer, SourceViewerAside, SourceViewerDocument } from "./SourceViewer";

const TITLE_ID = "source-panel-title";

/**
 * Source inspection. Original source text is shown verbatim on the document
 * canvas; AI-generated notes stay outside it. Closing does not change the selection.
 */
export function SourcePanel() {
  const { sourceView, closeSource } = useSourceView();
  const { result, reload } = useSource(sourceView?.sourceId ?? null);

  return (
    <Dialog open={sourceView !== null} onClose={closeSource} labelledBy={TITLE_ID} size="lg">
      {sourceView ? (
        <SourceViewer
          titleId={TITLE_ID}
          sourceId={sourceView.sourceId}
          title={result.status === "loaded" ? result.source.title : "Source details"}
          onClose={closeSource}
        >
          <SourceViewerDocument>
            {result.status === "loading" ? <LoadingState title="Loading source…" /> : null}

            {result.status === "not_found" ? (
              <ErrorState title="Source not found">
                No source with id <code>{sourceView.sourceId}</code> is available. The reference in this response may be
                wrong.
              </ErrorState>
            ) : null}

            {result.status === "error" ? (
              <ErrorState title="The source could not be loaded" actions={<Button onClick={reload}>Try again</Button>}>
                {result.message}
              </ErrorState>
            ) : null}

            {result.status === "loaded" ? (
              <>
                <DocumentCanvas label="Original source text">
                  <SourceContent source={result.source} />
                </DocumentCanvas>
                <p className="text-xs text-muted">
                  Check whether this describes a proposal or a rule in force before treating it as an obligation.
                </p>
              </>
            ) : null}
          </SourceViewerDocument>

          {result.status === "loaded" || (sourceView.opportunity && result.status !== "loading") ? (
            <SourceViewerAside>
              {result.status === "loaded" ? (
                <section aria-labelledby="source-details" className="grid gap-2 rounded-xl bg-surface p-4">
                  <h3 id="source-details" className="font-semibold">
                    Source details
                  </h3>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
                    <dt className="text-muted">Publisher</dt>
                    <dd>{result.source.source_name}</dd>
                    <dt className="text-muted">Published</dt>
                    <dd>
                      {formatDate(result.source.published_date)}
                      {(() => {
                        const days = daysBetween(result.source.published_date, AS_OF_DATE);
                        return days !== null && days >= 0 ? (
                          <span className="block text-muted">
                            {days} day{days === 1 ? "" : "s"} before the as-of date
                          </span>
                        ) : null;
                      })()}
                    </dd>
                    <dt className="text-muted">As-of date</dt>
                    <dd>{formatDate(AS_OF_DATE)}</dd>
                  </dl>
                </section>
              ) : null}

              {sourceView.opportunity ? (
                <section
                  aria-labelledby="source-ai-note"
                  className="grid gap-2 rounded-xl border border-dashed border-warn/40 bg-warn-bg/40 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 id="source-ai-note" className="font-semibold">
                      AI-generated note
                    </h3>
                    <Badge tone="warn">Not from the source</Badge>
                  </div>
                  <p className="font-medium">{sourceView.opportunity.title}</p>
                  <p>{sourceView.opportunity.status_note}</p>
                  <p className="text-xs text-muted">
                    From the opportunity overview for {sourceView.opportunity.client_name}. Verify against the original
                    text.
                  </p>
                </section>
              ) : null}
            </SourceViewerAside>
          ) : null}
        </SourceViewer>
      ) : null}
    </Dialog>
  );
}
