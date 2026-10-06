import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// tailwind.config.js is CommonJS inside an ES-module package, so it is read
// as text here; the e2e spec large-screen.spec.ts checks the result in a
// real browser.
const config = readFileSync(join(process.cwd(), "tailwind.config.js"), "utf8");
const css = readFileSync(join(process.cwd(), "src", "index.css"), "utf8");

describe("breakpoint scale", () => {
  it("extends the default screens instead of replacing them, so sm through 2xl remain", () => {
    const extendAt = config.indexOf("extend: {");
    const screensAt = config.indexOf("screens: {");
    expect(extendAt).toBeGreaterThan(-1);
    expect(screensAt).toBeGreaterThan(extendAt);
    expect(config).not.toMatch(/"2xl":/);
  });

  it("adds 3xl and 4xl so large screens can be targeted", () => {
    expect(config).toMatch(/"3xl": "1920px"/);
    expect(config).toMatch(/"4xl": "2560px"/);
  });

  it("scales the root font size above 2560px for each user font-size setting, bounded at 1.5x", () => {
    const block = css.slice(css.indexOf("@media (width >= 2560px)"));
    expect(block).toContain("clamp(16px, calc(100vw / 160), 24px)");
    expect(block).toContain("clamp(14px, calc(100vw / 182.857), 21px)");
    expect(block).toContain("clamp(18px, calc(100vw / 142.222), 27px)");
    expect(block).toContain("clamp(20px, calc(100vw / 128), 30px)");
  });
});
