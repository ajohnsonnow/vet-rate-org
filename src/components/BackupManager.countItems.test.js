import { describe, it, expect } from "vitest";
import { countItems } from "./BackupManager";

describe("BackupManager countItems", () => {
  it("counts arrays and treats a throwing read as zero", () => {
    const result = countItems((key) => {
      if (key === "vet_rate_saved_forms") throw new Error("storage blocked");
      if (key === "vet_rate_saved_claims") return JSON.stringify([1, 2]);
      return "{not json";
    });
    expect(result).toEqual([
      { label: "Claims", count: 2 },
      { label: "Forms", count: 0 },
      { label: "Ratings", count: 0 },
    ]);
  });
});
