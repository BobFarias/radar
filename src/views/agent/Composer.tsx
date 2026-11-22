"use client";

import { ArrowUp } from "lucide-react";
import { useId, useState, type Ref } from "react";
import type { ScenarioId } from "@/contracts/api";
import { Field, Select } from "@/components/ui";
import type { ScenarioOption } from "@/state/agent/conversation";

/**
 * Prompt composer. Prompts are chosen from the supplied demo scenarios —
 * there is no free-text input, because no live model answers arbitrary text.
 */
export function Composer({
  scenarios,
  onSend,
  selectRef,
}: {
  scenarios: ScenarioOption[];
  onSend: (scenarioId: ScenarioId, options: { slow: boolean }) => void;
  /** Lets the conversation move focus to the prompt picker. */
  selectRef?: Ref<HTMLSelectElement>;
}) {
  const [scenario, setScenario] = useState<ScenarioId | undefined>(scenarios[0]?.id);
  const [slow, setSlow] = useState(false);
  const slowId = useId();

  return (
    <form
      aria-label="Send a demo prompt"
      onSubmit={(e) => {
        e.preventDefault();
        if (scenario) onSend(scenario, { slow });
      }}
      className="rounded-2xl border border-line bg-surface p-4 shadow-[0_10px_30px_-12px_rgba(31,31,31,0.18)]"
    >
      <div className="flex items-end gap-3">
        <Field label="Demo prompt" className="min-w-0 flex-1">
          {(id) => (
            <Select ref={selectRef} id={id} value={scenario} onChange={(e) => setScenario(e.target.value as ScenarioId)} className="truncate">
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.prompt} ({s.id})
                </option>
              ))}
            </Select>
          )}
        </Field>
        <button
          type="submit"
          aria-label="Send prompt"
          className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-full bg-accent text-accent-ink transition hover:brightness-95"
        >
          <ArrowUp aria-hidden="true" className="h-5 w-5" />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <p>Answers come from the assessment&apos;s demo responses. Free-text questions aren&apos;t supported.</p>
        <div className="flex items-center gap-2">
          <input id={slowId} type="checkbox" checked={slow} onChange={(e) => setSlow(e.target.checked)} className="h-4 w-4 accent-accent" />
          <label htmlFor={slowId}>Simulate a slow response</label>
        </div>
      </div>
    </form>
  );
}
