import "server-only";
import type { SourceRecord } from "@/contracts/api";
import { findSource } from "./catalog";
import { apiError, type HandlerResult } from "./http";

/** GET /api/sources/:source_id */
export function getSource(sourceId: string): HandlerResult<SourceRecord> {
  const source = findSource(sourceId);
  if (!source) {
    return apiError(404, "source_not_found", `No source found with id "${sourceId}".`);
  }
  return { status: 200, body: source };
}
