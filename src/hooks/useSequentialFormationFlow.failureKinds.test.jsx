/**
 * D23-3 / D23-2: any failure of a document during import (not only an unread
 * file) is shown as a plain message with a bounded Retry and no technical text
 * on screen or in the console; the closing toast never says "complete" when
 * nothing was saved; the interrupted-import count is what is actually saved.
 * The processor is the boundary and is faked; the flow is the real code.
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

import { processFormationDocument } from "../utils/musterCallProcessor";
import { useSequentialFormationFlow } from "./useSequentialFormationFlow";
import { readInterruptedImport } from "../utils/importProgressMarker";

const WORKER_URL = "http://localhost:5383/assets/pdf.worker.min.mjs";
const RAW = `Setting up fake worker failed: "Failed to fetch dynamically imported module: ${WORKER_URL}".`;
const NO_TECHNICAL = /localhost|https?:|blob:|worker\.min|at \S+\.js/;

const toast = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };
let queue;
let formationQueue;
let logged;

const workerFailure = {
  filename: "x.pdf",
  size: 1,
  status: "error",
  readFailed: false,
  failureKind: "reader_unavailable",
  error:
    "This document could not be processed because the document reader did not start.",
};
const timeoutFailure = {
  ...workerFailure,
  failureKind: "timeout",
  error: "This document could not be processed because it took too long.",
};
const reviewable = {
  filename: "x.pdf",
  size: 1,
  status: "complete",
  readyForReview: true,
  extractedData: {},
};

function setup(types = ["CLAIM_LETTER"]) {
  queue = types.map((estimatedType, i) => ({
    id: `e${i + 1}`,
    file: new File(["x"], `private-${i}.pdf`),
    estimatedType,
    status: "WAITING",
  }));
  const setStatus = (id, patch) => {
    queue = queue.map((e) => (e.id === id ? { ...e, ...patch } : e));
  };
  formationQueue = {
    formation: queue,
    stats: {},
    updateEntry: vi.fn(setStatus),
    startFormation: vi.fn(() => queue[0]),
    completeCurrentAndNext: vi.fn(() => {
      setStatus(queue.find((e) => e.status !== "SAVED").id, {
        status: "SAVED",
      });
      return null;
    }),
    skipCurrentAndNext: vi.fn(() => null),
    errorEntryAndNext: vi.fn((id, error, extra) => {
      setStatus(id, { status: "ERROR", error, ...extra });
      return null;
    }),
    getFormation: () => queue,
  };
  return renderHook(() =>
    useSequentialFormationFlow({
      formationQueue,
      toast,
      setError: vi.fn(),
      setProcessingState: vi.fn(),
    }),
  ).result;
}

const settle = (ms = 0) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

async function start(result) {
  await act(async () => {
    result.current.startSequentialProcessing();
  });
  await settle(2200);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  sessionStorage.clear();
  logged = [];
  for (const method of ["log", "warn", "error"]) {
    vi.spyOn(console, method).mockImplementation((...args) =>
      logged.push(args.map(String).join(" ")),
    );
  }
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("a document that fails for a reason other than reading the file", () => {
  it("is shown plainly with a Retry, and is not read again on its own", async () => {
    const result = setup();
    processFormationDocument.mockResolvedValue(timeoutFailure);

    await start(result);

    expect(processFormationDocument).toHaveBeenCalledTimes(1);
    const [id, message, extra] = formationQueue.errorEntryAndNext.mock.calls[0];
    expect(id).toBe("e1");
    expect(message).toBe(
      "We could not finish the claim letter (document 1) because it took too long, so choose Retry to try again.",
    );
    expect(extra).toEqual({
      retryable: true,
      processingFailure: true,
      failureKind: "timeout",
    });
    expect(result.current.canRetryDocumentSave("e1")).toBe(true);
  });

  it("writes no address, stack or file name to the screen text or the console when the error is thrown raw", async () => {
    const result = setup();
    processFormationDocument.mockRejectedValue(new Error(RAW));

    await start(result);

    const [, message] = formationQueue.errorEntryAndNext.mock.calls[0];
    expect(message).toContain("the document reader did not start");
    expect(message).not.toMatch(NO_TECHNICAL);
    expect(logged.join("\n")).not.toMatch(NO_TECHNICAL);
    expect(logged.join("\n")).not.toContain("private-");
    expect(logged.join("\n")).toContain("document_failure:reader_unavailable");
  });

  it("Retry runs the same document again and goes on to review", async () => {
    const result = setup();
    processFormationDocument.mockResolvedValue(timeoutFailure);
    await start(result);

    processFormationDocument.mockResolvedValue(reviewable);
    await act(async () => {
      await result.current.retryDocumentSave("e1");
    });
    expect(result.current.showIntelBriefing).toBe(true);
    expect(processFormationDocument).toHaveBeenCalledTimes(2);
    expect(processFormationDocument.mock.calls[1][0]).toBe(queue[0].file);
  });

  it("keeps a message already written for the veteran, such as an empty scan", async () => {
    const result = setup();
    processFormationDocument.mockResolvedValue({
      ...workerFailure,
      failureKind: "unknown",
      plainMessage: "No text could be extracted from document",
    });

    await start(result);

    expect(formationQueue.errorEntryAndNext.mock.calls[0][1]).toBe(
      "We could not finish the claim letter (document 1). No text could be extracted from document. Choose Retry to try again.",
    );
  });

  it("stops offering Retry after three tries", async () => {
    const result = setup();
    processFormationDocument.mockResolvedValue(timeoutFailure);
    await start(result);

    for (let attempt = 0; attempt < 2; attempt++) {
      await act(async () => {
        await result.current.retryDocumentSave("e1");
      });
      await settle(1100);
    }
    expect(result.current.canRetryDocumentSave("e1")).toBe(true);
    await act(async () => {
      await result.current.retryDocumentSave("e1");
    });
    await settle(1100);

    expect(result.current.canRetryDocumentSave("e1")).toBe(false);
    const last = formationQueue.errorEntryAndNext.mock.calls.at(-1)[1];
    expect(last).toContain("even after several tries");
  });
});

describe("the message when the import ends", () => {
  it("says plainly that nothing was saved, and why, when the only document fails", async () => {
    const result = setup();
    processFormationDocument.mockResolvedValue(workerFailure);

    await start(result);

    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledTimes(1);
    const [text] = toast.error.mock.calls[0];
    expect(text).toMatch(/^Nothing was saved\./);
    expect(text).toContain("the document reader did not start");
    expect(text).not.toMatch(/complete|successfully/i);
  });

  it("reports the saved and the unsaved count when some documents fail", async () => {
    const result = setup(["DD214", "DBQ"]);
    processFormationDocument
      .mockResolvedValueOnce(reviewable)
      .mockResolvedValueOnce(workerFailure);
    await start(result);
    await act(async () => {
      await result.current.handleVerifyAndSave({
        verifiedData: {},
        saveToVKB: false,
        updateProfile: false,
      });
    });
    await settle(2200);

    expect(toast.warning).toHaveBeenCalledWith(
      expect.stringMatching(/1 document saved, 1 not saved/),
      expect.any(Number),
    );
  });
});

describe("the interrupted-import count", () => {
  it("counts a document filed as it was read once, not again when it is confirmed", async () => {
    const result = setup(["DD214", "DBQ"]);
    processFormationDocument.mockResolvedValue({
      ...reviewable,
      vkbSaved: true,
    });
    await start(result);
    expect(readInterruptedImport()).toMatchObject({ saved: 1, total: 2 });

    await act(async () => {
      await result.current.handleVerifyAndSave({
        verifiedData: {},
        saveToVKB: false,
        updateProfile: false,
      });
    });

    expect(readInterruptedImport()).toMatchObject({ saved: 1, total: 2 });
  });

  it("does not count a document that is read but not yet filed", async () => {
    const result = setup(["DD214", "DBQ"]);
    processFormationDocument.mockResolvedValue({
      ...reviewable,
      vkbSaved: false,
    });
    await start(result);

    expect(readInterruptedImport()).toMatchObject({ saved: 0, total: 2 });
  });
});
