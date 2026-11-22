import type { RespondRequest, ScenarioId } from "@/contracts/api";
import { isPlainObject } from "@/validation/ajv";
import { parseRespondEnvelope, validateEvent } from "@/validation/events";
import { initialResponseState, isTerminal, responseReducer, type ResponseAction, type ResponseState } from "./state";

export interface TransportResult {
  status: number;
  body: unknown;
}

export interface ControllerDeps {
  transport: (request: RespondRequest, signal: AbortSignal) => Promise<TransportResult>;
  sleep: (ms: number, signal: AbortSignal) => Promise<void>;
  createRequestId: () => string;
  /** Simulated gap between events (progressive arrival). */
  eventIntervalMs: number;
}

export interface StartOptions {
  /** Demo-only delay before the request is sent, to force out-of-order arrival. */
  delayMs?: number;
}

export interface ResponseController {
  getState(): ResponseState;
  subscribe(listener: () => void): () => void;
  start(scenarioId: ScenarioId, options?: StartOptions): string;
  retry(): string | null;
  /** Aborts in-flight requests (e.g. on unmount); the controller stays usable. */
  cancelInFlight(): void;
}

function apiErrorFrom(body: unknown): { code: string; message: string } | null {
  if (isPlainObject(body) && isPlainObject(body.error)) {
    const { code, message } = body.error;
    if (typeof code === "string" && typeof message === "string") return { code, message };
  }
  return null;
}

export function createResponseController(deps: ControllerDeps): ResponseController {
  let state = initialResponseState;
  const listeners = new Set<() => void>();
  const inFlight = new Set<AbortController>();

  const dispatch = (action: ResponseAction) => {
    const next = responseReducer(state, action);
    if (next !== state) {
      state = next;
      listeners.forEach((l) => l());
    }
  };

  const isActive = (requestId: string) => state.requestId === requestId;

  async function run(requestId: string, scenarioId: ScenarioId, options: StartOptions, signal: AbortSignal) {
    if (options.delayMs) await deps.sleep(options.delayMs, signal);
    const response = await deps.transport({ scenario_id: scenarioId, request_id: requestId }, signal);
    if (signal.aborted) return;

    if (!isActive(requestId)) {
      dispatch({ type: "stale_response_discarded", requestId });
      return;
    }

    const envelope = parseRespondEnvelope(response.body);
    if (!envelope) {
      const apiError = apiErrorFrom(response.body);
      dispatch({
        type: "request_failed",
        requestId,
        error: {
          code: apiError?.code ?? "invalid_response",
          message: apiError?.message ?? "The response could not be read.",
          retryable: response.status >= 500 || !apiError,
        },
      });
      return;
    }
    if (envelope.request_id !== requestId) {
      dispatch({
        type: "request_failed",
        requestId,
        error: { code: "request_mismatch", message: "The response did not match this request.", retryable: true },
      });
      return;
    }

    dispatch({ type: "response_received", requestId, httpStatus: response.status, runId: envelope.run_id });

    for (const raw of envelope.events) {
      await deps.sleep(deps.eventIntervalMs, signal);
      if (signal.aborted || !isActive(requestId)) return;
      dispatch({ type: "event_received", requestId, event: validateEvent(raw) });
      if (isTerminal(state.phase)) return;
    }
    dispatch({ type: "stream_ended", requestId });
  }

  function start(scenarioId: ScenarioId, options: StartOptions = {}): string {
    const requestId = deps.createRequestId();
    const abort = new AbortController();
    inFlight.add(abort);
    dispatch({ type: "request_started", requestId, scenarioId });

    run(requestId, scenarioId, options, abort.signal)
      .catch(() => {
        if (abort.signal.aborted) return;
        if (isActive(requestId)) {
          dispatch({
            type: "request_failed",
            requestId,
            error: { code: "network_error", message: "The request could not be completed.", retryable: true },
          });
        }
      })
      .finally(() => inFlight.delete(abort));

    return requestId;
  }

  return {
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    start,

    retry: () => (state.scenarioId ? start(state.scenarioId) : null),

    cancelInFlight() {
      inFlight.forEach((a) => a.abort());
    },
  };
}
