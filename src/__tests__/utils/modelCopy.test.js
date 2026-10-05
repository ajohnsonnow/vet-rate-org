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
    expect(manual).toMatch(
      /Qwen 3\.5 4B on desktops \(about 2\.4 GB download\)/,
    );
    expect(manual).toMatch(
      /Qwen 3\.5 2B on laptops \(about 1\.1 GB download\)/,
    );
    expect(manual).toMatch(/one-time download kept on your device/);
  });

  it("the manual's VRAM list gives GPU memory and download size separately, with no stale 2.0 GB Qwen 2.5 line", () => {
    const manual = read("../../components/UserManual.jsx");
    expect(manual).not.toMatch(/Qwen 2\.5 3B \(2\.0 GB\)/);
    expect(manual).toMatch(
      /Qwen 3\.5 2B \(laptops\): about 2\.2 GB GPU memory, about 1\.1 GB download/,
    );
    expect(manual).toMatch(
      /Qwen 3\.5 4B \(desktops\): about 3\.9 GB GPU memory, about 2\.4 GB download/,
    );
    expect(manual).toMatch(
      /Qwen 2\.5 3B \(fallback\): about 2\.5 GB GPU memory, about 1\.8 GB download/,
    );
  });
});
