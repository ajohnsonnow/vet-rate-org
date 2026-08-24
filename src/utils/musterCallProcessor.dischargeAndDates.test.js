/**
 * Two regressions from the live C-File audit (2026-08-21):
 *  - the bare `GENERAL` alternative in the Box 24 fallback would read the
 *    ADJUTANT GENERAL's signature block or Box 18's "GENERAL REMARKS" as a
 *    General discharge on a document that never characterizes one;
 *  - rated conditions were saved with the letter's prose effective date, which
 *    every consumer renders through dateUtils.formatLocalDate (first 10 chars
 *    + "T00:00:00"), so the Ratings tab showed "Effective: Invalid Date".
 */
import { describe, it, expect } from "vitest";
import { formatLocalDate } from "./dateUtils";

globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

const { parseServiceRecord } = await import("./musterCallProcessor");

describe("parseServiceRecord: character of service", () => {
  it("reads the real NGB22 rendering and normalizes it", async () => {
    const result = await parseServiceRecord(
      "24. CHARACTER OF SERVICE GENERAL - UNDER HONORABLE CONDITIONS 25. SEPARATION AUTHORITY NGR 600-200",
      "NGB22",
    );
    expect(result.dischargeType).toBe("GENERAL UNDER HONORABLE CONDITIONS");
  });

  it("reads it through the zero-for-O OCR corruption a real scan produces", async () => {
    const result = await parseServiceRecord(
      "GENERAL - UNDER H0N0RABLE C0NDITI0NS       NGB F0RM 56",
      "NGB22",
    );
    expect(result.dischargeType).toBe("GENERAL UNDER HONORABLE CONDITIONS");
  });

  it("does not read the Adjutant General's signature block as a General discharge", async () => {
    const result = await parseServiceRecord(
      "18. REMARKS GENERAL REMARKS: MEMBER TRANSFERRED. OFFICIAL: THE ADJUTANT GENERAL, STATE OF OREGON. NGB FORM 22",
      "NGB22",
    );
    expect(result.dischargeType).toBeNull();
  });

  it("still reads a plain HONORABLE characterization", async () => {
    const result = await parseServiceRecord(
      "24. CHARACTER OF SERVICE: HONORABLE 25. SEPARATION AUTHORITY: AR 635-200",
      "DD214",
    );
    expect(result.dischargeType).toBe("HONORABLE");
  });

  it("prefers the full phrase over the bare HONORABLE inside it", async () => {
    const result = await parseServiceRecord(
      "MEMBER SERVED. GENERAL - UNDER HONORABLE CONDITIONS. NGB FORM 56",
      "NGB22",
    );
    expect(result.dischargeType).toBe("GENERAL UNDER HONORABLE CONDITIONS");
  });
});

describe("saved rating effective dates render as real dates", () => {
  it("formatLocalDate rejects a prose date but accepts the stored ISO day", () => {
    expect(Number.isNaN(formatLocalDate("September 15, 2023").getTime())).toBe(
      true,
    );
    const stored = formatLocalDate("2023-09-15");
    expect(Number.isNaN(stored.getTime())).toBe(false);
    expect(stored.getFullYear()).toBe(2023);
    expect(stored.getMonth()).toBe(8);
    expect(stored.getDate()).toBe(15);
  });
});
