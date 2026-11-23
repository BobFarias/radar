"use client";

import { Briefcase, PenLine, Sparkles } from "lucide-react";
import { useEffect, useId, useRef, useState, type Ref } from "react";
import type { ReviewTaskRequest } from "@/contracts/api";
import type { ReviewFormBlock } from "@/contracts/blocks";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmationState,
  CopyButton,
  ErrorState,
  LoadingState,
  TextArea,
  TextInput,
} from "@/components/ui";
import { findClient, findOpportunity } from "@/state/catalog";
import { formatDateTime } from "@/state/format";
import { randomId } from "@/state/ids";
import {
  pendingSubmission,
  REVIEW_TASK_LIMITS,
  submitReviewTask,
  type SubmitError,
  type SubmitOutcome,
} from "@/state/review/submitReviewTask";
import { draftKey, type Draft } from "@/state/workspace/state";
import { useWorkspace } from "@/state/workspace/WorkspaceProvider";
import { useResponseBlockContext } from "./ResponseBlockContext";
import { SnapshotFooter } from "./SnapshotFooter";

type Field = "subject" | "body";
type FieldErrors = Partial<Record<Field, string>>;

const newKey = () => `rt-${randomId()}`;

function validate(values: { subject: string; body: string }): FieldErrors {
  const errors: FieldErrors = {};
  const subject = values.subject.trim();
  const body = values.body.trim();
  if (!subject) errors.subject = "Enter a subject.";
  else if (subject.length > REVIEW_TASK_LIMITS.subject) errors.subject = `Shorten the subject to ${REVIEW_TASK_LIMITS.subject} characters or fewer.`;
  if (!body) errors.body = "Enter the task details.";
  else if (body.length > REVIEW_TASK_LIMITS.body) errors.body = `Shorten the details to ${REVIEW_TASK_LIMITS.body} characters or fewer.`;
  return errors;
}

/** Client and opportunity are fixed by the generated briefing; shown by name with their ids. */
function TaskTarget({ block }: { block: ReviewFormBlock }) {
  const client = findClient(block.client_id);
  const opportunity = findOpportunity(block.opportunity_id);
  return (
    <dl className="grid gap-3 rounded-xl bg-chip px-4 py-3 text-sm sm:grid-cols-2">
      <div>
        <dt className="text-xs text-muted">Client</dt>
        <dd className="font-medium">
          {client?.name ?? block.client_id} <span className="font-normal text-muted">· {block.client_id}</span>
        </dd>
      </div>
      <div>
        <dt className="text-xs text-muted">Opportunity</dt>
        <dd className="font-medium">
          {opportunity?.title ?? block.opportunity_id} <span className="font-normal text-muted">· {block.opportunity_id}</span>
        </dd>
      </div>
    </dl>
  );
}

function TaskContent({ subject, body }: { subject: string; body: string }) {
  return (
    <dl className="grid gap-3 text-sm">
      <div>
        <dt className="text-xs text-muted">Subject</dt>
        <dd className="font-medium">{subject.trim()}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted">Details</dt>
        <dd className="whitespace-pre-line">{body.trim()}</dd>
      </div>
    </dl>
  );
}

