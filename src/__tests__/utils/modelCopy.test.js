import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("About and User Manual name the on-device models", () => {
  it("About names Qwen 3.5 as the stock base model", () => {
    expect(read("../../components/AboutUs.jsx")).toMatch(
      /Stock open models such as Qwen 3\.5/,
    );
  });

  it("the manual says which model each device picks, that it is a one-time download kept on the device, and makes no accuracy claim", () => {
    const manual = read("../../components/UserManual.jsx");
    expect(manual).toMatch(/Qwen 3\.5 4B on desktops/);
    expect(manual).toMatch(/Qwen 3\.5 2B on laptops/);
    expect(manual).toMatch(/one-time download kept on your device/);
    expect(manual).toMatch(/size varies/);
  });
});
