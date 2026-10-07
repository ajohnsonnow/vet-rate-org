/**
 * D20-3: confident-or-empty for identifier fields. A captured value made only
 * of the form's own printed label/instruction wording must never be shown as
 * the veteran's home of record, mailing address or name. Fixtures are generic
 * noisy label layouts - no real data.
 */
import { describe, it, expect } from "vitest";
import { extractDD214Fields } from "./dd214FieldExtractor";

const NOISY_HOME_OF_RECORD_LAYOUTS = [
  [
    "label fragments split across lines before the next box",
    "7B. HOME OF RECORD AT TIME OF ENTRY\nCITY AND STATE, OR COMPLETE\nADDRESS IF KNOWN ZIP CODE\n8A. LAST DUTY ASSIGNMENT\n",
  ],
  [
    "hint without parentheses followed by only the ZIP CODE caption",
    "7.B HOME OF RECORD: CITY AND STATE, OR COMPLETE ADDRESS IF KNOWN\nZIP CODE\n8. NEXT BOX\n",
  ],
  [
    "bare label vocabulary on a flattened page",
    "7B. HOME OF RECORD STREET CITY STATE ZIP CODE 8A. LAST DUTY ASSIGNMENT AND MAJOR COMMAND HHC",
  ],
  [
    "caption words only, colon separated",
    "HOME OF RECORD: COMPLETE ADDRESS IF KNOWN, CITY, STATE\n9. COMMAND TO WHICH TRANSFERRED\n",
  ],
];

describe("D20-3: home of record is never the form's own label text", () => {
  it.each(NOISY_HOME_OF_RECORD_LAYOUTS)("%s", (_label, text) => {
    const { fields } = extractDD214Fields(text);
    expect(fields.homeOfRecord).toBeUndefined();
  });

  it("a value with no plausible city/state shape is rejected", () => {
    const { fields } = extractDD214Fields(
      "7B. HOME OF RECORD: NOT RECORDED ON THIS COPY\n8A. LAST DUTY\n",
    );
    expect(fields.homeOfRecord).toBeUndefined();
  });

  it("a real city/state value next to the noisy captions is still found", () => {
    const { fields } = extractDD214Fields(
      "7B. HOME OF RECORD AT TIME OF ENTRY (City and State, or complete address if known)\nSPRINGFIELD, IL 62704\n8A. LAST DUTY ASSIGNMENT\n",
    );
    expect(fields.homeOfRecord).toBe("SPRINGFIELD, IL 62704");
  });
});

describe("D20-3: mailing address and name reject printed label vocabulary", () => {
  it("a mailing address made of caption words is rejected", () => {
    const { fields } = extractDD214Fields(
      "19. MAILING ADDRESS AFTER SEPARATION\nSTREET, CITY, STATE, ZIP CODE INCLUDE\n20. SEPARATION CODE: MBK\n",
    );
    expect(fields.mailingAddress).toBeUndefined();
  });

  it("a mailing address with no digits and no city/state shape is rejected", () => {
    const { fields } = extractDD214Fields(
      "19. MAILING ADDRESS: SEE ATTACHED SHEET FOR DETAILS\n20. SEPARATION CODE: MBK\n",
    );
    expect(fields.mailingAddress).toBeUndefined();
  });

  it("a name made of caption words is rejected", () => {
    const { fields } = extractDD214Fields("1. NAME: LAST FIRST MIDDLE\n");
    expect(fields.fullName).toBeUndefined();
    expect(fields.lastName).toBeUndefined();
  });
});
