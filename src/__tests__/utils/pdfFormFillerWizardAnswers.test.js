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
      "",
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
    const form = await fillSyntheticForm("21-22", fillForm21_22, {
      veteranFirstName: "Bartholomew-James",
      veteranLastName: "Testwright",
    });

    expect(form.text("veteranFirstName")).toBe("");
    expect(form.text("veteranLastName")).toBe("Testwright");
    expect(_lastFillReport().leftBlank).toEqual(["Veteran first name"]);
  });

  it("reports nothing when everything fitted", async () => {
    await fillSyntheticForm("21-22", fillForm21_22, {
      veteranFirstName: "Marlow",
    });

    expect(_lastFillReport()).toEqual({
      leftBlank: [],
      moved: [],
      textOnly: [],
      notPlaced: [],
      overflow: "",
    });
  });
});

describe("an e-mail address on a form with two short lines for it", () => {
  it.each([
    [
      "21-4138",
      fillForm21_4138,
      "email",
      "email",
      "emailLine2",
      "E-mail address (item 7)",
    ],
    [
      "21-0966",
      fillForm21_0966,
      "email",
      "email",
      "emailLine2",
      "E-mail address (item 9)",
    ],
    [
      "21-10210",
      fillForm21_10210,
      "witnessEmail",
      "witnessEmail",
      "witnessEmailLine2",
      "Witness e-mail address (item 21)",
    ],
  ])(
    "%s: fits line 1, runs on to line 2, or is left blank and reported",
    async (formNumber, fill, answer, line1, line2, label) => {
      const short = await fillSyntheticForm(formNumber, fill, {
        [answer]: "qa@example.invalid",
      });
      expect(values(short, [line1, line2])).toEqual(["qa@example.invalid", ""]);

      const longer = await fillSyntheticForm(formNumber, fill, {
        [answer]: "marlow.testwright@example.invalid",
      });
      expect(values(longer, [line1, line2])).toEqual([
        "marlow.testwright@ex",
        "ample.invalid",
      ]);

      const tooLong = `${"a".repeat(40)}@example.invalid`;
      const blank = await fillSyntheticForm(formNumber, fill, {
        [answer]: tooLong,
      });
      expect(values(blank, [line1, line2])).toEqual(["", ""]);
      expect(_lastFillReport().leftBlank).toEqual([label]);
      expect(JSON.stringify(_lastFillReport())).not.toContain("aaaa");
    },
  );
});
