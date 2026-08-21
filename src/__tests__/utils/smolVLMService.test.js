/**
 * Tests for smolVLMService.js
 *
 * Covers: WebGPU detection, service status, initialize lifecycle,
 * Worker message protocol (LOAD / ANALYZE), streaming token callbacks,
 * event listeners, analyzeImage, processMultiplePages, and shutdown.
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

// ── Helpers ───────────────────────────────────────────────────────────────────
function makePdfFile(name = "doc.pdf") {
  return new File(["pdf content"], name, { type: "application/pdf" });
}

function makeImageFile(name = "photo.jpg") {
  return new File(["img"], name, { type: "image/jpeg" });
}

function simulateWorkerMessage(payload) {
  if (mockWorkerInstance.onmessage) {
    mockWorkerInstance.onmessage({ data: payload });
  }
}

function simulateWorkerError(message = "worker crashed") {
  if (mockWorkerInstance.onerror) {
    mockWorkerInstance.onerror({ message });
  }
}

async function setupSmolVLMModule() {
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
  return import("../../utils/smolVLMService.js");
}

async function setupReadySmolVLMModule() {
  const service = await setupSmolVLMModule();
  const initPromise = service.initialize();
  simulateWorkerMessage({ status: "ready" });
  await initPromise;
  return service;
}

function mockWorkerReply(...messages) {
  mockWorkerInstance.addEventListener.mockImplementation((evt, handler) => {
    if (evt === "message") {
      setTimeout(() => {
        messages.forEach((data) => handler({ data }));
      }, 0);
    }
  });
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

  svc = await import("../../utils/smolVLMService.js");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─────────────────────────────────────────────────────────────────────────────
describe("isSmolVLMSupported", () => {
  /** Returns false when navigator.gpu is absent (default jsdom environment) */
  it("returns false when navigator.gpu is absent", () => {
    expect(svc.isSmolVLMSupported()).toBe(false);
  });

  it("returns true when navigator.gpu is present", async () => {
    vi.resetModules();
    vi.stubGlobal("navigator", { ...navigator, gpu: {} });
    const fresh = await import("../../utils/smolVLMService.js");
    expect(fresh.isSmolVLMSupported()).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("getStatus", () => {
  /** Returns the correct shape with all expected fields */
  it("returns an object with correct shape", () => {
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

  it("isSupported reflects WebGPU availability", () => {
    // No GPU in jsdom
    expect(svc.getStatus().isSupported).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("initialize - without WebGPU", () => {
  /** initialize() must bail early and return false if WebGPU is unavailable */
  it("returns false when WebGPU is not supported", async () => {
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
    svc = await setupSmolVLMModule();
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
    simulateWorkerMessage({ status: "error", error: "GPU OOM" });
    const result = await initPromise;
    expect(result).toBe(false);
  });

  it("sets lastError from worker error status", async () => {
    const initPromise = svc.initialize();
    simulateWorkerMessage({ status: "error", error: "GPU OOM" });
    await initPromise;
    expect(svc.getStatus().lastError).toBe("GPU OOM");
  });

  it("returns false when worker fires onerror event", async () => {
    const initPromise = svc.initialize();
    simulateWorkerError("script load failed");
    const result = await initPromise;
    expect(result).toBe(false);
  });

  it("sets lastError from worker onerror event", async () => {
    const initPromise = svc.initialize();
    simulateWorkerError("script load failed");
    await initPromise;
    expect(svc.getStatus().lastError).toBe("script load failed");
  });

  it("is idempotent - returns true immediately if already ready", async () => {
    const init1 = svc.initialize();
    simulateWorkerMessage({ status: "ready" });
    await init1;

    const result = await svc.initialize();
    expect(result).toBe(true);
    expect(Worker).toHaveBeenCalledTimes(1);
  });

  it("emits progress events for loading status", async () => {
    const progressCb = vi.fn();
    svc.addEventListener("progress", progressCb);

    const initPromise = svc.initialize();
    simulateWorkerMessage({
      status: "loading",
      progress: 0.3,
      message: "Loading tokenizer",
    });
    simulateWorkerMessage({ status: "ready" });
    await initPromise;

    expect(progressCb).toHaveBeenCalledWith({
      progress: 0.3,
      message: "Loading tokenizer",
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("event listeners", () => {
  /** addEventListener/removeEventListener should add/remove callbacks correctly */
  it("addEventListener adds a callback invoked by emit", async () => {
    const cb = vi.fn();
    svc.addEventListener("error", cb);
    await svc.initialize(); // triggers error (no WebGPU)
    expect(cb).toHaveBeenCalled();
  });

  it("removeEventListener prevents callback from being invoked", async () => {
    const cb = vi.fn();
    svc.addEventListener("error", cb);
    svc.removeEventListener("error", cb);
    await svc.initialize();
    expect(cb).not.toHaveBeenCalled();
  });

  it("multiple listeners for same event all get called", async () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    svc.addEventListener("error", cb1);
    svc.addEventListener("error", cb2);
    await svc.initialize();
    expect(cb1).toHaveBeenCalled();
    expect(cb2).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("analyzeImage", () => {
  /** analyzeImage() validates file type, sends ANALYZE to worker, handles streaming */
  beforeEach(async () => {
    svc = await setupReadySmolVLMModule();
  });

  it("rejects unsupported file types", async () => {
    const badFile = new File(["data"], "report.docx", {
      type: "application/msword",
    });
    await expect(svc.analyzeImage(badFile)).rejects.toThrow(
      "Unsupported file type",
    );
  });

  it("sends ANALYZE message with imageBlob and prompt for image files", async () => {
    const file = makeImageFile();

    mockWorkerReply({ status: "complete", text: "result" });

    await svc.analyzeImage(file, { prompt: "Extract text" });

    expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "ANALYZE",
        payload: expect.objectContaining({
          imageBlob: expect.any(Blob),
          prompt: "Extract text",
        }),
      }),
    );
  });

  it("sends ANALYZE message for PDF files", async () => {
    const file = makePdfFile();

    mockWorkerReply({ status: "complete", text: "pdf text" });

    await svc.analyzeImage(file, { prompt: "Describe document" });

    expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "ANALYZE" }),
    );
  });

  it("resolves with text from worker complete message", async () => {
    const file = makeImageFile();

    mockWorkerReply({ status: "complete", text: "Extracted content" });

    const result = await svc.analyzeImage(file);
    expect(result.text).toBe("Extracted content");
  });

  it("rejects when worker sends error status", async () => {
    const file = makeImageFile();

    mockWorkerReply({ status: "error", error: "Model inference failed" });

    await expect(svc.analyzeImage(file)).rejects.toThrow(
      "Model inference failed",
    );
  });

  it("calls onToken for each streaming token", async () => {
    const file = makeImageFile();
    const onToken = vi.fn();

    mockWorkerReply(
      { status: "streaming", token: "Hello" },
      { status: "streaming", token: " world" },
      { status: "complete", text: "Hello world" },
    );

    await svc.analyzeImage(file, { onToken });
    expect(onToken).toHaveBeenCalledWith("Hello");
    expect(onToken).toHaveBeenCalledWith(" world");
    expect(onToken).toHaveBeenCalledTimes(2);
  });

  it("does not call onToken when option is not provided", async () => {
    const file = makeImageFile();

    // Should not throw even if streaming messages arrive without onToken
    mockWorkerReply(
      { status: "streaming", token: "tok" },
      { status: "complete", text: "tok" },
    );

    const result = await svc.analyzeImage(file);
    expect(result.text).toBe("tok");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("processMultiplePages", () => {
  /** processMultiplePages() iterates PDF pages and joins results */
  beforeEach(async () => {
    svc = await setupReadySmolVLMModule();

    // Auto-reply per addEventListener call
    let callCount = 0;
    const pageTexts = ["First page content", "Second page content"];
    mockWorkerInstance.addEventListener.mockImplementation((evt, handler) => {
      if (evt === "message") {
        const text = pageTexts[callCount % pageTexts.length];
        callCount++;
        setTimeout(() => handler({ data: { status: "complete", text } }), 0);
      }
    });
  });

  it("rejects non-PDF files", async () => {
    const imgFile = makeImageFile();
    await expect(svc.processMultiplePages(imgFile)).rejects.toThrow(
      "requires a PDF",
    );
  });

  it("processes all pages from PDF metadata (numPages=2)", async () => {
    const file = makePdfFile();
    const result = await svc.processMultiplePages(file);
    expect(result.pages).toHaveLength(2);
  });

  it("combines page texts with --- Page Break --- separator", async () => {
    const file = makePdfFile();
    const result = await svc.processMultiplePages(file);
    expect(result.combinedText).toContain("--- Page Break ---");
  });

  it("respects maxPages option", async () => {
    const file = makePdfFile();
    const result = await svc.processMultiplePages(file, { maxPages: 1 });
    expect(result.pages).toHaveLength(1);
  });

  it("returns totalPages in result", async () => {
    const file = makePdfFile();
    const result = await svc.processMultiplePages(file);
    expect(result.totalPages).toBe(2);
  });

  it("returns processedPages count in result", async () => {
    const file = makePdfFile();
    const result = await svc.processMultiplePages(file);
    expect(result.processedPages).toBe(2);
  });

  it("calls onPageComplete after each page", async () => {
    const file = makePdfFile();
    const onPageComplete = vi.fn();
    await svc.processMultiplePages(file, { onPageComplete });
    expect(onPageComplete).toHaveBeenCalledTimes(2);
  });

  it("passes prompt to each analyzeImage call", async () => {
    const file = makePdfFile();
    await svc.processMultiplePages(file, { prompt: "Extract DD214 fields" });
    // ANALYZE postMessage should include the prompt
    const analyzeCall = mockWorkerInstance.postMessage.mock.calls.find(
      (c) => c[0]?.type === "ANALYZE",
    );
    expect(analyzeCall?.[0]?.payload?.prompt).toBe("Extract DD214 fields");
  });

  it("respects explicit pages array", async () => {
    const file = makePdfFile();
    const result = await svc.processMultiplePages(file, { pages: [1] });
    expect(result.pages).toHaveLength(1);
    expect(result.processedPages).toBe(1);
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
    svc = await import("../../utils/smolVLMService.js");

    const initPromise = svc.initialize();
    simulateWorkerMessage({ status: "ready" });
    await initPromise;
  });

  it("sends UNLOAD before terminating", () => {
    svc.shutdown();
    const calls = mockWorkerInstance.postMessage.mock.calls;
    const unloadCall = calls.find((c) => c[0]?.type === "UNLOAD");
    expect(unloadCall).toBeTruthy();
  });

  it("calls worker.terminate()", () => {
    svc.shutdown();
    expect(mockWorkerInstance.terminate).toHaveBeenCalled();
  });

  it("resets isReady to false", () => {
    svc.shutdown();
    expect(svc.getStatus().isReady).toBe(false);
  });

  it("resets isInitializing to false", () => {
    svc.shutdown();
    expect(svc.getStatus().isInitializing).toBe(false);
  });

  it("is safe to call twice (no worker on second call)", () => {
    svc.shutdown();
    expect(() => svc.shutdown()).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("smolVLMService export object", () => {
  /** The named export should expose all public API methods */
  it("exports smolVLMService with all expected methods", () => {
    const s = svc.smolVLMService;
    expect(typeof s.isSmolVLMSupported).toBe("function");
    expect(typeof s.getStatus).toBe("function");
    expect(typeof s.initialize).toBe("function");
    expect(typeof s.analyzeImage).toBe("function");
    expect(typeof s.processMultiplePages).toBe("function");
    expect(typeof s.shutdown).toBe("function");
  });
});
