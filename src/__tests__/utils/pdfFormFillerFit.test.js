/**
 * Nothing written to an official form is cut off. Every free-text answer
 * is measured against its box (the real box sizes and font sizes, from
 * fixtures/officialFormFields.json). An answer that does not fit goes on
 * in the form's remarks or continuation box with a line saying so, or its
 * box is left blank and the answer is reported. All values are invented.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import {
  _VA_FORM_FIELDS,
  _lastFillReport,
  fillForm21_0781,
  fillForm21_0966,
  fillForm21_10210,
  fillForm21_22,
  fillForm21_22a,
  fillForm21_4138,
  fillForm21_4142,
} from "../../utils/pdfFormFiller";
import {
  fillSyntheticForm,
  realFields,
} from "../helpers/syntheticOfficialForm";

afterEach(() => {
  vi.unstubAllGlobals();
});

const words = (prefix, count) =>
  Array.from(
    { length: count },
    (_, i) => `${prefix}${String(i + 1).padStart(2, "0")}`,
  ).join(" ");
const wordsOf = (text) =>
  text
    .replace(/\((?:continued|See)[^)]*\)|See Section 5, Remarks\./g, "")
    .match(/\S+/g) ?? [];
const helvetica = (await PDFDocument.create()).embedStandardFont(
  StandardFonts.Helvetica,
);

/** Every line written to a box is inside it, by an independent measure. */
function expectInsideItsBox(formNumber, form) {
  const real = realFields(formNumber);
  const outside = [];
  for (const [name, value] of Object.entries(form.filledByName())) {
    const field = real.get(name);
    if (field.max) continue;
    const [, , width, height] = field.box;
    const size = field.size || 10;
    const lines = value.split("\n");
    const roomForLines = field.multiline
      ? Math.floor((height - 2) / (size * 1.11))
      : 1;
    const widest = Math.max(
      ...lines.map((line) => helvetica.widthOfTextAtSize(line, size)),
    );
    if (lines.length > roomForLines || widest > width - 2) {
      outside.push(
        `${name}: ${lines.length} lines, widest ${widest.toFixed(0)}pt in ${width}x${height}`,
      );
    }
  }
  expect(outside).toEqual([]);
}

describe("21-0781 event boxes", () => {
  const LONG = {
    eventDescription: words("HAP", 120),
    eventLocation: words("LOC", 25),
    eventDate: words("DAT", 15),
  };

  it("puts a short description, place and date in their own boxes", async () => {
    const form = await fillSyntheticForm("21-0781", fillForm21_0781, {
      eventDescription: "A vehicle rolled over beside me",
      eventLocation: "Camp Placeholder",
      eventDate: "July 2011",
    });

    expect(form.text("stressor1Description")).toBe(
      "A vehicle rolled over beside me",
    );
    expect(form.text("stressor1Location")).toBe("Camp Placeholder");
    expect(form.text("stressor1Dates")).toBe("July 2011");
    expect(_lastFillReport().moved).toEqual([]);
    expectInsideItsBox("21-0781", form);
  });

  it("carries answers too long for their boxes to Remarks, in full, and says so", async () => {
    const form = await fillSyntheticForm("21-0781", fillForm21_0781, LONG);
    const remarks = form.text("remarks");

    for (const key of [
      "stressor1Description",
      "stressor1Location",
      "stressor1Dates",
    ]) {
      expect(form.text(key)).toBe("See Section 5, Remarks.");
    }
    for (const typed of Object.values(LONG)) {
      expect(wordsOf(remarks).join(" ")).toContain(typed);
    }
    expect(_lastFillReport().moved).toEqual([
      "Description of the traumatic event (item 9A)",
      "Location of the traumatic event (item 9B)",
      "Date of the traumatic event (item 9C)",
    ]);
    expect(_lastFillReport().overflow).toBe("");
    expectInsideItsBox("21-0781", form);
  });

  it("reports what Remarks cannot hold either, and drops no word", async () => {
    const eventDescription = words("HAP", 900);
    const form = await fillSyntheticForm("21-0781", fillForm21_0781, {
      eventDescription,
    });
    const { overflow } = _lastFillReport();

    expect(overflow.length).toBeGreaterThan(500);
    expect(form.text("remarks")).toMatch(/\(continued in the text download\)$/);
    expect(
      [...wordsOf(form.text("remarks")), ...wordsOf(overflow)].join(" "),
    ).toContain(eventDescription);
    expectInsideItsBox("21-0781", form);
  });
});

