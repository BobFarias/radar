import { isScenarioId, type ScenarioId } from "@/contracts/api";
import type { Block, OpportunityTableBlock } from "@/contracts/blocks";
import type { ResponseState } from "@/state/response/state";
import { isPlainObject } from "@/validation/ajv";
import { validateBlock } from "@/validation/blocks";
import { createSnapshotStore } from "./snapshotStore";

/**
 * A saved opportunity analysis: the validated blocks of one successful Agent
 * response that contained an opportunity table, plus display metadata.
 */
export interface AnalysisSnapshot {
  version: 2;
  id: string;
  /** Human-friendly reference shown in the UI and URLs, e.g. OP00001 (per browser). */
  reference: string;
  requestId: string;
  scenarioId: ScenarioId;
  runId: string | null;
  prompt: string;
  /** ISO timestamp of when the response completed. */
  createdAt: string;
  /**
   * `complete`: the whole answer arrived. `partial`: the answer ended early;
   * only the sections that arrived are saved and nothing is filled in.
   */
  status: AnalysisStatus;
  /** Title of the opportunity table (derived from the blocks). */
  title: string;
  /** Rows in the first opportunity table (derived from the blocks). */
  opportunityCount: number;
  blocks: Block[];
}

export type AnalysisStatus = "complete" | "partial";
const isAnalysisStatus = (v: unknown): v is AnalysisStatus => v === "complete" || v === "partial";

export const OPPORTUNITY_HISTORY_KEY = "radar.history.opportunities.v2";
const REFERENCE_PATTERN = /^OP\d{5,}$/;
const MAX_TEXT = 500;

const isText = (v: unknown, max = MAX_TEXT): v is string => typeof v === "string" && v.length > 0 && v.length <= max;

function firstTable(blocks: Block[]): OpportunityTableBlock | undefined {
  return blocks.find((b): b is OpportunityTableBlock => b.type === "opportunity_table");
}

function derived(blocks: Block[]): Pick<AnalysisSnapshot, "title" | "opportunityCount"> | null {
  const table = firstTable(blocks);
  return table ? { title: table.title, opportunityCount: table.rows.length } : null;
}

/** Next reference after the highest one in history: OP00001, OP00002, … (or another prefix, e.g. BR). */
export function nextReference(existing: Array<{ reference: string }>, prefix = "OP"): string {
  const highest = existing.reduce((max, s) => Math.max(max, Number(s.reference.slice(prefix.length)) || 0), 0);
  return `${prefix}${String(highest + 1).padStart(5, "0")}`;
}

/** Path of the analysis in the Opportunities workspace. */
export const analysisHref = (reference: string) => `/opportunities/${reference}`;

/**
 * Builds a snapshot for a response that contains an opportunity table and
 * either completed (`complete`) or ended early after some valid sections
 * (`partial`, saved as unfinished with only those sections). Degraded
 * (malformed/unsupported), failed and denied responses are never saved.
 */
export function createAnalysisSnapshot(
  state: ResponseState,
  { id, reference, prompt, now }: { id: string; reference: string; prompt: string; now: Date },
): AnalysisSnapshot | null {
  const status = state.phase === "complete" || state.phase === "partial" ? state.phase : null;
  if (!status || state.httpStatus !== 200) return null;
  if (!state.requestId || !state.scenarioId) return null;
  const blocks: Block[] = [];
  for (const entry of state.entries) {
    if (entry.result.status === "valid") blocks.push(entry.result.block);
    // A complete answer has only valid sections; a partial one keeps just the valid sections it received.
    else if (status === "complete") return null;
  }
  const meta = derived(blocks);
  if (!meta) return null;
  return {
    version: 2,
    id,
    reference,
    requestId: state.requestId,
    scenarioId: state.scenarioId,
    runId: state.runId,
    prompt,
    createdAt: now.toISOString(),
    status,
    ...meta,
    blocks,
  };
}

/** Validates a stored snapshot. Every block is re-validated against the schema; display metadata is re-derived. */
export function parseAnalysisSnapshot(raw: unknown): AnalysisSnapshot | null {
  if (!isPlainObject(raw) || raw.version !== 2 || !isAnalysisStatus(raw.status)) return null;
  const status = raw.status;
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
  const meta = derived(valid);
  if (!meta) return null;
  return { version: 2, id, reference, requestId, scenarioId, runId, prompt, createdAt, status, ...meta, blocks: valid };
}

export const opportunityHistory = createSnapshotStore<AnalysisSnapshot>({
  key: OPPORTUNITY_HISTORY_KEY,
  parseItem: parseAnalysisSnapshot,
  // One snapshot per Agent request: re-renders, re-subscriptions or reopening never duplicate it.
  dedupeKey: (s) => s.requestId,
});
