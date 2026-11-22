import type { SourceRecord } from "@/contracts/api";
import { isPlainObject } from "./ajv";

const FIELDS = ["source_id", "title", "source_name", "published_date", "content"] as const;

/** Source records from the API are still untrusted at the render boundary. */
export function parseSourceRecord(value: unknown): SourceRecord | null {
  if (!isPlainObject(value) || !FIELDS.every((f) => typeof value[f] === "string")) return null;
  const v = value as Record<(typeof FIELDS)[number], string>;
  return {
    source_id: v.source_id,
    title: v.title,
    source_name: v.source_name,
    published_date: v.published_date,
    content: v.content,
  };
}
