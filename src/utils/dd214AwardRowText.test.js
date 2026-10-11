import { describe, it, expect } from "vitest";
import {
  awardNotesText,
  awardNumberText,
  awardRowText,
  awardsRowText,
} from "./dd214AwardRowText";

describe("awardRowText", () => {
  it.each([
    [{ name: "Sample Service Medal" }, "Sample Service Medal"],
    [
      { name: "Sample Service Medal", deviceCount: 0, devices: [] },
      "Sample Service Medal",
    ],
    [
      { name: "Sample Service Medal", deviceCount: 2 },
      "Sample Service Medal (2nd award)",
    ],
    [
      { name: "Sample Unit Citation", deviceCount: 3 },
      "Sample Unit Citation (3rd award)",
    ],
    [
      { name: "Sample Unit Citation", deviceCount: 11 },
      "Sample Unit Citation (11th award)",
    ],
    [
      { name: "Sample Unit Citation", deviceCount: 22 },
      "Sample Unit Citation (22nd award)",
    ],
    [
      { name: "Sample Flight Medal", devices: ["M Device"] },
      "Sample Flight Medal with M Device",
    ],
    [
      {
        name: "Sample Campaign Medal",
        devices: ["Bronze Service Star", "Bronze Service Star"],
      },
      "Sample Campaign Medal with 2 Bronze Service Star",
    ],
    [
      {
        name: "Sample Flight Medal",
        deviceCount: 4,
        devices: ["M Device", "Oak Leaf Cluster", "Oak Leaf Cluster"],
      },
      "Sample Flight Medal (4th award) with M Device, 2 Oak Leaf Cluster",
    ],
    [
      {
        name: "Sample Flight Medal",
        devices: [{ type: "V Device", position: 1 }, {}, null, "  "],
      },
      "Sample Flight Medal with V Device",
    ],
  ])("%j reads %s", (award, expected) => {
    expect(awardRowText(award)).toBe(expected);
  });

  it.each([
    [undefined],
    [null],
    [{}],
    [{ name: "   " }],
    [{ name: 42, deviceCount: 2 }],
  ])("gives nothing for %j", (award) => {
    expect(awardRowText(award)).toBe("");
  });

  it.each([[-1], [1.5], [1000], [Number.NaN], ["2"]])(
    "ignores an unusable award count of %j",
    (deviceCount) => {
      expect(awardRowText({ name: "Sample Service Medal", deviceCount })).toBe(
        "Sample Service Medal",
      );
    },
  );
});

describe("the row is bounded", () => {
  const manyDevices = Array.from({ length: 2000 }, (_, i) => `Device ${i}`);

  it("shows at most five kinds of device, then how many more", () => {
    const text = awardRowText({
      name: "Sample Flight Medal",
      devices: ["A", "B", "C", "D", "E", "F", "G"],
    });

    expect(text).toBe("Sample Flight Medal with A, B, C, D, E and 2 more");
  });

  it("stays short for 2000 different device strings", () => {
    const text = awardRowText({
      name: "Sample Flight Medal",
      devices: manyDevices,
    });

    expect(text.length).toBeLessThanOrEqual(300);
    expect(text).toContain("and 1995 more");
  });

  it("cuts a long device name and a long award name", () => {
    const text = awardRowText({
      name: "N".repeat(1000),
      deviceCount: 2,
      devices: ["D".repeat(500)],
    });

    expect(text).toHaveLength(300);
    expect(text.endsWith("…")).toBe(true);
  });

  it("stays under 2000 characters for a very long list, saying how many are left out", () => {
    const awards = Array.from({ length: 500 }, (_, i) => ({
      name: `Sample Medal number ${i}`,
      deviceCount: 2,
      devices: ["M Device"],
    }));

    const text = awardsRowText(awards);

    expect(text.length).toBeLessThanOrEqual(2040);
    expect(text).toMatch(/; and \d+ more$/);
    expect(
      text.startsWith("Sample Medal number 0 (2nd award) with M Device; "),
    ).toBe(true);
  });

  it("joins a short list with semicolons and skips unnamed awards", () => {
    expect(
      awardsRowText([{ name: "One" }, {}, { name: "Two", deviceCount: 3 }]),
    ).toBe("One; Two (3rd award)");
    expect(awardsRowText(undefined)).toBe("");
  });
});

describe("the notes the save keeps use the row's words", () => {
  it.each([
    [{ name: "X" }, ""],
    [{ name: "X", deviceCount: 2 }, "2nd award"],
    [{ name: "X", devices: ["M Device"] }, "Devices: M Device"],
    [
      {
        name: "X",
        deviceCount: 3,
        devices: [{ type: "V Device" }, "M Device"],
      },
      "3rd award; Devices: V Device, M Device",
    ],
  ])("%j is saved as %j", (award, expected) => {
    expect(awardNotesText(award)).toBe(expected);
  });

  it("names the number exactly as the row does", () => {
    const award = { name: "X", deviceCount: 12 };

    expect(awardNumberText(award)).toBe("12th award");
    expect(awardRowText(award)).toContain(`(${awardNumberText(award)})`);
  });
});
