import { cn } from "./cn";

/** Status pills (Figma tab style). Toggle buttons: the pressed one is the active filter. */
export function FilterPills<V extends string>({
  label,
  options,
  value,
  counts,
  onChange,
}: {
  label: string;
  options: ReadonlyArray<{ value: V; label: string }>;
  value: V;
  counts: Record<V, number>;
  onChange: (value: V) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex h-[33px] items-center gap-1.5 rounded-full border px-5 text-sm transition",
              active ? "border-transparent bg-[#f5f1ec] text-ink" : "border-sand text-muted hover:text-ink",
            )}
          >
            {option.label}{" "}
            <span className="text-xs text-muted">{counts[option.value]}</span>
          </button>
        );
      })}
    </div>
  );
}
