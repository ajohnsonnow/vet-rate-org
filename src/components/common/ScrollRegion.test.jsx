import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ScrollRegion from "./ScrollRegion";

describe("ScrollRegion", () => {
  it("is a named, keyboard-focusable region with a visible focus ring", () => {
    render(
      <ScrollRegion label="Monthly rates">
        <table>
          <thead>
            <tr>
              <th>Rate</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>x</td>
            </tr>
          </tbody>
        </table>
      </ScrollRegion>,
    );
    const region = screen.getByRole("region", { name: "Monthly rates" });
    expect(region.getAttribute("tabindex")).toBe("0");
    expect(region.className).toMatch(/overflow-x-auto/);
    expect(region.className).toMatch(/focus-visible:ring-2/);
    expect(region.className).not.toMatch(/outline-none/);
  });
});

describe("the calculator's horizontally scrolling tables", () => {
  it("all use ScrollRegion, none a bare overflow-x-auto div", () => {
    const source = readFileSync(
      join(process.cwd(), "src", "components", "TacticalCalculator.jsx"),
      "utf8",
    );
    expect(source).not.toMatch(/<div className="overflow-x-auto">/);
    expect(source.match(/<ScrollRegion /g)).toHaveLength(3);
  });
});
