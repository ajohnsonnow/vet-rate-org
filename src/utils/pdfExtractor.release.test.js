/**
 * D22-1: streaming a very large PDF must not keep it resident afterwards. The
 * loading task (pdf.js's worker and the file bytes it pulled in) is destroyed
 * when the read ends, finished or failed, every page opened is released, and
 * the document's caches are released after each batch. What is read must not
 * change: the exact text and page counts are asserted.
 *
 * pdf.js and IndexedDB are the external boundaries and are faked;
 * processLargePDF is the real code.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const fake = vi.hoisted(() => ({
  numPages: 0,
  loadError: null,
  failTextAt: null,
  pageError: null,
  destroyed: 0,
  documentCleanups: 0,
  opened: new Set(),
  cleaned: new Set(),
}));

const pageText = (n) =>
  n % 4 === 0 ? "" : `generic words for page ${n} `.repeat(4);

vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: {},
  version: "0.0.0",
  getDocument: () => ({
    destroy: async () => {
      fake.destroyed++;
    },
    promise: fake.loadError
      ? Promise.reject(fake.loadError)
      : Promise.resolve({
          numPages: fake.numPages,
          cleanup: () => {
            fake.documentCleanups++;
          },
          getPage: async (n) => {
            fake.opened.add(n);
            return {
              cleanup: () => {
                fake.cleaned.add(n);
                return true;
              },
              getTextContent: async () => {
                if (n === fake.failTextAt) throw fake.pageError;
                return { items: [{ str: pageText(n) }] };
              },
            };
          },
        }),
  }),
}));

function installFakeIndexedDb() {
  const rows = new Map();
  const store = {
    put: (row) => {
      rows.set(row.batchKey, row);
      return {};
    },
    delete: (key) => rows.delete(key),
    getAll: () => {
      const req = {};
      queueMicrotask(() => {
        req.result = [...rows.values()];
        req.onsuccess?.();
      });
      return req;
    },
  };
  const db = {
    objectStoreNames: { contains: () => true },
    createObjectStore: () => {},
    close: () => {},
    transaction: () => {
      const tx = { objectStore: () => store };
      queueMicrotask(() => setTimeout(() => tx.oncomplete?.(), 0));
      return tx;
    },
  };
  vi.stubGlobal("indexedDB", {
    open: () => {
      const req = {};
      queueMicrotask(() => {
        req.result = db;
        req.onsuccess?.();
      });
      return req;
    },
  });
}

const { processLargePDF } = await import("./pdfExtractor");
const file = () => new File([new Uint8Array(8)], "fixture.pdf");

beforeEach(() => {
  Object.assign(fake, {
    numPages: 45,
    loadError: null,
    failTextAt: null,
    pageError: null,
    destroyed: 0,
    documentCleanups: 0,
    opened: new Set(),
    cleaned: new Set(),
  });
  installFakeIndexedDb();
  vi.stubGlobal("URL", {
    createObjectURL: vi.fn(() => "blob:fake"),
    revokeObjectURL: vi.fn(),
  });
});

describe("processLargePDF: what is read does not change", () => {
  it("returns exactly the text, counts and ranges it did before", async () => {
    const result = await processLargePDF(file(), { batchSize: 20 });

    const expected = Array.from({ length: 45 }, (_, i) => {
      const n = i + 1;
      return `--- PAGE ${n} ---\n${pageText(n).replace(/\s+/g, " ").trim()}\n\n`;
    }).join("");
    expect(result.text).toBe(expected);
    expect(result.pageCount).toBe(45);
    expect(result.pagesWithText).toBe(34);
    expect(result.pagesEmpty).toBe(11);
    expect(result.scannedPageRanges).toHaveLength(11);
    expect(result.method).toBe("streaming_all_pages");
  });
});

describe("processLargePDF: memory is released", () => {
  it("destroys the loading task and releases every page and each batch", async () => {
    await processLargePDF(file(), { batchSize: 20 });

    expect(fake.destroyed).toBe(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fake");
    expect(fake.opened.size).toBe(45);
    expect([...fake.cleaned].sort((a, b) => a - b)).toEqual(
      [...fake.opened].sort((a, b) => a - b),
    );
    expect(fake.documentCleanups).toBe(3);
  });

  it("destroys the loading task when the document cannot be opened", async () => {
    fake.loadError = new Error("load failed");
    await expect(processLargePDF(file())).rejects.toThrow("load failed");
    expect(fake.destroyed).toBe(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fake");
  });
});

const RAW_READ_ERROR = Object.assign(
  new Error(
    'Unexpected server response (0) while retrieving PDF "blob:http://127.0.0.1:5381/0b1c-generic"',
  ),
  { name: "UnexpectedResponseException" },
);

describe("processLargePDF: a file that cannot be read", () => {
  let warnSpy;
  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  const logged = () => warnSpy.mock.calls.flat().map(String).join(" ");

  it("fails as a plain read failure when the file cannot be opened", async () => {
    fake.loadError = RAW_READ_ERROR;

    const failure = await processLargePDF(file()).catch((error) => error);

    expect(failure.name).toBe("FileReadError");
    expect(failure.message).toBe("This file could not be read.");
    expect(fake.destroyed).toBe(1);
  });

  it("fails the document, rather than saving empty pages, when the file stops being readable part way", async () => {
    fake.failTextAt = 30;
    fake.pageError = RAW_READ_ERROR;

    const failure = await processLargePDF(file(), { batchSize: 20 }).catch(
      (error) => error,
    );

    expect(failure.name).toBe("FileReadError");
    expect(logged()).not.toMatch(/blob:|Unexpected server response/);
    expect(fake.destroyed).toBe(1);
  });

  it("still tolerates one unreadable page that is not a file read failure", async () => {
    fake.failTextAt = 3;
    fake.pageError = new Error("bad page stream");

    const result = await processLargePDF(file(), { batchSize: 20 });

    expect(result.pageCount).toBe(45);
    expect(result.text).toContain("--- PAGE 3 ---\n[extraction error]");
  });
});
