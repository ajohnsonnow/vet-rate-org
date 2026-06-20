import { describe, it, expect } from "vitest";
import { isPdfFile } from "../../utils/fileTypeGuards";

// RT7-3 / PARSE-003: the VA, some OSes, and cloud downloads ship PDFs with an
// empty or application/octet-stream MIME type. Exact-MIME matching wrongly
// rejected them; accept on extension or pdf MIME, reject 0-byte up front.
const fakeFile = ({ name = "c-file.pdf", type = "application/pdf", size = 1 }) =>
  ({ name, type, size });

describe("isPdfFile — C-file ingest validator (RT7-3 / PARSE-003)", () => {
  it("accepts a normal application/pdf", () => {
    expect(isPdfFile(fakeFile({ type: "application/pdf" }))).toBe(true);
  });

  it("accepts a .pdf shipped as application/octet-stream (the VA case)", () => {
    expect(
      isPdfFile(fakeFile({ type: "application/octet-stream" })),
    ).toBe(true);
  });

  it("accepts a .pdf with an empty MIME type", () => {
    expect(isPdfFile(fakeFile({ type: "" }))).toBe(true);
  });

  it("accepts application/pdf even with no extension", () => {
    expect(
      isPdfFile(fakeFile({ name: "scan", type: "application/pdf" })),
    ).toBe(true);
  });

  it("rejects a 0-byte file even if named .pdf", () => {
    expect(isPdfFile(fakeFile({ size: 0 }))).toBe(false);
  });

  it("rejects a non-PDF (e.g. .png/image)", () => {
    expect(
      isPdfFile(fakeFile({ name: "x.png", type: "image/png" })),
    ).toBe(false);
  });

  it("rejects null/undefined", () => {
    expect(isPdfFile(null)).toBe(false);
    expect(isPdfFile(undefined)).toBe(false);
  });
});
