/**
 * D22-1: reading a document must not keep its memory after it is done. The PDF
 * document and every page opened are released when the read ends (finished or
 * failed), and only a couple of pages are prepared (rendered and pixel
 * processed) at once instead of one per OCR worker. What is read must not
 * change at all: the exact result for a mixed document is pinned below.
 *
 * The PDF document, the canvas and Tesseract are the external boundaries and
 * are faked as in advancedOCR.blankPages.test.js; advancedPDFAnalysis is the
 * real code.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

const BASE_W = 40;
const BASE_H = 52;
const MIN_OCR_SCALE = 2.5;

const fake = vi.hoisted(() => ({
  pages: [],
  failGetPage: null,
  destroyed: 0,
  opened: new Set(),
  cleaned: new Set(),
  activePrep: 0,
  maxPrep: 0,
}));

function makeCanvas() {
  const canvas = {
    width: 0,
    height: 0,
    pix: null,
    tag: null,
    counted: false,
    remove: () => {},
    toDataURL: () => {
      if (canvas.counted) fake.activePrep--;
      canvas.counted = false;
      return `data:${canvas.tag}`;
    },
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
      canvas.tag = src.tag;
      canvas.counted = src.counted;
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

function paintScanned(canvas, pageNum) {
  canvas.pix = new Uint8ClampedArray(canvas.width * canvas.height * 4).fill(
    255,
  );
  for (let y = 4; y < canvas.height - 4; y += 3) {
    for (let x = 3; x < canvas.width - 3; x++) {
      const o = (y * canvas.width + x) * 4;
      canvas.pix[o] = canvas.pix[o + 1] = canvas.pix[o + 2] = 20;
    }
  }
  canvas.tag = `page-${pageNum}`;
}

async function renderFake(spec, n, { canvasContext, viewport }) {
  const counting = viewport.scale >= MIN_OCR_SCALE;
  if (counting) {
    fake.maxPrep = Math.max(fake.maxPrep, ++fake.activePrep);
    canvasContext.canvas.counted = true;
  }
  await new Promise((resolve) => setTimeout(resolve, 5));
  if (spec.kind === "scanned") {
    paintScanned(canvasContext.canvas, n);
    canvasContext.canvas.counted = counting;
  }
}

function makePage(n) {
  const spec = fake.pages[n - 1];
  fake.opened.add(n);
  return {
    cleanup: () => {
      fake.cleaned.add(n);
      return true;
    },
    getViewport: ({ scale }) => ({
      width: BASE_W * scale,
      height: BASE_H * scale,
      scale,
    }),
    getTextContent: async () => ({
      items: spec.items.map((str) => ({ str, hasEOL: false })),
    }),
    render: (args) => ({
      cancel: () => {},
      promise: renderFake(spec, n, args),
    }),
  };
}

vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: {},
  version: "0.0.0",
  getDocument: () => ({
    destroy: async () => {
      fake.destroyed++;
    },
    promise: Promise.resolve({
      numPages: fake.pages.length,
      getPage: async (n) => {
        if (n === fake.failGetPage) throw new Error("page load failed");
        return makePage(n);
      },
    }),
  }),
}));

vi.mock("tesseract.js", () => ({
  default: {
    PSM: { AUTO: 3 },
    createScheduler: () => ({
      addWorker: () => {},
      addJob: async (_op, dataUrl) => {
        const n = Number(/page-(\d+)/.exec(dataUrl)?.[1]);
        return {
          data: {
            text: `SCANNED PAGE ${n} body text read by the recognizer. `.repeat(
              4,
            ),
            confidence: 90,
          },
        };
      },
      terminate: async () => {},
    }),
    createWorker: async () => ({
      setParameters: async () => {},
      terminate: async () => {},
    }),
  },
}));

const { default: advancedPDFAnalysis } = await import("./advancedOCR");

const textPage = (label) => ({
  kind: "text",
  items: [`${label} lorem ipsum`, "dolor sit amet", "consectetur elit"],
});
const blankPage = () => ({ kind: "blank", items: [] });
const scannedPage = () => ({ kind: "scanned", items: [] });

const analyze = (pages, options = {}) => {
  fake.pages = pages;
  return advancedPDFAnalysis(
    new File([new Uint8Array(8)], "fixture.pdf"),
    options,
  );
};

beforeEach(() => {
  vi.restoreAllMocks();
  Object.assign(fake, {
    failGetPage: null,
    destroyed: 0,
    opened: new Set(),
    cleaned: new Set(),
    activePrep: 0,
    maxPrep: 0,
  });
  const realCreate = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation((name) =>
    name === "canvas" ? makeCanvas() : realCreate(name),
  );
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("advancedPDFAnalysis: what is read does not change", () => {
  it("returns exactly the same result for a mixed text, scanned and blank document", async () => {
    const result = await analyze([
      textPage("alpha"),
      scannedPage(),
      blankPage(),
      textPage("beta"),
      scannedPage(),
    ]);
    const { processingTime: _ignored, ...stable } = result;
    expect(stable).toMatchInlineSnapshot(`
      {
        "confidence": 90,
        "coverageNote": "Read all 5 page(s). 2 scanned page(s) were read with OCR. 1 blank page(s) (page 3) had nothing to read.",
        "letterheadText": "alpha lorem ipsum dolor sit amet consectetur elit ",
        "method": "advanced_ocr",
        "ocrUsed": true,
        "pageCount": 5,
        "pagesBlank": [
          3,
        ],
        "pagesFailed": [],
        "pagesOCRd": 2,
        "pagesRead": 5,
        "pagesSkipped": [],
        "strategy": "standard",
        "text": "--- PAGE 1 ---
      alpha lorem ipsum dolor sit amet consectetur elit

      --- PAGE 2 (OCR 90%) ---
      SCANNED PAGE 2 body text read by the recognizer. SCANNED PAGE 2 body text read by the recognizer. SCANNED PAGE 2 body text read by the recognizer. SCANNED PAGE 2 body text read by the recognizer.

      --- PAGE 3 (blank) ---

      --- PAGE 4 ---
      beta lorem ipsum dolor sit amet consectetur elit

      --- PAGE 5 (OCR 90%) ---
      SCANNED PAGE 5 body text read by the recognizer. SCANNED PAGE 5 body text read by the recognizer. SCANNED PAGE 5 body text read by the recognizer. SCANNED PAGE 5 body text read by the recognizer.

      ",
      }
    `);
  });

  it("returns exactly the same result for a text-only document", async () => {
    const result = await analyze([textPage("alpha"), textPage("beta")]);
    const { processingTime: _ignored, ...stable } = result;
    expect(stable).toMatchInlineSnapshot(`
      {
        "confidence": 100,
        "coverageNote": "Read all 2 page(s) - every page had a usable text layer.",
        "letterheadText": "alpha lorem ipsum dolor sit amet consectetur elit ",
        "method": "standard",
        "ocrUsed": false,
        "pageCount": 2,
        "pagesBlank": [],
        "pagesFailed": [],
        "pagesOCRd": 0,
        "pagesRead": 2,
        "pagesSkipped": [],
        "text": "--- PAGE 1 ---
      alpha lorem ipsum dolor sit amet consectetur elit

      --- PAGE 2 ---
      beta lorem ipsum dolor sit amet consectetur elit

      ",
      }
    `);
  });
});

describe("advancedPDFAnalysis: memory is released", () => {
  it("releases the document and every page it opened once the read finishes", async () => {
    await analyze([
      textPage("alpha"),
      scannedPage(),
      blankPage(),
      scannedPage(),
    ]);
    expect(fake.destroyed).toBe(1);
    expect(fake.opened.size).toBeGreaterThan(0);
    expect([...fake.cleaned].sort()).toEqual([...fake.opened].sort());
  });

  it("releases the document when the read fails part way", async () => {
    fake.failGetPage = 2;
    await expect(analyze([textPage("a"), textPage("b")])).rejects.toThrow(
      "page load failed",
    );
    expect(fake.destroyed).toBe(1);
  });

  it("prepares at most two pages at a time however many OCR workers there are, and still reads them all", async () => {
    vi.stubGlobal("navigator", {
      ...globalThis.navigator,
      hardwareConcurrency: 16,
    });
    const pages = Array.from({ length: 6 }, scannedPage);
    const result = await analyze(pages, { MAX_OCR_PAGES: 10 });
    vi.unstubAllGlobals();
    expect(fake.maxPrep).toBeGreaterThan(0);
    expect(fake.maxPrep).toBeLessThanOrEqual(2);
    expect(result.pagesOCRd).toBe(6);
    expect(result.pagesFailed).toEqual([]);
  });
});
