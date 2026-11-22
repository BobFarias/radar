import "server-only";
import type { ApiErrorBody } from "@/contracts/api";

export interface HandlerResult<T> {
  status: number;
  body: T | ApiErrorBody;
}

export function apiError(status: number, code: string, message: string, details?: string[]): HandlerResult<never> {
  return { status, body: { error: { code, message, ...(details?.length ? { details } : {}) } } };
}

/** Parses a JSON request body without throwing; returns undefined when unparseable. */
export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

export function toResponse<T>(result: HandlerResult<T>): Response {
  return Response.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "no-store" },
  });
}
