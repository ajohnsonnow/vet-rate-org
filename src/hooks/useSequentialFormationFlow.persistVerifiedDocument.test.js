/**
 * ADR-007 W2: persistVerifiedDocument is the one place a Muster Call review
 * correction gets applied before the document is persisted - the
 * correction runs first (so persistFormationDocument's own VKB write
 * already reflects it), retries once if the first attempt found no linked
 * period yet, throws before any write on an invalid date, and never lets
 * identity fields (serviceStartDate/serviceStartDateDerived) leak back
 * into extractedData. Fixture values are synthetic, not any real
 * veteran's data.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// musterCallProcessor transitively imports pdfjs-dist, which references
// canvas globals jsdom doesn't provide (same pattern as
// myPacketCalculatedDate.test.jsx).
globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

vi.mock("../utils/musterCallProcessor", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    persistFormationDocument: vi.fn().mockResolvedValue(undefined),
    autoPopulateProfile: vi.fn().mockResolvedValue(undefined),
  };
});

const { persistFormationDocument, autoPopulateProfile } =
  await import("../utils/musterCallProcessor");
const { persistVerifiedDocument } =
  await import("./useSequentialFormationFlow");
const { upsertServicePeriod, getServiceEntry } =
  await import("../utils/veteranProfile");

const PROFILE_KEY = "vet_rate_veteran_profile";

function seedPeriod() {
  return upsertServicePeriod(
    {
      serviceStartDate: "2002-03-05",
      serviceStartDateDerived: true,
      serviceEndDate: "2010-06-15",
      formType: "NGB22",
    },
    { sourceDocument: "ngb22-synthetic.pdf", confidence: 60 },
  );
}

const extractionResult = {
  filename: "ngb22-synthetic.pdf",
  size: 100,
  extractedData: {
    serviceStartDate: "2002-03-05",
    serviceStartDateDerived: true,
    serviceEndDate: "2010-06-15",
    branch: "Army National Guard",
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  localStorage.setItem(
    PROFILE_KEY,
    JSON.stringify({ fullName: "Jordan Sample" }),
  );
});

describe("persistVerifiedDocument", () => {
  it("returns persisted:false and does nothing when neither saveToVKB nor updateProfile is set", async () => {
    const result = await persistVerifiedDocument(extractionResult, {
      verifiedData: {},
      saveToVKB: false,
      updateProfile: false,
    });
    expect(result).toEqual({ persisted: false, correction: null });
    expect(persistFormationDocument).not.toHaveBeenCalled();
    expect(autoPopulateProfile).not.toHaveBeenCalled();
  });

  it("throws before persisting anything when serviceEntryCorrection.date does not parse", async () => {
    await expect(
      persistVerifiedDocument(extractionResult, {
        verifiedData: {},
        saveToVKB: true,
        updateProfile: true,
        serviceEntryCorrection: { date: "not a date" },
      }),
    ).rejects.toThrow("That service start date isn't a valid date");
    expect(persistFormationDocument).not.toHaveBeenCalled();
    expect(autoPopulateProfile).not.toHaveBeenCalled();
  });

  it("applies the correction BEFORE persisting, so the VKB write already reflects it", async () => {
    const periodId = seedPeriod();
    const callOrder = [];
    persistFormationDocument.mockImplementation(async () => {
      callOrder.push(["persist", getServiceEntry().date]);
    });

    await persistVerifiedDocument(extractionResult, {
      verifiedData: {},
      saveToVKB: true,
      updateProfile: true,
      serviceEntryCorrection: {
        date: "2001-11-01",
        documentStartDate: "2002-03-05",
        documentEndDate: "2010-06-15",
      },
    });

    expect(callOrder).toEqual([["persist", "2001-11-01"]]);
    expect(getServiceEntry()).toMatchObject({
      date: "2001-11-01",
      source: "veteran",
      periodId,
    });
  });
});

describe("persistVerifiedDocument: identity and retry", () => {
  it("strips serviceStartDate/serviceStartDateDerived from the persisted verified fields", async () => {
    seedPeriod();
    await persistVerifiedDocument(extractionResult, {
      verifiedData: {
        serviceStartDate: "1999-01-01",
        serviceStartDateDerived: false,
        branch: "Army",
      },
      saveToVKB: true,
      updateProfile: true,
    });

    const [, persistedResult] = persistFormationDocument.mock.calls[0];
    expect(persistedResult.extractedData.serviceStartDate).toBe("2002-03-05");
    expect(persistedResult.extractedData.serviceStartDateDerived).toBe(true);
    expect(persistedResult.extractedData.branch).toBe("Army");
  });

  it("retries once after persisting when the first attempt finds no linked period yet", async () => {
    // No period exists for this document until persistFormationDocument's
    // mocked implementation creates one mid-call - the same shape a real
    // ingest would produce.
    persistFormationDocument.mockImplementation(async () => {
      seedPeriod();
    });

    const result = await persistVerifiedDocument(extractionResult, {
      verifiedData: {},
      saveToVKB: true,
      updateProfile: true,
      serviceEntryCorrection: {
        date: "2001-11-01",
        documentStartDate: "2002-03-05",
        documentEndDate: "2010-06-15",
      },
    });

    expect(result.correction.ok).toBe(true);
    expect(getServiceEntry()).toMatchObject({
      date: "2001-11-01",
      source: "veteran",
    });
  });
});
