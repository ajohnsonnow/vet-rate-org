/**
 * The official PDF for each statement form holds every answer the wizard
 * collected: in its own field where the form has one, otherwise in the
 * form's remarks or statement area. A select prints its label or ticks its
 * box, never its stored code. Each field is given its own marker and the
 * produced PDF's field values are read back, against a stand-in PDF built
 * from the filler's own field map. All values are invented.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { _getFormStepsForForm } from "../../components/FormsHelper.jsx";
import {
  fillForm21_0781,
  fillForm21_10210,
  fillForm21_4138,
} from "../../utils/pdfFormFiller";
import { occurrences } from "../helpers/draftFileText";
import { fillEveryField } from "../helpers/formMarkers";
import { fillSyntheticForm } from "../helpers/syntheticOfficialForm";

afterEach(() => {
  vi.unstubAllGlobals();
});

const FORMS = [
  ["personal-statement", "21-4138", fillForm21_4138],
  ["ptsd-stressor", "21-0781", fillForm21_0781],
  ["buddy-statement", "21-10210", fillForm21_10210],
];
// A name is split across the form's name boxes and a phone number is
// reduced to its digits, so those are checked apart from the markers.
const SPLIT_ACROSS_BOXES = ["veteranName", "witnessName", "witnessPhone"];
// A select the form has a tick box for.
const TICKS = { witnessRelation: "relationServedWith" };
const STORED_CODES =
  /fellow-service-member|fear-hostile|know-before-after|personal-assault|witnessed-incident/;

describe.each(FORMS)("%s on VA Form %s", (formType, formNumber, fill) => {
  const { formData, markers } = fillEveryField(
    _getFormStepsForForm({ id: formType }),
  );
  const filled = () => fillSyntheticForm(formNumber, fill, formData);

  it.each(
    markers.filter(
      (marker) =>
        !SPLIT_ACROSS_BOXES.includes(marker.name) && !TICKS[marker.name],
    ),
  )("holds the answer to $name exactly once", async ({ printed }) => {
    const form = await filled();
    expect(occurrences(form.allText(), printed)).toBe(1);
  });

  it("prints labels, never stored codes", async () => {
    const form = await filled();
    expect(form.allText()).not.toMatch(STORED_CODES);
  });

  it("puts the veteran's name in the name boxes", async () => {
    const form = await filled();
    const key = formType === "buddy-statement" ? "veteranFirstName" : null;
    const first =
      key ?? (formType === "ptsd-stressor" ? "veteranFirstName" : "firstName");
    expect(form.text(first)).toBe(formData.veteranName.split(" ")[0]);
  });
});

describe("VA Form 21-10210 relationship", () => {
  it.each([
    ["fellow-service-member", "relationServedWith", ""],
    ["supervisor", "relationServedWith", ""],
    ["spouse", "relationFamilyFriend", ""],
    ["family", "relationFamilyFriend", ""],
    ["friend", "relationFamilyFriend", ""],
    ["coworker", "relationCoworker", ""],
    ["caregiver", "relationOther", "Caregiver"],
    ["other", "relationOther", ""],
  ])("%s ticks %s", async (witnessRelation, box, otherText) => {
    const form = await fillSyntheticForm("21-10210", fillForm21_10210, {
      witnessRelation,
    });

    expect(form.checkedKeys()).toEqual([box]);
    expect(form.text("relationOtherText")).toBe(otherText);
  });

  it("does not enter the witness as the claimant", async () => {
    const form = await fillSyntheticForm("21-10210", fillForm21_10210, {
      veteranName: "Marlow Testwright",
      witnessName: "Odalys Fenwick-Example",
      witnessEmail: "qa@example.invalid",
    });

    expect(form.text("witnessLastName")).toBe("Fenwick-Example");
    expect(form.text("claimantLastName")).toBe("");
    expect(form.text("claimantEmail")).toBe("");
  });
});

describe("VA Form 21-0781 type of stressor", () => {
  it.each([
    ["combat", "combatTraumatic"],
    ["mst", "personalTraumaticMST"],
    ["personal-assault", "personalTraumaticNonMST"],
    ["other", "otherTraumatic"],
  ])("%s ticks %s", async (stressorType, box) => {
    const form = await fillSyntheticForm("21-0781", fillForm21_0781, {
      stressorType,
    });
    expect(form.checkedKeys()).toEqual([box]);
  });

  it.each([
    ["accident", "Serious Accident/Injury"],
    ["death", "Witnessing Death or Serious Injury"],
    ["fear-hostile", "Fear of Hostile Military/Terrorist Activity"],
  ])(
    "%s has no box of its own: none is ticked and the label goes in Remarks",
    async (stressorType, label) => {
      const form = await fillSyntheticForm("21-0781", fillForm21_0781, {
        stressorType,
      });
      expect(form.checkedKeys()).toEqual([]);
      expect(form.text("remarks")).toContain(`Type of stressor: ${label}`);
    },
  );

  it("puts the event, its date and its place in the form's own boxes", async () => {
    const form = await fillSyntheticForm("21-0781", fillForm21_0781, {
      eventDescription: "A vehicle rolled over beside me",
      eventDate: "July 2016",
      eventLocation: "Camp Placeholder",
    });

    expect(form.text("stressor1Description")).toBe(
      "A vehicle rolled over beside me",
    );
    expect(form.text("stressor1Dates")).toBe("July 2016");
    expect(form.text("stressor1Location")).toBe("Camp Placeholder");
  });
});
