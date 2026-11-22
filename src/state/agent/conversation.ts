import type { ScenarioId } from "@/contracts/api";
import { isTerminal, type ResponseState } from "@/state/response/state";

/**
 * In-session conversation: one turn per prompt. A turn can have several
 * attempts (retries); each attempt is a request with its own id, and its
 * content comes from the response snapshots recorded for that id.
 */

export interface ScenarioOption {
  id: ScenarioId;
  prompt: string;
}

export interface Turn {
  /** Id of the first attempt; stable key for the turn. */
  requestId: string;
  /** Every attempt's request id, oldest first. */
  attempts: string[];
  scenarioId: ScenarioId;
  prompt: string;
}

export interface ConversationState {
  turns: Turn[];
  snapshots: Record<string, ResponseState>;
}

export const initialConversationState: ConversationState = { turns: [], snapshots: {} };

export type ConversationAction =
  | { type: "turn_added"; turn: Turn }
  | { type: "attempt_added"; previousRequestId: string; requestId: string }
  | { type: "snapshot_recorded"; state: ResponseState };

export function conversationReducer(state: ConversationState, action: ConversationAction): ConversationState {
  switch (action.type) {
    case "turn_added":
      return { ...state, turns: [...state.turns, action.turn] };
    case "attempt_added": {
      const index = state.turns.findIndex((t) => t.attempts.at(-1) === action.previousRequestId);
      if (index === -1) return state;
      const turns = [...state.turns];
      const turn = turns[index]!;
      turns[index] = { ...turn, attempts: [...turn.attempts, action.requestId] };
      return { ...state, turns };
    }
    case "snapshot_recorded": {
      const id = action.state.requestId;
      if (!id || state.snapshots[id] === action.state) return state;
      return { ...state, snapshots: { ...state.snapshots, [id]: action.state } };
    }
  }
}

export interface TurnView {
  /** State of the latest attempt. */
  latest: ResponseState | null;
  /** State whose blocks are on screen: the latest attempt, or an earlier one while a retry is pending or after it failed. */
  shown: ResponseState | null;
  /** Number of attempts made for this turn. */
  attempt: number;
  /** A retry is in progress; the previous result stays visible. */
  retrying: boolean;
  /** The latest retry ended without content; the previous result is still shown. */
  retryFailed: boolean;
  /** The latest attempt was replaced by a newer request before it finished. */
  superseded: boolean;
}

const hasContent = (s: ResponseState | undefined): s is ResponseState =>
  !!s && s.phase !== "denied" && s.entries.length > 0 && isTerminal(s.phase);

export function turnView(turn: Turn, conversation: ConversationState, activeRequestId: string | null): TurnView {
  const latestId = turn.attempts.at(-1) ?? turn.requestId;
  const latest = conversation.snapshots[latestId] ?? null;
  const previous = turn.attempts
    .slice(0, -1)
    .map((id) => conversation.snapshots[id])
    .findLast(hasContent);
  const settled = latest !== null && isTerminal(latest.phase);
  const superseded = latestId !== activeRequestId && !settled;
  const retrying = !settled && !superseded && previous !== undefined;
  const retryFailed = settled && latest.entries.length === 0 && latest.phase === "error" && previous !== undefined;

  return {
    latest,
    shown: (retrying || retryFailed || superseded) && previous ? previous : latest,
    attempt: turn.attempts.length,
    retrying,
    retryFailed,
    superseded,
  };
}