function TextField({
  label,
  hint,
  error,
  value,
  max,
  multiline,
  disabled,
  onChange,
  inputRef,
}: {
  label: string;
  hint: string;
  error?: string;
  value: string;
  max: number;
  multiline?: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
  inputRef?: Ref<HTMLInputElement & HTMLTextAreaElement>;
}) {
  const id = useId();
  const describedBy = [`${id}-hint`, error ? `${id}-error` : null].filter(Boolean).join(" ");
  const props = {
    id,
    value,
    disabled,
    ref: inputRef,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
    onChange: (e: { target: { value: string } }) => onChange(e.target.value),
  };
  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <span className={value.trim().length > max ? "text-xs text-danger" : "text-xs text-muted"}>
          {value.trim().length}/{max}
        </span>
      </div>
      {multiline ? <TextArea rows={6} {...props} /> : <TextInput {...props} />}
      <p id={`${id}-hint`} className="text-xs text-muted">
        {hint}
      </p>
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Demo only: sends the save to the server, then drops its reply, as if the
 * connection failed after the task was stored. Retrying with the same key
 * shows the server returning the existing task instead of a duplicate.
 */
const fetchLosingResponse: typeof fetch = async (input, init) => {
  await fetch(input, init);
  throw new TypeError("Simulated lost response");
};

function SavedTask({ draft, replayed }: { draft: Draft; replayed: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div ref={ref} tabIndex={-1} className="grid gap-4 outline-none">
      <ConfirmationState
        title="Review task saved"
        actions={
          <CopyButton
            text={draft.savedTaskId!}
            label="Copy task ID"
            copiedMessage="Task ID copied"
            failedMessage="Couldn't copy the task ID"
          />
        }
      >
        <p>
          Task ID <strong className="font-mono text-[13px] break-all">{draft.savedTaskId}</strong>
          {draft.savedAt ? (
            <>
              {" "}
              · saved <time dateTime={draft.savedAt}>{formatDateTime(draft.savedAt, "short")}</time>
            </>
          ) : null}
        </p>
        <p className="mt-1">
          {replayed
            ? "It had already been saved, so no duplicate was created."
            : "It's in RADAR's local task list. Nothing was sent to the client or anyone else."}
        </p>
      </ConfirmationState>
      <TaskContent subject={draft.subject} body={draft.body} />
    </div>
  );
}

/**
 * Editable review task. The content is an AI-generated draft until the user
 * edits it; nothing is saved until the user reviews it and explicitly
 * confirms. Edits live in the workspace draft for this response, so they
 * survive navigation, re-renders and reloads, and never leak to another briefing.
 */
export function ReviewForm({ block }: { block: ReviewFormBlock }) {
  const { state, dispatch } = useWorkspace();
  const { requestId, briefing } = useResponseBlockContext();
  const key = draftKey(block, requestId);
  const draft = state.drafts[key];
  const values = draft ?? block;

  const headingId = `${block.id}-heading`;
  // Generated content is shown as a preview first; an existing draft opens straight in the editor.
  const [requestedStep, setStep] = useState<"preview" | "edit" | "review">(draft ? "edit" : "preview");
  // A draft restored after mount (e.g. after a reload) opens in the editor too.
  const step = requestedStep === "preview" && draft ? "edit" : requestedStep;
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<SubmitError | null>(null);
  const [replayed, setReplayed] = useState(false);
  const [loseResponse, setLoseResponse] = useState(false);
  const loseResponseId = useId();
  const inFlight = useRef(false);
  const subjectRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const bodyRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const reviewHeadingRef = useRef<HTMLHeadingElement>(null);

  const ensureDraft = () => {
    if (!draft) dispatch({ type: "draft_seeded", block, idempotencyKey: newKey(), scope: requestId });
  };

  const edit = (field: Field, value: string) => {
    ensureDraft();
    dispatch({ type: "draft_edited", key, field, value, newIdempotencyKey: newKey() });
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const finish = (outcome: SubmitOutcome) => {
    inFlight.current = false;
    setSaving(false);
    if (outcome.ok) {
      setReplayed(outcome.replayed);
      dispatch({ type: "draft_saved", key, taskId: outcome.task.task_id, savedAt: outcome.task.created_at });
    } else {
      setSaveError(outcome.error);
    }
  };

  // A save started before navigating away is still running: show it rather than offering a second save.
  useEffect(() => {
    const running = draft && !draft.savedTaskId ? pendingSubmission(draft.idempotencyKey) : undefined;
    if (!running || inFlight.current) return;
    inFlight.current = true;
    setStep("review");
    setSaving(true);
    void running.then(finish);
    // Only on mount: later saves are tracked by `save`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const focusField = useRef<Field>("subject");
  const stepChanged = useRef(false);
  useEffect(() => {
    if (!stepChanged.current) {
      stepChanged.current = true;
      return;
    }
    if (requestedStep === "review") reviewHeadingRef.current?.focus();
    if (requestedStep === "edit") (focusField.current === "body" ? bodyRef : subjectRef).current?.focus();
  }, [requestedStep]);

  const review = () => {
    const found = validate(values);
    setErrors(found);
    const invalid: Field | null = found.subject ? "subject" : found.body ? "body" : null;
    if (invalid) {
      focusField.current = invalid;
      if (step === "edit") (invalid === "body" ? bodyRef : subjectRef).current?.focus();
      else setStep("edit");
      return;
    }
    ensureDraft();
    setSaveError(null);
    setStep("review");
  };

  const backToEditing = () => {
    focusField.current = "subject";
    setSaveError(null);
    setStep("edit");
  };

  const save = () => {
    // The ref blocks a second click before React re-renders the disabled button.
    if (inFlight.current || !draft || draft.savedTaskId) return;
    inFlight.current = true;
    setSaving(true);
    setSaveError(null);
    dispatch({ type: "draft_submit_started", key });
    // Demo only: applies to this one attempt, so "Try again" then behaves normally.
    const fetchImpl = loseResponse ? fetchLosingResponse : fetch;
    setLoseResponse(false);
    const request: ReviewTaskRequest = {
      client_id: draft.client_id,
      opportunity_id: draft.opportunity_id,
      subject: draft.subject.trim(),
      body: draft.body.trim(),
      confirmed: true,
      idempotency_key: draft.idempotencyKey,
    };
    void submitReviewTask(request, fetchImpl).then(finish);
  };

  const saved = draft?.savedTaskId ? draft : null;
  const status = saved ? (
    <Badge tone="ok">Task saved</Badge>
  ) : draft ? (
    <Badge tone="warn">Unsaved draft</Badge>
  ) : (
    <Badge>Not saved</Badge>
  );

  return (
    <Card aria-labelledby={headingId}>
      <CardHeader title={block.title} headingId={headingId}>
        {status}
      </CardHeader>
      <CardBody className="grid gap-4">
        <TaskTarget block={block} />

        {saved ? (
          <SavedTask draft={saved} replayed={replayed} />
        ) : step === "preview" ? (
          <div className="grid gap-4">
            <p className="flex items-start gap-2 text-sm text-muted">
              <Sparkles aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              <span>AI-generated draft based on the evidence. Edit it as needed — nothing is saved until you confirm.</span>
            </p>
            <TaskContent subject={values.subject} body={values.body} />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                onClick={() => {
                  focusField.current = "subject";
                  setStep("edit");
                }}
              >
                <PenLine aria-hidden="true" className="h-4 w-4" />
                Edit task
              </Button>
              <Button variant="secondary" onClick={review}>
                Review and save
              </Button>
            </div>
          </div>
        ) : step === "edit" ? (
          <form
            noValidate
            className="grid gap-4"
            aria-label="Edit review task"
            onSubmit={(e) => {
              e.preventDefault();
              review();
            }}
          >
            <p className="flex items-start gap-2 text-sm text-muted">
              <Sparkles aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {draft
                  ? "Your edited draft. Changes are kept in this browser until you save."
                  : "AI-generated draft based on the evidence. Nothing is saved until you confirm."}
              </span>
            </p>
            <TextField
              label="Subject"
              hint="A short title for the task."
              error={errors.subject}
              value={values.subject}
              max={REVIEW_TASK_LIMITS.subject}
              onChange={(v) => edit("subject", v)}
              inputRef={subjectRef}
            />
            <TextField
              label="Details"
              hint="What should be reviewed and with whom."
              error={errors.body}
              value={values.body}
              max={REVIEW_TASK_LIMITS.body}
              multiline
              onChange={(v) => edit("body", v)}
              inputRef={bodyRef}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="primary">
                Review and save
              </Button>
            </div>
          </form>
        ) : (
          <section aria-labelledby={`${block.id}-review`} className="grid gap-4" aria-busy={saving}>
            <h3 id={`${block.id}-review`} ref={reviewHeadingRef} tabIndex={-1} className="text-sm font-semibold outline-none">
              Review before saving
            </h3>
            <TaskContent subject={values.subject} body={values.body} />
            <p className="flex items-start gap-2 rounded-xl bg-chip px-3 py-2 text-sm text-muted">
              <Briefcase aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              Confirming saves this task to RADAR&apos;s local task list for {findClient(block.client_id)?.name ?? block.client_id}.
              It isn&apos;t sent to the client or anyone else.
            </p>
            {saving ? <LoadingState title="Saving review task…" /> : null}
            {saveError ? (
              <ErrorState
                title={saveError.title}
                actions={
                  saveError.retryable ? (
                    <Button variant="secondary" onClick={save}>
                      Try again
                    </Button>
                  ) : null
                }
              >
                {saveError.message}
              </ErrorState>
            ) : null}
            {saveError?.retryable ? null : (
              <div className="flex items-center gap-2 text-xs text-muted">
                <input
                  id={loseResponseId}
                  type="checkbox"
                  checked={loseResponse}
                  disabled={saving}
                  onChange={(e) => setLoseResponse(e.target.checked)}
                  className="h-4 w-4 accent-accent"
                />
                <label htmlFor={loseResponseId}>Simulate a lost response (the task is saved, but its reply never arrives)</label>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {saveError?.retryable ? null : (
                <Button variant="primary" onClick={save} disabled={saving}>
                  {saving ? "Saving…" : "Confirm and save task"}
                </Button>
              )}
              <Button variant="secondary" onClick={backToEditing} disabled={saving}>
                Back to editing
              </Button>
            </div>
          </section>
        )}
      </CardBody>
      {briefing ? (
        <SnapshotFooter
          icon={<Briefcase aria-hidden="true" className="h-4 w-4 shrink-0" />}
          label={<span>Briefing</span>}
          snapshot={briefing}
          workspace="Briefing"
          className="rounded-b-2xl"
        />
      ) : null}
    </Card>
  );
}
