/**
 * Two regressions from a live C-File audit:
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
  it.each([
    [
      "the NGB22 form rendering",
      "24. CHARACTER OF SERVICE GENERAL - UNDER HONORABLE CONDITIONS 25. SEPARATION AUTHORITY NGR 600-200",
    ],
    [
      "the zero-for-O OCR corruption a scanned form produces",
      "GENERAL - UNDER H0N0RABLE C0NDITI0NS       NGB F0RM 56",
    ],
    [
      "the full phrase even with a bare HONORABLE also present",
      "MEMBER SERVED. GENERAL - UNDER HONORABLE CONDITIONS. NGB FORM 56",
    ],
  ])(
    "normalizes %s to GENERAL UNDER HONORABLE CONDITIONS",
    async (_label, text) => {
      const result = await parseServiceRecord(text, "NGB22");
      expect(result.dischargeType).toBe("GENERAL UNDER HONORABLE CONDITIONS");
    },
  );

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

  // Regression (Vera re-verification, 2026-09-24): the standard DD-214 Box
  // 24 label reads "24. CHARACTER OF SERVICE (Include upgrades) HONORABLE"
  // - the "(Include upgrades)" instructional text is made of the same
  // [A-Z\s()-] characters the real value is, so it got captured as part of
  // the discharge type ("INCLUDE UPGRADES HONORABLE").
  it("does not read the '(Include upgrades)' label text as part of the characterization", async () => {
    const result = await parseServiceRecord(
      "24. CHARACTER OF SERVICE (Include upgrades) HONORABLE",
      "DD214",
    );
    expect(result.dischargeType).toBe("HONORABLE");
  });

  it("still reads a parenthetical GENERAL characterization alongside the '(Include upgrades)' label", async () => {
    const result = await parseServiceRecord(
      "24. CHARACTER OF SERVICE (Include upgrades) GENERAL (UNDER HONORABLE CONDITIONS) 25. SEPARATION AUTHORITY",
      "DD214",
    );
    expect(result.dischargeType).toBe("GENERAL UNDER HONORABLE CONDITIONS");
  });

  // Regression (Vera re-verification, 2026-09-24): an NGB-22 can render
  // Box 24 as "24. CHARACTER OF SERVICE" immediately followed by the NEXT
  // box's label ("25. TYPE OF CERTIFICATE USED"), with the real
  // characterization on a later OCR line ("GENERAL - UNDER HONORABLE
  // CONDITIONS") - the label-anchored pattern matched but captured nothing
  // but whitespace, and the loop broke there instead of trying the bare
  // GENERAL...UNDER HONORABLE CONDITIONS fallback that would have found it.
  it("finds the real characterization on a later line when Box 24's label captures nothing but whitespace", async () => {
    const result = await parseServiceRecord(
      "24. CHARACTER OF SERVICE                                   25. TYPE OF CERTIFICATE USED                   26. REENLISTMENT ELIGIBILITY\n" +
        "GENERAL - UNDER HONORABLE CONDITIONS",
      "NGB22",
    );
    expect(result.dischargeType).toBe("GENERAL UNDER HONORABLE CONDITIONS");
  });
});

describe("saved rating effective dates render as real dates", () => {
  it.each([["March 14, 2019"], ["2019-03-14"]])(
    "formatLocalDate reads %s as the same calendar day",
    (value) => {
      const stored = formatLocalDate(value);
      expect(stored.getFullYear()).toBe(2019);
      expect(stored.getMonth()).toBe(2);
      expect(stored.getDate()).toBe(14);
    },
  );
});
