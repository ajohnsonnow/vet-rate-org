import { describe, it, expect } from "vitest";

// musterCallProcessor transitively imports pdfjs, which references canvas
// globals jsdom doesn't provide. Stub them so the module loads in the test
// environment (same pattern as musterCallProcessor.serviceRecord.test.js).
globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

const { parseServiceRecord } = await import(
  "../../utils/musterCallProcessor"
);

describe("FIX-3a: no fabricated deployments from DD214 boilerplate", () => {
  it("does not fabricate a Vietnam deployment from the preprinted POST-VIETNAM ERA education boilerplate", async () => {
    const text = `
1. NAME (Last, First, Middle): SMITH, JOHN ROBERT
2. DEPARTMENT, COMPONENT AND BRANCH: ARMY
5. DATE OF BIRTH: 04/12/1988
12a. DATE ENTERED AD THIS PERIOD: 06/01/2010
12b. DATE OF SEPARATION: 05/30/2015
18. REMARKS: POST-VIETNAM ERA VETERAN'S EDUCATIONAL ASSISTANCE PROGRAM (VEAP) PARTICIPANT.
23. TYPE OF SEPARATION: RELEASE FROM ACTIVE DUTY
24. CHARACTER OF SERVICE: HONORABLE
`;
    const result = await parseServiceRecord(text);
    expect(result.error).toBeUndefined();
    expect(result.deployments).not.toContain("VIETNAM");
    expect(result.deployments.length).toBe(0);
  });

  it("still extracts a real deployment mentioned in Box 18 remarks", async () => {
    const text = `
1. NAME (Last, First, Middle): SMITH, JOHN ROBERT
2. DEPARTMENT, COMPONENT AND BRANCH: ARMY
5. DATE OF BIRTH: 04/12/1988
12a. DATE ENTERED AD THIS PERIOD: 06/01/2010
12b. DATE OF SEPARATION: 05/30/2015
18. REMARKS: DEPLOYED TO IRAQ IN SUPPORT OF OPERATION IRAQI FREEDOM.
23. TYPE OF SEPARATION: RELEASE FROM ACTIVE DUTY
24. CHARACTER OF SERVICE: HONORABLE
`;
    const result = await parseServiceRecord(text);
    expect(result.error).toBeUndefined();
    expect(result.deployments).toContain("IRAQ");
  });

  it("rejects a deployment whose era predates the veteran's date of birth", async () => {
    const text = `
1. NAME (Last, First, Middle): SMITH, JOHN ROBERT
2. DEPARTMENT, COMPONENT AND BRANCH: ARMY
5. DATE OF BIRTH: 04/12/1988
12a. DATE ENTERED AD THIS PERIOD: 06/01/2010
12b. DATE OF SEPARATION: 05/30/2015
18. REMARKS: UNIT HISTORICALLY SERVED IN VIETNAM DURING PRIOR CONFLICTS.
23. TYPE OF SEPARATION: RELEASE FROM ACTIVE DUTY
24. CHARACTER OF SERVICE: HONORABLE
`;
    const result = await parseServiceRecord(text);
    expect(result.error).toBeUndefined();
    expect(result.deployments).not.toContain("VIETNAM");
  });

  it("extracts nothing from Box 18 when the box cannot be isolated (conservative fallback)", async () => {
    const text = `
1. NAME (Last, First, Middle): SMITH, JOHN ROBERT
2. DEPARTMENT, COMPONENT AND BRANCH: ARMY
5. DATE OF BIRTH: 04/12/1988
NO REMARKS BOX PRESENT ON THIS SYNTHETIC DOCUMENT. SERVED IN GERMANY.
23. TYPE OF SEPARATION: RELEASE FROM ACTIVE DUTY
24. CHARACTER OF SERVICE: HONORABLE
`;
    const result = await parseServiceRecord(text);
    expect(result.error).toBeUndefined();
    expect(result.deployments.length).toBe(0);
  });
});

describe("FIX-12: OCR-corrupted boilerplate must still be recognized and stripped", () => {
  it("does not fabricate a Vietnam deployment when 0-for-O OCR corruption hits POST-VIETNAM ERA boilerplate", async () => {
    // Real OCR artifact pattern: digit 0 substituted for letter O throughout.
    // The boilerplate-rejection regex (letter-only) used to be run against
    // the raw uncorrected text and missed "P0ST-VIETNAM ERA", while the
    // deployment-country matcher (immune to the corruption, since "VIETNAM"
    // has no letter O) still fired on the same corrupted string.
    const text = `
1. NAME (Last, First, Middle): SM1TH, J0HN R0BERT
2. DEPARTMENT, COMPONENT AND BRANCH: ARMY
5. DATE OF BIRTH: 04/12/1988
12a. DATE ENTERED AD THIS PERIOD: 06/01/2010
12b. DATE OF SEPARATION: 05/30/2015
18. REMARKS: 15.a. MEMBER C0NTRIBUTED T0 P0ST-VIETNAM ERA
VETERAN'S EDUCATI0NAL ASSISTANCE PR0GRAM
23. TYPE OF SEPARATION: RELEASE FROM ACTIVE DUTY
24. CHARACTER OF SERVICE: HONORABLE
`;
    const result = await parseServiceRecord(text);
    expect(result.error).toBeUndefined();
    expect(result.deployments).not.toContain("VIETNAM");
    expect(result.deployments).toHaveLength(0);
  });

  it("still extracts a real deployment even when its Box 18 text has 0-for-O OCR corruption elsewhere", async () => {
    const text = `
1. NAME (Last, First, Middle): SMITH, JOHN ROBERT
2. DEPARTMENT, COMPONENT AND BRANCH: ARMY
5. DATE OF BIRTH: 04/12/1988
12a. DATE ENTERED AD THIS PERIOD: 06/01/2010
12b. DATE OF SEPARATION: 05/30/2015
18. REMARKS: DEPL0YED T0 IRAQ IN SUPP0RT 0F 0PERATI0N IRAQI FREED0M.
23. TYPE OF SEPARATION: RELEASE FROM ACTIVE DUTY
24. CHARACTER OF SERVICE: HONORABLE
`;
    const result = await parseServiceRecord(text);
    expect(result.error).toBeUndefined();
    expect(result.deployments).toContain("IRAQ");
  });
});

