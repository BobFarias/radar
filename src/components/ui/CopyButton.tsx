"use client";

import { Check, ClipboardCopy } from "lucide-react";
import { useState } from "react";
import { Button } from "./Button";

export type CopyState = "idle" | "copied" | "failed";

/**
 * Copies text to the clipboard and announces the outcome politely. Copying is
 * local only; nothing is sent anywhere.
 */
export function CopyButton({
  text,
  label,
  copiedMessage,
  failedMessage,
  onStateChange,
}: {
  text: string;
  label: string;
  copiedMessage: string;
  failedMessage: string;
  onStateChange?: (state: CopyState) => void;
}) {
  const [state, setState] = useState<CopyState>("idle");
  const update = (next: CopyState) => {
    setState(next);
    onStateChange?.(next);
  };

  const copy = async () => {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text);
      update("copied");
    } catch {
      update("failed");
    }
  };

  return (
    <>
      <Button variant="ghost" onClick={copy}>
        {state === "copied" ? <Check aria-hidden="true" className="h-4 w-4" /> : <ClipboardCopy aria-hidden="true" className="h-4 w-4" />}
        {label}
      </Button>
      <span aria-live="polite" className="self-center text-xs">
        {state === "copied" ? copiedMessage : null}
        {state === "failed" ? failedMessage : null}
      </span>
    </>
  );
}
