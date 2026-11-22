"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import type { ScenarioId } from "@/contracts/api";
import { createAnalysisSnapshot, nextReference, opportunityHistory, type AnalysisSnapshot } from "@/state/history/analysisSnapshot";
import { BRIEFING_PREFIX, briefingHistory, createBriefingSnapshot, type BriefingSnapshot } from "@/state/history/briefingSnapshot";
import type { SnapshotStore } from "@/state/history/snapshotStore";
import { randomId } from "@/state/ids";
import type { ControllerDeps } from "@/state/response/controller";
import type { ResponseState } from "@/state/response/state";
import { browserDeps, useResponseSession } from "@/state/response/useResponseSession";
import { conversationReducer, initialConversationState, type ConversationState, type ScenarioOption } from "./conversation";

/** Demo-only delay used to show an older, slower request being superseded. */
export const SLOW_RESPONSE_MS = 2500;

interface AgentSessionValue {
  scenarios: ScenarioOption[];
  conversation: ConversationState;
  live: ResponseState;
  send: (scenarioId: ScenarioId, options?: { slow?: boolean }) => void;
  retry: () => void;
}

const AgentSessionContext = createContext<AgentSessionValue | null>(null);

export function AgentSessionProvider({
  scenarios,
  deps = browserDeps,
  history = opportunityHistory,
  briefings = briefingHistory,
  children,
}: {
  scenarios: ScenarioOption[];
  deps?: ControllerDeps;
  /** Where successful opportunity analyses are saved. */
  history?: SnapshotStore<AnalysisSnapshot>;
  /** Where generated client briefings are saved. */
  briefings?: SnapshotStore<BriefingSnapshot>;
  children: ReactNode;
}) {
  const { state: live, controller } = useResponseSession(deps);
  const [conversation, dispatch] = useReducer(conversationReducer, initialConversationState);

  const promptFor = useCallback(
    (id: ScenarioId) => scenarios.find((s) => s.id === id)?.prompt ?? id,
    [scenarios],
  );
  const promptForRef = useRef(promptFor);
  useEffect(() => {
    promptForRef.current = promptFor;
  }, [promptFor]);

  // Record every state change against its request id, so finished turns keep their content.
  // An opportunity analysis (complete, or partial as unfinished) and a client briefing are also saved to history.
  // This lives in the provider (not the Agent page) so a response that finishes while the user is elsewhere is still saved.
  useEffect(
    () =>
      controller.subscribe(() => {
        const state = controller.getState();
        dispatch({ type: "snapshot_recorded", state });
        if ((state.phase !== "complete" && state.phase !== "partial") || !state.scenarioId) return;
        const meta = { prompt: promptForRef.current(state.scenarioId), now: new Date() };
        saveOnce(history, state.requestId, (existing) =>
          createAnalysisSnapshot(state, { ...meta, id: `an-${randomId()}`, reference: nextReference(existing) }),
        );
        saveOnce(briefings, state.requestId, (existing) =>
          createBriefingSnapshot(state, { ...meta, id: `br-${randomId()}`, reference: nextReference(existing, BRIEFING_PREFIX) }),
        );
      }),
    [controller, history, briefings],
  );

  const send = useCallback(
    (scenarioId: ScenarioId, options: { slow?: boolean } = {}) => {
      const requestId = controller.start(scenarioId, options.slow ? { delayMs: SLOW_RESPONSE_MS } : {});
      dispatch({ type: "turn_added", turn: { requestId, attempts: [requestId], scenarioId, prompt: promptFor(scenarioId) } });
    },
    [controller, promptFor],
  );

  // A retry is another attempt on the same turn, so the turn keeps its earlier result while it runs.
  const retry = useCallback(() => {
    const previousRequestId = controller.getState().requestId;
    const requestId = controller.retry();
    if (!requestId || !previousRequestId) return;
    dispatch({ type: "attempt_added", previousRequestId, requestId });
  }, [controller]);

  const value = useMemo(
    () => ({ scenarios, conversation, live, send, retry }),
    [scenarios, conversation, live, send, retry],
  );
  return <AgentSessionContext.Provider value={value}>{children}</AgentSessionContext.Provider>;
}

/** Adds the snapshot for a request unless one is already saved (store adds are also de-duplicated by request id). */
function saveOnce<T extends { requestId: string }>(
  store: SnapshotStore<T>,
  requestId: string | null,
  create: (existing: T[]) => T | null,
) {
  const saved = store.getSnapshot();
  const existing = saved.status === "ready" ? saved.items : [];
  if (existing.some((s) => s.requestId === requestId)) return;
  const snapshot = create(existing);
  if (snapshot) store.add(snapshot);
}

export function useAgentSession(): AgentSessionValue {
  const context = useContext(AgentSessionContext);
  if (!context) throw new Error("useAgentSession must be used inside AgentSessionProvider");
  return context;
}
