import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import MobileNotice from "./MobileNotice";

beforeEach(() => {
  sessionStorage.clear();
  vi.stubGlobal("navigator", {
    ...window.navigator,
    userAgent:
      "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15",
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("Tablet Mode banner dismiss control", () => {
  it("is a 44px target", () => {
    render(<MobileNotice />);
    const button = screen.getByRole("button", { name: "Dismiss notice" });
    expect(button.className).toMatch(/h-11/);
    expect(button.className).toMatch(/w-11/);
  });

  it("steps aside while a dialog is open, so a dialog never covers it", () => {
    render(<MobileNotice />);
    const banner = screen.getByRole("status");
    expect(banner.className).toMatch(/hide-when-dialog-open/);
    const css = readFileSync(join(process.cwd(), "src", "index.css"), "utf8");
    expect(css).toMatch(/\.hide-when-dialog-open/);
  });
});
