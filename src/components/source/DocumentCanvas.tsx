import type { ReactNode } from "react";
import { cn } from "@/components/ui";

/**
 * Reading surface for original documents. Holds one or more DocumentPage
 * children, so a future PDF or multi-page renderer can supply its own pages
 * without changing the viewer around it.
 */
export function DocumentCanvas({
  label,
  children,
  className,
}: {
  /** Accessible name of the region, e.g. "Original source text". */
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section aria-label={label} className={cn("grid justify-items-center gap-4 rounded-2xl bg-chip p-3 sm:p-6", className)}>
      {children}
    </section>
  );
}

/** A single paper-like sheet. Header and footer slots hold the masthead and notes printed on the page. */
export function DocumentPage({
  header,
  footer,
  children,
}: {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <article className="w-full max-w-[680px] rounded-sm bg-surface px-6 py-8 shadow-[0_1px_3px_rgba(31,31,31,0.08),0_8px_24px_rgba(31,31,31,0.06)] ring-1 ring-line sm:px-12 sm:py-12">
      {header ? <header className="mb-6 border-b border-line pb-4">{header}</header> : null}
      <div className="font-serif text-[15px] leading-7 text-ink">{children}</div>
      {footer ? <footer className="mt-10 border-t border-line pt-3 text-xs text-muted">{footer}</footer> : null}
    </article>
  );
}
