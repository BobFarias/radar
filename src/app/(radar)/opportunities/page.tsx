import type { Metadata } from "next";
import { OpportunitiesView } from "@/views/opportunities/OpportunitiesView";

export const metadata: Metadata = { title: "Opportunities · RADAR" };

export default function OpportunitiesPage() {
  return <OpportunitiesView />;
}
