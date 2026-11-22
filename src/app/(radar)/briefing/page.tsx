import type { Metadata } from "next";
import { WorkspacePlaceholder } from "@/views/workspace/WorkspacePlaceholder";

export const metadata: Metadata = { title: "Briefing · RADAR" };

export default function BriefingPage() {
  return (
    <WorkspacePlaceholder
      title="Briefing"
      description="Briefings you prepare in Agent, with their evidence and review tasks, will be listed here."
    />
  );
}
