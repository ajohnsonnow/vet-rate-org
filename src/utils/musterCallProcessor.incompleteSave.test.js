/**
 * The single-document tools (C-File Analyzer, DD214 Analyzer) import through
 * processFormationDocument but have no Retry control. A save that did not
 * finish must reach them as a plain failure, not as a result that looks
 * complete; Muster Call asks for the result back so it can offer its Retry.
 * Only the text extraction (the external boundary) is faked; saving is the
 * real one, against a device whose storage is full.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakeIndexedDB } from "../__tests__/helpers/fakeIndexedDB";

globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

const fake = createFakeIndexedDB();
vi.stubGlobal("indexedDB", fake.indexedDB);

vi.mock("./documentAnalyzer", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, analyzeDocument: vi.fn() };
});

const { analyzeDocument } = await import("./documentAnalyzer");
const { processFormationDocument, DocumentPersistIncompleteError } =
  await import("./musterCallProcessor");

const LETTER_TEXT =
  "Department of Veterans Affairs. Dear Veteran, this letter is about your claim for compensation. " +
  "We made a decision on your claim. Your combined evaluation is 70 percent. ".repeat(
    3,
  );
const letterFile = () =>
  new File([LETTER_TEXT], "generic-letter.pdf", { type: "application/pdf" });

beforeEach(() => {
  localStorage.clear();
  fake.control.quotaFull = true;
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  analyzeDocument.mockResolvedValue({
    text: LETTER_TEXT,
    pageCount: 1,
    method: "text",
    ocrUsed: false,
    confidence: 90,
  });
});

describe("processFormationDocument when the save did not finish", () => {
  it("fails plainly for a caller with no Retry, without pointing at one", async () => {
    const failure = await processFormationDocument(
      letterFile(),
      () => {},
    ).catch((err) => err);

    expect(failure).toBeInstanceOf(DocumentPersistIncompleteError);
    expect(failure.message).toContain('"generic-letter.pdf"');
    expect(failure.message).toMatch(/storage is full/i);
    expect(failure.message).not.toMatch(/Retry/);
  }, 15_000);

  it("hands the failed result back to a caller that offers its own Retry", async () => {
    const result = await processFormationDocument(letterFile(), () => {}, {
      returnIncompleteSave: true,
    });

    expect(result.status).toBe("error");
    expect(result.persistIncomplete).toBe(true);
    expect(result.persistQuotaExceeded).toBe(true);
    expect(result.error).toContain("Choose Retry");
  }, 15_000);

  it("still returns a complete result when the save finished", async () => {
    fake.control.quotaFull = false;

    const result = await processFormationDocument(letterFile(), () => {});

    expect(result.status).toBe("complete");
    expect(result.persistIncomplete).toBeFalsy();
  }, 15_000);
});
