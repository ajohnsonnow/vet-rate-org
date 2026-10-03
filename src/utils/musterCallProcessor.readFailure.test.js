/**
 * D22-2: when reading a file fails, the document's result must say so plainly
 * (no raw pdf.js text, no blob: address), be marked as a read failure so the
 * import can offer a retry, and nothing technical may reach the console.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakeIndexedDB } from "../__tests__/helpers/fakeIndexedDB";

globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

vi.stubGlobal("indexedDB", createFakeIndexedDB().indexedDB);

vi.mock("./documentAnalyzer", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, analyzeDocument: vi.fn() };
});

const { analyzeDocument } = await import("./documentAnalyzer");
const { processFormationDocument } = await import("./musterCallProcessor");

const RAW =
  'Unexpected server response (0) while retrieving PDF "blob:http://127.0.0.1:5381/0b1c-generic"';

const generic = () =>
  new File(["generic"], "generic-letter.pdf", { type: "application/pdf" });

let errorSpy;
let warnSpy;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

const everythingLogged = () =>
  [...errorSpy.mock.calls, ...warnSpy.mock.calls].flat().map(String).join(" ");

describe("processFormationDocument: a file that cannot be read", () => {
  it("is reported plainly and marked as a read failure", async () => {
    analyzeDocument.mockRejectedValue(new Error(RAW));

    const result = await processFormationDocument(generic(), () => {});

    expect(result.status).toBe("error");
    expect(result.readFailed).toBe(true);
    expect(result.failureKind).toBe("read");
    expect(result.error).toBe(
      "This document could not be processed because the file could not be read.",
    );
    expect(result.persistIncomplete).toBe(false);
  });

  it("writes nothing technical to the console", async () => {
    analyzeDocument.mockRejectedValue(new Error(RAW));

    await processFormationDocument(generic(), () => {});

    expect(everythingLogged()).not.toMatch(/blob:|Unexpected server response/);
  });

  it("does not mark an ordinary failure as a read failure", async () => {
    analyzeDocument.mockRejectedValue(new Error("No text could be extracted"));

    const result = await processFormationDocument(generic(), () => {});

    expect(result.status).toBe("error");
    expect(result.readFailed).toBe(false);
    expect(result.failureKind).toBe("unknown");
    expect(result.error).not.toContain("No text could be extracted");
  });
});
