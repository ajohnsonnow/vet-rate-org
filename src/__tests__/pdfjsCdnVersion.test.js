import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * C-H04: five PDF paths hardcoded the abandoned pdfjs-dist@4.0.379 CDN for
 * standard_fonts/cmaps while the installed worker is v5.x. v5 restructured the
 * font/cmap corpus, so mismatched v4 assets silently corrupt text extraction on
 * Type1/CIDFont PDFs (common in scanned DD214s / rating letters). The URLs must
 * now derive from the installed pdfjsLib.version so they can never drift again.
 */
const FILES = [
  "src/utils/advancedOCR.js",
  "src/utils/documentAnalyzer.js",
  "src/utils/pdfSearchEngine.js",
  "src/utils/pdfExtractor.js",
  "src/utils/florencePdfUtils.js",
];
const read = (p) => readFileSync(join(process.cwd(), p), "utf8");

describe("pdfjs CDN asset URLs track the installed version (C-H04)", () => {
  for (const f of FILES) {
    it(`${f} no longer pins the abandoned 4.0.379 corpus`, () => {
      expect(read(f)).not.toContain("pdfjs-dist@4.0.379");
    });

    it(`${f} derives the CDN URL from pdfjsLib.version`, () => {
      expect(read(f)).toMatch(/pdfjs-dist@\$\{pdfjsLib\.version\}/);
    });
  }
});
