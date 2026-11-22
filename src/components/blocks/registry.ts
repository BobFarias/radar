import type { ComponentType } from "react";
import type { Block, BlockOfType, BlockType } from "@/contracts/blocks";
import { BarChart } from "@/components/blocks/BarChart";
import { EvidenceCards } from "@/components/blocks/EvidenceCards";
import { OpportunityTable } from "@/components/blocks/OpportunityTable";
import { ReviewForm } from "@/components/blocks/ReviewForm";

export type BlockComponent<T extends BlockType> = ComponentType<{ block: BlockOfType<T> }>;
export type BlockRegistry = { readonly [K in BlockType]: BlockComponent<K> };

/** The closed set of trusted components. Responses choose among these; they never supply code. */
export const blockRegistry: BlockRegistry = {
  opportunity_table: OpportunityTable,
  bar_chart: BarChart,
  evidence_cards: EvidenceCards,
  review_form: ReviewForm,
};

export function resolveBlockComponent<T extends BlockType>(
  registry: BlockRegistry,
  block: BlockOfType<T>,
): BlockComponent<T> {
  // Correlated-union lookup: the mapped type guarantees the pairing.
  return registry[block.type as T] as BlockComponent<T>;
}

export const BLOCK_LABELS: Record<BlockType, string> = {
  opportunity_table: "opportunity table",
  bar_chart: "chart",
  evidence_cards: "evidence",
  review_form: "review form",
};

export type { Block };
