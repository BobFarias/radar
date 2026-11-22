import { describe, expect, it } from "vitest";
import type { ReviewFormBlock } from "@/contracts/blocks";
import { fixtureBlock } from "@/test/fixtures";
import { draftKey, initialWorkspaceState, workspaceReducer, type WorkspaceAction, type WorkspaceState } from "./state";

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

describe("workspaceReducer — selections", () => {
  it("preserves selection and filters independently of drafts", () => {
    const s = run([
      { type: "opportunity_selected", opportunityId: "O002" },
      { type: "filters_changed", filters: { priority: "High" } },
      seed(),
      { type: "filters_changed", filters: { clientId: "CL001" } },
    ]);
    expect(s.selectedOpportunityId).toBe("O002");
    expect(s.filters).toEqual({ clientId: "CL001", priority: "High", stage: null });
  });
});
