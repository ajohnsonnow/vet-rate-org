import { describe, it, expect } from "vitest";

import { initializeVKB, mergeDD214IntoVKB } from "./veteranKnowledgeBase";

describe("veteranKnowledgeBase: foreignService tri-state", () => {
  it("initializes to null (unknown), not false", () => {
    const vkb = initializeVKB();
    expect(vkb.serviceHistory.foreignService).toBeNull();
  });

  it("stays null when the incoming DD214 data never extracted it", () => {
    const vkb = initializeVKB();
    mergeDD214IntoVKB(vkb, { branch: "Army" });
    expect(vkb.serviceHistory.foreignService).toBeNull();
  });

  it("records an explicit false instead of leaving it null or true", () => {
    const vkb = initializeVKB();
    mergeDD214IntoVKB(vkb, { foreignService: false });
    expect(vkb.serviceHistory.foreignService).toBe(false);
  });

  it("records an explicit true", () => {
    const vkb = initializeVKB();
    mergeDD214IntoVKB(vkb, { foreignService: true });
    expect(vkb.serviceHistory.foreignService).toBe(true);
  });

  it("does not let a later document's unknown (null) foreignService overwrite an already-known false", () => {
    const vkb = initializeVKB();
    mergeDD214IntoVKB(vkb, { foreignService: false });
    mergeDD214IntoVKB(vkb, { foreignService: null });
    expect(vkb.serviceHistory.foreignService).toBe(false);
  });

  it("lets a later document's explicit false overwrite an earlier unknown", () => {
    const vkb = initializeVKB();
    mergeDD214IntoVKB(vkb, {});
    mergeDD214IntoVKB(vkb, { foreignService: false });
    expect(vkb.serviceHistory.foreignService).toBe(false);
  });
});
