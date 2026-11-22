import type { ReviewTask, ReviewTaskRequest } from "@/contracts/api";
import { isPlainObject } from "@/validation/ajv";

export const REVIEW_TASK_LIMITS = { subject: 200, body: 5000 } as const;

export interface SubmitError {
  title: string;
  message: string;
  /** Trying again with the same key is safe and may succeed. */
  retryable: boolean;
}

export type SubmitOutcome = { ok: true; task: ReviewTask; replayed: boolean } | { ok: false; error: SubmitError };

const RETRY_HINT = "Your edits are kept. Trying again won't create a duplicate task.";

function isTask(value: unknown, key: string): value is ReviewTask {
  return (
    isPlainObject(value) &&
    typeof value.task_id === "string" &&
    value.task_id.length > 0 &&
    typeof value.created_at === "string" &&
    value.idempotency_key === key
  );
}

function errorFor(status: number): SubmitError {
  if (status === 409) {
    return {
      title: "This draft changed after an earlier save",
      message: "Go back to editing and confirm again to save the current version.",
      retryable: false,
    };
  }
  if (status === 400 || status === 422) {
    return {
      title: "RADAR couldn't accept this task",
      message: "Check the subject and body, then confirm again. Your edits are kept.",
      retryable: false,
    };
  }
  return { title: "The task couldn't be saved", message: `RADAR's task store isn't available right now. ${RETRY_HINT}`, retryable: true };
}

/** In-flight saves by idempotency key: a second request for the same submission joins the first. */
const pending = new Map<string, Promise<SubmitOutcome>>();

export const pendingSubmission = (idempotencyKey: string) => pending.get(idempotencyKey);

async function post(request: ReviewTaskRequest, fetchImpl: typeof fetch): Promise<SubmitOutcome> {
  let response: Response;
  try {
    response = await fetchImpl("/api/review-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  } catch {
    return {
      ok: false,
      error: { title: "RADAR couldn't be reached", message: `Check your connection. ${RETRY_HINT}`, retryable: true },
    };
  }
  if (response.status !== 200 && response.status !== 201) return { ok: false, error: errorFor(response.status) };
  const body: unknown = await response.json().catch(() => null);
  if (!isPlainObject(body) || !isTask(body.task, request.idempotency_key)) {
    return { ok: false, error: errorFor(500) };
  }
  // Only a confirmed server response counts as saved.
  return { ok: true, task: body.task, replayed: body.replayed === true };
}

/**
 * POST /api/review-tasks. The idempotency key identifies one submission:
 * repeats (double clicks, retries after an unknown outcome) return the same
 * task instead of creating another.
 */
export function submitReviewTask(request: ReviewTaskRequest, fetchImpl: typeof fetch = fetch): Promise<SubmitOutcome> {
  const existing = pending.get(request.idempotency_key);
  if (existing) return existing;
  const promise = post(request, fetchImpl).finally(() => pending.delete(request.idempotency_key));
  pending.set(request.idempotency_key, promise);
  return promise;
}
