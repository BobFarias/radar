import { SquareArrowOutUpRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/components/ui";
import { formatDateTime } from "@/state/format";

/**
 * Footer bar of a block that belongs to a saved snapshot (analysis or briefing):
 * icon and label, the snapshot's reference and date, and an icon link that opens
 * it in its workspace.
 */
export function SnapshotFooter({
  icon,
  label,
  snapshot,
  workspace,
  badges,
  className,
}: {
  icon: ReactNode;
  label: ReactNode;
  snapshot?: { reference: string; createdAt?: string; href?: string };
  /** Workspace name used in the link's accessible name, e.g. "Opportunities". */
  workspace: string;
  badges?: ReactNode;
  className?: string;
}) {
  return (
    <footer
      className={cn(
        "flex min-h-[39px] flex-wrap items-center gap-x-1.5 gap-y-1 bg-sand px-[17px] py-2 text-sm text-[#5f5d5a]",
        className,
      )}
    >
      {icon}
      {label}
      {snapshot ? (
        <span className="text-[#5f5d5a]">
          <span aria-hidden="true"> — </span>
          <span className="font-medium">{snapshot.reference}</span>
          {snapshot.createdAt ? (
            <>
              <span aria-hidden="true"> · </span>
              <time dateTime={snapshot.createdAt}>{formatDateTime(snapshot.createdAt, "short")}</time>
            </>
          ) : null}
        </span>
      ) : null}
      <span className="ml-auto flex items-center gap-2">
        {badges}
        {snapshot?.href ? (
          <Link
            href={snapshot.href}
            aria-label={`Open ${snapshot.reference} in ${workspace}`}
            title={`Open in ${workspace}`}
            className="grid h-8 w-8 place-items-center rounded-full text-[#5f5d5a] transition hover:bg-surface/60 hover:text-ink"
          >
            <SquareArrowOutUpRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        ) : null}
      </span>
    </footer>
  );
}
