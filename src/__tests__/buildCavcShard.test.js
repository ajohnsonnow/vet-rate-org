import { describe, it, expect } from "vitest";
import {
  isGarbledText,
  hasRealDocket,
} from "../../scripts/dkb-sharding/build-cavc-shard.mjs";

/**
 * S43 — a second, distinct encoding defect found while verifying the
 * WordPerfect-sniffing fix: a handful of older PDFs have a custom embedded
 * font with no usable ToUnicode CMap, so pdf.js returns shifted glyph-index
 * garbage instead of real text. Root-caused against two real fetched records
 * (measured >20% control-byte density vs. 0% for every clean decision) —
 * these fixtures mirror that real shape, not a synthetic guess.
 */
describe("isGarbledText", () => {
  it("flags text dominated by control bytes (shifted glyph-index extraction)", () => {
    // Real shape observed: "UNITED STATES COURT..." extracted with every
    // byte shifted, producing runs of \x03/\x0e/\x1f-range control chars.
    const garbled = "81,7('67$7(6&28572)$33($/6";
    expect(isGarbledText(garbled)).toBe(true);
  });

  it("does not flag clean legal prose", () => {
    const clean =
      "UNITED STATES COURT OF APPEALS FOR VETERANS CLAIMS\n\nNo. 23-7995\n\n" +
      "ORDER: The Board's decision is AFFIRMED.".repeat(5);
    expect(isGarbledText(clean)).toBe(false);
  });

  it("does not flag legitimate whitespace (tabs/newlines/CRLF)", () => {
    const whitespaceHeavy =
      "Line one.\r\n\tIndented line two.\r\n\r\nParagraph.".repeat(20);
    expect(isGarbledText(whitespaceHeavy)).toBe(false);
  });

  it("treats empty text as not garbled (a different skip path handles empty)", () => {
    expect(isGarbledText("")).toBe(false);
  });
});

describe("hasRealDocket", () => {
  it("accepts a real docket-shaped citation", () => {
    expect(hasRealDocket("No. 16-2993 (Vet. App. 1992)")).toBe(true);
    expect(hasRealDocket("No. 17-298E (Vet. App. 2018)")).toBe(true);
  });

  it("rejects a citation that leaked a raw archive file path", () => {
    expect(
      hasRealDocket(
        "No. C:\\USCAVC_Docs\\PANEL.CVA\\SellersRM_16-2993 (10-27-20).pdf (Vet. App. 2020)",
      ),
    ).toBe(false);
  });

  it("rejects a directory-listing artifact citation", () => {
    expect(
      hasRealDocket(
        "No. C:\\USCAVC_Docs\\PANEL.CVA\\list\\R.LST (Vet. App. 2000)",
      ),
    ).toBe(false);
  });

  it("rejects a citation with no docket at all", () => {
    expect(hasRealDocket("No. .\\ (Vet. App. 2000)")).toBe(false);
  });
});
