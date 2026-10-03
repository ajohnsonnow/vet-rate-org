/**
 * D22-2: a file that cannot be read after it was chosen produced raw, technical
 * messages ("Unexpected server response (0) while retrieving PDF blob:...").
 * These must be recognised as one plain failure, and never logged as written.
 */
import { describe, it, expect } from "vitest";
import {
  FileReadError,
  FILE_READ_FAILED_MESSAGE,
  FILE_READ_LOG_PHRASE,
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

describe("forLog", () => {
  it("replaces a read failure, which may carry a blob: address, with a fixed phrase", () => {
    const raw = new Error(
      'Unexpected server response (0) while retrieving PDF "blob:http://x/y"',
    );
    expect(forLog(raw)).toBe(FILE_READ_LOG_PHRASE);
    expect(String(forLog(raw))).not.toMatch(/blob:/);
  });

  it("leaves any other error alone", () => {
    const other = new Error("something else");
    expect(forLog(other)).toBe(other);
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
