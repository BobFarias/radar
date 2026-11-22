import { describe, expect, it } from "vitest";
import type { ReviewFormBlock } from "@/contracts/blocks";
import { fixtureBlock } from "@/test/fixtures";
import {
  draftKey,
  filterScope,
  filtersFor,
  initialWorkspaceState,
  NO_FILTERS,
  workspaceReducer,
  type WorkspaceAction,
  type WorkspaceState,
} from "./state";

const form = fixtureBlock("client_focus", "client-review") as ReviewFormBlock;
const key = draftKey(form);

function run(actions: WorkspaceAction[], from: WorkspaceState = initialWorkspaceState): WorkspaceState {
  return actions.reduce(workspaceReducer, from);
}

const seed = (idempotencyKey = "key-a"): WorkspaceAction => ({ type: "draft_seeded", block: form, idempotencyKey });
const edit = (value: string, newIdempotencyKey = "key-new"): WorkspaceAction => ({
  type: "draft_edited",
  key,
  field: "subject",
  value,
  newIdempotencyKey,
});

describe("workspaceReducer — drafts", () => {
  it("seeds a draft from a review_form block", () => {
    const s = run([seed()]);
    expect(s.drafts[key]).toMatchObject({ subject: form.subject, body: form.body, idempotencyKey: "key-a" });
  });

  it("does not overwrite unsaved edits when the same form arrives again (e.g. after retry)", () => {
    const s = run([seed("key-a"), edit("My edited subject"), seed("key-b")]);
    expect(s.drafts[key]).toMatchObject({ subject: "My edited subject", idempotencyKey: "key-a" });
  });

  it("keeps the idempotency key stable across edits before saving", () => {
    const s = run([seed("key-a"), edit("one"), edit("two")]);
    expect(s.drafts[key]!.idempotencyKey).toBe("key-a");
  });

  it("starts a new submission (new key) when a saved draft is edited", () => {
    const s = run([seed("key-a"), { type: "draft_saved", key, taskId: "TASK-1" }, edit("changed", "key-b")]);
    expect(s.drafts[key]).toMatchObject({ idempotencyKey: "key-b", savedTaskId: null });
  });

  it("ignores a no-op edit", () => {
    const before = run([seed()]);
    expect(workspaceReducer(before, edit(form.subject))).toBe(before);
  });
});

describe("workspaceReducer — drafts per briefing and submissions", () => {
  const scoped = (scope: string, idempotencyKey = `key-${scope}`): WorkspaceAction => ({
    type: "draft_seeded",
    block: form,
    idempotencyKey,
    scope,
  });

  it("keeps drafts of different briefings for the same opportunity apart", () => {
    const a = draftKey(form, "req-a");
    const b = draftKey(form, "req-b");
    const s = run([scoped("req-a"), scoped("req-b"), { type: "draft_edited", key: a, field: "body", value: "Only A", newIdempotencyKey: "x" }]);
    expect(a).not.toBe(b);
    expect(s.drafts[a]!.body).toBe("Only A");
    expect(s.drafts[b]!.body).toBe(form.body);
    expect(s.drafts[a]!.idempotencyKey).not.toBe(s.drafts[b]!.idempotencyKey);
  });

  it("keeps the key for a retry of the same submission", () => {
    const s = run([seed("key-a"), { type: "draft_submit_started", key }, { type: "draft_submit_started", key }]);
    expect(s.drafts[key]).toMatchObject({ idempotencyKey: "key-a", attempted: true, savedTaskId: null });
  });

  it("starts a new submission when content changes after a save attempt", () => {
    const s = run([seed("key-a"), { type: "draft_submit_started", key }, edit("changed", "key-b")]);
    expect(s.drafts[key]).toMatchObject({ idempotencyKey: "key-b", attempted: false });
  });

  it("records the saved task id and time", () => {
    const s = run([seed(), { type: "draft_saved", key, taskId: "TASK-1", savedAt: "2026-11-22T10:00:00.000Z" }]);
    expect(s.drafts[key]).toMatchObject({ savedTaskId: "TASK-1", savedAt: "2026-11-22T10:00:00.000Z" });
  });

  it("restores stored drafts without overwriting edits made in this visit", () => {
    const current = run([seed("key-a"), edit("Edited now")]);
    const stored = { ...current.drafts[key]!, subject: "Stored earlier" };
    const other = { ...stored, subject: "Other briefing" };
    const s = workspaceReducer(current, { type: "drafts_restored", drafts: { [key]: stored, "req-x:CL001:O001": other }, skipped: 2 });
    expect(s.drafts[key]!.subject).toBe("Edited now");
    expect(s.drafts["req-x:CL001:O001"]!.subject).toBe("Other briefing");
    expect(s).toMatchObject({ draftsRestored: true, draftsSkipped: 2 });
  });
});

describe("workspaceReducer — selections", () => {
  it("preserves selection and filters independently of drafts", () => {
    const s = run([
      { type: "opportunity_selected", opportunityId: "O002" },
      { type: "filters_changed", scope: "t1:table", filters: { priority: "High" } },
      seed(),
      { type: "filters_changed", scope: "t1:table", filters: { clientId: "CL001" } },
    ]);
    expect(s.selectedOpportunityId).toBe("O002");
    expect(filtersFor(s, "t1:table")).toEqual({ query: "", clientId: "CL001", priority: "High", stage: null });
  });

  it("keeps filters separate per table scope", () => {
    const s = run([
      { type: "filters_changed", scope: filterScope("t1", "overview-table"), filters: { priority: "High" } },
      { type: "filters_changed", scope: filterScope("t2", "overview-table"), filters: { stage: "Reviewing" } },
    ]);
    expect(filtersFor(s, "t1:overview-table")).toEqual({ ...NO_FILTERS, priority: "High" });
    expect(filtersFor(s, "t2:overview-table")).toEqual({ ...NO_FILTERS, stage: "Reviewing" });
    expect(filtersFor(s, "t3:overview-table")).toBe(NO_FILTERS);
    expect(filterScope(undefined, "x")).toBe("standalone:x");
  });
});
