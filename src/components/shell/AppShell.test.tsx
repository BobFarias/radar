// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";

vi.mock("next/navigation", () => ({ usePathname: () => "/agent" }));

describe("AppShell", () => {
  it("marks the current workspace in each navigation", () => {
    render(<AppShell>content</AppShell>);
    const navs = screen.getAllByRole("navigation", { name: "Workspaces" });
    expect(navs).toHaveLength(2); // desktop sidebar + mobile header (one hidden by CSS)
    for (const nav of navs) {
      expect(within(nav).getByRole("link", { name: "Agent" })).toHaveAttribute("aria-current", "page");
      expect(within(nav).getByRole("link", { name: "Opportunities" })).not.toHaveAttribute("aria-current");
      expect(within(nav).getByRole("link", { name: "Briefing" })).toHaveAttribute("href", "/briefing");
    }
  });

  it("provides a skip link to the main content", () => {
    render(<AppShell>content</AppShell>);
    expect(screen.getByRole("link", { name: "Skip to content" })).toHaveAttribute("href", "#main");
    expect(screen.getByRole("main")).toHaveTextContent("content");
  });
});
