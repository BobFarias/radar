import { Badge } from "@/components/ui";
import type { BriefingStatus } from "./briefingQuery";

export const BRIEFING_STATUS_LABEL: Record<BriefingStatus, string> = {
  generated: "Generated briefing",
  draft: "Unsaved draft",
  saved: "Task saved",
};

export function BriefingStatusBadge({ status }: { status: BriefingStatus }) {
  return <Badge tone={status === "saved" ? "ok" : status === "draft" ? "warn" : "neutral"}>{BRIEFING_STATUS_LABEL[status]}</Badge>;
}
