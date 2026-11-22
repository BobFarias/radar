import { describe, expect, it, vi } from "vitest";
import type { ReviewTaskRequest } from "@/contracts/api";
import { pendingSubmission, submitReviewTask } from "./submitReviewTask";

const request: ReviewTaskRequest = {
  client_id: "CL001",
  opportunity_id: "O001",
  subject: "Subject",
  body: "Body",
  confirmed: true,
  idempotency_key: "rt-key-0001",
};

const task = { task_id: "TASK-1", ...request, created_at: "2026-11-22T10:00:00.000Z" };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

describe("submitReviewTask", () => {
  it("posts the official contract and returns the saved task", async () => {
    const fetchImpl = vi.fn(async () => json(201, { task, replayed: false }));
    await expect(submitReviewTask(request, fetchImpl)).resolves.toEqual({ ok: true, task, replayed: false });
    expect(fetchImpl).toHaveBeenCalledWith("/api/review-tasks", expect.objectContaining({ method: "POST" }));
    const calls = fetchImpl.mock.calls as unknown as Array<[string, RequestInit]>;
    expect(JSON.parse(calls[0]![1].body as string)).toEqual(request);
  });

  it("reports a replayed task as saved", async () => {
    const fetchImpl = vi.fn(async () => json(200, { task, replayed: true }));
    await expect(submitReviewTask(request, fetchImpl)).resolves.toMatchObject({ ok: true, replayed: true });
  });

  it("joins a second save of the same submission instead of sending it again", async () => {
    let release!: (r: Response) => void;
    const fetchImpl = vi.fn(() => new Promise<Response>((r) => (release = r)));
    const first = submitReviewTask(request, fetchImpl);
    const second = submitReviewTask(request, fetchImpl);
    expect(pendingSubmission(request.idempotency_key)).toBe(first);
    expect(second).toBe(first);
    release(json(201, { task, replayed: false }));
    await first;
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(pendingSubmission(request.idempotency_key)).toBeUndefined();
  });

  it.each<[string, () => Promise<Response>, boolean]>([
    ["a network failure", () => Promise.reject(new TypeError("Failed to fetch")), true],
    ["a server failure", async () => json(500, { error: { code: "storage_unavailable" } }), true],
    ["a key conflict", async () => json(409, { error: { code: "idempotency_conflict" } }), false],
    ["a rejected task", async () => json(422, { error: { code: "confirmation_required" } }), false],
    ["a response for another submission", async () => json(201, { task: { ...task, idempotency_key: "other-key-1" } }), true],
    ["an unreadable response", async () => new Response("<html>", { status: 201 }), true],
  ])("never reports %s as saved", async (_, respond, retryable) => {
    const outcome = await submitReviewTask(request, vi.fn(respond));
    expect(outcome).toMatchObject({ ok: false, error: { retryable } });
  });
});
