import type { Metadata } from "next";
import { AnalysisDetailView } from "@/views/opportunities/AnalysisDetailView";

type Params = { params: Promise<{ reference: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { reference } = await params;
  return { title: `${decodeURIComponent(reference).slice(0, 16)} · Opportunities · RADAR` };
}

export default async function AnalysisPage({ params }: Params) {
  const { reference } = await params;
  return <AnalysisDetailView reference={decodeURIComponent(reference)} />;
}
