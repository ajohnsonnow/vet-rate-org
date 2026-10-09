/**
 * D21-1: the completion screen lists a document whose save did not finish with
 * the plain message that names it and a Retry button, and only when a retry is
 * actually possible (the read result is still held in memory).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MusterCallCompletionSummary from "./MusterCallCompletionSummary";
import { FORMATION_STATUS } from "../../utils/formationQueue";

const MESSAGE =
  'Saving "generic.pdf" did not finish because your device\'s storage did not respond in time.';

const failedEntry = (extra = {}) => ({
  id: "e1",
  filename: "generic.pdf",
  status: FORMATION_STATUS.ERROR,
  error: MESSAGE,
  retryable: true,
  ...extra,
});

const FORMATION = [failedEntry()];
const NOT_RETRYABLE = [failedEntry({ retryable: false })];

describe("MusterCallCompletionSummary: Retry for a save that did not finish", () => {
  it("shows the document-naming message with a Retry that runs once and is disabled while it works", async () => {
    let finish;
    const onRetry = vi.fn(() => new Promise((resolve) => (finish = resolve)));

    render(
      <MusterCallCompletionSummary
        formation={FORMATION}
        onRetry={onRetry}
        canRetry={() => true}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(MESSAGE);
    const button = screen.getByTestId("retry-save-button");
    fireEvent.click(button);

    expect(onRetry).toHaveBeenCalledWith("e1");
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("Retrying...");

    finish();
    await waitFor(() => expect(button).not.toBeDisabled());
  });

  it("offers no Retry once the read result is gone (for example after a reload)", () => {
    render(
      <MusterCallCompletionSummary
        formation={FORMATION}
        onRetry={vi.fn()}
        canRetry={() => false}
      />,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByTestId("retry-save-button")).not.toBeInTheDocument();
  });

  it("offers no Retry for an ordinary failure", () => {
    render(
      <MusterCallCompletionSummary
        formation={NOT_RETRYABLE}
        onRetry={vi.fn()}
        canRetry={() => true}
      />,
    );

    expect(screen.queryByTestId("retry-save-button")).not.toBeInTheDocument();
  });
});
