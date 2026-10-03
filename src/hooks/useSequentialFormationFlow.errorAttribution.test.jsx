/**
 * D20-9: when a document's analysis threw, the formation ledger marked a
 * DIFFERENT, already-saved letter as ERROR and called the failed document
 * forward again. runDocumentProcessing's catch used errorCurrentAndNext, which
 * closes over whatever entry was "current" when the closure (the PREVIOUS
 * document's Verify & Save handler) rendered, and over that render's stale
 * queue snapshot. The error must land on the entry that actually failed, the
 * saved one must stay saved, and the queue must move on to the next document.
 *
 * Real useFormationQueue and useSequentialFormationFlow; only the document
 * processor (the external boundary) is faked.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("../utils/musterCallProcessor", () => ({
  processFormationDocument: vi.fn(),
  persistFormationDocument: vi.fn(async () => {}),
  autoPopulateProfile: vi.fn(async () => {}),
  PROCESSING_STATES: { EXTRACTING: "EXTRACTING", COMPLETE: "COMPLETE" },
}));

import { processFormationDocument } from "../utils/musterCallProcessor";
import { useSequentialFormationFlow } from "./useSequentialFormationFlow";
import { useFormationQueue } from "./useFormationQueue";

const makeFile = (name) => new File(["x"], name, { type: "application/pdf" });

const okResult = (name) => ({
  filename: name,
  size: 1,
  status: "complete",
  readyForReview: true,
  extractedData: {},
});

function renderQueueAndFlow() {
  return renderHook(() => {
    const queue = useFormationQueue();
    const flow = useSequentialFormationFlow({
      formationQueue: queue,
      toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
      setError: vi.fn(),
      setProcessingState: vi.fn(),
    });
    return { queue, flow };
  });
}

const statusByName = (result) =>
  Object.fromEntries(
    result.current.queue.formation.map((e) => [e.filename, e.status]),
  );

async function advance(ms) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  processFormationDocument.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useSequentialFormationFlow: errors are attributed to the document that failed", () => {
  it("marks the failing second document ERROR, keeps the saved first one SAVED, and moves on without retrying it", async () => {
    processFormationDocument.mockImplementation(async (file) => {
      if (file.name === "second.pdf") throw new Error("analysis exploded");
      return okResult(file.name);
    });
    const { result } = renderQueueAndFlow();

    await act(async () => {
      result.current.queue.initializeFormation([
        makeFile("first.pdf"),
        makeFile("second.pdf"),
        makeFile("third.pdf"),
      ]);
    });
    await act(async () => {
      result.current.flow.startSequentialProcessing();
    });
    await advance(0);
    expect(result.current.flow.showIntelBriefing).toBe(true);

    await act(async () => {
      await result.current.flow.handleVerifyAndSave({
        verifiedData: {},
        saveToVKB: true,
        updateProfile: false,
      });
    });
    await advance(500);
    await advance(1000);

    const statuses = statusByName(result);
    expect(statuses["first.pdf"]).toBe("SAVED");
    expect(statuses["second.pdf"]).toBe("ERROR");
    const errorEntry = result.current.queue.formation.find(
      (e) => e.filename === "second.pdf",
    );
    expect(errorEntry.error).toBe(
      "We could not finish document 2 because something went wrong while reading it, so choose Retry to try again.",
    );
    expect(errorEntry.error).not.toContain("exploded");

    const secondCalls = processFormationDocument.mock.calls.filter(
      ([file]) => file.name === "second.pdf",
    );
    expect(secondCalls).toHaveLength(1);
    expect(processFormationDocument.mock.calls.map(([f]) => f.name)).toContain(
      "third.pdf",
    );
  });
});
