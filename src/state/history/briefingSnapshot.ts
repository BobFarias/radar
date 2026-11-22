import { isScenarioId, type ScenarioId } from "@/contracts/api";
import type { Block, ReviewFormBlock } from "@/contracts/blocks";
import type { ResponseState } from "@/state/response/state";
import { isPlainObject } from "@/validation/ajv";
import { validateBlock } from "@/validation/blocks";
import { createSnapshotStore } from "./snapshotStore";

/**
 * A generated client briefing: the validated evidence and review form of one
 * successful Agent response. The user's edits and saved task live in the
 * workspace draft for the same request, never in the snapshot.
 */
export interface BriefingSnapshot {
  version: 1;
  id: string;
  /** Human-friendly reference shown in the UI and URLs, e.g. BR00001 (per browser). */
  reference: string;
  requestId: string;
  scenarioId: ScenarioId;
  runId: string | null;
  prompt: string;
  createdAt: string;
  /** From the review form (derived from the blocks). */
  clientId: string;
  opportunityId: string;
  blocks: Block[];
}

export const BRIEFING_HISTORY_KEY = "radar.history.briefings.v1";
export const BRIEFING_PREFIX = "BR";
const REFERENCE_PATTERN = /^BR\d{5,}$/;
const MAX_TEXT = 500;

const isText = (v: unknown, max = MAX_TEXT): v is string => typeof v === "string" && v.length > 0 && v.length <= max;

export function reviewFormOf(blocks: Block[]): ReviewFormBlock | undefined {
  return blocks.find((b): b is ReviewFormBlock => b.type === "review_form");
}

/** Path of the briefing in the Briefing workspace. */
export const briefingHref = (reference: string) => `/briefing/${reference}`;

/**
 * Builds a snapshot only for a fully successful response with a review form.
 * Partial, degraded, failed and denied responses are never saved.
 */
export function createBriefingSnapshot(
  state: ResponseState,
  { id, reference, prompt, now }: { id: string; reference: string; prompt: string; now: Date },
): BriefingSnapshot | null {
  if (state.phase !== "complete" || state.httpStatus !== 200) return null;
  if (!state.requestId || !state.scenarioId) return null;
  const blocks: Block[] = [];
  for (const entry of state.entries) {
    if (entry.result.status !== "valid") return null;
    blocks.push(entry.result.block);
  }
  const form = reviewFormOf(blocks);
  if (!form) return null;
  return {
    version: 1,
    id,
    reference,
    requestId: state.requestId,
    scenarioId: state.scenarioId,
    runId: state.runId,
    prompt,
    createdAt: now.toISOString(),
    clientId: form.client_id,
    opportunityId: form.opportunity_id,
    blocks,
  };
}

/** Validates a stored snapshot. Every block is re-validated; client and opportunity are re-derived. */
export function parseBriefingSnapshot(raw: unknown): BriefingSnapshot | null {
  if (!isPlainObject(raw) || raw.version !== 1) return null;
  const { id, reference, requestId, scenarioId, runId, prompt, createdAt, blocks } = raw;
  if (typeof reference !== "string" || !REFERENCE_PATTERN.test(reference) || reference.length > 16) return null;
  if (!isText(id, 128) || !isText(requestId, 128) || !isText(prompt) || !isText(createdAt, 64)) return null;
  if (!isScenarioId(scenarioId)) return null;
  if (runId !== null && !isText(runId, 128)) return null;
  if (Number.isNaN(Date.parse(createdAt))) return null;
  if (!Array.isArray(blocks) || blocks.length === 0) return null;

  const valid: Block[] = [];
  for (const block of blocks) {
    const result = validateBlock(block);
    if (result.status !== "valid") return null;
    valid.push(result.block);
  }
  const form = reviewFormOf(valid);
  if (!form) return null;
  return {
    version: 1,
    id,
    reference,
    requestId,
    scenarioId,
    runId,
    prompt,
    createdAt,
    clientId: form.client_id,
    opportunityId: form.opportunity_id,
    blocks: valid,
  };
}

export const briefingHistory = createSnapshotStore<BriefingSnapshot>({
  key: BRIEFING_HISTORY_KEY,
  parseItem: parseBriefingSnapshot,
  // One snapshot per Agent request: reopening or re-rendering never duplicates it.
  dedupeKey: (s) => s.requestId,
});
