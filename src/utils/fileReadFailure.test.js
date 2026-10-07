/**
 * D22-2: a file that cannot be read after it was chosen produced raw, technical
 * messages ("Unexpected server response (0) while retrieving PDF blob:...").
 * These must be recognised as one plain failure, and never logged as written.
 */
import { describe, it, expect } from "vitest";
import {
  FileReadError,
  FILE_READ_FAILED_MESSAGE,
  classifyDocumentFailure,
  deliberateMessageFor,
  isFileReadFailure,
  forLog,
  isFileStillReadable,
} from "./fileReadFailure";

const named = (name, message) => Object.assign(new Error(message), { name });

describe("isFileReadFailure", () => {
  it.each([
    [
      "pdf.js blob read",
      named(
        "UnexpectedResponseException",
        'Unexpected server response (0) while retrieving PDF "blob:http://127.0.0.1:5381/0b1c"',
      ),
    ],
    ["FileReader error", new Error("Failed to read file")],
    ["file removed", named("NotFoundError", "A requested file was not found")],
    [
      "file locked",
      named("NotReadableError", "The requested file could not be read"),
    ],
    ["our own error", new FileReadError()],
  ])("recognises %s", (_label, error) => {
    expect(isFileReadFailure(error)).toBe(true);
  });

  it.each([
    ["a password failure", named("PasswordException", "No password given")],
    [
      "an ordinary failure",
      new Error("No text could be extracted from document"),
    ],
    ["nothing", undefined],
  ])("does not claim %s", (_label, error) => {
    expect(isFileReadFailure(error)).toBe(false);
  });
});

describe("classifyDocumentFailure", () => {
  it.each([
    [
      "a worker script that cannot be fetched",
      new Error(
        'Setting up fake worker failed: "Failed to fetch dynamically imported module: http://localhost:5383/assets/pdf.worker.min.mjs".',
      ),
      "reader_unavailable",
    ],
    [
      "a worker loaded from a blob: address",
      new Error("Failed to load worker script blob:http://localhost:5383/ab"),
      "reader_unavailable",
    ],
    ["a step that ran out of time", named("StepTimeoutError", "x"), "timeout"],
    ["an abort by timeout", new Error("The operation timed out"), "timeout"],
    [
      "an allocation failure",
      new RangeError("Array buffer allocation failed"),
      "memory",
    ],
    ["a read failure", named("NotFoundError", "gone"), "read"],
    [
      "a bad date, which is not a memory problem",
      new RangeError("Invalid time value"),
      "unknown",
    ],
    [
      "a deep call stack, which is not a memory problem",
      new RangeError("Maximum call stack size exceeded"),
      "unknown",
    ],
    [
      "an on-device AI worker error, which is not the document reader",
      new Error("The AI engine worker stopped responding to messages"),
      "unknown",
    ],
    ["anything else", new Error("analysis exploded"), "unknown"],
    ["nothing", undefined, "unknown"],
  ])("sorts %s as %s", (_label, error, kind) => {
    expect(classifyDocumentFailure(error)).toBe(kind);
  });
});

describe("deliberateMessageFor", () => {
  it.each([
    [
      "a legacy .doc file",
      "Legacy .doc format is not supported. Please save",
      /\.docx or \.txt/,
    ],
    [
      "a Word file that is too large",
      "This Word document is too large to process safely (80 MB; limit 50 MB).",
      /convert it to PDF/,
    ],
    [
      "a PDF too large for OCR",
      "This PDF (200 MB) is too large for OCR on your device. Use the C-File Analyzer tool instead",
      /C-File Analyzer/,
    ],
    [
      "a password-protected PDF",
      "This PDF is password-protected. Enter the correct password",
      /remove the protection/,
    ],
    [
      "an unsupported file type",
      "Unsupported file type: .xyz. Supported formats: PDF",
      /not supported/,
    ],
  ])(
    "gives a fixed instruction for %s and drops the original text",
    (_label, raw, expected) => {
      const message = deliberateMessageFor(new Error(raw));
      expect(message).toMatch(expected);
      expect(message).not.toMatch(/MB|\.xyz/);
    },
  );

  it("has nothing to say about an ordinary error", () => {
    expect(
      deliberateMessageFor(new Error("analysis exploded")),
    ).toBeUndefined();
  });
});

describe("forLog", () => {
  it("never carries a local address, for any kind", () => {
    const raw = new Error(
      "Failed to fetch dynamically imported module: http://localhost:5383/pdf.worker.mjs",
    );
    expect(forLog(raw)).toBe("document_failure:reader_unavailable");
  });

  it("replaces a read failure, which may carry a blob: address, with a fixed phrase", () => {
    const raw = new Error(
      'Unexpected server response (0) while retrieving PDF "blob:http://x/y"',
    );
    expect(forLog(raw)).toBe("document_failure:read");
    expect(String(forLog(raw))).not.toMatch(/blob:/);
  });

  it("replaces any other error too, so no technical text is logged", () => {
    const other = new Error("something else at http://localhost:5383/x.mjs");
    expect(forLog(other)).toBe("document_failure:unknown");
  });
});

describe("FileReadError", () => {
  it("carries only the plain message", () => {
    const error = new FileReadError();
    expect(error.message).toBe(FILE_READ_FAILED_MESSAGE);
    expect(error.name).toBe("FileReadError");
  });
});

describe("isFileStillReadable", () => {
  it("is true for a file that reads", async () => {
    expect(await isFileStillReadable(new File(["abc"], "x.pdf"))).toBe(true);
  });

  it("is false when reading the file fails", async () => {
    const gone = {
      slice: () => ({
        arrayBuffer: () => Promise.reject(named("NotFoundError", "gone")),
      }),
    };
    expect(await isFileStillReadable(gone)).toBe(false);
  });
});
