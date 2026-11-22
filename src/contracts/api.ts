/** Request/response DTOs for the three endpoints in docs/API_Contract.txt. */

export const SCENARIO_IDS = [
  "overview",
  "client_focus",
  "partial_then_error",
  "unsupported_block",
  "malformed_block",
  "permission_denied",
] as const;
export type ScenarioId = (typeof SCENARIO_IDS)[number];

export function isScenarioId(value: unknown): value is ScenarioId {
  return typeof value === "string" && (SCENARIO_IDS as readonly string[]).includes(value);
}

export interface RespondRequest {
  scenario_id: ScenarioId;
  request_id: string;
}

/** Body of POST /api/respond. HTTP status mirrors the fixture's http_status. */
export interface RespondResponseBody {
  request_id: string;
  scenario_id: ScenarioId;
  run_id: string;
  events: unknown[];
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: string[];
  };
}

export interface SourceRecord {
  source_id: string;
  title: string;
  source_name: string;
  published_date: string;
  content: string;
}

export interface ReviewTaskRequest {
  client_id: string;
  opportunity_id: string;
  subject: string;
  body: string;
  confirmed: true;
  idempotency_key: string;
}

export interface ReviewTask {
  task_id: string;
  client_id: string;
  opportunity_id: string;
  subject: string;
  body: string;
  idempotency_key: string;
  created_at: string;
}

export interface ReviewTaskResponseBody {
  task: ReviewTask;
  /** true when an earlier task with the same idempotency_key was returned. */
  replayed: boolean;
}
