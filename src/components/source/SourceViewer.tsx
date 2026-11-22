import { FileText, X } from "lucide-react";
import type { ReactNode } from "react";
import { Badge, Button } from "@/components/ui";

/**
 * Layout for reading a source: a sticky header, the document as the main
 * column and a side column for details and AI interpretation. Callers compose
 * the content; the viewer only arranges it.
 */
export function SourceViewer({
  titleId,
  sourceId,
  title,
  onClose,
  children,
}: {
  titleId: string;
  sourceId: string;
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <>
      <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-surface px-4 py-4 sm:px-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
            <FileText aria-hidden="true" className="h-3.5 w-3.5" />
            <span>{`Source ${sourceId}`}</span>
            <Badge>Source-text preview</Badge>
          </div>
          <h2 id={titleId} className="mt-1 text-lg font-semibold">
            {title}
          </h2>
        </div>
        <Button variant="ghost" aria-label="Close source" onClick={onClose} className="h-10 w-10 shrink-0 px-0">
          <X aria-hidden="true" className="h-5 w-5" />
        </Button>
      </header>
      <div className="grid flex-1 content-start gap-5 bg-canvas px-4 py-5 text-sm sm:px-6 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start">
        {children}
      </div>
    </>
  );
}

/** Main column: the document itself. */
export function SourceViewerDocument({ children }: { children: ReactNode }) {
  return <div className="grid min-w-0 gap-3">{children}</div>;
}

/** Side column (below the document on narrow screens): details and interpretation. */
export function SourceViewerAside({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 lg:sticky lg:top-24">{children}</div>;
}
