/**
 * VA Form 20-10207 (priority processing). The reasons the veteran picked
 * tick the form's item 17 boxes by the wizard's exact wording, never by a
 * word found inside an answer, and a reason with no box of the same meaning
 * ticks nothing. The veteran's details go in the veteran's items. Read back
 * from a stand-in built from the real form's field list. All values are
 * invented.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { _getFormStepsForForm } from "../../components/FormsHelper.jsx";
import { _lastFillReport, fillForm20_10207 } from "../../utils/pdfFormFiller";
import {
  fillSyntheticForm,
  itemNumberOf,
  realFields,
} from "../helpers/syntheticOfficialForm";

afterEach(() => {
  vi.unstubAllGlobals();
});

const filled = (data) => fillSyntheticForm("20-10207", fillForm20_10207, data);
const OPTIONS = _getFormStepsForForm({ id: "priority-processing" })
  .flatMap((step) => step.fields)
  .find((field) => field.name === "priorityReasons").options;
const BOX_FOR = {
  "Terminal illness (life expectancy of 6 months or less)":
    "17. TERMINALLY ILL.",
  "ALS (Amyotrophic Lateral Sclerosis) diagnosis":
    "17. DIAGNOSED WITH AMYOTROPHIC LATERAL SCLEROSIS",
  "Age 85 or older": "17. 85 YEARS OF AGE OR OLDER.",
  "Medal of Honor recipient": "17. MEDAL OF HONOR / PURPLE HEART RECIPIENT.",
  "Purple Heart recipient": "17. MEDAL OF HONOR / PURPLE HEART RECIPIENT.",
  "Former Prisoner of War (POW)": "17. FORMER PRISONER OF WAR",
  "Experiencing extreme financial hardship":
    "EXPERIENCING EXTREME FINANCIAL HARDSHIP.",
  "Very Seriously Injured/Ill (VSI) or Seriously Injured/Ill (SI)":
    "17. VERY SERIOUSLY INJURED / ILL OR SERIOUSLY ILL / INJURED",
};
const tickedTips = (form) => {
  const real = realFields("20-10207");
  return form.checkedKeys().map((key) => real.get(form.fieldName(key)).tip);
};

describe("20-10207 reasons for the request", () => {
  it.each(OPTIONS)("%s ticks its own box, or none", async (option) => {
    const tips = tickedTips(await filled({ priorityReasons: [option] }));

    if (BOX_FOR[option]) {
      expect(tips).toHaveLength(1);
      expect(tips[0]).toContain(BOX_FOR[option]);
    } else {
      expect(tips).toEqual([]);
    }
  });

  it("has a box for exactly eight of the wizard's thirteen reasons", () => {
    expect(OPTIONS).toHaveLength(13);
    expect(OPTIONS.filter((option) => BOX_FOR[option])).toHaveLength(8);
  });

  it.each([
    [["I am not terminally ill, not 85 and do not have ALS"]],
    [["financial"]],
    [["extreme"]],
    [["terminal illness (life expectancy of 6 months or less)"]],
    [[]],
    [undefined],
    ["Age 85 or older"],
  ])("ticks nothing for %j", async (priorityReasons) => {
    const form = await filled({ priorityReasons });

    expect(form.checkedKeys()).toEqual([]);
  });

  it("ticks one box each for several reasons", async () => {
    const form = await filled({
      priorityReasons: [
        "Age 85 or older",
        "Purple Heart recipient",
        "Medal of Honor recipient",
        "Homeless or at imminent risk of homelessness",
      ],
    });

    expect(form.checkedKeys()).toEqual([
      "reasonMedalOfHonorOrPurpleHeart",
      "reason85OrOlder",
    ]);
  });
});

describe("20-10207 veteran's details", () => {
  const VETERAN = {
    veteranName: "Marlow Q Testwright",
    ssn: "900-12-3456",
    dob: "1980-02-03",
    vaFileNumber: "123456789",
    phone: "555-010-0200",
    email: "marlow.testwright@example.invalid",
    street: "9 Sample Road",
    apt: "Apt 2",
    city: "Nowhere",
    state: "KS",
    zip: "66000",
  };

  it("go in items 1 to 8, with nothing in the claimant's items", async () => {
    const form = await filled(VETERAN);
    const real = realFields("20-10207");
    const items = Object.entries(form.filledByName()).map(([name, value]) => [
      itemNumberOf(real.get(name)),
      value,
    ]);

    expect(items).toContainEqual([2, "3456"]);
    expect(items).toContainEqual([3, "1980"]);
    expect(items).toContainEqual([4, "123456789"]);
    expect(items).toContainEqual([6, "9 Sample Road"]);
    expect(items).toContainEqual([6, "2"]);
    expect(items).toContainEqual([7, "0200"]);
    expect(items).toContainEqual([8, "marlow.testwright@examp"]);
    expect(items).toContainEqual([8, "le.invalid"]);
    expect(items.filter(([item]) => item >= 9 && item <= 16)).toEqual([]);
    expect(form.text("veteranFirstName")).toBe("Marlow");
    expect(form.text("veteranLastName")).toBe("Testwright");
    expect(_lastFillReport().notPlaced).toEqual([]);
  });

  it("repeats the Social Security number in the page headers", async () => {
    const form = await filled(VETERAN);

    for (const boxes of ["page4SSN", "page5SSN"]) {
      expect([1, 2, 3].map((n) => form.text(`${boxes}${n}`))).toEqual([
        "900",
        "12",
        "3456",
      ]);
    }
  });

  it("sets no date beside a signature and ticks nothing unasked", async () => {
    const form = await filled(VETERAN);

    expect(form.checkedKeys()).toEqual([]);
    expect(
      Object.keys(form.filledByName()).filter((name) => /Signed/.test(name)),
    ).toEqual([]);
  });
});
