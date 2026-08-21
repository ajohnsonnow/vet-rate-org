import { describe, it, expect } from "vitest";

import { classifyDocument, DOCUMENT_TYPES } from "./documentClassifier";

describe("documentClassifier: classifyDocument", () => {
  it("classifies a real Blue Button export cover page", () => {
    const text =
      "VA Blue Button (R) Report\n" +
      "This report includes key information from your VA medical records.\n" +
      "My HealtheVet\n";
    const result = classifyDocument(text, "blue-button.pdf");
    expect(result.type).toBe(DOCUMENT_TYPES.BLUE_BUTTON);
  });

  it("does not hang on a large document where the Blue Button pattern almost-but-never matches (regression: ReDoS)", () => {
    // Stresses the BLUE_BUTTON /BLUE\s+BUTTON\s*(?:(R)|\(R\))?\s+REPORT/i
    // pattern's adjacent \s*/\s+ quantifiers with a filler that never
    // reaches "REPORT". classifyDocument only ever scans a bounded
    // excerpt (buildClassificationSample caps at 10,000-30,000 chars)
    // regardless of raw input length, so this also proves that bound holds.
    const pathological = `BLUE BUTTON${" ".repeat(200000)}`;
    const start = Date.now();
    const result = classifyDocument(pathological, "large.pdf");
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(1000);
    expect(result).toBeDefined();
  });
});
