import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ErrorBoundary from "./ErrorBoundary";
import { ToastContext } from "../../contexts/ToastContext";
import { saveBugReport } from "../../utils/bugReportStorage";

vi.mock("../../utils/bugReportStorage", () => ({
  saveBugReport: vi.fn(),
}));

function Thrower() {
  throw new Error("kaboom");
}

function renderThrower(props = {}) {
  return render(
    <ErrorBoundary {...props}>
      <Thrower />
    </ErrorBoundary>,
  );
}

function renderThrowerWithToast(toast, props = {}) {
  return render(
    <ToastContext.Provider value={toast}>
      <ErrorBoundary {...props}>
        <Thrower />
      </ErrorBoundary>
    </ToastContext.Provider>,
  );
}

let consoleErrorSpy;

beforeEach(() => {
  saveBugReport.mockResolvedValue({ report_id: "BUG-TEST123" });
  // React logs caught render errors to console.error — silence the noise.
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
  vi.clearAllMocks();
});

describe("ErrorBoundary", () => {
  it("renders children when nothing throws", () => {
    render(
      <ErrorBoundary name="Test">
        <div>safe child</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText("safe child")).toBeInTheDocument();
    expect(screen.queryByTestId("error-boundary-fallback")).toBeNull();
  });

  it("shows the cluster fallback (Try again) when a child throws", () => {
    renderThrower({ name: "Test Cluster" });
    expect(screen.getByTestId("error-boundary-fallback")).toBeInTheDocument();
    expect(screen.getByText("Test Cluster hit a snag")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Report this problem" }),
    ).toBeInTheDocument();
  });

  it("shows the app-level fallback (Reload app) when level=app", () => {
    renderThrower({ level: "app", name: "Vet-Rate.org" });
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reload app" }),
    ).toBeInTheDocument();
  });

  it("persists a sanitized crash report and toasts on one-tap report", async () => {
    const toast = { success: vi.fn(), error: vi.fn() };
    renderThrowerWithToast(toast, { name: "Test Cluster" });

    fireEvent.click(
      screen.getByRole("button", { name: "Report this problem" }),
    );

    await waitFor(() => expect(saveBugReport).toHaveBeenCalledTimes(1));
    expect(saveBugReport).toHaveBeenCalledWith(
      expect.objectContaining({
        module: "Test Cluster",
        severity: "critical",
        error_message: "kaboom",
      }),
    );

    expect(await screen.findByText("Reported ✓")).toBeInTheDocument();
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining("BUG-TEST123"),
      ),
    );
  });

  it("toasts an error when the report fails to save", async () => {
    saveBugReport.mockRejectedValueOnce(new Error("db down"));
    const toast = { success: vi.fn(), error: vi.fn() };
    renderThrowerWithToast(toast, { name: "Test Cluster" });

    fireEvent.click(
      screen.getByRole("button", { name: "Report this problem" }),
    );

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("recovers via Try again once the underlying issue clears", () => {
    let crash = true;
    function Flaky() {
      if (crash) throw new Error("transient");
      return <div>recovered content</div>;
    }

    render(
      <ErrorBoundary name="Test Cluster">
        <Flaky />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId("error-boundary-fallback")).toBeInTheDocument();

    crash = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(screen.getByText("recovered content")).toBeInTheDocument();
    expect(screen.queryByTestId("error-boundary-fallback")).toBeNull();
  });
});
