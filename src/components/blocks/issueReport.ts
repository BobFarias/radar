/**
 * Plain-text issue report for a block that couldn't be shown. Only allow-listed
 * identifiers and validation messages are included — never the block payload,
 * titles or other response text — and every value is length-limited and
 * stripped of control characters.
 */

export type BlockIssueKind = "unsupported" | "invalid" | "render_error";

const ISSUE_CODES: Record<BlockIssueKind, string> = {
  unsupported: "unsupported_view",
  invalid: "invalid_data",
  render_error: "display_error",
};

export interface IssueReportInput {
  kind: BlockIssueKind;
  blockId: string | null;
  blockType: string | null;
  errors?: string[];
  requestId?: string;
  scenarioId?: string;
  generatedAt: Date;
}

export const MAX_REPORT_VALUE = 120;
export const MAX_REPORT_ERRORS = 5;

export function safeReportValue(value: string | null | undefined): string {
  if (!value) return "unknown";
  const clean = value.replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
  if (!clean) return "unknown";
  return clean.length > MAX_REPORT_VALUE ? `${clean.slice(0, MAX_REPORT_VALUE)}…` : clean;
}

export function buildIssueReport(input: IssueReportInput): string {
  const errors = input.errors ?? [];
  const lines = [
    "RADAR issue report",
    `Issue: ${ISSUE_CODES[input.kind]}`,
    `Block id: ${safeReportValue(input.blockId)}`,
    `Block type: ${safeReportValue(input.blockType)}`,
    `Request id: ${safeReportValue(input.requestId)}`,
    `Demo scenario: ${safeReportValue(input.scenarioId)}`,
    `Reported at: ${input.generatedAt.toISOString()}`,
  ];
  if (errors.length > 0) {
    lines.push("Validation errors:");
    for (const error of errors.slice(0, MAX_REPORT_ERRORS)) lines.push(`- ${safeReportValue(error)}`);
    if (errors.length > MAX_REPORT_ERRORS) lines.push(`- …and ${errors.length - MAX_REPORT_ERRORS} more`);
  }
  lines.push("The block content was not included in this report.");
  return lines.join("\n");
}

export interface ResponseIssueReportInput {
  errorCode: string;
  requestIds: string[];
  runId: string | null;
  scenarioId?: string;
  sectionsShown: number;
  generatedAt: Date;
}

/** Report for a response that ended early. The error message and block content are not included. */
export function buildResponseIssueReport(input: ResponseIssueReportInput): string {
  return [
    "RADAR issue report",
    "Issue: partial_response",
    `Error code: ${safeReportValue(input.errorCode)}`,
    `Attempts: ${input.requestIds.length}`,
    `Request ids: ${input.requestIds.slice(-MAX_REPORT_ERRORS).map(safeReportValue).join(", ") || "unknown"}`,
    `Run id: ${safeReportValue(input.runId)}`,
    `Demo scenario: ${safeReportValue(input.scenarioId)}`,
    `Sections shown: ${input.sectionsShown}`,
    `Reported at: ${input.generatedAt.toISOString()}`,
    "The response content was not included in this report.",
  ].join("\n");
}
