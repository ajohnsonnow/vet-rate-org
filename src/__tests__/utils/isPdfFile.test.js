import { describe, it, expect } from "vitest";
import {
  isPdfFile,
  describePdfPasswordError,
} from "../../utils/fileTypeGuards";

// RT7-3 / PARSE-003: the VA, some OSes, and cloud downloads ship PDFs with an
// empty or application/octet-stream MIME type. Exact-MIME matching wrongly
// rejected them; accept on extension or pdf MIME, reject 0-byte up front.
const fakeFile = ({
  name = "c-file.pdf",
  type = "application/pdf",
  size = 1,
}) => ({ name, type, size });

describe("isPdfFile — C-file ingest validator (RT7-3 / PARSE-003)", () => {
  it("accepts a normal application/pdf", () => {
    expect(isPdfFile(fakeFile({ type: "application/pdf" }))).toBe(true);
  });

  it("accepts a .pdf shipped as application/octet-stream (the VA case)", () => {
    expect(isPdfFile(fakeFile({ type: "application/octet-stream" }))).toBe(
      true,
    );
  });

  it("accepts a .pdf with an empty MIME type", () => {
    expect(isPdfFile(fakeFile({ type: "" }))).toBe(true);
  });

  it("accepts application/pdf even with no extension", () => {
    expect(isPdfFile(fakeFile({ name: "scan", type: "application/pdf" }))).toBe(
      true,
    );
  });

  it("rejects a 0-byte file even if named .pdf", () => {
    expect(isPdfFile(fakeFile({ size: 0 }))).toBe(false);
  });

  it("rejects a non-PDF (e.g. .png/image)", () => {
    expect(isPdfFile(fakeFile({ name: "x.png", type: "image/png" }))).toBe(
      false,
    );
  });

  it("rejects null/undefined", () => {
    expect(isPdfFile(null)).toBe(false);
    expect(isPdfFile(undefined)).toBe(false);
  });
});

describe("describePdfPasswordError — encrypted-PDF copy (RT7-1 / PARSE-001)", () => {
  it("maps a pdf.js PasswordException to specific, tagged copy", () => {
    const err = describePdfPasswordError({ name: "PasswordException" });
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe("PDF_PASSWORD_REQUIRED");
    expect(err.message).toMatch(/password-protected/i);
  });

  it("maps an already-tagged PDF_PASSWORD_REQUIRED error", () => {
    const err = describePdfPasswordError({ code: "PDF_PASSWORD_REQUIRED" });
    expect(err?.code).toBe("PDF_PASSWORD_REQUIRED");
  });

  it("returns null for unrelated errors (caller keeps generic copy)", () => {
    expect(describePdfPasswordError(new Error("network blip"))).toBeNull();
    expect(describePdfPasswordError(null)).toBeNull();
    expect(describePdfPasswordError(undefined)).toBeNull();
  });
});
