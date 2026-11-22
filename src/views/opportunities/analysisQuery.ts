import type { AnalysisSnapshot } from "@/state/history/analysisSnapshot";
import type { AnalysisListView } from "@/state/workspace/state";

export const ANALYSES_PER_PAGE = 10;
const DAY_MS = 86_400_000;

export interface AnalysisPage {
  items: AnalysisSnapshot[];
  /** Matching analyses before pagination. */
  total: number;
  page: number;
  pageCount: number;
  /** 1-based index of the first item on the page (0 when empty). */
  from: number;
  to: number;
}

function inPeriod(createdAt: string, period: AnalysisListView["period"], now: Date): boolean {
  if (period === "all") return true;
  const created = new Date(createdAt);
  if (period === "today") return created.toDateString() === now.toDateString();
  return now.getTime() - created.getTime() <= 7 * DAY_MS;
}

/** Analyses per status within the selected period (for the status pills). */
export function countByStatus(items: AnalysisSnapshot[], period: AnalysisListView["period"], now: Date) {
  const inRange = items.filter((item) => inPeriod(item.createdAt, period, now));
  return {
    all: inRange.length,
    complete: inRange.filter((i) => i.status === "complete").length,
    partial: inRange.filter((i) => i.status === "partial").length,
  };
}

/** Filters, sorts and paginates saved analyses. A page past the end clamps to the last page. */
export function queryAnalyses(
  items: AnalysisSnapshot[],
  view: AnalysisListView,
  now: Date,
  perPage = ANALYSES_PER_PAGE,
): AnalysisPage {
  const matching = items
    .filter((item) => inPeriod(item.createdAt, view.period, now) && (view.status === "all" || item.status === view.status))
    .sort((a, b) => (view.sort === "newest" ? -1 : 1) * (Date.parse(a.createdAt) - Date.parse(b.createdAt)));
  const pageCount = Math.max(1, Math.ceil(matching.length / perPage));
  const page = Math.min(Math.max(1, view.page), pageCount);
  const start = (page - 1) * perPage;
  const pageItems = matching.slice(start, start + perPage);
  return {
    items: pageItems,
    total: matching.length,
    page,
    pageCount,
    from: pageItems.length ? start + 1 : 0,
    to: start + pageItems.length,
  };
}
