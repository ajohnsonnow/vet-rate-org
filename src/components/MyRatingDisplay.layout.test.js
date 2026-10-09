import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// MyPacket cannot be imported under the test runner (pdf.js worker), so this
// reads the rating row's source: class and structure checks, not a render.
const source = readFileSync(
  join(process.cwd(), "src", "components", "MyPacket.jsx"),
  "utf8",
);
const start = source.indexOf("function MyRatingDisplay(");
const row = source.slice(
  start,
  source.indexOf("function MyRatingEntry(", start),
);

describe("My Ratings row actions on a phone", () => {
  it("wraps under the rating on a narrow screen instead of pinning Remove to the right edge, where the floating buttons cover it", () => {
    expect(row).toMatch(/flex flex-wrap items-center justify-between gap-2/);
    expect(row).toMatch(/flex w-full flex-shrink-0 gap-2 sm:w-auto/);
  });

  it("gives Edit and Remove 44px targets", () => {
    const buttons = row.match(/<button[\s\S]*?className="[^"]*"/g) ?? [];
    expect(buttons).toHaveLength(2);
    for (const button of buttons) expect(button).toMatch(/min-h-\[44px\]/);
  });
});
