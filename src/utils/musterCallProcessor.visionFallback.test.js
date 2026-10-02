/**
 * D21-6: the vision fallback ran on every scan because the OCR's confidence
 * never reached the caller (analyzeDocument dropped it, the caller read it as
 * 0%), and under load a tab froze after the vision call. It must run only when
 * the OCR genuinely read poorly, and a vision model that cannot answer in time
 * must be given up on (and torn down), never waited on. The OCR engine and the
 * vision service are the only fakes; analyzeDocument and the processor are real.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

vi.mock("./ocr", async (importOriginal) => ({
  ...(await importOriginal()),
  analyzePDF: vi.fn(),
}));

vi.mock("./florenceOCRService", async (importOriginal) => ({
  ...(await importOriginal()),
  isWebGPUSupported: () => true,
  florenceOCRService: {
    initialize: vi.fn(),
    processDocument: vi.fn(),
    shutdown: vi.fn(),
  },
}));

const DD214_TEXT = `
DD FORM 214 CERTIFICATE OF RELEASE OR DISCHARGE FROM ACTIVE DUTY
1. NAME (LAST, FIRST, MIDDLE): DOE, JANE
2. DEPARTMENT, COMPONENT AND BRANCH: ARMY/ACTIVE
4A. GRADE, RATE OR RANK: SGT
12A. DATE ENTERED ACTIVE DUTY THIS PERIOD: 20020305
12B. SEPARATION DATE THIS PERIOD: 20100615
24. CHARACTER OF SERVICE: HONORABLE
`;

let ocr;
let florence;
let processFormationDocument;

const scan = (confidence) => ({
  text: DD214_TEXT,
  pageCount: 1,
  method: "advanced_ocr",
  ocrUsed: true,
  confidence,
});

const pdf = (name = "generic-scan.pdf") =>
  new File([DD214_TEXT], name, { type: "application/pdf" });

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  ocr = await import("./ocr");
  florence = (await import("./florenceOCRService")).florenceOCRService;
  ({ processFormationDocument } = await import("./musterCallProcessor"));
  for (const fn of [ocr.analyzePDF, ...Object.values(florence)]) fn.mockReset();
  florence.initialize.mockResolvedValue(true);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the vision fallback runs only when OCR genuinely read poorly", () => {
  it.each([60, 72, 89])(
    "does not run when OCR read at %i%% (the real value, not a false 0%%)",
    async (confidence) => {
      ocr.analyzePDF.mockResolvedValue(scan(confidence));

      const result = await processFormationDocument(pdf(), () => {});

      expect(florence.processDocument).not.toHaveBeenCalled();
      expect(result.confidence).toBe(confidence);
    },
  );

  it.each([46, 59])(
    "runs when OCR genuinely read at %i%%",
    async (confidence) => {
      ocr.analyzePDF.mockResolvedValue(scan(confidence));
      florence.processDocument.mockResolvedValue({
        text: "",
        parsedData: null,
      });

      const result = await processFormationDocument(pdf(), () => {});

      expect(florence.processDocument).toHaveBeenCalledTimes(1);
      expect(result.confidence).toBe(confidence);
      expect(result.visionUsed).toBe(false);
    },
  );

  it("does not run when the extractor reports no confidence at all (unknown is not 0%)", async () => {
    ocr.analyzePDF.mockResolvedValue({
      ...scan(undefined),
      confidence: undefined,
    });

    const result = await processFormationDocument(pdf(), () => {});

    expect(florence.processDocument).not.toHaveBeenCalled();
    expect(result.status).toBe("complete");
    expect(result.confidence).toBeNull();
  });
});

describe("a vision model that never answers cannot hold the import", () => {
  it("is given up on after its bound, torn down, and not tried again for later scans", async () => {
    vi.useFakeTimers();
    ocr.analyzePDF.mockResolvedValue(scan(40));
    florence.processDocument.mockImplementation(() => new Promise(() => {}));

    const first = processFormationDocument(pdf("first.pdf"), () => {});
    await vi.advanceTimersByTimeAsync(151_000);
    const firstResult = await first;

    expect(firstResult.status).toBe("complete");
    expect(firstResult.visionUsed).toBe(false);
    expect(florence.shutdown).toHaveBeenCalledTimes(1);

    const second = processFormationDocument(pdf("second.pdf"), () => {});
    await vi.advanceTimersByTimeAsync(5000);
    const secondResult = await second;

    expect(secondResult.status).toBe("complete");
    expect(florence.processDocument).toHaveBeenCalledTimes(1);
  });

  it("gives up on a model load that never finishes", async () => {
    vi.useFakeTimers();
    ocr.analyzePDF.mockResolvedValue(scan(40));
    florence.initialize.mockImplementation(() => new Promise(() => {}));

    const pending = processFormationDocument(pdf(), () => {});
    await vi.advanceTimersByTimeAsync(181_000);
    const result = await pending;

    expect(result.status).toBe("complete");
    expect(florence.shutdown).toHaveBeenCalledTimes(1);
  });
});
