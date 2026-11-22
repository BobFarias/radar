import type { Metadata } from "next";
import { AgentView } from "@/views/agent/AgentView";

export const metadata: Metadata = { title: "Agent · RADAR" };

export default function AgentPage() {
  return <AgentView />;
}
