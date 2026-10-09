import { describe, it, expect } from "vitest";
import { awardRowText } from "./dd214AwardRowText";

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
