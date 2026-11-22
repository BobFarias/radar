import type { Priority, ReviewFormBlock, Stage } from "@/contracts/blocks";

/**
 * User-owned state, kept apart from response state so new responses, retries
 * and stale responses can never erase selections or unsaved edits.
 */

export interface OpportunityFilters {
  clientId: string | null;
  priority: Priority | null;
  stage: Stage | null;
}

export interface Draft {
  client_id: string;
  opportunity_id: string;
  subject: string;
  body: string;
  /** Stable per submission; regenerated only when a saved draft is edited again. */
  idempotencyKey: string;
  savedTaskId: string | null;
}

export interface WorkspaceState {
  selectedOpportunityId: string | null;
  filters: OpportunityFilters;
  drafts: Record<string, Draft>;
}

export const initialWorkspaceState: WorkspaceState = {
  selectedOpportunityId: null,
  filters: { clientId: null, priority: null, stage: null },
  drafts: {},
};

export type WorkspaceAction =
  | { type: "opportunity_selected"; opportunityId: string | null }
  | { type: "filters_changed"; filters: Partial<OpportunityFilters> }
  | { type: "draft_seeded"; block: ReviewFormBlock; idempotencyKey: string }
  | { type: "draft_edited"; key: string; field: "subject" | "body"; value: string; newIdempotencyKey: string }
  | { type: "draft_saved"; key: string; taskId: string };

export function draftKey(block: Pick<ReviewFormBlock, "client_id" | "opportunity_id">): string {
  return `${block.client_id}:${block.opportunity_id}`;
}

export function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case "opportunity_selected":
      return { ...state, selectedOpportunityId: action.opportunityId };

    case "filters_changed":
      return { ...state, filters: { ...state.filters, ...action.filters } };

    case "draft_seeded": {
      const key = draftKey(action.block);
      // A regenerated form must never overwrite edits the user already made.
      if (state.drafts[key]) return state;
      const { client_id, opportunity_id, subject, body } = action.block;
      return {
        ...state,
        drafts: {
          ...state.drafts,
          [key]: { client_id, opportunity_id, subject, body, idempotencyKey: action.idempotencyKey, savedTaskId: null },
        },
      };
    }

    case "draft_edited": {
      const draft = state.drafts[action.key];
      if (!draft || draft[action.field] === action.value) return state;
      const wasSaved = draft.savedTaskId !== null;
      return {
        ...state,
        drafts: {
          ...state.drafts,
          [action.key]: {
            ...draft,
            [action.field]: action.value,
            // Editing after a save starts a new submission.
            idempotencyKey: wasSaved ? action.newIdempotencyKey : draft.idempotencyKey,
            savedTaskId: null,
          },
        },
      };
    }

    case "draft_saved": {
      const draft = state.drafts[action.key];
      if (!draft) return state;
      return { ...state, drafts: { ...state.drafts, [action.key]: { ...draft, savedTaskId: action.taskId } } };
    }
  }
}
