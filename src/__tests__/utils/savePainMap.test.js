/**
 * FIX-8: savePainMap's whitelist dropped thumbnail, savedAt, conditions,
 * view, nexusLanguage — fields PainPainter.jsx actually produces — while
 * only keeping screenshot/dateSaved/detectedNexus (already-saved maps'
 * legacy field names). Expand the whitelist to accept both.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { savePainMap, getPainMaps } from "../../utils/veteranProfile";

describe("FIX-8: savePainMap field whitelist", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("persists all five fields PainPainter.jsx produces", () => {
    savePainMap({
      name: "Left Shoulder",
      view: "back",
      savedAt: "2026-07-01T00:00:00.000Z",
      painPoints: { shoulder_left: { intensity: 7 } },
      conditions: ["Rotator Cuff Tear"],
      nexusLanguage: "Rotator Cuff Tear: consistent with repetitive strain.",
      thumbnail: `data:image/png;base64,${"A".repeat(100)}`,
    });

    const [map] = getPainMaps();
    expect(map.view).toBe("back");
    expect(map.savedAt).toBe("2026-07-01T00:00:00.000Z");
    expect(map.conditions).toEqual(["Rotator Cuff Tear"]);
    expect(map.nexusLanguage).toMatch(/Rotator Cuff Tear/);
    expect(map.thumbnail).toMatch(/^data:image\/png;base64,/);
  });

  it("still accepts the legacy field names for already-saved maps", () => {
    savePainMap({
      name: "Legacy map",
      screenshot: `data:image/jpeg;base64,${"B".repeat(50)}`,
      detectedNexus: [{ name: "Tinnitus", description: "..." }],
    });

    const [map] = getPainMaps();
    expect(map.screenshot).toMatch(/^data:image\/jpeg;base64,/);
    expect(map.detectedNexus).toHaveLength(1);
  });

  it("drops an oversized thumbnail rather than storing a corrupt truncated image", () => {
    const oversized = `data:image/png;base64,${"C".repeat(600 * 1024)}`;
    savePainMap({ name: "huge", thumbnail: oversized });

    const [map] = getPainMaps();
    expect(map.thumbnail).toBeNull();
  });

  it("rejects a thumbnail that isn't actually an image data URL", () => {
    savePainMap({ name: "bad", thumbnail: "javascript:alert(1)" });
    const [map] = getPainMaps();
    expect(map.thumbnail).toBeNull();
  });
});
