/**
 * FIX-4: devices must stay structured {type, position} objects end-to-end
 * — VisualRibbon.jsx switches on device.type. mergeDD214Awards previously
 * called .toLowerCase() directly on the device (assuming a string), which
 * throws a TypeError on the real {type, position} object shape
 * ribbonRackData.js's detectDevices produces.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { addAward, getServiceHistory } from "../../utils/veteranProfile";
import {
  mergeDD214IntoVKB,
  initializeVKB,
} from "../../utils/veteranKnowledgeBase";

describe("FIX-4: addAward preserves structured devices", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("stores devices as {type, position} objects, not flattened strings", () => {
    addAward({
      name: "Army Commendation Medal",
      devices: [
        { type: "v_device", position: "center" },
        { type: "bronze_olc", position: 0 },
      ],
    });

    const [award] = getServiceHistory().awards;
    expect(award.devices).toEqual([
      { type: "v_device", position: "center" },
      { type: "bronze_olc", position: 0 },
    ]);
  });

  it("drops a malformed device object rather than storing garbage", () => {
    addAward({
      name: "Bad Conduct Medal Test",
      devices: [{ position: "center" }, "not an object", null],
    });
    const [award] = getServiceHistory().awards;
    expect(award.devices).toEqual([]);
  });
});

describe("FIX-4: mergeDD214Awards does not throw on structured device objects", () => {
  it("merges a new structured-device award without throwing", () => {
    const vkb = initializeVKB();
    expect(() =>
      mergeDD214IntoVKB(
        vkb,
        {
          awards: [
            {
              name: "Army Commendation Medal",
              devices: [{ type: "v_device", position: "center" }],
            },
          ],
        },
        { fileName: "dd214.pdf" },
      ),
    ).not.toThrow();

    expect(vkb.serviceHistory.awards[0].devices).toEqual([
      { type: "v_device", position: "center" },
    ]);
  });

  it("merges additional devices onto an existing award without duplicating identical ones", () => {
    const vkb = initializeVKB();
    mergeDD214IntoVKB(
      vkb,
      {
        awards: [
          {
            name: "Army Commendation Medal",
            devices: [{ type: "bronze_olc", position: 0 }],
          },
        ],
      },
      { fileName: "dd214_1.pdf" },
    );

    expect(() =>
      mergeDD214IntoVKB(
        vkb,
        {
          awards: [
            {
              name: "Army Commendation Medal",
              devices: [
                { type: "bronze_olc", position: 0 }, // duplicate
                { type: "v_device", position: "center" }, // new
              ],
            },
          ],
        },
        { fileName: "dd214_2.pdf" },
      ),
    ).not.toThrow();

    const award = vkb.serviceHistory.awards.find(
      (a) => a.name === "Army Commendation Medal",
    );
    expect(award.devices).toHaveLength(2);
  });
});
