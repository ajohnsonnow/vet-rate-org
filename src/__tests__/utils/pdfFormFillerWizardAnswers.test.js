/**
 * The official PDFs take the answers in the shape the wizards collect them:
 * the last four digits of a Social Security number, a date from a date
 * picker, a name in three boxes. Checked by filling a stand-in PDF built
 * from the filler's own field map (digit boxes with the real maximum
 * lengths) and reading the field values back. All values are invented.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import {
  _lastFillReport,
  fillForm21_0781,
  fillForm21_0966,
  fillForm21_10210,
  fillForm21_22,
  fillForm21_22a,
  fillForm21_4138,
  fillForm21_4142,
} from "../../utils/pdfFormFiller";
import { fillSyntheticForm } from "../helpers/syntheticOfficialForm";

afterEach(() => {
  vi.unstubAllGlobals();
});

const values = (form, keys) => keys.map((key) => form.text(key));

describe.each([
  ["21-22", fillForm21_22, ["veteranSSN1", "veteranSSN2", "veteranSSN3"]],
  ["21-22", fillForm21_22, ["page2SSN1", "page2SSN2", "page2SSN3"]],
  ["21-22a", fillForm21_22a, ["veteranSSN1", "veteranSSN2", "veteranSSN3"]],
  ["21-22a", fillForm21_22a, ["page2SSN1", "page2SSN2", "page2SSN3"]],
  ["21-0966", fillForm21_0966, ["veteranSSN1", "veteranSSN2", "veteranSSN3"]],
])("Social Security number on %s (%s)", (formNumber, fill, boxes) => {
  it("puts a last-four answer in the last-four box only", async () => {
    const form = await fillSyntheticForm(formNumber, fill, { ssn: "1213" });

    expect(values(form, boxes)).toEqual(["", "", "1213"]);
  });

  it("fills all three boxes from a full number", async () => {
    const form = await fillSyntheticForm(formNumber, fill, {
      ssn: "900-12-3456",
    });

    expect(values(form, boxes)).toEqual(["900", "12", "3456"]);
  });

  it.each(["12", "12345", "1234567890", "abcd"])(
    "leaves every box blank for %s, which is neither",
    async (ssn) => {
      const form = await fillSyntheticForm(formNumber, fill, { ssn });

      expect(values(form, boxes)).toEqual(["", "", ""]);
    },
  );
});

describe.each([
  [
    "21-22",
    fillForm21_22,
    "dob",
    ["veteranDOBMonth", "veteranDOBDay", "veteranDOBYear"],
  ],
  [
    "21-22a",
    fillForm21_22a,
    "dob",
    ["veteranDOBMonth", "veteranDOBDay", "veteranDOBYear"],
  ],
  [
    "21-22a",
    fillForm21_22a,
    "claimantDOB",
    ["claimantDOBMonth", "claimantDOBDay", "claimantDOBYear"],
  ],
  [
    "21-0966",
    fillForm21_0966,
    "dob",
    ["veteranDOBMonth", "veteranDOBDay", "veteranDOBYear"],
  ],
  [
    "21-10210",
    fillForm21_10210,
    "veteranDOB",
    ["veteranDOBMonth", "veteranDOBDay", "veteranDOBYear"],
  ],
  ["21-4138", fillForm21_4138, "dob", ["dobMonth", "dobDay", "dobYear"]],
  ["21-0781", fillForm21_0781, "dob", ["dobMonth", "dobDay", "dobYear"]],
  ["21-4142", fillForm21_4142, "dob", ["dobMonth", "dobDay", "dobYear"]],
])("date of birth on %s (%s)", (formNumber, fill, answer, boxes) => {
  it.each([
    ["2015-06-15", ["06", "15", "2015"]],
    ["06/15/2015", ["06", "15", "2015"]],
    ["6/5/2015", ["06", "05", "2015"]],
  ])("%s lands as month, day, year", async (date, expected) => {
    const form = await fillSyntheticForm(formNumber, fill, {
      claimantName: "Pat Example",
      [answer]: date,
    });

    expect(values(form, boxes)).toEqual(expected);
  });

  it("leaves the boxes blank for something that is not a full date", async () => {
    const form = await fillSyntheticForm(formNumber, fill, {
      claimantName: "Pat Example",
      [answer]: "June 2015",
    });

    expect(values(form, boxes)).toEqual(["", "", ""]);
  });
});

describe("names and addresses the wizards collect in parts", () => {
  const VETERAN = {
    veteranFirstName: "Marlow",
    veteranMiddleInitial: "Q",
    veteranLastName: "Testwright",
  };

  it.each([
    ["21-22", fillForm21_22],
    ["21-22a", fillForm21_22a],
  ])(
    "%s takes the veteran's name from its three answers",
    async (formNumber, fill) => {
      const form = await fillSyntheticForm(formNumber, fill, VETERAN);

      expect(
        values(form, [
          "veteranFirstName",
          "veteranMiddleInitial",
          "veteranLastName",
        ]),
      ).toEqual(["Marlow", "Q", "Testwright"]);
    },
  );

  it("21-22a takes the representative's name and address from the wizard", async () => {
    const form = await fillSyntheticForm("21-22a", fillForm21_22a, {
      repName: "Avery J Placeholder",
      repOrganization: "Placeholder Law Office",
      repAddress: "12 Example Street",
      repCity: "Nowhere",
      repState: "KS",
      repZip: "66000",
      repPhone: "5550100200",
      repEmail: "rep@example.invalid",
    });

    expect(
      values(form, [
        "representativeFirstName",
        "representativeMiddleInitial",
        "representativeLastName",
        "representativeOrganization",
        "repStreet",
        "repCity",
        "repState",
        "repZip5",
        "repEmail",
      ]),
    ).toEqual([
      "Avery",
      "J",
      "Placeholder",
      "Placeholder Law Office",
      "12 Example Street",
      "Nowhere",
      "KS",
      "66000",
      "rep@example.invalid",
    ]);
  });

  it("puts no one's address in the claimant section from the veteran's answers", async () => {
    for (const [formNumber, fill] of [
      ["21-22", fillForm21_22],
      ["21-22a", fillForm21_22a],
    ]) {
      const form = await fillSyntheticForm(formNumber, fill, {
        ...VETERAN,
        street: "9 Sample Road",
        city: "Nowhere",
      });
      expect(values(form, ["claimantStreet", "claimantCity"])).toEqual([
        "",
        "",
      ]);
    }
  });
});

describe("an answer too long for its box", () => {
  it("is left blank for the veteran to write in, and reported, not dropped in silence", async () => {
    const form = await fillSyntheticForm(
      "21-22",
      fillForm21_22,
      { veteranFirstName: "Bartholomew-James", veteranLastName: "Testwright" },
      { maxLengths: { veteranFirstName: 12 } },
    );

    expect(form.text("veteranFirstName")).toBe("");
    expect(form.text("veteranLastName")).toBe("Testwright");
    expect(_lastFillReport().leftBlank).toEqual(["Bartholomew-James"]);
  });

  it("reports nothing when everything fitted", async () => {
    await fillSyntheticForm("21-22", fillForm21_22, {
      veteranFirstName: "Marlow",
    });

    expect(_lastFillReport()).toEqual({ leftBlank: [], overflow: "" });
  });
});

describe("21-4138 remarks that do not fit the first box", () => {
  const sentence = (n) =>
    `Answer ${n} is a sentence long enough to take most of one line here.`;
  const statement = Array.from({ length: 30 }, (_, i) => sentence(i + 1));
  const wordsOf = (text) =>
    text.replace(/\(continued[^)]*\)/g, "").match(/\S+/g) ?? [];
  const BOX = { width: 320, height: 70 };

  it("carries over to the page 2 box, losing nothing", async () => {
    const remarks = statement.slice(0, 8).join(" ");
    const form = await fillSyntheticForm(
      "21-4138",
      fillForm21_4138,
      { remarks },
      { sizes: { remarks: BOX, remarksPage2: { width: 320, height: 400 } } },
    );
    const first = form.text("remarks");
    const second = form.text("remarksPage2");

    expect(first.split("\n").length).toBeLessThanOrEqual(5);
    expect(first).toMatch(/\(continued on page 2\)$/);
    expect(second.length).toBeGreaterThan(50);
    expect([...wordsOf(first), ...wordsOf(second)]).toEqual(wordsOf(remarks));
    expect(_lastFillReport().overflow).toBe("");
  });

  it("leaves page 2 empty when the statement fits the first box", async () => {
    const form = await fillSyntheticForm(
      "21-4138",
      fillForm21_4138,
      { remarks: statement[0] },
      { sizes: { remarks: BOX, remarksPage2: BOX } },
    );

    expect(form.text("remarks")).toBe(statement[0]);
    expect(form.text("remarksPage2")).toBe("");
  });

  it("reports what neither box could hold, and drops no word", async () => {
    const remarks = statement.join(" ");
    const form = await fillSyntheticForm(
      "21-4138",
      fillForm21_4138,
      { remarks },
      { sizes: { remarks: BOX, remarksPage2: BOX } },
    );
    const { overflow } = _lastFillReport();

    expect(overflow.length).toBeGreaterThan(100);
    expect(form.text("remarksPage2")).toMatch(
      /\(continued in the text download\)$/,
    );
    expect([
      ...wordsOf(form.text("remarks")),
      ...wordsOf(form.text("remarksPage2")),
      ...wordsOf(overflow),
    ]).toEqual(wordsOf(remarks));
  });
});
