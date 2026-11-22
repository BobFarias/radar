import type { RawResponseEvent, ValidatedEvent } from "@/contracts/events";
import { ajv, formatAjvErrors, isPlainObject } from "./ajv";
import { validateBlock } from "./blocks";

/**
 * Event envelopes are not covered by block_schema.json, so this schema is
 * derived from the shapes in data/response_fixtures.json. Envelopes are strict;
 * the block payload is validated separately against the official schema.
 */
const eventSchema = {
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "message"],
      properties: { kind: { const: "status" }, message: { type: "string" } },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "block"],
      properties: { kind: { const: "block" }, block: {} },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "message"],
      properties: { kind: { const: "complete" }, message: { type: "string" } },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "code", "message", "retryable"],
      properties: {
        kind: { const: "error" },
        code: { type: "string" },
        message: { type: "string" },
        retryable: { type: "boolean" },
      },
    },
  ],
} as const;

const validateEnvelope = ajv.compile<RawResponseEvent>(eventSchema);

export function validateEvent(raw: unknown): ValidatedEvent {
  if (!validateEnvelope(raw)) {
    const kind = isPlainObject(raw) ? raw.kind : undefined;
    return {
      kind: "invalid_event",
      errors: [
        typeof kind === "string" ? `Event of kind "${kind}" is malformed` : "Event has no valid kind",
        ...formatAjvErrors(validateEnvelope.errors).slice(0, 5),
      ],
    };
  }

  if (raw.kind === "block") {
    return { kind: "block", result: validateBlock(raw.block) };
  }
  return raw;
}

export interface RespondEnvelope {
  request_id: string;
  run_id: string;
  events: unknown[];
}

/** Validates the outer POST /api/respond body (events validated one by one). */
export function parseRespondEnvelope(body: unknown): RespondEnvelope | null {
  if (
    isPlainObject(body) &&
    typeof body.request_id === "string" &&
    typeof body.run_id === "string" &&
    Array.isArray(body.events)
  ) {
    return { request_id: body.request_id, run_id: body.run_id, events: body.events };
  }
  return null;
}
