/**
 * D22-6: when the on-device engine load fails or stalls, the load control
 * shows the reason in plain words with a Try again button instead of dropping
 * back to the first prompt (or spinning forever). Try again starts a new load.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

const loader = vi.hoisted(() => ({
  smartLoadAI: vi.fn(),
  checkModelMatch: vi.fn(),
}));
vi.mock("../utils/smartAILoader", () => ({
  smartLoadAI: loader.smartLoadAI,
  checkModelMatch: loader.checkModelMatch,
  getDeviceType: () => "desktop",
}));

const SmartAILoadButton = (await import("./SmartAILoadButton.jsx")).default;

const NEEDS_LOAD = {
  isCorrect: false,
  action: "load",
  recommendedModel: { id: "fake", name: "Fake Model", reason: "test" },
};
const STALL_TEXT =
  "Loading the on-device AI stopped making progress for 3 minute(s). Choose Try again.";

beforeEach(() => {
  vi.clearAllMocks();
  loader.checkModelMatch.mockReturnValue(NEEDS_LOAD);
});

describe("SmartAILoadButton after a failed or stalled load", () => {
  it("shows the plain reason and Try again, and Try again loads once more", async () => {
    loader.smartLoadAI
      .mockImplementationOnce(async (_tool, onProgress) => {
        onProgress(-1, `Error: ${STALL_TEXT}`);
        return false;
      })
      .mockImplementationOnce(async () => true);
    render(<SmartAILoadButton toolId="decision-decoder" />);

    fireEvent.click(await screen.findByRole("button", { name: /Load Fake/ }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(STALL_TEXT);
    expect(screen.queryByText(/Starting/)).toBeNull();
    const retry = screen.getByRole("button", { name: "Try again" });

    fireEvent.click(retry);

    await waitFor(() => expect(loader.smartLoadAI).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("says something even when the failure carried no text", async () => {
    loader.smartLoadAI.mockResolvedValue(false);
    render(<SmartAILoadButton toolId="decision-decoder" />);

    fireEvent.click(await screen.findByRole("button", { name: /Load Fake/ }));

    expect((await screen.findByRole("alert")).textContent).toMatch(
      /did not finish.*Try again/,
    );
  });
});
