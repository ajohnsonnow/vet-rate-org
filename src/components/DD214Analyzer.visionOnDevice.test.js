/**
 * ADR-009 §4: SmolVLM's vision path runs entirely in-browser (transformers.js
 * v3 + WebGPU) - "unconditionally on-device by construction" per the ADR
 * text. But _runVisionAnalysis's return object never set `onDevice`, and
 * every consumer (the parser track's response?.onDevice check, and
 * generally "anything other than a strict true is off-device") treats a
 * response missing that flag as off-device - so a genuinely on-device
 * SmolVLM read of a DD-214 lost decision E's on-device-identifier-extraction
 * benefit on exactly the path most likely to read printed identifiers.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("../utils/documentAnalyzer", () => ({
  OCR_STATES: { LOADING: "LOADING" },
  getProgressStyling: () => ({}),
  formatFileSize: (bytes) => `${bytes} bytes`,
  isFileSupported: () => true,
  getAcceptString: () => "",
}));
vi.mock("../utils/musterCallProcessor", () => ({
  processFormationDocument: vi.fn(),
  PROCESSING_STATES: { EXTRACTING: "EXTRACTING", COMPLETE: "COMPLETE" },
}));
vi.mock("../utils/smolVLMService", () => ({
  smolVLMService: {
    initialize: vi.fn().mockResolvedValue(true),
    processMultiplePages: vi.fn().mockResolvedValue({
      combinedText: '{"branch":"Army"}',
    }),
  },
  isSmolVLMSupported: () => true,
}));

import { _runVisionAnalysis } from "./DD214Analyzer.jsx";

describe("_runVisionAnalysis", () => {
  it("marks its response onDevice: true - SmolVLM is always in-browser", async () => {
    const setOcrProgress = vi.fn();
    const pdfFile = new File(["fake"], "dd214.pdf", {
      type: "application/pdf",
    });

    const result = await _runVisionAnalysis([pdfFile], setOcrProgress);

    expect(result.onDevice).toBe(true);
    expect(result.isVisionResponse).toBe(true);
    expect(result.content).toBe('{"branch":"Army"}');
  });
});
