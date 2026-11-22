import type { Metadata } from "next";
import { BriefingDetailView } from "@/views/briefing/BriefingDetailView";

type Params = { params: Promise<{ reference: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { reference } = await params;
  return { title: `${decodeURIComponent(reference).slice(0, 16)} · Briefing · RADAR` };
}

export default async function BriefingDetailPage({ params }: Params) {
  const { reference } = await params;
  return <BriefingDetailView reference={decodeURIComponent(reference)} />;
}
