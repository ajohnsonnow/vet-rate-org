/**
 * D22-2: a file that cannot be read used to lose the document with a technical
 * message and no Retry. It is now tried once more on its own, then reported by
 * the document's neutral label with a bounded Retry that reads the original
 * File again (never its bytes), and a file that is gone says so plainly. No
 * technical text, blob: address or file name reaches the console. The
 * processor is the boundary and is faked; the flow is the real code.
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

const NAME = "generic-private-name.pdf";
const READ_FAILED = {
  filename: NAME,
  size: 1,
  status: "error",
  readFailed: true,
  error: "This file could not be read.",
};
const REVIEWABLE = {
  filename: NAME,
  size: 1,
  status: "complete",
  readyForReview: true,
  extractedData: {},
};

const toast = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };
let entry;
let formationQueue;
let logged;

const unreadableFile = () => {
  const file = new File(["x"], NAME, { type: "application/pdf" });
  file.slice = () => ({
    arrayBuffer: () =>
      Promise.reject(new DOMException("gone", "NotFoundError")),
  });
  return file;
};

function setup(file = new File(["x"], NAME, { type: "application/pdf" })) {
  entry = { id: "e1", file, estimatedType: "DD214" };
  formationQueue = {
    formation: [entry],
    stats: {},
    updateEntry: vi.fn(),
    startFormation: vi.fn(() => entry),
    completeCurrentAndNext: vi.fn(() => null),
    skipCurrentAndNext: vi.fn(() => null),
    errorEntryAndNext: vi.fn(() => null),
    getFormation: () => [entry],
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
  await settle(1100);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
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

describe("a document whose file cannot be read", () => {
  it("is read once more on its own and goes on to review when that works", async () => {
    const result = setup();
    processFormationDocument
      .mockResolvedValueOnce(READ_FAILED)
      .mockResolvedValueOnce(REVIEWABLE);

    await start(result);

    expect(processFormationDocument).toHaveBeenCalledTimes(2);
    expect(processFormationDocument.mock.calls[1][0]).toBe(entry.file);
    expect(formationQueue.errorEntryAndNext).not.toHaveBeenCalled();
    expect(result.current.showIntelBriefing).toBe(true);
  });

  it("is reported by its neutral label with a Retry once the automatic retry has failed", async () => {
    const result = setup();
    processFormationDocument.mockResolvedValue(READ_FAILED);

    await start(result);

    expect(processFormationDocument).toHaveBeenCalledTimes(2);
    const [id, message, extra] = formationQueue.errorEntryAndNext.mock.calls[0];
    expect(id).toBe("e1");
    expect(message).toBe(
      "We could not finish the DD214 (document 1) because the file could not be read, so choose Retry to try again.",
    );
    expect(extra).toEqual({
      retryable: true,
      processingFailure: true,
      failureKind: "read",
    });
    expect(result.current.canRetryDocumentSave("e1")).toBe(true);
  });

  it("Retry reads the original File again and goes on to review", async () => {
    const result = setup();
    processFormationDocument.mockResolvedValue(READ_FAILED);
    await start(result);
    processFormationDocument.mockResolvedValue(REVIEWABLE);

    await act(async () => {
      await result.current.retryDocumentSave("e1");
    });

    expect(processFormationDocument).toHaveBeenCalledTimes(3);
    expect(processFormationDocument.mock.calls[2][0]).toBe(entry.file);
    expect(result.current.showIntelBriefing).toBe(true);
    expect(result.current.canRetryDocumentSave("e1")).toBe(false);
  });

  it("stops offering Retry after a bounded number of manual retries", async () => {
    const result = setup();
    processFormationDocument.mockResolvedValue(READ_FAILED);
    await start(result);

    for (let attempt = 0; attempt < 3; attempt++) {
      expect(result.current.canRetryDocumentSave("e1")).toBe(true);
      await act(async () => {
        await result.current.retryDocumentSave("e1");
      });
      await settle(1100);
    }

    expect(result.current.canRetryDocumentSave("e1")).toBe(false);
    const lastMessage = formationQueue.errorEntryAndNext.mock.calls.at(-1)[1];
    expect(lastMessage).toContain("even after several tries");
    expect(lastMessage).toContain("add the file again");
  });

  it("says so plainly, with no Retry and no second read, when the file is no longer readable", async () => {
    const result = setup(unreadableFile());
    processFormationDocument.mockResolvedValue(READ_FAILED);

    await start(result);

    expect(processFormationDocument).toHaveBeenCalledTimes(1);
    const [, message, extra] = formationQueue.errorEntryAndNext.mock.calls[0];
    expect(message).toBe(
      "We could not read the DD214 (document 1) because the file is no longer available, so add it again to finish it.",
    );
    expect(extra).toEqual({
      retryable: false,
      processingFailure: true,
      failureKind: "read",
    });
    expect(result.current.canRetryDocumentSave("e1")).toBe(false);
  });
});

describe("what is shown and logged for a document that cannot be read", () => {
  it("never writes the file name or technical text to the console or the message", async () => {
    const result = setup();
    processFormationDocument.mockResolvedValue({
      ...READ_FAILED,
      error: `Unexpected server response (0) while retrieving PDF "blob:http://x/${NAME}"`,
    });

    await start(result);

    const shown = formationQueue.errorEntryAndNext.mock.calls[0][1];
    expect(shown).not.toMatch(/blob:|Unexpected server response|private-name/);
    expect(logged.join("\n")).not.toMatch(
      /blob:|Unexpected server response|private-name/,
    );
  });
});
