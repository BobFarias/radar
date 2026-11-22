// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResponseBlockContext } from "./ResponseBlockContext";
import { InvalidBlockFallback, UnsupportedBlockFallback } from "./fallbacks";

function mockClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
}
afterEach(() => {
  Reflect.deleteProperty(navigator, "clipboard");
});

const status = () => screen.getByRole("status");

describe("block fallbacks", () => {
  it("explains an unsupported view in plain language without internal names", () => {
    render(<UnsupportedBlockFallback id="future-block" type="future_component" otherSections={2} />);
    const details = status().querySelector("details")!;
    const visible = status().textContent!.replace(details.textContent!, "");
    expect(visible).toContain("This part of the answer can't be shown here");
    expect(visible).toContain("The other 2 sections of this answer are shown as usual.");
    expect(visible).toContain("Your selections and filters haven't changed.");
    expect(visible).not.toMatch(/future_component|future-block|component|schema/i);
    expect(details).not.toHaveAttribute("open");
  });

  it("explains malformed data and keeps the validation messages in the disclosure", () => {
    render(<InvalidBlockFallback id="invalid-chart" type="bar_chart" errors={["/series/0/value must be number"]} />);
    expect(status()).toHaveTextContent("This chart couldn't be shown");
    expect(status()).toHaveTextContent("wasn't in the expected format");
    expect(screen.getByText("Technical details").closest("details")).toHaveTextContent("/series/0/value must be number");
    expect(status()).not.toHaveTextContent("other section");
  });

  it("offers the prompt picker only when the conversation provides it", () => {
    const onChoosePrompt = vi.fn();
    const { rerender } = render(<UnsupportedBlockFallback id="a" type="x" />);
    expect(screen.queryByRole("button", { name: "Choose a supported prompt" })).toBeNull();

    rerender(
      <ResponseBlockContext.Provider value={{ onChoosePrompt }}>
        <UnsupportedBlockFallback id="a" type="x" />
      </ResponseBlockContext.Provider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Choose a supported prompt" }));
    expect(onChoosePrompt).toHaveBeenCalledOnce();
  });

  it("copies the same safe report that the disclosure shows", async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>(async () => {});
    mockClipboard(writeText);
    render(
      <ResponseBlockContext.Provider value={{ requestId: "req-7", scenarioId: "unsupported_block" }}>
        <UnsupportedBlockFallback id="future-block" type="future_component" />
      </ResponseBlockContext.Provider>,
    );
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Copy issue report" })));

    const copied = writeText.mock.calls[0]![0];
    expect(copied).toContain("Request id: req-7");
    expect(copied).toContain("Block type: future_component");
    expect(copied).not.toMatch(/script|html/);
    expect(screen.getByText(/RADAR issue report/).textContent).toBe(copied);
    expect(screen.getByText("Copied. Paste it into your support request.")).toBeInTheDocument();
    expect(status()).not.toHaveTextContent(/sent|expert|team/i);
  });

  it("falls back to the visible report when copying is not possible", async () => {
    mockClipboard(async () => {
      throw new Error("denied");
    });
    render(<UnsupportedBlockFallback id="a" type="x" />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Copy issue report" })));
    expect(screen.getByText(/Couldn't copy automatically/)).toBeInTheDocument();
    expect(status().querySelector("details")).toHaveAttribute("open");
  });
});
