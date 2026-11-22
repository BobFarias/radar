import type { ReviewFormBlock } from "@/contracts/blocks";
import { Card, CardBody, CardHeader } from "@/components/ui";

/**
 * Phase 1: read-only preview of the generated draft. Editing, explicit
 * confirmation and saving (workspace drafts + POST /api/review-tasks) are Phase 2.
 */
export function ReviewForm({ block }: { block: ReviewFormBlock }) {
  const headingId = `${block.id}-heading`;
  return (
    <Card aria-labelledby={headingId}>
      <CardHeader title={block.title} headingId={headingId} />
      <CardBody>
        <dl className="grid gap-3 text-sm">
          <div>
            <dt className="text-xs text-muted">Client · Opportunity</dt>
            <dd>
              {block.client_id} · {block.opportunity_id}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Subject</dt>
            <dd>{block.subject}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Body</dt>
            <dd className="whitespace-pre-line">{block.body}</dd>
          </div>
        </dl>
      </CardBody>
    </Card>
  );
}
