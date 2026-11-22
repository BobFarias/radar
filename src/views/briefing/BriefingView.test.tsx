// @vitest-environment jsdom
import { act, fireEvent, screen, within } from "@testing-library/react";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { MockInstance } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as reviewTasksPost } from "@/app/api/review-tasks/route";
import type { ScenarioId } from "@/contracts/api";
import { BRIEFING_HISTORY_KEY } from "@/state/history/briefingSnapshot";
import { DRAFTS_KEY } from "@/state/workspace/draftStorage";
import { installApiFetch } from "@/test/apiFetch";
import { fixtures } from "@/test/fixtures";
import { renderWithRadar } from "@/test/render";
import { AgentView } from "@/views/agent/AgentView";
import { OpportunitiesView } from "@/views/opportunities/OpportunitiesView";
import { BriefingDetailView } from "./BriefingDetailView";
import { BriefingView } from "./BriefingView";

/** Agent → real controller → real /api handlers (including POST /api/review-tasks on a temp file) → Briefing. */

let dir: string;
let tasksFile: string;
let fetchSpy: MockInstance<typeof fetch>;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "radar-briefing-"));
  tasksFile = path.join(dir, "tasks.json");
  process.env.RADAR_TASKS_FILE = tasksFile;
  vi.useFakeTimers();
  fetchSpy = installApiFetch();
});
afterEach(async () => {
  vi.useRealTimers();
  delete process.env.RADAR_TASKS_FILE;
  await rm(dir, { recursive: true, force: true });
});

const flush = () => act(() => vi.advanceTimersByTimeAsync(20_000));

async function storedTasks(): Promise<Array<Record<string, unknown>>> {
  try {
    return (JSON.parse(await readFile(tasksFile, "utf8")) as { tasks: Array<Record<string, unknown>> }).tasks;
  } catch {
    return [];
  }
}
const taskPosts = () => fetchSpy.mock.calls.filter(([url]) => String(url) === "/api/review-tasks");
const postedKeys = () => taskPosts().map(([, init]) => (JSON.parse(init!.body as string) as { idempotency_key: string }).idempotency_key);

/** Generates briefings in Agent, then switches to real timers so the file-backed API can be awaited. */
async function generate(...scenarios: ScenarioId[]) {
  const view = renderWithRadar(<AgentView />);
  for (const scenario of scenarios) {
    fireEvent.change(screen.getByLabelText("Demo prompt"), { target: { value: scenario } });
    fireEvent.click(screen.getByRole("button", { name: "Send prompt" }));
    await flush();
  }
  vi.useRealTimers();
  return view;
}

const forms = () => screen.getAllByRole("region", { name: "Prepare a review task" });
const form = (i = 0) => within(forms()[i]!);
const subject = (i = 0) => form(i).getByRole("textbox", { name: "Subject" });
const details = (i = 0) => form(i).getByRole("textbox", { name: "Details" });

function editTask(i: number, values: { subject?: string; body?: string }) {
  if (form(i).queryByRole("button", { name: "Edit task" })) fireEvent.click(form(i).getByRole("button", { name: "Edit task" }));
  if (values.subject !== undefined) fireEvent.change(subject(i), { target: { value: values.subject } });
  if (values.body !== undefined) fireEvent.change(details(i), { target: { value: values.body } });
}

const review = (i = 0) => fireEvent.click(form(i).getByRole("button", { name: "Review and save" }));
const confirm = (i = 0) => fireEvent.click(form(i).getByRole("button", { name: "Confirm and save task" }));
const savedConfirmation = (i = 0) => form(i).findByText("Review task saved", {}, { timeout: 3000 });

