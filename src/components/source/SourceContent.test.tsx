// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { SourceRecord } from "@/contracts/api";
import { DocumentCanvas, DocumentPage } from "./DocumentCanvas";
import { SourceContent } from "./SourceContent";

const source: SourceRecord = {
  source_id: "SRC123",
  title: "Example bulletin",
  source_name: "Example Publisher",
  published_date: "2026-09-01",
  content: "First line.\nSecond line, exactly as supplied.",
};

describe("DocumentCanvas", () => {
  it("is a named region that holds every page it is given", () => {
    render(
      <DocumentCanvas label="Original source text">
        <DocumentPage>Page one</DocumentPage>
        <DocumentPage>Page two</DocumentPage>
      </DocumentCanvas>,
    );
    const canvas = screen.getByRole("region", { name: "Original source text" });
    expect(within(canvas).getAllByRole("article")).toHaveLength(2);
  });
});

describe("SourceContent", () => {
  it("renders the source text verbatim with its publisher and date", () => {
    render(<SourceContent source={source} />);
    const page = screen.getByRole("article");
    expect(within(page).getByText(/First line\./).textContent).toBe(source.content);
    expect(within(page).getByText("Example Publisher")).toBeInTheDocument();
    expect(within(page).getByText("1 September 2026")).toHaveAttribute("datetime", "2026-09-01");
    expect(within(page).getByText("Verbatim")).toBeInTheDocument();
  });

  it("says it is a source-text preview, without inventing pages", () => {
    render(<SourceContent source={source} />);
    expect(screen.getByText(/Source-text preview of SRC123/)).toHaveTextContent("not the complete original document");
    expect(screen.queryByText(/page \d/i)).toBeNull();
  });
});
