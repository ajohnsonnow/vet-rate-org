import { describe, it, expect, beforeEach } from "vitest";

import { saveDD214Data, getServiceHistory } from "./veteranProfile";

describe("veteranProfile: saveDD214Data foreignService tri-state", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("stores null (unknown), not a fabricated false, when foreignService was never extracted", () => {
    saveDD214Data({ branch: "Army" });
    expect(getServiceHistory().dd214Data.foreignService).toBeNull();
  });

  it("stores an explicit false", () => {
    saveDD214Data({ branch: "Army", foreignService: false });
    expect(getServiceHistory().dd214Data.foreignService).toBe(false);
  });

  it("stores an explicit true", () => {
    saveDD214Data({ branch: "Army", foreignService: true });
    expect(getServiceHistory().dd214Data.foreignService).toBe(true);
  });
});
