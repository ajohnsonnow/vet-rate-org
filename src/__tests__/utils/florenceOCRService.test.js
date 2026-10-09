/**
 * Tests for florenceOCRService.js
 *
 * Covers: WebGPU detection, service status, initialize lifecycle,
 * Worker message protocol (LOAD / ANALYZE / DOC_VQA), event listeners,
 * processDocument, askQuestion, processMultiplePages, and shutdown.
 *
 * Workers and WebGPU are mocked - no real GPU or Worker threads are used.
 * Module-level singleton state is reset between tests via vi.resetModules().
 */

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

// ── Worker mock (created once; shared instance is reset in beforeEach) ────────
const mockWorkerInstance = {
  postMessage: vi.fn(),
  terminate: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  onmessage: null,
  onerror: null,
};

// ── florencePdfUtils mock ─────────────────────────────────────────────────────
vi.mock("../../utils/florencePdfUtils", () => ({
  convertPdfPageToBlob: vi
    .fn()
    .mockResolvedValue(new Blob(["img"], { type: "image/jpeg" })),
  getPdfMetadata: vi.fn().mockResolvedValue({ numPages: 2 }),
  getOptimalScale: vi.fn().mockReturnValue(1.5),
  isPdfFile: vi.fn((f) => f?.name?.endsWith(".pdf") ?? false),
  isImageFile: vi.fn((f) => f?.type?.startsWith("image/") ?? false),
  imageFileToBlob: vi
    .fn()
    .mockResolvedValue(new Blob(["img"], { type: "image/jpeg" })),
}));

