/**
 * When the app writes an award's generated note it keeps that exact string in
 * the award's autoNotes. A later document may raise the award number in the
 * note only while notes is identical to autoNotes, character for character,
 * and only upward. An award without autoNotes (saved before the field existed,
 * restored from an old backup, or typed by hand) and any note that differs
 * from its autoNotes are never changed. A result longer than the 500-character
 * note limit is not written. Award names are invented.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { addAward, getServiceHistory } from "./veteranProfile";
import { awardNotesText, upgradedGeneratedNote } from "./dd214AwardRowText";

const NAME = "Sample Service Medal";
const KEY = "vet_rate_service_history";
const generated = (deviceCount, devices = []) =>
  awardNotesText({ name: NAME, deviceCount, devices });
const fromDocument = (deviceCount, devices = []) => {
  const note = generated(deviceCount, devices);
  addAward({ name: NAME, notes: note, autoNotes: note });
};
const saved = () => getServiceHistory().awards[0];
const editStoredNote = (notes) => {
  const history = JSON.parse(localStorage.getItem(KEY));
  history.awards[0].notes = notes;
  localStorage.setItem(KEY, JSON.stringify(history));
};

beforeEach(() => {
  localStorage.clear();
});

describe("a second document and a note the app generated", () => {
  it("raises the exact generated note and its copy together", () => {
    fromDocument(2);
    fromDocument(4);
    expect(saved().notes).toBe("4th award");
    expect(saved().autoNotes).toBe("4th award");
    expect(getServiceHistory().awards).toHaveLength(1);
  });

  it("keeps the saved devices text when it raises the number", () => {
    fromDocument(2, ["M Device"]);
    fromDocument(3, ["V Device"]);
    expect(saved().notes).toBe("3rd award; Devices: M Device");
    expect(saved().autoNotes).toBe(saved().notes);
  });

  it("raises it again on a third document", () => {
    fromDocument(2);
    fromDocument(3);
    fromDocument(7);
    expect(saved().notes).toBe("7th award");
  });

  it("adds a number to a generated note that had none", () => {
    fromDocument(0, ["M Device"]);
    expect(saved().notes).toBe("Devices: M Device");
    fromDocument(2, ["M Device"]);
    expect(saved().notes).toBe("2nd award; Devices: M Device");
    expect(saved().autoNotes).toBe(saved().notes);
  });

  it("never writes '1st award' in front of a note", () => {
    fromDocument(0, ["M Device"]);
    fromDocument(1, ["M Device"]);
    expect(saved().notes).toBe("Devices: M Device");
  });

  it("never lets a lower or equal number replace a higher one", () => {
    fromDocument(4);
    fromDocument(2);
    expect(saved().notes).toBe("4th award");
    fromDocument(4);
    fromDocument(0);
    expect(saved().notes).toBe("4th award");
    expect(saved().autoNotes).toBe("4th award");
  });
});

describe("a note that is not exactly the generated one is never touched", () => {
  const EDITS = [
    "2nd award; Devices: Bronze Star",
    "2nd award; Devices: M Device and a note",
    "2nd award; Devices: M Device.",
    "3rd award; Devices: M Device",
    "2nd award",
    "2nd award earned in the field",
    "2nd award!",
    "Devices: M Device",
    "Devices: my own list",
    "Awarded twice",
    "2 awards",
    "1st award",
    "2nd  award",
    "2nd Award; Devices: M Device",
    "",
  ];

  it.each(EDITS)("an edit to %j is left alone", (edited) => {
    fromDocument(2, ["M Device"]);
    editStoredNote(edited);
    fromDocument(9, ["M Device"]);
    expect(saved().notes).toBe(edited);
    expect(saved().autoNotes).toBe("2nd award; Devices: M Device");
  });

  it("leaves an award saved without autoNotes alone, whatever its note says", () => {
    for (const note of [
      "2nd award",
      "Devices: M Device",
      "2nd award; Devices: M Device",
    ]) {
      localStorage.clear();
      addAward({ name: NAME, notes: note });
      expect(saved().autoNotes).toBeUndefined();
      fromDocument(9, ["M Device"]);
      expect(saved().notes).toBe(note);
      expect(saved().autoNotes).toBeUndefined();
    }
  });

  it("treats a hand-typed note given to addAward as not generated", () => {
    addAward({ name: NAME, notes: "typed by the veteran" });
    fromDocument(5);
    expect(saved().notes).toBe("typed by the veteran");
  });
});

describe("the 500-character note limit", () => {
  const devicesOnly = (length) => `Devices: ${"A".repeat(length - 9)}`;

  it("leaves a devices-only note at the limit alone rather than clip its tail", () => {
    const note = devicesOnly(500);
    expect(note).toHaveLength(500);
    addAward({ name: NAME, notes: note, autoNotes: note });
    fromDocument(2);
    expect(saved().notes).toBe(note);
    expect(saved().autoNotes).toBe(note);
  });

  it("raises a note whose result lands exactly on the limit", () => {
    const note = devicesOnly(489);
    addAward({ name: NAME, notes: note, autoNotes: note });
    fromDocument(2);
    expect(saved().notes).toBe(`2nd award; ${note}`);
    expect(saved().notes).toHaveLength(500);
  });

  it("does not write a result of 501 characters", () => {
    const note = devicesOnly(490);
    expect(upgradedGeneratedNote(note, "2nd award", 500)).toBeNull();
  });
});

describe("backup and restore", () => {
  it("restores an old backup, whose awards have no autoNotes, untouched", () => {
    const oldBackup = JSON.stringify({
      awards: [
        {
          id: "award_1",
          name: NAME,
          abbreviation: "",
          dateReceived: null,
          notes: "2nd award",
          isCombat: false,
          devices: [],
          dateAdded: "2020-01-01T00:00:00.000Z",
        },
      ],
    });
    localStorage.setItem(KEY, oldBackup);

    expect(saved().autoNotes).toBeUndefined();
    fromDocument(6);
    expect(saved().notes).toBe("2nd award");
    expect(saved()).not.toHaveProperty("autoNotes");
  });

  it("round-trips the field through a raw copy of the stored history", () => {
    fromDocument(2, ["M Device"]);
    const backedUp = localStorage.getItem(KEY);
    localStorage.clear();
    localStorage.setItem(KEY, backedUp);

    expect(saved().autoNotes).toBe("2nd award; Devices: M Device");
    fromDocument(5, ["M Device"]);
    expect(saved().notes).toBe("5th award; Devices: M Device");
  });
});

describe("upgradedGeneratedNote", () => {
  it.each([
    ["2nd award", "4th award", "4th award"],
    [
      "2nd award; Devices: M Device",
      "11th award",
      "11th award; Devices: M Device",
    ],
    ["Devices: M Device", "2nd award", "2nd award; Devices: M Device"],
    ["", "3rd award", "3rd award"],
    ["", "1st award", null],
    ["Devices: M Device", "1st award", null],
    ["4th award", "3rd award", null],
    ["4th award", "4th award", null],
    ["2nd award", "Devices: M Device", null],
    ["2nd award", "4th award and more", null],
    ["2nd award", "1th award", null],
  ])("saved %j + later %j gives %j", (savedNote, later, expected) => {
    expect(upgradedGeneratedNote(savedNote, later, 500)).toBe(expected);
  });
});
