import { isPlainObject } from "@/validation/ajv";
import type { Draft } from "./state";

/**
 * Review-form drafts are kept in localStorage so an unsaved draft can be
 * continued after a reload. Every entry is validated on read; unreadable
 * entries are dropped and counted. Storage failures never break editing.
 */

export const DRAFTS_KEY = "radar.drafts.v1";
const MAX_DRAFTS = 50;
const MAX_TEXT = 20_000;
const KEY_PATTERN = /^[A-Za-z0-9_:-]{3,300}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

const isId = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(v);
const isText = (v: unknown): v is string => typeof v === "string" && v.length <= MAX_TEXT;
const isNullableText = (v: unknown, max: number): v is string | null => v === null || (typeof v === "string" && v.length > 0 && v.length <= max);

export function parseDraft(raw: unknown): Draft | null {
  if (!isPlainObject(raw)) return null;
  const { client_id, opportunity_id, subject, body, idempotencyKey, attempted, savedTaskId, savedAt } = raw;
  if (!isId(client_id) || !isId(opportunity_id) || !isText(subject) || !isText(body)) return null;
  if (typeof idempotencyKey !== "string" || !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) return null;
  if (typeof attempted !== "boolean" || !isNullableText(savedTaskId, 128) || !isNullableText(savedAt, 64)) return null;
  return { client_id, opportunity_id, subject, body, idempotencyKey, attempted, savedTaskId, savedAt };
}

export function parseDrafts(raw: string | null): { drafts: Record<string, Draft>; skipped: number } {
  if (raw === null) return { drafts: {}, skipped: 0 };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { drafts: {}, skipped: 1 };
  }
  if (!isPlainObject(data)) return { drafts: {}, skipped: 1 };
  const drafts: Record<string, Draft> = {};
  let skipped = 0;
  for (const [key, value] of Object.entries(data).slice(0, MAX_DRAFTS)) {
    const draft = KEY_PATTERN.test(key) ? parseDraft(value) : null;
    if (draft) drafts[key] = draft;
    else skipped += 1;
  }
  return { drafts, skipped };
}

export function readDrafts(): { drafts: Record<string, Draft>; skipped: number } {
  try {
    return parseDrafts(window.localStorage.getItem(DRAFTS_KEY));
  } catch {
    return { drafts: {}, skipped: 0 };
  }
}

/** Best effort: if storage is unavailable, drafts stay in memory for this visit. */
export function writeDrafts(drafts: Record<string, Draft>) {
  try {
    const entries = Object.entries(drafts).slice(-MAX_DRAFTS);
    window.localStorage.setItem(DRAFTS_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // Ignore: editing keeps working in memory.
  }
}
