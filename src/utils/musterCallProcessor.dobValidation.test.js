/**
 * S46 QA follow-up, item 4 (2026-09-24): _validateDateOfBirth returned
 * early on an unparseable date of birth instead of discarding it, so a
 * bad Box 5 match survived unvalidated instead of being dropped like
 * every other rejected DOB. Fixture values are synthetic.
 */
import { describe, it, expect } from "vitest";

globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

const { parseServiceRecord } = await import("./musterCallProcessor");

describe("parseServiceRecord: date of birth validation", () => {
  it("keeps a plausible date of birth consistent with the entry date", async () => {
    const text = `
1. NAME: DOE, JOHN ROBERT
5. DATE OF BIRTH: 19850101
12.a DATE ENTERED AD: 20050101
`;
    const result = await parseServiceRecord(text);
    expect(result.dateOfBirth).toBe("01/01/1985");
  });

  it("discards an unparseable date of birth instead of leaving the raw value in place", async () => {
    const text = `
1. NAME: DOE, JOHN ROBERT
5. DATE OF BIRTH: 99999999
12.a DATE ENTERED AD: 20050101
`;
    const result = await parseServiceRecord(text);
    expect(result.dateOfBirth).toBeNull();
  });

  it("still discards an implausibly-early date of birth (younger than minimum enlistment age at entry)", async () => {
    const text = `
1. NAME: DOE, JOHN ROBERT
5. DATE OF BIRTH: 20040101
12.a DATE ENTERED AD: 20050101
`;
    const result = await parseServiceRecord(text);
    expect(result.dateOfBirth).toBeNull();
  });
});
