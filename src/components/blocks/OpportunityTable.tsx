import type { OpportunityTableBlock, Priority } from "@/contracts/blocks";
import { Badge, Card, CardBody, CardHeader, EmptyState, type BadgeTone } from "@/components/ui";

const priorityTone: Record<Priority, BadgeTone> = { High: "accent", Medium: "warn", Low: "neutral" };

export function OpportunityTable({ block }: { block: OpportunityTableBlock }) {
  const headingId = `${block.id}-heading`;
  return (
    <Card aria-labelledby={headingId}>
      <CardHeader title={block.title} headingId={headingId} />
      <CardBody>
        {block.rows.length === 0 ? (
          <EmptyState title="No opportunities in this response." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <caption className="sr-only">{block.title}</caption>
              <thead>
                <tr className="bg-chip text-muted">
                  <th scope="col" className="px-3 py-2 font-medium">Opportunity</th>
                  <th scope="col" className="px-3 py-2 font-medium">Client</th>
                  <th scope="col" className="px-3 py-2 font-medium">Priority</th>
                  <th scope="col" className="px-3 py-2 font-medium">Stage</th>
                  <th scope="col" className="px-3 py-2 font-medium">Status note</th>
                  <th scope="col" className="px-3 py-2 font-medium">Sources</th>
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row) => (
                  <tr key={row.opportunity_id} className="border-b border-line align-top last:border-0">
                    <th scope="row" className="px-3 py-3 font-medium">
                      {row.title}
                      <span className="block text-xs font-normal text-muted">{row.opportunity_id}</span>
                    </th>
                    <td className="px-3 py-3">{row.client_name}</td>
                    <td className="px-3 py-3">
                      <Badge tone={priorityTone[row.priority]}>{row.priority}</Badge>
                    </td>
                    <td className="px-3 py-3">{row.stage}</td>
                    <td className="px-3 py-3 text-muted">{row.status_note}</td>
                    <td className="px-3 py-3">{row.source_ids.length ? row.source_ids.join(", ") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
