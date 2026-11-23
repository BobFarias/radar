import type { ReactNode } from "react";
import { cn } from "./cn";

/**
 * Accessible state messages. Errors use role="alert"; progress and
 * confirmations use role="status" (polite live region).
 */

interface StateProps {
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
  /** Render the title as a heading when the message is the page's main content (e.g. not found). */
  titleAs?: "p" | "h1" | "h2";
}

function Frame({ role, tone, title, children, actions, className, titleAs: Title = "p" }: StateProps & { role?: "alert" | "status"; tone: string }) {
  return (
    <div role={role} className={cn("rounded-xl px-4 py-3 text-sm", tone, className)}>
      <Title className="font-semibold">{title}</Title>
      {children ? <div className="mt-1">{children}</div> : null}
      {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function LoadingState({ title, children, className }: StateProps) {
  return (
    <div role="status" aria-busy="true" className={cn("flex items-center gap-3 text-sm text-muted", className)}>
      <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-accent motion-reduce:animate-none" />
      <span>
        {title}
        {children}
      </span>
    </div>
  );
}

export function EmptyState(props: StateProps) {
  return <Frame tone="bg-chip text-muted" {...props} />;
}

export function WarningState(props: StateProps) {
  return <Frame role="status" tone="bg-warn-bg text-warn" {...props} />;
}

export function ErrorState(props: StateProps) {
  return <Frame role="alert" tone="bg-danger-bg text-danger" {...props} />;
}

export function ConfirmationState(props: StateProps) {
  return <Frame role="status" tone="bg-ok-bg text-ok" {...props} />;
}
