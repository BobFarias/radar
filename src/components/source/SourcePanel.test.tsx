// @vitest-environment jsdom
import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { OpportunityTable } from "@/components/blocks/OpportunityTable";
import type { OpportunityTableBlock } from "@/contracts/blocks";
import { installApiFetch } from "@/test/apiFetch";
import { fixtureBlock } from "@/test/fixtures";
import { renderWithRadar } from "@/test/render";
import { validateBlock } from "@/validation/blocks";

let fetchSpy: ReturnType<typeof installApiFetch>;
beforeEach(() => {
  fetchSpy = installApiFetch();
});
afterEach(() => fetchSpy.mockRestore());

function overview(): OpportunityTableBlock {
  const result = validateBlock(fixtureBlock("overview", "overview-table"));
  if (result.status !== "valid" || result.block.type !== "opportunity_table") throw new Error("fixture invalid");
  return result.block;
}

const openSrc001 = () =>
  fireEvent.click(screen.getByRole("button", { name: "View source SRC001 for Review payment resilience readiness" }));

describe("Source inspection", () => {
  it("loads the source from the API and separates original text from the AI note", async () => {
    renderWithRadar(<OpportunityTable block={overview()} />);
    openSrc001();

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("status")).toHaveTextContent("Loading source…");

    expect(await within(dialog).findByRole("heading", { name: "Payment resilience consultation" })).toBeInTheDocument();
    expect(dialog).toHaveAccessibleName("Payment resilience consultation");
    expect(fetchSpy).toHaveBeenCalledWith("/api/sources/SRC001", expect.anything());
    const details = within(dialog).getByRole("region", { name: "Source details" });
    expect(within(details).getByText("Fictional Financial Supervisor")).toBeInTheDocument();
    expect(within(details).getByText(/28 September 2026/)).toHaveTextContent("3 days before the as-of date");
    expect(within(details).getByText("1 October 2026")).toBeInTheDocument();

    const original = within(dialog).getByRole("region", { name: "Original source text" });
    expect(original).toHaveTextContent("It is a proposal, not a rule in force.");
    expect(within(original).getByText("Fictional Financial Supervisor")).toBeInTheDocument();
    expect(within(original).getByText("28 September 2026")).toHaveAttribute("datetime", "2026-09-28");
    expect(within(dialog).getByText("Source-text preview")).toBeInTheDocument();
    const note = within(dialog).getByRole("region", { name: "AI-generated note" });
    expect(note).toHaveTextContent("Not from the source");
    expect(note).toHaveTextContent("Consultation proposal; no mandatory implementation date.");
    expect(original).not.toHaveTextContent("Consultation proposal; no mandatory");
    expect(original).not.toHaveTextContent("AI-generated");
    expect(original.contains(note)).toBe(false);
  });

  it("closes without losing the opportunity selection and returns focus", async () => {
    renderWithRadar(<OpportunityTable block={overview()} />);
    const trigger = screen.getByRole("button", { name: "View source SRC001 for Review payment resilience readiness" });
    trigger.focus();
    openSrc001();
    await screen.findByRole("heading", { name: "Payment resilience consultation" });
    expect(screen.getByRole("button", { name: "Close source" })).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "Close source" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();
    expect(screen.getByRole("button", { name: "Review payment resilience readiness" })).toHaveAttribute("aria-pressed", "true");
  });

  it("closes on Escape", async () => {
    renderWithRadar(<OpportunityTable block={overview()} />);
    openSrc001();
    await screen.findByRole("heading", { name: "Payment resilience consultation" });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows an accessible not-found state for a missing source", async () => {
    const block = overview();
    const missing = { ...block, rows: [{ ...block.rows[0]!, source_ids: ["SRC999"] }] };
    renderWithRadar(<OpportunityTable block={missing} />);
    fireEvent.click(screen.getByRole("button", { name: /View source SRC999/ }));

    const alert = await within(screen.getByRole("dialog")).findByRole("alert");
    expect(alert).toHaveTextContent("Source not found");
    expect(alert).toHaveTextContent("SRC999");
    expect(screen.queryByRole("region", { name: "Original source text" })).toBeNull();
  });

  it("offers a retry when the source request fails", async () => {
    fetchSpy.mockResolvedValueOnce(new Response("{}", { status: 500 }));
    renderWithRadar(<OpportunityTable block={overview()} />);
    openSrc001();

    const alert = await within(screen.getByRole("dialog")).findByRole("alert");
    expect(alert).toHaveTextContent("The source could not be loaded");
    fireEvent.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("region", { name: "Original source text" })).toBeInTheDocument();
  });
});
