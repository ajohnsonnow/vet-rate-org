/**
 * D22: a restored entry for a document that could not be read must not promise
 * a Retry (its File reference is gone after a reload), and dismissing the
 * formation ends the import, so its in-progress marker goes with it.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFormationQueue } from "./useFormationQueue";
import {
  startImportMarker,
  readInterruptedImport,
} from "../utils/importProgressMarker";

const readFailedEntry = {
  id: "formation-1-0",
  filename: "generic.pdf",
  estimatedType: "DD214",
  status: "ERROR",
  retryable: true,
  readFailure: true,
  error: "We could not read document 1 (DD214). Choose Retry to read it again.",
  file: { name: "generic.pdf", size: 1, type: "application/pdf" },
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("restoring a document that could not be read", () => {
  it("drops the retry flag and says to add the file again, naming only its neutral label", () => {
    localStorage.setItem(
      "vetrate_formation_state",
      JSON.stringify({ formation: [readFailedEntry], savedAt: "2026-10-02" }),
    );

    const { formation } = renderHook(() => useFormationQueue()).result.current;

    expect(formation[0].retryable).toBe(false);
    expect(formation[0].error).toContain("document 1 (DD214)");
    expect(formation[0].error).toContain("Add the file again");
    expect(formation[0].error).not.toMatch(/Retry|generic\.pdf/);
  });
});

describe("dismissing the formation", () => {
  it("ends the import, so the in-progress marker is cleared", () => {
    startImportMarker(["document 1 (DD214)"]);
    const { result } = renderHook(() => useFormationQueue());

    act(() => result.current.clearFormation());

    expect(readInterruptedImport()).toBeNull();
  });
});
