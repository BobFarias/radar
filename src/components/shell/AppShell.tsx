"use client";

import { Briefcase, Smile, Zap, type LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/components/ui";

const NAV: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/agent", label: "Agent", icon: Smile },
  { href: "/opportunities", label: "Opportunities", icon: Zap },
  { href: "/briefing", label: "Briefing", icon: Briefcase },
];

function NavLinks({ orientation }: { orientation: "vertical" | "horizontal" }) {
  const pathname = usePathname();
  return (
    <ul className={cn(orientation === "vertical" ? "grid gap-1" : "flex gap-1")}>
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-10 items-center gap-2.5 rounded-full px-3 text-sm font-medium transition-colors",
                active ? "bg-surface text-ink shadow-sm" : "text-ink/75 hover:bg-surface/60 hover:text-ink",
              )}
            >
              <Icon aria-hidden="true" className={cn("h-4 w-4", active && "text-accent")} />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Brand() {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-lg font-bold tracking-[0.2em]">RADAR</span>
      <span className="hidden text-[11px] text-muted lg:inline">Client Opportunity Intelligence</span>
    </div>
  );
}

function Profile() {
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-full bg-line text-xs font-semibold text-muted">
        JS
      </span>
      <div className="leading-tight">
        <p className="text-sm font-medium">John Smith</p>
        <p className="text-[11px] text-muted">Relationship Partner</p>
      </div>
    </div>
  );
}

/** Responsive shell: sidebar on desktop, compact header + tab bar on mobile. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[226px_minmax(0,1fr)] md:gap-5 md:p-4">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-full focus:bg-surface focus:px-4 focus:py-2"
      >
        Skip to content
      </a>

      <aside className="hidden md:sticky md:top-4 md:flex md:h-[calc(100dvh-2rem)] md:flex-col md:gap-8 md:self-start md:px-2.5 md:pt-2.5">
        <Profile />
        <nav aria-label="Workspaces">
          <NavLinks orientation="vertical" />
        </nav>
        <Image
          src="/brand/norton-rose-fulbright-logo.webp"
          alt="Norton Rose Fulbright"
          width={3840}
          height={428}
          sizes="160px"
          className="mt-auto mb-4 h-auto w-40 self-center"
        />
      </aside>

      <header className="sticky top-0 z-30 grid gap-2 border-b border-line bg-canvas/95 px-4 pt-3 pb-2 backdrop-blur md:hidden">
        <Brand />
        <nav aria-label="Workspaces" className="-mx-1 overflow-x-auto">
          <NavLinks orientation="horizontal" />
        </nav>
      </header>

      <main id="main" tabIndex={-1} className="min-w-0 bg-surface md:min-h-[calc(100dvh-2rem)] md:rounded-2xl">
        {children}
      </main>
    </div>
  );
}
