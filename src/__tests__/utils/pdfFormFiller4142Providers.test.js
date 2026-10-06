/**
 * VA Form 21-4142: the providers the wizard asks about go in the form's
 * provider items (9, 10 and 11, by each field's own tooltip): name,
 * conditions, dates of treatment and address. The form has no box for a
 * provider's telephone or fax number. A date or address the app cannot
 * turn into the form's boxes is left blank and reported by name. Read back
 * from a stand-in built from the real form's field list. All values are
 * invented.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { _lastFillReport, fillForm21_4142 } from "../../utils/pdfFormFiller";
import {
  fillSyntheticForm,
  itemNumberOf,
  realFields,
} from "../helpers/syntheticOfficialForm";

afterEach(() => {
  vi.unstubAllGlobals();
});

const filled = (data) => fillSyntheticForm("21-4142", fillForm21_4142, data);
const provider = (n, extra = {}) => ({
  [`provider${n}Name`]: `Clinic Number ${n}`,
  [`provider${n}Address`]: `${n}00 Medical Way\nSampleton, KS 66000`,
  [`provider${n}Phone`]: "555-010-0777",
  [`provider${n}Dates`]: "03/15/2019 - 06/30/2022",
  [`provider${n}Conditions`]: `Condition ${n}`,
  ...extra,
});
const dateBoxes = (form, n) =>
  ["FromMonth", "FromDay", "FromYear", "ToMonth", "ToDay", "ToYear"].map(
    (box) => form.text(`provider${n}${box}`),
  );
const addressBoxes = (form, n) =>
  ["Street", "Apt", "City", "State", "Zip5", "Zip4"].map((box) =>
    form.text(`provider${n}${box}`),
  );

describe("21-4142 providers", () => {
  it("puts each provider in its own item of the form", async () => {
    const form = await filled({
      ...provider(1),
      ...provider(2),
      ...provider(3),
    });
    const real = realFields("21-4142");
    const byItem = {};
    for (const [name, value] of Object.entries(form.filledByName())) {
      const item = itemNumberOf(real.get(name));
      byItem[item] = [...(byItem[item] ?? []), value];
    }

    for (const [item, n] of [
      [9, 1],
      [10, 2],
      [11, 3],
    ]) {
      expect(byItem[item]).toEqual(
        expect.arrayContaining([
          `Clinic Number ${n}`,
          `Condition ${n}`,
          `${n}00 Medical Way`,
          "Sampleton",
          "KS",
          "66000",
          "03",
          "15",
          "2019",
          "06",
          "30",
          "2022",
        ]),
      );
    }
    expect(_lastFillReport().notPlaced).toEqual([]);
    expect(_lastFillReport().leftBlank).toEqual([]);
  });

  it("writes a provider's phone and fax nowhere: the form has no box for them", async () => {
    const form = await filled(provider(1, { provider1Fax: "555-010-0888" }));

    expect(Object.values(form.filledByName()).join(" ")).not.toMatch(
      /0777|0888/,
    );
  });
});

describe("21-4142 provider answers the form takes in boxes", () => {
  it.each([
    ["03/15/2019 - 06/30/2022", ["03", "15", "2019", "06", "30", "2022"]],
    ["3/5/2019 to 2022-06-30", ["03", "05", "2019", "06", "30", "2022"]],
    ["01/05/2020 - Present", ["01", "05", "2020", "", "", ""]],
    ["01/05/2020", ["01", "05", "2020", "", "", ""]],
  ])("takes dates of treatment %s", async (typed, boxes) => {
    const form = await filled(provider(1, { provider1Dates: typed }));

    expect(dateBoxes(form, 1)).toEqual(boxes);
    expect(_lastFillReport().notPlaced).toEqual([]);
  });

  it.each([
    "January 2020 - Present",
    "03/2019 - 06/2022",
    "2019",
    "03/15/2019 - 06/30/2022 - 01/01/2024",
    "Present",
  ])("leaves the date boxes blank for %s and names them", async (typed) => {
    const form = await filled(provider(2, { provider2Dates: typed }));

    expect(dateBoxes(form, 2)).toEqual(["", "", "", "", "", ""]);
    expect(_lastFillReport().notPlaced).toEqual([
      "Provider 2 dates of treatment",
    ]);
  });

  it("leaves an address it cannot split blank and names it", async () => {
    const form = await filled(
      provider(3, { provider3Address: "300 Medical Way Sampleton Kansas" }),
    );

    expect(addressBoxes(form, 3)).toEqual(["", "", "", "", "", ""]);
    expect(_lastFillReport().notPlaced).toEqual(["Provider 3 address"]);
    expect(form.text("provider3Name")).toBe("Clinic Number 3");
  });

  it("leaves a name too long for its box blank and reports it", async () => {
    const long = Array.from({ length: 60 }, (_, i) => `Name${i}`).join(" ");
    const form = await filled(provider(1, { provider1Name: long }));

    expect(form.text("provider1Name")).toBe("");
    expect(_lastFillReport().leftBlank).toEqual(["Provider 1 name (item 9)"]);
  });

  it("writes nothing in the provider items when no provider was given", async () => {
    const form = await filled({ veteranName: "Marlow Q Testwright" });
    const real = realFields("21-4142");
    const items = Object.keys(form.filledByName()).map((name) =>
      itemNumberOf(real.get(name)),
    );

    expect(items.filter((item) => item >= 9)).toEqual([]);
    expect(_lastFillReport().notPlaced).toEqual([]);
  });
});

describe("21-4142 provider pages", () => {
  it("carry the veteran's identification and the Social Security number in each header", async () => {
    const form = await filled({
      veteranName: "Marlow Q Testwright",
      ssn: "900-12-3456",
      dob: "1980-02-03",
      vaFileNumber: "123456789",
    });

    expect(
      ["page4FirstName", "page4MiddleInitial", "page4LastName"].map(form.text),
    ).toEqual(["Marlow", "Q", "Testwright"]);
    expect(form.text("page4FileNumber")).toBe("123456789");
    expect(
      ["page4DobMonth", "page4DobDay", "page4DobYear"].map(form.text),
    ).toEqual(["02", "03", "1980"]);
    for (const boxes of ["page2SSN", "page4SSN", "page5SSN"]) {
      expect([1, 2, 3].map((n) => form.text(`${boxes}${n}`))).toEqual([
        "900",
        "12",
        "3456",
      ]);
    }
  });
});
