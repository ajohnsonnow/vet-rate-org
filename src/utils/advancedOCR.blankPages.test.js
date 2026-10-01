/**
 * D20-1: a blank page inside a text PDF has zero text items, so the
 * image-only check sent it to Tesseract; a blank page measures low-contrast
 * and was classified "severely aged" (maximum-strength ensemble, ~85 s per
 * page), which turned a 9 minute import into 36. A blank page must be
 * detected cheaply and skipped, real scanned pages must still be OCR'd, every
 * text-layer page must still be read, and no OCR promise may hang.
 *
 * The PDF document, the canvas and Tesseract are the external boundaries
 * and are faked; advancedPDFAnalysis itself (page classification, blank
 * detection, preprocessing, merge, coverage) is the real code.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

const BASE_W = 40;
const BASE_H = 52;

const fake = vi.hoisted(() => ({
  pages: [],
  failRenderAboveScale: Infinity,
  hangAtScale: null,
  cancelRender: null,
  createWorker: null,
  addJob: null,
  terminate: null,
}));

const SCANNED_TEXT = (n) =>
  `SCANNED PAGE ${n} body text read by the recognizer. `.repeat(4);

function makeCanvas() {
  const canvas = {
    width: 0,
    height: 0,
    pix: null,
    tag: null,
    remove: () => {},
    toDataURL: () => `data:${canvas.tag}`,
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

function makePage(n) {
  const spec = fake.pages[n - 1];
  return {
    getViewport: ({ scale }) => ({
      width: BASE_W * scale,
      height: BASE_H * scale,
      scale,
    }),
    getTextContent: async () => ({
      items: spec.items.map((str) => ({ str, hasEOL: false })),
    }),
    render: ({ canvasContext, viewport }) => ({
      cancel: () => fake.cancelRender?.(),
      promise: (async () => {
        if (viewport.scale === fake.hangAtScale) await new Promise(() => {});
        if (viewport.scale > fake.failRenderAboveScale) {
          throw new RangeError("Array buffer allocation failed");
        }
        if (spec.kind === "scanned") paintScanned(canvasContext.canvas, n);
      })(),
    }),
  };
}

vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: {},
  version: "0.0.0",
  getDocument: () => ({
    promise: Promise.resolve({
      numPages: fake.pages.length,
      getPage: async (n) => makePage(n),
    }),
  }),
}));

vi.mock("tesseract.js", () => ({
  default: {
    PSM: { AUTO: 3 },
    createScheduler: () => ({
      addWorker: () => {},
      addJob: (...args) => fake.addJob(...args),
      terminate: () => fake.terminate(),
    }),
    createWorker: (...args) => fake.createWorker(...args),
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
  fake.failRenderAboveScale = Infinity;
  fake.hangAtScale = null;
  fake.cancelRender = vi.fn();
  fake.createWorker = vi.fn().mockResolvedValue({
    setParameters: async () => {},
    terminate: async () => {},
  });
  fake.addJob = vi.fn(async (_op, dataUrl) => {
    const n = Number(/page-(\d+)/.exec(dataUrl)?.[1]);
    return { data: { text: SCANNED_TEXT(n), confidence: 90 } };
  });
  fake.terminate = vi.fn().mockResolvedValue(undefined);
  const realCreate = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation((name) =>
    name === "canvas" ? makeCanvas() : realCreate(name),
  );
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("advancedPDFAnalysis: text PDFs with blank pages", () => {
  it("never starts OCR for a text PDF whose other pages are blank, and reports them as blank", async () => {
    const pages = [
      textPage("alpha"),
      blankPage(),
      textPage("beta"),
      blankPage(),
      blankPage(),
      blankPage(),
    ];
    const started = Date.now();
    const result = await analyze(pages);

    expect(Date.now() - started).toBeLessThan(2000);
    expect(fake.createWorker).not.toHaveBeenCalled();
    expect(fake.addJob).not.toHaveBeenCalled();
    expect(result.ocrUsed).toBe(false);
    expect(result.pagesOCRd).toBe(0);
    expect(result.pagesBlank).toEqual([2, 4, 5, 6]);
    expect(result.pagesSkipped).toEqual([]);
    expect(result.pagesRead).toBe(6);
    expect(result.text).toContain("alpha lorem ipsum");
    expect(result.text).toContain("beta lorem ipsum");
    expect(result.coverageNote).toMatch(/4 blank page\(s\)/);
    expect(result.coverageNote).not.toMatch(/scanned page\(s\) were OCR/);
  });

  it("still reads every text-layer page of a text-only PDF without any rendering", async () => {
    const result = await analyze([textPage("one"), textPage("two")]);
    expect(result.pagesRead).toBe(2);
    expect(result.text).toContain("one lorem ipsum");
    expect(result.text).toContain("two lorem ipsum");
    expect(fake.createWorker).not.toHaveBeenCalled();
  });
});

describe("advancedPDFAnalysis: real scanned pages are still OCR'd", () => {
  it("OCRs the scanned page, skips the blank one, keeps the text pages", async () => {
    const result = await analyze([
      textPage("alpha"),
      blankPage(),
      scannedPage(),
      blankPage(),
    ]);

    expect(result.pagesBlank).toEqual([2, 4]);
    expect(result.pagesOCRd).toBe(1);
    expect(result.ocrUsed).toBe(true);
    expect(fake.addJob).toHaveBeenCalledTimes(1);
    expect(result.text).toContain("alpha lorem ipsum");
    expect(result.text).toContain(SCANNED_TEXT(3).trim().slice(0, 60));
    expect(result.text).toContain("--- PAGE 2 (blank) ---");
    expect(result.coverageNote).toMatch(/1 scanned page\(s\) were read/);
    expect(result.coverageNote).toMatch(/2 blank page\(s\)/);
  });

  it("OCRs every page of an all-scanned PDF", async () => {
    const result = await analyze([scannedPage(), scannedPage(), scannedPage()]);
    expect(result.pagesOCRd).toBe(3);
    expect(result.pagesBlank).toEqual([]);
    for (const n of [1, 2, 3]) {
      expect(result.text).toContain(`SCANNED PAGE ${n} body text`);
    }
    expect(result.coverageNote).toBe(
      "Read all 3 page(s). 3 scanned page(s) were read with OCR.",
    );
  });

  it("never uses the severely-aged strategy for a document whose scanned page has content", async () => {
    const result = await analyze([blankPage(), blankPage(), scannedPage()]);
    expect(result.strategy).not.toBe("severely_aged");
    expect(result.pagesBlank).toEqual([1, 2]);
  });
});

describe("advancedPDFAnalysis: coverage wording when pages are skipped", () => {
  it("does not claim the whole document was read, and gives a plain continue sentence", async () => {
    const result = await analyze(
      [textPage("a"), scannedPage(), scannedPage(), scannedPage()],
      { MAX_OCR_PAGES: 1 },
    );

    expect(result.pagesSkipped).toEqual([3, 4]);
    expect(result.pagesRead).toBe(2);
    expect(result.coverageNote).toMatch(/^Read 2 of 4 page\(s\)\./);
    expect(result.coverageNote).not.toMatch(/ocrOnlyPageNumbers/);
    expect(result.coverageNote).toMatch(/pages 3-4/);
    expect(result.coverageNote).toMatch(
      /only 1 scanned pages are read at a time/,
    );
    expect(result.coverageNote).not.toMatch(/Read remaining pages/);
  });

  it("readAllPages lifts the scan limit so the continue action reads the rest", async () => {
    const result = await analyze(
      [scannedPage(), scannedPage(), scannedPage()],
      { MAX_OCR_PAGES: 1, readAllPages: true },
    );
    expect(result.pagesSkipped).toEqual([]);
    expect(result.pagesOCRd).toBe(3);
  });
});

describe("advancedPDFAnalysis: failures are recoverable and nothing hangs", () => {
  it("retries a page whose high-scale render fails to allocate at the lowest scale", async () => {
    fake.failRenderAboveScale = 3;
    const result = await analyze([scannedPage(), textPage("tail")]);
    expect(result.pagesOCRd).toBe(1);
    expect(result.pagesSkipped).toEqual([]);
    expect(result.text).toContain("SCANNED PAGE 1 body text");
    expect(result.text).toContain("tail lorem ipsum");
  });

  it("reports a page it truly cannot read as not read instead of throwing", async () => {
    fake.failRenderAboveScale = 0.1;
    const result = await analyze([textPage("keep"), scannedPage()]);
    expect(result.pagesFailed).toEqual([2]);
    expect(result.pagesSkipped).toEqual([2]);
    expect(result.pagesRead).toBe(1);
    expect(result.text).toContain("keep lorem ipsum");
    expect(result.text).toContain("NOT READ");
    expect(result.coverageNote).toMatch(/could not be read/);
  });

  it("reports confidence 0, not a perfect read, when no page could be read at all", async () => {
    fake.failRenderAboveScale = 0.1;
    const result = await analyze([scannedPage(), scannedPage()]);
    expect(result.pagesRead).toBe(0);
    expect(result.pagesFailed).toEqual([1, 2]);
    expect(result.confidence).toBe(0);
  });

  it("does not hang when an OCR job never settles: the page is reported and the workers are torn down", async () => {
    fake.addJob = vi.fn(() => new Promise(() => {}));
    const result = await analyze([textPage("keep"), scannedPage()], {
      OCR_PAGE_TIMEOUT_MS: 50,
    });
    expect(result.pagesFailed).toEqual([2]);
    expect(result.text).toContain("keep lorem ipsum");
    expect(fake.terminate).toHaveBeenCalledTimes(1);
  });

  it("does not hang when the OCR engine never starts: text pages are still returned", async () => {
    fake.createWorker = vi.fn(() => new Promise(() => {}));
    const result = await analyze([textPage("keep"), scannedPage()], {
      OCR_WORKER_START_TIMEOUT_MS: 50,
    });
    expect(result.pagesFailed).toEqual([2]);
    expect(result.text).toContain("keep lorem ipsum");
  });

  it("does not hang when the strategy-detection render never settles: it is cancelled and OCR still runs", async () => {
    fake.hangAtScale = 1.5;
    const result = await analyze([scannedPage()], {
      OCR_PAGE_TIMEOUT_MS: 50,
    });
    expect(fake.cancelRender).toHaveBeenCalledTimes(1);
    expect(result.pagesOCRd).toBe(1);
    expect(result.strategy).toBe("standard");
  });

  it("does not hang when worker teardown never settles", async () => {
    fake.terminate = vi.fn(() => new Promise(() => {}));
    const result = await analyze([scannedPage()], {
      OCR_CLEANUP_TIMEOUT_MS: 50,
    });
    expect(result.pagesOCRd).toBe(1);
  });
});

const W = 459;
const H = 594;
const page = (paper = 255) => {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) data.set([paper, paper, paper, 255], i * 4);
  return { data, width: W, height: H };
};
const rect = (img, x, y, w, h, lum) => {
  for (let r = y; r < y + h; r++) {
    for (let c = x; c < x + w; c++) {
      img.data.set([lum, lum, lum, 255], (r * W + c) * 4);
    }
  }
};
const textLine = (img, y, lum) => {
  for (let k = 0; k < 20; k++) rect(img, 40 + k * 5, y, 2, 8, lum);
};
const grain = (img, amplitude) => {
  let seed = 12345;
  for (let i = 0; i < W * H; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const v = img.data[i * 4] + ((seed >> 8) % (2 * amplitude + 1)) - amplitude;
    img.data.set([v, v, v], i * 4);
  }
};
const dust = (img, count) => {
  for (let k = 0; k < count; k++) {
    rect(img, 7 + (k % 40) * 11, 9 + Math.floor(k / 40) * 13, 2, 2, 110);
  }
};
const edgeShadow = (img) => {
  for (let c = 0; c < 40; c++) {
    const v = Math.round(150 + (c / 40) * 105);
    for (let r = 0; r < H; r++) img.data.set([v, v, v], (r * W + c) * 4);
  }
};

describe("measureInkFraction / blank threshold", () => {
  it("measures a perfectly blank page (and a transparent canvas) as having no ink", async () => {
    const { measureInkFraction } = await import("./advancedOCR");
    expect(measureInkFraction(page())).toBe(0);
    expect(measureInkFraction({ data: new Uint8ClampedArray(4000 * 4) })).toBe(
      0,
    );
  });

  it("does not take a faint scan (text ~35 levels darker than the paper) for blank", async () => {
    const { measureInkFraction, BLANK_PAGE_MAX_INK_FRACTION } =
      await import("./advancedOCR");
    const faint = page(240);
    textLine(faint, 100, 205);
    expect(measureInkFraction(faint)).toBeGreaterThan(
      BLANK_PAGE_MAX_INK_FRACTION,
    );
  });

  it("does not take a page with one short line of dark text for blank", async () => {
    const { measureInkFraction, BLANK_PAGE_MAX_INK_FRACTION } =
      await import("./advancedOCR");
    const oneLine = page();
    textLine(oneLine, 300, 30);
    expect(measureInkFraction(oneLine)).toBeGreaterThan(
      BLANK_PAGE_MAX_INK_FRACTION,
    );
  });

  it("treats a scanned blank with paper grain, dust specks and an edge shadow as blank", async () => {
    const { measureInkFraction, BLANK_PAGE_MAX_INK_FRACTION } =
      await import("./advancedOCR");
    const blank = page(250);
    grain(blank, 4);
    dust(blank, 130);
    edgeShadow(blank);
    expect(measureInkFraction(blank)).toBeLessThanOrEqual(
      BLANK_PAGE_MAX_INK_FRACTION,
    );
  });

  it("still finds a text line on a grainy, dusty, shadowed scan", async () => {
    const { measureInkFraction, BLANK_PAGE_MAX_INK_FRACTION } =
      await import("./advancedOCR");
    const scan = page(250);
    textLine(scan, 300, 120);
    grain(scan, 4);
    dust(scan, 130);
    edgeShadow(scan);
    expect(measureInkFraction(scan)).toBeGreaterThan(
      BLANK_PAGE_MAX_INK_FRACTION,
    );
  });
});
