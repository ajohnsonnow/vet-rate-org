/**
 * D20-4: the sequential flow logged the whole processed result (document text
 * and extracted fields), every progress payload (which carries extracted
 * data on completion) and the veteran's verified field values. None of that
 * may reach the console.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { inspect } from "node:util";

vi.mock("../utils/musterCallProcessor", () => ({
  processFormationDocument: vi.fn(),
  persistFormationDocument: vi.fn(async () => {}),
  autoPopulateProfile: vi.fn(async () => {}),
  PROCESSING_STATES: { EXTRACTING: "EXTRACTING", COMPLETE: "COMPLETE" },
}));

import { processFormationDocument } from "../utils/musterCallProcessor";
import { useSequentialFormationFlow } from "./useSequentialFormationFlow";

const SECRETS = ["QUILLFEATHER", "987-65-4321", "ZXQ-MARKER-9981"];

const secretResult = {
  filename: "generic.pdf",
  size: 1,
  status: "complete",
  readyForReview: true,
  text: "NAME: QUILLFEATHER ZXQ-MARKER-9981",
  classification: { type: "DD214" },
  extractedData: { veteranName: "QUILLFEATHER", ssn: "987-65-4321" },
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe("useSequentialFormationFlow: console output", () => {
  it("logs no extracted value, document text or verified field value", async () => {
    const spies = ["log", "info", "warn", "error", "debug"].map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    );
    processFormationDocument.mockImplementation(async (_file, onProgress) => {
      onProgress({
        stage: "complete",
        state: "complete",
        progress: 100,
        result: { extractedData: secretResult.extractedData },
      });
      return secretResult;
    });
    const formationQueue = {
      formation: [],
      stats: {},
      updateEntry: vi.fn(),
      startFormation: vi.fn(() => ({
        id: "e1",
        file: { name: "generic.pdf", size: 1 },
      })),
      completeCurrentAndNext: vi.fn(() => null),
      skipCurrentAndNext: vi.fn(() => null),
      errorEntryAndNext: vi.fn(() => null),
      getFormation: () => [],
    };
    const { result } = renderHook(() =>
      useSequentialFormationFlow({
        formationQueue,
        toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
        setError: vi.fn(),
        setProcessingState: vi.fn(),
      }),
    );

    await act(async () => {
      result.current.startSequentialProcessing();
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      await result.current.handleVerifyAndSave({
        verifiedData: { veteranName: "QUILLFEATHER", ssn: "987-65-4321" },
        saveToVKB: true,
        updateProfile: false,
      });
    });

    const output = spies
      .flatMap((spy) => spy.mock.calls)
      .map((args) => args.map((a) => inspect(a, { depth: 8 })).join(" "))
      .join("\n");
    expect(output.length).toBeGreaterThan(0);
    for (const secret of SECRETS) {
      expect(output, `console output contains "${secret}"`).not.toContain(
        secret,
      );
    }
  });
});
