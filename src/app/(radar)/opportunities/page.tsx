import type { Metadata } from "next";
import { WorkspacePlaceholder } from "@/views/workspace/WorkspacePlaceholder";

export const metadata: Metadata = { title: "Opportunities · RADAR" };

export default function OpportunitiesPage() {
  return (
    <WorkspacePlaceholder
      title="Opportunities"
      description="Opportunity analyses you generate in Agent will be listed here so you can reopen them."
    />
  );
}
