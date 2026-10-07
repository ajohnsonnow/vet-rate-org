/**
 * D21-1: a document whose save did not finish is reported to the veteran as an
 * error entry that names it and carries a Retry; Retry saves what was already
 * read (no second read of the file) and, once it completes, takes the document
 * to the same review screen a freshly read one reaches. The processor is the
 * boundary and is faked here; its real behaviour is covered in
 * musterCallProcessor.persistBounded.test.js.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
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
  retryFormationDocumentPersist,
} from "../utils/musterCallProcessor";
import { useSequentialFormationFlow } from "./useSequentialFormationFlow";

const NAMED_FAILURE =
  'Saving "generic.pdf" did not finish because your device\'s storage did not respond in time. Nothing you imported was lost. Choose Retry to finish saving it.';

const failedResult = {
  filename: "generic.pdf",
  size: 1,
  status: "error",
  persistIncomplete: true,
  error: NAMED_FAILURE,
  text: "generic text",
  classification: { type: "DD214" },
  extractedData: {},
};

const entry = { id: "e1", file: { name: "generic.pdf", size: 1 } };
const toast = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
};
const setError = vi.fn();
const setProcessingState = vi.fn();

function makeQueue() {
  return {
    formation: [entry],
    stats: {},
    updateEntry: vi.fn(),
    startFormation: vi.fn(() => entry),
    completeCurrentAndNext: vi.fn(() => null),
    skipCurrentAndNext: vi.fn(() => null),
    errorEntryAndNext: vi.fn(() => null),
    getFormation: () => [entry],
  };
}

function setup() {
  const formationQueue = makeQueue();
  const hook = renderHook(() =>
    useSequentialFormationFlow({
      formationQueue,
      toast,
      setError,
      setProcessingState,
    }),
  );
  return { formationQueue, hook };
}

async function runFailingDocument(hook) {
  processFormationDocument.mockResolvedValue(failedResult);
  await act(async () => {
    hook.result.current.startSequentialProcessing();
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("a document whose save did not finish", () => {
  it("is marked as an error that names it and can be retried, and the run carries on", async () => {
    const { formationQueue, hook } = setup();

    await runFailingDocument(hook);

    expect(formationQueue.errorEntryAndNext).toHaveBeenCalledWith(
      "e1",
      NAMED_FAILURE,
      { retryable: true, quotaExceeded: false },
    );
    expect(hook.result.current.canRetryDocumentSave("e1")).toBe(true);
  });

  it("an ordinary failure is not offered a retry", async () => {
    const { formationQueue, hook } = setup();
    processFormationDocument.mockResolvedValue({
      ...failedResult,
      persistIncomplete: false,
      error: "No text could be extracted from document",
    });

    await act(async () => {
      hook.result.current.startSequentialProcessing();
      await Promise.resolve();
      await Promise.resolve();
    });

    const [id, message, extra] = formationQueue.errorEntryAndNext.mock.calls[0];
    expect(id).toBe("e1");
    expect(message).not.toContain("No text could be extracted");
    expect(extra.retryable).toBe(false);
    expect(hook.result.current.canRetryDocumentSave("e1")).toBe(false);
  });

  it("Retry saves the retained result and opens the review screen when it completes", async () => {
    const { formationQueue, hook } = setup();
    await runFailingDocument(hook);
    const saved = {
      ...failedResult,
      status: "complete",
      persistIncomplete: false,
    };
    retryFormationDocumentPersist.mockResolvedValue(saved);

    await act(async () => {
      await hook.result.current.retryDocumentSave("e1");
    });

    expect(retryFormationDocumentPersist).toHaveBeenCalledWith(failedResult);
    expect(formationQueue.updateEntry).toHaveBeenCalledWith("e1", {
      status: "USER_REVIEW",
      error: null,
      retryable: false,
    });
    expect(hook.result.current.showIntelBriefing).toBe(true);
    expect(hook.result.current.extractionResult).toEqual(saved);
    expect(hook.result.current.canRetryDocumentSave("e1")).toBe(false);
  });

  it("a Retry that still cannot save keeps the entry retryable and says so plainly", async () => {
    const { formationQueue, hook } = setup();
    await runFailingDocument(hook);
    retryFormationDocumentPersist.mockResolvedValue({
      ...failedResult,
      error: NAMED_FAILURE,
    });

    await act(async () => {
      await hook.result.current.retryDocumentSave("e1");
    });

    expect(toast.error).toHaveBeenCalledWith(NAMED_FAILURE);
    expect(formationQueue.updateEntry).toHaveBeenCalledWith("e1", {
      error: NAMED_FAILURE,
    });
    expect(hook.result.current.canRetryDocumentSave("e1")).toBe(true);
    expect(hook.result.current.showIntelBriefing).toBe(false);
  });
});
