import type { BlockValidationResult } from "./blocks";

/** Response event envelopes as they arrive (block payload still untrusted). */
export type RawResponseEvent =
  | { kind: "status"; message: string }
  | { kind: "block"; block: unknown }
  | { kind: "complete"; message: string }
  | { kind: "error"; code: string; message: string; retryable: boolean };

/** Events after envelope + block validation. */
export type ValidatedEvent =
  | { kind: "status"; message: string }
  | { kind: "block"; result: BlockValidationResult }
  | { kind: "complete"; message: string }
  | { kind: "error"; code: string; message: string; retryable: boolean }
  | { kind: "invalid_event"; errors: string[] };
