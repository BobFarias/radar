import "server-only";
import { isPlainObject } from "@/validation/ajv";
import { findClient, findOpportunity } from "../catalog";
import { apiError, type HandlerResult } from "../http";

export const LIMITS = { subject: 200, body: 5000 } as const;
export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

export interface ValidTaskInput {
  client_id: string;
  opportunity_id: string;
  subject: string;
  body: string;
  idempotency_key: string;
}

type Validation = { ok: true; value: ValidTaskInput } | { ok: false; error: HandlerResult<never> };

function requiredText(value: unknown, field: string, max: number, details: string[]): string {
  if (typeof value !== "string" || value.trim() === "") {
    details.push(`${field} is required`);
    return "";
  }
  if (value.trim().length > max) details.push(`${field} must be at most ${max} characters`);
  return value.trim();
}

/**
 * Order: shape (400) → explicit confirmation (422) → references (422).
 * Confirmation must be the literal boolean true; truthy strings do not count.
 */
export function validateTaskInput(input: unknown): Validation {
  if (!isPlainObject(input)) {
    return { ok: false, error: apiError(400, "invalid_request", "Request body must be a JSON object.") };
  }

  const details: string[] = [];
  const client_id = typeof input.client_id === "string" ? input.client_id : "";
  const opportunity_id = typeof input.opportunity_id === "string" ? input.opportunity_id : "";
  if (!client_id) details.push("client_id is required");
  if (!opportunity_id) details.push("opportunity_id is required");
  const subject = requiredText(input.subject, "subject", LIMITS.subject, details);
  const body = requiredText(input.body, "body", LIMITS.body, details);
  const idempotency_key = typeof input.idempotency_key === "string" ? input.idempotency_key : "";
  if (!IDEMPOTENCY_KEY_PATTERN.test(idempotency_key)) {
    details.push("idempotency_key must be 8-128 characters of letters, digits, '_' or '-'");
  }
  if (input.confirmed !== undefined && typeof input.confirmed !== "boolean") {
    details.push("confirmed must be a boolean");
  }
  if (details.length > 0) {
    return { ok: false, error: apiError(400, "invalid_request", "Invalid review task.", details) };
  }

  if (input.confirmed !== true) {
    return {
      ok: false,
      error: apiError(422, "confirmation_required", "The review task must be explicitly confirmed before saving."),
    };
  }

  if (!findClient(client_id)) {
    return { ok: false, error: apiError(422, "unknown_client", `Unknown client "${client_id}".`) };
  }
  const opportunity = findOpportunity(opportunity_id);
  if (!opportunity) {
    return { ok: false, error: apiError(422, "unknown_opportunity", `Unknown opportunity "${opportunity_id}".`) };
  }
  if (opportunity.client_id !== client_id) {
    return {
      ok: false,
      error: apiError(
        422,
        "opportunity_client_mismatch",
        `Opportunity "${opportunity_id}" does not belong to client "${client_id}".`,
      ),
    };
  }

  return { ok: true, value: { client_id, opportunity_id, subject, body, idempotency_key } };
}
