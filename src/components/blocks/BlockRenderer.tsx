"use client";

import { Component, createElement, type ReactNode } from "react";
import type { Block, BlockType } from "@/contracts/blocks";
import type { BlockEntry } from "@/state/response/state";
import { InvalidBlockFallback, RenderErrorFallback, UnsupportedBlockFallback } from "./fallbacks";
import { blockRegistry, resolveBlockComponent, type BlockRegistry } from "./registry";

/** Isolates a render crash to its own block. */
class BlockBoundary extends Component<{ type: BlockType; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? <RenderErrorFallback type={this.props.type} /> : this.props.children;
  }
}

/** Registry lookup of a stable, module-level component (not one created during render). */
function renderValidBlock(block: Block, registry: BlockRegistry): ReactNode {
  return createElement(resolveBlockComponent(registry, block), { block });
}

/**
 * Renders validated entries in arrival order. Each entry resolves on its own:
 * valid → registered component; unsupported/invalid → fallback.
 */
export function BlockRenderer({ entries, registry = blockRegistry }: { entries: BlockEntry[]; registry?: BlockRegistry }) {
  return (
    <div className="grid gap-4">
      {entries.map(({ key, result }) => {
        switch (result.status) {
          case "valid":
            return (
              <BlockBoundary key={key} type={result.block.type}>
                {renderValidBlock(result.block, registry)}
              </BlockBoundary>
            );
          case "unsupported":
            return <UnsupportedBlockFallback key={key} type={result.type} />;
          case "invalid":
            return <InvalidBlockFallback key={key} type={result.type} title={result.title} errors={result.errors} />;
        }
      })}
    </div>
  );
}
