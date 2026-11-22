import "server-only";
import { isScenarioId, type RespondResponseBody } from "@/contracts/api";
import { isPlainObject } from "@/validation/ajv";
import { findFixture } from "./catalog";
import { apiError, type HandlerResult } from "./http";

export const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

/**
 * POST /api/respond — returns the chosen fixture's HTTP status, run_id and
 * events, echoing request_id so the client can discard stale responses.
 * Events are passed through unmodified: the client validates them at the
 * render boundary.
 */
export function respond(input: unknown): HandlerResult<RespondResponseBody> {
  if (!isPlainObject(input)) {
    return apiError(400, "invalid_request", "Request body must be a JSON object.");
  }

  const { scenario_id, request_id } = input;
  const details: string[] = [];
  if (typeof scenario_id !== "string") details.push("scenario_id must be a string");
  if (typeof request_id !== "string" || !REQUEST_ID_PATTERN.test(request_id)) {
    details.push("request_id must be 1-128 characters of letters, digits, '.', '_', ':' or '-'");
  }
  if (details.length > 0 || typeof request_id !== "string") {
    return apiError(400, "invalid_request", "Invalid respond request.", details);
  }

  const fixture = isScenarioId(scenario_id) ? findFixture(scenario_id) : undefined;
  if (!isScenarioId(scenario_id) || !fixture) {
    return apiError(404, "unknown_scenario", `Unknown scenario "${String(scenario_id)}".`);
  }

  // Access is enforced here, not in the UI: a denied response never carries
  // anything except its error events.
  const events =
    fixture.http_status === 403
      ? fixture.events.filter((e) => isPlainObject(e) && e.kind === "error")
      : fixture.events;

  return {
    status: fixture.http_status,
    body: { request_id, scenario_id, run_id: fixture.run_id, events },
  };
}
