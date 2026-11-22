import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./Button";

export function Pagination({ page, pageCount, onPage }: { page: number; pageCount: number; onPage: (page: number) => void }) {
  return (
    <nav aria-label="Pagination" className="flex items-center justify-end gap-2 text-sm">
      <Button variant="ghost" aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)} className="h-9 w-9 px-0">
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
      </Button>
      <span>
        Page {page} of {pageCount}
      </span>
      <Button variant="ghost" aria-label="Next page" disabled={page >= pageCount} onClick={() => onPage(page + 1)} className="h-9 w-9 px-0">
        <ChevronRight aria-hidden="true" className="h-4 w-4" />
      </Button>
    </nav>
  );
}
