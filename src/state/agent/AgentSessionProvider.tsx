"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, type ReactNode } from "react";
import type { ScenarioId } from "@/contracts/api";
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
  children,
}: {
  scenarios: ScenarioOption[];
  deps?: ControllerDeps;
  children: ReactNode;
}) {
  const { state: live, controller } = useResponseSession(deps);
  const [conversation, dispatch] = useReducer(conversationReducer, initialConversationState);

  // Record every state change against its request id, so finished turns keep their content.
  useEffect(
    () =>
      controller.subscribe(() => {
        dispatch({ type: "snapshot_recorded", state: controller.getState() });
      }),
    [controller],
  );

  const promptFor = useCallback(
    (id: ScenarioId) => scenarios.find((s) => s.id === id)?.prompt ?? id,
    [scenarios],
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

export function useAgentSession(): AgentSessionValue {
  const context = useContext(AgentSessionContext);
  if (!context) throw new Error("useAgentSession must be used inside AgentSessionProvider");
  return context;
}
