"use client";

import { useEffect, useMemo, useRef, type Ref } from "react";
import { Badge } from "@/components/ui";
import { ResponseBlockContext } from "@/components/blocks/ResponseBlockContext";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import type { ScenarioId } from "@/contracts/api";
import { useAgentSession } from "@/state/agent/AgentSessionProvider";
import { analysisHref, opportunityHistory } from "@/state/history/analysisSnapshot";
import { briefingHistory, briefingHref } from "@/state/history/briefingSnapshot";
import { useSnapshotHistory } from "@/state/history/useSnapshotHistory";
import { turnView, type Turn } from "@/state/agent/conversation";
import { Composer } from "./Composer";
import { ResponseOutcome } from "./ResponseOutcome";

/** Prompts shown on the landing screen; every scenario stays reachable from the composer. */
const SUGGESTED: ScenarioId[] = ["overview", "client_focus"];

function Landing({ onPick }: { onPick: (id: ScenarioId) => void }) {
  const { scenarios } = useAgentSession();
  const suggested = scenarios.filter((s) => SUGGESTED.includes(s.id));
  return (
    <div className="flex flex-1 flex-col justify-center py-10">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">What would you like to explore?</h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-muted sm:text-lg">
          Review client opportunities, check the evidence behind them and prepare a review task.
        </p>
      </div>
      <section aria-labelledby="suggested-heading" className="mt-12 grid gap-3 sm:mt-20">
        <h2 id="suggested-heading" className="text-center text-[11px] font-medium uppercase tracking-[0.3em] text-muted">
          Suggested prompts
        </h2>
        <ul className="grid gap-3">
          {suggested.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onPick(s.id)}
                className="w-full rounded-full bg-chip px-6 py-2.5 text-left text-[15px] text-ink/80 transition hover:bg-line hover:text-ink sm:text-base"
              >
                {s.prompt}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function TurnItem({
  turn,
  isActive,
  onChoosePrompt,
  ref,
}: {
  turn: Turn;
  isActive: boolean;
  onChoosePrompt: () => void;
  ref?: Ref<HTMLLIElement>;
}) {
  const { conversation, live, retry } = useAgentSession();
  const view = turnView(turn, conversation, live.requestId);
  const { shown } = view;
  // Partial if the blocks on screen came from a response that ended early.
  const incomplete = shown?.phase === "partial";
  // Once this answer was saved as an analysis, its tables show the reference and link to it.
  const history = useSnapshotHistory(opportunityHistory);
  const saved = history.status === "ready" ? history.items.find((s) => s.requestId === shown?.requestId) : undefined;
  const analysis = useMemo(
    () => (saved ? { reference: saved.reference, createdAt: saved.createdAt, href: analysisHref(saved.reference) } : undefined),
    [saved],
  );
  const briefings = useSnapshotHistory(briefingHistory);
  const savedBriefing = briefings.status === "ready" ? briefings.items.find((s) => s.requestId === shown?.requestId) : undefined;
  const briefing = useMemo(
    () => (savedBriefing ? { reference: savedBriefing.reference, createdAt: savedBriefing.createdAt, href: briefingHref(savedBriefing.reference) } : undefined),
    [savedBriefing],
  );
  const blockContext = useMemo(
    () => ({
      scopeId: turn.requestId,
      requestId: shown?.requestId ?? turn.requestId,
      scenarioId: turn.scenarioId,
      onChoosePrompt,
      incomplete,
      analysis,
      briefing,
    }),
    [shown?.requestId, turn.requestId, turn.scenarioId, onChoosePrompt, incomplete, analysis, briefing],
  );

  return (
    <li ref={ref} aria-label={`Request: ${turn.prompt}`} className="grid scroll-mt-6 gap-4">
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-3xl bg-chip px-5 py-2.5 text-[15px] sm:text-base">
          {turn.prompt}
        </p>
      </div>

      {view.superseded && shown === view.latest ? (
        <p className="text-sm text-muted">
          Replaced by a newer request before it finished. Any late response to this request is ignored.
        </p>
      ) : shown ? (
        <div className="grid gap-4">
          {/* Only the active turn announces changes; finished turns stay quiet. */}
          <div aria-live={isActive ? "polite" : "off"}>
            <ResponseOutcome view={view} scenarioId={turn.scenarioId} onRetry={isActive ? retry : undefined} />
          </div>
          {view.superseded ? (
            <p className="text-sm text-muted">Your retry was replaced by a newer request. The results below are from your previous attempt.</p>
          ) : null}
          {shown.phase !== "denied" && shown.entries.length > 0 ? (
            <section
              aria-label={incomplete ? `Incomplete response to: ${turn.prompt}` : `Response to: ${turn.prompt}`}
              aria-busy={shown.phase === "loading" || shown.phase === "streaming" || view.retrying}
              className={incomplete ? "grid gap-2 rounded-2xl border border-dashed border-warn/50 p-2" : undefined}
            >
              {incomplete ? (
                <div className="px-2 pt-1">
                  <Badge tone="warn">Incomplete results</Badge>
                </div>
              ) : null}
              <ResponseBlockContext.Provider value={blockContext}>
                <BlockRenderer entries={shown.entries} />
              </ResponseBlockContext.Provider>
            </section>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export function AgentView() {
  const { scenarios, conversation, live, send } = useAgentSession();
  const lastTurnRef = useRef<HTMLLIElement>(null);
  const promptPickerRef = useRef<HTMLSelectElement>(null);
  const choosePrompt = useMemo(
    () => () => {
      promptPickerRef.current?.scrollIntoView?.({ block: "nearest" });
      promptPickerRef.current?.focus();
    },
    [],
  );
  const turnCount = conversation.turns.length;

  useEffect(() => {
    if (turnCount === 0) return;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    lastTurnRef.current?.scrollIntoView?.({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }, [turnCount]);

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-7rem)] w-full max-w-[975px] flex-col px-4 sm:px-6 md:min-h-[calc(100dvh-2rem)]">
      {turnCount === 0 ? (
        <Landing onPick={(id) => send(id)} />
      ) : (
        <div className="flex-1 pt-8 pb-6">
          <h1 className="sr-only">Agent conversation</h1>
          <ol className="grid gap-10">
            {conversation.turns.map((turn, i) => (
              <TurnItem
                key={turn.requestId}
                ref={i === turnCount - 1 ? lastTurnRef : undefined}
                turn={turn}
                isActive={turn.attempts.at(-1) === live.requestId}
                onChoosePrompt={choosePrompt}
              />
            ))}
          </ol>
          {live.discardedResponses > 0 ? (
            <p className="mt-6 text-xs text-muted">
              {live.discardedResponses} outdated response{live.discardedResponses === 1 ? " was" : "s were"} ignored because a
              newer request was made.
            </p>
          ) : null}
        </div>
      )}

      <div data-sticky-composer className="sticky bottom-0 bg-gradient-to-t from-surface via-surface to-transparent pt-4 pb-4 sm:pb-6">
        <Composer scenarios={scenarios} selectRef={promptPickerRef} onSend={(id, { slow }) => send(id, { slow })} />
      </div>
    </div>
  );
}
