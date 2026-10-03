/**
 * An import that hit an unreadable file must finish with every document saved
 * exactly once after Retry. The real formation queue and the real flow run
 * together; only the processor (the read/save boundary) is faked.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("../utils/musterCallProcessor", () => ({
  processFormationDocument: vi.fn(),
  persistFormationDocument: vi.fn(async () => {}),
  retryFormationDocumentPersist: vi.fn(),
  describePersistIncomplete: vi.fn(),
  autoPopulateProfile: vi.fn(async () => {}),
  PROCESSING_STATES: { EXTRACTING: "EXTRACTING", COMPLETE: "COMPLETE" },
}));

import {
  processFormationDocument,
  persistFormationDocument,
} from "../utils/musterCallProcessor";
import { useFormationQueue } from "./useFormationQueue";
import { useSequentialFormationFlow } from "./useSequentialFormationFlow";
import { readInterruptedImport } from "../utils/importProgressMarker";

const toast = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };
const setError = vi.fn();
const setProcessingState = vi.fn();

const file = (name) => new File(["x"], name, { type: "application/pdf" });
const reviewable = (f) => ({
  filename: f.name,
  size: 1,
  status: "complete",
  readyForReview: true,
  extractedData: {},
});

function useBoth() {
  const formationQueue = useFormationQueue();
  const flow = useSequentialFormationFlow({
    formationQueue,
    toast,
    setError,
    setProcessingState,
  });
  return { queue: formationQueue, flow };
}

const settle = (ms) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  for (const method of ["log", "warn", "error"]) {
    vi.spyOn(console, method).mockImplementation(() => {});
  }
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("an import with one unreadable file", () => {
  it("saves every document exactly once after Retry, with no duplicate entries", async () => {
    const first = file("generic-a.pdf");
    const second = file("generic-b.pdf");
    let firstReads = 0;
    processFormationDocument.mockImplementation(async (f) => {
      if (f === first && ++firstReads <= 2) {
        return { filename: f.name, size: 1, status: "error", readFailed: true };
      }
      return reviewable(f);
    });
    const { result } = renderHook(useBoth);
    act(() => {
      result.current.queue.initializeFormation([first, second]);
    });
    const ids = result.current.queue.formation.map((entry) => entry.id);
    const save = () =>
      act(async () => {
        await result.current.flow.handleVerifyAndSave({ verifiedData: {} });
      });

    await act(async () => {
      result.current.flow.startSequentialProcessing();
    });
    await settle(3000);

    expect(result.current.flow.showIntelBriefing).toBe(true);
    await save();
    await settle(3000);
    const failed = result.current.queue.formation.find(
      (e) => e.status === "ERROR",
    );
    expect(failed.retryable).toBe(true);

    await act(async () => {
      await result.current.flow.retryDocumentSave(failed.id);
    });
    await settle(500);
    expect(result.current.flow.showIntelBriefing).toBe(true);
    await save();
    await settle(3000);

    const { formation } = result.current.queue;
    expect(formation.map((entry) => entry.id)).toEqual(ids);
    expect(formation.map((entry) => entry.status)).toEqual(["SAVED", "SAVED"]);
    expect(formation.every((entry) => !entry.error)).toBe(true);
    expect(
      persistFormationDocument.mock.calls.map(([f]) => f.name).sort(),
    ).toEqual(["generic-a.pdf", "generic-b.pdf"]);
    expect(readInterruptedImport()).toBeNull();
  });
});
