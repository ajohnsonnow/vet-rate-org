import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import AppModals from "./AppModals";
import AppProviders from "../providers/AppProviders";
import QuickExitButton from "../../components/QuickExitButton";
import { triggerPanicRedirect } from "../../utils/safetyRedirect";

vi.mock("../../components/ClaimNavigator", () => {
  throw new Error("chunk failed to load");
});

vi.mock("../../utils/safetyRedirect", () => ({
  triggerPanicRedirect: vi.fn(),
  triggerSoftExit: vi.fn(),
}));

const PROPS = {
  getAppState: () => ({}),
  updateBanner: null,
  whatsNewModal: null,
};

function renderShell() {
  return render(
    <AppProviders>
      <QuickExitButton position="top-right" variant="subtle" />
      <AppModals {...PROPS} />
    </AppProviders>,
  );
}

async function openBrokenTool() {
  await act(async () => {
    window.dispatchEvent(new CustomEvent("openClaimNavigator"));
  });
  return screen.findByTestId("error-boundary-fallback");
}

beforeEach(() => {
  window.matchMedia = vi.fn((query) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("a tool that fails to open", () => {
  it("tells the veteran in plain words, as a visible dialog with a way back", async () => {
    renderShell();
    const fallback = await openBrokenTool();

    expect(fallback).toHaveAttribute("role", "alertdialog");
    expect(fallback.className).toContain("fixed");
    expect(
      screen.getByRole("heading", { name: "This tool could not open" }),
    ).toBeInTheDocument();
    expect(fallback).toHaveTextContent("your data is safe on this device");
    expect(
      screen.getByRole("button", { name: "Close and go back" }),
    ).toBeInTheDocument();
  });

  it("goes back to the app when the veteran closes the message", async () => {
    renderShell();
    await openBrokenTool();

    fireEvent.click(screen.getByRole("button", { name: "Close and go back" }));

    expect(screen.queryByTestId("error-boundary-fallback")).toBeNull();
    expect(
      screen.getByRole("button", { name: /quick exit/i }),
    ).toBeInTheDocument();
  });

  it("puts focus on the way back and closes on Escape", async () => {
    renderShell();
    await openBrokenTool();

    expect(
      screen.getByRole("button", { name: "Close and go back" }),
    ).toHaveFocus();

    fireEvent.keyDown(screen.getByTestId("error-boundary-fallback"), {
      key: "Escape",
    });

    expect(screen.queryByTestId("error-boundary-fallback")).toBeNull();
  });

  it("keeps Tab inside the message while it is open", async () => {
    renderShell();
    const fallback = await openBrokenTool();
    const buttons = fallback.querySelectorAll("button");
    const last = buttons[buttons.length - 1];

    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(buttons[0]).toHaveFocus();

    fireEvent.keyDown(buttons[0], { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
  });

  it("keeps Quick Exit working behind the message, on its first tap", async () => {
    renderShell();
    const fallback = await openBrokenTool();
    const quickExit = screen.getByRole("button", { name: /quick exit/i });

    const zOf = (el) => /z-\[(\d+)\]/.exec(el.className)?.[1];
    expect(Number(zOf(quickExit))).toBeGreaterThan(Number(zOf(fallback)));

    fireEvent.click(quickExit);

    expect(triggerPanicRedirect).toHaveBeenCalledTimes(1);
  });
});
