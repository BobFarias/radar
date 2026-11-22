import "server-only";
import { randomUUID } from "node:crypto";
import type { ReviewTask, ReviewTaskResponseBody } from "@/contracts/api";
import { apiError, type HandlerResult } from "../http";
import { readTasks, TaskStorageError, tasksFilePath, withFileLock, writeTasks } from "./store";
import { validateTaskInput, type ValidTaskInput } from "./validate";

function samePayload(task: ReviewTask, input: ValidTaskInput): boolean {
  return (
    task.client_id === input.client_id &&
    task.opportunity_id === input.opportunity_id &&
    task.subject === input.subject &&
    task.body === input.body
  );
}

/**
 * POST /api/review-tasks — saves a confirmed task locally. Never sends email
 * or writes to an external system.
 *  201: created · 200: same key + same payload (replayed) · 409: same key, different payload
 */
export async function createReviewTask(input: unknown): Promise<HandlerResult<ReviewTaskResponseBody>> {
  const validation = validateTaskInput(input);
  if (!validation.ok) return validation.error;
  const task = validation.value;
  const file = tasksFilePath();

  try {
    return await withFileLock(file, async () => {
      const tasks = await readTasks(file);
      const existing = tasks.find((t) => t.idempotency_key === task.idempotency_key);
      if (existing) {
        return samePayload(existing, task)
          ? { status: 200, body: { task: existing, replayed: true } }
          : apiError(409, "idempotency_conflict", "This idempotency_key was already used for a different task.");
      }

      const created: ReviewTask = {
        task_id: `TASK-${randomUUID()}`,
        ...task,
        created_at: new Date().toISOString(),
      };
      await writeTasks(file, [...tasks, created]);
      return { status: 201, body: { task: created, replayed: false } };
    });
  } catch (error) {
    if (error instanceof TaskStorageError) {
      return apiError(500, "storage_unavailable", error.message);
    }
    throw error;
  }
}
