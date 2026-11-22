"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "./cn";

/**
 * Non-modal popover anchored to an icon button. Closes on Escape (returning
 * focus to the button) or an outside click; focuses the first control on open.
 */
export function Popover({
  label,
  icon,
  indicator = false,
  children,
  className,
}: {
  label: string;
  icon: ReactNode;
  /** Small dot on the button, e.g. when filters are active. */
  indicator?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    rootRef.current?.querySelector<HTMLElement>(`#${CSS.escape(panelId)} input, #${CSS.escape(panelId)} button`)?.focus();

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, panelId]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "relative grid h-7 w-7 place-items-center rounded-full border border-sand bg-surface text-icon transition hover:text-ink",
          open && "text-ink",
        )}
      >
        {icon}
        {indicator ? <span aria-hidden="true" className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-accent" /> : null}
      </button>
      {open ? (
        <div
          id={panelId}
          role="group"
          aria-label={label}
          className={cn(
            "absolute top-full right-0 z-20 mt-2 w-[min(307px,calc(100vw-2rem))] rounded-2xl bg-surface p-3 shadow-[0_8px_28px_rgba(0,0,0,0.16)]",
            className,
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