// ── dd214VisionParser mock ────────────────────────────────────────────────────
vi.mock("../../utils/dd214VisionParser", () => ({
  parseDD214Text: vi.fn().mockReturnValue({ fields: { name: "Doe, John" } }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────
/** Fake PDF file */
function makePdfFile(name = "doc.pdf") {
  return new File(["pdf content"], name, { type: "application/pdf" });
}

/** Fake image file */
function makeImageFile(name = "photo.jpg") {
  return new File(["img"], name, { type: "image/jpeg" });
}

/** Simulate a worker message with the given payload */
function simulateWorkerMessage(payload) {
  if (mockWorkerInstance.onmessage) {
    mockWorkerInstance.onmessage({ data: payload });
  }
}

/** Simulate a worker error event */
function simulateWorkerError(message = "worker crashed") {
  if (mockWorkerInstance.onerror) {
    mockWorkerInstance.onerror({ message });
  }
}

// ── State reset + re-import between tests ─────────────────────────────────────
let svc;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();

  Object.assign(mockWorkerInstance, {
    postMessage: vi.fn(),
    terminate: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    onmessage: null,
    onerror: null,
  });

  vi.stubGlobal(
    "Worker",
    vi.fn(function () {
      return mockWorkerInstance;
    }),
  );

  svc = await import("../../utils/florenceOCRService.js");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─────────────────────────────────────────────────────────────────────────────
describe("isWebGPUSupported", () => {
  /** Returns false when navigator.gpu is absent (default jsdom environment) */
  it("returns false when navigator.gpu is absent", () => {
    expect(svc.isWebGPUSupported()).toBe(false);
  });

  it("returns true when navigator.gpu is present", async () => {
    vi.resetModules();
    vi.stubGlobal("navigator", { ...navigator, gpu: {} });
    const fresh = await import("../../utils/florenceOCRService.js");
    expect(fresh.isWebGPUSupported()).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("getStatus", () => {
  /** Returns the correct shape with all expected fields */
  it("returns correct shape initially", () => {
    const status = svc.getStatus();
    expect(status).toHaveProperty("isSupported");
    expect(status).toHaveProperty("isInitializing");
    expect(status).toHaveProperty("isReady");
    expect(status).toHaveProperty("lastError");
  });

  it("isReady is false before initialization", () => {
    expect(svc.getStatus().isReady).toBe(false);
  });

  it("isInitializing is false before initialization", () => {
    expect(svc.getStatus().isInitializing).toBe(false);
  });

  it("lastError is null before initialization", () => {
    expect(svc.getStatus().lastError).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("initialize - without WebGPU", () => {
  /** initialize() must bail early and return false if WebGPU is unavailable */
  it("returns false when WebGPU is not supported", async () => {
    // navigator.gpu is absent by default in jsdom
    const result = await svc.initialize();
    expect(result).toBe(false);
  });

  it("sets lastError when WebGPU is not supported", async () => {
    await svc.initialize();
    expect(svc.getStatus().lastError).toBeTruthy();
  });

  it("does NOT create a Worker when WebGPU is absent", async () => {
    await svc.initialize();
    expect(Worker).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("initialize - with WebGPU", () => {
  /** initialize() with WebGPU present should send LOAD to worker and resolve */
  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal("navigator", { ...navigator, gpu: {} });
    Object.assign(mockWorkerInstance, {
      postMessage: vi.fn(),
      terminate: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      onmessage: null,
      onerror: null,
    });
    vi.stubGlobal(
      "Worker",
      vi.fn(function () {
        return mockWorkerInstance;
      }),
    );
    svc = await import("../../utils/florenceOCRService.js");
  });

  it("creates a Worker and sends LOAD message", async () => {
    const initPromise = svc.initialize();
    simulateWorkerMessage({ status: "ready" });
    await initPromise;
    expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith({
      type: "LOAD",
    });
  });

  it("returns true when worker emits ready", async () => {
    const initPromise = svc.initialize();
    simulateWorkerMessage({ status: "ready" });
    const result = await initPromise;
    expect(result).toBe(true);
  });

  it("sets isReady=true after ready message", async () => {
    const initPromise = svc.initialize();
    simulateWorkerMessage({ status: "ready" });
    await initPromise;
    expect(svc.getStatus().isReady).toBe(true);
  });

  it("returns false when worker emits error status", async () => {
    const initPromise = svc.initialize();
    simulateWorkerMessage({ status: "error", error: "OOM" });
    const result = await initPromise;
    expect(result).toBe(false);
  });

  it("sets lastError when worker emits error status", async () => {
    const initPromise = svc.initialize();
    simulateWorkerMessage({ status: "error", error: "OOM" });
    await initPromise;
    expect(svc.getStatus().lastError).toBe("OOM");
  });

  it("returns false when worker fires onerror", async () => {
    const initPromise = svc.initialize();
    simulateWorkerError("failed to load");
    const result = await initPromise;
    expect(result).toBe(false);
  });

  it("is idempotent - returns true immediately if already ready", async () => {
    const init1 = svc.initialize();
    simulateWorkerMessage({ status: "ready" });
    await init1;

    // Second call should return true without creating another Worker
    const result = await svc.initialize();
    expect(result).toBe(true);
    expect(Worker).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("event listeners", () => {
  /** addEventListener/removeEventListener should add/remove callbacks */
  it("addEventListener adds a callback that emit() calls", async () => {
    const cb = vi.fn();
    svc.addEventListener("error", cb);
    // Trigger error by calling initialize without WebGPU
    await svc.initialize();
    expect(cb).toHaveBeenCalled();
  });

  it("removeEventListener prevents callback from being called", async () => {
    const cb = vi.fn();
    svc.addEventListener("error", cb);
    svc.removeEventListener("error", cb);
    await svc.initialize();
    expect(cb).not.toHaveBeenCalled();
  });

  it("progress event is emitted when worker sends loading status", async () => {
    vi.resetModules();
    vi.stubGlobal("navigator", { ...navigator, gpu: {} });
    Object.assign(mockWorkerInstance, {
      postMessage: vi.fn(),
      terminate: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      onmessage: null,
      onerror: null,
    });
    vi.stubGlobal(
      "Worker",
      vi.fn(function () {
        return mockWorkerInstance;
      }),
    );
    svc = await import("../../utils/florenceOCRService.js");

    const progressCb = vi.fn();
    svc.addEventListener("progress", progressCb);

    const initPromise = svc.initialize();
    simulateWorkerMessage({ status: "loading", progress: 0.5, message: "50%" });
    simulateWorkerMessage({ status: "ready" });
    await initPromise;

    expect(progressCb).toHaveBeenCalledWith({ progress: 0.5, message: "50%" });
  });
});

/** Resets modules/mocks, stubs WebGPU, imports the service, and initializes it to "ready". */
async function setupReadyServiceWithWebGPU() {
  vi.resetModules();
  vi.stubGlobal("navigator", { ...navigator, gpu: {} });
  Object.assign(mockWorkerInstance, {
    postMessage: vi.fn(),
    terminate: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    onmessage: null,
    onerror: null,
  });
  vi.stubGlobal(
    "Worker",
    vi.fn(function () {
      return mockWorkerInstance;
    }),
  );
  svc = await import("../../utils/florenceOCRService.js");

  const initPromise = svc.initialize();
  simulateWorkerMessage({ status: "ready" });
  await initPromise;
}

// ─────────────────────────────────────────────────────────────────────────────
describe("processDocument", () => {
  /** processDocument() should validate file type and send ANALYZE to worker */
  beforeEach(setupReadyServiceWithWebGPU);

  it("rejects unsupported file types", async () => {
    const badFile = new File(["data"], "report.docx", {
      type: "application/msword",
    });
    await expect(svc.processDocument(badFile)).rejects.toThrow(
      "Unsupported file type",
    );
  });

  it("sends ANALYZE message with imageBlob for PDF files", async () => {
    const file = makePdfFile();

    // Simulate message handler registration then reply
    mockWorkerInstance.addEventListener.mockImplementation((evt, handler) => {
      if (evt === "message") {
        setTimeout(
          () => handler({ data: { status: "complete", text: "OCR text" } }),
          0,
        );
      }
    });

    await svc.processDocument(file);

    expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "ANALYZE",
        payload: expect.objectContaining({ imageBlob: expect.any(Blob) }),
      }),
    );
  });

  it("sends ANALYZE message with imageBlob for image files", async () => {
    const file = makeImageFile();

    mockWorkerInstance.addEventListener.mockImplementation((evt, handler) => {
      if (evt === "message") {
        setTimeout(
          () => handler({ data: { status: "complete", text: "OCR text" } }),
          0,
        );
      }
    });

    await svc.processDocument(file);

    expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "ANALYZE" }),
    );
  });

  it("resolves with text from worker complete message", async () => {
    const file = makeImageFile();

    mockWorkerInstance.addEventListener.mockImplementation((evt, handler) => {
      if (evt === "message") {
        setTimeout(
          () =>
            handler({
              data: { status: "complete", text: "Extracted text here" },
            }),
          0,
        );
      }
    });

    const result = await svc.processDocument(file);
    expect(result.text).toBe("Extracted text here");
  });

  it("rejects when worker sends error status", async () => {
    const file = makeImageFile();

    mockWorkerInstance.addEventListener.mockImplementation((evt, handler) => {
      if (evt === "message") {
        setTimeout(
          () => handler({ data: { status: "error", error: "Model failed" } }),
          0,
        );
      }
    });

    await expect(svc.processDocument(file)).rejects.toThrow("Model failed");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("askQuestion", () => {
  /** askQuestion() should send DOC_VQA with imageBlob + question to worker */
  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal("navigator", { ...navigator, gpu: {} });
    Object.assign(mockWorkerInstance, {
      postMessage: vi.fn(),
      terminate: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      onmessage: null,
      onerror: null,
    });
    vi.stubGlobal(
      "Worker",
      vi.fn(function () {
        return mockWorkerInstance;
      }),
    );
    svc = await import("../../utils/florenceOCRService.js");

    const initPromise = svc.initialize();
    simulateWorkerMessage({ status: "ready" });
    await initPromise;
  });

  it("rejects unsupported file types", async () => {
    const badFile = new File(["data"], "file.csv", { type: "text/csv" });
    await expect(svc.askQuestion(badFile, "What date?")).rejects.toThrow(
      "Unsupported file type",
    );
  });

  it("sends DOC_VQA message with imageBlob and question", async () => {
    const file = makeImageFile();

    mockWorkerInstance.addEventListener.mockImplementation((evt, handler) => {
      if (evt === "message") {
        setTimeout(
          () => handler({ data: { status: "complete", answer: "2023-01-01" } }),
          0,
        );
      }
    });

    await svc.askQuestion(file, "What is the separation date?");

    expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "DOC_VQA",
        payload: expect.objectContaining({
          imageBlob: expect.any(Blob),
          question: "What is the separation date?",
        }),
      }),
    );
  });

  it("resolves with answer from worker complete message", async () => {
    const file = makeImageFile();

    mockWorkerInstance.addEventListener.mockImplementation((evt, handler) => {
      if (evt === "message") {
        setTimeout(
          () => handler({ data: { status: "complete", answer: "2023-01-01" } }),
          0,
        );
      }
    });

    const result = await svc.askQuestion(file, "Date?");
    expect(result).toBe("2023-01-01");
  });

  it("rejects when worker sends error status", async () => {
    const file = makeImageFile();

    mockWorkerInstance.addEventListener.mockImplementation((evt, handler) => {
      if (evt === "message") {
        setTimeout(
          () => handler({ data: { status: "error", error: "VQA failed" } }),
          0,
        );
      }
    });

    await expect(svc.askQuestion(file, "Date?")).rejects.toThrow("VQA failed");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("processMultiplePages", () => {
  /** processMultiplePages() iterates pages and joins text with page-break separator */
  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal("navigator", { ...navigator, gpu: {} });
    Object.assign(mockWorkerInstance, {
      postMessage: vi.fn(),
      terminate: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      onmessage: null,
      onerror: null,
    });
    vi.stubGlobal(
      "Worker",
      vi.fn(function () {
        return mockWorkerInstance;
      }),
    );
    svc = await import("../../utils/florenceOCRService.js");

    const initPromise = svc.initialize();
    simulateWorkerMessage({ status: "ready" });
    await initPromise;

    // Mock addEventListener to auto-reply per call
    let callCount = 0;
    const pages = ["Page one text", "Page two text"];
    mockWorkerInstance.addEventListener.mockImplementation((evt, handler) => {
      if (evt === "message") {
        const text = pages[callCount % pages.length];
        callCount++;
        setTimeout(() => handler({ data: { status: "complete", text } }), 0);
      }
    });
  });

  it("rejects non-PDF files", async () => {
    const imgFile = makeImageFile();
    await expect(svc.processMultiplePages(imgFile)).rejects.toThrow(
      "only supports PDF",
    );
  });

  it("processes all pages from PDF metadata", async () => {
    const file = makePdfFile(); // getPdfMetadata returns { numPages: 2 }
    const result = await svc.processMultiplePages(file);
    expect(result.pages).toHaveLength(2);
  });

  it("combines text with --- Page Break --- separator", async () => {
    const file = makePdfFile();
    const result = await svc.processMultiplePages(file);
    expect(result.combinedText).toContain("--- Page Break ---");
  });

  it("calls onPageComplete after each page", async () => {
    const file = makePdfFile();
    const onPageComplete = vi.fn();
    await svc.processMultiplePages(file, { onPageComplete });
    expect(onPageComplete).toHaveBeenCalledTimes(2);
  });

  it("returns totalPages and processedPages in result", async () => {
    const file = makePdfFile();
    const result = await svc.processMultiplePages(file);
    expect(result).toHaveProperty("totalPages");
    expect(result).toHaveProperty("processedPages");
    expect(result.processedPages).toBe(2);
  });

  it("respects maxPages option", async () => {
    const file = makePdfFile(); // numPages = 2, maxPages = 1
    const result = await svc.processMultiplePages(file, { maxPages: 1 });
    expect(result.pages).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("shutdown", () => {
  /** shutdown() should terminate the worker and reset all state flags */
  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal("navigator", { ...navigator, gpu: {} });
    Object.assign(mockWorkerInstance, {
      postMessage: vi.fn(),
      terminate: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      onmessage: null,
      onerror: null,
    });
    vi.stubGlobal(
      "Worker",
      vi.fn(function () {
        return mockWorkerInstance;
      }),
    );
    svc = await import("../../utils/florenceOCRService.js");

    const initPromise = svc.initialize();
    simulateWorkerMessage({ status: "ready" });
    await initPromise;
  });

  it("calls worker.terminate()", () => {
    svc.shutdown();
    expect(mockWorkerInstance.terminate).toHaveBeenCalled();
  });

  it("sends UNLOAD message before terminating", () => {
    svc.shutdown();
    expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith({
      type: "UNLOAD",
    });
  });

  it("resets isReady to false", () => {
    svc.shutdown();
    expect(svc.getStatus().isReady).toBe(false);
  });

  it("resets isInitializing to false", () => {
    svc.shutdown();
    expect(svc.getStatus().isInitializing).toBe(false);
  });

  it("is safe to call when no worker exists", () => {
    svc.shutdown(); // first call
    expect(() => svc.shutdown()).not.toThrow(); // second call - no worker
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("florenceOCRService export object", () => {
  /** The default export should be an object with all public API methods */
  it("exports florenceOCRService with all expected methods", () => {
    expect(typeof svc.florenceOCRService.isWebGPUSupported).toBe("function");
    expect(typeof svc.florenceOCRService.getStatus).toBe("function");
    expect(typeof svc.florenceOCRService.initialize).toBe("function");
    expect(typeof svc.florenceOCRService.processDocument).toBe("function");
    expect(typeof svc.florenceOCRService.askQuestion).toBe("function");
    expect(typeof svc.florenceOCRService.processMultiplePages).toBe("function");
    expect(typeof svc.florenceOCRService.shutdown).toBe("function");
  });
});
