import blockSchema from "@docs/block_schema.json";
import {
  isKnownBlockType,
  type Block,
  type BlockType,
  type BlockValidationResult,
} from "@/contracts/blocks";
import { ajv, formatAjvErrors, isPlainObject } from "./ajv";

/**
 * The supplied schema is the single source of truth. The full `oneOf` decides
 * validity; per-type branches (selected by their `type` const) only produce
 * focused error messages, since oneOf errors list every branch.
 */
const validateAnyBlock = ajv.compile<Block>(blockSchema);

const branchValidators = new Map(
  blockSchema.oneOf.map((branch) => [
    branch.properties.type.const as BlockType,
    ajv.compile({ $schema: blockSchema.$schema, ...branch }),
  ]),
);

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function validateBlock(raw: unknown): BlockValidationResult {
  if (!isPlainObject(raw) || !isKnownBlockType(raw.type)) {
    return {
      status: "unsupported",
      id: isPlainObject(raw) ? stringOrNull(raw.id) : null,
      type: isPlainObject(raw) ? stringOrNull(raw.type) : null,
    };
  }

  if (validateAnyBlock(raw)) {
    return { status: "valid", block: raw };
  }

  const branch = branchValidators.get(raw.type);
  branch?.(raw);
  return {
    status: "invalid",
    id: stringOrNull(raw.id),
    type: raw.type,
    title: stringOrNull(raw.title),
    errors: formatAjvErrors(branch?.errors ?? validateAnyBlock.errors),
  };
}
