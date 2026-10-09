import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (...p) => readFileSync(join(process.cwd(), ...p), "utf8");

describe("the load panel has no ready or switch state", () => {
  it("its source and the loader carry none of their strings", () => {
    const button = read("src", "components", "SmartAILoadButton.jsx");
    const loader = read("src", "utils", "smartAILoader.js");
    for (const text of [button, loader]) {
      expect(text).not.toMatch(/AI Ready/);
      expect(text).not.toMatch(/Switch/);
      expect(text).not.toMatch(/will be unloaded/);
      expect(text).not.toMatch(/Unloading current model/);
    }
  });
});
