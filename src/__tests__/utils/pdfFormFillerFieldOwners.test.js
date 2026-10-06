/**
 * Whose field is it? Each official form says so itself: every field has a
 * tooltip naming its item ("8. VETERAN'S TELEPHONE NUMBER"), and the items
 * run section by section. The filler's field map is held to that, for all
 * seven forms, so a veteran's answer can never be printed in the
 * claimant's section. The tooltips are in
 * fixtures/officialFormFields.json, read from the forms. All answers here
 * are invented.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import {
  _VA_FORM_FIELDS,
  fillForm21_22,
  fillForm21_22a,
} from "../../utils/pdfFormFiller";
import {
  fillSyntheticForm,
  itemNumberOf,
  realFields,
} from "../helpers/syntheticOfficialForm";

afterEach(() => {
  vi.unstubAllGlobals();
});

// The item numbers of each person's section, from the printed forms.
const SECTIONS = {
  "21-22": { veteran: [1, 9], claimant: [10, 14], organization: [15, 18] },
  "21-22a": { veteran: [1, 9], claimant: [10, 15], rep: [16, 16] },
  "21-0966": { veteran: [1, 9] },
  "21-4142": { veteran: [1, 6] },
  "21-4138": { veteran: [1, 8] },
  "21-0781": { veteran: [1, 7] },
  "21-10210": { veteran: [1, 8], claimant: [9, 16], witness: [18, 22] },
};
// Keys with no person in their name, on the forms where every identity
// field is the veteran's.
const VETERAN_ONLY_KEYS =
  /^(?:firstName|middleInitial|lastName|ssn\d|dob(?:Month|Day|Year)|vaFileNumber|serviceNumber|street|apt|city|state|country|zip\d|phone\w*|email|intlPhone)$/;
// A date beside a signature belongs to whoever signs, not to a section.
const SIGNING_DATE = /SignDate|^date(?:Month|Day|Year)$|^witnessDate/;
const ownerOf = (key) => {
  if (/^veteran/.test(key)) return "veteran";
  if (/^claimant/.test(key)) return "claimant";
  if (/^witness/.test(key)) return "witness";
  if (/^rep(?!resentativeEmail|resentativeName|resentativeTitle)/.test(key)) {
    return "rep";
  }
  if (/^(organization|representative(Email|Name|Title))/.test(key)) {
    return "organization";
  }
  return VETERAN_ONLY_KEYS.test(key) ? "veteran" : null;
};

describe.each(Object.keys(SECTIONS))("VA Form %s field map", (formNumber) => {
  const real = realFields(formNumber);
  const entries = Object.entries(_VA_FORM_FIELDS[formNumber]);

  it("names only fields the form has", () => {
    const missing = entries.filter(([, name]) => !real.has(name));
    expect(missing).toEqual([]);
  });

  it("puts each person's keys in that person's section of the form", () => {
    const misplaced = entries
      .map(([key, name]) => {
        const owner = ownerOf(key);
        const range = SECTIONS[formNumber][owner];
        const item = itemNumberOf(real.get(name));
        // Page-header copies of the SSN carry no item number.
        const skip = /^page\d/.test(key) || SIGNING_DATE.test(key);
        if (!owner || !range || item === null || skip) return null;
        return item >= range[0] && item <= range[1]
          ? null
          : `${key} is item ${item}: ${real.get(name).tip.slice(0, 60)}`;
      })
      .filter(Boolean);
    expect(misplaced).toEqual([]);
  });
});

describe("the veteran's contact details", () => {
  const VETERAN = {
    veteranFirstName: "Marlow",
    veteranLastName: "Testwright",
    phone: "5550100200",
    email: "marlow@example.invalid",
    street: "9 Sample Road",
    apt: "2",
    city: "Nowhere",
    state: "KS",
    zip: "66000",
    vaFileNumber: "123456789",
  };
  const itemsHolding = async (formNumber, fill) => {
    const form = await fillSyntheticForm(formNumber, fill, VETERAN);
    const real = realFields(formNumber);
    return Object.entries(form.filledByName()).map(([name, value]) => [
      itemNumberOf(real.get(name)),
      value,
    ]);
  };

  it("21-22: phone in item 8, email in item 9, address in item 7, nothing in items 10 to 14", async () => {
    const items = await itemsHolding("21-22", fillForm21_22);

    expect(items).toContainEqual([8, "5550100200"]);
    expect(items).toContainEqual([9, "marlow@example.invalid"]);
    expect(items).toContainEqual([7, "9 Sample Road"]);
    expect(items).toContainEqual([7, "Nowhere"]);
    expect(items.filter(([item]) => item >= 10 && item <= 14)).toEqual([]);
  });

  it("21-22a: phone in item 8, email in item 9, address in item 7, file number in item 3, nothing in items 10 to 15", async () => {
    const items = await itemsHolding("21-22a", fillForm21_22a);

    expect(items).toContainEqual([8, "555"]);
    expect(items).toContainEqual([8, "0200"]);
    expect(items).toContainEqual([9, "marlow@example.invalid"]);
    expect(items).toContainEqual([7, "9 Sample Road"]);
    expect(items).toContainEqual([3, "123456789"]);
    expect(items.filter(([item]) => item === 5)).toEqual([]);
    expect(items.filter(([item]) => item >= 10 && item <= 15)).toEqual([]);
  });

  it("21-22 never ticks a box in the part marked for VA use only", async () => {
    const form = await fillSyntheticForm("21-22", fillForm21_22, {
      ...VETERAN,
      authVRE: true,
      authEducation: true,
      vrAndEFile: true,
      eduFile: true,
      lgFile: true,
      insuranceFile: true,
    });

    expect(form.checkedKeys()).toEqual([]);
  });
});

describe("21-22a organization line", () => {
  it.each(["attorney", "claims-agent", undefined])(
    "is left blank for representative type %s: the line is the service-organization representative's",
    async (repType) => {
      const form = await fillSyntheticForm("21-22a", fillForm21_22a, {
        repType,
        repName: "Avery J Placeholder",
        repOrganization: "Placeholder Law Office",
      });

      expect(form.text("representativeOrganization")).toBe("");
      expect(form.text("firmName")).toBe("");
      expect(form.text("representativeLastName")).toBe("Placeholder");
    },
  );
});
