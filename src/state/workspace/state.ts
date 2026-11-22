import type { Priority, ReviewFormBlock, Stage } from "@/contracts/blocks";

/**
 * User-owned state, kept apart from response state so new responses, retries
 * and stale responses can never erase selections or unsaved edits.
 */

export interface OpportunityFilters {
  /** Free-text search over the validated rows (application-side only). */
  query: string;
  clientId: string | null;
  priority: Priority | null;
  stage: Stage | null;
}

export const NO_FILTERS: OpportunityFilters = { query: "", clientId: null, priority: null, stage: null };

/** Filters belong to one table: the conversation turn (or other owner) plus the block id. */
export function filterScope(ownerId: string | undefined, blockId: string): string {
  return `${ownerId ?? "standalone"}:${blockId}`;
}

export type AnalysisPeriod = "all" | "today" | "last7";

export interface AnalysisListView {
  status: "all" | "complete" | "partial";
  period: AnalysisPeriod;
  sort: "newest" | "oldest";
  page: number;
}

export interface BriefingListView {
  status: "all" | "generated" | "draft" | "saved";
  page: number;
}

/**
 * The user's working copy of one review form. Created on the first edit or
 * save attempt; until then the form shows the generated content.
 */
export interface Draft {
  client_id: string;
  opportunity_id: string;
  subject: string;
  body: string;
  /** Stable per submission: retries reuse it; regenerated only when content changes after a save or save attempt. */
  idempotencyKey: string;
  /** A save was sent with the current key and content (its outcome may be unknown, e.g. a network failure). */
  attempted: boolean;
  savedTaskId: string | null;
  /** Server creation time of the saved task. */
  savedAt: string | null;
}

export interface WorkspaceState {
  selectedOpportunityId: string | null;
  /** Opportunities list filter, sort and page; kept while the user opens an analysis and comes back. */
  analysisList: AnalysisListView;
  /** Per-table filters keyed by `filterScope`; tables never share filters. */
  filters: Record<string, OpportunityFilters>;
  /** Review-form drafts keyed by `draftKey`; each briefing instance has its own. */
  drafts: Record<string, Draft>;
  /** Drafts from earlier visits have been restored (persisting starts only after that). */
  draftsRestored: boolean;
  /** Stored drafts that were unreadable and dropped on restore. */
  draftsSkipped: number;
  briefingList: BriefingListView;
}

export const initialWorkspaceState: WorkspaceState = {
  selectedOpportunityId: null,
  analysisList: { status: "all", period: "all", sort: "newest", page: 1 },
  filters: {},
  drafts: {},
  draftsRestored: false,
  draftsSkipped: 0,
  briefingList: { status: "all", page: 1 },
};

export type WorkspaceAction =
  | { type: "opportunity_selected"; opportunityId: string | null }
  | { type: "analysis_list_changed"; view: Partial<AnalysisListView> }
  | { type: "filters_changed"; scope: string; filters: Partial<OpportunityFilters> }
  | { type: "briefing_list_changed"; view: Partial<BriefingListView> }
  | { type: "draft_seeded"; block: ReviewFormBlock; idempotencyKey: string; scope?: string }
  | { type: "draft_edited"; key: string; field: "subject" | "body"; value: string; newIdempotencyKey: string }
  | { type: "draft_submit_started"; key: string }
  | { type: "draft_saved"; key: string; taskId: string; savedAt?: string }
  | { type: "drafts_restored"; drafts: Record<string, Draft>; skipped: number };

export function filtersFor(state: WorkspaceState, scope: string): OpportunityFilters {
  return state.filters[scope] ?? NO_FILTERS;
}

/**
 * Drafts belong to one review form instance: the response that produced it
 * (`scope`, its request id) plus the client and opportunity. Two briefings for
 * the same opportunity therefore never share edits.
 */
export function draftKey(block: Pick<ReviewFormBlock, "client_id" | "opportunity_id">, scope?: string): string {
  const base = `${block.client_id}:${block.opportunity_id}`;
  return scope ? `${scope}:${base}` : base;
}

export function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case "opportunity_selected":
      return { ...state, selectedOpportunityId: action.opportunityId };

    case "analysis_list_changed":
      return { ...state, analysisList: { ...state.analysisList, ...action.view } };

    case "filters_changed":
      return {
        ...state,
        filters: { ...state.filters, [action.scope]: { ...filtersFor(state, action.scope), ...action.filters } },
      };

    case "briefing_list_changed":
      return { ...state, briefingList: { ...state.briefingList, ...action.view } };

    case "draft_seeded": {
      const key = draftKey(action.block, action.scope);
      // A regenerated form must never overwrite edits the user already made.
      if (state.drafts[key]) return state;
      const { client_id, opportunity_id, subject, body } = action.block;
      return {
        ...state,
        drafts: {
          ...state.drafts,
          [key]: {
            client_id,
            opportunity_id,
            subject,
            body,
            idempotencyKey: action.idempotencyKey,
            attempted: false,
            savedTaskId: null,
            savedAt: null,
          },
        },
      };
    }

    case "draft_edited": {
      const draft = state.drafts[action.key];
      if (!draft || draft[action.field] === action.value) return state;
      // Changed content after a save (or a save whose outcome is unknown) is a new submission:
      // reusing the key would replay the earlier task or be rejected as a conflict.
      const newSubmission = draft.savedTaskId !== null || draft.attempted;
      return {
        ...state,
        drafts: {
          ...state.drafts,
          [action.key]: {
            ...draft,
            [action.field]: action.value,
            idempotencyKey: newSubmission ? action.newIdempotencyKey : draft.idempotencyKey,
            attempted: false,
            savedTaskId: null,
            savedAt: null,
          },
        },
      };
    }

    case "draft_submit_started": {
      const draft = state.drafts[action.key];
      if (!draft || draft.attempted) return state;
      return { ...state, drafts: { ...state.drafts, [action.key]: { ...draft, attempted: true } } };
    }

    case "draft_saved": {
      const draft = state.drafts[action.key];
      if (!draft) return state;
      return {
        ...state,
        drafts: { ...state.drafts, [action.key]: { ...draft, savedTaskId: action.taskId, savedAt: action.savedAt ?? null } },
      };
    }

    case "drafts_restored":
      // Drafts already changed in this visit are newer than the stored copies.
      return {
        ...state,
        drafts: { ...action.drafts, ...state.drafts },
        draftsRestored: true,
        draftsSkipped: action.skipped,
      };
  }
}
