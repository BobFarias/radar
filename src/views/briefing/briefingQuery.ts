import { reviewFormOf, type BriefingSnapshot } from "@/state/history/briefingSnapshot";
import { paginate, type PageOf } from "@/state/paginate";
import { draftKey, type BriefingListView, type Draft } from "@/state/workspace/state";

export const BRIEFINGS_PER_PAGE = 10;

/**
 * `generated`: nothing done yet (the AI draft is untouched). `draft`: edited
 * or a save was attempted, not confirmed by the server. `saved`: the server
 * returned a task id.
 */
export type BriefingStatus = "generated" | "draft" | "saved";

export interface BriefingItem {
  snapshot: BriefingSnapshot;
  draft: Draft | undefined;
  status: BriefingStatus;
}

/** The draft for a briefing is the one its review form uses: same request, client and opportunity. */
export function briefingItem(snapshot: BriefingSnapshot, drafts: Record<string, Draft>): BriefingItem {
  const form = reviewFormOf(snapshot.blocks);
  const draft = form ? drafts[draftKey(form, snapshot.requestId)] : undefined;
  const status: BriefingStatus = draft?.savedTaskId ? "saved" : draft ? "draft" : "generated";
  return { snapshot, draft, status };
}

export function countBriefings(items: BriefingItem[]): Record<BriefingListView["status"], number> {
  return {
    all: items.length,
    generated: items.filter((i) => i.status === "generated").length,
    draft: items.filter((i) => i.status === "draft").length,
    saved: items.filter((i) => i.status === "saved").length,
  };
}

/** Newest first, filtered by status, paginated. */
export function queryBriefings(items: BriefingItem[], view: BriefingListView, perPage = BRIEFINGS_PER_PAGE): PageOf<BriefingItem> {
  const matching = items
    .filter((i) => view.status === "all" || i.status === view.status)
    .sort((a, b) => Date.parse(b.snapshot.createdAt) - Date.parse(a.snapshot.createdAt));
  return paginate(matching, view.page, perPage);
}
