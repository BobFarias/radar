"use client";

import { Bar, BarChart as RechartsBarChart, CartesianGrid, LabelList, ResponsiveContainer, XAxis, YAxis } from "recharts";
import type { BarChartBlock } from "@/contracts/blocks";
import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui";

/**
 * Chart from the validated block. Its numbers come from the response, so table
 * filters do not change it — the caption says so. The visible value list is
 * the text equivalent; the SVG itself is decorative for assistive tech.
 */
export function BarChart({ block }: { block: BarChartBlock }) {
  const headingId = `${block.id}-heading`;
  const captionId = `${block.id}-caption`;
  return (
    <Card aria-labelledby={headingId}>
      <CardHeader title={block.title} headingId={headingId} />
      <CardBody>
        {block.series.length === 0 ? (
          <EmptyState title="No data to chart." />
        ) : (
          <figure aria-labelledby={headingId} aria-describedby={captionId} className="grid gap-3">
            <div aria-hidden="true" className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height: 224 }}>
                <RechartsBarChart data={block.series} margin={{ top: 20, right: 8, bottom: 4, left: 0 }} accessibilityLayer={false}>
                  <CartesianGrid vertical={false} stroke="var(--color-line)" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--color-ink)", fontSize: 13 }} />
                  <YAxis allowDecimals={false} width={32} tickLine={false} axisLine={false} tick={{ fill: "var(--color-muted)", fontSize: 12 }} />
                  <Bar dataKey="value" fill="var(--color-accent)" radius={[6, 6, 0, 0]} maxBarSize={72} isAnimationActive={false}>
                    <LabelList dataKey="value" position="top" fill="var(--color-ink)" fontSize={13} />
                  </Bar>
                </RechartsBarChart>
              </ResponsiveContainer>
            </div>
            <figcaption id={captionId} className="text-xs text-muted">
              {block.y_label} by {block.x_label.toLowerCase()} · all opportunities in this response (table filters do not apply)
            </figcaption>
            <dl className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
              {block.series.map((point) => (
                <div key={point.label} className="flex gap-1.5">
                  <dt className="text-muted">{point.label}</dt>
                  <dd className="font-semibold tabular-nums">{point.value}</dd>
                </div>
              ))}
            </dl>
          </figure>
        )}
      </CardBody>
    </Card>
  );
}
