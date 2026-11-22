"use client";

import type { ReactNode } from "react";
import type { ControllerDeps } from "@/state/response/controller";
import { AgentSessionProvider } from "./agent/AgentSessionProvider";
import type { ScenarioOption } from "./agent/conversation";
import { WorkspaceProvider } from "./workspace/WorkspaceProvider";

export function RadarProviders({
  scenarios,
  deps,
  children,
}: {
  scenarios: ScenarioOption[];
  deps?: ControllerDeps;
  children: ReactNode;
}) {
  return (
    <WorkspaceProvider>
      <AgentSessionProvider scenarios={scenarios} deps={deps}>
        {children}
      </AgentSessionProvider>
    </WorkspaceProvider>
  );
}
