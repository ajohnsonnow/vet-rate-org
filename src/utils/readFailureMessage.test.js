/**
 * D23-3 / D23-2a: every failed document is described in plain words, by the
 * document's plain type name and place, never by an internal label.
 */
import { describe, it, expect } from "vitest";
import {
  describeDocumentFailure,
  describeFailureKind,
  plainDocumentLabel,
} from "./readFailureMessage";
import { FAILURE_KINDS } from "./fileReadFailure";

describe("plainDocumentLabel", () => {
  it.each([
    ["CLAIM_LETTER", 2, "the claim letter (document 3)"],
    ["DD214", 0, "the DD214 (document 1)"],
    ["C_FILE_MEDICAL", 4, "the C-file medical record (document 5)"],
    ["UNKNOWN", 2, "document 3"],
    [undefined, 0, "document 1"],
  ])("names %s at index %s as %s", (type, index, expected) => {
    expect(plainDocumentLabel(type, index)).toBe(expected);
  });

  it("never shows an internal label", () => {
    expect(plainDocumentLabel("CLAIM_LETTER", 0)).not.toMatch(/[A-Z]_[A-Z]/);
    expect(plainDocumentLabel("UNKNOWN", 0)).not.toContain("UNKNOWN");
  });

  it("still names a document whose place is not known", () => {
    expect(plainDocumentLabel("UNKNOWN", -1)).toBe("this document");
  });
});

describe("describeDocumentFailure", () => {
  const label = "the claim letter (document 3)";

  it.each(Object.values(FAILURE_KINDS))(
    "says in one sentence what failed and what to do for %s",
    (kind) => {
      const message = describeDocumentFailure(label, {
        kind,
        canRetry: true,
        fileGone: false,
      });
      expect(message).toContain(label);
      expect(message).toContain("Retry");
      expect(message.match(/\./g)).toHaveLength(1);
      expect(message).not.toMatch(/https?:|blob:|CLAIM_LETTER|UNKNOWN/);
    },
  );

  it("tells a reload apart from a file that is gone", () => {
    const reloaded = describeDocumentFailure(label, {
      kind: FAILURE_KINDS.READER_UNAVAILABLE,
      canRetry: false,
      fileGone: true,
      reloaded: true,
    });
    expect(reloaded).toContain("before the page was reloaded");
    expect(reloaded).not.toContain("no longer available");
  });

  it("offers no Retry once the tries are used up", () => {
    const message = describeDocumentFailure(label, {
      kind: FAILURE_KINDS.TIMEOUT,
      canRetry: false,
      fileGone: false,
    });
    expect(message).not.toContain("choose Retry");
    expect(message).toContain("add the file again");
  });
});

describe("describeFailureKind", () => {
  it("falls back to the unknown cause for a kind it does not know", () => {
    expect(describeFailureKind("nonsense")).toBe(
      describeFailureKind(FAILURE_KINDS.UNKNOWN),
    );
  });
});
