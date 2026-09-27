/**
 * MigrationScreen is the only thing on screen while useBootSequence's
 * isBooting gate is up - including a stalled/timed-out migration decision
 * (useBootSequence.js's MIGRATION_DECISION_TIMEOUT_MS). Regressions this
 * covers:
 *   - Quick Exit must be reachable here, not just on the mounted app shell.
 *   - The "This only happens once" copy is only true while a copy is
 *     actually running (isMigrating), not on every load that merely has to
 *     decide whether one is needed.
 *   - Quick Exit's full triggerPanicRedirect must still fire even while a
 *     copy is actively running - an in-progress migration must never
 *     neuter or delay the panic exit.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import MigrationScreen from "./MigrationScreen";
import { LanguageProvider } from "../../contexts/LanguageContext";

const mockTriggerPanicRedirect = vi.fn();
vi.mock("../../utils/safetyRedirect", () => ({
  triggerPanicRedirect: (...args) => mockTriggerPanicRedirect(...args),
  triggerSoftExit: vi.fn(),
}));

function renderMigrationScreen(props = {}) {
  return render(
    <LanguageProvider>
      <MigrationScreen {...props} />
    </LanguageProvider>,
  );
}

describe("MigrationScreen", () => {
  it("renders a reachable Quick Exit button while still deciding (isMigrating false)", () => {
    renderMigrationScreen({ isMigrating: false });

    expect(
      screen.getByRole("button", { name: /quick exit/i }),
    ).toBeInTheDocument();
  });

  it("does not claim a migration is running before one has started", () => {
    renderMigrationScreen({ isMigrating: false });

    expect(
      screen.queryByText(/upgrading your data storage/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/migrating to enhanced storage/i),
    ).not.toBeInTheDocument();
  });

  it("shows the migration copy, and still keeps Quick Exit reachable, while a copy is actually running", () => {
    renderMigrationScreen({ isMigrating: true });

    expect(
      screen.getByText(/migrating to enhanced storage/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/upgrading your data storage/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /quick exit/i }),
    ).toBeInTheDocument();
  });

  // Standing decision: Quick Exit must always work one tap away, with
  // nothing (a confirmation dialog included) able to block or delay it.
  it("still performs the full panic wipe on a single tap when Quick Exit is used mid-migration", () => {
    renderMigrationScreen({ isMigrating: true });

    fireEvent.click(screen.getByRole("button", { name: /quick exit/i }));

    expect(mockTriggerPanicRedirect).toHaveBeenCalledTimes(1);
  });
});