describe("21-4138 remarks", () => {
  it("fits the first box for a short statement, with page 2 empty", async () => {
    const form = await fillSyntheticForm("21-4138", fillForm21_4138, {
      conditionName: "Tinnitus",
      workImpact: "I miss about two shifts a month",
    });

    expect(form.text("remarks")).toContain(
      "Effect on my work: I miss about two shifts a month",
    );
    expect(form.text("remarksPage2")).toBe("");
    expectInsideItsBox("21-4138", form);
  });

  it("carries a 3,600-character statement to page 2 with every line inside the box", async () => {
    const remarks = words("WST", 600);
    expect(remarks.length).toBeGreaterThan(3500);
    const form = await fillSyntheticForm("21-4138", fillForm21_4138, {
      remarks,
    });
    const first = form.text("remarks");
    const second = form.text("remarksPage2");

    expect(first).toMatch(/\(continued on page 2\)$/);
    expect(second.length).toBeGreaterThan(500);
    expect([...wordsOf(first), ...wordsOf(second)]).toEqual(wordsOf(remarks));
    expect(_lastFillReport().overflow).toBe("");
    expectInsideItsBox("21-4138", form);
    const [, , width] = realFields("21-4138").get(
      _VA_FORM_FIELDS["21-4138"].remarksPage2,
    ).box;
    for (const line of second.split("\n")) {
      expect(helvetica.widthOfTextAtSize(line, 10)).toBeLessThan(width * 0.95);
    }
  });

  it("reports what neither box holds, and drops no word", async () => {
    const remarks = words("WST", 2500);
    const form = await fillSyntheticForm("21-4138", fillForm21_4138, {
      remarks,
    });
    const { overflow } = _lastFillReport();

    expect(overflow.length).toBeGreaterThan(1000);
    expect(form.text("remarksPage2")).toMatch(
      /\(continued in the text download\)$/,
    );
    expect([
      ...wordsOf(form.text("remarks")),
      ...wordsOf(form.text("remarksPage2")),
      ...wordsOf(overflow),
    ]).toEqual(wordsOf(remarks));
    expectInsideItsBox("21-4138", form);
  });
});

describe("21-10210 statement", () => {
  it("carries a long statement to the continuation box on the next page", async () => {
    const whatObserved = words("OBS", 800);
    const form = await fillSyntheticForm("21-10210", fillForm21_10210, {
      whatObserved,
    });
    const first = form.text("statementContent");
    const second = form.text("statementContinued");

    expect(first).toMatch(/\(continued on the next page\)$/);
    expect(second.length).toBeGreaterThan(200);
    expect([...wordsOf(first), ...wordsOf(second)].join(" ")).toContain(
      whatObserved,
    );
    expectInsideItsBox("21-10210", form);
  });
});

describe("the country box", () => {
  it.each([
    ["United States", "US"],
    ["USA", "US"],
    ["united states of america", "US"],
    ["US", "US"],
    ["CA", "CA"],
  ])("writes %s as %s and reports nothing", async (country, written) => {
    const form = await fillSyntheticForm("21-4138", fillForm21_4138, {
      veteranName: "Marlow Testwright",
      country,
    });

    expect(form.text("country")).toBe(written);
    expect(_lastFillReport().leftBlank).toEqual([]);
  });

  it("writes no country and reports none when no answer gave one", async () => {
    for (const [formNumber, fill, key] of [
      ["21-4138", fillForm21_4138, "country"],
      ["21-0966", fillForm21_0966, "country"],
      ["21-22", fillForm21_22, "veteranCountry"],
      ["21-22a", fillForm21_22a, "veteranCountry"],
      ["21-10210", fillForm21_10210, "veteranCountry"],
    ]) {
      const form = await fillSyntheticForm(formNumber, fill, {
        veteranName: "Marlow Testwright",
      });
      expect([formNumber, form.text(key)]).toEqual([formNumber, ""]);
      expect(_lastFillReport()).toEqual({
        leftBlank: [],
        moved: [],
        overflow: "",
      });
    }
  });
});

describe("every free-text box on every form", () => {
  // Long answers for every free-text answer the wizards and fillers know.
  const LONG = {
    veteranName: "Marlow Q Testwright",
    veteranFirstName: "Marlow",
    veteranLastName: "Testwright",
    email: `${"a".repeat(70)}@example.invalid`,
    phone: "5550100200",
    street: words("STR", 12),
    city: "Nowhere",
    state: "KS",
    zip: "66000",
    insuranceNumber: words("INS", 30),
    vsoName: words("ORG", 60),
    representativeName: words("REP", 60),
    representativeTitle: words("TTL", 60),
    appointmentDate: "06/15/2025",
    claimantName: "Pat Example",
    claimantRelationship: words("REL", 40),
    repName: "Avery J Placeholder",
    repAddress: words("ADR", 12),
    conditionName: words("CND", 20),
    whatObserved: words("OBS", 200),
    howKnown: words("HOW", 100),
    eventDescription: words("HAP", 120),
    eventLocation: words("LOC", 25),
    eventDate: words("DAT", 15),
    symptomDetails: words("SYM", 200),
    worstDays: words("WST", 200),
    workImpact: words("WRK", 200),
    treatmentLocation: words("TRT", 60),
    policeReportLocation: words("POL", 60),
    otherReportText: words("OTH", 80),
    additionalBehavioralChanges: words("BEH", 300),
    witnessName: "Odalys Fenwick-Example",
    witnessEmail: `${"w".repeat(40)}@example.invalid`,
  };

  it.each([
    ["21-22", fillForm21_22],
    ["21-22a", fillForm21_22a],
    ["21-0966", fillForm21_0966],
    ["21-4142", fillForm21_4142],
    ["21-4138", fillForm21_4138],
    ["21-0781", fillForm21_0781],
    ["21-10210", fillForm21_10210],
  ])(
    "%s: what is written is inside its box, and the rest is reported",
    async (formNumber, fill) => {
      const form = await fillSyntheticForm(formNumber, fill, LONG);
      const report = _lastFillReport();

      expectInsideItsBox(formNumber, form);
      for (const value of report.leftBlank) {
        expect(form.allText()).not.toContain(value);
      }
    },
  );

  it("21-22 leaves a too-long organization name blank and reports it", async () => {
    const form = await fillSyntheticForm("21-22", fillForm21_22, LONG);

    expect(form.text("organizationName")).toBe("");
    expect(_lastFillReport().leftBlank).toContain(LONG.vsoName);
  });
});
