"use client";

import { createContext, useContext } from "react";

/**
 * Optional context for blocks rendered inside a conversation turn: identifiers
 * for issue reports, a way to move the user to the prompt picker, and whether
 * the response is incomplete. Blocks rendered elsewhere get the defaults.
 */
export interface ResponseBlockContextValue {
  /** Stable owner of the blocks (the conversation turn), used to scope per-table state across retries. */
  scopeId?: string;
  /** The response that produced the blocks; review-form drafts are scoped to it. */
  requestId?: string;
  scenarioId?: string;
  onChoosePrompt?: () => void;
  /** Saved analysis these blocks belong to: shown in the table footer. `href` links to it in Opportunities. */
  analysis?: { reference: string; createdAt: string; href?: string };
  /** Saved briefing these blocks belong to. `href` links to it in Briefing. */
  briefing?: { reference: string; createdAt: string; href?: string };
  /** The response ended early; blocks must not present themselves as complete. */
  incomplete?: boolean;
}

export const ResponseBlockContext = createContext<ResponseBlockContextValue>({});

export const useResponseBlockContext = () => useContext(ResponseBlockContext);