describe("Agent → Briefing journey (client_focus)", () => {
  it("generates a briefing, inspects evidence, edits, confirms and saves exactly one task, then reopens it in Briefing", async () => {
    const { rerender } = await generate("client_focus");

    // Evidence: source excerpts and AI interpretations are labelled separately.
    const evidence = screen.getByRole("region", { name: "Evidence for Asteria Payments" });
    const first = within(evidence).getByRole("listitem", { name: "Evidence from SRC001" });
    expect(within(first).getByRole("blockquote")).toHaveTextContent("A draft consultation proposes resilience testing");
    expect(first).toHaveTextContent("Source excerpt · SRC001");
    expect(first).toHaveTextContent("AI interpretation");
    expect(first).toHaveTextContent("this is not yet a rule in force");
    fireEvent.click(within(first).getByRole("button", { name: "View source SRC001" }));
    expect(await screen.findByRole("dialog", { name: "Payment resilience consultation" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();

    // Review form: client and opportunity identified, AI draft shown, nothing saved yet.
    expect(forms()[0]).toHaveTextContent("Asteria Payments · CL001");
    expect(forms()[0]).toHaveTextContent("Review payment resilience readiness · O001");
    expect(form().getByText("Not saved")).toBeInTheDocument();
    expect(forms()[0]).toHaveTextContent("Briefing — BR00001");

    editTask(0, { subject: "Resilience consultation — partner call", body: "Walk the partner through the consultation." });
    expect(form().getByText("Unsaved draft")).toBeInTheDocument();
    review();
    const reviewStep = form().getByRole("region", { name: "Review before saving" });
    expect(reviewStep).toHaveTextContent("Resilience consultation — partner call");
    expect(reviewStep).toHaveTextContent("It isn't sent to the client or anyone else.");
    expect(taskPosts()).toHaveLength(0);

    confirm();
    expect(form().getByRole("button", { name: "Saving…" })).toBeDisabled();
    await savedConfirmation();
    const tasks = await storedTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      client_id: "CL001",
      opportunity_id: "O001",
      subject: "Resilience consultation — partner call",
      body: "Walk the partner through the consultation.",
    });
    expect(forms()[0]).toHaveTextContent(`Task ID ${tasks[0]!.task_id as string}`);
    expect(form().getByText("Task saved")).toBeInTheDocument();
    expect(form().getByRole("link", { name: "Open BR00001 in Briefing" })).toHaveAttribute("href", "/briefing/BR00001");

    // Briefing list shows the saved status and task id.
    rerender(<BriefingView />);
    const row = within(screen.getByRole("region", { name: "Showing 1–1 of 1 briefing" })).getByRole("link");
    expect(row).toHaveAttribute("href", "/briefing/BR00001");
    expect(row).toHaveTextContent("Asteria Payments — BR00001");
    expect(row).toHaveTextContent("Task saved");
    expect(row).toHaveTextContent(tasks[0]!.task_id as string);

    // Reopening shows the evidence and the saved task without creating anything.
    rerender(<BriefingDetailView reference="BR00001" />);
    const article = screen.getByRole("article", { name: "Asteria Payments briefing — BR00001" });
    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
    expect(article).toHaveTextContent("Review payment resilience readiness · O001");
    expect(within(article).getByRole("region", { name: "Evidence for Asteria Payments" })).toBeInTheDocument();
    expect(within(article).getByText("Review task saved")).toBeInTheDocument();
    expect(article).toHaveTextContent(`Task ID ${tasks[0]!.task_id as string}`);
    expect(taskPosts()).toHaveLength(1);
    expect(JSON.parse(window.localStorage.getItem(BRIEFING_HISTORY_KEY)!)).toHaveLength(1);
  });

  it("validates the subject and details with accessible messages", async () => {
    await generate("client_focus");
    editTask(0, { subject: "   ", body: "x".repeat(5001) });
    review();
    expect(subject()).toHaveAttribute("aria-invalid", "true");
    expect(subject()).toHaveAccessibleDescription(/Enter a subject\./);
    expect(subject()).toHaveFocus();
    expect(details()).toHaveAccessibleDescription(/Shorten the details to 5000 characters or fewer\./);
    expect(taskPosts()).toHaveLength(0);

    fireEvent.change(subject(), { target: { value: "Fixed subject" } });
    expect(subject()).not.toHaveAttribute("aria-invalid");
    fireEvent.change(details(), { target: { value: "Fixed details" } });
    review();
    expect(form().getByRole("heading", { name: "Review before saving" })).toHaveFocus();
  });

  it("never saves without explicit confirmation, and going back keeps the edits", async () => {
    await generate("client_focus");
    editTask(0, { subject: "Not yet" });
    review();
    fireEvent.click(form().getByRole("button", { name: "Back to editing" }));
    expect(subject()).toHaveValue("Not yet");
    expect(subject()).toHaveFocus();
    expect(taskPosts()).toHaveLength(0);
    expect(await storedTasks()).toHaveLength(0);
  });

  it("sends one request for a double click on confirm", async () => {
    await generate("client_focus");
    review();
    const button = form().getByRole("button", { name: "Confirm and save task" });
    fireEvent.click(button);
    fireEvent.click(button);
    await savedConfirmation();
    expect(taskPosts()).toHaveLength(1);
    expect(await storedTasks()).toHaveLength(1);
  });

  it("keeps the input after a failed save and retries with the same key", async () => {
    await generate("client_focus");
    editTask(0, { subject: "Kept after failure" });
    review();
    fetchSpy.mockImplementationOnce(() => Promise.reject(new TypeError("Failed to fetch")));
    confirm();
    expect(await form().findByRole("alert")).toHaveTextContent("RADAR couldn't be reached");
    expect(form().getByRole("alert")).toHaveTextContent("Your edits are kept.");
    expect(form().getByRole("region", { name: "Review before saving" })).toHaveTextContent("Kept after failure");
    expect(form().queryByText("Task saved")).toBeNull();
    expect(form().getByText("Unsaved draft")).toBeInTheDocument();

    fireEvent.click(form().getByRole("button", { name: "Try again" }));
    await savedConfirmation();
    expect(postedKeys()).toHaveLength(2);
    expect(new Set(postedKeys()).size).toBe(1);
    expect(await storedTasks()).toEqual([expect.objectContaining({ subject: "Kept after failure" })]);
  });

  it("does not duplicate a task saved by the server when the response was lost", async () => {
    await generate("client_focus");
    review();
    // The server stores the task, but the browser never receives the answer.
    fetchSpy.mockImplementationOnce(async (_url, init) => {
      await reviewTasksPost(new Request("http://localhost/api/review-tasks", { method: "POST", body: init!.body }));
      throw new TypeError("Network connection lost");
    });
    confirm();
    expect(await form().findByRole("alert")).toHaveTextContent("RADAR couldn't be reached");
    expect(await storedTasks()).toHaveLength(1);

    fireEvent.click(form().getByRole("button", { name: "Try again" }));
    await savedConfirmation();
    expect(form().getByText("It had already been saved, so no duplicate was created.")).toBeInTheDocument();
    const tasks = await storedTasks();
    expect(tasks).toHaveLength(1);
    expect(forms()[0]).toHaveTextContent(`Task ID ${tasks[0]!.task_id as string}`);
  });

  it("explains a server failure and recovers on retry", async () => {
    await writeFile(tasksFile, "{ corrupted");
    await generate("client_focus");
    review();
    confirm();
    expect(await form().findByRole("alert")).toHaveTextContent("The task couldn't be saved");
    await rm(tasksFile);
    fireEvent.click(form().getByRole("button", { name: "Try again" }));
    await savedConfirmation();
    expect(await storedTasks()).toHaveLength(1);
  });
});

describe("Drafts", () => {
  it("are preserved while navigating between workspaces, with the Agent conversation intact", async () => {
    const { rerender } = await generate("client_focus");
    editTask(0, { subject: "Survives navigation" });

    rerender(<OpportunitiesView />);
    rerender(<BriefingView />);
    const row = within(screen.getByRole("region", { name: /^Showing/ })).getByRole("link");
    expect(row).toHaveTextContent("Unsaved draft");
    expect(row).not.toHaveTextContent("Task saved");

    rerender(<BriefingDetailView reference="BR00001" />);
    expect(subject()).toHaveValue("Survives navigation");

    rerender(<AgentView />);
    expect(screen.getByText(fixtures.client_focus.prompt)).toBeInTheDocument();
    expect(subject()).toHaveValue("Survives navigation");
    expect(taskPosts()).toHaveLength(0);
  });

  it("are restored after a reload", async () => {
    const first = await generate("client_focus");
    editTask(0, { body: "Continue this later" });
    first.unmount();
    expect(window.localStorage.getItem(DRAFTS_KEY)).toContain("Continue this later");

    renderWithRadar(<BriefingDetailView reference="BR00001" />);
    expect(details()).toHaveValue("Continue this later");
    expect(form().getByText("Unsaved draft")).toBeInTheDocument();
  });

  it("are independent across briefings for the same opportunity", async () => {
    const { rerender } = await generate("client_focus", "client_focus");
    expect(forms()).toHaveLength(2);
    editTask(0, { subject: "Only the first briefing" });
    expect(forms()[1]).toHaveTextContent("Payment resilience consultation");
    expect(form(1).queryByRole("textbox")).toBeNull();

    review(1);
    confirm(1);
    await savedConfirmation(1);
    expect(subject(0)).toHaveValue("Only the first briefing");
    expect(form(0).getByText("Unsaved draft")).toBeInTheDocument();
    expect(await storedTasks()).toEqual([expect.objectContaining({ subject: "Payment resilience consultation" })]);

    rerender(<BriefingView />);
    const status = screen.getByRole("group", { name: "Briefing status" });
    expect(within(status).getByRole("button", { name: "All 2" })).toBeInTheDocument();
    expect(within(status).getByRole("button", { name: "Unsaved drafts 1" })).toBeInTheDocument();
    fireEvent.click(within(status).getByRole("button", { name: "Saved tasks 1" }));
    const rows = within(screen.getByRole("region", { name: /^Showing/ })).getAllByRole("link");
    expect(rows.map((r) => r.getAttribute("href"))).toEqual(["/briefing/BR00002"]);
  });
});

describe("Briefing workspace", () => {
  it("shows an empty state that leads to Agent", () => {
    renderWithRadar(<BriefingView />);
    expect(screen.getByRole("heading", { level: 1, name: "Briefing" })).toBeInTheDocument();
    expect(screen.getByText("No briefings yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Agent" })).toHaveAttribute("href", "/agent");
  });

  it("distinguishes generated, draft and saved briefings", async () => {
    const { rerender } = await generate("client_focus", "client_focus", "client_focus");
    editTask(1, { subject: "Edited" });
    review(2);
    confirm(2);
    await savedConfirmation(2);
    rerender(<BriefingView />);
    const rows = within(screen.getByRole("region", { name: "Showing 1–3 of 3 briefings" })).getAllByRole("link");
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringMatching(/BR00003.*Task saved.*TASK-/),
      expect.stringMatching(/BR00002.*Unsaved draft/),
      expect.stringMatching(/BR00001.*Generated briefing/),
    ]);
  });

  it("recovers from corrupted saved briefings and drafts", async () => {
    window.localStorage.setItem(BRIEFING_HISTORY_KEY, "{ not json");
    window.localStorage.setItem(DRAFTS_KEY, JSON.stringify({ "req:CL001:O001": { subject: 42 } }));
    const { rerender } = renderWithRadar(<BriefingView />);
    expect(screen.getByText("Some saved briefings couldn't be read")).toBeInTheDocument();
    expect(screen.getByText("Some unsaved drafts couldn't be restored")).toBeInTheDocument();
    expect(screen.getByText("No briefings yet")).toBeInTheDocument();

    rerender(<AgentView />);
    fireEvent.change(screen.getByLabelText("Demo prompt"), { target: { value: "client_focus" } });
    fireEvent.click(screen.getByRole("button", { name: "Send prompt" }));
    await flush();
    rerender(<BriefingView />);
    expect(within(screen.getByRole("region", { name: /^Showing/ })).getByRole("link")).toHaveTextContent("BR00001");
  });

  it("explains when a reference isn't in this browser's history", () => {
    renderWithRadar(<BriefingDetailView reference="BR00042" />);
    expect(screen.getByText("Briefing BR00042 isn't available")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "All briefings" })).toHaveAttribute("href", "/briefing");
  });

  it("never saves a denied or non-briefing response", async () => {
    await generate("permission_denied", "overview");
    expect(window.localStorage.getItem(BRIEFING_HISTORY_KEY) ?? "[]").toBe("[]");
    expect(window.localStorage.getItem(DRAFTS_KEY) ?? "{}").toBe("{}");
  });
});
