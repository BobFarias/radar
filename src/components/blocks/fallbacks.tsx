import type { BlockType } from "@/contracts/blocks";
import { WarningState } from "@/components/ui";
import { BLOCK_LABELS } from "./registry";

const MAX_LABEL = 64;

function safeLabel(value: string | null): string | null {
  if (!value) return null;
  return value.length > MAX_LABEL ? `${value.slice(0, MAX_LABEL)}…` : value;
}

/** Unknown component type. Only the type name is shown, as text; the payload is never rendered. */
export function UnsupportedBlockFallback({ type }: { type: string | null }) {
  const label = safeLabel(type);
  return (
    <WarningState title="This view isn't available">
      The response asked for a component this app doesn&apos;t support
      {label ? (
        <>
          {" "}
          (<code>{label}</code>)
        </>
      ) : null}
      . Nothing from it was displayed.
    </WarningState>
  );
}

/** Known component whose data failed schema validation. Never rendered with coerced data. */
export function InvalidBlockFallback({ type, title, errors }: { type: BlockType; title: string | null; errors: string[] }) {
  const name = safeLabel(title) ?? `This ${BLOCK_LABELS[type]}`;
  return (
    <WarningState title={`${name} couldn't be displayed`}>
      <p>The {BLOCK_LABELS[type]} data failed validation, so it isn&apos;t shown rather than risk presenting incorrect information.</p>
      {errors.length > 0 ? (
        <details className="mt-2">
          <summary className="cursor-pointer">Technical details</summary>
          <ul className="mt-1 list-disc pl-5 font-mono text-xs">
            {errors.slice(0, 5).map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </WarningState>
  );
}

export function RenderErrorFallback({ type }: { type: BlockType }) {
  return (
    <WarningState title="Something went wrong showing this section">
      The {BLOCK_LABELS[type]} could not be rendered. Other sections are unaffected.
    </WarningState>
  );
}
