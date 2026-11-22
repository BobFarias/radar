import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "./cn";

/**
 * Generic table primitives. They know nothing about opportunities, filtering
 * or selection — those are composed on top.
 */

export function DataTable({ caption, children, className }: { caption: string; children: ReactNode; className?: string }) {
  return (
    // Focusable scroll region so keyboard users can scroll wide tables.
    <div role="region" aria-label={`${caption} (scrollable table)`} tabIndex={0} className="scrollbar-thin overflow-x-auto">
      <table className={cn("w-full border-collapse text-left text-sm", className)}>
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export function DataTableHead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="bg-chip text-ink/80">{children}</tr>
    </thead>
  );
}

export function DataTableBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function DataTableHeaderCell({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th scope="col" className={cn("h-[50px] px-[22px] text-sm font-normal", className)} {...props} />;
}

export function DataTableRow({ selected = false, className, ...props }: HTMLAttributes<HTMLTableRowElement> & { selected?: boolean }) {
  return (
    <tr
      data-selected={selected || undefined}
      className={cn(
        "align-top transition-colors",
        selected ? "bg-accent/5 shadow-[inset_3px_0_0_var(--color-accent)]" : "even:bg-chip",
        className,
      )}
      {...props}
    />
  );
}

export function DataTableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-[22px] py-3.5", className)} {...props} />;
}

export function DataTableRowHeader({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th scope="row" className={cn("px-[22px] py-3.5 text-left font-normal", className)} {...props} />;
}
