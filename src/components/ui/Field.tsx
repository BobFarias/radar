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

const textControl =
  "w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink hover:border-muted aria-[invalid=true]:border-danger disabled:bg-chip";

export function TextInput({ className, ...props }: ComponentProps<"input">) {
  return <input type="text" className={cn(textControl, "min-h-10", className)} {...props} />;
}

export function TextArea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(textControl, "min-h-32 resize-y leading-relaxed", className)} {...props} />;
}
