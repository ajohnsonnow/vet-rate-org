/**
 * An official form carries only what the veteran answered. No consent or
 * authorization box is ticked, no signing date is entered and no country
 * is assumed unless the answer was given. Checked on every official form
 * the filler fills, against a stand-in PDF built from the filler's own
 * field map. All values are invented.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import {
  fillForm20_10207,
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

const FORMS = [
  ["21-10210", fillForm21_10210],
  ["21-4138", fillForm21_4138],
  ["21-0781", fillForm21_0781],
  ["21-0966", fillForm21_0966],
  ["21-4142", fillForm21_4142],
  ["20-10207", fillForm20_10207],
  ["21-22", fillForm21_22],
  ["21-22a", fillForm21_22a],
];

// What a wizard can hold without the veteran having consented to anything.
const IDENTITY_ONLY = {
  veteranName: "Marlow Q Testwright",
  veteranFirstName: "Marlow",
  veteranLastName: "Testwright",
  witnessName: "Odalys Fenwick-Example",
  conditionName: "Tinnitus",
};

describe.each(FORMS)("official form %s", (formNumber, fill) => {
  it("is left empty when nothing was answered", async () => {
    const form = await fillSyntheticForm(formNumber, fill, {});

    expect(form.checkedKeys()).toEqual([]);
    expect(form.filledTextKeys()).toEqual([]);
  });

  it("ticks no box and enters no signing date or country from a name alone", async () => {
    const form = await fillSyntheticForm(formNumber, fill, IDENTITY_ONLY);

    expect(form.checkedKeys()).toEqual([]);
    expect(
      form.filledTextKeys().filter((key) => /sign|date|country/i.test(key)),
    ).toEqual([]);
  });
});

describe("a consent or authorization box is ticked only on an explicit yes", () => {
  it.each([
    ["21-0781", fillForm21_0781, "consentVBA", "consentVBA"],
    ["21-22", fillForm21_22, "authorizeDisclosure", "authorizeDisclosure"],
    [
      "21-22a",
      fillForm21_22a,
      "authorizeRecordAccess",
      "authorizeRecordAccess",
    ],
    ["21-22a", fillForm21_22a, "authorizeActOnBehalf", "authorizeActOnBehalf"],
    ["21-22a", fillForm21_22a, "authorizeDisclosure", "authorizeDisclosure1"],
  ])("%s %s", async (formNumber, fill, answer, box) => {
    for (const notYes of [undefined, null, "", "yes", 1, false]) {
      const form = await fillSyntheticForm(formNumber, fill, {
        [answer]: notYes,
      });
      expect([notYes, form.checked(box)]).toEqual([notYes, false]);
    }
    const yes = await fillSyntheticForm(formNumber, fill, { [answer]: true });
    expect(yes.checked(box)).toBe(true);
    expect(yes.checkedKeys()).toEqual([box]);
  });

  it("21-0781 has four consent boxes and none is ticked for the wizard's answers", async () => {
    const form = await fillSyntheticForm("21-0781", fillForm21_0781, {
      ...IDENTITY_ONLY,
      stressorType: "combat",
      eventDescription: "A vehicle rolled over beside me on the range",
    });

    for (const box of [
      "consentVBA",
      "noConsentVBA",
      "revokeConsent",
      "notEnrolledVHA",
    ]) {
      expect([box, form.checked(box)]).toEqual([box, false]);
    }
  });
});
