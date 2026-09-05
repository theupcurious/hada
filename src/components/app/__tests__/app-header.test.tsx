import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppHeader } from "@/components/app/app-header";
vi.mock("next/navigation", () => ({ usePathname: () => "/docs", useSearchParams: () => new URLSearchParams("project=writing") }));
vi.mock("@/lib/hooks/use-resolved-locale", () => ({ useResolvedLocale: () => "en" }));
vi.mock("@/components/theme/theme-toggle", () => ({ ThemeToggle: () => null }));
describe("shared navigation", () => {
  it("preserves the Space on every destination and exposes all routes through More", () => {
    render(<AppHeader space={{ id: "writing", name: "Writing" }} />);
    expect(screen.getByRole("link", { name: "Active space: Writing" })).toHaveAttribute("href", "/chat?project=writing");
    expect(screen.getByRole("link", { name: "Workflows" })).toHaveAttribute("href", "/workflows?project=writing");
    expect(screen.getByRole("link", { name: "Docs" })).toHaveAttribute("aria-current", "page");
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    expect(screen.getByRole("button", { name: "More" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("link", { name: "Activity" })).toHaveLength(2);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("button", { name: "More" })).toHaveAttribute("aria-expanded", "false");
  });
});
