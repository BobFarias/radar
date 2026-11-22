"use client";

import { useId, useState } from "react";
import { SCENARIO_IDS, type ScenarioId } from "@/contracts/api";
import { Button, ConfirmationState, ErrorState, LoadingState, WarningState } from "@/components/ui";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import type { ControllerDeps } from "@/state/response/controller";
import type { ResponseState } from "@/state/response/state";
import { browserDeps, useResponseSession } from "@/state/response/useResponseSession";

export interface ScenarioOption {
  id: ScenarioId;
  prompt: string;
}

function Outcome({ state, onRetry }: { state: ResponseState; onRetry: () => void }) {
  const retry = state.error?.retryable ? (
    <Button variant="secondary" onClick={onRetry}>
      Retry
    </Button>
  ) : null;

  switch (state.phase) {
    case "idle":
      return null;
    case "loading":
      return <LoadingState title="Sending request…" />;
    case "streaming":
      return <LoadingState title={state.statusMessage ?? "Receiving response…"} />;
    case "complete":
      return <ConfirmationState title={state.completionMessage ?? "Response complete."} />;
    case "degraded":
      return (
        <WarningState title="Response finished with problems">
          Some parts of this response could not be displayed and are marked below.
        </WarningState>
      );
    case "partial":
      return (
        <ErrorState title="Incomplete response" actions={retry}>
          {state.error?.message} The results below are partial.
        </ErrorState>
      );
    case "error":
      return (
        <ErrorState title="The response failed" actions={retry}>
          {state.error?.message}
        </ErrorState>
      );
    case "denied":
      return <ErrorState title="Access denied">{state.error?.message}</ErrorState>;
  }
}

/** Phase 1 harness: visible scenario selector driving the response lifecycle. */
export function ScenarioRunner({ scenarios, deps = browserDeps }: { scenarios: ScenarioOption[]; deps?: ControllerDeps }) {
  const { state, start, retry } = useResponseSession(deps);
  const [scenario, setScenario] = useState<ScenarioId>(scenarios[0]?.id ?? SCENARIO_IDS[0]);
  const selectId = useId();

  return (
    <div className="grid gap-5">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          start(scenario);
        }}
      >
        <div className="grid min-w-0 flex-1 gap-1">
          <label htmlFor={selectId} className="text-xs font-medium uppercase tracking-wide text-muted">
            Demo scenario
          </label>
          <select
            id={selectId}
            value={scenario}
            onChange={(e) => setScenario(e.target.value as ScenarioId)}
            className="min-h-10 rounded-full border border-line bg-surface px-4 text-sm"
          >
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id} — {s.prompt}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="primary">
          Send
        </Button>
      </form>

      <div aria-live="polite">
        <Outcome state={state} onRetry={() => retry()} />
      </div>

      {state.discardedResponses > 0 ? (
        <p className="text-xs text-muted">
          {state.discardedResponses} outdated response{state.discardedResponses === 1 ? " was" : "s were"} ignored because a
          newer request was made.
        </p>
      ) : null}

      {state.phase !== "denied" && state.entries.length > 0 ? (
        <section aria-label="Response" aria-busy={state.phase === "streaming"}>
          <BlockRenderer entries={state.entries} />
        </section>
      ) : null}
    </div>
  );
}
