import type { ReactNode } from "react";
import { SCENARIO_IDS } from "@/contracts/api";
import { AppShell } from "@/components/shell/AppShell";
import { SourcePanel } from "@/components/source/SourcePanel";
import { findFixture } from "@/server/catalog";
import { RadarProviders } from "@/state/RadarProviders";

/** Shared layout: providers live here so state survives navigation between workspaces. */
export default function RadarLayout({ children }: { children: ReactNode }) {
  const scenarios = SCENARIO_IDS.map((id) => ({ id, prompt: findFixture(id)?.prompt ?? id }));
  return (
    <RadarProviders scenarios={scenarios}>
      <AppShell>{children}</AppShell>
      <SourcePanel />
    </RadarProviders>
  );
}
