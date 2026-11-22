// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { BarChartBlock } from "@/contracts/blocks";
import { fixtureBlock } from "@/test/fixtures";
import { validateBlock } from "@/validation/blocks";
import { BarChart } from "./BarChart";

function chart(): BarChartBlock {
  const result = validateBlock(fixtureBlock("overview", "overview-chart"));
  if (result.status !== "valid" || result.block.type !== "bar_chart") throw new Error("fixture invalid");
  return result.block;
}

describe("BarChart", () => {
  it("renders the validated labels and counts as readable text", () => {
    render(<BarChart block={chart()} />);
    const figure = screen.getByRole("figure", { name: "Opportunities by priority" });
    const values = within(figure).getAllByRole("definition").map((d) => d.textContent);
    expect(within(figure).getAllByRole("term").map((t) => t.textContent)).toEqual(["High", "Medium"]);
    expect(values).toEqual(["2", "1"]);
  });

  it("states that the chart covers all opportunities, not the filtered table", () => {
    render(<BarChart block={chart()} />);
    expect(screen.getByRole("figure")).toHaveAccessibleDescription(
      "Number of opportunities by priority · all opportunities in this response (table filters do not apply)",
    );
  });

  it("hides the decorative SVG from assistive technology", () => {
    const { container } = render(<BarChart block={chart()} />);
    expect(container.querySelector('[aria-hidden="true"].h-56')).not.toBeNull();
  });

  it("shows an empty state for an empty series", () => {
    render(<BarChart block={{ ...chart(), series: [] }} />);
    expect(screen.getByText("No data to chart.")).toBeInTheDocument();
    expect(screen.queryByRole("figure")).toBeNull();
  });
});
