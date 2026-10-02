/**
 * D21-6: two OCR steps could still wait forever - reading a page's text layer
 * (getTextContent) and the pixel preprocessing before recognition. Both are
 * now bounded: a stalled text read sends that page to OCR, and a stalled
 * preprocessing pass reports that page as not read instead of freezing the
 * document. The PDF, canvas and Tesseract are faked as in
 * advancedOCR.blankPages.test.js; advancedPDFAnalysis is the real code.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

const BASE_W = 40;
const BASE_H = 52;

const fake = vi.hoisted(() => ({ hangTextContent: false }));

function makeCanvas() {
  const canvas = {
    width: 0,
    height: 0,
    pix: null,
    remove: () => {},
    toDataURL: () => "data:page-1",
  };
  const alloc = () => {
    if (canvas.pix?.length !== canvas.width * canvas.height * 4) {
      canvas.pix = new Uint8ClampedArray(canvas.width * canvas.height * 4);
    }
  };
  canvas.getContext = () => ({
    canvas,
    fillRect: () => {
      alloc();
      canvas.pix.fill(255);
    },
    drawImage: (src) => {
      canvas.pix = new Uint8ClampedArray(src.pix);
    },
    getImageData: () => {
      alloc();
      return {
        width: canvas.width,
        height: canvas.height,
        data: new Uint8ClampedArray(canvas.pix),
      };
    },
    putImageData: (img) => {
      canvas.pix = img.data;
    },
  });
  return canvas;
}

function paintScanned(canvas) {
  canvas.pix = new Uint8ClampedArray(canvas.width * canvas.height * 4).fill(
    255,
  );
  for (let y = 4; y < canvas.height - 4; y += 3) {
    for (let x = 3; x < canvas.width - 3; x++) {
      const o = (y * canvas.width + x) * 4;
      canvas.pix[o] = canvas.pix[o + 1] = canvas.pix[o + 2] = 20;
    }
  }
}

const scannedPage = () => ({
  getViewport: ({ scale }) => ({
    width: BASE_W * scale,
    height: BASE_H * scale,
    scale,
  }),
  getTextContent: () =>
    fake.hangTextContent
      ? new Promise(() => {})
      : Promise.resolve({ items: [] }),
  render: ({ canvasContext }) => ({
    cancel: () => {},
    promise: (async () => paintScanned(canvasContext.canvas))(),
  }),
});

vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: {},
  version: "0.0.0",
  getDocument: () => ({
    promise: Promise.resolve({
      numPages: 1,
      getPage: async () => scannedPage(),
    }),
  }),
}));

vi.mock("tesseract.js", () => ({
  default: {
    PSM: { AUTO: 3 },
    createScheduler: () => ({
      addWorker: () => {},
      addJob: async () => ({
        data: {
          text: "SCANNED PAGE 1 body text read by the recognizer.",
          confidence: 90,
        },
      }),
      terminate: async () => {},
    }),
    createWorker: async () => ({
      setParameters: async () => {},
      terminate: async () => {},
    }),
  },
}));

const { default: advancedPDFAnalysis } = await import("./advancedOCR");

const analyze = (options = {}) =>
  advancedPDFAnalysis(new File([new Uint8Array(8)], "fixture.pdf"), options);

beforeEach(() => {
  fake.hangTextContent = false;
  const realCreate = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation((name) =>
    name === "canvas" ? makeCanvas() : realCreate(name),
  );
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("advancedPDFAnalysis: no text read or preprocessing step waits forever", () => {
  it("sends a page whose text read never finishes to OCR instead of hanging", async () => {
    fake.hangTextContent = true;

    const result = await analyze({ TEXT_CONTENT_TIMEOUT_MS: 50 });

    expect(result.pagesOCRd).toBe(1);
    expect(result.text).toContain("SCANNED PAGE 1 body text");
  }, 10_000);

  it("reports a page whose preprocessing never finishes as not read, and still returns", async () => {
    vi.stubGlobal(
      "MessageChannel",
      class {
        port1 = { postMessage: () => {} };
        port2 = {};
      },
    );

    const result = await analyze({ PREPROCESS_TIMEOUT_MS: 50 });

    expect(result.pagesFailed).toEqual([1]);
    expect(result.pagesRead).toBe(0);
    expect(result.text).toContain("NOT READ");
  }, 10_000);
});
