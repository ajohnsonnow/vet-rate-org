import { describe, it, expect, vi, beforeEach } from "vitest";
import { draftFileText, flat, occurrences } from "../helpers/draftFileText";

vi.mock("../../utils/sanitize", async (importOriginal) => ({
  ...(await importOriginal()),
  triggerBlobDownload: vi.fn(() => true),
}));
const { triggerBlobDownload } = await import("../../utils/sanitize");
const { DRAFT_FORMATS, downloadDraft, draftFileBytes } =
  await import("../../utils/draftExport");

const DRAFT = [
  "STATEMENT IN SUPPORT OF CLAIM (VA Form 21-4138)",
  "",
  "I am submitting this statement for Tinnitus & hearing <loss>.",
  "When my symptoms began: [date the symptoms began]",
  "A long line that has to wrap in a PDF: I cannot stand at the sink long enough to wash the dishes, and I need help putting on my socks (most mornings).",
].join("\n");

beforeEach(() => {
  triggerBlobDownload.mockClear();
  triggerBlobDownload.mockReturnValue(true);
});

describe.each(DRAFT_FORMATS)("a %s file", (format) => {
  it("is not empty and holds the draft, every line once", async () => {
    const bytes = await draftFileBytes(DRAFT, format);
    expect(bytes.length).toBeGreaterThan(100);

    const text = await draftFileText(bytes, format);
    expect(flat(text)).toBe(flat(DRAFT));
    expect(occurrences(text, "[date the symptoms began]")).toBe(1);
  });

  it("opens with the banner when the tool gives one, then the draft", async () => {
    const text = await draftFileText(
      await draftFileBytes(DRAFT, format, {
        banner: "DRAFT - not yet signed.",
      }),
      format,
    );
    expect(flat(text)).toBe(flat(`DRAFT - not yet signed. ${DRAFT}`));
  });

  it("is handed to the browser under the tool's file name", async () => {
    const { bytes, fileName } = await downloadDraft(
      DRAFT,
      "VA-Statement",
      format,
    );

    expect(fileName).toBe(`VA-Statement.${format}`);
    expect(triggerBlobDownload).toHaveBeenCalledTimes(1);
    const [blob, name] = triggerBlobDownload.mock.calls[0];
    expect(name).toBe(fileName);
    expect(blob.size).toBe(bytes.length);
  });

  it("rejects when the download cannot start", async () => {
    triggerBlobDownload.mockReturnValue(false);
    await expect(downloadDraft(DRAFT, "x", format)).rejects.toThrow(
      /could not start/,
    );
  });
});

describe("draftFileBytes", () => {
  it("refuses a format it does not know", async () => {
    await expect(draftFileBytes(DRAFT, "odt")).rejects.toThrow(/unknown/);
  });
});
