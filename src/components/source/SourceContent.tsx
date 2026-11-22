import type { SourceRecord } from "@/contracts/api";
import { Badge } from "@/components/ui";
import { formatDate } from "@/state/format";
import { DocumentPage } from "./DocumentCanvas";

/**
 * Renders a source record from the sources API as a single document page.
 * The text is shown verbatim; nothing is added to it, paginated or summarised.
 */
export function SourceContent({ source }: { source: SourceRecord }) {
  return (
    <DocumentPage
      header={
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink/70">{source.source_name}</p>
            <p className="mt-1 text-xs text-muted">
              <time dateTime={source.published_date}>{formatDate(source.published_date)}</time>
            </p>
          </div>
          <Badge>Verbatim</Badge>
        </div>
      }
      footer={<>Source-text preview of {source.source_id}. This is the text supplied by the sources service, not the complete original document.</>}
    >
      <p className="whitespace-pre-line">{source.content}</p>
    </DocumentPage>
  );
}
