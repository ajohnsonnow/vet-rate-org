/**
 * D13-4 (final13 QA): _formatOtherDocsSection used to embed
 * JSON.stringify(doc.extractedData).substring(0, 500) verbatim - every
 * musterCallProcessor.js parser bakes a `raw: text.substring(0, N)` field
 * straight into extractedData (a claim letter's letterhead: the veteran's
 * own name/home address/VA file number), and an unclassified document
 * type resolves to ONLY that raw field (parseDocumentByType's default
 * branch). _formatServiceRecordDoc had its own separate raw-text fallback
 * (a dormant `options.includeRawText`, never actually called by any live
 * caller) that embedded up to 2000 raw chars. Fixture PII strings are
 * synthetic, not any real veteran's data.
 */
import { describe, it, expect } from "vitest";
import {
  _formatOtherDocsSection,
  _formatServiceRecordDoc,
} from "./myPacketManager";

const FAKE_NAME = "Jordan Q Faketon";
const FAKE_ADDRESS = "742 Fictional Ave, Nowhereville, ZZ 00000";
const FAKE_SSN = "000-00-0000";
const FAKE_VA_FILE_NUMBER = "123456789";

const FAKE_LETTERHEAD = `DEPARTMENT OF VETERANS AFFAIRS
${FAKE_NAME}
${FAKE_ADDRESS}
In reply refer to: ${FAKE_VA_FILE_NUMBER}
SSN: ${FAKE_SSN}
Dear ${FAKE_NAME},`;

function expectNoPii(text) {
  expect(text).not.toContain(FAKE_NAME);
  expect(text).not.toContain(FAKE_ADDRESS);
  expect(text).not.toContain(FAKE_SSN);
  expect(text).not.toContain(FAKE_VA_FILE_NUMBER);
}

describe("_formatOtherDocsSection: whitelisted fields only", () => {
  it("never surfaces raw/vaFileNumber, but keeps the safe claim facts", () => {
    const out = _formatOtherDocsSection({
      va_correspondence: [
        {
          fileName: "decision_letter.pdf",
          uploadDate: "2026-02-01T00:00:00.000Z",
          extractedData: {
            type: "claim_letter",
            claimNumber: "CL-2026-000111",
            vaFileNumber: FAKE_VA_FILE_NUMBER,
            decisions: [{ issue: "Tinnitus", outcome: "granted" }],
            combinedRating: 10,
            raw: FAKE_LETTERHEAD.substring(0, 500),
          },
        },
      ],
    });

    expectNoPii(out);
    expect(out).toContain("combinedRating");
    expect(out).toContain("Tinnitus");
  });

  it("prints nothing for a document with only the raw-text fallback (unclassified type)", () => {
    const out = _formatOtherDocsSection({
      other: [
        {
          fileName: "unclassified_scan.pdf",
          uploadDate: "2026-02-02T00:00:00.000Z",
          // parseDocumentByType's default branch: {raw: text.substring(0, 1000)}
          extractedData: { raw: FAKE_LETTERHEAD.substring(0, 1000) },
        },
      ],
    });

    expectNoPii(out);
    expect(out).not.toContain("Data:");
  });
});

describe("_formatServiceRecordDoc: no raw-text fallback", () => {
  it("prints nothing for a service record with no structured extraction, even with raw OCR text present", () => {
    const out = _formatServiceRecordDoc({
      fileName: "dd214_scan.pdf",
      extractedData: {},
      rawText: FAKE_LETTERHEAD,
    });

    expect(out).toBe("");
  });
});
