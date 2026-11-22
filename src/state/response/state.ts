import type { ScenarioId } from "@/contracts/api";
import type { BlockValidationResult } from "@/contracts/blocks";
import type { ValidatedEvent } from "@/contracts/events";

/**
 * Response lifecycle for ONE active request. User selections and form drafts
 * live elsewhere (state/workspace) so nothing here can erase user work.
 *
 * Outcome rules — neither HTTP 200 nor a `complete` event alone means success:
 *  complete  every block valid and a complete event arrived
 *  degraded  complete event arrived, but some blocks/events failed validation
 *  partial   error event (or early end) after at least one valid block
 *  error     failure with no usable blocks
 *  denied    HTTP 403 / forbidden; any blocks are dropped
 */
export type ResponsePhase =
  | "idle"
  | "loading"
  | "streaming"
  | "complete"
  | "degraded"
  | "partial"
  | "error"
  | "denied";

export const TERMINAL_PHASES: readonly ResponsePhase[] = ["complete", "degraded", "partial", "error", "denied"];

export interface BlockEntry {
  /** Stable render key: arrival order + block id (ids may repeat). */
  key: string;
  result: BlockValidationResult;
}

export interface ResponseError {
  code: string;
  message: string;
  retryable: boolean;
}

export interface ResponseState {
  requestId: string | null;
  scenarioId: ScenarioId | null;
  runId: string | null;
  httpStatus: number | null;
  phase: ResponsePhase;
  statusMessage: string | null;
  completionMessage: string | null;
  entries: BlockEntry[];
  /** Malformed event envelopes (not blocks). */
  eventIssues: string[];
  error: ResponseError | null;
  /** Responses from superseded requests that arrived and were ignored. */
  discardedResponses: number;
}

export const initialResponseState: ResponseState = {
  requestId: null,
  scenarioId: null,
  runId: null,
  httpStatus: null,
  phase: "idle",
  statusMessage: null,
  completionMessage: null,
  entries: [],
  eventIssues: [],
  error: null,
  discardedResponses: 0,
};

export type ResponseAction =
  | { type: "request_started"; requestId: string; scenarioId: ScenarioId }
  | { type: "response_received"; requestId: string; httpStatus: number; runId: string }
  | { type: "event_received"; requestId: string; event: ValidatedEvent }
  | { type: "stream_ended"; requestId: string }
  | { type: "request_failed"; requestId: string; error: ResponseError }
  | { type: "stale_response_discarded"; requestId: string };

export function isTerminal(phase: ResponsePhase): boolean {
  return TERMINAL_PHASES.includes(phase);
}

export function hasValidBlocks(state: Pick<ResponseState, "entries">): boolean {
  return state.entries.some((e) => e.result.status === "valid");
}

function hasIssues(state: ResponseState): boolean {
  return state.eventIssues.length > 0 || state.entries.some((e) => e.result.status !== "valid");
}

function isDenied(state: ResponseState, code?: string): boolean {
  return state.httpStatus === 403 || code === "forbidden";
}

function fail(state: ResponseState, error: ResponseError): ResponseState {
  if (isDenied(state, error.code)) {
    return { ...state, phase: "denied", entries: [], error: { ...error, retryable: false } };
  }
  return { ...state, phase: hasValidBlocks(state) ? "partial" : "error", error };
}

function applyEvent(state: ResponseState, event: ValidatedEvent): ResponseState {
  switch (event.kind) {
    case "status":
      return { ...state, phase: "streaming", statusMessage: event.message };
    case "block":
      if (isDenied(state)) return state;
      return {
        ...state,
        phase: "streaming",
        entries: [
          ...state.entries,
          { key: `${state.entries.length}:${event.result.status === "valid" ? event.result.block.id : event.result.id ?? "unknown"}`, result: event.result },
        ],
      };
    case "invalid_event":
      return { ...state, eventIssues: [...state.eventIssues, ...event.errors] };
    case "complete":
      if (isDenied(state)) {
        return fail(state, { code: "forbidden", message: "Access denied.", retryable: false });
      }
      return { ...state, phase: hasIssues(state) ? "degraded" : "complete", completionMessage: event.message };
    case "error":
      return fail(state, { code: event.code, message: event.message, retryable: event.retryable });
  }
}

export function responseReducer(state: ResponseState, action: ResponseAction): ResponseState {
  if (action.type === "request_started") {
    return {
      ...initialResponseState,
      requestId: action.requestId,
      scenarioId: action.scenarioId,
      phase: "loading",
      discardedResponses: state.discardedResponses,
    };
  }
  if (action.type === "stale_response_discarded") {
    return action.requestId === state.requestId
      ? state
      : { ...state, discardedResponses: state.discardedResponses + 1 };
  }

  // Stale-response guard: only the active request may change state.
  if (action.requestId !== state.requestId || isTerminal(state.phase)) {
    return state;
  }

  switch (action.type) {
    case "response_received":
      return { ...state, httpStatus: action.httpStatus, runId: action.runId, phase: "streaming" };
    case "event_received":
      return applyEvent(state, action.event);
    case "stream_ended":
      return fail(state, {
        code: "incomplete_response",
        message: "The response ended before it was complete.",
        retryable: true,
      });
    case "request_failed":
      return fail(state, action.error);
  }
}
