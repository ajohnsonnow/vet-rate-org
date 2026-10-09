/**
 * D20-4: florenceOCRService logged the worker's whole response, the OCR text
 * and its first 500 characters to the browser console - a DD-214's name, SSN
 * and addresses in a place bug reports and screenshots capture. Only counts
 * and types may be logged. The worker and the image conversion are the
 * external boundaries and are faked; processDocument's own message handling
 * is real.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { inspect } from "node:util";

vi.mock("./florencePdfUtils", () => ({
  convertPdfPageToBlob: vi.fn(),
  getPdfMetadata: vi.fn(),
  getOptimalScale: vi.fn(),
  isPdfFile: () => false,
  isImageFile: () => true,
  imageFileToBlob: async () => new Blob(["x"]),
}));

const FAKE_NAME = "QUILLFEATHER, ZEPHANIA MORTIMER";
const FAKE_SSN = "987-65-4321";
const OCR_TEXT = `1. NAME: ${FAKE_NAME}\n3. SOCIAL SECURITY: ${FAKE_SSN}\nZXQ-MARKER-9981 body`;

class FakeWorker {
  constructor() {
    this.listeners = new Set();
  }
  addEventListener(_type, fn) {
    this.listeners.add(fn);
  }
  removeEventListener(_type, fn) {
    this.listeners.delete(fn);
  }
  terminate() {}
  postMessage(message) {
    queueMicrotask(() => {
      if (message.type === "LOAD") {
        this.onmessage({ data: { status: "ready" } });
      } else {
        for (const fn of this.listeners) {
          fn({ data: { status: "complete", text: OCR_TEXT } });
        }
      }
    });
  }
}

beforeEach(() => {
  vi.stubGlobal("Worker", FakeWorker);
  Object.defineProperty(globalThis.navigator, "gpu", {
    value: {},
    configurable: true,
  });
});

function loggedText(spies) {
  return spies
    .flatMap((spy) => spy.mock.calls)
    .map((args) => args.map((a) => inspect(a, { depth: 6 })).join(" "))
    .join("\n");
}

describe("florenceOCRService.processDocument: console output", () => {
  it("never logs the OCR text or the identifiers in it", async () => {
    const spies = ["log", "info", "warn", "error", "debug"].map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    );
    const { processDocument } = await import("./florenceOCRService");

    const result = await processDocument(
      new File(["x"], "scan.png", { type: "image/png" }),
      { parseDD214: true },
    );

    expect(result.text).toBe(OCR_TEXT);
    const output = loggedText(spies);
    expect(output.length).toBeGreaterThan(0);
    for (const secret of ["QUILLFEATHER", "ZEPHANIA", FAKE_SSN, "ZXQ-MARKER"]) {
      expect(output).not.toContain(secret);
    }
  });
});
