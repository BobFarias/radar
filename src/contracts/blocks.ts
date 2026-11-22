/**
 * Block types mirroring docs/block_schema.json.
 * These describe data that has ALREADY passed runtime validation; never cast
 * untrusted JSON to these types directly — use validateBlock().
 */

export const PRIORITIES = ["High", "Medium", "Low"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const STAGES = ["New", "Reviewing", "Reviewed"] as const;
export type Stage = (typeof STAGES)[number];

export interface OpportunityRow {
  opportunity_id: string;
  client_id: string;
  client_name: string;
  title: string;
  priority: Priority;
  stage: Stage;
  source_ids: string[];
  status_note: string;
}

export interface OpportunityTableBlock {
  id: string;
  type: "opportunity_table";
  title: string;
  rows: OpportunityRow[];
}

export interface BarChartPoint {
  label: string;
  value: number;
}

export interface BarChartBlock {
  id: string;
  type: "bar_chart";
  title: string;
  x_label: string;
  y_label: string;
  series: BarChartPoint[];
}

export interface EvidenceItem {
  source_id: string;
  excerpt: string;
  interpretation: string;
}

export interface EvidenceCardsBlock {
  id: string;
  type: "evidence_cards";
  title: string;
  items: EvidenceItem[];
}

export interface ReviewFormBlock {
  id: string;
  type: "review_form";
  title: string;
  client_id: string;
  opportunity_id: string;
  subject: string;
  body: string;
}

export type Block =
  | OpportunityTableBlock
  | BarChartBlock
  | EvidenceCardsBlock
  | ReviewFormBlock;

export type BlockType = Block["type"];

export const BLOCK_TYPES = [
  "opportunity_table",
  "bar_chart",
  "evidence_cards",
  "review_form",
] as const satisfies readonly BlockType[];

export type BlockOfType<T extends BlockType> = Extract<Block, { type: T }>;

export function isKnownBlockType(value: unknown): value is BlockType {
  return typeof value === "string" && (BLOCK_TYPES as readonly string[]).includes(value);
}

/** Result of validating one untrusted block. */
export type BlockValidationResult =
  | { status: "valid"; block: Block }
  | { status: "unsupported"; id: string | null; type: string | null }
  | { status: "invalid"; id: string | null; type: BlockType; title: string | null; errors: string[] };
