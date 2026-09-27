/**
 * MaintenancePage is what the kill switch routes veterans to when
 * `version.json` reports maintenance_mode: true - it renders with no Quick
 * Exit button at all before this test's fix, leaving a veteran stuck on a
 * screen with no panic-exit path (standing decision: Quick Exit must be
 * reachable on every screen, maintenance included).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import MaintenancePage from "./MaintenancePage";
import { LanguageProvider } from "../../contexts/LanguageContext";

const mockTriggerPanicRedirect = vi.fn();
vi.mock("../../utils/safetyRedirect", () => ({
  triggerPanicRedirect: (...args) => mockTriggerPanicRedirect(...args),
  triggerSoftExit: vi.fn(),
}));

function renderMaintenancePage(props = {}) {
  return render(
    <LanguageProvider>
      <MaintenancePage message="Scheduled maintenance" {...props} />
    </LanguageProvider>,
  );
}

describe("MaintenancePage", () => {
  it("renders a reachable Quick Exit button", () => {
    renderMaintenancePage();

    expect(
      screen.getByRole("button", { name: /quick exit/i }),
    ).toBeInTheDocument();
  });

  it("still shows the maintenance message alongside Quick Exit", () => {
    renderMaintenancePage({ message: "Scheduled maintenance" });

    expect(screen.getByText("Scheduled maintenance")).toBeInTheDocument();
  });

  it("performs the full panic redirect when Quick Exit is used", () => {
    renderMaintenancePage();

    fireEvent.click(screen.getByRole("button", { name: /quick exit/i }));
    fireEvent.click(screen.getByRole("button", { name: /^exit$/i }));

    expect(mockTriggerPanicRedirect).toHaveBeenCalledTimes(1);
  });
});
