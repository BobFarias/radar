import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST } from "./route";

let dir: string;
let file: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "radar-tasks-"));
  file = path.join(dir, "tasks.json");
  process.env.RADAR_TASKS_FILE = file;
});

afterEach(async () => {
  delete process.env.RADAR_TASKS_FILE;
  await rm(dir, { recursive: true, force: true });
});

const valid = (overrides: Record<string, unknown> = {}) => ({
  client_id: "CL001",
  opportunity_id: "O001",
  subject: "Payment resilience consultation",
  body: "Discuss the consultation with the relationship partner.",
  confirmed: true,
  idempotency_key: "key-0001-abcd",
  ...overrides,
});

function call(body: unknown): Promise<Response> {
  return POST(
    new Request("http://test/api/review-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

async function storedTasks(): Promise<unknown[]> {
  try {
    return JSON.parse(await readFile(file, "utf8")).tasks;
  } catch {
    return [];
  }
}

describe("POST /api/review-tasks", () => {
  it("persists a confirmed task and returns a task_id", async () => {
    const res = await call(valid());
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.replayed).toBe(false);
    expect(body.task.task_id).toMatch(/^TASK-/);
    expect(body.task).toMatchObject({ client_id: "CL001", opportunity_id: "O001" });
    expect(await storedTasks()).toEqual([body.task]);
  });

  it.each([[{ confirmed: false }], [{ confirmed: undefined }]])(
    "rejects a task without explicit confirmation (%j)",
    async (override) => {
      const res = await call(valid(override));
      expect(res.status).toBe(422);
      expect((await res.json()).error.code).toBe("confirmation_required");
      expect(await storedTasks()).toEqual([]);
    },
  );

  it("does not accept truthy non-boolean confirmation", async () => {
    const res = await call(valid({ confirmed: "true" }));
    expect(res.status).toBe(400);
    expect(await storedTasks()).toEqual([]);
  });

  it("rejects an unknown client", async () => {
    const res = await call(valid({ client_id: "CL999" }));
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("unknown_client");
  });

  it("rejects an unknown opportunity", async () => {
    const res = await call(valid({ opportunity_id: "O999" }));
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("unknown_opportunity");
  });

  it("rejects an opportunity that belongs to a different client", async () => {
    const res = await call(valid({ client_id: "CL001", opportunity_id: "O003" }));
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("opportunity_client_mismatch");
    expect(await storedTasks()).toEqual([]);
  });

  it.each([
    ["empty subject", { subject: "   " }],
    ["missing body", { body: undefined }],
    ["overlong subject", { subject: "x".repeat(201) }],
    ["short idempotency key", { idempotency_key: "abc" }],
    ["missing client_id", { client_id: undefined }],
  ])("rejects %s with 400", async (_label, override) => {
    const res = await call(valid(override));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("invalid_request");
  });

  it("returns the existing task for a repeated idempotency key without duplicating", async () => {
    const first = await (await call(valid())).json();
    const res = await call(valid());
    const second = await res.json();
    expect(res.status).toBe(200);
    expect(second).toEqual({ task: first.task, replayed: true });
    expect(await storedTasks()).toHaveLength(1);
  });

  it("creates only one task when the same key is submitted concurrently", async () => {
    const responses = await Promise.all(Array.from({ length: 5 }, () => call(valid())));
    const bodies = await Promise.all(responses.map((r) => r.json()));
    expect(new Set(bodies.map((b) => b.task.task_id)).size).toBe(1);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 200, 200, 200, 201]);
    expect(await storedTasks()).toHaveLength(1);
  });

  it("rejects a reused key with a different payload (409)", async () => {
    await call(valid());
    const res = await call(valid({ subject: "Something else" }));
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("idempotency_conflict");
    expect(await storedTasks()).toHaveLength(1);
  });

  it("creates separate tasks for different keys", async () => {
    await call(valid());
    await call(valid({ idempotency_key: "key-0002-abcd" }));
    expect(await storedTasks()).toHaveLength(2);
  });

  it("fails safely without overwriting corrupted storage", async () => {
    await writeFile(file, "{not json", "utf8");
    const res = await call(valid());
    expect(res.status).toBe(500);
    expect((await res.json()).error.code).toBe("storage_unavailable");
    expect(await readFile(file, "utf8")).toBe("{not json");
  });
});
