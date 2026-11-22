import { describe, expect, it } from "vitest";
import type { AnalysisSnapshot } from "@/state/history/analysisSnapshot";
import type { AnalysisListView } from "@/state/workspace/state";
import { countByStatus, queryAnalyses } from "./analysisQuery";

const now = new Date("2026-11-22T15:00:00");
const at = (daysAgo: number, n: number, status: AnalysisSnapshot["status"] = "complete") =>
  ({
    id: `a${n}`,
    reference: `OP${String(n).padStart(5, "0")}`,
    status,
    createdAt: new Date(now.getTime() - daysAgo * 86_400_000).toISOString(),
  }) as AnalysisSnapshot;
const view = (v: Partial<AnalysisListView> = {}): AnalysisListView => ({ status: "all", period: "all", sort: "newest", page: 1, ...v });
const refs = (items: AnalysisSnapshot[]) => items.map((i) => i.reference);

describe("queryAnalyses", () => {
  const items = [at(0, 3), at(10, 1), at(3, 2)];

  it("sorts newest or oldest first", () => {
    expect(refs(queryAnalyses(items, view(), now).items)).toEqual(["OP00003", "OP00002", "OP00001"]);
    expect(refs(queryAnalyses(items, view({ sort: "oldest" }), now).items)).toEqual(["OP00001", "OP00002", "OP00003"]);
  });

  it("filters by period", () => {
    expect(refs(queryAnalyses(items, view({ period: "today" }), now).items)).toEqual(["OP00003"]);
    expect(refs(queryAnalyses(items, view({ period: "last7" }), now).items)).toEqual(["OP00003", "OP00002"]);
  });

  it("filters by status and counts each status within the period", () => {
    const mixed = [at(0, 1), at(0, 2, "partial"), at(10, 3, "partial")];
    expect(refs(queryAnalyses(mixed, view({ status: "complete" }), now).items)).toEqual(["OP00001"]);
    expect(refs(queryAnalyses(mixed, view({ status: "partial" }), now).items)).toEqual(["OP00002", "OP00003"]);
    expect(countByStatus(mixed, "all", now)).toEqual({ all: 3, complete: 1, partial: 2 });
    expect(countByStatus(mixed, "last7", now)).toEqual({ all: 2, complete: 1, partial: 1 });
  });

  it("paginates and reports the visible range", () => {
    const many = Array.from({ length: 23 }, (_, i) => at(i / 100, i + 1));
    const page2 = queryAnalyses(many, view({ page: 2 }), now);
    expect(page2).toMatchObject({ total: 23, page: 2, pageCount: 3, from: 11, to: 20 });
    expect(page2.items).toHaveLength(10);
    expect(queryAnalyses(many, view({ page: 3 }), now)).toMatchObject({ from: 21, to: 23 });
  });

  it("clamps a page past the end and handles no results", () => {
    expect(queryAnalyses(items, view({ page: 9 }), now)).toMatchObject({ page: 1, pageCount: 1 });
    expect(queryAnalyses([], view(), now)).toMatchObject({ total: 0, page: 1, pageCount: 1, from: 0, to: 0, items: [] });
  });
});
