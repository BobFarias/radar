import type { Metadata } from "next";
import { BriefingView } from "@/views/briefing/BriefingView";

export const metadata: Metadata = { title: "Briefing · RADAR" };

export default function BriefingPage() {
  return <BriefingView />;
}
