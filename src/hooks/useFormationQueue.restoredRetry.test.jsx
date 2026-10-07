/**
 * A Retry for a save that did not finish works from the read result held in
 * memory, which a page reload drops. A restored entry must not keep promising
 * a Retry that is not there: it says what happened and to import the file
 * again, and it no longer carries the retry flag.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useFormationQueue } from "./useFormationQueue";

const savedEntry = (overrides) => ({
  id: "formation-1-0",
  filename: "generic.pdf",
  status: "ERROR",
  error:
    'Saving "generic.pdf" did not finish because your device\'s storage did not respond in time. Nothing you imported was lost. Choose Retry to finish saving it.',
  retryable: true,
  file: { name: "generic.pdf", size: 1, type: "application/pdf" },
  ...overrides,
});

function restore(entries) {
  localStorage.setItem(
    "vetrate_formation_state",
    JSON.stringify({ formation: entries, savedAt: new Date().toISOString() }),
  );
  return renderHook(() => useFormationQueue()).result.current.formation;
}

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("restoring a save that did not finish", () => {
  it("drops the retry flag and no longer says to choose Retry", () => {
    const [entry] = restore([savedEntry()]);

    expect(entry.retryable).toBe(false);
    expect(entry.error).toContain('"generic.pdf"');
    expect(entry.error).toContain("Import the file again");
    expect(entry.error).not.toMatch(/Retry/);
  });

  it("keeps saying the storage was full when that was the cause", () => {
    const [entry] = restore([savedEntry({ quotaExceeded: true })]);

    expect(entry.error).toMatch(/storage is full/i);
  });

  it("leaves an ordinary failed entry exactly as it was", () => {
    const ordinary = savedEntry({
      retryable: undefined,
      error: "No text could be extracted from document",
    });
    const [entry] = restore([ordinary]);

    expect(entry.error).toBe("No text could be extracted from document");
  });
});
