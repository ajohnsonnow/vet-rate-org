import { describe, it, expect, beforeEach, vi } from "vitest";
import { createFakeIndexedDB } from "../__tests__/helpers/fakeIndexedDB";

// musterCallProcessor transitively imports pdfjs, which references canvas
// globals jsdom doesn't provide (same pattern as
// musterCallProcessor.parseClaimLetter.test.js).
globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

// Saving is part of every import now: without a store the document is reported
// as not saved, so these extraction tests give it a working one.
vi.stubGlobal("indexedDB", createFakeIndexedDB().indexedDB);

const { persistFormationDocument } = await import("./musterCallProcessor");
const { getMyRatings } = await import("./veteranProfile");
const { getServicePeriods } = await import("./veteranProfile");

const letterFile = (name) => ({ name, size: 2048 });
const letterResult = (conditions) => ({
  pageCount: 1,
  text: "",
  classification: { type: "rating_decision", confidence: 90 },
  extractedData: { type: "rating_decision", conditions },
});

// persistFormationDocument() is the exported seam processSingleDocument uses
// once a document's already been classified and parsed - it's also called a
// second time from the verification screen's "Verify & Save", so it has to
// be safe to call repeatedly for the same document.
describe("musterCallProcessor: persistFormationDocument saves rated conditions to My Ratings", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("adds a new rated condition to My Ratings", async () => {
    await persistFormationDocument(
      letterFile("ClaimLetter-2020-1-1.pdf"),
      letterResult([
        { name: "Tinnitus", rating: 10, effectiveDate: "2020-01-01" },
      ]),
    );
    const ratings = getMyRatings();
    expect(ratings).toHaveLength(1);
    expect(ratings[0]).toMatchObject({ name: "Tinnitus", rating: 10 });
  });

  it("lets a later, newer letter raise the percentage and effective date in place", async () => {
    await persistFormationDocument(
      letterFile("ClaimLetter-2020-1-1.pdf"),
      letterResult([
        { name: "Tinnitus", rating: 10, effectiveDate: "2020-01-01" },
      ]),
    );
    await persistFormationDocument(
      letterFile("ClaimLetter-2023-1-1.pdf"),
      letterResult([
        { name: "Tinnitus", rating: 30, effectiveDate: "2023-01-01" },
      ]),
    );
    const ratings = getMyRatings();
    expect(ratings).toHaveLength(1);
    expect(ratings[0].rating).toBe(30);
    expect(ratings[0].effectiveDate).toBe("2023-01-01");
  });

  it("does not let an older letter, processed after a newer one, roll back the saved rating", async () => {
    await persistFormationDocument(
      letterFile("ClaimLetter-2023-1-1.pdf"),
      letterResult([
        { name: "Tinnitus", rating: 30, effectiveDate: "2023-01-01" },
      ]),
    );
    await persistFormationDocument(
      letterFile("ClaimLetter-2019-1-1.pdf"),
      letterResult([
        { name: "Tinnitus", rating: 10, effectiveDate: "2019-01-01" },
      ]),
    );
    const ratings = getMyRatings();
    expect(ratings).toHaveLength(1);
    expect(ratings[0].rating).toBe(30);
  });

  it("renames a rated condition forward when a later letter says it was formerly rated under the old name", async () => {
    await persistFormationDocument(
      letterFile("ClaimLetter-2020-1-1.pdf"),
      letterResult([
        { name: "Anxiety disorder", rating: 10, effectiveDate: "2020-01-01" },
      ]),
    );
    await persistFormationDocument(
      letterFile("ClaimLetter-2024-1-1.pdf"),
      letterResult([
        {
          name: "PTSD (formerly evaluated as anxiety disorder)",
          rating: 50,
          effectiveDate: "2024-01-01",
        },
      ]),
    );
    const ratings = getMyRatings();
    expect(ratings).toHaveLength(1);
    expect(ratings[0].name).toBe(
      "PTSD (formerly evaluated as anxiety disorder)",
    );
    expect(ratings[0].rating).toBe(50);
  });
});

describe("musterCallProcessor: persistFormationDocument saves a code sheet's active-duty periods", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("upserts each active-duty period from a C-File code sheet", async () => {
    await persistFormationDocument(
      { name: "CFile.pdf", size: 4096 },
      {
        pageCount: 5,
        text: "",
        classification: { type: "c_file", confidence: 90 },
        extractedData: {
          type: "c_file",
          ratingSource: "code_sheet",
          conditions: [],
          servicePeriods: [
            {
              entryDate: "2002-04-27",
              separationDate: "2007-06-03",
              branch: "Army",
              characterOfDischarge: "Honorable",
            },
          ],
        },
      },
    );
    const periods = getServicePeriods();
    expect(periods).toHaveLength(1);
    expect(periods[0]).toMatchObject({
      serviceStartDate: "2002-04-27",
      serviceEndDate: "2007-06-03",
      branch: "Army",
      characterOfService: "Honorable",
    });
  });

  it("does nothing when the document is not a code sheet", async () => {
    await persistFormationDocument(
      { name: "ClaimLetter.pdf", size: 1024 },
      {
        pageCount: 1,
        text: "",
        classification: { type: "rating_decision", confidence: 90 },
        extractedData: {
          type: "rating_decision",
          conditions: [],
          servicePeriods: [
            { entryDate: "2002-04-27", separationDate: "2007-06-03" },
          ],
        },
      },
    );
    expect(getServicePeriods()).toEqual([]);
  });
});
