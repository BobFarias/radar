import { describe, expect, it } from "vitest";
import { parseDrafts } from "./draftStorage";
import type { Draft } from "./state";

const draft: Draft = {
  client_id: "CL001",
  opportunity_id: "O001",
  subject: "Edited subject",
  body: "Edited body",
  idempotencyKey: "rt-0123456789",
  attempted: false,
  savedTaskId: null,
  savedAt: null,
};

describe("parseDrafts", () => {
  it("restores valid drafts", () => {
    const stored = { "req-1:CL001:O001": draft, "req-2:CL001:O001": { ...draft, savedTaskId: "TASK-1", savedAt: "2026-11-22T10:00:00.000Z" } };
    expect(parseDrafts(JSON.stringify(stored))).toEqual({ drafts: stored, skipped: 0 });
  });

  it("treats missing storage as no drafts", () => {
    expect(parseDrafts(null)).toEqual({ drafts: {}, skipped: 0 });
  });

  it.each(["{not json", "[]", "42"])("recovers from unreadable storage %s", (raw) => {
    expect(parseDrafts(raw)).toEqual({ drafts: {}, skipped: 1 });
  });

  it("drops invalid entries and keeps the rest", () => {
    const stored = {
      "req-1:CL001:O001": draft,
      "req-2:CL001:O001": { ...draft, idempotencyKey: "bad key!" },
      "req-3:CL001:O001": { ...draft, subject: 42 },
      "req-4:CL001:O001": { ...draft, attempted: "yes" },
      "<script>": draft,
    };
    expect(parseDrafts(JSON.stringify(stored))).toEqual({ drafts: { "req-1:CL001:O001": draft }, skipped: 4 });
  });
});
