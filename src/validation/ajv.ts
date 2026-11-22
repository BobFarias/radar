import Ajv2020, { type ErrorObject } from "ajv/dist/2020";

/** Single shared AJV instance (draft 2020-12, matching block_schema.json). */
export const ajv = new Ajv2020({ allErrors: true, strict: true });

export function formatAjvErrors(errors: ErrorObject[] | null | undefined): string[] {
  if (!errors) return [];
  return errors.map((e) => {
    const path = e.instancePath || "(root)";
    if (e.keyword === "additionalProperties") {
      return `${path} has unexpected property "${String(e.params.additionalProperty)}"`;
    }
    if (e.keyword === "enum") {
      return `${path} must be one of: ${(e.params.allowedValues as unknown[]).join(", ")}`;
    }
    return `${path} ${e.message ?? "is invalid"}`;
  });
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
