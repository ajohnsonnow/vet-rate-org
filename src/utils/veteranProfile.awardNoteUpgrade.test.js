/**
 * A second document that reports a higher award number for an award already in
 * service history raises the app's own generated note to that number. A note
 * the veteran edited is never touched, and a lower number never replaces a
 * higher one. Award names are invented.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { addAward, getServiceHistory } from "./veteranProfile";
import { awardNotesText, upgradedAwardNote } from "./dd214AwardRowText";

const NAME = "Sample Service Medal";
const generated = (deviceCount, devices = []) =>
  awardNotesText({ name: NAME, deviceCount, devices });
const savedNote = () => getServiceHistory().awards[0].notes;

describe("addAward on a second document", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("raises the generated note to the higher award number", () => {
    addAward({ name: NAME, notes: generated(2) });
    addAward({ name: NAME, notes: generated(4) });
    expect(savedNote()).toBe("4th award");
    expect(getServiceHistory().awards).toHaveLength(1);
  });

  it("keeps the saved devices text when it raises the number", () => {
    addAward({ name: NAME, notes: generated(2, ["M Device"]) });
    addAward({ name: NAME, notes: generated(3, ["V Device"]) });
    expect(savedNote()).toBe("3rd award; Devices: M Device");
  });

  it("leaves a note the veteran edited alone", () => {
    addAward({ name: NAME, notes: "2nd award, earned in the field" });
    addAward({ name: NAME, notes: generated(5) });
    expect(savedNote()).toBe("2nd award, earned in the field");
  });

  it("never lets a lower number replace a higher one", () => {
    addAward({ name: NAME, notes: generated(4) });
    addAward({ name: NAME, notes: generated(2) });
    expect(savedNote()).toBe("4th award");
    addAward({ name: NAME, notes: generated(4) });
    expect(savedNote()).toBe("4th award");
  });
});

describe("upgradedAwardNote", () => {
  it.each([
    ["2nd award", "4th award", "4th award"],
    ["2nd award", "", "2nd award"],
    ["2nd award", "Devices: M Device", "2nd award"],
    ["Devices: M Device", "2nd award", "2nd award; Devices: M Device"],
    [
      "2nd award; Devices: M Device",
      "11th award",
      "11th award; Devices: M Device",
    ],
    ["2nd award", "2nd award", "2nd award"],
    ["4th award", "3rd award", "4th award"],
    ["2nd award!", "4th award", "2nd award!"],
    ["2nd award earned twice", "4th award", "2nd award earned twice"],
    ["22nd award", "3rd award", "22nd award"],
    ["2nd award", "4th award and more", "2nd award"],
    ["1th award", "4th award", "1th award"],
  ])("saved %j + later %j gives %j", (saved, later, expected) => {
    expect(upgradedAwardNote(saved, later)).toBe(expected);
  });
});
