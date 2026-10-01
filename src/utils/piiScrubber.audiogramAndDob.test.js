/**
 * D20-5 / D20-7: DOB shapes after a label, an unlabeled space-separated SSN,
 * and the audiogram rows that look like a credit card or an SSN. Every
 * positive case would leak on the base scrubber; every negative case was
 * wrongly redacted there. Fixtures are synthetic.
 */
import { describe, it, expect } from "vitest";
import { scrubText } from "./piiScrubber";

describe("D20-5: a labeled DOB is redacted in any common date format", () => {
  it.each([
    ["born 1984-03-15", "born 1984-03-15"],
    ["born on 1984-03-15", "born on 1984-03-15"],
    ["born 15 Mar 1984", "born 15 Mar 1984"],
    ["born 15 March 1984", "born 15 March 1984"],
    ["born on March 15, 1984", "born on March 15, 1984"],
    ["DOB 1984/03/15", "DOB 1984/03/15"],
    ["DOB: 15-MAR-1984", "DOB: 15-MAR-1984"],
    ["DOB is 03/15/1984", "DOB is 03/15/1984"],
    ["date of birth 19840315", "date of birth 19840315"],
    ["Date of Birth: 15th March 1984", "Date of Birth: 15th March 1984"],
  ])("%s", (_label, text) => {
    const out = scrubText(`Veteran, ${text}, filed a claim.`);
    expect(out).toContain("[REDACTED_DOB]");
    expect(out).not.toMatch(/1984|Mar/i);
  });

  it("does not redact ordinary dates that carry no birth label", () => {
    const out = scrubText("The exam was on 2021-06-01 and was reviewed.");
    expect(out).toContain("2021-06-01");
  });
});

describe("D20-7: an unlabeled space-separated SSN is caught", () => {
  it("redacts a 3-2-4 group in free-running prose", () => {
    const out = scrubText("Veteran record 123 45 6789 attached to the file.");
    expect(out).toContain("[REDACTED_SSN]");
    expect(out).not.toContain("6789");
  });

  it("still redacts the hyphenated form", () => {
    expect(scrubText("SSN on file is 123-45-6789.")).not.toContain("6789");
  });

  it("does not redact digits that continue a longer number", () => {
    const out = scrubText("Reference 1123 45 67890 is a part number.");
    expect(out).toContain("1123 45 67890");
  });
});

describe("D20-7: audiogram rows are not credit cards or SSNs", () => {
  it.each([
    [
      "frequency header row",
      "Frequency (Hz): 250 500 1000 2000 3000 4000 6000 8000",
    ],
    [
      "four-frequency card-shaped header",
      "Test frequencies 1000 2000 3000 4000",
    ],
    ["space-separated threshold triple", "Right ear 500 25 1000"],
    ["hyphenated threshold triple", "Left ear thresholds: 500-25-4000"],
    [
      "row with more than three numbers, all frequencies or thresholds",
      "R 250 15 4000 20 8000 35",
    ],
  ])("leaves the %s alone", (_label, row) => {
    expect(scrubText(row)).toBe(row);
  });

  it("still redacts a real card number", () => {
    const out = scrubText("Card 4111 1111 1111 1111 was charged.");
    expect(out).toContain("[REDACTED_CC]");
    expect(out).not.toContain("4111");
  });

  it("still redacts a Luhn-valid card number printed on an audiogram line", () => {
    const out = scrubText("Audiogram fee paid with 4111-1111-1111-1111 today");
    expect(out).toContain("[REDACTED_CC]");
  });

  it("still redacts a card-shaped number with no audiogram context", () => {
    const out = scrubText("Account 1234 5678 9012 3456 is on file.");
    expect(out).toContain("[REDACTED_CC]");
  });

  it("still redacts a real SSN that sits near audiogram wording", () => {
    const out = scrubText("Audiogram for SSN 123 45 6789 at 1000 Hz");
    expect(out).not.toContain("6789");
  });
});
