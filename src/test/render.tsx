import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { SCENARIO_IDS } from "@/contracts/api";
import { SourcePanel } from "@/components/source/SourcePanel";
import { fixtures } from "./fixtures";
import { RadarProviders } from "@/state/RadarProviders";

export const testScenarios = SCENARIO_IDS.map((id) => ({ id, prompt: fixtures[id].prompt }));

/** Renders inside the same providers and source panel as the real layout. */
export function renderWithRadar(ui: ReactElement) {
  const wrap = (node: ReactElement) => (
    <RadarProviders scenarios={testScenarios}>
      {node}
      <SourcePanel />
    </RadarProviders>
  );
  const result = render(wrap(ui));
  // Rerender inside the same providers, so provider state is preserved.
  return { ...result, rerender: (next: ReactElement) => result.rerender(wrap(next)) };
}
