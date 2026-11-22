import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cn("rounded-2xl border border-line bg-surface", className)} {...props} />;
}

export function CardHeader({ title, children, headingId }: { title: ReactNode; children?: ReactNode; headingId?: string }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4 pb-3">
      <h2 id={headingId} className="text-base font-semibold">
        {title}
      </h2>
      {children}
    </header>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 pb-5", className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center justify-between gap-3 rounded-b-2xl bg-chip px-5 py-3 text-sm text-muted", className)}
      {...props}
    />
  );
}
