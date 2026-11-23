import type { ReactNode } from "react";
import { cn } from "./cn";

export type BadgeTone = "neutral" | "accent" | "warn" | "danger" | "ok";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-chip text-ink",
  accent: "bg-accent/10 text-danger", // text-accent on this tint is 4.15:1; danger keeps the red at 6.7:1
  warn: "bg-warn-bg text-warn",
  danger: "bg-danger-bg text-danger",
  ok: "bg-ok-bg text-ok",
};

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone])}>
      {children}
    </span>
  );
}
