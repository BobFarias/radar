import { useId } from "react";

export interface RadioOption<T extends string> {
  value: T;
  label: string;
}

/** Single-choice group styled after the Figma filter menu (spaced caps header, round markers). */
export function RadioGroup<T extends string>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: Array<RadioOption<T>>;
  value: T;
  onChange: (value: T) => void;
}) {
  const name = useId();
  return (
    <fieldset className="grid gap-1">
      <legend className="mb-1 px-0 text-[11px] font-semibold uppercase tracking-[0.3em] text-ink/70">{legend}</legend>
      {options.map((option) => (
        <label key={option.value} className="flex min-h-[25px] cursor-pointer items-center gap-2.5 rounded-md text-sm font-medium text-ink/85">
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="h-4 w-4 shrink-0 cursor-pointer appearance-none rounded-full bg-[#d9d9d9] transition checked:bg-accent checked:shadow-[inset_0_0_0_4px_#d9d9d9]"
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}
