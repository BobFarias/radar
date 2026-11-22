"use client";

import { createContext, useContext, useMemo, useReducer, useState, type Dispatch, type ReactNode } from "react";
import type { OpportunityRow } from "@/contracts/blocks";
import { initialWorkspaceState, workspaceReducer, type WorkspaceAction, type WorkspaceState } from "./state";

export interface SourceView {
  sourceId: string;
  /** The row the source was opened from: its AI-generated note is shown apart from the source text. */
  opportunity: OpportunityRow | null;
}

interface WorkspaceContextValue {
  state: WorkspaceState;
  dispatch: Dispatch<WorkspaceAction>;
  sourceView: SourceView | null;
  openSource: (sourceId: string, opportunity?: OpportunityRow) => void;
  closeSource: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

/** Lives in the shared layout, so selections survive navigation between workspaces. */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(workspaceReducer, initialWorkspaceState);
  const [sourceView, setSourceView] = useState<SourceView | null>(null);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      state,
      dispatch,
      sourceView,
      openSource: (sourceId, opportunity) => {
        if (opportunity) dispatch({ type: "opportunity_selected", opportunityId: opportunity.opportunity_id });
        setSourceView({ sourceId, opportunity: opportunity ?? null });
      },
      closeSource: () => setSourceView(null),
    }),
    [state, sourceView],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

/**
 * Workspace state for blocks. Outside a provider (isolated rendering) blocks
 * fall back to local state and source inspection is unavailable.
 */
export function useWorkspace(): Pick<WorkspaceContextValue, "state" | "dispatch"> & {
  openSource?: WorkspaceContextValue["openSource"];
} {
  const context = useContext(WorkspaceContext);
  const [localState, localDispatch] = useReducer(workspaceReducer, initialWorkspaceState);
  return context ?? { state: localState, dispatch: localDispatch };
}

export function useSourceView(): Pick<WorkspaceContextValue, "sourceView" | "closeSource"> {
  const context = useContext(WorkspaceContext);
  return { sourceView: context?.sourceView ?? null, closeSource: context?.closeSource ?? (() => {}) };
}
