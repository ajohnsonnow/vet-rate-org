/**
 * D13-4 (final13 QA): myPacketManager.js's _formatOtherDocsSection used to
 * embed JSON.stringify(doc.extractedData).substring(0, 500) verbatim -
 * every musterCallProcessor.js parser bakes a `raw: text.substring(0, N)`
 * field straight into extractedData (a claim letter's letterhead, which is
 * the veteran's own name/home address/VA file number), and an
 * unclassified document type resolves to ONLY that raw field
 * (parseDocumentByType's default branch). This exercises the real,
 * unmocked _groupDocsByType/_formatOtherDocsSection fix through
 * getVeteranAIContext (the one entry-point every AI tool uses) at several
 * maxPacketTokens budgets, including the largest any live caller passes
 * (AIAssistant.jsx: 1000) - only getAllPacketDocuments' IndexedDB read is
 * swapped for a fixture array, since jsdom has no IndexedDB. Fixture PII
 * strings are synthetic, not any real veteran's data.
 */
import { describe, it, expect, vi } from "vitest";

const FAKE_NAME = "Jordan Q Faketon";
const FAKE_ADDRESS = "742 Fictional Ave, Nowhereville, ZZ 00000";
const FAKE_SSN = "000-00-0000";
const FAKE_VA_FILE_NUMBER = "123456789";

const FAKE_CLAIM_LETTER_RAW = `DEPARTMENT OF VETERANS AFFAIRS
${FAKE_NAME}
${FAKE_ADDRESS}
In reply refer to: ${FAKE_VA_FILE_NUMBER}
SSN: ${FAKE_SSN}
Dear ${FAKE_NAME},
We have completed the review of your claim.`;

const fakeDocs = [
  {
    fileName: "decision_letter.pdf",
    classification: "va_correspondence",
    uploadDate: "2026-02-01T00:00:00.000Z",
    rawText: FAKE_CLAIM_LETTER_RAW,
    extractedData: {
      type: "claim_letter",
      claimNumber: "CL-2026-000111",
      vaFileNumber: FAKE_VA_FILE_NUMBER,
      claimDate: "2026-01-15",
      letterDate: "2026-02-01",
      decisionDate: "2026-02-01",
      decisions: [{ issue: "Tinnitus", outcome: "granted" }],
      conditions: ["Tinnitus"],
      combinedRating: 10,
      evidenceNeeded: [],
      responseDeadlineDays: null,
      status: "decided",
      raw: FAKE_CLAIM_LETTER_RAW.substring(0, 500),
    },
  },
  {
    fileName: "unclassified_scan.pdf",
    classification: "other",
    uploadDate: "2026-02-02T00:00:00.000Z",
    rawText: FAKE_CLAIM_LETTER_RAW,
    // parseDocumentByType's default branch: nothing but the raw fallback.
    extractedData: { raw: FAKE_CLAIM_LETTER_RAW.substring(0, 1000) },
  },
];

vi.mock("./myPacketManager.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    // getAllPacketDocuments reads IndexedDB, unavailable in jsdom - swap
    // only the doc source; _groupDocsByType/_formatOtherDocsSection below
    // are the REAL, unmocked functions this test is verifying.
    generatePacketContext: async (options = {}) => {
      const maxChars = (options.maxTokens || 4000) * 2;
      let context = "=== MY PACKET: VETERAN DOCUMENT SUMMARY ===\n\n";
      context += `Documents on file: ${fakeDocs.length}\n\n`;
      const grouped = actual._groupDocsByType(fakeDocs, options.types);
      context += actual._formatOtherDocsSection(grouped);
      if (context.length > maxChars) {
        context = context.substring(0, maxChars) + "\n[... TRUNCATED ...]\n";
      }
      context += "=== END MY PACKET ===\n";
      return context;
    },
  };
});

const { getVeteranAIContext } = await import("./veteranContextProvider.js");

describe("getVeteranAIContext: no document PII leaks at any packet budget", () => {
  it.each([300, 800, 1000])(
    "never surfaces the fake name/address/SSN/VA file number at maxPacketTokens=%i",
    async (maxPacketTokens) => {
      const ctx = await getVeteranAIContext({
        includeVKB: false,
        maxPacketTokens,
      });

      expect(ctx).not.toContain(FAKE_NAME);
      expect(ctx).not.toContain(FAKE_ADDRESS);
      expect(ctx).not.toContain(FAKE_SSN);
      expect(ctx).not.toContain(FAKE_VA_FILE_NUMBER);
    },
  );

  it("still surfaces the safe, whitelisted claim facts", async () => {
    const ctx = await getVeteranAIContext({
      includeVKB: false,
      maxPacketTokens: 1000,
    });

    expect(ctx).toContain("combinedRating");
    expect(ctx).toContain("Tinnitus");
  });
});
