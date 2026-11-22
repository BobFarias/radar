import { describe, expect, it } from "vitest";
import { fixtureBlock } from "@/test/fixtures";
import { validateBlock } from "@/validation/blocks";
import { buildIssueReport, MAX_REPORT_VALUE } from "./issueReport";

const at = new Date("2026-10-01T09:00:00.000Z");

describe("buildIssueReport", () => {
  it("lists only allow-listed identifiers", () => {
    const report = buildIssueReport({
      kind: "unsupported",
      blockId: "future-block",
      blockType: "future_component",
      requestId: "req-1",
      scenarioId: "unsupported_block",
      generatedAt: at,
    });
    expect(report).toBe(
      [
        "RADAR issue report",
        "Issue: unsupported_view",
        "Block id: future-block",
        "Block type: future_component",
        "Request id: req-1",
        "Demo scenario: unsupported_block",
        "Reported at: 2026-10-01T09:00:00.000Z",
        "The block content was not included in this report.",
      ].join("\n"),
    );
  });

  it("never includes the unsupported fixture's payload or title", () => {
    const result = validateBlock(fixtureBlock("unsupported_block", "future-block"));
    if (result.status !== "unsupported") throw new Error("expected unsupported");
    const report = buildIssueReport({ kind: "unsupported", blockId: result.id, blockType: result.type, generatedAt: at });
    expect(report).not.toMatch(/script|__assessmentUnsafe|html|Unavailable view/);
  });

  it("includes validation messages for the malformed chart but not the bad value", () => {
    const result = validateBlock(fixtureBlock("malformed_block", "invalid-chart"));
    if (result.status !== "invalid") throw new Error("expected invalid");
    const report = buildIssueReport({ kind: "invalid", blockId: result.id, blockType: result.type, errors: result.errors, generatedAt: at });
    expect(report).toContain("Issue: invalid_data");
    expect(report).toContain("Validation errors:");
    expect(report).toContain("/series/0/value");
    expect(report).not.toContain("not-a-number");
  });

  it("strips control characters, truncates long values and caps the error list", () => {
    const report = buildIssueReport({
      kind: "invalid",
      blockId: `bad\u0000id\nInjected: line`,
      blockType: "bar_chart",
      errors: Array.from({ length: 8 }, (_, i) => `/e${i} ${"x".repeat(200)}`),
      generatedAt: at,
    });
    expect(report).toContain("Block id: bad id Injected: line");
    expect(report.split("\n").every((line) => line.length <= MAX_REPORT_VALUE + 20)).toBe(true);
    expect(report.match(/^- \/e/gm)).toHaveLength(5);
    expect(report).toContain("- …and 3 more");
    expect(report).toContain("Request id: unknown");
  });
});
