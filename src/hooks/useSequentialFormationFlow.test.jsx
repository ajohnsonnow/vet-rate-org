/**
 * Regression: the Muster Call sequential-formation "Verify & Save" screen
 * (DocumentIntelligenceBriefing) lets a veteran correct AI-extracted fields
 * and offers "Save to Knowledge Base" / "Update Profile" checkboxes, but
 * runVerifyAndSave() only updated local formation-queue UI state - the
 * corrected fields never reached VKB, My Packet, or the profile stores any
 * AI tool actually reads. A veteran's correction was silently discarded and
 * the original (possibly wrong) extraction persisted instead. Reproduced
 * live in a real browser: editing a name and clicking "Verify & Save" left
 * the unedited name in VKB.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSequentialFormationFlow } from "./useSequentialFormationFlow";

vi.mock("../utils/musterCallProcessor", () => ({
  processFormationDocument: vi.fn(),
  persistFormationDocument: vi.fn(),
  autoPopulateProfile: vi.fn(),
  PROCESSING_STATES: { EXTRACTING: "EXTRACTING", COMPLETE: "COMPLETE" },
}));

import {
  processFormationDocument,
  persistFormationDocument,
  autoPopulateProfile,
} from "../utils/musterCallProcessor";
import { upsertServicePeriod, getServiceEntry } from "../utils/veteranProfile";

function buildFormationQueue() {
  return {
    formation: [],
    stats: {},
    updateEntry: vi.fn(),
    startFormation: vi.fn(),
    completeCurrentAndNext: vi.fn(() => null),
    skipCurrentAndNext: vi.fn(() => null),
    errorCurrentAndNext: vi.fn(() => null),
  };
}

async function processOneDocument(result, extractedData) {
  processFormationDocument.mockResolvedValue({
    filename: "sample-dd214.txt",
    size: 851,
    status: "complete",
    readyForReview: true,
    extractedData,
  });

  const entry = { id: "e1", file: { name: "sample-dd214.txt", size: 851 } };
  await act(async () => {
    result.current.processDocumentEntry(entry);
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useSequentialFormationFlow - Verify & Save persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("re-persists the corrected fields (not the original extraction) when the veteran edits and verifies", async () => {
    const { result } = renderHook(() =>
      useSequentialFormationFlow({
        formationQueue: buildFormationQueue(),
        toast: { success: vi.fn(), error: vi.fn() },
        setError: vi.fn(),
        setProcessingState: vi.fn(),
      }),
    );

    await processOneDocument(result, { veteranName: "ORIGINAL NAME" });
    expect(result.current.extractionResult.extractedData.veteranName).toBe(
      "ORIGINAL NAME",
    );

    await act(async () => {
      result.current.handleVerifyAndSave({
        verifiedData: { veteranName: "CORRECTED NAME" },
        saveToVKB: true,
        updateProfile: true,
      });
      await Promise.resolve();
    });

    expect(persistFormationDocument).toHaveBeenCalledTimes(1);
    const [pseudoFile, persistedResult] =
      persistFormationDocument.mock.calls[0];
    expect(pseudoFile).toEqual({ name: "sample-dd214.txt", size: 851 });
    expect(persistedResult.extractedData.veteranName).toBe("CORRECTED NAME");

    expect(autoPopulateProfile).toHaveBeenCalledTimes(1);
    expect(
      autoPopulateProfile.mock.calls[0][0][0].extractedData.veteranName,
    ).toBe("CORRECTED NAME");
  });

  it("skips both persistence calls when the veteran unchecks Save to VKB and Update Profile", async () => {
    const { result } = renderHook(() =>
      useSequentialFormationFlow({
        formationQueue: buildFormationQueue(),
        toast: { success: vi.fn(), error: vi.fn() },
        setError: vi.fn(),
        setProcessingState: vi.fn(),
      }),
    );

    await processOneDocument(result, { veteranName: "ORIGINAL NAME" });

    await act(async () => {
      result.current.handleVerifyAndSave({
        verifiedData: { veteranName: "CORRECTED NAME" },
        saveToVKB: false,
        updateProfile: false,
      });
      await Promise.resolve();
    });

    expect(persistFormationDocument).not.toHaveBeenCalled();
    expect(autoPopulateProfile).not.toHaveBeenCalled();
  });
});

function renderFlow() {
  return renderHook(() =>
    useSequentialFormationFlow({
      formationQueue: buildFormationQueue(),
      toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
      setError: vi.fn(),
      setProcessingState: vi.fn(),
    }),
  );
}

describe("useSequentialFormationFlow [ADR-007]: a service-entry correction reaches the canonical period", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem(
      "vet_rate_veteran_profile",
      JSON.stringify({ fullName: "Jordan Sample" }),
    );
  });

  it("applies via setServiceEntryDate and leaves extractedData's own identity untouched", async () => {
    const periodId = upsertServicePeriod(
      {
        serviceStartDate: "2002-03-05",
        serviceStartDateDerived: true,
        serviceEndDate: "2010-06-15",
        formType: "NGB22",
      },
      { sourceDocument: "sample-dd214.txt", confidence: 60 },
    );

    const { result } = renderFlow();

    await processOneDocument(result, {
      serviceStartDate: "2002-03-05",
      serviceStartDateDerived: true,
      serviceEndDate: "2010-06-15",
    });

    await act(async () => {
      result.current.handleVerifyAndSave({
        verifiedData: {},
        saveToVKB: true,
        updateProfile: true,
        serviceEntryCorrection: {
          date: "2001-11-01",
          documentStartDate: "2002-03-05",
          documentEndDate: "2010-06-15",
        },
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    // Identity stays on the original extraction - the correction never
    // rewrites extractedData.serviceStartDate/serviceStartDateDerived.
    const [, persistedResult] = persistFormationDocument.mock.calls[0];
    expect(persistedResult.extractedData.serviceStartDate).toBe("2002-03-05");
    expect(persistedResult.extractedData.serviceStartDateDerived).toBe(true);

    expect(getServiceEntry()).toMatchObject({
      date: "2001-11-01",
      derived: false,
      source: "veteran",
      periodId,
    });
  });

  it("throws before persisting anything when the typed date does not parse", async () => {
    const { result } = renderFlow();

    await processOneDocument(result, {
      serviceStartDate: "2002-03-05",
      serviceStartDateDerived: true,
    });

    await act(async () => {
      result.current.handleVerifyAndSave({
        verifiedData: {},
        saveToVKB: true,
        updateProfile: true,
        serviceEntryCorrection: { date: "not a date" },
      });
      await Promise.resolve();
    });

    expect(persistFormationDocument).not.toHaveBeenCalled();
  });
});
