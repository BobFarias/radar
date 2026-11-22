import { SCENARIO_IDS } from "@/contracts/api";
import { ScenarioRunner } from "@/views/agent/ScenarioRunner";
import { findFixture } from "@/server/catalog";

export default function Home() {
  const scenarios = SCENARIO_IDS.map((id) => ({ id, prompt: findFixture(id)?.prompt ?? id }));
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">RADAR</h1>
        <p className="text-sm text-muted">Client Opportunity Intelligence — Phase 1 foundation</p>
      </header>
      <div className="rounded-2xl bg-surface p-4 sm:p-6">
        <ScenarioRunner scenarios={scenarios} />
      </div>
    </main>
  );
}
