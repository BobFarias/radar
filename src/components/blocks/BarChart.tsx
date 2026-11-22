import type { BarChartBlock } from "@/contracts/blocks";
import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui";

/** Horizontal bars with the exact value printed beside each, so the chart reads without colour or hover. */
export function BarChart({ block }: { block: BarChartBlock }) {
  const headingId = `${block.id}-heading`;
  const max = Math.max(0, ...block.series.map((p) => p.value));
  return (
    <Card aria-labelledby={headingId}>
      <CardHeader title={block.title} headingId={headingId} />
      <CardBody>
        {block.series.length === 0 ? (
          <EmptyState title="No data to chart." />
        ) : (
          <figure>
            <figcaption className="mb-3 text-xs text-muted">
              {block.y_label} by {block.x_label.toLowerCase()}
            </figcaption>
            <dl className="space-y-2">
              {block.series.map((point) => (
                <div key={point.label} className="grid grid-cols-[6rem_1fr_3rem] items-center gap-3 text-sm">
                  <dt className="truncate">{point.label}</dt>
                  <dd className="h-6 rounded bg-chip" aria-hidden="true">
                    <div
                      className="h-full rounded bg-accent"
                      style={{ width: max > 0 ? `${(point.value / max) * 100}%` : "0%" }}
                    />
                  </dd>
                  <dd className="text-right tabular-nums">{point.value}</dd>
                </div>
              ))}
            </dl>
          </figure>
        )}
      </CardBody>
    </Card>
  );
}
