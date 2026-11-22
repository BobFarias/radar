"use client";

import { createContext, useContext } from "react";

/**
 * Optional context for blocks rendered inside a conversation turn: identifiers
 * for issue reports, a way to move the user to the prompt picker, and whether
 * the response is incomplete. Blocks rendered elsewhere get the defaults.
 */
export interface ResponseBlockContextValue {
  requestId?: string;
  scenarioId?: string;
  onChoosePrompt?: () => void;
  /** The response ended early; blocks must not present themselves as complete. */
  incomplete?: boolean;
}

export const ResponseBlockContext = createContext<ResponseBlockContextValue>({});

export const useResponseBlockContext = () => useContext(ResponseBlockContext);
