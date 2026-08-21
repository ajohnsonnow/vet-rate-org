/**
 * Regression: on real (not clean-synthetic) DD214/NGB22 scans run through
 * the Florence-2 Vision AI OCR path, the "NAME (Last, First, Middle):"
 * header frequently doesn't survive OCR intact - either the label text
 * garbles or Florence-2's spatial-to-linear text serialization scrambles
 * reading order. When that happens, extractName()'s first four
 * context-anchored patterns miss and it falls through to the unanchored
 * "just look for CAPS, CAPS anywhere" fallback, which then grabs the next
 * comma-separated capitalized phrase in the document - usually another
 * block's own field label. Confirmed live against 4 real scanned DD214/
 * NGB22 documents: 4/4 produced a garbage "name" pulled from boilerplate
 * (e.g. "DEPARTMENT, COMPOMENT AND" - literally Block 2's own label,
 * "DEPARTMENT, COMPONENT AND BRANCH", with a 1-letter OCR slip).
 */
import { describe, it, expect } from "vitest";
import dd214VisionParser from "./dd214VisionParser";

const { extractName, parseDD214Text } = dd214VisionParser;

describe("dd214VisionParser: extractName - real-world OCR failure modes", () => {
  it("does not capture Block 2's own field label as the veteran's name when the NAME header is missing", () => {
    // Simulates OCR that garbled/dropped the "1. NAME (Last, First,
    // Middle):" header entirely (common on real scans) but read Block 2's
    // label text intact, immediately followed by the real branch value.
    const text = [
      "CERTIFICATE OF RELEASE OR DISCHARGE FROM ACTIVE DUTY",
      "DEPARTMENT, COMPONENT AND BRANCH ARMY NATIONAL GUARD",
      "3. SOCIAL SECURITY NUMBER 000-00-0000",
    ].join("\n");

    const result = extractName(text);
    expect(result.lastName).not.toBe("DEPARTMENT");
    expect(result.firstName).not.toBe("COMPONENT");
    expect(result.value).toBeNull();
    expect(result.confidence).toBe(0);
  });

  it("does not capture Block 2's label even with a single-character OCR slip (COMPONENT -> COMPOMENT)", () => {
    const text = "DEPARTMENT, COMPOMENT AND BRANCH\nARMY NATIONAL GUARD";
    const result = extractName(text);
    expect(result.lastName).not.toBe("DEPARTMENT");
    expect(result.value).toBeNull();
  });

  it("rejects other real-world garbage patterns confirmed on live documents", () => {
    expect(extractName("NGB FORM 22, SEEES GARRISON").lastName).not.toBe(
      "FORM",
    );
    expect(
      extractName("RESERVE OBLIGATION TERM, DATE OF BIRTH 01 JAN 1990")
        .lastName,
    ).not.toBe("TERM");
  });

  it("still finds a real name via the unanchored fallback when the label is missing but no field-label text is nearby", () => {
    // The fallback pattern must keep working for its actual intended case:
    // a genuine "LASTNAME, FIRSTNAME MIDDLE" with no stopword collision.
    const text = "CERTIFICATE OF RELEASE\nWILLIAMS, JOHN ROBERT\n123-45-6789";
    const result = extractName(text);
    expect(result.lastName).toBe("WILLIAMS");
    expect(result.firstName).toBe("JOHN");
    expect(result.confidence).toBeGreaterThan(0);
  });

  it("still finds the name when the header is intact (unaffected by the fix)", () => {
    const text =
      "1. NAME (Last, First, Middle): WILLIAMS, JOHN ROBERT\n2. DEPARTMENT, COMPONENT AND BRANCH: ARMY";
    const result = extractName(text);
    expect(result.lastName).toBe("WILLIAMS");
    expect(result.firstName).toBe("JOHN");
    expect(result.middleName).toBe("ROBERT");
  });

  it("skips a rejected candidate and keeps searching later in the document for a real one", () => {
    // Field-label text appears first (would be wrongly grabbed by the old
    // unanchored fallback); the real name appears later with no header.
    const text =
      "DEPARTMENT, COMPONENT AND BRANCH ARMY\nWILLIAMS, JOHN ROBERT\n123-45-6789";
    const result = extractName(text);
    expect(result.lastName).toBe("WILLIAMS");
    expect(result.firstName).toBe("JOHN");
  });
});

describe("dd214VisionParser: parseDD214Text - end-to-end field-label rejection", () => {
  it("leaves fields.name null instead of populating it with a field label", () => {
    const text = [
      "CERTIFICATE OF RELEASE OR DISCHARGE FROM ACTIVE DUTY",
      "DEPARTMENT, COMPOMENT AND BRANCH ARMY NATIONAL GUARD",
    ].join("\n");
    const result = parseDD214Text(text);
    expect(result.fields.name).toBeNull();
    expect(result.fields.lastName).toBeNull();
  });
});
