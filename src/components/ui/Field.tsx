import { useId, type ReactNode, type ComponentProps } from "react";
import { cn } from "./cn";

export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "min-h-10 w-full rounded-full border border-line bg-surface px-4 pr-8 text-sm text-ink hover:border-muted",
        className,
      )}
      {...props}
    />
  );
}

/** Label + control. The child receives the generated id via render prop. */
export function Field({ label, children, className }: { label: string; children: (id: string) => ReactNode; className?: string }) {
  const id = useId();
  return (
    <div className={cn("grid gap-1", className)}>
      <label htmlFor={id} className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
        {label}
      </label>
      {children(id)}
    </div>
  );
}
