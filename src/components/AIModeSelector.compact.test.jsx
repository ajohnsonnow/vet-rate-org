import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("../utils/unifiedAIService", async (importOriginal) => ({
  ...(await importOriginal()),
  getAIStatus: () => ({
    effectiveMode: "swarm",
    swarmAvailable: true,
    swarmStatus: { model: "Qwen3.5-4B-q4f16_1-MLC" },
    localInitializing: false,
    wllamaInitializing: false,
  }),
}));

const { AIStatusBadge } = await import("./AIModeSelector");

describe("AIStatusBadge compact", () => {
  it("collapses to its dot, keeping the full status as its accessible name", () => {
    render(<AIStatusBadge compact />);
    const badge = screen.getByTestId("ai-status-badge");
    expect(badge.getAttribute("aria-label")).toBeTruthy();
    expect(badge.className).toMatch(/\[&>span:nth-child\(n\+2\)\]:hidden/);
    expect(badge.className).not.toMatch(/px-4/);
  });

  it("is unchanged when not compact", () => {
    render(<AIStatusBadge />);
    const badge = screen.getByTestId("ai-status-badge");
    expect(badge.className).toMatch(/px-4/);
    expect(badge.className).not.toMatch(/nth-child/);
  });
});
