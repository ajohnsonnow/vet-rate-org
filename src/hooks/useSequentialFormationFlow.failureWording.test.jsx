/**
 * D23-3 follow-ups: a failure the veteran can fix keeps its instruction, a
 * reader that cannot start offers a reload (not a Retry that cannot work), the
 * closing toast agrees with what is filed, a failed Verify & Save shows no raw
 * error text, and the console never carries an internal type label.
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
import { useSequentialFormationFlow } from "./useSequentialFormationFlow";
import { readActiveImportMarker } from "../utils/importProgressMarker";

const toast = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };
const setError = vi.fn();
let queue;
let formationQueue;
let logged;

const reviewable = {
  filename: "x.pdf",
  size: 1,
  status: "complete",
  readyForReview: true,
  vkbSaved: true,
  extractedData: {},
};

function setup(types) {
  queue = types.map((estimatedType, i) => ({
    id: `e${i + 1}`,
    file: new File(["x"], `private-${i}.pdf`),
    estimatedType,
    status: "WAITING",
  }));
  const patch = (id, change) => {
    queue = queue.map((e) => (e.id === id ? { ...e, ...change } : e));
  };
  const nextWaiting = () => queue.find((e) => e.status === "WAITING") ?? null;
  formationQueue = {
    formation: queue,
    stats: {},
    updateEntry: vi.fn(patch),
    startFormation: vi.fn(() => queue[0]),
    completeCurrentAndNext: vi.fn(() => null),
    skipCurrentAndNext: vi.fn(() => {
      const current = queue.find((e) => e.status === "USER_REVIEW");
      patch(current.id, { status: "SKIPPED" });
      return nextWaiting();
    }),
    errorEntryAndNext: vi.fn((id, error, extra) => {
      patch(id, { status: "ERROR", error, ...extra });
      return nextWaiting();
    }),
    getFormation: () => queue,
  };
  return renderHook(() =>
    useSequentialFormationFlow({
      formationQueue,
      toast,
      setError,
      setProcessingState: vi.fn(),
    }),
  ).result;
}

const settle = (ms) =>
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
  localStorage.clear();
  logged = [];
  for (const method of ["log", "info", "warn", "error"]) {
    vi.spyOn(console, method).mockImplementation((...args) =>
      logged.push(args.map(String).join(" ")),
    );
  }
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("a failure the veteran can fix", () => {
  it("keeps its instruction and offers no Retry that cannot help", async () => {
    const result = setup(["UNKNOWN"]);
    processFormationDocument.mockRejectedValue(
      new Error("Legacy .doc format is not supported. Please save it."),
    );

    await start(result);

    const [, message, extra] = formationQueue.errorEntryAndNext.mock.calls[0];
    expect(message).toBe(
      "We could not finish document 1. Legacy .doc files are not supported, so save the document as .docx or .txt and add it again.",
    );
    expect(extra.retryable).toBe(false);
    expect(result.current.canRetryDocumentSave("e1")).toBe(false);
  });
});

describe("a document reader that could not start", () => {
  it("says to reload and offers no Retry, which could not work", async () => {
    const result = setup(["UNKNOWN"]);
    processFormationDocument.mockRejectedValue(
      new Error(
        'Setting up fake worker failed: "Failed to fetch dynamically imported module".',
      ),
    );

    await start(result);

    const [, message, extra] = formationQueue.errorEntryAndNext.mock.calls[0];
    expect(message).toBe(
      "We could not finish document 1 because the document reader did not start. Reload this page, then add the file again to finish it.",
    );
    expect(extra.retryable).toBe(false);
    expect(result.current.canRetryDocumentSave("e1")).toBe(false);
  });
});

describe("the message when the import ends", () => {
  it("does not say nothing was saved when documents were filed and then skipped or failed", async () => {
    const result = setup(["DD214", "DBQ"]);
    processFormationDocument
      .mockResolvedValueOnce(reviewable)
      .mockRejectedValueOnce(new Error("analysis exploded"));
    await start(result);
    act(() => result.current.handleSkipDocument());
    await settle(2200);

    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.warning).toHaveBeenCalledWith(
      expect.stringMatching(/^Import finished: 1 document saved, 1 not saved/),
      expect.any(Number),
    );
  });

  it("says no document was kept only when none was filed", async () => {
    const result = setup(["DD214"]);
    processFormationDocument.mockResolvedValue({
      ...reviewable,
      vkbSaved: false,
    });
    await start(result);
    act(() => result.current.handleSkipDocument());
    await settle(2200);

    expect(toast.warning).toHaveBeenCalledWith(
      "Nothing was saved because no document was kept.",
      expect.any(Number),
    );
  });
});

describe("a failed Verify & Save", () => {
  const payload = { verifiedData: {}, saveToVKB: true, updateProfile: false };

  async function failSaveWith(error) {
    const result = setup(["DD214"]);
    processFormationDocument.mockResolvedValue(reviewable);
    persistFormationDocument.mockRejectedValue(error);
    await start(result);
    await act(async () => {
      await result.current.handleVerifyAndSave(payload);
    });
  }

  it("shows no raw error text", async () => {
    await failSaveWith(
      new Error("QuotaExceededError at http://localhost:5383/src/x.js"),
    );

    const shown = [setError.mock.calls.at(-1)[0], toast.error.mock.calls[0][0]];
    for (const text of shown) {
      expect(text).toContain("choose Verify & Save to try again");
      expect(text).not.toMatch(/Quota|localhost|https?:/);
    }
    expect(logged.join("\n")).not.toMatch(/Quota|localhost/);
  });

  it("still shows the invalid service start date message", async () => {
    const result = setup(["DD214"]);
    processFormationDocument.mockResolvedValue(reviewable);
    await start(result);
    await act(async () => {
      await result.current.handleVerifyAndSave({
        ...payload,
        serviceEntryCorrection: { date: "not a date" },
      });
    });

    expect(setError).toHaveBeenLastCalledWith(
      "That service start date isn't a valid date. Use YYYY-MM-DD.",
    );
  });
});

describe("the console", () => {
  it("carries no internal type label in capitals", async () => {
    const result = setup(["UNKNOWN", "CLAIM_LETTER"]);
    processFormationDocument.mockResolvedValue(reviewable);

    await start(result);

    expect(logged.join("\n")).toContain("document 1");
    expect(logged.join("\n")).not.toMatch(/UNKNOWN|CLAIM_LETTER/);
    expect(readActiveImportMarker().labels).toEqual([
      "document 1",
      "document 2 (claim letter)",
    ]);
  });
});
