import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (...parts) => readFileSync(join(process.cwd(), ...parts), "utf8");

describe("assistant layout at 390px (class and rule checks; not a render)", () => {
  const assistant = read("src", "components", "AIAssistant.jsx");

  it("the docked window never exceeds the viewport width", () => {
    expect(assistant).toMatch(/fixed z-50 w-96 max-w-\[calc\(100vw-2rem\)\]/);
  });

  it("the drag bounds use the real width, not a fixed 384", () => {
    expect(assistant).not.toMatch(/isMinimized \? 72 : 384/);
    expect(assistant).toMatch(/dockedWidth\(\)/);
  });

  it("the header keeps its controls on screen on a phone", () => {
    expect(assistant).toMatch(/min-w-0/);
    expect(assistant).toMatch(/hidden sm:/);
  });

  it("the docked window marks itself so the floating privacy badge steps aside on phones", () => {
    expect(assistant).toMatch(/data-docked-assistant/);
    const css = read("src", "index.css");
    expect(css).toMatch(
      /@media \(width <= 767px\)\s*\{\s*body:has\(\[data-docked-assistant\]\) \.above-mobile-nav/,
    );
  });
});

describe("assistant header at 1280 (class checks; not a render)", () => {
  const assistant = read("src", "components", "AIAssistant.jsx");
  const header = assistant.slice(
    assistant.indexOf("function DockedHeader("),
    assistant.indexOf("function ExpandedFooter("),
  );

  it("the title block takes the space left and clips, so it cannot run under the status badge", () => {
    expect(header).toMatch(
      /flex min-w-0 flex-1 items-center gap-3 overflow-hidden/,
    );
  });

  it("the drag hint truncates instead of overflowing", () => {
    expect(header).toMatch(/min-w-0 truncate/);
    expect(header).toMatch(/<span className="truncate">/);
  });

  it("the status badge and buttons keep their size", () => {
    expect(header).toMatch(/flex shrink-0 items-center/);
  });
});
