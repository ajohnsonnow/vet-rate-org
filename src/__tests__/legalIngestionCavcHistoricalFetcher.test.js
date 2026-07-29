import { describe, it, expect } from "vitest";
import {
  sniffDocFormat,
  classifyDocFormat,
  docketFromText,
  citationForHit,
} from "../../scripts/legal-ingestion/fetch-cavc-historical.mjs";

/**
 * S43 — regression coverage for the garbled-encoding fix: classifyDocFormat(docid)
 * is only a filename-based GUESS ("no extension" legacy files are NOT reliably
 * plain text); sniffDocFormat(bytes) is the real classifier, checked against
 * the archive's actual magic numbers. A WordPerfect binary served under a
 * non-.wpd filename must be sniffed as "wpd" and skipped, never latin1-decoded.
 */
describe("sniffDocFormat — magic-byte ground truth", () => {
  it("recognizes a WordPerfect binary by its \\xFFWPC signature, regardless of filename", () => {
    // Real bytes observed from a 1992 PanelDecisions hit whose docid had no
    // extension — classifyDocFormat(docid) alone would have called this "text".
    const wpBytes = new Uint8Array([
      0xff, 0x57, 0x50, 0x43, 0x37, 0x2a, 0x00, 0x00,
    ]);
    expect(sniffDocFormat(wpBytes)).toBe("wpd");
  });

  it("recognizes a PDF by its %PDF signature", () => {
    const pdfBytes = new Uint8Array([
      0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34,
    ]);
    expect(sniffDocFormat(pdfBytes)).toBe("pdf");
  });

  it("classifies plain ASCII opinion text as text", () => {
    const textBytes = new TextEncoder().encode(
      "No. 90-396 (Vet. App. 1992)\n\nORDER...",
    );
    expect(sniffDocFormat(textBytes)).toBe("text");
  });

  it("treats too-short or missing byte arrays as text (no false-positive magic match)", () => {
    expect(sniffDocFormat(new Uint8Array([0xff, 0x57]))).toBe("text");
    expect(sniffDocFormat(null)).toBe("text");
  });
});

describe("classifyDocFormat — filename fast-skip only", () => {
  it("still fast-skips an explicit .wpd extension without a download", () => {
    expect(classifyDocFormat("SANDINE.wpd")).toBe("wpd");
  });

  it("guesses text for a no-extension legacy filename (sniffDocFormat is the real check)", () => {
    expect(classifyDocFormat("CRICK.570")).toBe("text");
  });

  it("recognizes an explicit .pdf extension", () => {
    expect(classifyDocFormat("23-7995.pdf")).toBe("pdf");
  });
});

describe("docketFromText / citationForHit — unchanged pure helpers", () => {
  it("pulls the docket number from letter-spaced PDF-extracted text", () => {
    expect(docketFromText("N O . 23-7995 UNITED STATES COURT OF APPEALS")).toBe(
      "23-7995",
    );
  });

  it("builds a docket-based citation from a docket and list date", () => {
    expect(citationForHit("23-7995", "5 Jun 2023")).toBe(
      "No. 23-7995 (Vet. App. 2023)",
    );
  });
});
