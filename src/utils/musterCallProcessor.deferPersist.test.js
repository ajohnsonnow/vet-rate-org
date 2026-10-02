/**
 * A tool that shows its own confirmation step reads a scan with deferPersist:
 * nothing is saved, and the profile auto-fill that follows a save must not run
 * either. Only the text extraction (the external boundary) is faked; the read,
 * the saving and the profile auto-fill are the real ones.
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

const LETTER_TEXT =
  "Department of Veterans Affairs. Dear Veteran, this letter is about your claim for compensation. " +
  "We made a decision on your claim. Your combined evaluation is 70 percent. ".repeat(
    3,
  );
const letterFile = () =>
  new File([LETTER_TEXT], "generic-letter.pdf", { type: "application/pdf" });

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  analyzeDocument.mockResolvedValue({
    text: LETTER_TEXT,
    pageCount: 1,
    method: "text",
    ocrUsed: false,
    confidence: 90,
  });
});

describe("processFormationDocument with deferPersist", () => {
  it("runs the profile auto-fill after a normal import", async () => {
    const result = await processFormationDocument(letterFile(), () => {});

    expect(result.status).toBe("complete");
    expect(result.profilePopulateResult).not.toBeNull();
  }, 15_000);

  it("reads the document without saving it or auto-filling the profile", async () => {
    const result = await processFormationDocument(letterFile(), () => {}, {
      deferPersist: true,
    });

    expect(result.status).toBe("complete");
    expect(result.profilePopulateResult).toBeNull();
    expect(result.vkbSaved).toBe(false);
  }, 15_000);
});