describe("FIX-3b: no fabricated name from NGB22 boilerplate", () => {
  it("does not fabricate a name from 'FOR USE OF THIS FORM, SEE NGR' instructional text", async () => {
    const text = `
NATIONAL GUARD BUREAU
REPORT OF SEPARATION AND RECORD OF SERVICE
FOR USE OF THIS FORM, SEE NGR 600-200; THE PROPONENT AGENCY IS NGB-ARP.
2. DEPARTMENT, COMPONENT AND BRANCH: ARNGUS
`;
    const result = await parseServiceRecord(text, "NGB22");
    expect(result.error).toBeUndefined();
    expect(result.veteranName).toBeNull();
    expect(result.lastName).toBeNull();
    expect(result.formType).toBe("NGB22");
  });

  it("still extracts a real name from a properly anchored Box 1 on an NGB22", async () => {
    const text = `
NATIONAL GUARD BUREAU
1. NAME (Last, First, Middle): DOE, JANE MARIE
2. DEPARTMENT, COMPONENT AND BRANCH: ARNGUS
`;
    const result = await parseServiceRecord(text, "NGB22");
    expect(result.error).toBeUndefined();
    expect(result.lastName).toBe("DOE");
    expect(result.firstName).toBe("JANE");
    expect(result.formType).toBe("NGB22");
  });

  it("defaults formType to DD214 when not specified", async () => {
    const result = await parseServiceRecord("RANDOM TEXT WITH NO STRUCTURE");
    expect(result.formType).toBe("DD214");
  });
});

describe("FIX-14: Box 1 name extraction no longer breaks on a stray '2' before Box 2", () => {
  it("extracts a real name when a zip code (containing a '2') appears between Box 1 and Box 2", async () => {
    // The old bridge ([^2]*?) refused to cross ANY literal "2" character, so
    // a stray "2" anywhere before the real "2. DEPARTMENT" anchor — a zip
    // code, a unit number, a date — made the whole box1Match fail and no
    // name was ever extracted, even on a well-formed real document.
    const text = `
1. NAME (Last, First, Middle): JOHNSON, ANTHONY DANIEL
7B. HOME OF RECORD (Street, City, County, State, ZIP): PORTLAND OR 97214
2. DEPARTMENT, COMPONENT AND BRANCH: ARMY
`;
    const result = await parseServiceRecord(text);
    expect(result.error).toBeUndefined();
    expect(result.lastName).toBe("JOHNSON");
    expect(result.firstName).toBe("ANTHONY");
    expect(result.middleName).toBe("DANIEL");
  });

  it("corrects 0-for-O OCR corruption in the name itself, including words with two corrupted letters", async () => {
    // "J0HNS0N" has two embedded zeros — the document-wide OCR-fix pass's
    // \b([A-Z]+)0([A-Z]+)\b rule only ever replaces one 0 per word (it needs
    // a real \b word boundary on both sides of the run it corrects, and
    // there's no such boundary between the letters after the first zero and
    // the second zero — both are \w characters), so a double-corrupted name
    // was silently skipped by that general pass.
    const text = `
1. NAME (Last, First, Middle): J0HNS0N; ANTH0NY DANIEL
2. DEPARTMENT, COMPONENT AND BRANCH: ARMY
`;
    const result = await parseServiceRecord(text);
    expect(result.error).toBeUndefined();
    expect(result.lastName).toBe("JOHNSON");
    expect(result.firstName).toBe("ANTHONY");
  });

  it("still does not fabricate a name from NGB22 'FOR USE OF THIS FORM' boilerplate after the bridge fix (no regression)", async () => {
    const text = `
FOR USE OF THIS FORM, SEE NGR 600-200; THE PROPONENT AGENCY IS NGB-ARP
NATIONAL GUARD BUREAU
`;
    const result = await parseServiceRecord(text, "NGB22");
    expect(result.error).toBeUndefined();
    expect(result.lastName).toBeNull();
    expect(result.firstName).toBeNull();
  });
});
