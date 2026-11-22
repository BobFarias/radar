import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ReviewTask } from "@/contracts/api";

/**
 * Local JSON-file task store. Writes are serialised per file and atomic
 * (temp file + rename). A corrupt file is reported, never overwritten.
 */

export class TaskStorageError extends Error {}

interface StoreFile {
  tasks: ReviewTask[];
}

export function tasksFilePath(): string {
  return process.env.RADAR_TASKS_FILE ?? path.join(process.cwd(), ".data", "review-tasks.json");
}

const queues = new Map<string, Promise<unknown>>();

/** Runs fn exclusively for the given file within this process. */
export function withFileLock<T>(file: string, fn: () => Promise<T>): Promise<T> {
  const previous = queues.get(file) ?? Promise.resolve();
  const next = previous.then(fn, fn);
  queues.set(
    file,
    next.catch(() => undefined),
  );
  return next;
}

export async function readTasks(file: string): Promise<ReviewTask[]> {
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw new TaskStorageError("Task storage could not be read.");
  }
  try {
    const parsed = JSON.parse(raw) as StoreFile;
    if (!Array.isArray(parsed.tasks)) throw new Error("tasks is not an array");
    return parsed.tasks;
  } catch {
    throw new TaskStorageError("Task storage is corrupted.");
  }
}

export async function writeTasks(file: string, tasks: ReviewTask[]): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify({ tasks } satisfies StoreFile, null, 2), "utf8");
  await rename(temp, file);
}
